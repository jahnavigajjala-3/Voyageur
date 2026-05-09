import { useContext, useRef, useState, useEffect, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import { useRouteContext } from "../context/RouteContext";
import CrimeMap from "../components/CrimeMap";
import { useNavigate } from "react-router-dom";
import { sendChatMessage, getWeather } from "../api/api";
import useLocation from "../hooks/useLocation";
import { getRiskColorsByLevel, getRiskColor } from "../utils/riskColors";

const NAV_ITEMS = [
  { icon: "⊞", label: "Home",    path: "/dashboard" },
  { icon: "✦", label: "AI Chat", path: "/chat" },
];

// ─── Design tokens ────────────────────────────────────────────────────────
const CYAN   = "rgba(56,189,248,1)";
const CYAN20 = "rgba(56,189,248,0.2)";
const CYAN10 = "rgba(56,189,248,0.1)";
const CYAN05 = "rgba(56,189,248,0.05)";
const INDIGO = "rgba(99,102,241,1)";
const SURFACE = "rgba(8,12,28,0.72)";
const BORDER  = "rgba(255,255,255,0.07)";

// Removed RISK_COLORS in favor of imported logic

function getStepIcon(text = "") {
  const t = text.toLowerCase();
  if (t.includes("arrive") || t.includes("destination")) return "🏁";
  if (t.includes("roundabout") || t.includes("rotary")) return "🔄";
  if (t.includes("slight left"))  return "↖";
  if (t.includes("slight right")) return "↗";
  if (t.includes("sharp left"))   return "⬅";
  if (t.includes("sharp right"))  return "➡";
  if (t.includes("left"))  return "←";
  if (t.includes("right")) return "→";
  if (t.includes("straight") || t.includes("continue") || t.includes("head")) return "↑";
  if (t.includes("ferry")) return "⛴";
  if (t.includes("end of road")) return "⚑";
  return "•";
}
// stepIcon is an alias used in RouteSafetyBar
const stepIcon = getStepIcon;

// ─── Weather helpers ────────────────────────────────────────────────────────
function getWeatherIcon(code) {
  if (code === 0) return "☀️";
  if ([1, 2, 3].includes(code)) return "⛅";
  if ([45, 48].includes(code)) return "🌫️";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "🌧️";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "🌨️";
  if ([95, 96, 99].includes(code)) return "⛈️";
  return "🌤️";
}

function getWeatherLabel(code) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";
  return "Unknown";
}
// ────────────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { user, logout, isGuest } = useContext(AuthContext);
  const {
    routes: safeRoutes,
    selectedRouteId,
    isLoadingRoutes,
    routeHistory,
    setSelectedRouteId,
    resetSession,
    deleteRoute,
  } = useRouteContext();
  const navigate = useNavigate();
  const { location } = useLocation(); // ← needed for weather

  const [activeNav, setActiveNav]       = useState("Home");
  const [liveRisk, setLiveRisk]         = useState(null);
  const [clickedRisk, setClickedRisk]   = useState(null);
  const [chatOpen, setChatOpen]         = useState(false);
  const [hospitalsFor, setHospitalsFor] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  // ─── Weather state ────────────────────────────────────────────────────────
  const [weather, setWeather]               = useState(null);
  const [, setWeatherLoading]               = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

  const mapRef = useRef(null);

  const handleLogout = () => {
    resetSession(); // clear all route/history state before logging out
    logout();
    navigate("/login");
  };
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good Morning" : hour < 17 ? "Good Afternoon" : "Good Evening";

  // ─── Fetch weather whenever location changes ──────────────────────────────
  useEffect(() => {
    if (location?.lat == null || location?.lng == null) return;

    const fetchWeather = async () => {
      try {
        setWeatherLoading(true);
        const data = await getWeather(location.lat, location.lng);
        setWeather(data);
      } catch (err) {
        console.error("Weather fetch failed:", err);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [location]);
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="flex min-h-screen w-full"
      style={{
        background: "radial-gradient(ellipse at 15% 40%, rgba(14,30,80,0.55) 0%, transparent 55%), radial-gradient(ellipse at 85% 15%, rgba(7,20,55,0.45) 0%, transparent 50%), radial-gradient(ellipse at 50% 90%, rgba(4,12,35,0.6) 0%, transparent 60%), #04060f",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}>

      {/* ── Ambient background orbs ── */}
      <div className="ambient-orb" style={{ width: "500px", height: "500px", top: "-120px", left: "-80px", background: "rgba(14,30,100,0.35)", animationDelay: "0s" }} />
      <div className="ambient-orb" style={{ width: "400px", height: "400px", bottom: "-100px", right: "200px", background: "rgba(7,18,60,0.3)", animationDelay: "-6s" }} />
      <div className="ambient-orb" style={{ width: "300px", height: "300px", top: "40%", right: "-60px", background: "rgba(10,22,70,0.25)", animationDelay: "-12s" }} />

      {/* ── SIDEBAR ── */}
      <aside className="voyageour-sidebar flex flex-col items-center py-7 px-3 gap-4"
        style={{
          width: "64px", minHeight: "100vh",
          position: "sticky", top: 0, zIndex: 20, flexShrink: 0,
        }}>

        {/* Logo mark */}
        <div className="flex items-center justify-center mb-3"
          style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(135deg, rgba(56,189,248,0.2), rgba(99,102,241,0.15))",
            border: "1px solid rgba(56,189,248,0.22)",
            boxShadow: "0 0 16px rgba(56,189,248,0.1)",
            fontSize: "14px", color: "rgba(125,211,252,0.9)",
          }}>✦</div>

        <nav className="flex flex-col gap-1.5 flex-1">
          {NAV_ITEMS.map((item) => (
            <button key={item.label}
              onClick={() => { setActiveNav(item.label); if (item.path !== "#") navigate(item.path); }}
              title={item.label}
              className={`nav-btn flex items-center justify-center rounded-xl ${activeNav === item.label ? "active-nav" : ""}`}
              style={{
                width: "40px", height: "40px", fontSize: "14px",
                background: activeNav === item.label ? "rgba(56,189,248,0.12)" : "transparent",
                border: activeNav === item.label ? "1px solid rgba(56,189,248,0.28)" : "1px solid transparent",
                color: activeNav === item.label ? "rgba(125,211,252,1)" : "rgba(255,255,255,0.3)",
              }}>{item.icon}</button>
          ))}
        </nav>

        {/* Guest badge */}
        {isGuest && (
          <button
            onClick={() => navigate("/login")}
            title="Sign in to save trips and sync data"
            className="nav-btn flex items-center justify-center rounded-xl"
            style={{
              width: "40px", height: "40px", fontSize: "9px", fontWeight: "700",
              background: "rgba(234,179,8,0.08)",
              border: "1px solid rgba(234,179,8,0.2)",
              color: "rgba(253,224,71,0.75)",
              letterSpacing: "0.02em", lineHeight: 1.1, textAlign: "center",
            }}
          >GUEST</button>
        )}

        {/* AI live indicator */}
        <div className="flex flex-col items-center gap-1.5 mb-2">
          <div className="live-dot-cyan" />
          <span style={{ fontSize: "7px", color: "rgba(56,189,248,0.45)", letterSpacing: "0.1em", writingMode: "vertical-rl", transform: "rotate(180deg)" }}>LIVE</span>
        </div>

        <button onClick={handleLogout} title={isGuest ? "Exit guest mode" : "Logout"}
          className="nav-btn flex items-center justify-center rounded-xl"
          style={{ width: "40px", height: "40px", fontSize: "12px", background: "rgba(239,68,68,0.07)", border: "1px solid rgba(239,68,68,0.12)", color: "rgba(252,165,165,0.5)" }}>⏻</button>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0, position: "relative", zIndex: 1 }}>

        {/* ── HEADER ── */}
        <header className="flex items-center justify-between px-7 py-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>

          <div className="card-enter-1 flex items-center gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-tight"
                style={{ background: "linear-gradient(90deg, #f0f4ff 0%, #7dd3fc 45%, #818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: "-0.02em" }}>
                VOYAGEOUR
              </h1>
              <p className="text-[11px] mt-0.5" style={{ color: "rgba(255,255,255,0.28)", letterSpacing: "0.03em" }}>
                {isGuest
                  ? "Exploring as guest · Sign in to save trips"
                  : user?.name ? `${greeting}, ${user.name} — AI travel intelligence active` : "AI travel intelligence active"}
              </p>
            </div>
            <div style={{ width: "1px", height: "26px", background: "linear-gradient(to bottom, transparent, rgba(56,189,248,0.28), transparent)" }} />
            <div className="ai-active-pill flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-semibold tracking-widest">
              <div className="live-dot-cyan" style={{ width: "5px", height: "5px" }} />
              AI ACTIVE
            </div>
          </div>

          {/* Weather badge */}
          {weather && (
            <div className="card-enter-2 flex items-center gap-2.5 px-3.5 py-2 rounded-xl"
              style={{
                background: "rgba(8,12,28,0.72)", backdropFilter: "blur(20px)",
                border: "1px solid rgba(255,255,255,0.07)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
              }}>
              <span style={{ fontSize: "18px" }}>{getWeatherIcon(weather.weathercode)}</span>
              <div>
                <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.88)", lineHeight: 1 }}>{weather.temperature}°C</p>
                <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)", marginTop: "1px" }}>{getWeatherLabel(weather.weathercode)} · {weather.windspeed} km/h</p>
              </div>
            </div>
          )}
        </header>

        {/* Holographic header line */}
        <div className="holo-line" />

        <div className="flex flex-1 gap-4 p-5 overflow-auto" style={{ minHeight: 0 }}>
          <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
            <GlassMapCard
              onRiskUpdate={setLiveRisk}
              onClickedRiskUpdate={setClickedRisk}
              mapRef={mapRef}
              onHospitalsChange={setHospitalsFor}
              safeRoutes={safeRoutes}
              selectedRouteId={selectedRouteId}
              onRouteSelect={setSelectedRouteId}
              isLoadingRoutes={isLoadingRoutes}
              user={user}
              userLocation={location}
            />
          </div>
          <aside className="flex flex-col gap-3.5" style={{ width: "340px", flexShrink: 0 }}>

            {/* Route History Panel */}
            {routeHistory.length > 0 && (
              <div className="voyageour-panel card-enter-3 rounded-2xl p-4 relative overflow-hidden">
                <div style={{ position: "absolute", top: 0, left: "20%", right: "20%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.3), transparent)" }} />
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span style={{ fontSize: "11px", color: "rgba(56,189,248,0.8)" }}>◈</span>
                    <p className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.32)", letterSpacing: "0.12em" }}>RECENT ROUTES</p>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded-full"
                    style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.18)", color: "rgba(125,211,252,0.6)" }}>
                    {routeHistory.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5 max-h-52 overflow-y-auto">
                  {routeHistory.slice(0, 5).map((historyItem, index) => (
                    <div key={historyItem.id}
                      className="glass-card p-3 rounded-xl"
                      style={{ background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)" }}>
                      <div className="flex items-start gap-2">
                        {/* Clickable route info */}
                        <div className="flex-1 cursor-pointer"
                          onClick={() => mapRef.current?.triggerRoute(historyItem.origin, historyItem.destination, true)}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-medium" style={{ color: "rgba(255,255,255,0.62)" }}>Route {index + 1}</span>
                            <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.25)" }}>
                              {new Date(historyItem.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="text-[10px] flex flex-col gap-0.5" style={{ color: "rgba(255,255,255,0.42)" }}>
                            <div className="truncate flex items-center gap-1.5">
                              <span style={{ color: "#22c55e", fontSize: "7px" }}>●</span>
                              {historyItem.origin.lat.toFixed(4)}, {historyItem.origin.lng.toFixed(4)}
                            </div>
                            <div className="truncate flex items-center gap-1.5">
                              <span style={{ color: "#ef4444", fontSize: "7px" }}>●</span>
                              {historyItem.destination.lat.toFixed(4)}, {historyItem.destination.lng.toFixed(4)}
                            </div>
                          </div>
                          {historyItem.routes?.length > 0 && (
                            <div className="mt-2 flex items-center gap-1.5">
                              <span className="text-[10px] px-1.5 py-0.5 rounded-md font-semibold"
                                style={{
                                  background: historyItem.routes[0].type === "safest" ? "rgba(34,197,94,0.1)" : "rgba(59,130,246,0.1)",
                                  color: historyItem.routes[0].type === "safest" ? "#86efac" : "#93c5fd",
                                  border: `1px solid ${historyItem.routes[0].type === "safest" ? "rgba(34,197,94,0.22)" : "rgba(59,130,246,0.22)"}`,
                                }}>
                                {historyItem.routes[0].type.toUpperCase()}
                              </span>
                              <span className="text-[10px] ml-auto" style={{ color: "rgba(255,255,255,0.28)" }}>
                                {historyItem.routes[0].safety_score?.toFixed ? historyItem.routes[0].safety_score.toFixed(1) : historyItem.routes[0].safety_score}/10
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Delete button */}
                        <button
                          onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(historyItem.id); }}
                          title="Delete route"
                          style={{
                            flexShrink: 0, width: "30px", height: "30px",
                            background: "transparent", border: "none",
                            color: "rgba(252,165,165,0.6)", cursor: "pointer",
                            fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center",
                            borderRadius: "8px", transition: "all 0.15s ease",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "#fca5a5"; e.currentTarget.style.background = "rgba(239,68,68,0.12)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(252,165,165,0.6)"; e.currentTarget.style.background = "transparent"; }}
                        >🗑</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Delete confirmation modal */}
            {confirmDeleteId && (
              <div style={{
                position: "fixed", inset: 0, zIndex: 9998,
                background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
                onClick={() => setConfirmDeleteId(null)}
              >
                <div onClick={(e) => e.stopPropagation()} style={{
                  background: "rgba(10,10,25,0.95)", backdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px",
                  padding: "24px", width: "280px",
                  boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
                }}>
                  <p className="text-sm font-semibold mb-2" style={{ color: "rgba(255,255,255,0.9)" }}>Delete route?</p>
                  <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.4)" }}>
                    Are you sure you want to delete this route?
                  </p>
                  <div className="flex gap-2">
                    <button onClick={() => setConfirmDeleteId(null)} style={{
                      flex: 1, padding: "8px", borderRadius: "10px",
                      background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)",
                      color: "rgba(255,255,255,0.6)", fontSize: "12px", cursor: "pointer",
                    }}>Cancel</button>
                    <button onClick={() => { deleteRoute(confirmDeleteId); setConfirmDeleteId(null); }} style={{
                      flex: 1, padding: "8px", borderRadius: "10px",
                      background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)",
                      color: "#fca5a5", fontSize: "12px", fontWeight: "600", cursor: "pointer",
                    }}>Delete</button>
                  </div>
                </div>
              </div>
            )}

            <RiskPanel liveRisk={liveRisk} clickedRisk={clickedRisk} mapRef={mapRef} hospitalsFor={hospitalsFor}
              onClearSelection={() => { setClickedRisk(null); setHospitalsFor(null); }} />
          </aside>
        </div>
      </main>

      <FloatingChat
        open={chatOpen}
        onToggle={() => setChatOpen((v) => !v)}
        weather={weather}
        safeRoutes={safeRoutes}
        selectedRouteId={selectedRouteId}
        liveRisk={liveRisk}
      />
    </div>
  );
}

// ─── FloatingChat (weather passed in for AI context) ──────────────────────
function FloatingChat({ open, onToggle, weather, safeRoutes = [], selectedRouteId = null }) {
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
      // ── Build trip_context: weather only ─────────────────────────────
      // Location risk is fetched fresh on the backend using current_lat/lng.
      // We do NOT pass liveRisk here — it can be stale (fetched once on page
      // load, may reflect IP-based geolocation before GPS locked).
      const weatherCtx = weather
        ? `Weather: ${getWeatherLabel(weather.weathercode)}, ${weather.temperature}°C, wind ${weather.windspeed} km/h.`
        : "";

      const tripContext = weatherCtx;

      // ── Build route_context from the currently selected/safest route ──
      const activeRoute =
        safeRoutes.find((r) => r.id === selectedRouteId) ||
        safeRoutes.find((r) => r.type === "safest") ||
        safeRoutes[0] ||
        null;

      // Serialise just what the backend needs: summary fields + geometry coords
      const routePayload = activeRoute
        ? JSON.stringify({
            summary:    activeRoute.summary  || "",
            distance:   activeRoute.distance || 0,
            duration:   activeRoute.duration || 0,
            risk_level: activeRoute.risk_level || "",
            safety_score: activeRoute.safety_score ?? null,
            // geometry.coordinates is [[lng,lat], ...] — same format the backend expects
            polyline: activeRoute.geometry?.coordinates || [],
          })
        : null;

      const data = await sendChatMessage({
        history: messages.slice(-5).filter((m) => m.content && m.role),
        message: input,
        trip_context: tripContext,
        current_lat: location?.lat ?? null,
        current_lng: location?.lng ?? null,
        // Pass route inline via trip_context extension; backend reads planned_route
        // We piggyback it through the existing planned_route field added to ChatRequest
        planned_route: routePayload,
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
      {open && (
        <div className="anim-fade-up fixed flex flex-col"
          style={{
            bottom: "88px", right: "24px", width: "360px", height: "500px", zIndex: 9999,
            background: "rgba(5,8,20,0.94)", backdropFilter: "blur(36px) saturate(180%)",
            border: "1px solid rgba(56,189,248,0.15)", borderRadius: "20px",
            boxShadow: "0 32px 80px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04), inset 0 1px 0 rgba(255,255,255,0.05)",
            overflow: "hidden",
          }}>
          {/* Top accent line */}
          <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.5), transparent)" }} />

          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2.5">
              <div className="anim-float flex items-center justify-center rounded-xl text-xs font-bold"
                style={{ width: "30px", height: "30px", background: "linear-gradient(135deg, rgba(56,189,248,0.6), rgba(99,102,241,0.55))", boxShadow: "0 0 14px rgba(56,189,248,0.25)", color: "#fff" }}>AI</div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>AI Assistant</p>
                <div className="flex items-center gap-1">
                  <div className="live-dot" style={{ width: "5px", height: "5px" }} />
                  <span className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Online</span>
                </div>
              </div>
            </div>
            <button onClick={onToggle}
              className="flex items-center justify-center rounded-lg"
              style={{ width: "26px", height: "26px", fontSize: "11px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.35)", cursor: "pointer" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.1)"; e.currentTarget.style.color = "#fca5a5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.35)"; }}>✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3"
            style={{ background: "radial-gradient(ellipse at top, rgba(56,189,248,0.03) 0%, transparent 60%)" }}>
            {messages.map((msg, i) => (
              <div key={i} className="anim-fade-in flex" style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div className={`text-xs leading-relaxed whitespace-pre-wrap ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}`}
                  style={{
                    maxWidth: "82%", padding: "10px 13px",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  }}>{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl chat-bubble-ai">
                  {[0,1,2].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "rgba(125,211,252,0.55)", animation: `pulse-dot 1.2s ease-in-out ${d * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-3 flex-shrink-0 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Ask anything..." className="glass-input flex-1 px-3 py-2 rounded-xl text-xs"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.85)" }} />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              className="ctrl-btn flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: "34px", height: "34px", fontSize: "14px", cursor: "pointer",
                background: input.trim() && !loading ? "linear-gradient(135deg, rgba(56,189,248,0.65), rgba(99,102,241,0.6))" : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(56,189,248,0.2)",
                color: input.trim() && !loading ? "#fff" : "rgba(255,255,255,0.2)",
                boxShadow: input.trim() && !loading ? "0 0 14px rgba(56,189,248,0.25)" : "none",
                transition: "all 0.2s ease",
              }}>↑</button>
          </div>
        </div>
      )}

      <button onClick={onToggle} className="fixed flex items-center justify-center"
        style={{
          bottom: "24px", right: "24px", width: "52px", height: "52px", zIndex: 9999,
          borderRadius: "50%", cursor: "pointer",
          background: open ? "rgba(56,189,248,0.2)" : "linear-gradient(135deg, rgba(56,189,248,0.75), rgba(99,102,241,0.7))",
          border: "1px solid rgba(56,189,248,0.35)",
          boxShadow: open ? "0 0 0 4px rgba(56,189,248,0.08)" : "0 8px 28px rgba(56,189,248,0.35), 0 0 0 1px rgba(56,189,248,0.15)",
          color: "#fff", fontSize: open ? "16px" : "18px",
          transition: "all 0.28s cubic-bezier(0.34,1.56,0.64,1)",
          transform: open ? "scale(0.9) rotate(45deg)" : "scale(1) rotate(0deg)",
        }}
        title="AI Assistant">{open ? "✕" : "✦"}</button>
    </>
  );
}

// ─── RouteSafetyBar — horizontal strip + directions dropdown ─────────────
const ROUTE_TAB = {
  safest:      { icon: "🛡️", label: "Safest",  color: "#22c55e", bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.35)"  },
  alternative: { icon: "🗺️", label: "Normal",  color: "#60a5fa", bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.35)" },
};

// Replaced getScoreColor with getRiskColor from utils

function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

// Parse OSRM steps from a route object (steps are already embedded from backend)
function parseStepsFromRoute(route) {
  const rawSteps = route?.steps;
  if (!rawSteps?.length) return [];
  const steps = [];
  rawSteps.forEach(step => {
    const { maneuver = {}, name = "", distance = 0, duration = 0 } = step;
    const road = name ? ` onto ${name}` : "";
    const mod  = maneuver.modifier ? ` ${maneuver.modifier}` : "";
    const type = maneuver.type || "continue";
    let text = `${type.replace(/_/g, " ")}${mod}${road}`.trim();
    if (type === "turn")        text = `Turn${mod}${road}`;
    else if (type === "depart") text = `Depart${road}`;
    else if (type === "arrive") text = "Arrive at destination";
    steps.push({ text, distance, duration, location: maneuver.location });
  });
  return steps;
}

// Fallback: fetch steps from OSRM using sampled waypoints along the route geometry
async function fetchStepsForRoute(route) {
  // Use embedded steps if available (from backend)
  if (route?.steps?.length) {
    return parseStepsFromRoute(route);
  }
  // Fallback using geometry
  const coords = route?.geometry?.coordinates;
  if (!coords?.length) return [];
  // Sample ~10 waypoints evenly for better accuracy than just first/last
  const step = Math.max(1, Math.floor(coords.length / 10));
  const waypoints = [];
  for (let i = 0; i < coords.length; i += step) waypoints.push(coords[i]);
  if (waypoints[waypoints.length - 1] !== coords[coords.length - 1]) {
    waypoints.push(coords[coords.length - 1]);
  }
  const coordStr = waypoints.map(c => `${c[0]},${c[1]}`).join(";");
  try {
    const res = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson&steps=true`
    );
    if (!res.ok) return [];
    const data = await res.json();
    if (data.code !== "Ok" || !data.routes?.length) return [];
    const steps = [];
    data.routes[0].legs.forEach(leg => {
      leg.steps.forEach(s => {
        const { maneuver = {}, name = "", distance, duration } = s;
        const road = name ? ` onto ${name}` : "";
        const mod  = maneuver.modifier ? ` ${maneuver.modifier}` : "";
        const type = maneuver.type || "continue";
        let text = `${type.replace(/_/g, " ")}${mod}${road}`.trim();
        if (type === "turn")        text = `Turn${mod}${road}`;
        else if (type === "depart") text = `Depart${road}`;
        else if (type === "arrive") text = "Arrive at destination";
        steps.push({ text, distance, duration, location: maneuver.location });
      });
    });
    return steps;
  } catch { return []; }
}

function RouteSafetyBar({ routes, selectedRouteId, onRouteSelect, isLoading, userLocation }) {
  const [activeTab, setActiveTab]         = useState("safest");
  const [directionsOpen, setDirectionsOpen] = useState(false);
  const [stepsMap, setStepsMap]           = useState({});   // routeId → steps[]
  const [loadingSteps, setLoadingSteps]   = useState({});   // routeId → bool
  const [currentStepIdx, setCurrentStepIdx] = useState(0);
  const stepRefs = useRef({});

  const byType = useMemo(() => {
    const find = (t) => routes.find((r) => r.type === t);
    const safest = find("safest") || routes[0];
    const alternative = find("alternative");
    return { safest, alternative };
  }, [routes]);

  // If only one route, always show safest tab
  const availableTabs = useMemo(() => {
    const tabs = [["safest", ROUTE_TAB.safest]];
    if (byType.alternative) tabs.push(["alternative", ROUTE_TAB.alternative]);
    return tabs;
  }, [byType]);

  const current = byType[activeTab] || byType.safest;

  // Fetch steps whenever a route becomes active and we don't have them yet
  useEffect(() => {
    if (!current?.id || stepsMap[current.id] || loadingSteps[current.id]) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSteps(prev => ({ ...prev, [current.id]: true }));
    fetchStepsForRoute(current).then(steps => {
      setStepsMap(prev => ({ ...prev, [current.id]: steps }));
      setLoadingSteps(prev => ({ ...prev, [current.id]: false }));
      setCurrentStepIdx(0);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.id]);

  // Real-time: advance step based on user location proximity
  useEffect(() => {
    if (!userLocation || !current?.id) return;
    const steps = stepsMap[current.id];
    if (!steps?.length) return;
    const { lat, lng } = userLocation;
    let closest = 0;
    let minDist = Infinity;
    steps.forEach((step, i) => {
      if (!step.location) return;
      const [sLng, sLat] = step.location;
      const d = Math.hypot(lat - sLat, lng - sLng);
      if (d < minDist) { minDist = d; closest = i; }
    });
    // Only advance, never go back
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setCurrentStepIdx(prev => Math.max(prev, closest));
  }, [userLocation, current?.id, stepsMap]);

  // Scroll active step into view
  useEffect(() => {
    const key = `${current?.id}-${currentStepIdx}`;
    stepRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [currentStepIdx, current?.id]);

  const handleTab = (tab) => {
    setActiveTab(tab);
    setCurrentStepIdx(0);
    const r = byType[tab];
    if (r) onRouteSelect?.(r.id);
  };

  if (isLoading) {
    return (
      <div style={{
        borderTop: "1px solid rgba(255,255,255,0.05)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px",
        background: "rgba(0,0,0,0.25)",
      }}>
        <div style={{
          width: "14px", height: "14px", borderRadius: "50%",
          border: "2px solid rgba(56,189,248,0.2)", borderTopColor: "rgba(56,189,248,0.8)",
          animation: "spin 0.8s linear infinite", flexShrink: 0,
        }} />
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)" }}>Computing safe routes…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!routes || routes.length === 0) return null;

  const scoreColor = current ? getRiskColor(current.safety_score) : "#64748b";
  const riskColor  = current ? getRiskColorsByLevel(current.risk_level).accent : "#64748b";
  const steps      = current?.id ? (stepsMap[current.id] || []) : [];
  const isLoadingSteps = current?.id ? !!loadingSteps[current.id] : false;

  return (
    <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "rgba(0,0,0,0.25)" }}>
      {/* ── Route bar ── */}
      <div style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        {/* Tabs */}
        <div style={{ display: "flex", gap: "5px", flexShrink: 0 }}>
          {availableTabs.map(([key, cfg]) => {
            const r = byType[key];
            const isActive = activeTab === key;
            return (
              <button key={key} onClick={() => handleTab(key)} style={{
                display: "flex", alignItems: "center", gap: "5px",
                padding: "5px 10px", borderRadius: "8px", cursor: "pointer",
                background: isActive ? cfg.bg : "rgba(255,255,255,0.04)",
                border: `1px solid ${isActive ? cfg.border : "rgba(255,255,255,0.07)"}`,
                color: isActive ? cfg.color : "rgba(255,255,255,0.4)",
                fontSize: "11px", fontWeight: isActive ? 600 : 400, transition: "all 0.15s ease",
              }}>
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
                {r && (
                  <span style={{ fontSize: "10px", fontWeight: 700, color: isActive ? getRiskColor(r.safety_score) : "rgba(255,255,255,0.3)" }}>
                    {r.safety_score?.toFixed ? r.safety_score.toFixed(1) : r.safety_score}
                    <span style={{ fontSize: "8px", fontWeight: 400, opacity: 0.7 }}> risk</span>
                  </span>
                )}
              </button>
            );
          })}
          {availableTabs.length === 1 && (
            <span style={{
              fontSize: "10px", color: "rgba(255,255,255,0.25)",
              padding: "5px 8px", alignSelf: "center",
            }}>Only one route available for this trip</span>
          )}
        </div>

        <div style={{ width: "1px", height: "28px", background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

        {current && (
          <>
            <div style={{
              width: "36px", height: "36px", borderRadius: "50%", flexShrink: 0,
              border: `2px solid ${scoreColor}`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              background: `${scoreColor}15`,
            }}>
              <span style={{ fontSize: "11px", fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
                {current.safety_score?.toFixed ? current.safety_score.toFixed(1) : current.safety_score}
              </span>
              <span style={{ fontSize: "7px", color: "rgba(255,255,255,0.3)", lineHeight: 1 }}>risk/10</span>
            </div>

            <div style={{ display: "flex", gap: "14px", flex: 1, minWidth: 0 }}>
              {[
                { label: "RISK",     val: current.risk_level?.toUpperCase() || "—", color: riskColor },
                { label: "DISTANCE", val: `${(current.distance / 1000).toFixed(1)} km`, color: "rgba(255,255,255,0.75)" },
                { label: "DURATION", val: `${Math.round(current.duration / 60)} min`,   color: "rgba(255,255,255,0.75)" },
              ].map(({ label, val, color }) => (
                <div key={label}>
                  <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.3)", marginBottom: "1px" }}>{label}</p>
                  <p style={{ fontSize: "11px", fontWeight: 600, color }}>{val}</p>
                </div>
              ))}
            </div>

            <div style={{ width: "80px", flexShrink: 0 }}>
              <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                <div style={{
                  height: "100%", borderRadius: "2px",
                  width: `${((current.safety_score - 1) / 9) * 100}%`,
                  background: scoreColor, boxShadow: `0 0 4px ${scoreColor}80`,
                  transition: "width 0.4s ease",
                }} />
              </div>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", marginTop: "3px", textAlign: "right" }}>Risk score</p>
            </div>

            <button onClick={() => onRouteSelect?.(current.id)} style={{
              padding: "5px 12px", borderRadius: "8px", cursor: "pointer", flexShrink: 0,
              background: selectedRouteId === current.id ? "rgba(56,189,248,0.18)" : "rgba(56,189,248,0.07)",
              border: `1px solid ${selectedRouteId === current.id ? "rgba(56,189,248,0.4)" : "rgba(56,189,248,0.15)"}`,
              color: selectedRouteId === current.id ? "#7dd3fc" : "rgba(125,211,252,0.6)",
              fontSize: "11px", fontWeight: 500, transition: "all 0.15s ease",
            }}>
              {selectedRouteId === current.id ? "✓ Selected" : "Select"}
            </button>
          </>
        )}
      </div>

      {/* ── Directions toggle ── */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
        <button
          onClick={() => {
            setDirectionsOpen(v => !v);
            // Trigger step fetch if not yet loaded
            if (!directionsOpen && current?.id && !stepsMap[current.id] && !loadingSteps[current.id]) {
              setLoadingSteps(prev => ({ ...prev, [current.id]: true }));
              fetchStepsForRoute(current).then(steps => {
                setStepsMap(prev => ({ ...prev, [current.id]: steps }));
                setLoadingSteps(prev => ({ ...prev, [current.id]: false }));
              });
            }
          }}
          style={{
            width: "100%", padding: "8px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "transparent", border: "none", cursor: "pointer",
            color: "rgba(255,255,255,0.5)", fontSize: "11px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>🗺️</span>
            <span style={{ fontWeight: 500 }}>
              Directions
              {steps.length > 0 && (
                <span style={{ marginLeft: "6px", fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>
                  ({steps.length} steps)
                </span>
              )}
            </span>
            {userLocation && steps.length > 0 && (
              <span style={{
                fontSize: "9px", padding: "1px 6px", borderRadius: "4px",
                background: "rgba(34,197,94,0.15)", color: "#86efac", fontWeight: 600,
              }}>LIVE</span>
            )}
          </div>
          <span style={{ fontSize: "10px", transition: "transform 0.2s", transform: directionsOpen ? "rotate(180deg)" : "none" }}>▼</span>
        </button>

        {directionsOpen && (
          <div style={{ maxHeight: "260px", overflowY: "auto", padding: "4px 8px 8px" }}>
            {isLoadingSteps ? (
              <div style={{ padding: "16px", textAlign: "center" }}>
                <div style={{
                  display: "inline-block", width: "16px", height: "16px", borderRadius: "50%",
                  border: "2px solid rgba(56,189,248,0.25)", borderTopColor: "rgba(56,189,248,0.85)",
                  animation: "spin 0.8s linear infinite",
                }} />
                <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", marginTop: "8px" }}>Loading directions…</p>
              </div>
            ) : steps.length === 0 ? (
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", padding: "12px", textAlign: "center" }}>
                No directions available
              </p>
            ) : (
              steps.map((step, idx) => {
                const isActive = idx === currentStepIdx;
                const isFirst  = idx === 0;
                const isLast   = idx === steps.length - 1;
                const refKey   = `${current.id}-${idx}`;
                return (
                  <div
                    key={idx}
                    ref={el => stepRefs.current[refKey] = el}
                    onClick={() => setCurrentStepIdx(idx)}
                    style={{
                      display: "flex", alignItems: "flex-start", gap: "10px",
                      padding: "8px 10px", borderRadius: "10px", cursor: "pointer",
                      marginBottom: "2px",
                      background: isActive ? "rgba(56,189,248,0.1)" : "transparent",
                      border: isActive ? "1px solid rgba(56,189,248,0.25)" : "1px solid transparent",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {/* Step icon */}
                    <div style={{
                      width: "26px", height: "26px", borderRadius: "8px", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px",
                      background: isFirst ? "rgba(34,197,94,0.2)" : isLast ? "rgba(239,68,68,0.2)" : isActive ? "rgba(56,189,248,0.2)" : "rgba(255,255,255,0.06)",
                      border: isFirst ? "1px solid rgba(34,197,94,0.4)" : isLast ? "1px solid rgba(239,68,68,0.4)" : isActive ? "1px solid rgba(56,189,248,0.35)" : "1px solid rgba(255,255,255,0.08)",
                    }}>
                      {stepIcon(step.text)}
                    </div>

                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontSize: "11px", lineHeight: 1.4,
                        color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.65)",
                        fontWeight: isActive ? 600 : 400,
                      }}>{step.text}</p>
                      <p style={{ fontSize: "10px", color: isActive ? "rgba(125,211,252,0.8)" : "rgba(255,255,255,0.3)", marginTop: "2px" }}>
                        {fmtDist(step.distance)}
                      </p>
                    </div>

                    {/* Live indicator */}
                    {isActive && userLocation && (
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", flexShrink: 0, alignSelf: "center" }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── GlassMapCard (unchanged) ─────────────────────────────────────────────
function GlassMapCard({ onRiskUpdate, onClickedRiskUpdate, mapRef, onHospitalsChange, safeRoutes = [], selectedRouteId, onRouteSelect, isLoadingRoutes = false, userLocation }) {
  const [routeFrom, setRouteFrom]             = useState("");
  const [routeTo, setRouteTo]                 = useState("");
  const [routeFromCoords, setRouteFromCoords] = useState(null);
  const [routeToCoords, setRouteToCoords]     = useState(null);
  const [routeLoading, setRouteLoading]       = useState(false);
  const [pickingFor, setPickingFor]           = useState(null);
  const [routeDirections, setRouteDirections] = useState([]);
  const [activeStep, setActiveStep]           = useState(null);
  const [routeSummary, setRouteSummary]       = useState(null);
  const [directionsOpen, setDirectionsOpen]   = useState(false);
  const stepRefs  = useRef([]);
  const crimeMapRef = mapRef;

  useEffect(() => {
    if (routeDirections.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDirectionsOpen(true);
      setActiveStep(0);
      const totalDist = routeDirections.reduce((sum, s) => sum + (s.distance || 0), 0);
      const mins = Math.round(totalDist / 11 / 60);
      setRouteSummary({
        dist: totalDist >= 1000 ? `${(totalDist / 1000).toFixed(1)} km` : `${Math.round(totalDist)} m`,
        time: mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins} min`,
      });
    } else {
      setDirectionsOpen(false);
      setActiveStep(null);
      setRouteSummary(null);
    }
  }, [routeDirections]);

  useEffect(() => {
    if (activeStep !== null && stepRefs.current[activeStep]) {
      stepRefs.current[activeStep].scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeStep]);

  const handleSwap = () => {
    setRouteFrom(routeTo); setRouteTo(routeFrom);
    setRouteFromCoords(routeToCoords); setRouteToCoords(routeFromCoords);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!routeFrom || !routeTo) return;
    setPickingFor(null);
    setRouteLoading(true);
    setActiveStep(null);
    await crimeMapRef.current?.triggerRoute(routeFromCoords || routeFrom, routeToCoords || routeTo, true);
    setRouteLoading(false);
  };

  const handleClear = () => {
    setRouteFrom(""); setRouteTo("");
    setRouteFromCoords(null); setRouteToCoords(null);
    setPickingFor(null);
    setRouteDirections([]);
    setActiveStep(null);
    setRouteSummary(null);
    setDirectionsOpen(false);
    crimeMapRef.current?.clearRoute();
  };

  const handleRoutePick = (coords) => {
    if (pickingFor === "from") { setRouteFrom(coords.name); setRouteFromCoords(coords); }
    if (pickingFor === "to")   { setRouteTo(coords.name);   setRouteToCoords(coords); }
    setPickingFor(null);
  };

  const handleStepClick = (index) => {
    setActiveStep(index);
    crimeMapRef.current?.focusStep?.(index);
  };

  const pinBtnStyle = (field) => ({
    width: "28px", height: "28px", fontSize: "11px", flexShrink: 0,
    background: pickingFor === field ? "rgba(56,189,248,0.2)" : "rgba(56,189,248,0.06)",
    border: pickingFor === field ? "1px solid rgba(56,189,248,0.45)" : "1px solid rgba(56,189,248,0.15)",
    color: pickingFor === field ? "rgba(125,211,252,1)" : "rgba(125,211,252,0.45)",
    boxShadow: pickingFor === field ? "0 0 10px rgba(56,189,248,0.2)" : "none",
    borderRadius: "10px", transition: "all 0.18s ease", cursor: "pointer",
  });

  return (
    <div className="card-enter-2 rounded-2xl overflow-hidden flex flex-col voyageour-panel"
      style={{
        boxShadow: "0 32px 64px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.05)",
        position: "relative",
      }}>
      {/* Top accent line */}
      <div style={{ position: "absolute", top: 0, left: "10%", right: "10%", height: "1px", background: "linear-gradient(90deg, transparent, rgba(56,189,248,0.4), rgba(99,102,241,0.3), transparent)", zIndex: 1 }} />

      <div className="px-5 py-4 flex flex-col gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "11px", color: "rgba(56,189,248,0.7)" }}>◈</span>
            <div>
              <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.82)" }}>Live Map</p>
              <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.28)" }}>Crime risk · Hospitals · Routes</p>
            </div>
          </div>
          {routeSummary && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
              style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.2)", color: "rgba(125,211,252,0.9)" }}>
              <span>🕐 {routeSummary.time}</span>
              <span style={{ color: "rgba(255,255,255,0.18)" }}>·</span>
              <span>📍 {routeSummary.dist}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          {/* ── From / To inputs — identical width ── */}
          <div className="flex flex-col gap-1.5 flex-1" style={{ position: "relative", minWidth: 0 }}>
            {/* Connector line */}
            <div style={{
              position: "absolute", left: "13px", top: "34px", bottom: "34px", width: "1.5px",
              background: "linear-gradient(to bottom, rgba(34,197,94,0.5), rgba(239,68,68,0.5))",
              zIndex: 1, borderRadius: "2px",
            }} />

            {/* FROM row */}
            <div className="flex gap-1.5 items-center">
              <div style={{ width: "26px", height: "26px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 7px rgba(34,197,94,0.7)" }} />
              </div>
              <input value={routeFrom} onChange={(e) => { setRouteFrom(e.target.value); setRouteFromCoords(null); }}
                placeholder={pickingFor === "from" ? "Click on map…" : "From — origin"}
                className="glass-input flex-1 px-3 py-2 rounded-xl text-xs"
                style={{ background: pickingFor === "from" ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.04)", border: pickingFor === "from" ? "1px solid rgba(56,189,248,0.3)" : "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.82)", minWidth: 0 }} />
              <button type="button" title="Use current location"
                onClick={() => { setRouteFrom("Current Location"); setPickingFor(null); }}
                className="ctrl-btn flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ width: "28px", height: "28px", fontSize: "10px", background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", color: "rgba(134,239,172,0.8)", cursor: "pointer" }}>⊙</button>
              <button type="button" title="Pick on map"
                onClick={() => setPickingFor((p) => p === "from" ? null : "from")}
                style={{ ...pinBtnStyle("from"), width: "28px", height: "28px" }}>◎</button>
            </div>

            {/* TO row */}
            <div className="flex gap-1.5 items-center">
              <div style={{ width: "26px", height: "26px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                <div style={{ width: "9px", height: "9px", borderRadius: "50%", background: "#f97316", boxShadow: "0 0 7px rgba(249,115,22,0.7)" }} />
              </div>
              <input value={routeTo} onChange={(e) => { setRouteTo(e.target.value); setRouteToCoords(null); }}
                placeholder={pickingFor === "to" ? "Click on map…" : "To — destination"}
                className="glass-input flex-1 px-3 py-2 rounded-xl text-xs"
                style={{ background: pickingFor === "to" ? "rgba(56,189,248,0.06)" : "rgba(255,255,255,0.04)", border: pickingFor === "to" ? "1px solid rgba(56,189,248,0.3)" : "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.82)", minWidth: 0 }} />
              <button type="button" title="Pick on map"
                onClick={() => setPickingFor((p) => p === "to" ? null : "to")}
                style={{ ...pinBtnStyle("to"), width: "28px", height: "28px" }}>◎</button>
              <button type="button" disabled
                className="flex items-center justify-center rounded-xl flex-shrink-0"
                style={{ width: "28px", height: "28px", opacity: 0, pointerEvents: "none" }}></button>
            </div>
          </div>

          {/* Swap + action buttons */}
          <div className="flex flex-col gap-1.5 flex-shrink-0 items-center">
            <button type="button" onClick={handleSwap}
              className="ctrl-btn flex items-center justify-center rounded-xl"
              style={{ width: "28px", height: "28px", fontSize: "12px", background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", color: "rgba(125,211,252,0.8)", cursor: "pointer" }}>⇄</button>
            <button type="submit" disabled={routeLoading}
              className="ctrl-btn px-3 py-2 rounded-xl text-xs font-semibold"
              style={{ background: routeLoading ? "rgba(56,189,248,0.12)" : "linear-gradient(135deg, rgba(56,189,248,0.6), rgba(99,102,241,0.55))", border: "1px solid rgba(56,189,248,0.22)", color: "#fff", opacity: routeLoading ? 0.7 : 1, cursor: "pointer", whiteSpace: "nowrap" }}>
              {routeLoading ? "…" : "Go"}
            </button>
            <button type="button" onClick={handleClear}
              className="ctrl-btn px-3 py-1.5 rounded-xl text-xs"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", color: "rgba(255,255,255,0.3)", cursor: "pointer" }}>Clear</button>
          </div>
        </form>

        {pickingFor && (
          <div className="anim-fade-in flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: "rgba(56,189,248,0.07)", border: "1px solid rgba(56,189,248,0.2)", color: "rgba(125,211,252,0.9)" }}>
            <span style={{ fontSize: "14px" }}>◎</span>
            Click anywhere on the map to set the{" "}
            <strong style={{ color: "#7dd3fc" }}>{pickingFor === "from" ? "starting point" : "destination"}</strong>
            <button type="button" onClick={() => setPickingFor(null)} className="ml-auto text-xs" style={{ color: "rgba(125,211,252,0.45)", cursor: "pointer" }}>cancel</button>
          </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: directionsOpen ? "320px" : "400px", transition: "min-height 0.35s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0, display: "flex", flexDirection: "column" }}>
        <CrimeMap
          ref={crimeMapRef}
          embedded
          pickingFor={pickingFor}
          onRoutePick={handleRoutePick}
          onRouteDirections={setRouteDirections}
          onRiskUpdate={onRiskUpdate}
          onClickedRiskUpdate={onClickedRiskUpdate}
          onHospitalsChange={onHospitalsChange}
        />
      </div>

      {/* ── Route Safety Bar (below map) ── */}
      {(safeRoutes.length > 0 || isLoadingRoutes) && (
        <RouteSafetyBar
          routes={safeRoutes}
          selectedRouteId={selectedRouteId}
          onRouteSelect={onRouteSelect}
          isLoading={isLoadingRoutes}
          userLocation={userLocation}
        />
      )}

      {directionsOpen && routeDirections.length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.07)", background: "rgba(0,0,0,0.25)", maxHeight: "260px", display: "flex", flexDirection: "column" }}>
          <div className="flex items-center justify-between px-4 py-2.5"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 }}>
            <div className="flex items-center gap-2">
              <span style={{ fontSize: "13px" }}>🗺️</span>
              <span className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.8)" }}>Turn-by-Turn Directions</span>
              <span className="text-xs px-2 py-0.5 rounded-full"
                style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.18)", color: "rgba(125,211,252,0.8)" }}>
                {routeDirections.length} steps
              </span>
            </div>
            <button onClick={() => setDirectionsOpen(false)}
              className="text-xs flex items-center justify-center rounded-lg"
              style={{ width: "22px", height: "22px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>✕</button>
          </div>

          <div className="overflow-y-auto flex-1" style={{ padding: "6px 8px" }}>
            {routeDirections.map((step, index) => {
              const isActive = activeStep === index;
              const isFirst  = index === 0;
              const isLast   = index === routeDirections.length - 1;
              const icon     = getStepIcon(step.text);
              const distLabel = step.distance >= 1000 ? `${(step.distance / 1000).toFixed(1)} km` : `${Math.round(step.distance)} m`;

              return (
                <div key={index} ref={(el) => (stepRefs.current[index] = el)}
                  onClick={() => handleStepClick(index)}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-xl cursor-pointer"
                  style={{
                    background: isActive ? "rgba(56,189,248,0.1)" : "transparent",
                    border: isActive ? "1px solid rgba(56,189,248,0.25)" : "1px solid transparent",
                    boxShadow: isActive ? "0 0 12px rgba(56,189,248,0.1)" : "none",
                    transition: "all 0.18s ease", marginBottom: "2px",
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.border = "1px solid rgba(255,255,255,0.07)"; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.border = "1px solid transparent"; } }}>

                  <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ paddingTop: "1px" }}>
                    <div className="flex items-center justify-center rounded-lg text-sm font-bold"
                      style={{
                        width: "28px", height: "28px",
                        background: isFirst ? "rgba(34,197,94,0.2)" : isLast ? "rgba(239,68,68,0.2)" : isActive ? "rgba(56,189,248,0.25)" : "rgba(255,255,255,0.07)",
                        border: isFirst ? "1px solid rgba(34,197,94,0.4)" : isLast ? "1px solid rgba(239,68,68,0.4)" : isActive ? "1px solid rgba(56,189,248,0.35)" : "1px solid rgba(255,255,255,0.1)",
                        color: isFirst ? "#4ade80" : isLast ? "#f87171" : isActive ? "#7dd3fc" : "rgba(255,255,255,0.5)",
                        fontSize: "13px",
                      }}>{icon}</div>
                    {!isLast && (
                      <div style={{ width: "2px", height: "14px", background: isActive ? "rgba(56,189,248,0.4)" : "rgba(255,255,255,0.08)", borderRadius: "2px" }} />
                    )}
                  </div>

                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <p className="text-xs leading-snug"
                      style={{ color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.7)", fontWeight: isActive ? "600" : "400" }}>
                      {step.text}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: isActive ? "rgba(125,211,252,0.8)" : "rgba(255,255,255,0.3)" }}>
                      {distLabel}
                    </p>
                  </div>

                  {isActive && (
                    <div className="flex-shrink-0 self-center">
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#7dd3fc", boxShadow: "0 0 6px rgba(125,211,252,0.8)" }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!directionsOpen && routeDirections.length > 0 && (
        <div className="px-5 py-2.5" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
          <button onClick={() => setDirectionsOpen(true)}
            className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2"
            style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", color: "rgba(125,211,252,0.85)" }}>
            ↑ Show Directions ({routeDirections.length} steps)
          </button>
        </div>
      )}
    </div>
  );
}

// ─── RiskPanel ────────────────────────────────────────────────────────────
function RiskPanel({ liveRisk, clickedRisk, mapRef, hospitalsFor, onClearSelection }) {
  const [showModal, setShowModal] = useState(false);
  const handleClearConfirm = () => { setShowModal(false); mapRef.current?.clearAll(); onClearSelection(); };
  return (
    <>
      <RiskCard title="Your Location" risk={liveRisk} delay="card-enter-2"
        onFocus={() => mapRef.current?.focusMap("live")}
        onHospitals={() => mapRef.current?.showHospitalsFor("live")}
        hospitalsActive={hospitalsFor === "live"} />
      {clickedRisk !== null && (
        <RiskCard title="Selected Location" risk={clickedRisk} delay="card-enter-3"
          onFocus={() => mapRef.current?.focusMap("selected")}
          onHospitals={() => mapRef.current?.showHospitalsFor("selected")}
          onClear={() => setShowModal(true)}
          hospitalsActive={hospitalsFor === "selected"} />
      )}
      {showModal && <ClearModal onCancel={() => setShowModal(false)} onConfirm={handleClearConfirm} />}
    </>
  );
}

// ─── ClearModal ───────────────────────────────────────────────────────────
function ClearModal({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ zIndex: 99999, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onCancel}>
      <div className="anim-fade-up rounded-2xl p-6"
        style={{ width: "290px", background: "rgba(5,8,20,0.97)", backdropFilter: "blur(32px) saturate(180%)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 32px 64px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.05)" }}
        onClick={(e) => e.stopPropagation()}>
        <p className="text-sm font-semibold mb-1.5" style={{ color: "rgba(255,255,255,0.9)" }}>Clear selected location?</p>
        <p className="text-xs mb-5" style={{ color: "rgba(255,255,255,0.38)", lineHeight: 1.7 }}>
          This will remove:<br />· Selected location marker<br />· Hospitals on map<br />· Any active routes
        </p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-xs font-medium"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.5)" }}>Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl text-xs font-semibold"
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>Clear</button>
        </div>
      </div>
    </div>
  );
}

// ─── RiskCard ─────────────────────────────────────────────────────────────
function RiskCard({ title, risk, delay = "", onFocus, onHospitals, onClear, hospitalsActive }) {
  const level    = risk?.risk_level || "UNKNOWN";
  const colors   = getRiskColorsByLevel(level);
  const district = risk?.detected_district || risk?.district;
  const state    = risk?.detected_state    || risk?.state;
  const score    = risk?.risk_score;
  const MAX_RAW  = 3000;
  const score10  = score != null ? Math.min((score / MAX_RAW) * 10, 10).toFixed(1) : null;
  const barPct   = score != null ? Math.min((score / MAX_RAW) * 100, 100) : 0;
  const hasData  = risk && !risk.error;

  return (
    <div className={`${delay} glass-card rounded-2xl p-5 relative overflow-hidden voyageour-panel`}
      style={{ boxShadow: "0 16px 40px rgba(0,0,0,0.4)" }}>
      {/* Top accent line */}
      <div style={{ position: "absolute", top: 0, left: "25%", right: "25%", height: "1px", background: `linear-gradient(90deg, transparent, ${colors.glow}, transparent)` }} />
      <div className="anim-glow absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: "80px", height: "80px", top: "-20px", right: "-20px", background: colors.glow }} />
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10px] font-semibold" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>{title.toUpperCase()}</p>
        {onClear && (
          <button onClick={onClear} title="Clear selection" className="flex items-center justify-center rounded-lg"
            style={{ width: "20px", height: "20px", fontSize: "10px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.18)", color: "rgba(252,165,165,0.55)", transition: "all 0.15s ease" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.color = "#fca5a5"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "rgba(252,165,165,0.55)"; }}>✕</button>
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
            <span className="pulse-ring relative w-2 h-2 rounded-full flex-shrink-0" style={{ background: colors.accent }} />
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
          {hasData && (
            <div className="flex gap-2">
              <button onClick={onFocus} className="ctrl-btn flex-1 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: "rgba(56,189,248,0.08)", border: "1px solid rgba(56,189,248,0.15)", color: "rgba(125,211,252,0.85)" }}>Focus on Map</button>
              <button onClick={onHospitals} className="ctrl-btn flex-1 py-1.5 rounded-xl text-xs font-medium"
                style={{ background: hospitalsActive ? "rgba(22,163,74,0.25)" : "rgba(34,197,94,0.08)", border: hospitalsActive ? "1px solid rgba(22,163,74,0.5)" : "1px solid rgba(34,197,94,0.18)", color: hospitalsActive ? "#4ade80" : "rgba(134,239,172,0.55)", transition: "all 0.2s ease" }}>
                {hospitalsActive ? "Hide Hospitals" : "Show Hospitals"}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
