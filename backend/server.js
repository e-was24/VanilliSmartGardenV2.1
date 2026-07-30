const express = require('express');
const http = require('http');
const path = require('path');
const os = require('os');
const fs = require('fs');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');
const multer = require('multer');
const sharp = require('sharp');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'smart-garden-backend' });
});

app.get('/api/sensor', (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json(lastData);
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'smart-garden-backend' });
});

const REFERENCE_IMAGE_PATH = path.join(__dirname, 'owner_face.jpg');
const LEGACY_REFERENCE_IMAGE_PATH = path.join(__dirname, 'reference-face.jpg');
const TEMP_REFERENCE_IMAGE_PATH = path.join(os.tmpdir(), 'owner_face.jpg');
const THRESHOLD = 0.25;
let registeredReferenceBuffer = null;

function loadRegisteredReferenceBuffer() {
  if (registeredReferenceBuffer) {
    return registeredReferenceBuffer;
  }

  const candidates = [REFERENCE_IMAGE_PATH, LEGACY_REFERENCE_IMAGE_PATH, TEMP_REFERENCE_IMAGE_PATH];

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        registeredReferenceBuffer = fs.readFileSync(candidate);
        return registeredReferenceBuffer;
      }
    } catch (error) {
      console.error('Gagal membaca buffer wajah referensi:', error.message);
    }
  }

  return null;
}

function persistRegisteredReferenceBuffer(buffer) {
  registeredReferenceBuffer = buffer;

  try {
    fs.writeFileSync(REFERENCE_IMAGE_PATH, buffer);
  } catch (error) {
    console.error('Gagal menyimpan owner_face.jpg:', error.message);
  }

  try {
    fs.writeFileSync(TEMP_REFERENCE_IMAGE_PATH, buffer);
  } catch (error) {
    console.error('Gagal menyimpan referensi ke tmp:', error.message);
  }
}

async function compareFaces(referenceBuffer, probeBuffer) {
  try {
    const reference = await sharp(referenceBuffer).resize(200, 200).grayscale().raw().toBuffer();
    const probe = await sharp(probeBuffer).resize(200, 200).grayscale().raw().toBuffer();

    if (!reference || !probe || reference.length !== probe.length) {
      return { similarity: 0, ok: false };
    }

    let sum = 0;
    for (let i = 0; i < reference.length; i += 1) {
      sum += (reference[i] - probe[i]) ** 2;
    }

    const mse = sum / reference.length;
    const similarity = Math.max(0, 1 - Math.min(1, mse / 65025));
    return { similarity, ok: similarity >= THRESHOLD };
  } catch (error) {
    console.error('Face compare error', error);
    return { similarity: 0, ok: false };
  }
}

app.post('/api/verify-face', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Gambar tidak dikirim.' });
    }

    const referenceBuffer = loadRegisteredReferenceBuffer();
    if (!referenceBuffer) {
      return res.status(404).json({
        status: 'error',
        message: 'Belum ada wajah terdaftar. Silakan tekan tombol Daftarkan Wajah Saya terlebih dahulu.',
      });
    }

    const { similarity, ok } = await compareFaces(referenceBuffer, req.file.buffer);

    return res.json({
      status: ok ? 'success' : 'failed',
      message: ok ? 'Wajah cocok. Akses diperbolehkan.' : 'Wajah tidak cocok. Akses ditolak.',
      confidence: Number(similarity.toFixed(4)),
      threshold: THRESHOLD,
      allowed: ok,
    });
  } catch (error) {
    console.error('verify-face error', error);
    return res.status(500).json({ status: 'error', message: 'Gagal memproses wajah saat ini.' });
  }
});

