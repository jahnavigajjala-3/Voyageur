import { useState } from "react";
import { motion } from "framer-motion";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";

export default function Login() {
  const { login }  = useAuth();
  const navigate   = useNavigate();
  const [form, setForm]       = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");
  const [exiting, setExiting] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(form.email, form.password);
      setExiting(true);
      setTimeout(() => navigate("/dashboard"), 550);
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      setError("Invalid email or password.");
      setLoading(false);
    }
  };

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
            Welcome back
          </h1>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.3)", marginBottom: "28px" }}>
            Sign in to your account
          </p>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <AuthInput type="email"    name="email"    placeholder="Email address" value={form.email}    onChange={handleChange} autoComplete="email" />
            <AuthInput type="password" name="password" placeholder="Password"      value={form.password} onChange={handleChange} autoComplete="current-password" />

            {error && <p style={{ fontSize: "12px", color: "#fca5a5", marginTop: "-2px" }}>{error}</p>}

            <SubmitButton loading={loading} exiting={exiting} label="Sign In" loadingLabel="Signing in..." />
          </form>

          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.2)", textAlign: "center", marginTop: "24px" }}>
            Don&apos;t have an account?{" "}
            <Link to="/signup" style={{ color: "rgba(167,139,250,0.85)", fontWeight: "600", textDecoration: "none" }}>
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </AuthLayout>
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
