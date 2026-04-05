// 🔗 API CONFIGURATION
const BASE_URL = import.meta.env.VITE_API_URL || "https://voyageur-1i0h.onrender.com";
const API_V1 = `${BASE_URL}/api/v1`;

// ── Auth ──
export const loginUser = async (form) => {
  const res = await fetch(`${API_V1}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error("Login failed - Check credentials or Server Status");
  return res.json();
};

export const signupUser = async (form) => {
  const res = await fetch(`${API_V1}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error("Signup failed");
  return res.json();
};

// ── Chat ──
export const sendChatMessage = async ({ history, message, trip_context }) => {
  const res = await fetch(`${API_V1}/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, message, trip_context }),
  });
  if (!res.ok) throw new Error("AI Chat currently unavailable");
  return res.json();
};

// ── Crime Risk ──
export const getCrimeRiskByCoords = async (lat, lng) => {
  const res = await fetch(`${API_V1}/travel/crime-risk?lat=${lat}&lng=${lng}`);
  if (!res.ok) throw new Error("Could not fetch local safety data");
  return res.json();
};

// ── Trips ──
export const createTrip = async (tripData) => {
  const res = await fetch(`${API_V1}/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tripData),
  });
  if (!res.ok) throw new Error("Failed to save trip to database");
  return res.json();
};