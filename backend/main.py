from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import numpy as np
import cv2

try:
    import face_recognition
except ImportError:  # pragma: no cover - depends on environment
    face_recognition = None

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
OWNER_ENCODING_PATH = BASE_DIR / "owner_face_encoding.npy"
THRESHOLD = 0.45


def _decode_image(contents: bytes):
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if img is None:
        raise HTTPException(status_code=400, detail="Gambar tidak valid atau kosong.")
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def _get_face_encoding(image_rgb):
    if face_recognition is None:
        raise HTTPException(status_code=500, detail="Pustaka face-recognition belum terpasang.")

    face_locations = face_recognition.face_locations(image_rgb)
    face_encodings = face_recognition.face_encodings(image_rgb, face_locations)

    if not face_encodings:
        raise HTTPException(status_code=400, detail="Tidak ada wajah yang terdeteksi. Coba foto yang lebih jelas.")

    return face_encodings[0]


def _load_reference_encoding():
    if OWNER_ENCODING_PATH.exists():
        return np.load(OWNER_ENCODING_PATH)

    if OWNER_IMAGE_PATH.exists():
        image_rgb = _decode_image(OWNER_IMAGE_PATH.read_bytes())
        return _get_face_encoding(image_rgb)

    raise HTTPException(status_code=404, detail="Foto referensi belum tersedia. Silakan daftar wajah terlebih dahulu.")


def _save_reference_image(image_rgb):
    cv2.imwrite(str(OWNER_IMAGE_PATH), cv2.cvtColor(image_rgb, cv2.COLOR_RGB2BGR))
    encoding = _get_face_encoding(image_rgb)
    np.save(OWNER_ENCODING_PATH, encoding)


@app.post("/api/verify-face")
async def verify_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Gambar tidak boleh kosong.")

        probe_rgb = _decode_image(contents)
        reference_encoding = _load_reference_encoding()
        probe_encoding = _get_face_encoding(probe_rgb)

        distance = float(face_recognition.face_distance([reference_encoding], probe_encoding)[0])
        similarity = max(0.0, 1.0 - distance)
        allowed = similarity >= THRESHOLD

        return {
            "status": "success" if allowed else "failed",
            "message": "Verifikasi berhasil." if allowed else "Wajah tidak dikenali.",
            "confidence": round(similarity, 4),
            "threshold": THRESHOLD,
            "allowed": allowed,
        }
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan server: {str(exc)}") from exc


@app.post("/api/register-face")
async def register_face(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Gambar tidak boleh kosong.")

        image_rgb = _decode_image(contents)
        _save_reference_image(image_rgb)

        return {
            "status": "success",
            "message": "Foto referensi berhasil disimpan.",
            "path": str(OWNER_IMAGE_PATH),
        }
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - defensive fallback
        raise HTTPException(status_code=500, detail=f"Terjadi kesalahan server: {str(exc)}") from exc


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
