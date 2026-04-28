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
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(16px)",
          WebkitBackdropFilter: "blur(16px)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: "20px",
          boxShadow: "0 0 0 1px rgba(255,255,255,0.04), 0 32px 64px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.06)",
          padding: "40px 36px",
        }}>

          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "32px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "12px",
              background: "linear-gradient(135deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))",
              boxShadow: "0 0 18px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "13px", fontWeight: "700", color: "#fff", letterSpacing: "0.04em",
            }}>AI</div>
            <span style={{
              fontSize: "18px", fontWeight: "700", letterSpacing: "-0.01em",
              background: "linear-gradient(90deg, #e2e8f0 0%, #a5b4fc 50%, #818cf8 100%)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>Voyageur</span>
          </div>

          <h1 style={{ fontSize: "20px", fontWeight: "700", color: "rgba(255,255,255,0.9)", marginBottom: "4px" }}>
            Create account
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", marginBottom: "28px" }}>
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
              <p style={{ fontSize: "12px", color: "#fca5a5", marginTop: "-2px" }}>{error}</p>
            )}

            <SubmitButton loading={loading} exiting={exiting} label="Create Account" loadingLabel="Creating account..." />
          </form>

          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: "24px" }}>
            Already have an account?{" "}
            <Link to="/login" style={{ color: "rgba(167,139,250,0.85)", fontWeight: "600", textDecoration: "none" }}>
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
        width: "100%", height: "44px", borderRadius: "12px",
        background: loading ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
        border: "1px solid rgba(255,255,255,0.12)",
        color: loading ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.85)",
        fontSize: "13px", fontWeight: "500",
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
        transition: "all 0.2s ease",
        boxSizing: "border-box",
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.background = "rgba(255,255,255,0.09)";
          e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(255,255,255,0.06)";
        e.currentTarget.style.borderColor = "rgba(255,255,255,0.12)";
      }}
    >
      {loading ? (
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Connecting...</span>
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
    <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "20px 0" }}>
      <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
      <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", letterSpacing: "0.05em" }}>OR</span>
      <div style={{ flex: 1, height: "1px", background: "rgba(255,255,255,0.08)" }} />
    </div>
  );
}

function SubmitButton({ loading, exiting, label, loadingLabel }) {
  const active = loading || exiting;
  return (
    <motion.button
      type="submit"
      disabled={active}
      whileHover={active ? {} : { scale: 1.02, boxShadow: "0 0 28px rgba(139,92,246,0.5), 0 6px 18px rgba(0,0,0,0.35)" }}
      whileTap={active ? {} : { scale: 0.97 }}
      transition={{ duration: 0.15 }}
      style={{
        width: "100%", height: "44px", borderRadius: "12px", marginTop: "6px",
        background: active
          ? "rgba(139,92,246,0.2)"
          : "linear-gradient(135deg, rgba(139,92,246,0.85), rgba(59,130,246,0.8))",
        border: "1px solid rgba(139,92,246,0.35)",
        color: active ? "rgba(167,139,250,0.5)" : "#fff",
        fontSize: "14px", fontWeight: "600",
        cursor: active ? "not-allowed" : "pointer",
        boxShadow: active ? "none" : "0 0 18px rgba(139,92,246,0.28), 0 4px 14px rgba(0,0,0,0.3)",
        letterSpacing: "0.02em",
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
        borderRadius: "12px",
        background: "rgba(255,255,255,0.05)",
        border: focused ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
        boxShadow: focused ? "0 0 0 3px rgba(139,92,246,0.1), 0 0 12px rgba(139,92,246,0.08)" : "none",
        color: "rgba(255,255,255,0.85)", fontSize: "13px", outline: "none",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
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
          borderRadius: "12px",
          background: "rgba(255,255,255,0.05)",
          border: focused ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(255,255,255,0.08)",
          boxShadow: focused ? "0 0 0 3px rgba(139,92,246,0.1), 0 0 12px rgba(139,92,246,0.08)" : "none",
          color: "rgba(255,255,255,0.85)", fontSize: "13px", outline: "none",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
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
          cursor: "pointer", color: "rgba(255,255,255,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "color 0.15s ease",
          lineHeight: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = "rgba(167,139,250,0.8)"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.3)"; }}
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
