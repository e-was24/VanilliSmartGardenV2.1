import "./css/navbar.css";
import { useState, useEffect, useRef, useCallback } from "react";
import { Link, useNavigate, useLocation } from "react-router";
import Webcam from "react-webcam";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "https://smart-garden-backend.vercel.app").replace(/\/$/, "");

const icon = [
  {
    link: "/",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="24px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="#e3e3e3"
      >
        <path d="M80-600v-160q0-33 23.5-56.5T160-840h640q33 0 56.5 23.5T880-760v160h-80v-160H160v160H80Zm80 360q-33 0-56.5-23.5T80-320v-200h80v200h640v-200h80v200q0 33-23.5 56.5T800-240H160ZM40-120v-80h880v80H40Zm440-420ZM80-520v-80h240q11 0 21 6t15 16l47 93 123-215q5-9 14-14.5t20-5.5q11 0 21 5.5t15 16.5l49 98h235v80H620q-11 0-21-5.5T584-542l-26-53-123 215q-5 10-15 15t-21 5q-11 0-20.5-6T364-382l-69-138H80Z" />
      </svg>
    ),
    title: "System Controls",
  },
  {
    link: "/plant",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="24px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="#e3e3e3"
      >
        <path d="M342-160h276l40-160H302l40 160Zm0 80q-28 0-49-17t-28-44l-45-179h520l-45 179q-7 27-28 44t-49 17H342ZM200-400h560v-80H200v80Zm280-240q0-100 70-170t170-70q0 90-57 156t-143 80v84h320v160q0 33-23.5 56.5T760-320H200q-33 0-56.5-23.5T120-400v-160h320v-84q-86-14-143-80t-57-156q100 0 170 70t70 170Z" />
      </svg>
    ),
    title: "Plant Controls",
  },
  {
    link: "/garden",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="24px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="#e3e3e3"
      >
        <path d="M160-160v-375l-72 55-47-63 439-337 440 336-48 64-392-300-240 184v356h160v80H160Zm540 95q-42 29-92.5 24.5T521-81q-36-36-40.5-86.5T505-260q-29-42-24.5-92.5T521-439q36-36 86.5-40.5T700-455q42-29 92.5-24.5T879-439q36 36 40.5 86.5T895-260q29 42 24.5 92.5T879-81q-36 36-86.5 40.5T700-65Zm0-98 46 32q18 13 39 11t37-18q16-16 18-37t-11-39l-32-46 32-46q13-18 11-39t-18-37q-16-16-37-18t-39 11l-46 32-46-32q-18-13-39-11t-37 18q-16 16-18 37t11 39l32 46-32 46q-13 18-11 39t18 37q16 16 37 18t39-11l46-32Zm35.5-61.5Q750-239 750-260t-14.5-35.5Q721-310 700-310t-35.5 14.5Q650-281 650-260t14.5 35.5Q679-210 700-210t35.5-14.5ZM480-470Zm220 210Z" />
      </svg>
    ),
    title: "Garden Controls",
  },
  {
    link: "/data",
    icon: (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        height="24px"
        viewBox="0 -960 960 960"
        width="24px"
        fill="#e3e3e3"
      >
        <path d="M631-219q9-9 9-21t-9-21q-9-9-21-9t-21 9q-9 9-9 21t9 21q9 9 21 9t21-9Zm110 0q9-9 9-21t-9-21q-9-9-21-9t-21 9q-9 9-9 21t9 21q9 9 21 9t21-9Zm110 0q9-9 9-21t-9-21q-9-9-21-9t-21 9q-9 9-9 21t9 21q9 9 21 9t21-9Zm-651 99q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h560q33 0 56.5 23.5T840-760v268q-19-9-39-15.5t-41-9.5v-243H200v560h242q3 22 9.5 42t15.5 38H200Zm0-120v40-560 243-3 280Zm80-40h163q3-21 9.5-41t14.5-39H280v80Zm0-160h244q32-30 71.5-50t84.5-27v-3H280v80Zm0-160h400v-80H280v80ZM720-40q-83 0-141.5-58.5T520-240q0-83 58.5-141.5T720-440q83 0 141.5 58.5T920-240q0 83-58.5 141.5T720-40Z" />
      </svg>
    ),
    title: "Data Controls",
  },
];

