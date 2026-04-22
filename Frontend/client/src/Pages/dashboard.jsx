import { useContext, useRef, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import CrimeMap from "../components/CrimeMap";
import { useNavigate } from "react-router-dom";
import { sendChatMessage } from "../api/api";
import useLocation from "../hooks/useLocation";

const NAV_ITEMS = [
  { icon: "⊞", label: "Home",    path: "/dashboard" },
  { icon: "✦", label: "Explore", path: "#" },
  { icon: "◎", label: "Map",     path: "#" },
  { icon: "✦", label: "AI Chat", path: "/chat" },
];

const RISK_COLORS = {
  HIGH:    { bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   text: "#fca5a5", accent: "#ef4444", glow: "rgba(239,68,68,0.3)" },
  MEDIUM:  { bg: "rgba(234,179,8,0.1)",   border: "rgba(234,179,8,0.25)",   text: "#fde68a", accent: "#eab308", glow: "rgba(234,179,8,0.3)" },
  LOW:     { bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.25)",   text: "#86efac", accent: "#22c55e", glow: "rgba(34,197,94,0.3)" },
  UNKNOWN: { bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.25)", text: "#94a3b8", accent: "#64748b", glow: "rgba(100,116,139,0.2)" },
};

export default function Dashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeNav, setActiveNav]     = useState("Home");
  const [liveRisk, setLiveRisk]       = useState(null);
  const [clickedRisk, setClickedRisk] = useState(null);
  const [chatOpen, setChatOpen]       = useState(false);
  const [hospitalsFor, setHospitalsFor] = useState(null); // "live" | "selected" | null
  const mapRef = useRef(null);

  const handleLogout = () => { logout(); navigate("/login"); };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  return (
    <div
      className="flex min-h-screen w-full"
      style={{
        background: "radial-gradient(ellipse at 20% 50%, rgba(88,28,135,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(30,58,138,0.08) 0%, transparent 60%), #05050f",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      {/* ── Sidebar ── */}
      <aside
        className="flex flex-col items-center py-8 px-3 gap-5"
        style={{
          width: "68px",
          background: "rgba(255,255,255,0.025)",
          backdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
          minHeight: "100vh",
          position: "sticky",
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          className="anim-float flex items-center justify-center rounded-2xl mb-3 text-sm font-bold"
          style={{
            width: "42px", height: "42px",
            background: "linear-gradient(135deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))",
            boxShadow: "0 0 20px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            color: "#fff",
            letterSpacing: "0.05em",
          }}
        >
          AI
        </div>

        <nav className="flex flex-col gap-2 flex-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setActiveNav(item.label);
                if (item.path !== "#") navigate(item.path);
              }}
              title={item.label}
              className="nav-btn flex items-center justify-center rounded-xl"
              style={{
                width: "42px", height: "42px", fontSize: "15px",
                background: activeNav === item.label ? "rgba(139,92,246,0.18)" : "transparent",
                border: activeNav === item.label ? "1px solid rgba(139,92,246,0.35)" : "1px solid transparent",
                color: activeNav === item.label ? "rgba(167,139,250,1)" : "rgba(255,255,255,0.35)",
                boxShadow: activeNav === item.label ? "0 0 12px rgba(139,92,246,0.2)" : "none",
              }}
            >
              {item.icon}
            </button>
          ))}
        </nav>

        <button
          onClick={handleLogout}
          title="Logout"
          className="nav-btn flex items-center justify-center rounded-xl"
          style={{
            width: "42px", height: "42px", fontSize: "13px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.15)",
            color: "rgba(252,165,165,0.6)",
          }}
        >
          ⏻
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
        {/* Header — no AI button */}
        <header
          className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}
        >
          <div className="card-enter-1">
            <h1
              className="text-2xl font-bold"
              style={{
                background: "linear-gradient(90deg, #e2e8f0 0%, #a5b4fc 50%, #818cf8 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Hey, {greeting}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              {user?.name ? `Welcome back, ${user.name}` : "Your AI travel companion is ready"}
            </p>
          </div>
        </header>

        {/* Content */}
        <div className="flex flex-1 gap-5 p-6 overflow-auto">
          <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
            <GlassMapCard onRiskUpdate={setLiveRisk} onClickedRiskUpdate={setClickedRisk} mapRef={mapRef} onHospitalsChange={setHospitalsFor} />
          </div>
          <aside className="flex flex-col gap-4" style={{ width: "255px", flexShrink: 0 }}>
            <RiskPanel liveRisk={liveRisk} clickedRisk={clickedRisk} mapRef={mapRef} hospitalsFor={hospitalsFor} onClearSelection={() => { setClickedRisk(null); setHospitalsFor(null); }} />          </aside>
        </div>
      </main>

      {/* ── Floating Chat ── */}
      <FloatingChat open={chatOpen} onToggle={() => setChatOpen((v) => !v)} />
    </div>
  );
}

