import { useEffect, useState } from "react";
import "./css/plantControls.css";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");

const AMBANG_SIRAM = 70; // samakan dengan AMBANG_SIRAM di kode ESP32

// Kalau data sensor lebih tua dari ini, dianggap "basi" (biasanya karena
// sistem sedang OFF, ESP32 memang berhenti kirim data sama sekali).
const BATAS_DATA_STALE_MS = 10_000;

const IconDroplet = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 2.5c3.2 4.4 6.5 8.4 6.5 12A6.5 6.5 0 1 1 5.5 14.5c0-3.6 3.3-7.6 6.5-12Z" />
  </svg>
);

const IconMist = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 15h10a3.5 3.5 0 1 0-1-6.9A5 5 0 0 0 4 10.5" />
    <path d="M6 19h6M4 19h.5M14 19h1" strokeLinecap="round" />
  </svg>
);

const IconPower = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 3v8" strokeLinecap="round" />
    <path d="M6.5 6.5a8 8 0 1 0 11 0" strokeLinecap="round" />
  </svg>
);

export default function PlantControls() {
  // --- Terhubung ke backend, untuk kontrol sistem & pompa yang asli ---
  // systemActive sekarang bersumber dari data.sistemAktif yang dikirim backend
  // (berasal dari topic MQTT retained kebun/sistem/status), bukan cuma state
  // lokal hasil klik tombol. Jadi kalau device di-restart atau di-STOP dari
  // sumber lain, tombol di UI ini otomatis ikut sinkron.
  const [systemActive, setSystemActive] = useState(false);
  const [autoWateringActive, setAutoWateringActive] = useState(false);
  const [pumpStatus, setPumpStatus] = useState(false);
  const [rataRataKelembaban, setRataRataKelembaban] = useState(null);
  const [terakhirUpdate, setTerakhirUpdate] = useState(null);
  const [mengirimPerintah, setMengirimPerintah] = useState(false); // cegah klik dobel (Start System)
  const [mengirimWatering, setMengirimWatering] = useState(false); // cegah klik dobel (Auto Watering)

  // --- jadi masih state lokal (dummy) ---
  const [mistStatus, setMistStatus] = useState(false);
  const [nutrients, setNutrients] = useState({
    solutionA: 65,
    solutionB: 60,
  });
  const [sprayInterval, setSprayInterval] = useState(0.1); // dalam menit

  useEffect(() => {
    let cancelled = false;

    const loadSensorData = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/sensor`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!cancelled) {
          setRataRataKelembaban(data.moisture);
          setTerakhirUpdate(data.terakhirUpdate ?? null);

          if (data.sistemAktif !== null && data.sistemAktif !== undefined) {
            setSystemActive(data.sistemAktif);
          }
          if (data.autoWateringAktif !== null && data.autoWateringAktif !== undefined) {
            setAutoWateringActive(data.autoWateringAktif);
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Gagal mengambil data sensor:", error);
        }
      }
    };

    loadSensorData();
    const intervalId = window.setInterval(loadSensorData, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  // Data sensor dianggap basi kalau: sistem lagi OFF, ATAU sudah lama tidak ada
  // update (kemungkinan device putus koneksi). Dua-duanya berarti angka yang
  // ditampilkan bukan bacaan real-time.
  const dataStale =
    !systemActive ||
    terakhirUpdate === null ||
    Date.now() - terakhirUpdate > BATAS_DATA_STALE_MS;

  // Kirim perintah START/STOP ke backend -> diteruskan ke ESP32 lewat MQTT.
  // Tampilan tetap di-update optimis biar tombol terasa responsif, tapi
  // status "asli" akan menyusul lewat socket (topic retained) dan menang
  // kalau ternyata beda (misal request gagal sampai ke device).
  const toggleSystem = async () => {
    if (mengirimPerintah) return;
    setMengirimPerintah(true);

    const perintahBaru = !systemActive;
    setSystemActive(perintahBaru);

    try {
      await fetch(`${BACKEND_URL}/api/sistem`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: perintahBaru ? "START" : "STOP" }),
      });
    } catch (err) {
      console.error("Gagal mengirim perintah sistem:", err);
    } finally {
      setMengirimPerintah(false);
    }
  };

  // Kirim perintah ON/OFF auto watering ke backend -> diteruskan ke ESP32.
  // Ini TERPISAH dari Start System: sistem bisa tetap ON (sensor & publish
  // jalan terus) walau auto watering ini di-OFF-kan (jadi mode manual murni).
  const toggleAutoWatering = async () => {
    if (mengirimWatering) return;
    setMengirimWatering(true);

    const perintahBaru = !autoWateringActive;
    setAutoWateringActive(perintahBaru);

    try {
      await fetch(`${BACKEND_URL}/api/watering`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi: perintahBaru ? "ON" : "OFF" }),
      });
    } catch (err) {
      console.error("Gagal mengirim perintah auto watering:", err);
    } finally {
      setMengirimWatering(false);
    }
  };

  // Kirim perintah ON/OFF pompa manual ke backend -> diteruskan ke ESP32
  const togglePump = async () => {
    const perintahBaru = !pumpStatus;
    setPumpStatus(perintahBaru);
    await fetch(`${BACKEND_URL}/api/pompa`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aksi: perintahBaru ? "ON" : "OFF" }),
    });
  };

  const toggleMist = () => setMistStatus(!mistStatus);

  const intervalOptions = [
    { value: 10, label: "10m" },
    { value: 15, label: "15m" },
    { value: 30, label: "30m" },
    { value: 60, label: "1h" },
  ];

  const tanahKering =
    rataRataKelembaban !== null && rataRataKelembaban !== undefined && rataRataKelembaban < AMBANG_SIRAM;

  const labelWaktuTerakhir = terakhirUpdate
    ? new Date(terakhirUpdate).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })
    : "—";

  return (
    <div className="plant-controls-container">
      <header className="controls-header">
        <span className="header-eyebrow">Vanili planifolia · Zona 01</span>
        <h2>Plant Controls</h2>
        <p>Kelembapan, hidrasi, dan nutrisi vanili — dipantau langsung dari rumah kaca.</p>
        <svg className="vine-divider" viewBox="0 0 600 24" preserveAspectRatio="none">
          <path
            d="M0 12 C 60 2, 90 22, 150 12 S 240 2, 300 12 S 390 22, 450 12 S 540 2, 600 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </header>

      <div className="controls-grid">
        {/* Master switch: START/STOP seluruh sistem ESP32 */}
        <div className={`control-card switch-card ${systemActive ? "is-active" : ""}`}>
          <div className="card-top">
            <span className="card-icon"><IconPower /></span>
            <div className="card-info">
              <h3>Start System</h3>
              <p className="card-status">
                <span className={`status-dot ${systemActive ? "on" : "off"}`}></span>
                {systemActive ? "Aktif" : "Berhenti"}
              </p>
              <p className="card-substatus">
                {systemActive
                  ? `Update terakhir ${labelWaktuTerakhir}`
                  : `Sistem OFF · data terakhir ${labelWaktuTerakhir}`}
              </p>
            </div>
          </div>
          <button
            onClick={toggleSystem}
            disabled={mengirimPerintah}
            className={`switch-toggle ${systemActive ? "on" : "off"}`}
            role="switch"
            aria-checked={systemActive}
          >
            <span className="switch-knob" />
            <span className="switch-label-on">START</span>
            <span className="switch-label-off">STOP</span>
          </button>
        </div>

        {/* Auto Watering: tombol ON/OFF SENDIRI, terpisah dari Start System.
            Kalau ini ON tapi sistem OFF, tetap dianggap nonaktif secara efektif
            (ESP32 skip semua kalau sistem OFF) — makanya statusnya menjelaskan
            kombinasi keduanya, biar tidak membingungkan. */}
        <div className={`control-card switch-card ${autoWateringActive ? "is-active" : ""}`}>
          <div className="card-top">
            <span className="card-icon"><IconDroplet /></span>
            <div className="card-info">
              <h3>Auto Watering</h3>
              <p className="card-status">
                <span className={`status-dot ${autoWateringActive ? "on" : "off"}`}></span>
                {autoWateringActive ? "Aktif" : "Nonaktif"}
              </p>
              <p className="card-substatus">
                {!systemActive
                  ? "Menunggu Start System"
                  : dataStale
                  ? "Menunggu data sensor…"
                  : !autoWateringActive
                  ? "Mode manual · pompa tidak otomatis"
                  : tanahKering
                  ? "Sedang menyiram (tanah kering)"
                  : "Standby · tanah cukup lembap"}
              </p>
            </div>
          </div>
          <button
            onClick={toggleAutoWatering}
            disabled={mengirimWatering || !systemActive}
            title={!systemActive ? "Aktifkan Start System dulu" : undefined}
            className={`switch-toggle ${autoWateringActive ? "on" : "off"}`}
            role="switch"
            aria-checked={autoWateringActive}
          >
            <span className="switch-knob" />
            <span className="switch-label-on">ON</span>
            <span className="switch-label-off">OFF</span>
          </button>
        </div>

        {/* Kontrol Pompa Air Utama */}
        <div className={`control-card switch-card ${pumpStatus ? "is-active" : ""}`}>
          <div className="card-top">
            <span className="card-icon"><IconDroplet /></span>
            <div className="card-info">
              <h3>Water Pump</h3>
              <p className="card-status">
                <span className={`status-dot ${pumpStatus ? "on" : "off"}`}></span>
                {pumpStatus ? "Mengalir" : "Standby"}
                {tanahKering && !pumpStatus && !dataStale ? " · Tanah kering" : ""}
              </p>
            </div>
          </div>
          <button
            onClick={togglePump}
            disabled={!systemActive}
            title={!systemActive ? "Aktifkan Auto Watering dulu" : undefined}
            className={`switch-toggle ${pumpStatus ? "on" : "off"}`}
            role="switch"
            aria-checked={pumpStatus}
          >
            <span className="switch-knob" />
            <span className="switch-label-on">ON</span>
            <span className="switch-label-off">OFF</span>
          </button>
        </div>

        {/* Kontrol Mist / Pengabut (belum ada hardware, masih dummy) */}
        <div className={`control-card switch-card ${mistStatus ? "is-active" : ""}`}>
          <div className="card-top">
            <span className="card-icon"><IconMist /></span>
            <div className="card-info">
              <h3>Mist Generator</h3>
              <p className="card-status">
                <span className={`status-dot ${mistStatus ? "on" : "off"}`}></span>
                {mistStatus ? "Mengabut" : "Standby"}
              </p>
            </div>
          </div>
          <button
            onClick={toggleMist}
            className={`switch-toggle ${mistStatus ? "on" : "off"}`}
            role="switch"
            aria-checked={mistStatus}
          >
            <span className="switch-knob" />
            <span className="switch-label-on">ON</span>
            <span className="switch-label-off">OFF</span>
          </button>
        </div>

        {/* Level Cairan Nutrisi (belum ada hardware, masih dummy) */}
        <div className="control-card nutrient-card">
          <h3>Nutrient Reservoir</h3>
          <p className="setting-desc">Level larutan pada tangki A &amp; B.</p>
          <div className="tank-row">
            <div className="tank-group">
              <div className="tank">
                <div className="tank-fill" style={{ height: `${nutrients.solutionA}%` }}>
                  <span className="tank-fill-line" />
                </div>
                <span className="tank-ticks" />
              </div>
              <span className="tank-label">A · {nutrients.solutionA}%</span>
            </div>
            <div className="tank-group">
              <div className="tank">
                <div className="tank-fill" style={{ height: `${nutrients.solutionB}%` }}>
                  <span className="tank-fill-line" />
                </div>
                <span className="tank-ticks" />
              </div>
              <span className="tank-label">B · {nutrients.solutionB}%</span>
            </div>
          </div>
        </div>

        {/* Pengaturan Interval Penyemprotan (belum ada hardware, masih dummy) */}
        <div className="control-card">
          <h3>Spray Interval</h3>
          <p className="setting-desc">Jeda waktu otomatisasi pengabutan.</p>
          <div className="interval-segmented" role="group" aria-label="Spray interval">
            {intervalOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setSprayInterval(opt.value)}
                className={`segment ${sprayInterval === opt.value ? "selected" : ""}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}