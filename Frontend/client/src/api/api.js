const BASE_URL = import.meta.env.VITE_API_URL || "https://voyageur-1i0h.onrender.com";
const API_V1 = `${BASE_URL}/api/v1`;

const defaultHeaders = {
  "Content-Type": "application/json",
};

const handleResponse = async (res) => {
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Request failed");
  return data;
};

// Auth
export const loginUser = async (form) => {
  const res = await fetch(`${API_V1}/login`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify(form),
  });
  return handleResponse(res);
};

export const signupUser = async (form) => {
  const res = await fetch(`${API_V1}/signup`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify(form),
  });
  return handleResponse(res);
};

// Chat
export const sendChatMessage = async ({ history, message, trip_context }) => {
  const res = await fetch(`${API_V1}/ai/chat`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify({ history, message, trip_context }),
  });
  return handleResponse(res);
};

// Crime
export const getCrimeRiskByCoords = async (lat, lng) => {
  const res = await fetch(
    `${API_V1}/travel/crime-risk?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
  );
  return handleResponse(res);
};

// Hospitals
export const getNearbyHospitals = async (lat, lng, radius = 10, limit = 5) => {
  const res = await fetch(
    `${API_V1}/travel/hospitals?lat=${lat}&lng=${lng}&radius=${radius}&limit=${limit}`
  );
  return handleResponse(res);
};

// Trips
export const createTrip = async (tripData) => {
  const res = await fetch(`${API_V1}/trips`, {
    method: "POST",
    headers: defaultHeaders,
    body: JSON.stringify(tripData),
  });
  return handleResponse(res);
};

export const getTrips = async () => {
  const res = await fetch(`${API_V1}/trips`);
  return handleResponse(res);
};

export const getTripById = async (id) => {
  const res = await fetch(`${API_V1}/trips/${id}`);
  return handleResponse(res);
};