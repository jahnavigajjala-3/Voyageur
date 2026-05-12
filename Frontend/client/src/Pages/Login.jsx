import { useState } from "react";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import { useRouteContext } from "../context/RouteContext";
import { useTheme } from "../context/ThemeContext";
import {
  GoogleButton, Divider, SubmitButton, AuthInput, PasswordInput,
} from "../components/AuthComponents";

export default function Login() {
  const { login, googleAuth, continueAsGuest } = useAuth();
  const { resetSession } = useRouteContext();
  const { isDarkMode } = useTheme();
  const navigate = useNavigate();
  const [form, setForm]           = useState({ email: "", password: "" });
  const [loading, setLoading]     = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError]         = useState("");
  const [exiting, setExiting]     = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      setExiting(true);
      setTimeout(() => navigate("/dashboard"), 400);
    } catch (err) {
      setError(err?.response?.data?.detail || "Invalid email or password.");
      setLoading(false);
    }
  };

  const handleGuestLogin = () => {
    resetSession();
    continueAsGuest();
    setExiting(true);
    setTimeout(() => navigate("/dashboard"), 400);
  };

  const handleGoogleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError("");
      setGoogleLoading(true);
      try {
        await googleAuth(tokenResponse.access_token);
        setExiting(true);
        setTimeout(() => navigate("/dashboard"), 400);
      } catch (err) {
        setError(err?.response?.data?.detail || "Google sign-in failed. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: () => setError("Google sign-in was cancelled or failed."),
  });

  const cardStyle = {
    background: isDarkMode ? "#0d1b2e" : "#ffffff",
    border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.08)" : "#e2e8f0"}`,
    borderRadius: "16px",
    boxShadow: isDarkMode
      ? "0 0 0 1px rgba(255,255,255,0.04), 0 24px 48px -24px rgba(0,0,0,0.6)"
      : "0 2px 8px rgba(15,23,42,0.06), 0 1px 2px rgba(15,23,42,0.03)",
    padding: "48px 40px",
  };

  return (
    <AuthLayout exiting={exiting}>
      <div style={{ width: "100%", maxWidth: "400px" }}>
        <div style={cardStyle}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: "linear-gradient(135deg, #06B6D4, #0F172A)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" style={{ width: "20px", height: "20px" }}>
                <path d="M12 3.5a6 6 0 0 0-6 6c0 4.6 6 11 6 11s6-6.4 6-11a6 6 0 0 0-6-6Z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
                <circle cx="12" cy="9.5" r="2.2" fill="white" />
                <path d="M4.5 20c2-1.4 4.5-2 7.5-2s5.5.6 7.5 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <span style={{ fontSize: "20px", fontWeight: "700", letterSpacing: "-0.02em", color: isDarkMode ? "#f1f5f9" : "#0F172A" }}>
              Voyageur
            </span>
          </div>

          <h1 style={{ fontSize: "24px", fontWeight: "700", color: isDarkMode ? "#f1f5f9" : "#0F172A", marginBottom: "6px", letterSpacing: "-0.02em" }}>
            Welcome back
          </h1>
          <p style={{ fontSize: "14px", color: isDarkMode ? "#94a3b8" : "#64748B", marginBottom: "32px", lineHeight: "1.5" }}>
            Sign in to your account to continue
          </p>

          <GoogleButton loading={googleLoading} onClick={() => handleGoogleLogin()} isDarkMode={isDarkMode} />
          <Divider isDarkMode={isDarkMode} />

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <AuthInput type="email" name="email" placeholder="Email address" value={form.email} onChange={handleChange} autoComplete="email" isDarkMode={isDarkMode} />
            <PasswordInput name="password" placeholder="Password" value={form.password} onChange={handleChange} autoComplete="current-password" show={showPassword} onToggle={() => setShowPassword(v => !v)} isDarkMode={isDarkMode} />
            {error && <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "-2px" }}>{error}</p>}
            <SubmitButton loading={loading} exiting={exiting} label="Sign In" loadingLabel="Signing in..." />
          </form>

          <button
            type="button" onClick={handleGuestLogin}
            style={{
              width: "100%", height: "44px", borderRadius: "10px", marginTop: "12px",
              background: "transparent",
              border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "#E2E8F0"}`,
              color: isDarkMode ? "#94a3b8" : "#64748B",
              fontSize: "14px", fontWeight: "500", cursor: "pointer", transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDarkMode ? "rgba(255,255,255,0.05)" : "#F8FAFC";
              e.currentTarget.style.color = isDarkMode ? "#e2e8f0" : "#0F172A";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = isDarkMode ? "#94a3b8" : "#64748B";
            }}
          >
            Continue as Guest
          </button>

          <p style={{ fontSize: "14px", color: isDarkMode ? "#94a3b8" : "#64748B", textAlign: "center", marginTop: "24px" }}>
            Don&apos;t have an account?{" "}
            <Link to="/signup" style={{ color: "#06B6D4", fontWeight: "600", textDecoration: "none" }}>Sign up</Link>
          </p>
        </div>
      </div>
    </AuthLayout>
  );
}
