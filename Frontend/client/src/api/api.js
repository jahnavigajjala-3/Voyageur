import axiosInstance from "../services/axiosInstance";

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
export const sendChatMessage = async ({
  history,
  message,
  trip_context = "",
  trip_id = null,
  current_lat = null,
  current_lng = null,
  planned_route = null,
}) => {
  const res = await fetch(`${API_V1}/ai/chat`, {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify({
      history,
      message,
      trip_context,
      trip_id,
      current_lat,
      current_lng,
      planned_route,
    }),
  });
  return handleResponse(res);
};

// Crime — public endpoints, no auth header needed
export const getCrimeRiskByCoords = async (lat, lng) => {
  const res = await fetch(
    `${API_V1}/travel/crime-risk?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
  );
  return handleResponse(res);
};

export const getDistrictsInState = async (lat, lng) => {
  const res = await fetch(
    `${API_V1}/travel/districts-in-state?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
  );
  return handleResponse(res);
};

// Hospitals — public endpoint, no auth header needed
export const getNearbyHospitals = async (lat, lng, radius = 30, limit = 5) => {
  const res = await fetch(
    `${API_V1}/travel/hospitals?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&radius=${radius}&limit=${limit}`
  );
  return handleResponse(res);
};

// Trips — FIX: was using axiosInstance (pointing to localhost in production), now uses fetch with correct API_V1
export const createTrip = async (tripData) => {
  const response = await axiosInstance.post("/trips", tripData);
  return response.data;
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

// Weather — FIX: was using hardcoded localhost, now uses API_V1
export const getWeather = async (lat, lng) => {
  const res = await fetch(
    `${API_V1}/weather?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`
  );
  return handleResponse(res);
};

// Safe Routes — public endpoint, no auth required
export const getSafeRoutes = async (origin, destination, alternatives = 3, preference = "safety", signal = null) => {
  const res = await fetch(`${API_V1}/travel/routes/safe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin:      { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      alternatives,
      preference,
    }),
    signal: signal?.signal ?? signal ?? undefined,
  });
  return handleResponse(res);
};

// Create a debounced version for rapid user input
export const getSafeRoutesDebounced = (() => {
  let currentController = null;
  let timeoutId = null;

  return (origin, destination, alternatives = 3, preference = "safety", debounceMs = 300) => {
    // Cancel previous in-flight request
    if (currentController) {
      currentController.abort();
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    currentController = new AbortController();
    const controller = currentController;

    return new Promise((resolve, reject) => {
      timeoutId = setTimeout(async () => {
        try {
          const result = await getSafeRoutes(origin, destination, alternatives, preference, controller);
          resolve(result);
        } catch (error) {
          if (error.name === "CanceledError" || error.name === "AbortError" || error.message === "Request was cancelled") {
            // Silently ignore cancellations
            return;
          }
          reject(error);
        } finally {
          timeoutId = null;
        }
      }, debounceMs);
    });
  };
})();