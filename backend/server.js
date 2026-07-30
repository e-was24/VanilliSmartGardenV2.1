const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();

// ---- CORS harus dipasang pertama, sebelum semua middleware lain ----
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.options('*', cors()); // handle preflight

app.use(express.json());

// ---- Health check ----
app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'smart-garden-backend' });
});

// ---- Sensor data endpoint ----
app.get('/api/sensor', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(lastData);
});

// ---- Face verification (proxy ke Python FastAPI / fallback simple) ----
const REFERENCE_IMAGE_PATH = path.join(__dirname, 'owner_face.jpg');
const TEMP_REFERENCE_IMAGE_PATH = path.join(os.tmpdir(), 'owner_face.jpg');
let registeredReferenceBuffer = null;

function loadReferenceBuffer() {
  if (registeredReferenceBuffer) return registeredReferenceBuffer;

  for (const filePath of [REFERENCE_IMAGE_PATH, TEMP_REFERENCE_IMAGE_PATH]) {
    try {
      if (fs.existsSync(filePath)) {
        registeredReferenceBuffer = fs.readFileSync(filePath);
        return registeredReferenceBuffer;
      }
    } catch (_) { /* skip */ }
  }
  return null;
}

function saveReferenceBuffer(buffer) {
  registeredReferenceBuffer = buffer;
  try { fs.writeFileSync(REFERENCE_IMAGE_PATH, buffer); } catch (_) { /* skip */ }
  try { fs.writeFileSync(TEMP_REFERENCE_IMAGE_PATH, buffer); } catch (_) { /* skip */ }
}

// Perbandingan piksel sederhana tanpa library native
// Hitung jumlah byte yang berbeda signifikan (> 30 dari 255)
function simpleSimilarity(bufA, bufB) {
  try {
    const len = Math.min(bufA.length, bufB.length);
    if (len === 0) return 0;
    let sameCount = 0;
    // Sample setiap 4 byte agar cepat
    const step = Math.max(1, Math.floor(len / 5000));
    let total = 0;
    for (let i = 0; i < len; i += step) {
      const diff = Math.abs(bufA[i] - bufB[i]);
      if (diff < 40) sameCount++;
      total++;
    }
    return total > 0 ? sameCount / total : 0;
  } catch (_) {
    return 0;
  }
}

// Coba proxy ke Python FastAPI (port 8000), fallback ke perbandingan lokal
async function proxyToPython(path, formDataBuffer, filename) {
  try {
    // Dynamic require node-fetch agar tidak crash jika tidak tersedia
    const fetch = require('node-fetch');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', formDataBuffer, { filename, contentType: 'image/jpeg' });

    const res = await fetch(`http://127.0.0.1:8000${path}`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
      timeout: 3000,
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (_) { /* Python offline */ }
  return null;
}

app.post('/api/verify-face', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.json({ status: 'failed', allowed: false, message: 'Gambar tidak dikirim.' });
    }

    // Coba proxy ke Python FastAPI dulu
    const pyResult = await proxyToPython('/api/verify-face', req.file.buffer, 'webcam_capture.jpg');
    if (pyResult) return res.json(pyResult);

    // Fallback: perbandingan pixel sederhana
    const ref = loadReferenceBuffer();
    if (!ref) {
      return res.json({
        status: 'failed',
        allowed: false,
        message: 'Belum ada wajah terdaftar. Tekan Simpan Muka terlebih dahulu.',
      });
    }

    const THRESHOLD = 0.55;
    const similarity = simpleSimilarity(ref, req.file.buffer);
    const ok = similarity >= THRESHOLD;

    return res.json({
      status: ok ? 'success' : 'failed',
      allowed: ok,
      message: ok ? 'Verifikasi berhasil.' : 'Wajah tidak cocok. Akses ditolak.',
      confidence: Number(similarity.toFixed(4)),
      threshold: THRESHOLD,
    });
  } catch (err) {
    console.error('verify-face error:', err);
    return res.json({ status: 'error', allowed: false, message: 'Gagal memproses verifikasi.' });
  }
});

