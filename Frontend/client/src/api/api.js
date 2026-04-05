const BASE_URL = import.meta.env.VITE_API_URL || "https://voyageur-1i0h.onrender.com";

// ── Auth ────────────────────────────────────────────────────────────────────

export const loginUser = async (form) => {
  const res = await fetch(`${BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error("Login failed");
  return res.json();
};

export const signupUser = async (form) => {
  const res = await fetch(`${BASE_URL}/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
  if (!res.ok) throw new Error("Signup failed");
  return res.json();
};

// ── Chat ────────────────────────────────────────────────────────────────────

export const sendChatMessage = async ({ history, message, trip_context }) => {
  const res = await fetch(`${BASE_URL}/api/v1/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ history, message, trip_context }),
  });
  if (!res.ok) throw new Error("Chat request failed");
  return res.json();
};

// ── Crime Risk ───────────────────────────────────────────────────────────────

export const getCrimeRiskByCoords = async (lat, lng) => {
  const res = await fetch(
    `${BASE_URL}/api/v1/travel/crime-risk?lat=${lat}&lng=${lng}`
  );
  if (!res.ok) throw new Error("Crime risk fetch failed");
  return res.json();
};

export const getAllDistrictRisks = async () => {
  const res = await fetch(`${BASE_URL}/api/v1/travel/districts`);
  if (!res.ok) throw new Error("District risks fetch failed");
  return res.json();
};

// ── Trips ───────────────────────────────────────────────────────────────────

export const createTrip = async (tripData) => {
  const res = await fetch(`${BASE_URL}/api/v1/trips`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(tripData),
  });
  if (!res.ok) throw new Error("Failed to create trip");
  return res.json();
};

export const getTrips = async () => {
  const res = await fetch(`${BASE_URL}/api/v1/trips`);
  if (!res.ok) throw new Error("Failed to fetch trips");
  return res.json();
};