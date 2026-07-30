export const BACKEND_URL = (
  import.meta.env.VITE_BACKEND_URL || "http://localhost:3001"
).replace(/\/$/, "");

/**
 * Utility to fetch sensor data
 */
export async function getSensorData() {
  const response = await fetch(`${BACKEND_URL}/api/sensor`);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * Utility to set master system state (START / STOP)
 */
export async function setSystemState(aksi) {
  const response = await fetch(`${BACKEND_URL}/api/sistem`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aksi }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * Utility to set auto watering state (ON / OFF)
 */
export async function setWateringState(aksi) {
  const response = await fetch(`${BACKEND_URL}/api/watering`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aksi }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * Utility to toggle water pump state (ON / OFF)
 */
export async function setPumpState(aksi) {
  const response = await fetch(`${BACKEND_URL}/api/pompa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ aksi }),
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return await response.json();
}

/**
 * Verify face image blob with backend
 */
export async function verifyFaceApi(imageBlob) {
  const formData = new FormData();
  formData.append("file", imageBlob, "webcam_capture.jpg");

  let response;
  try {
    response = await fetch(`${BACKEND_URL}/api/verify-face`, {
      method: "POST",
      body: formData,
    });
  } catch {
    // Fallback directly to python port 8000 if BACKEND_URL fails
    response = await fetch("http://127.0.0.1:8000/api/verify-face", {
      method: "POST",
      body: formData,
    });
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.detail || "Gagal verifikasi wajah.");
  }
  return data;
}

/**
 * Register face reference image blob with backend
 */
export async function registerFaceApi(imageBlob) {
  const formData = new FormData();
  formData.append("file", imageBlob, "owner_register.jpg");

  let response;
  try {
    response = await fetch(`${BACKEND_URL}/api/register-face`, {
      method: "POST",
      body: formData,
    });
  } catch {
    // Fallback directly to python port 8000 if BACKEND_URL fails
    response = await fetch("http://127.0.0.1:8000/api/register-face", {
      method: "POST",
      body: formData,
    });
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.detail || "Gagal mendaftarkan wajah.");
  }
  return data;
}