/* ── Floating Chat Bubble + Popup ── */
function FloatingChat({ open, onToggle }) {
  const { location } = useLocation();
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your AI travel companion. Ask me anything about safety, routes, or destinations." },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const tripCtx = location
        ? `User's current location: lat=${location.lat}, lng=${location.lng}`
        : "User location not available.";
      const data = await sendChatMessage({
        history: messages.slice(-5).filter((m) => m.content && m.role),
        message: input,
        trip_context: tripCtx,
      });
      setMessages([...history, { role: "assistant", content: data.response }]);
    } catch {
      setMessages([...history, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <>
      {/* Popup panel */}
      {open && (
        <div
          className="anim-fade-up fixed flex flex-col"
          style={{
            bottom: "88px",
            right: "24px",
            width: "360px",
            height: "500px",
            zIndex: 9999,
            background: "rgba(8,8,20,0.92)",
            backdropFilter: "blur(32px)",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: "20px",
            boxShadow: "0 30px 80px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}
        >
          {/* Chat header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="anim-float flex items-center justify-center rounded-xl text-xs font-bold"
                style={{
                  width: "30px", height: "30px",
                  background: "linear-gradient(135deg, rgba(139,92,246,0.7), rgba(59,130,246,0.7))",
                  boxShadow: "0 0 12px rgba(139,92,246,0.3)",
                  color: "#fff",
                }}
              >
                AI
              </div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>AI Assistant</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 4px #22c55e" }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="flex items-center justify-center rounded-lg transition-all duration-200"
              style={{
                width: "26px", height: "26px", fontSize: "12px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.4)",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#fca5a5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div
            className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3"
            style={{
              background: "radial-gradient(ellipse at top, rgba(139,92,246,0.04) 0%, transparent 60%)",
            }}
          >
            {messages.map((msg, i) => (
              <div
                key={i}
                className="anim-fade-in flex"
                style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
              >
                <div
                  className="text-xs leading-relaxed whitespace-pre-wrap"
                  style={{
                    maxWidth: "82%",
                    padding: "10px 13px",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.role === "user"
                      ? "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(59,130,246,0.2))"
                      : "rgba(255,255,255,0.05)",
                    border: msg.role === "user"
                      ? "1px solid rgba(139,92,246,0.25)"
                      : "1px solid rgba(255,255,255,0.07)",
                    color: msg.role === "user" ? "rgba(221,214,254,0.95)" : "rgba(255,255,255,0.75)",
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl"
                  style={{
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.07)",
                  }}
                >
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        background: "rgba(167,139,250,0.6)",
                        animation: `pulse-dot 1.2s ease-in-out ${d * 0.2}s infinite`,
                      }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div
            className="px-3 py-3 flex-shrink-0 flex gap-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything..."
              className="glass-input flex-1 px-3 py-2 rounded-xl text-xs"
              style={{
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.85)",
              }}
            />
            <button
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="ctrl-btn flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: "34px", height: "34px", fontSize: "14px",
                background: input.trim() && !loading
                  ? "linear-gradient(135deg, rgba(139,92,246,0.7), rgba(59,130,246,0.7))"
                  : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(139,92,246,0.2)",
                color: input.trim() && !loading ? "#fff" : "rgba(255,255,255,0.25)",
                boxShadow: input.trim() && !loading ? "0 0 12px rgba(139,92,246,0.25)" : "none",
                transition: "all 0.2s ease",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Bubble button */}
      <button
        onClick={onToggle}
        className="fixed flex items-center justify-center"
        style={{
          bottom: "24px",
          right: "24px",
          width: "54px",
          height: "54px",
          zIndex: 9999,
          borderRadius: "50%",
          background: open
            ? "rgba(139,92,246,0.3)"
            : "linear-gradient(135deg, rgba(139,92,246,0.85), rgba(59,130,246,0.85))",
          border: "1px solid rgba(139,92,246,0.4)",
          boxShadow: open
            ? "0 0 0 4px rgba(139,92,246,0.1)"
            : "0 8px 30px rgba(139,92,246,0.4), 0 0 0 1px rgba(255,255,255,0.08)",
          color: "#fff",
          fontSize: open ? "18px" : "20px",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          transform: open ? "scale(0.92) rotate(45deg)" : "scale(1) rotate(0deg)",
        }}
        onMouseEnter={(e) => { if (!open) e.currentTarget.style.boxShadow = "0 12px 40px rgba(139,92,246,0.55), 0 0 0 1px rgba(255,255,255,0.1)"; }}
        onMouseLeave={(e) => { if (!open) e.currentTarget.style.boxShadow = "0 8px 30px rgba(139,92,246,0.4), 0 0 0 1px rgba(255,255,255,0.08)"; }}
        title="AI Assistant"
      >
        {open ? "✕" : "✦"}
      </button>
    </>
  );
}

function GlassMapCard({ onRiskUpdate, onClickedRiskUpdate, mapRef, onHospitalsChange }) {
  const [routeFrom, setRouteFrom]       = useState("");
  const [routeTo, setRouteTo]           = useState("");
  const [routeFromCoords, setRouteFromCoords] = useState(null);
  const [routeToCoords, setRouteToCoords]     = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [pickingFor, setPickingFor]     = useState(null);
  const crimeMapRef = mapRef;

  const handleSwap   = () => {
    setRouteFrom(routeTo); setRouteTo(routeFrom);
    setRouteFromCoords(routeToCoords); setRouteToCoords(routeFromCoords);
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!routeFrom || !routeTo) return;
    setPickingFor(null);
    setRouteLoading(true);
    // Pass coord objects if available (map-picked), otherwise pass the text string for geocoding
    await crimeMapRef.current?.triggerRoute(
      routeFromCoords || routeFrom,
      routeToCoords   || routeTo
    );
    setRouteLoading(false);
  };
  const handleClear = () => {
    setRouteFrom(""); setRouteTo("");
    setRouteFromCoords(null); setRouteToCoords(null);
    setPickingFor(null);
    crimeMapRef.current?.clearRoute();
  };

  // Called by CrimeMap when user clicks map while pickingFor is active
  // receives {lat, lng, name} object
  const handleRoutePick = (coords) => {
    if (pickingFor === "from") {
      setRouteFrom(coords.name);
      setRouteFromCoords(coords);
    }
    if (pickingFor === "to") {
      setRouteTo(coords.name);
      setRouteToCoords(coords);
    }
    setPickingFor(null);
  };

  const pinBtnStyle = (field) => ({
    width: "28px", height: "28px", fontSize: "11px", flexShrink: 0,
    background: pickingFor === field ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.08)",
    border: pickingFor === field ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(139,92,246,0.18)",
    color: pickingFor === field ? "rgba(167,139,250,1)" : "rgba(167,139,250,0.5)",
    boxShadow: pickingFor === field ? "0 0 8px rgba(139,92,246,0.3)" : "none",
    borderRadius: "10px",
    transition: "all 0.18s ease",
    cursor: "pointer",
  });

  return (
    <div
      className="card-enter-2 rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}
    >
      {/* Above-map panel */}
      <div className="px-5 py-4 flex flex-col gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>Live Map</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Crime risk · Hospitals · Routes</p>
          </div>
        </div>

        {/* Route form */}
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* From field */}
          <div className="flex gap-1.5 flex-1 items-center" style={{ minWidth: 0 }}>
            <input
              value={routeFrom}
              onChange={(e) => { setRouteFrom(e.target.value); setRouteFromCoords(null); }}
              placeholder={pickingFor === "from" ? "Click on map..." : "From"}
              className="glass-input flex-1 px-3 py-2 rounded-xl text-xs"
              style={{
                background: pickingFor === "from" ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.05)",
                border: pickingFor === "from" ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.8)", minWidth: 0,
              }}
            />
            {/* Pin-on-map button for From */}
            <button
              type="button"
              title="Pick from map"
              onClick={() => setPickingFor((p) => p === "from" ? null : "from")}
              style={pinBtnStyle("from")}
            >
              ◎
            </button>
            <button
              type="button"
              onClick={() => { setRouteFrom("Current Location"); setPickingFor(null); }}
              className="ctrl-btn px-2.5 py-2 rounded-xl text-xs whitespace-nowrap"
              style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", color: "rgba(134,239,172,0.8)" }}
            >
              Current
            </button>
          </div>

          {/* Swap */}
          <button
            type="button"
            onClick={handleSwap}
            className="ctrl-btn flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: "30px", height: "30px", fontSize: "13px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "rgba(167,139,250,0.8)" }}
          >
            ⇄
          </button>

          {/* To field */}
          <div className="flex gap-1.5 flex-1 items-center" style={{ minWidth: 0 }}>
            <input
              value={routeTo}
              onChange={(e) => { setRouteTo(e.target.value); setRouteToCoords(null); }}
              placeholder={pickingFor === "to" ? "Click on map..." : "To"}
              className="glass-input flex-1 px-3 py-2 rounded-xl text-xs"
              style={{
                background: pickingFor === "to" ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.05)",
                border: pickingFor === "to" ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.8)", minWidth: 0,
              }}
            />
            {/* Pin-on-map button for To */}
            <button
              type="button"
              title="Pick from map"
              onClick={() => setPickingFor((p) => p === "to" ? null : "to")}
              style={pinBtnStyle("to")}
            >
              ◎
            </button>
          </div>

          <button
            type="submit"
            disabled={routeLoading}
            className="ctrl-btn px-4 py-2 rounded-xl text-xs font-semibold flex-shrink-0"
            style={{
              background: routeLoading ? "rgba(139,92,246,0.2)" : "linear-gradient(135deg, rgba(139,92,246,0.7), rgba(59,130,246,0.7))",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "#fff",
              boxShadow: routeLoading ? "none" : "0 2px 12px rgba(139,92,246,0.25)",
              opacity: routeLoading ? 0.7 : 1,
            }}
          >
            {routeLoading ? "..." : "Route"}
          </button>

          <button
            type="button"
            onClick={handleClear}
            className="ctrl-btn px-3 py-2 rounded-xl text-xs flex-shrink-0"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}
          >
            Clear
          </button>
        </form>

        {/* Pick mode hint banner */}
        {pickingFor && (
          <div
            className="anim-fade-in flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{
              background: "rgba(139,92,246,0.1)",
              border: "1px solid rgba(139,92,246,0.25)",
              color: "rgba(167,139,250,0.9)",
            }}
          >
            <span style={{ fontSize: "14px" }}>◎</span>
            Click anywhere on the map to set the <strong style={{ color: "#a5b4fc" }}>{pickingFor === "from" ? "starting point" : "destination"}</strong>
            <button
              type="button"
              onClick={() => setPickingFor(null)}
              className="ml-auto text-xs"
              style={{ color: "rgba(167,139,250,0.5)" }}
            >
              cancel
            </button>
          </div>
        )}
      </div>

      <div style={{ height: "390px" }}>
        <CrimeMap
          ref={crimeMapRef}
          embedded
          pickingFor={pickingFor}
          onRoutePick={handleRoutePick}
          onRiskUpdate={onRiskUpdate}
          onClickedRiskUpdate={onClickedRiskUpdate}
          onHospitalsChange={onHospitalsChange}
        />
      </div>    </div>
  );
}

