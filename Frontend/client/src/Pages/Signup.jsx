import { useState } from "react";
import { motion } from "framer-motion";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";

export default function Signup() {
  const { signup, googleAuth } = useAuth();
  const navigate = useNavigate();
  const [form, setForm]           = useState({ name: "", email: "", password: "" });
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
      await signup(form.name, form.email, form.password);
      setExiting(true);
      setTimeout(() => navigate("/dashboard"), 550);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.detail || "Signup failed. Please try again.");
      setLoading(false);
    }
  };

  const handleGoogleSignup = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setError("");
      setGoogleLoading(true);
      try {
        await googleAuth(tokenResponse.access_token);
        setExiting(true);
        setTimeout(() => navigate("/dashboard"), 550);
      } catch (err) {
        console.error("GOOGLE SIGNUP ERROR:", err);
        setError(err?.response?.data?.detail || "Google sign-in failed. Please try again.");
      } finally {
        setGoogleLoading(false);
      }
    },
    onError: (err) => {
      console.error("Google OAuth error:", err);
      setError("Google sign-in was cancelled or failed.");
    },
  });

  return (
    <AuthLayout exiting={exiting}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{
          opacity: exiting ? 0 : 1,
          scale:   exiting ? 0.94 : 1,
          y:       exiting ? 10 : 0,
        }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{ width: "100%", maxWidth: "400px" }}
      >
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "16px",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)",
          padding: "48px 40px",
        }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
            <div style={{
              width: "40px", height: "40px", borderRadius: "10px",
              background: "linear-gradient(135deg, #06B6D4, #0F172A)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" style={{ width: "20px", height: "20px" }}>
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            </div>
            <span style={{
              fontSize: "20px", fontWeight: "700", letterSpacing: "-0.02em",
              color: "#0F172A",
            }}>Voyageur</span>
          </div>

          <h1 style={{ fontSize: "24px", fontWeight: "700", color: "#0F172A", marginBottom: "6px", letterSpacing: "-0.02em" }}>
            Create account
          </h1>
          <p style={{ fontSize: "14px", color: "#64748B", marginBottom: "32px", lineHeight: "1.5" }}>
            Start your journey with Voyageur
          </p>

          {/* Google Button */}
          <GoogleButton loading={googleLoading} onClick={() => handleGoogleSignup()} />

          {/* Divider */}
          <Divider />

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <AuthInput
              type="text"
              name="name"
              placeholder="Full name"
              value={form.name}
              onChange={handleChange}
              autoComplete="name"
            />
            <AuthInput
              type="email"
              name="email"
              placeholder="Email address"
              value={form.email}
              onChange={handleChange}
              autoComplete="email"
            />
            <PasswordInput
              name="password"
              placeholder="Password"
              value={form.password}
              onChange={handleChange}
              autoComplete="new-password"
              show={showPassword}
              onToggle={() => setShowPassword((v) => !v)}
            />

            {error && (
              <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "-2px" }}>{error}</p>
            )}

            <SubmitButton loading={loading} exiting={exiting} label="Create Account" loadingLabel="Creating account..." />
          </form>

          <p style={{ fontSize: "14px", color: "#64748B", textAlign: "center", marginTop: "24px" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "#06B6D4", fontWeight: "600", textDecoration: "none" }}>
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </AuthLayout>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────

function GoogleButton({ loading, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%", height: "44px", borderRadius: "10px",
        background: loading ? "#F8FAFC" : "#FFFFFF",
        border: "1px solid #E2E8F0",
        color: loading ? "#94A3B8" : "#0F172A",
        fontSize: "14px", fontWeight: "500",
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
        transition: "all 0.15s ease",
        boxSizing: "border-box",
        boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.background = "#F8FAFC";
          e.currentTarget.style.borderColor = "#CBD5E1";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "#FFFFFF";
        e.currentTarget.style.borderColor = "#E2E8F0";
      }}
    >
      {loading ? (
        <span style={{ fontSize: "13px", color: "#94A3B8" }}>Connecting...</span>
      ) : (
        <>
          <GoogleIcon />
          Continue with Google
        </>
      )}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function Divider() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "24px 0" }}>
      <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
      <span style={{ fontSize: "12px", color: "#94A3B8", fontWeight: "500", letterSpacing: "0.02em" }}>OR</span>
      <div style={{ flex: 1, height: "1px", background: "#E2E8F0" }} />
    </div>
  );
}

function SubmitButton({ loading, exiting, label, loadingLabel }) {
  const active = loading || exiting;
  return (
    <motion.button
      type="submit"
      disabled={active}
      whileHover={active ? {} : { scale: 1.01 }}
      whileTap={active ? {} : { scale: 0.99 }}
      transition={{ duration: 0.15 }}
      style={{
        width: "100%", height: "44px", borderRadius: "10px", marginTop: "8px",
        background: active ? "#94A3B8" : "#06B6D4",
        border: "none",
        color: "#FFFFFF",
        fontSize: "14px", fontWeight: "600",
        cursor: active ? "not-allowed" : "pointer",
        boxShadow: active ? "none" : "0 1px 2px rgba(15, 23, 42, 0.06)",
        letterSpacing: "-0.01em",
      }}
    >
      {loading ? loadingLabel : label}
    </motion.button>
  );
}

function AuthInput({ type, name, placeholder, value, onChange, autoComplete }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} name={name} placeholder={placeholder}
      value={value} onChange={onChange} autoComplete={autoComplete}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", height: "44px", padding: "0 14px",
        borderRadius: "10px",
        background: "#FFFFFF",
        border: focused ? "1px solid #06B6D4" : "1px solid #E2E8F0",
        boxShadow: focused ? "0 0 0 3px rgba(6, 182, 212, 0.08)" : "0 1px 2px rgba(15, 23, 42, 0.03)",
        color: "#0F172A", fontSize: "14px", outline: "none",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        boxSizing: "border-box",
      }}
    />
  );
}

function PasswordInput({ name, placeholder, value, onChange, autoComplete, show, onToggle }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type={show ? "text" : "password"}
        name={name}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: "44px",
          padding: "0 44px 0 14px",
          borderRadius: "10px",
          background: "#FFFFFF",
          border: focused ? "1px solid #06B6D4" : "1px solid #E2E8F0",
          boxShadow: focused ? "0 0 0 3px rgba(6, 182, 212, 0.08)" : "0 1px 2px rgba(15, 23, 42, 0.03)",
          color: "#0F172A", fontSize: "14px", outline: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          boxSizing: "border-box",
        }}
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        style={{
          position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", padding: "4px",
          cursor: "pointer", color: "#94A3B8",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "color 0.15s ease",
          lineHeight: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "#64748B"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "#94A3B8"; }}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
