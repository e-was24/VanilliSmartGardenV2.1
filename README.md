# Vanili Smart Garden

## Deploy ke Vercel

### Frontend
- Project: frontend folder
- Build command: npm run build
- Output directory: dist
- Environment variable: VITE_BACKEND_URL=https://your-backend-url.vercel.app

### Backend
- Project: backend folder
- Start command: npm start
- Environment variable: PORT=3001

### Catatan
- Frontend memakai REST API untuk membaca data sensor dari backend melalui endpoint /api/sensor dan /api/health.
- Jika backend dipindah ke Vercel, setel VITE_BACKEND_URL ke URL backend Anda.

