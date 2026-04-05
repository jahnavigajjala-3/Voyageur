const BASE_URL = import.meta.env.VITE_API_URL || "https://voyageur-1i0h.onrender.com"; // local dev fallback
const API_PREFIX = "/api/v1";

export const loginUser = async (form) => {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(form),
  });

  if (!res.ok) {
    throw new Error("Login failed");
  }

  return res.json();
};

export const signupUser = async (form) => {
  const res = await fetch(`${BASE_URL}${API_PREFIX}/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(form),
  });

  if (!res.ok) {
    throw new Error("Signup failed");
  }

  return res.json();
};