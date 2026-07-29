import { useEffect, useState } from "react";
import "./css/homeDashboard.css";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "http://localhost:3001").replace(/\/$/, "");

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
  const [selectedFile, setSelectedFile] = useState(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSensorData = async () => {
      try {
        const response = await fetch(`${BACKEND_URL}/api/sensor`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        if (!cancelled) {
          setSensorData(data);
          setConnected(true);
        }
      } catch (error) {
        if (!cancelled) {
          setConnected(false);
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

  const detail = sensorData.detail; // { raw:[], persen:[], rata_rata }
  const rataRata = sensorData.moisture;
  const suhu = sensorData.suhu;
  const suhuTampil = suhu === null || suhu === undefined ? "--" : suhu.toFixed(1);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file) {
      setStatusMessage(`File siap: ${file.name}`);
    }
  };

  const submitFaceRequest = async (mode) => {
    if (!selectedFile) {
      setStatusMessage("Pilih file gambar terlebih dahulu.");
      return;
    }

    setIsSubmitting(true);
    setStatusMessage("Mengirim gambar...");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch(`${BACKEND_URL}/api/${mode === "register" ? "register-face" : "verify-face"}`, {
        method: "POST",
        body: formData,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.detail || data.message || "Gagal memproses wajah");
      }

      if (mode === "register") {
        setIsRegistered(true);
      }

      setStatusMessage(data.message || (mode === "register" ? "Foto referensi berhasil disimpan." : "Verifikasi selesai."));
    } catch (error) {
      setStatusMessage(error.message || "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

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
        <div className="control-card soil-card">
          <h3>Face Verification</h3>
          <p className="setting-desc">Upload foto untuk register wajah atau verifikasi wajah.</p>

          <input
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            style={{ marginBottom: 12, width: "100%" }}
          />

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            <button
              type="button"
              onClick={() => submitFaceRequest("register")}
              disabled={isSubmitting}
              style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
            >
              {isSubmitting ? "Memproses..." : "Register Face"}
            </button>
            <button
              type="button"
              onClick={() => submitFaceRequest("verify")}
              disabled={isSubmitting || !isRegistered}
              style={{ padding: "8px 12px", borderRadius: 8, cursor: "pointer" }}
            >
              Verify Face
            </button>
          </div>

          {statusMessage && (
            <p className="setting-desc" style={{ marginTop: 8 }}>{statusMessage}</p>
          )}
        </div>

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