const IkonWaktu = ({ waktu }) => {
  const isPM = waktu.includes("PM");

  return isPM ? (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="16px"
      viewBox="0 -960 960 960"
      width="16px"
      fill="#cccccca6"
    >
      <path d="M600-640 480-760l120-120 120 120-120 120Zm200 120-80-80 80-80 80 80-80 80ZM483-80q-84 0-157.5-32t-128-86.5Q143-253 111-326.5T79-484q0-146 93-257.5T409-880q-18 99 11 193.5T520-521q71 71 165.5 100T879-410q-26 144-138 237T483-80Zm0-80q88 0 163-44t118-121q-86-8-163-43.5T463-465q-61-61-97-138t-43-163q-77 43-120.5 118.5T159-484q0 135 94.5 229.5T483-160Zm-20-305Z" />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height="16px"
      viewBox="0 -960 960 960"
      width="16px"
      fill="#f19e39ad"
    >
      <path d="M40-410v-80h160v80H40Zm214-210L140-733l57-56 113 113-56 56Zm-49.5 405.5Q190-229 190-250t14.5-35.5Q219-300 240-300t35.5 14.5Q290-271 290-250t-14.5 35.5Q261-200 240-200t-35.5-14.5ZM280-410v-40q0-83 58.5-141.5T480-650q83 0 141.5 58.5T680-450v40h-80v-40q0-50-35-85t-85-35q-50 0-85 35t-35 85v40h-80Zm44.5 355.5Q310-69 310-90t14.5-35.5Q339-140 360-140t35.5 14.5Q410-111 410-90t-14.5 35.5Q381-40 360-40t-35.5-14.5Zm120-160Q430-229 430-250t14.5-35.5Q459-300 480-300t35.5 14.5Q530-271 530-250t-14.5 35.5Q501-200 480-200t-35.5-14.5ZM440-730v-160h80v160h-80ZM564.5-54.5Q550-69 550-90t14.5-35.5Q579-140 600-140t35.5 14.5Q650-111 650-90t-14.5 35.5Q621-40 600-40t-35.5-14.5ZM706-620l-57-56 114-113 56 56-113 113Zm-21.5 405.5Q670-229 670-250t14.5-35.5Q699-300 720-300t35.5 14.5Q770-271 770-250t-14.5 35.5Q741-200 720-200t-35.5-14.5ZM760-410v-80h160v80H760Zm-280 0Z" />
    </svg>
  );
};

