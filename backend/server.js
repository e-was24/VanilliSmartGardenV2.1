const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mqtt = require('mqtt');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'vanili-smart-garden-backend' });
});

app.get('/api/sensor', (req, res) => {
  res.json(lastData);
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ---- Koneksi ke broker MQTT ----
const mqttClient = mqtt.connect('mqtt://broker.emqx.io:1883');

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
  terakhirUpdate: null,
};

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

// ---- Endpoint REST buat React kirim perintah ----

app.post('/api/sistem', (req, res) => {
  const { aksi } = req.body; // "START" atau "STOP"

  if (aksi !== 'START' && aksi !== 'STOP') {
    return res.status(400).json({ ok: false, error: 'aksi harus START atau STOP' });
  }

  mqttClient.publish('kebun/sistem/set', aksi);
  res.json({ ok: true });
});

app.post('/api/watering', (req, res) => {
  const { aksi } = req.body; // "ON" atau "OFF"

  if (aksi !== 'ON' && aksi !== 'OFF') {
    return res.status(400).json({ ok: false, error: 'aksi harus ON atau OFF' });
  }

  mqttClient.publish('kebun/watering/set', aksi);
  res.json({ ok: true });
});

app.post('/api/pompa', (req, res) => {
  const { aksi } = req.body; // "ON" atau "OFF"

  if (aksi !== 'ON' && aksi !== 'OFF') {
    return res.status(400).json({ ok: false, error: 'aksi harus ON atau OFF' });
  }

  mqttClient.publish('kebun/pompa/set', aksi);
  res.json({ ok: true });
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