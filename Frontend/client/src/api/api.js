const BASE_URL = import.meta.env.VITE_API_URL || "https://voyageur-1i0h.onrender.com";
const API_V1 = `${BASE_URL}/api/v1`;

const defaultHeaders = {
  "Content-Type": "application/json",
};

const getAuthHeaders = () => {
  const token = localStorage.getItem("accessToken");
  return token
    ? { ...defaultHeaders, Authorization: `Bearer ${token}` }
    : defaultHeaders;
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
    headers: getAuthHeaders(),
    body: JSON.stringify({ history, message, trip_context }),
  });
  return handleResponse(res);
};

// Crime
export const getCrimeRiskByCoords = async (lat, lng) => {
  const res = await fetch(
    `${API_V1}/travel/crime-risk?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
    {
      headers: getAuthHeaders(),
    }
  );
  return handleResponse(res);
};

// Hospitals
export const getNearbyHospitals = async (lat, lng, radius = 10, limit = 5) => {
  const res = await fetch(
    `${API_V1}/travel/hospitals?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=${radius}&limit=${limit}`,
    {
      headers: getAuthHeaders(),
    }
  );
  return handleResponse(res);
};

// Trips
export const createTrip = async (tripData) => {
  const res = await fetch(`${API_V1}/trips`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(tripData),
  });
  return handleResponse(res);
};

export const getTrips = async () => {
  const res = await fetch(`${API_V1}/trips`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};

export const getTripById = async (id) => {
  const res = await fetch(`${API_V1}/trips/${id}`, {
    headers: getAuthHeaders(),
  });
  return handleResponse(res);
};