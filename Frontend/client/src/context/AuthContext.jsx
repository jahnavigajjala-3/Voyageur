import { createContext, useState, useEffect } from "react";
import axiosInstance from "../services/axiosInstance";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading]         = useState(true);

  // Rehydrate auth state from localStorage on mount
  useEffect(() => {
    const token      = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");

    if (token && storedUser && storedUser !== "undefined") {
      try {
        setAccessToken(token);
        setUser(JSON.parse(storedUser));
      } catch {
        console.error("Invalid user in localStorage — clearing.");
        localStorage.removeItem("user");
      }
    }

    setLoading(false);
  }, []);

  // ─── Shared helper ────────────────────────────────────────────────────────
  const saveAuthData = ({ access_token, refresh_token, user: userData }) => {
    localStorage.setItem("accessToken",  access_token);
    localStorage.setItem("refreshToken", refresh_token);
    localStorage.setItem("user",         JSON.stringify(userData));
    setAccessToken(access_token);
    setUser(userData);
  };

  // ─── Email / password auth ────────────────────────────────────────────────
  const login = async (email, password) => {
    const response = await axiosInstance.post("/login", { email, password });
    saveAuthData(response.data);
  };

  const signup = async (name, email, password) => {
    const response = await axiosInstance.post("/signup", { name, email, password });
    saveAuthData(response.data);
  };

  // ─── Google OAuth ─────────────────────────────────────────────────────────
  /**
   * Called after the Google OAuth popup succeeds.
   * Sends the Google access_token to our backend, which verifies it,
   * upserts the user, and returns our own JWT pair.
   *
   * @param {string} googleAccessToken  — the access_token from @react-oauth/google
   */
  const googleAuth = async (googleAccessToken) => {
    const response = await axiosInstance.post("/auth/google", {
      access_token: googleAccessToken,
    });
    saveAuthData(response.data);
  };

  // ─── Logout ───────────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        login,
        signup,
        googleAuth,
        logout,
        loading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
