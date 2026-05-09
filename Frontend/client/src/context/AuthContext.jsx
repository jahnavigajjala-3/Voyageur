import { createContext, useState, useEffect } from "react";
import axiosInstance from "../services/axiosInstance";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser]               = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading]         = useState(true);
  const [isGuest, setIsGuest]         = useState(false);

  // Rehydrate auth state from localStorage on mount
  useEffect(() => {
    const token      = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");
    const guestMode  = localStorage.getItem("guestMode");

    if (guestMode === "true") {
      // Returning guest — restore guest session
      setIsGuest(true);
    } else if (token && storedUser && storedUser !== "undefined") {
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
    localStorage.removeItem("guestMode");
    setAccessToken(access_token);
    setUser(userData);
    setIsGuest(false);
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
  const googleAuth = async (googleAccessToken) => {
    const response = await axiosInstance.post("/auth/google", {
      access_token: googleAccessToken,
    });
    saveAuthData(response.data);
  };

  // ─── Guest mode ───────────────────────────────────────────────────────────
  const continueAsGuest = () => {
    localStorage.setItem("guestMode", "true");
    setIsGuest(true);
  };

  // ─── Logout ───────────────────────────────────────────────────────────────
  const logout = () => {
    localStorage.removeItem("accessToken");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("guestMode");
    setAccessToken(null);
    setUser(null);
    setIsGuest(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isGuest,
        login,
        signup,
        googleAuth,
        continueAsGuest,
        logout,
        loading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
