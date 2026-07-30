import { useEffect, useState } from "react";
import { getSensorData } from "../config/api";
import "./css/homeDashboard.css";

const IconData = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
  </svg>
);

const IconRefresh = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M21.5 2v6h-6M2.5 22v-6h6" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M21.5 8A10 10 0 0 0 4.5 4.5L2.5 6.5M2.5 16a10 10 0 0 0 17 3.5l2-2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function Data() {
  const [connected, setConnected] = useState(false);
  const [sensorData, setSensorData] = useState({ moisture: null, detail: null, suhu: null });
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadSensorData = async () => {
      try {
        const data = await getSensorData();
        if (!cancelled) {
          setSensorData(data);
          setConnected(true);

          // auto log
          const timestamp = new Date().toLocaleTimeString("id-ID");
          setLogs((prev) => {
            const newLog = {
              id: Date.now(),
              time: timestamp,
              moisture: data.moisture ?? "--",
              suhu: data.suhu ? data.suhu.toFixed(1) : "--",
              status: data.sistemAktif ? "System Active" : "Standby",
            };
            // Keep last 15 logs
            return [newLog, ...prev.slice(0, 14)];
          });
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

  return (
    <div className="home-dashboard-container">
      <header className="dashboard-header">
        <div className="header-top-row">
          <span className="header-eyebrow">Kebun · Zona 01</span>
          <span className={`connection-badge ${connected ? "live" : "offline"}`}>
            <span className="status-dot"></span>
            {connected ? "Live Data" : "Offline"}
          </span>
        </div>
        <h2>Data Telemetri &amp; Log Kebun</h2>
        <p>Catatan kelembaban 3 titik sensor, suhu lingkungan, dan riwayat telemetri.</p>
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
        {/* Rincian Sensor Tanah */}
        <div className="control-card soil-card" style={{ gridColumn: "span 2" }}>
          <div className="card-top">
            <span className="card-icon"><IconData /></span>
            <div className="card-info">
              <h3>Status Sensor Kebun Real-time</h3>
              <p className="setting-desc">Tabel Pembacaan Sensor Kelembaban &amp; Suhu</p>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: "0.95rem" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left" }}>
                <th style={{ padding: "8px 12px" }}>Titik Sensor</th>
                <th style={{ padding: "8px 12px" }}>Nilai Raw ADC</th>
                <th style={{ padding: "8px 12px" }}>Persentase Kelembaban</th>
                <th style={{ padding: "8px 12px" }}>Kondisi Tanah</th>
              </tr>
            </thead>
            <tbody>
              {(detail?.persen ?? [null, null, null]).map((p, i) => {
                const rawVal = detail?.raw ? detail.raw[i] : "--";
                const isDry = p !== null && p < 70;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ padding: "10px 12px", fontWeight: "600" }}>Sensor #{i + 1}</td>
                    <td style={{ padding: "10px 12px" }}>{rawVal ?? "--"}</td>
                    <td style={{ padding: "10px 12px", color: isDry ? "#ff6b6b" : "#51cf66" }}>
                      {p !== null ? `${p}%` : "--"}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      {p === null ? "Tidak Ada Data" : isDry ? "Kering (Perlu Penyiraman)" : "Lembab (Optimal)"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Tabel Log Telemetri */}
        <div className="control-card readout-card" style={{ gridColumn: "span 2" }}>
          <div className="card-top" style={{ justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span className="card-icon"><IconRefresh /></span>
              <h3>Riwayat Log Telemetri</h3>
            </div>
            <button
              onClick={() => setLogs([])}
              style={{
                background: "rgba(255,255,255,0.1)",
                border: "none",
                color: "#ccc",
                padding: "4px 10px",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: "0.8rem",
              }}
            >
              Bersihkan Log
            </button>
          </div>

          <div style={{ maxHeight: 260, overflowY: "auto", marginTop: 12 }}>
            {logs.length === 0 ? (
              <p className="readout-caption">Belum ada catatan log telemetri.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.88rem" }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", textAlign: "left", color: "#aaa" }}>
                    <th style={{ padding: "6px 10px" }}>Waktu</th>
                    <th style={{ padding: "6px 10px" }}>Rata-rata Kelembaban</th>
                    <th style={{ padding: "6px 10px" }}>Suhu DHT22</th>
                    <th style={{ padding: "6px 10px" }}>Status Sistem</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "6px 10px", fontFamily: "monospace", color: "#888" }}>{log.time}</td>
                      <td style={{ padding: "6px 10px" }}>{log.moisture}%</td>
                      <td style={{ padding: "6px 10px" }}>{log.suhu}°C</td>
                      <td style={{ padding: "6px 10px" }}>{log.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}