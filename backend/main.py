from fastapi import FastAPI, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import numpy as np
import cv2

app = FastAPI(title="Vanili Smart Garden - Face Recognition AI Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent
OWNER_IMAGE_PATH = BASE_DIR / "owner_face.jpg"


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "face-verification-ai"}


@app.post("/api/verify-face")
async def verify_face(file: UploadFile = File(...)):
    if not OWNER_IMAGE_PATH.exists():
        return {
            "status": "failed",
            "allowed": False,
            "message": "Foto referensi pemilik belum disimpan. Silakan tekan Simpan Muka terlebih dahulu."
        }

    try:
        owner_img = cv2.imread(str(OWNER_IMAGE_PATH))
        if owner_img is None:
            return {
                "status": "failed",
                "allowed": False,
                "message": "File foto referensi pemilik tidak dapat dibaca."
            }

        contents = await file.read()
        if not contents:
            return {
                "status": "failed",
                "allowed": False,
                "message": "Gambar tidak boleh kosong."
            }

        nparr = np.frombuffer(contents, np.uint8)
        webcam_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if webcam_img is None:
            return {
                "status": "failed",
                "allowed": False,
                "message": "Gambar tangkapan webcam tidak valid."
            }

        # Simpan sampel gambar pemindaian untuk debugging
        cv2.imwrite(str(BASE_DIR / "debug_webcam_capture.jpg"), webcam_img)

        # 1. Konversi ke grayscale
        gray_owner = cv2.cvtColor(owner_img, cv2.COLOR_BGR2GRAY)
        gray_webcam = cv2.cvtColor(webcam_img, cv2.COLOR_BGR2GRAY)

        # 2. Extract ORB feature keypoints
        orb = cv2.ORB_create(nfeatures=500)
        kp1, des1 = orb.detectAndCompute(gray_owner, None)
        kp2, des2 = orb.detectAndCompute(gray_webcam, None)

        if des1 is None or len(kp1) < 10:
            return {
                "status": "failed",
                "allowed": False,
                "message": "Foto referensi belum jelas. Mohon tekan Simpan Muka kembali."
            }

        if des2 is None or len(kp2) < 10:
            return {
                "status": "failed",
                "allowed": False,
                "message": "Wajah tidak terdeteksi di kamera."
            }

        # 3. Match feature descriptors dengan BFMatcher
        bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
        matches = bf.match(des1, des2)

        # Ambil match yang cukup baik (distance < 60 = cukup toleran terhadap
        # perubahan pencahayaan & sudut kamera)
        good_matches = [m for m in matches if m.distance < 60]
        match_count = len(good_matches)

        max_possible = min(len(kp1), len(kp2))
        confidence = round(match_count / max_possible, 4) if max_possible > 0 else 0

        # Kriteria verifikasi — cukup toleran untuk variasi pencahayaan & sudut:
        # minimal 6 fitur cocok DAN confidence >= 0.08
        MIN_MATCH_COUNT = 6
        MIN_CONFIDENCE = 0.08

        is_matched = match_count >= MIN_MATCH_COUNT and confidence >= MIN_CONFIDENCE

        if is_matched:
            return {
                "status": "success",
                "allowed": True,
                "message": "Verifikasi berhasil.",
                "confidence": confidence,
                "matches": match_count,
            }

        return {
            "status": "failed",
            "allowed": False,
            "message": "Wajah tidak cocok dengan pemilik! Akses ditolak.",
            "confidence": confidence,
            "matches": match_count,
        }

    except Exception as e:
        return {
            "status": "error",
            "allowed": False,
            "message": f"Terjadi kesalahan AI: {str(e)}"
        }


@app.post("/api/register-face")
async def register_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        if not contents:
            return {
                "status": "failed",
                "allowed": False,
                "message": "Gambar tidak boleh kosong."
            }

        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            return {
                "status": "failed",
                "allowed": False,
                "message": "Gambar tidak valid atau kosong."
            }

        cv2.imwrite(str(OWNER_IMAGE_PATH), img)
        return {
            "status": "success",
            "allowed": True,
            "message": "Wajah pemilik berhasil disimpan sebagai referensi.",
            "path": str(OWNER_IMAGE_PATH),
        }
    except Exception as e:
        return {
            "status": "error",
            "allowed": False,
            "message": f"Terjadi kesalahan server: {str(e)}"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