app.post('/api/register-face', upload.single('file'), (req, res) => {
  try {
    if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
      return res.status(400).json({ status: 'error', message: 'Gambar tidak dikirim.' });
    }

    persistRegisteredReferenceBuffer(req.file.buffer);

    return res.json({
      status: 'success',
      message: 'Wajah pemilik berhasil disimpan sebagai referensi.',
      path: REFERENCE_IMAGE_PATH,
    });
  } catch (error) {
    console.error('register-face error', error);
    return res.status(500).json({ status: 'error', message: 'Gagal menyimpan wajah referensi.' });
  }
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ---- Koneksi ke broker MQTT ----
let mqttClient = null;

try {
  mqttClient = mqtt.connect('mqtt://broker.emqx.io:1883');
} catch (error) {
  console.error('Gagal membuat koneksi MQTT:', error);
}

const TOPICS_SUBSCRIBE = [
  'kebun/sensor/moisture',
  'kebun/sensor/moisture/detail',
  'kebun/sensor/suhu',
  'kebun/sistem/status',   // retained: status ON/OFF sistem (master power) sebenarnya
  'kebun/watering/status', // retained: status ON/OFF auto watering sebenarnya
];

// sistemAktif & terakhirUpdate sengaja dipisah dari data sensor:
// - sistemAktif  -> status device yang sebenarnya (dari topic retained)
// - terakhirUpdate -> kapan sensor TERAKHIR kali kirim data. Penting karena
//   begitu sistem OFF, ESP32 berhenti total kirim data sensor (lihat catatan
//   di firmware). Tanpa timestamp ini, React bakal terus nampilin angka lama
//   seolah-olah itu masih live.
let lastData = {
  moisture: null,
  detail: null,
  suhu: null,
  sistemAktif: null,
  autoWateringAktif: null,
  pompaAktif: false, // Ditambahkan untuk status pompa
  terakhirUpdate: null,
};

if (mqttClient) {
  mqttClient.on('connect', () => {
    console.log('Terhubung ke MQTT broker');
    mqttClient.subscribe(TOPICS_SUBSCRIBE);
  });

  mqttClient.on('error', (err) => {
    console.error('MQTT error:', err.message);
  });

  // Setiap ada data baru dari ESP32, teruskan ke semua client React via socket.io
  mqttClient.on('message', (topic, payload) => {
  const pesan = payload.toString();

  switch (topic) {
    case 'kebun/sistem/status':
      // retained message: ON/OFF status sistem (master power) sebenarnya
      lastData.sistemAktif = pesan === 'ON';
      break;

    case 'kebun/watering/status':
      // retained message: ON/OFF status auto watering sebenarnya
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
        console.error('Gagal parse JSON detail sensor:', err.message);
      }
      break;
  }

    io.emit('sensor-update', lastData); // broadcast ke semua React yang lagi connect
  });
}

// ---- Endpoint REST buat React kirim perintah ----

app.post('/api/sistem', (req, res) => {
  const { aksi } = req.body; // "START" atau "STOP"

  if (aksi !== 'START' && aksi !== 'STOP') {
    return res.status(400).json({ ok: false, error: 'aksi harus START atau STOP' });
  }

  const sistemAktif = aksi === 'START';
  if (mqttClient) {
    mqttClient.publish('kebun/sistem/set', aksi);
  }

  lastData.sistemAktif = sistemAktif;
  io.emit('sensor-update', lastData);

  res.json({ ok: true, sistemAktif: lastData.sistemAktif });
});

app.post('/api/watering', (req, res) => {
  const { aksi } = req.body; // "ON" atau "OFF"

  if (aksi !== 'ON' && aksi !== 'OFF') {
    return res.status(400).json({ ok: false, error: 'aksi harus ON atau OFF' });
  }

  if (mqttClient) {
    mqttClient.publish('kebun/watering/set', aksi);
  }

  lastData.autoWateringAktif = aksi === 'ON';
  io.emit('sensor-update', lastData);

  res.json({ ok: true, autoWateringAktif: lastData.autoWateringAktif });
});

app.post('/api/pompa', (req, res) => {
  const { aksi } = req.body; // "ON" atau "OFF"

  if (aksi !== 'ON' && aksi !== 'OFF') {
    return res.status(400).json({ ok: false, error: 'aksi harus ON atau OFF' });
  }

  if (mqttClient) {
    mqttClient.publish('kebun/pompa/set', aksi);
  }

  lastData.pompaAktif = aksi === 'ON';
  io.emit('sensor-update', lastData);

  res.json({ ok: true, pompaAktif: lastData.pompaAktif });
});

// Kirim data terakhir saat client baru connect
io.on('connection', (socket) => {
  socket.emit('sensor-update', lastData);
});

const port = Number(process.env.PORT || 3001);

if (require.main === module) {
  server.listen(port, () => console.log(`Backend jalan di port ${port}`));
}

module.exports = app;