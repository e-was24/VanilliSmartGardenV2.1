import { useEffect, useState, useCallback } from "react";
import { getSensorData, setWateringState, setPumpState } from "../config/api";
import "./css/gardenControl.css";

const AMBANG_SIRAM_DEFAULT = 70; // fallback sebelum data dari backend datang

const IconDroplet = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 3s6.5 7.1 6.5 11.5A6.5 6.5 0 0 1 5.5 14.5C5.5 10.1 12 3 12 3Z" />
  </svg>
);

const IconAuto = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" strokeLinecap="round" />
    <circle cx="12" cy="12" r="4" />
  </svg>
);

const IconGauge = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 15a8 8 0 1 1 16 0" strokeLinecap="round" />
    <path d="M12 15l4-5" strokeLinecap="round" />
    <circle cx="12" cy="15" r="1" fill="currentColor" stroke="none" />
  </svg>
);

export default function Garden() {
  const [connected, setConnected] = useState(false);

  const [mode, setMode] = useState("auto"); // "auto" | "manual"
  const [pumpOn, setPumpOn] = useState(false);
  const [threshold, setThreshold] = useState(AMBANG_SIRAM_DEFAULT);
  const [thresholdDraft, setThresholdDraft] = useState(AMBANG_SIRAM_DEFAULT);
  const [moisture, setMoisture] = useState(null);
  const [lastAction, setLastAction] = useState(null); // { text, time }
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadSensorData = async () => {
      try {
        const data = await getSensorData();
        if (!cancelled) {
          setConnected(true);
          if (data?.moisture !== undefined) setMoisture(data.moisture);
          if (data?.autoWateringAktif !== undefined && data?.autoWateringAktif !== null) {
            setMode(data.autoWateringAktif ? "auto" : "manual");
          }
          if (data?.pompaAktif !== undefined && data?.pompaAktif !== null) {
            setPumpOn(data.pompaAktif);
          }
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

  const handleModeChange = async (nextMode) => {
    setMode(nextMode);
    setSending(true);
    setLastAction({
      text: `Mode diubah ke ${nextMode === "auto" ? "Otomatis" : "Manual"}`,
      time: new Date(),
    });

    try {
      await setWateringState(nextMode === "auto" ? "ON" : "OFF");
    } catch (err) {
      console.error("Gagal mengubah mode penyiraman:", err);
    } finally {
      setSending(false);
    }
  };

  const handlePumpToggle = async () => {
    const next = !pumpOn;
    setPumpOn(next);
    setSending(true);
    setLastAction({
      text: next ? "Pompa dinyalakan" : "Pompa dimatikan",
      time: new Date(),
    });

    try {
      await setPumpState(next ? "ON" : "OFF");
    } catch (err) {
      console.error("Gagal mengubah status pompa:", err);
    } finally {
      setSending(false);
    }
  };

  const handleThresholdCommit = () => {
    setThreshold(thresholdDraft);
    setLastAction({
      text: `Ambang siram diatur ke ${thresholdDraft}%`,
      time: new Date(),
    });
  };

  const timeAgo = (date) => {
    if (!date) return null;
    const diff = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
    if (diff < 5) return "baru saja";
    if (diff < 60) return `${diff} dtk lalu`;
    return `${Math.floor(diff / 60)} mnt lalu`;
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
        <h2>Kontrol Garden</h2>
        <p>Atur mode penyiraman, pompa, dan ambang kelembaban tanah.</p>
        <svg className="vine-divider" viewBox="0 0 600 24" preserveAspectRatio="none">
          <path
            d="M0 12 C 60 2, 90 22, 150 12 S 240 2, 300 12 S 390 22, 450 12 S 540 2, 600 12"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
      </header>

      <div className="dashboard-grid garden-control-grid">
        {/* Mode otomatis / manual */}
        <div className="control-card mode-card">
          <div className="card-top">
            <span className="card-icon"><IconAuto /></span>
            <div className="card-info">
              <h3>Mode Penyiraman</h3>
              <p className="setting-desc">Otomatis menyiram saat kelembaban di bawah ambang.</p>
            </div>
          </div>
          <div className="mode-switch" role="group" aria-label="Pilih mode penyiraman">
            <button
              type="button"
              className={`mode-option ${mode === "auto" ? "active" : ""}`}
              onClick={() => handleModeChange("auto")}
              disabled={!connected || sending}
            >
              Otomatis
            </button>
            <button
              type="button"
              className={`mode-option ${mode === "manual" ? "active" : ""}`}
              onClick={() => handleModeChange("manual")}
              disabled={!connected || sending}
            >
              Manual
            </button>
          </div>
        </div>

        {/* Kontrol pompa manual */}
        <div className={`control-card pump-card ${pumpOn ? "is-active" : ""}`}>
          <div className="card-top">
            <span className="card-icon"><IconDroplet /></span>
            <div className="card-info">
              <h3>Pompa Air</h3>
              <p className="setting-desc">
                {mode === "auto"
                  ? "Nonaktifkan mode otomatis untuk menyiram manual."
                  : "Nyalakan pompa untuk menyiram sekarang."}
              </p>
            </div>
          </div>
          <div className="pump-status-row">
            <span className={`pump-status-dot ${pumpOn ? "on" : "off"}`}></span>
            <span className="pump-status-text">{pumpOn ? "Aktif · menyiram" : "Mati"}</span>
          </div>
          <button
            type="button"
            className="pump-toggle-btn"
            onClick={handlePumpToggle}
            disabled={!connected || mode === "auto" || sending}
          >
            {pumpOn ? "Matikan Pompa" : "Siram Sekarang"}
          </button>
        </div>

        {/* Ambang batas siram */}
        <div className="control-card threshold-card">
          <div className="card-top">
            <span className="card-icon"><IconGauge /></span>
            <div className="card-info">
              <h3>Ambang Kelembaban</h3>
              <p className="setting-desc">Siram otomatis saat kelembaban tanah turun di bawah nilai ini.</p>
            </div>
          </div>

          <div className="threshold-value-row">
            <span className="threshold-value">{thresholdDraft}<span className="unit">%</span></span>
            {moisture !== null && (
              <span className="threshold-current">Saat ini: {moisture}%</span>
            )}
          </div>

          <input
            type="range"
            min="0"
            max="100"
            step="1"
            value={thresholdDraft}
            onChange={(e) => setThresholdDraft(Number(e.target.value))}
            className="threshold-slider"
            style={{ "--fill": `${thresholdDraft}%` }}
            disabled={!connected}
          />

          <button
            type="button"
            className="threshold-save-btn"
            onClick={handleThresholdCommit}
            disabled={!connected || thresholdDraft === threshold || sending}
          >
            Simpan Ambang ({threshold}% → {thresholdDraft}%)
          </button>
        </div>
      </div>

      {lastAction && (
        <p className="last-action-note">
          {lastAction.text} · {timeAgo(lastAction.time)}
        </p>
      )}
    </div>
  );
}