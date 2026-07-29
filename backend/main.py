from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
import cv2
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OWNER_IMAGE_PATH = "owner_face.jpg"


@app.post("/api/verify-face")
async def verify_face(file: UploadFile = File(...)):
    if not os.path.exists(OWNER_IMAGE_PATH):
        raise HTTPException(
            status_code=500,
            detail="Foto referensi 'owner_face.jpg' tidak ditemukan di folder backend."
        )

    try:
        # 1. Baca foto referensi pemilik
        owner_img = cv2.imread(OWNER_IMAGE_PATH)
        if owner_img is None:
            raise HTTPException(
                status_code=500, detail="Gagal membaca file 'owner_face.jpg'.")
        print(f"[DEBUG] owner_img shape = {owner_img.shape}")  # tambahin

        # 2. Baca file gambar yang dikirim dari React (webcam)
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        webcam_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if webcam_img is None:
            raise HTTPException(
                status_code=400, detail="Gambar dari webcam tidak valid atau kosong.")
        print(f"[DEBUG] webcam_img shape = {webcam_img.shape}")  # tambahin

        # simpan biar bisa dilihat manual
        cv2.imwrite("debug_webcam_capture.jpg", webcam_img)

        # 3. Ubah ke grayscale untuk perbandingan histogram
        gray_owner = cv2.cvtColor(owner_img, cv2.COLOR_BGR2GRAY)
        gray_webcam = cv2.cvtColor(webcam_img, cv2.COLOR_BGR2GRAY)

        # Resize agar ukuran seragam untuk perbandingan
        gray_owner = cv2.resize(gray_owner, (200, 200))
        gray_webcam = cv2.resize(gray_webcam, (200, 200))

        # 4. Hitung kemiripan menggunakan Correlation Histogram
        hist_owner = cv2.calcHist([gray_owner], [0], None, [256], [0, 256])
        hist_webcam = cv2.calcHist([gray_webcam], [0], None, [256], [0, 256])

        cv2.normalize(hist_owner, hist_owner, alpha=0,
                      beta=1, norm_type=cv2.NORM_MINMAX)
        cv2.normalize(hist_webcam, hist_webcam, alpha=0,
                      beta=1, norm_type=cv2.NORM_MINMAX)

        similarity = cv2.compareHist(
            hist_owner, hist_webcam, cv2.HISTCMP_CORREL)
        # muncul di terminal backend
        print(f"[DEBUG] similarity = {similarity}")

        # Tentukan ambang batas (threshold) kemiripan (misal: 0.6 atau 60%)
        THRESHOLD = 0.40

        if similarity >= THRESHOLD:
            return {
                "status": "success",
                "message": "Verifikasi berhasil! Selamat datang.",
                "confidence": float(similarity)
            }
        else:
            return {
                "status": "failed",
                "message": "Wajah tidak dikenali! Akses ditolak.",
                # ditambahin biar keliatan angkanya
                "confidence": float(similarity)
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Terjadi kesalahan server: {str(e)}")


@app.post("/api/register-face")
async def register_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(
                status_code=400, detail="Gambar tidak valid atau kosong.")

        cv2.imwrite(OWNER_IMAGE_PATH, img)
        print(f"[DEBUG] owner_face.jpg disimpan, shape = {img.shape}")

        return {"status": "success", "message": "Foto referensi berhasil disimpan."}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Terjadi kesalahan server: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