function GalaxyBtn({ children, onClick, variant }) {
  const isDanger = variant === "danger";
  return (
    <button
      onClick={onClick}
      className="ctrl-btn px-3 py-1.5 rounded-xl text-xs font-medium"
      style={{
        background: isDanger ? "rgba(239,68,68,0.08)" : "rgba(255,255,255,0.05)",
        border: isDanger ? "1px solid rgba(239,68,68,0.18)" : "1px solid rgba(255,255,255,0.08)",
        color: isDanger ? "rgba(252,165,165,0.8)" : "rgba(255,255,255,0.5)",
      }}
    >
      {children}
    </button>
  );
}

/* ── Right Panel ── */
function RiskPanel({ liveRisk, clickedRisk, mapRef, hospitalsFor, onClearSelection }) {
  const [showModal, setShowModal] = useState(false);

  const handleClearConfirm = () => {
    setShowModal(false);
    mapRef.current?.clearAll();
    onClearSelection();
  };

  return (
    <>
      <RiskCard
        title="Your Location"
        risk={liveRisk}
        delay="card-enter-2"
        onFocus={() => mapRef.current?.focusMap("live")}
        onHospitals={() => mapRef.current?.showHospitalsFor("live")}
        hospitalsActive={hospitalsFor === "live"}
      />
      {clickedRisk !== null && (
        <RiskCard
          title="Selected Location"
          risk={clickedRisk}
          delay="card-enter-3"
          onFocus={() => mapRef.current?.focusMap("selected")}
          onHospitals={() => mapRef.current?.showHospitalsFor("selected")}
          onClear={() => setShowModal(true)}
          hospitalsActive={hospitalsFor === "selected"}
        />
      )}
      {showModal && (
        <ClearModal
          onCancel={() => setShowModal(false)}
          onConfirm={handleClearConfirm}
        />
      )}
    </>
  );
}