app.post('/api/register-face', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.json({ status: 'failed', allowed: false, message: 'Gambar tidak dikirim.' });
    }

    saveReferenceBuffer(req.file.buffer);

    // Coba juga simpan ke Python FastAPI
    await proxyToPython('/api/register-face', req.file.buffer, 'owner_register.jpg');

    return res.json({
      status: 'success',
      allowed: true,
      message: 'Wajah pemilik berhasil disimpan.',
    });
  } catch (err) {
    console.error('register-face error:', err);
    return res.json({ status: 'error', allowed: false, message: 'Gagal menyimpan wajah.' });
  }
});

// ---- Socket.io & HTTP server ----
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ---- MQTT ----
let mqttClient = null;
try {
  mqttClient = mqtt.connect('mqtt://broker.emqx.io:1883');
} catch (err) {
  console.error('Gagal koneksi MQTT:', err.message);
}

const TOPICS_SUBSCRIBE = [
  'kebun/sensor/moisture',
  'kebun/sensor/moisture/detail',
  'kebun/sensor/suhu',
  'kebun/sistem/status',
  'kebun/watering/status',
];

let lastData = {
  moisture: null,
  detail: null,
  suhu: null,
  sistemAktif: null,
  autoWateringAktif: null,
  pompaAktif: false,
  terakhirUpdate: null,
};

if (mqttClient) {
  mqttClient.on('connect', () => {
    console.log('Terhubung ke MQTT broker');
    mqttClient.subscribe(TOPICS_SUBSCRIBE);
  });

  mqttClient.on('error', (err) => console.error('MQTT error:', err.message));

  mqttClient.on('message', (topic, payload) => {
    const pesan = payload.toString();

    switch (topic) {
      case 'kebun/sistem/status':
        lastData.sistemAktif = pesan === 'ON';
        break;
      case 'kebun/watering/status':
        lastData.autoWateringAktif = pesan === 'ON';
        break;
      case 'kebun/sensor/moisture':
        lastData.moisture = Number(pesan);
        lastData.terakhirUpdate = Date.now();
        break;
      case 'kebun/sensor/suhu':
        lastData.suhu = pesan === 'error' ? null : Number(pesan);
        lastData.terakhirUpdate = Date.now();
        break;
      case 'kebun/sensor/moisture/detail':
        try {
          lastData.detail = JSON.parse(pesan);
          lastData.terakhirUpdate = Date.now();
        } catch (err) {
          console.error('Parse JSON detail gagal:', err.message);
        }
        break;
    }

    io.emit('sensor-update', lastData);
  });
}

// ---- Endpoint kontrol REST ----

app.post('/api/sistem', (req, res) => {
  const { aksi } = req.body;
  if (aksi !== 'START' && aksi !== 'STOP') {
    return res.status(400).json({ ok: false, error: 'aksi harus START atau STOP' });
  }

  lastData.sistemAktif = aksi === 'START';
  if (mqttClient) mqttClient.publish('kebun/sistem/set', aksi);
  io.emit('sensor-update', lastData);

  res.json({ ok: true, sistemAktif: lastData.sistemAktif });
});

app.post('/api/watering', (req, res) => {
  const { aksi } = req.body;
  if (aksi !== 'ON' && aksi !== 'OFF') {
    return res.status(400).json({ ok: false, error: 'aksi harus ON atau OFF' });
  }

  lastData.autoWateringAktif = aksi === 'ON';
  if (mqttClient) mqttClient.publish('kebun/watering/set', aksi);
  io.emit('sensor-update', lastData);

  res.json({ ok: true, autoWateringAktif: lastData.autoWateringAktif });
});

app.post('/api/pompa', (req, res) => {
  const { aksi } = req.body;
  if (aksi !== 'ON' && aksi !== 'OFF') {
    return res.status(400).json({ ok: false, error: 'aksi harus ON atau OFF' });
  }

  lastData.pompaAktif = aksi === 'ON';
  if (mqttClient) mqttClient.publish('kebun/pompa/set', aksi);
  io.emit('sensor-update', lastData);

  res.json({ ok: true, pompaAktif: lastData.pompaAktif });
});

io.on('connection', (socket) => {
  socket.emit('sensor-update', lastData);
});

const port = Number(process.env.PORT || 3001);

if (require.main === module) {
  server.listen(port, () => console.log(`Backend jalan di port ${port}`));
}

module.exports = app;