const WaktuSekarang = () => {
  const dapatkanWaktu = () =>
    new Date().toLocaleTimeString("en-US", { hour12: true });

  const [time, setTime] = useState(dapatkanWaktu());

  useEffect(() => {
    const t = setInterval(() => setTime(dapatkanWaktu()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
      {time}
      <IkonWaktu waktu={time} />
    </span>
  );
};

export default function Navbar({ isAuthenticated, setIsAuthenticated }) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const [isClick, setIsClick] = useState(0);
  const [activeIndex, setActiveIndex] = useState(1);

  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const webcamRef = useRef(null);

  const navigate = useNavigate();
  const openMenu = () => setIsOpen(!isOpen);

  const handleMenuClick = (e, index, item) => {
    if (item.title === "Plant Controls") {
      if (!isAuthenticated) {
        e.preventDefault();
        setShowVerifyModal(true);
        setMessage("");
      }
    } else if (item.link === "#") {
      e.preventDefault();
    }
  };

  const captureCroppedBlob = useCallback(async () => {
    const video = webcamRef.current?.video;
    if (!video || video.readyState !== 4) {
      throw new Error("Kamera belum siap!");
    }

    const fullCanvas = document.createElement("canvas");
    fullCanvas.width = video.videoWidth;
    fullCanvas.height = video.videoHeight;
    fullCanvas
      .getContext("2d")
      .drawImage(video, 0, 0, fullCanvas.width, fullCanvas.height);

    const CROP_RATIO = { widthPct: 0.4375, heightPct: 0.75 };
    const cropW = fullCanvas.width * CROP_RATIO.widthPct;
    const cropH = fullCanvas.height * CROP_RATIO.heightPct;
    const cropX = (fullCanvas.width - cropW) / 2;
    const cropY = (fullCanvas.height - cropH) / 2;

    const outCanvas = document.createElement("canvas");
    outCanvas.width = 300;
    outCanvas.height = 300;
    outCanvas
      .getContext("2d")
      .drawImage(fullCanvas, cropX, cropY, cropW, cropH, 0, 0, 300, 300);

    return new Promise((resolve) =>
      outCanvas.toBlob(resolve, "image/jpeg", 0.9),
    );
  }, [webcamRef]);

  const captureAndVerify = useCallback(async () => {
    setLoading(true);
    setMessage("Memverifikasi wajah...");
    try {
      const imageBlob = await captureCroppedBlob();
      const formData = new FormData();
      formData.append("file", imageBlob, "webcam_capture.jpg");

      const response = await fetch(`${BACKEND_URL}/api/verify-face`, {
        method: "POST",
        body: formData,
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        const text = await response.text();
        result = { message: text || `HTTP ${response.status}` };
      }

      if (response.ok && result.status === "success") {
        setMessage(result.message);
        setTimeout(() => {
          setIsAuthenticated(true);
          setShowVerifyModal(false);
          setLoading(false);
          navigate("/plant");
        }, 1000);
      } else {
        setMessage(result.message || "Wajah tidak dikenali! Akses ditolak.");
        setLoading(false);
      }
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Gagal terhubung ke server backend AI.");
      setLoading(false);
    }
  }, [captureCroppedBlob, setIsAuthenticated, navigate]);

  const captureAndRegister = useCallback(async () => {
    setLoading(true);
    setMessage("Menyimpan foto referensi...");
    try {
      const imageBlob = await captureCroppedBlob();
      const formData = new FormData();
      formData.append("file", imageBlob, "owner_register.jpg");

      const response = await fetch(`${BACKEND_URL}/api/register-face`, {
        method: "POST",
        body: formData,
      });

      let result = null;
      try {
        result = await response.json();
      } catch {
        const text = await response.text();
        result = { message: text || `HTTP ${response.status}` };
      }

      setMessage(result.message || "Selesai.");
    } catch (error) {
      console.error(error);
      setMessage(error.message || "Gagal menyimpan foto referensi.");
    } finally {
      setLoading(false);
    }
  }, [captureCroppedBlob]);

  return (
    <>
      <nav className={`navbar ${isOpen ? "active" : ""}`}>
        <p className={`apps-name ${isOpen ? "" : "active"}`}>
          Vanili Smart Garden [ navigation ] [ <WaktuSekarang /> ]
        </p>
        <p className={`apps-name-mobile ${isOpen ? "" : "active"}`}>
          [ navigation ]
        </p>

        <ul>
          {icon.map((item, index) => (
            <li
              key={index}
              onClick={(e) => handleMenuClick(e, index, item)}
              className={`menu-list ${location.pathname === item.link ? "active" : ""}`}
            >
              <Link to={item.link}>
                {item.icon} <span className="menu-name">{item.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <button
        onClick={openMenu}
        className={`menu-opener ${isOpen ? "active" : ""}`}
      >
        {isOpen ? (
          <span
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="#e3e3e3"
            >
              <path d="M480-528 296-344l-56-56 240-240 240 240-56 56-184-184Z" />
            </svg>
          </span>
        ) : (
          <span
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              height="24px"
              viewBox="0 -960 960 960"
              width="24px"
              fill="#e3e3e3"
            >
              <path d="M480-344 240-584l56-56 184 184 184-184 56 56-240 240Z" />
            </svg>
          </span>
        )}
      </button>

      {showVerifyModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>Verifikasi Wajah Pemilik</h3>
            <p>
              Posisikan wajah Anda di depan kamera untuk membuka{" "}
              <b>Plant Controls</b>.
            </p>

            <div className="webcam-container">
              <Webcam
                audio={false}
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                mirrored={true}
                width={320}
                height={240}
                videoConstraints={{
                  width: 320,
                  height: 240,
                  facingMode: "user",
                }}
              />
              <div className="face-guide-overlay">
                <div className="face-guide-oval"></div>
              </div>
            </div>

            {message && <p className="status-message">{message}</p>}

            <div className="modal-actions">
              <div className="modal-actions">
                <button
                  onClick={captureAndVerify}
                  disabled={loading}
                  className="btn-verify"
                >
                  {loading ? "Proses..." : "Verifikasi Sekarang"}
                </button>
                <button
                  onClick={captureAndRegister}
                  disabled={loading}
                  className="btn-verify"
                >
                  Daftarkan Wajah Saya
                </button>
                <button
                  onClick={() => setShowVerifyModal(false)}
                  disabled={loading}
                  className="btn-cancel"
                >
                  Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
