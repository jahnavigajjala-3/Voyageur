import { motion } from "framer-motion";
import { useTheme } from "../context/ThemeContext";

export default function AuthLayout({ children, exiting = false }) {
  const { isDarkMode } = useTheme();

  return (
    <div
      className="relative min-h-screen w-full overflow-hidden flex items-center justify-center font-sans transition-colors duration-300"
      style={{ background: isDarkMode ? "#07111f" : "#f8fafc" }}
    >
      {/* Background blobs */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div
          className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full blur-3xl"
          style={{ background: isDarkMode ? "rgba(6,182,212,0.06)" : "rgba(20,184,166,0.12)" }}
        />
        <div
          className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full blur-3xl"
          style={{ background: isDarkMode ? "rgba(99,102,241,0.06)" : "rgba(56,189,248,0.12)" }}
        />
      </div>

      {/* Exit fade overlay */}
      <motion.div
        animate={{ opacity: exiting ? 1 : 0 }}
        transition={{ duration: 0.4, ease: "easeIn" }}
        className="absolute inset-0 z-10 pointer-events-none"
        style={{ opacity: 0, background: isDarkMode ? "#07111f" : "#ffffff" }}
      />

      {/* Card slot */}
      <div className="relative z-20 w-full flex items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}
