import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./css/homeDashboard.css";

// Ganti sesuai alamat backend kamu
const BACKEND_URL = "http://localhost:3001";

const AMBANG_SIRAM = 70; // samakan dengan AMBANG_SIRAM di kode ESP32

const IconThermometer = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 14.5V4.5a2 2 0 1 0-4 0v10a4 4 0 1 0 4 0Z" />
    <path d="M12 10h1.5" strokeLinecap="round" />
  </svg>
);

export default function Home() {
  const [connected, setConnected] = useState(false);
  const [sensorData, setSensorData] = useState({ moisture: null, detail: null, suhu: null });

  useEffect(() => {
    const socket = io(BACKEND_URL);

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("sensor-update", (data) => setSensorData(data));

    return () => socket.disconnect();
  }, []);

  const detail = sensorData.detail; // { raw:[], persen:[], rata_rata }
  const rataRata = sensorData.moisture;
  const suhu = sensorData.suhu;
  const suhuTampil = suhu === null || suhu === undefined ? "--" : suhu.toFixed(1);

  return (
    <div className="home-dashboard-container">
      <header className="dashboard-header">
        <div className="header-top-row">
          <span className="header-eyebrow">Kebun · Zona 01</span>
          <span className={`connection-badge ${connected ? "live" : "offline"}`}>
            <span className="status-dot"></span>
            {connected ? "Live" : "Offline"}
          </span>
        </div>
        <h2>Home</h2>
        <p>Kondisi tanah dan suhu, dipantau langsung dari kebun.</p>
        <svg className="vine-divider" viewBox="0 0 600 24" preserveAspectRatio="none">
          <path
            d="M0 12 C 60 2, 90 22, 150 12 S 240 2, 300 12 S 390 22, 450 12 S 540 2, 600 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </header>

      <div className="dashboard-grid">
        {/* Kelembaban 3 sensor tanah */}
        <div className="control-card soil-card">
          <h3>Soil Moisture</h3>
          <p className="setting-desc">Kelembaban tanah dari 3 titik sensor.</p>
          <div className="soil-average">
            {rataRata ?? "--"}
            <span className="unit">% rata-rata</span>
          </div>
          <div className="tank-row">
            {(detail?.persen ?? [null, null, null]).map((p, i) => (
              <div className="tank-group" key={i}>
                <div className="tank">
                  <div className="tank-fill" style={{ height: `${p ?? 0}%` }}>
                    <span className="tank-fill-line" />
                  </div>
                  <span className="tank-ticks" />
                </div>
                <span className="tank-label">S{i + 1} · {p ?? "--"}%</span>
              </div>
            ))}
          </div>
          <p className="threshold-note">
            Siram otomatis di bawah <strong>{AMBANG_SIRAM}%</strong>
          </p>
        </div>

        {/* Suhu */}
        <div className={`control-card readout-card ${suhu === null ? "" : suhu > 32 ? "is-warning" : ""}`}>
          <div className="card-top">
            <span className="card-icon"><IconThermometer /></span>
            <div className="card-info">
              <h3>Temperature</h3>
            </div>
          </div>
          <div>
            <div className="readout-value">
              {suhuTampil}
              <span className="unit">°C</span>
            </div>
            <p className="readout-caption">Sensor DHT22 (AM2302)</p>
          </div>
        </div>
      </div>
    </div>
  );
}