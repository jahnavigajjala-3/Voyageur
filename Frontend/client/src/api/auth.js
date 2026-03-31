const BASE_URL = "http://127.0.0.1:8000"; // your FastAPI backend

export const loginUser = async (form) => {
  const res = await fetch(`${BASE_URL}/login`, {
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
  const res = await fetch(`${BASE_URL}/signup`, {
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