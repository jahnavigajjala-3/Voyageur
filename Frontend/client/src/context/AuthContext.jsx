import { createContext, useState, useEffect } from "react";
import axiosInstance from "../services/axiosInstance";

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    const storedUser = localStorage.getItem("user");

    if (token && storedUser) {
      setAccessToken(token);
      setUser(JSON.parse(storedUser));
    }

    setLoading(false);
  }, []);

  const saveAuthData = ({ access_token, refresh_token, user }) => {
    localStorage.setItem("accessToken", access_token);
    localStorage.setItem("refreshToken", refresh_token);
    localStorage.setItem("user", JSON.stringify(user));
    setAccessToken(access_token);
    setUser(user);
  };

  const login = async (email, password) => {
    const response = await axiosInstance.post("/login", {
      email,
      password,
    });

    saveAuthData(response.data);
  };

  const signup = async (name, email, password) => {
    const response = await axiosInstance.post("/signup", {
      name,
      email,
      password,
    });

    saveAuthData(response.data);
  };

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
        logout,
        loading,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};