/* ── Confirmation Modal ── */
function ClearModal({ onCancel, onConfirm }) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 99999, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onCancel}
    >
      <div
        className="anim-fade-up rounded-2xl p-6"
        style={{
          width: "290px",
          background: "rgba(8,8,20,0.96)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 30px 60px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.9)" }}>
          Clear selected location?
        </p>
        <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.38)", lineHeight: 1.7 }}>
          This will remove:<br />
          · Selected location marker<br />
          · Hospitals on map<br />
          · Any active routes
        </p>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex-1 py-2 rounded-xl text-xs font-medium transition-all duration-150"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 py-2 rounded-xl text-xs font-semibold transition-all duration-150"
            style={{
              background: "rgba(239,68,68,0.15)",
              border: "1px solid rgba(239,68,68,0.3)",
              color: "#fca5a5",
            }}
          >
            Clear
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Risk Card ── */
function RiskCard({ title, risk, delay = "", onFocus, onHospitals, onClear, hospitalsActive }) {
  const level    = risk?.risk_level || "UNKNOWN";
  const colors   = RISK_COLORS[level] || RISK_COLORS.UNKNOWN;
  const district = risk?.detected_district || risk?.district;
  const state    = risk?.detected_state    || risk?.state;
  const score    = risk?.risk_score;
  const MAX_RAW  = 3000;
  const score10  = score != null ? Math.min((score / MAX_RAW) * 10, 10).toFixed(1) : null;
  const barPct   = score != null ? Math.min((score / MAX_RAW) * 100, 100) : 0;
  const hasData  = risk && !risk.error;

  return (
    <div
      className={`${delay} glass-card rounded-2xl p-5 relative overflow-hidden`}
      style={{
        background: "rgba(255,255,255,0.03)",
        backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
        transition: "border-color 0.2s ease",
      }}
    >
      <div className="anim-glow absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: "80px", height: "80px", top: "-20px", right: "-20px", background: colors.glow }} />

      {/* Title row with optional ✕ */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>
          {title.toUpperCase()}
        </p>
        {onClear && (
          <button
            onClick={onClear}
            title="Clear selection"
            className="flex items-center justify-center rounded-lg"
            style={{
              width: "20px", height: "20px", fontSize: "10px",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.18)",
              color: "rgba(252,165,165,0.55)",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.color = "#fca5a5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "rgba(252,165,165,0.55)"; }}
          >✕</button>
        )}
      </div>

      {!risk ? (
        <div className="flex flex-col gap-2">
          <div className="h-3 rounded-full" style={{ background: "rgba(255,255,255,0.06)", width: "60%" }} />
          <div className="h-2 rounded-full" style={{ background: "rgba(255,255,255,0.04)", width: "40%" }} />
        </div>
      ) : risk.error ? (
        <p className="text-xs" style={{ color: "#fca5a5" }}>{risk.error}</p>
      ) : (
        <>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl mb-3"
            style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
            <span className="pulse-ring relative w-2 h-2 rounded-full flex-shrink-0"
              style={{ background: colors.accent, color: colors.accent }} />
            <span className="text-sm font-bold" style={{ color: colors.text }}>{level} RISK</span>
          </div>

          {district && <p className="text-sm font-medium mb-0.5" style={{ color: "rgba(255,255,255,0.8)" }}>{district}</p>}
          {state    && <p className="text-xs mb-3" style={{ color: "rgba(255,255,255,0.35)" }}>{state}</p>}

          {score !== undefined && (
            <div className="mb-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.35)" }}>Crime Score</span>
                <span className="text-xs font-bold tabular-nums" style={{ color: colors.text }}>{score10} / 10</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: "3px", background: "rgba(255,255,255,0.06)" }}>
                <div className="score-bar-fill h-full rounded-full"
                  style={{ width: `${barPct}%`, background: `linear-gradient(90deg, ${colors.accent}cc, ${colors.accent})`, boxShadow: `0 0 6px ${colors.glow}` }} />
              </div>
            </div>
          )}

          {/* Explicit action buttons */}
          {hasData && (
            <div className="flex gap-2">
              <button
                onClick={onFocus}
                className="ctrl-btn flex-1 py-1.5 rounded-xl text-xs font-medium"
                style={{
                  background: "rgba(139,92,246,0.1)",
                  border: "1px solid rgba(139,92,246,0.2)",
                  color: "rgba(167,139,250,0.85)",
                }}
              >
                Focus on Map
              </button>
              <button
                onClick={onHospitals}
                className="ctrl-btn flex-1 py-1.5 rounded-xl text-xs font-medium"
                style={{
                  background: hospitalsActive ? "rgba(22,163,74,0.25)" : "rgba(34,197,94,0.08)",
                  border: hospitalsActive ? "1px solid rgba(22,163,74,0.5)" : "1px solid rgba(34,197,94,0.18)",
                  color: hospitalsActive ? "#4ade80" : "rgba(134,239,172,0.55)",
                  boxShadow: hospitalsActive ? "0 0 8px rgba(34,197,94,0.2)" : "none",
                  transition: "all 0.2s ease",
                }}
              >
                {hospitalsActive ? "Hide Hospitals" : "Show Hospitals"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
