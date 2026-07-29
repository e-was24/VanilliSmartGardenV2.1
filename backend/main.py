from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
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

BASE_DIR = Path(__file__).resolve().parent
OWNER_IMAGE_PATH = BASE_DIR / "owner_face.jpg"


@app.post("/api/verify-face")
async def verify_face(file: UploadFile = File(...)):
    if not OWNER_IMAGE_PATH.exists():
        raise HTTPException(
            status_code=500,
            detail="Foto referensi belum tersedia. Silakan upload foto referensi terlebih dahulu."
        )

    try:
        owner_img = cv2.imread(str(OWNER_IMAGE_PATH))
        if owner_img is None:
            raise HTTPException(status_code=500, detail="Gagal membaca file referensi wajah.")

        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Gambar tidak boleh kosong.")

        nparr = np.frombuffer(contents, np.uint8)
        webcam_img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if webcam_img is None:
            raise HTTPException(status_code=400, detail="Gambar yang dikirim tidak valid.")

        cv2.imwrite(str(BASE_DIR / "debug_webcam_capture.jpg"), webcam_img)

        gray_owner = cv2.cvtColor(owner_img, cv2.COLOR_BGR2GRAY)
        gray_webcam = cv2.cvtColor(webcam_img, cv2.COLOR_BGR2GRAY)

        gray_owner = cv2.resize(gray_owner, (200, 200))
        gray_webcam = cv2.resize(gray_webcam, (200, 200))

        hist_owner = cv2.calcHist([gray_owner], [0], None, [256], [0, 256])
        hist_webcam = cv2.calcHist([gray_webcam], [0], None, [256], [0, 256])

        cv2.normalize(hist_owner, hist_owner, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)
        cv2.normalize(hist_webcam, hist_webcam, alpha=0, beta=1, norm_type=cv2.NORM_MINMAX)

        similarity = float(cv2.compareHist(hist_owner, hist_webcam, cv2.HISTCMP_CORREL))
        THRESHOLD = 0.40

        if similarity >= THRESHOLD:
            return {
                "status": "success",
                "message": "Verifikasi berhasil.",
                "confidence": similarity,
                "threshold": THRESHOLD,
            }

        return {
            "status": "failed",
            "message": "Wajah tidak dikenali.",
            "confidence": similarity,
            "threshold": THRESHOLD,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan server: {str(e)}")


@app.post("/api/register-face")
async def register_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Gambar tidak boleh kosong.")

        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Gambar tidak valid atau kosong.")

        cv2.imwrite(str(OWNER_IMAGE_PATH), img)
        return {
            "status": "success",
            "message": "Foto referensi berhasil disimpan.",
            "path": str(OWNER_IMAGE_PATH),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan server: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
