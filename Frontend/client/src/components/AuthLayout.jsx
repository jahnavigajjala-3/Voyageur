import { motion } from "framer-motion";
import { Player } from "@lottiefiles/react-lottie-player";
import earthAnimation from "../assets/earth.json";

// Deterministic stars
const STARS = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  top:  `${(i * 14.3 + 4) % 100}%`,
  left: `${(i * 21.7 + 9) % 100}%`,
  size: i % 7 === 0 ? 2 : i % 3 === 0 ? 1.5 : 1,
  dur:  2.5 + (i % 7) * 0.4,
  delay: (i % 11) * 0.28,
  op: 0.06 + (i % 5) * 0.05,
}));

export default function AuthLayout({ children, exiting = false }) {
  return (
    <div style={{
      position: "relative",
      minHeight: "100vh",
      width: "100%",
      overflow: "hidden",
      background: "radial-gradient(ellipse at 15% 40%, rgba(14,30,80,0.55) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(7,20,55,0.45) 0%, transparent 50%), radial-gradient(ellipse at 50% 90%, rgba(4,12,35,0.6) 0%, transparent 60%), #04060f",
      fontFamily: "'Inter','Segoe UI',sans-serif",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}>

      {/* ── Stars ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2 }}
        style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}
      >
        {STARS.map(s => (
          <div key={s.id} style={{
            position: "absolute",
            top: s.top, left: s.left,
            width: `${s.size}px`, height: `${s.size}px`,
            borderRadius: "50%",
            background: "#fff",
            opacity: s.op,
            animation: `twinkle ${s.dur}s ease-in-out ${s.delay}s infinite`,
          }} />
        ))}
      </motion.div>

      {/* ── Nebula glow ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none",
        background: "radial-gradient(ellipse at 15% 80%, rgba(56,189,248,0.1) 0%, transparent 55%), radial-gradient(ellipse at 80% 15%, rgba(99,102,241,0.08) 0%, transparent 50%)",
      }} />

      {/* ── Earth Lottie — full background ── */}
      <motion.div
        initial={{ opacity: 0, scale: 1.05 }}
        animate={{ opacity: exiting ? 0 : 1, scale: exiting ? 1.08 : 1 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 1,
          pointerEvents: "none",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Player
          autoplay
          loop
          src={earthAnimation}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            minWidth: "100vw",
            minHeight: "100vh",
          }}
        />
      </motion.div>

      {/* ── Dark overlay so card stays readable ── */}
      <div style={{
        position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none",
        background: "rgba(2,6,23,0.45)",
      }} />

      {/* ── Background zoom/darken on exit ── */}
      <motion.div
        animate={{
          opacity: exiting ? 1 : 0,
          scale:   exiting ? 1 : 0.95,
        }}
        transition={{ duration: 0.5, ease: "easeIn" }}
        style={{
          position: "absolute", inset: 0, zIndex: 2,
          background: "rgba(2,6,23,0.6)",
          pointerEvents: "none",
          opacity: 0,
        }}
      />

      {/* ── Card slot ── */}
      <div style={{
        position: "relative", zIndex: 3,
        width: "100%", display: "flex",
        alignItems: "center", justifyContent: "center",
        padding: "40px 16px",
      }}>
        {children}
      </div>

      <style>{`
        @keyframes twinkle {
          0%,100% { opacity: inherit; transform: scale(1); }
          50%      { opacity: 1; transform: scale(1.8); }
        }
        @media (max-width: 768px) {
          .earth-element { display: none !important; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  );
}
