/**
 * Shared auth UI components used by Login and Signup pages.
 */
import { useState } from "react";
import { motion } from "framer-motion";

export function GoogleButton({ loading, onClick, isDarkMode }) {
  return (
    <button
      type="button" onClick={onClick} disabled={loading}
      style={{
        width: "100%", height: "44px", borderRadius: "10px",
        background: loading ? (isDarkMode ? "#1e293b" : "#F8FAFC") : (isDarkMode ? "#1e293b" : "#FFFFFF"),
        border: `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "#E2E8F0"}`,
        color: loading ? "#94A3B8" : (isDarkMode ? "#e2e8f0" : "#0F172A"),
        fontSize: "14px", fontWeight: "500",
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "10px",
        transition: "all 0.15s ease", boxSizing: "border-box",
        boxShadow: isDarkMode ? "none" : "0 1px 2px rgba(15,23,42,0.03)",
      }}
      onMouseEnter={(e) => {
        if (!loading) {
          e.currentTarget.style.background = isDarkMode ? "#263548" : "#F8FAFC";
          e.currentTarget.style.borderColor = isDarkMode ? "rgba(255,255,255,0.18)" : "#CBD5E1";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isDarkMode ? "#1e293b" : "#FFFFFF";
        e.currentTarget.style.borderColor = isDarkMode ? "rgba(255,255,255,0.1)" : "#E2E8F0";
      }}
    >
      {loading
        ? <span style={{ fontSize: "13px", color: "#94A3B8" }}>Connecting...</span>
        : <><GoogleIcon />Continue with Google</>
      }
    </button>
  );
}

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export function Divider({ isDarkMode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "16px", margin: "24px 0" }}>
      <div style={{ flex: 1, height: "1px", background: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0" }} />
      <span style={{ fontSize: "12px", color: isDarkMode ? "#475569" : "#94A3B8", fontWeight: "500", letterSpacing: "0.02em" }}>OR</span>
      <div style={{ flex: 1, height: "1px", background: isDarkMode ? "rgba(255,255,255,0.08)" : "#E2E8F0" }} />
    </div>
  );
}

export function SubmitButton({ loading, exiting, label, loadingLabel }) {
  const active = loading || exiting;
  return (
    <motion.button
      type="submit" disabled={active}
      whileHover={active ? {} : { scale: 1.01 }}
      whileTap={active ? {} : { scale: 0.99 }}
      transition={{ duration: 0.15 }}
      style={{
        width: "100%", height: "44px", borderRadius: "10px", marginTop: "8px",
        background: active ? "#94A3B8" : "#06B6D4",
        border: "none", color: "#FFFFFF",
        fontSize: "14px", fontWeight: "600",
        cursor: active ? "not-allowed" : "pointer",
        boxShadow: active ? "none" : "0 1px 2px rgba(15,23,42,0.06)",
        letterSpacing: "-0.01em",
      }}
    >
      {loading ? loadingLabel : label}
    </motion.button>
  );
}

export function AuthInput({ type, name, placeholder, value, onChange, autoComplete, isDarkMode }) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      type={type} name={name} placeholder={placeholder}
      value={value} onChange={onChange} autoComplete={autoComplete}
      onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
      style={{
        width: "100%", height: "44px", padding: "0 14px",
        borderRadius: "10px",
        background: isDarkMode ? "#1e293b" : "#FFFFFF",
        border: focused ? "1px solid #06B6D4" : `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "#E2E8F0"}`,
        boxShadow: focused ? "0 0 0 3px rgba(6,182,212,0.12)" : "none",
        color: isDarkMode ? "#f1f5f9" : "#0F172A",
        fontSize: "14px", outline: "none",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        boxSizing: "border-box",
      }}
    />
  );
}

export function PasswordInput({ name, placeholder, value, onChange, autoComplete, show, onToggle, isDarkMode }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ position: "relative", width: "100%" }}>
      <input
        type={show ? "text" : "password"}
        name={name} placeholder={placeholder} value={value}
        onChange={onChange} autoComplete={autoComplete}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{
          width: "100%", height: "44px", padding: "0 44px 0 14px",
          borderRadius: "10px",
          background: isDarkMode ? "#1e293b" : "#FFFFFF",
          border: focused ? "1px solid #06B6D4" : `1px solid ${isDarkMode ? "rgba(255,255,255,0.1)" : "#E2E8F0"}`,
          boxShadow: focused ? "0 0 0 3px rgba(6,182,212,0.12)" : "none",
          color: isDarkMode ? "#f1f5f9" : "#0F172A",
          fontSize: "14px", outline: "none",
          transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          boxSizing: "border-box",
        }}
      />
      <button
        type="button" onClick={onToggle}
        aria-label={show ? "Hide password" : "Show password"}
        style={{
          position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)",
          background: "none", border: "none", padding: "4px",
          cursor: "pointer", color: isDarkMode ? "#475569" : "#94A3B8",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "color 0.15s ease", lineHeight: 0,
        }}
        onMouseEnter={(e) => { e.currentTarget.style.color = isDarkMode ? "#94a3b8" : "#64748B"; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = isDarkMode ? "#475569" : "#94A3B8"; }}
      >
        {show ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}

export function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  );
}

export function EyeOffIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}
