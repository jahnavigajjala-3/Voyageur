import { motion } from "framer-motion";

export default function AuthLayout({ children, exiting = false }) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-slate-50 flex items-center justify-center font-sans">
      
      {/* ── Background decoration ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-100/40 blur-3xl" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-sky-100/40 blur-3xl" />
      </div>

      {/* ── Background zoom/fade on exit ── */}
      <motion.div
        animate={{
          opacity: exiting ? 1 : 0,
        }}
        transition={{ duration: 0.4, ease: "easeIn" }}
        className="absolute inset-0 z-10 bg-white pointer-events-none"
        style={{ opacity: 0 }}
      />

      {/* ── Card slot ── */}
      <div className="relative z-20 w-full flex items-center justify-center px-4 py-10">
        {children}
      </div>

    </div>
  );
}
