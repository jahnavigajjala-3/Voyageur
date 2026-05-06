import { useContext, useRef, useState, useEffect, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import { useRouteContext } from "../context/RouteContext";
import CrimeMap from "../components/CrimeMap";
import { useNavigate } from "react-router-dom";
import { sendChatMessage, createTrip, getWeather } from "../api/api";
import useLocation from "../hooks/useLocation";

const NAV_ITEMS = [
  { icon: "⊞", label: "Home",    path: "/dashboard" },
  { icon: "✦", label: "AI Chat", path: "/chat" },
];

const RISK_COLORS = {
  HIGH:    { bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.25)",   text: "#fca5a5", accent: "#ef4444", glow: "rgba(239,68,68,0.3)" },
  MEDIUM:  { bg: "rgba(234,179,8,0.1)",   border: "rgba(234,179,8,0.25)",   text: "#fde68a", accent: "#eab308", glow: "rgba(234,179,8,0.3)" },
  LOW:     { bg: "rgba(34,197,94,0.1)",   border: "rgba(34,197,94,0.25)",   text: "#86efac", accent: "#22c55e", glow: "rgba(34,197,94,0.3)" },
  UNKNOWN: { bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.25)", text: "#94a3b8", accent: "#64748b", glow: "rgba(100,116,139,0.2)" },
};

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
  const { user, logout } = useContext(AuthContext);
  const {
    routes: safeRoutes,
    selectedRouteId,
    isLoadingRoutes,
    routeHistory,
    setSelectedRouteId,
    clearHistory
  } = useRouteContext();
  const navigate = useNavigate();
  const { location } = useLocation(); // ← needed for weather

  const [activeNav, setActiveNav]       = useState("Home");
  const [liveRisk, setLiveRisk]         = useState(null);
  const [clickedRisk, setClickedRisk]   = useState(null);
  const [chatOpen, setChatOpen]         = useState(false);
  const [hospitalsFor, setHospitalsFor] = useState(null);
  const [showRouteHistory, setShowRouteHistory] = useState(false);

  // ─── Weather state ────────────────────────────────────────────────────────
  const [weather, setWeather]               = useState(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  // ─────────────────────────────────────────────────────────────────────────

  const mapRef = useRef(null);

  const handleLogout = () => { logout(); navigate("/login"); };
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
        background: "radial-gradient(ellipse at 20% 50%, rgba(88,28,135,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(30,58,138,0.08) 0%, transparent 60%), #05050f",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}>

      {/* ── SIDEBAR ── */}
      <aside className="flex flex-col items-center py-8 px-3 gap-5"
        style={{
          width: "68px", background: "rgba(255,255,255,0.025)", backdropFilter: "blur(24px)",
          borderRight: "1px solid rgba(255,255,255,0.06)", minHeight: "100vh",
          position: "sticky", top: 0, zIndex: 10,
        }}>
        <nav className="flex flex-col gap-2 flex-1">
          {NAV_ITEMS.map((item) => (
            <button key={item.label}
              onClick={() => { setActiveNav(item.label); if (item.path !== "#") navigate(item.path); }}
              title={item.label}
              className="nav-btn flex items-center justify-center rounded-xl"
              style={{
                width: "42px", height: "42px", fontSize: "15px",
                background: activeNav === item.label ? "rgba(139,92,246,0.18)" : "transparent",
                border: activeNav === item.label ? "1px solid rgba(139,92,246,0.35)" : "1px solid transparent",
                color: activeNav === item.label ? "rgba(167,139,250,1)" : "rgba(255,255,255,0.35)",
                boxShadow: activeNav === item.label ? "0 0 12px rgba(139,92,246,0.2)" : "none",
              }}>{item.icon}</button>
          ))}
        </nav>
        <button onClick={handleLogout} title="Logout"
          className="nav-btn flex items-center justify-center rounded-xl"
          style={{ width: "42px", height: "42px", fontSize: "13px", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "rgba(252,165,165,0.6)" }}>⏻</button>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>

        {/* ── HEADER (greeting + weather badge) ── */}
        <header className="flex items-center justify-between px-8 py-5"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>

          <div className="card-enter-1">
            <h1 className="text-2xl font-bold"
              style={{ background: "linear-gradient(90deg, #e2e8f0 0%, #a5b4fc 50%, #818cf8 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Voyageur
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              {user?.name ? `Welcome back, ${user.name}` : "Your AI travel companion is ready"}
            </p>
          </div>

        </header>

        <div className="flex flex-1 gap-5 p-6 overflow-auto">
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
          <aside className="flex flex-col gap-4" style={{ width: "255px", flexShrink: 0 }}>
            {/* Weather card in right sidebar */}
            {weather && (
              <div className="rounded-2xl p-4 relative overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.03)", backdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                }}>
                <p className="text-xs font-medium mb-3" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>WEATHER</p>
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: "28px" }}>{getWeatherIcon(weather.weathercode)}</span>
                  <div>
                    <p className="text-xl font-bold" style={{ color: "rgba(255,255,255,0.9)" }}>{weather.temperature}°C</p>
                    <p className="text-xs" style={{ color: "rgba(255,255,255,0.4)" }}>{getWeatherLabel(weather.weathercode)}</p>
                  </div>
                </div>
                <div className="flex gap-3 mt-3">
                  <div className="flex-1 px-2 py-1.5 rounded-lg text-center"
                    style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}>
                    <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>Wind</p>
                    <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.7)" }}>{weather.windspeed} km/h</p>
                  </div>
                  {/* add more weather fields here if your API returns them */}
                </div>
              </div>
            )}

            {/* Route History Panel */}
            {routeHistory.length > 0 && (
              <div className="rounded-2xl p-4 relative overflow-hidden"
                style={{
                  background: "rgba(255,255,255,0.03)", backdropFilter: "blur(24px)",
                  border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
                }}>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>RECENT ROUTES</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowRouteHistory(!showRouteHistory)}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.2)",
                        color: "rgba(167,139,250,0.8)"
                      }}
                    >
                      {showRouteHistory ? "Hide" : "Show"}
                    </button>
                    <button
                      onClick={clearHistory}
                      className="text-xs px-2 py-1 rounded-lg"
                      style={{
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.2)",
                        color: "rgba(252,165,165,0.8)"
                      }}
                      title="Clear history"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                
                {showRouteHistory && (
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {routeHistory.slice(0, 5).map((historyItem, index) => (
                      <div
                        key={historyItem.id}
                        className="p-3 rounded-xl cursor-pointer hover:bg-white/5 transition-colors"
                        style={{
                          background: "rgba(255,255,255,0.02)",
                          border: "1px solid rgba(255,255,255,0.05)"
                        }}
                        onClick={() => {
                          // Re-run this route
                          if (mapRef.current) {
                            mapRef.current.triggerRoute(
                              historyItem.origin,
                              historyItem.destination,
                              true // use safe routes
                            );
                          }
                        }}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.7)" }}>
                            Route {index + 1}
                          </span>
                          <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                            {new Date(historyItem.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-xs" style={{ color: "rgba(255,255,255,0.5)" }}>
                          <div className="truncate">
                            <span style={{ color: "#22c55e" }}>●</span> {historyItem.origin.lat.toFixed(4)}, {historyItem.origin.lng.toFixed(4)}
                          </div>
                          <div className="truncate">
                            <span style={{ color: "#ef4444" }}>●</span> {historyItem.destination.lat.toFixed(4)}, {historyItem.destination.lng.toFixed(4)}
                          </div>
                        </div>
                        {historyItem.routes && historyItem.routes.length > 0 && (
                          <div className="mt-2 flex items-center gap-1">
                            <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Best:</span>
                            <span className="text-xs font-medium" style={{ 
                              color: historyItem.routes[0].type === 'safest' ? '#22c55e' : 
                                     historyItem.routes[0].type === 'fastest' ? '#3b82f6' : '#64748b'
                            }}>
                              {historyItem.routes[0].type.toUpperCase()}
                            </span>
                            <span className="text-xs ml-auto" style={{ color: "rgba(255,255,255,0.3)" }}>
                              {Math.round(historyItem.routes[0].safety_score)}/100
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                
                {!showRouteHistory && routeHistory.length > 0 && (
                  <div className="text-center py-2">
                    <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>
                      {routeHistory.length} saved route{routeHistory.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                )}
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
function FloatingChat({ open, onToggle, weather, safeRoutes = [], selectedRouteId = null, liveRisk = null }) {
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
            background: "rgba(8,8,20,0.92)", backdropFilter: "blur(32px)",
            border: "1px solid rgba(139,92,246,0.2)", borderRadius: "20px",
            boxShadow: "0 30px 80px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
            overflow: "hidden",
          }}>
          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
            <div className="flex items-center gap-2.5">
              <div className="anim-float flex items-center justify-center rounded-xl text-xs font-bold"
                style={{ width: "30px", height: "30px", background: "linear-gradient(135deg, rgba(139,92,246,0.7), rgba(59,130,246,0.7))", boxShadow: "0 0 12px rgba(139,92,246,0.3)", color: "#fff" }}>AI</div>
              <div>
                <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>AI Assistant</p>
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: "#22c55e", boxShadow: "0 0 4px #22c55e" }} />
                  <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Online</span>
                </div>
              </div>
            </div>
            <button onClick={onToggle}
              className="flex items-center justify-center rounded-lg"
              style={{ width: "26px", height: "26px", fontSize: "12px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.4)" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.12)"; e.currentTarget.style.color = "#fca5a5"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.4)"; }}>✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3"
            style={{ background: "radial-gradient(ellipse at top, rgba(139,92,246,0.04) 0%, transparent 60%)" }}>
            {messages.map((msg, i) => (
              <div key={i} className="anim-fade-in flex" style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div className="text-xs leading-relaxed whitespace-pre-wrap"
                  style={{
                    maxWidth: "82%", padding: "10px 13px",
                    borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                    background: msg.role === "user" ? "linear-gradient(135deg, rgba(139,92,246,0.25), rgba(59,130,246,0.2))" : "rgba(255,255,255,0.05)",
                    border: msg.role === "user" ? "1px solid rgba(139,92,246,0.25)" : "1px solid rgba(255,255,255,0.07)",
                    color: msg.role === "user" ? "rgba(221,214,254,0.95)" : "rgba(255,255,255,0.75)",
                  }}>{msg.content}</div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {[0,1,2].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "rgba(167,139,250,0.6)", animation: `pulse-dot 1.2s ease-in-out ${d * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-3 flex-shrink-0 flex gap-2" style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}>
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Ask anything..." className="glass-input flex-1 px-3 py-2 rounded-xl text-xs"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.85)" }} />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              className="ctrl-btn flex items-center justify-center rounded-xl flex-shrink-0"
              style={{
                width: "34px", height: "34px", fontSize: "14px",
                background: input.trim() && !loading ? "linear-gradient(135deg, rgba(139,92,246,0.7), rgba(59,130,246,0.7))" : "rgba(255,255,255,0.05)",
                border: "1px solid rgba(139,92,246,0.2)",
                color: input.trim() && !loading ? "#fff" : "rgba(255,255,255,0.25)",
                transition: "all 0.2s ease",
              }}>↑</button>
          </div>
        </div>
      )}

      <button onClick={onToggle} className="fixed flex items-center justify-center"
        style={{
          bottom: "24px", right: "24px", width: "54px", height: "54px", zIndex: 9999,
          borderRadius: "50%",
          background: open ? "rgba(139,92,246,0.3)" : "linear-gradient(135deg, rgba(139,92,246,0.85), rgba(59,130,246,0.85))",
          border: "1px solid rgba(139,92,246,0.4)",
          boxShadow: open ? "0 0 0 4px rgba(139,92,246,0.1)" : "0 8px 30px rgba(139,92,246,0.4)",
          color: "#fff", fontSize: open ? "18px" : "20px",
          transition: "all 0.25s cubic-bezier(0.34,1.56,0.64,1)",
          transform: open ? "scale(0.92) rotate(45deg)" : "scale(1) rotate(0deg)",
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

function getScoreColor(s) {
  // 1–10 safety scale: 10 = safest (green), 1 = most dangerous (red)
  if (s >= 7.0) return "#22c55e";
  if (s >= 4.0) return "#eab308";
  return "#ef4444";
}

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
    setLoadingSteps(prev => ({ ...prev, [current.id]: true }));
    fetchStepsForRoute(current).then(steps => {
      setStepsMap(prev => ({ ...prev, [current.id]: steps }));
      setLoadingSteps(prev => ({ ...prev, [current.id]: false }));
      setCurrentStepIdx(0);
    });
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
        borderTop: "1px solid rgba(255,255,255,0.06)",
        padding: "12px 16px", display: "flex", alignItems: "center", gap: "10px",
        background: "rgba(0,0,0,0.2)",
      }}>
        <div style={{
          width: "14px", height: "14px", borderRadius: "50%",
          border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "rgba(139,92,246,0.9)",
          animation: "spin 0.8s linear infinite", flexShrink: 0,
        }} />
        <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.4)" }}>Computing safe routes…</span>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!routes || routes.length === 0) return null;

  const scoreColor = current ? getScoreColor(current.safety_score) : "#64748b";
  const riskColor  = current?.risk_level === "low" ? "#22c55e" : current?.risk_level === "medium" ? "#eab308" : "#ef4444";
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
                  <span style={{ fontSize: "10px", fontWeight: 700, color: isActive ? getScoreColor(r.safety_score) : "rgba(255,255,255,0.3)" }}>
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
              background: selectedRouteId === current.id ? "rgba(139,92,246,0.25)" : "rgba(139,92,246,0.1)",
              border: `1px solid ${selectedRouteId === current.id ? "rgba(139,92,246,0.5)" : "rgba(139,92,246,0.2)"}`,
              color: selectedRouteId === current.id ? "#c4b5fd" : "rgba(167,139,250,0.7)",
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
                  border: "2px solid rgba(139,92,246,0.3)", borderTopColor: "rgba(139,92,246,0.9)",
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
                      background: isActive ? "rgba(139,92,246,0.15)" : "transparent",
                      border: isActive ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {/* Step icon */}
                    <div style={{
                      width: "26px", height: "26px", borderRadius: "8px", flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "13px",
                      background: isFirst ? "rgba(34,197,94,0.2)" : isLast ? "rgba(239,68,68,0.2)" : isActive ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)",
                      border: isFirst ? "1px solid rgba(34,197,94,0.4)" : isLast ? "1px solid rgba(239,68,68,0.4)" : isActive ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.08)",
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
                      <p style={{ fontSize: "10px", color: isActive ? "rgba(167,139,250,0.8)" : "rgba(255,255,255,0.3)", marginTop: "2px" }}>
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
function GlassMapCard({ onRiskUpdate, onClickedRiskUpdate, mapRef, onHospitalsChange, safeRoutes = [], selectedRouteId, onRouteSelect, isLoadingRoutes = false, user, userLocation }) {
  const [routeFrom, setRouteFrom]             = useState("");
  const [routeTo, setRouteTo]                 = useState("");
  const [routeFromCoords, setRouteFromCoords] = useState(null);
  const [routeToCoords, setRouteToCoords]     = useState(null);
  const [startDate, setStartDate]             = useState("");
  const [endDate, setEndDate]                 = useState("");
  const [routeLoading, setRouteLoading]       = useState(false);
  const [pickingFor, setPickingFor]           = useState(null);
  const [routeDirections, setRouteDirections] = useState([]);
  const [activeStep, setActiveStep]           = useState(null);
  const [routeSummary, setRouteSummary]       = useState(null);
  const [directionsOpen, setDirectionsOpen]   = useState(false);
  const [savingTrip, setSavingTrip]           = useState(false);
  const stepRefs  = useRef([]);
  const crimeMapRef = mapRef;

  useEffect(() => {
    if (routeDirections.length > 0) {
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
    setStartDate(""); setEndDate("");
    setRouteFromCoords(null); setRouteToCoords(null);
    setPickingFor(null);
    setRouteDirections([]);
    setActiveStep(null);
    setRouteSummary(null);
    setDirectionsOpen(false);
    crimeMapRef.current?.clearRoute();
  };

  const handleSaveTrip = async () => {
    if (!routeFrom || !routeTo) return;
    setSavingTrip(true);
    try {
      // Build route summary from safe routes if available, else fall back to directions summary
      let dist = routeSummary?.dist || "";
      let time = routeSummary?.time || "";

      if (!dist && safeRoutes?.length > 0) {
        const selected = safeRoutes.find(r => r.id === selectedRouteId) || safeRoutes[0];
        if (selected) {
          dist = `${(selected.distance / 1000).toFixed(1)} km`;
          time = `${Math.round(selected.duration / 60)} min`;
        }
      }

      let planned_route = `Route from ${routeFrom} to ${routeTo}.`;
      if (dist) planned_route += ` Distance: ${dist}, ETA: ${time}.`;
      if (startDate) {
        const [year, month, day] = startDate.split("-");
        planned_route += ` Departure: ${day}/${month}/${year}.`;
      }
      if (endDate) {
        const [year, month, day] = endDate.split("-");
        planned_route += ` Return: ${day}/${month}/${year}.`;
      }

      await createTrip({
        destination: routeTo,
        start_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        end_date:   endDate   ? new Date(endDate).toISOString()   : new Date().toISOString(),
        planned_route,
        notes: "Planned via Live Map",
      });
      alert("Trip saved! The AI now has access to your planned route.");
    } catch (err) {
      console.error("Save trip error:", err);
      const msg = err?.message || String(err) || "Unknown error";
      alert(`Failed to save trip: ${msg}`);
    } finally {
      setSavingTrip(false);
    }
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
    background: pickingFor === field ? "rgba(139,92,246,0.3)" : "rgba(139,92,246,0.08)",
    border: pickingFor === field ? "1px solid rgba(139,92,246,0.5)" : "1px solid rgba(139,92,246,0.18)",
    color: pickingFor === field ? "rgba(167,139,250,1)" : "rgba(167,139,250,0.5)",
    boxShadow: pickingFor === field ? "0 0 8px rgba(139,92,246,0.3)" : "none",
    borderRadius: "10px", transition: "all 0.18s ease", cursor: "pointer",
  });

  const mapHeight = directionsOpen ? "300px" : "390px";

  return (
    <div className="card-enter-2 rounded-2xl overflow-hidden flex flex-col"
      style={{
        background: "rgba(255,255,255,0.03)", backdropFilter: "blur(24px)",
        border: "1px solid rgba(255,255,255,0.07)",
        boxShadow: "0 30px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
      }}>

      <div className="px-5 py-4 flex flex-col gap-3" style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>Live Map</p>
            <p className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Crime risk · Hospitals · Routes</p>
          </div>
          {routeSummary && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs"
              style={{ background: "rgba(139,92,246,0.12)", border: "1px solid rgba(139,92,246,0.25)", color: "rgba(167,139,250,0.9)" }}>
              <span>🕐 {routeSummary.time}</span>
              <span style={{ color: "rgba(255,255,255,0.2)" }}>·</span>
              <span>📍 {routeSummary.dist}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <div className="flex flex-col gap-1.5 flex-1" style={{ position: "relative", minWidth: 0 }}>
            <div style={{
              position: "absolute", left: "13px", top: "32px", bottom: "32px", width: "2px",
              background: "linear-gradient(to bottom, rgba(34,197,94,0.6), rgba(239,68,68,0.6))",
              zIndex: 1, borderRadius: "2px",
            }} />
            <div className="flex gap-1.5 items-center">
              <div style={{ width: "28px", height: "28px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px rgba(34,197,94,0.6)" }} />
              </div>
              <input value={routeFrom} onChange={(e) => { setRouteFrom(e.target.value); setRouteFromCoords(null); }}
                placeholder={pickingFor === "from" ? "Click on map..." : "From"}
                className="glass-input flex-1 px-3 py-2 rounded-xl text-xs"
                style={{ background: pickingFor === "from" ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.05)", border: pickingFor === "from" ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", minWidth: 0 }} />
              <button type="button" title="Pick from map" onClick={() => setPickingFor((p) => p === "from" ? null : "from")} style={pinBtnStyle("from")}>◎</button>
              <button type="button" onClick={() => { setRouteFrom("Current Location"); setPickingFor(null); }}
                className="ctrl-btn px-2.5 py-2 rounded-xl text-xs whitespace-nowrap"
                style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.18)", color: "rgba(134,239,172,0.8)" }}>Current</button>
            </div>
            <div className="flex gap-1.5 items-center">
              <div style={{ width: "28px", height: "28px", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2 }}>
                <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444", boxShadow: "0 0 8px rgba(239,68,68,0.6)" }} />
              </div>
              <input value={routeTo} onChange={(e) => { setRouteTo(e.target.value); setRouteToCoords(null); }}
                placeholder={pickingFor === "to" ? "Click on map..." : "To"}
                className="glass-input flex-1 px-3 py-2 rounded-xl text-xs"
                style={{ background: pickingFor === "to" ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.05)", border: pickingFor === "to" ? "1px solid rgba(139,92,246,0.35)" : "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)", minWidth: 0 }} />
              <button type="button" title="Pick from map" onClick={() => setPickingFor((p) => p === "to" ? null : "to")} style={pinBtnStyle("to")}>◎</button>
            </div>
          </div>

          <button type="button" onClick={handleSwap}
            className="ctrl-btn flex items-center justify-center rounded-xl flex-shrink-0"
            style={{ width: "30px", height: "30px", fontSize: "13px", background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "rgba(167,139,250,0.8)" }}>⇄</button>

          <div className="flex flex-col gap-1.5 flex-shrink-0">
            <button type="submit" disabled={routeLoading}
              className="ctrl-btn px-4 py-2 rounded-xl text-xs font-semibold"
              style={{ background: routeLoading ? "rgba(139,92,246,0.2)" : "linear-gradient(135deg, rgba(139,92,246,0.7), rgba(59,130,246,0.7))", border: "1px solid rgba(139,92,246,0.3)", color: "#fff", opacity: routeLoading ? 0.7 : 1 }}>
              {routeLoading ? "..." : "Route"}
            </button>
            <div className="flex gap-1.5">
              <button type="button" onClick={handleClear}
                className="ctrl-btn flex-1 px-3 py-2 rounded-xl text-xs"
                style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.35)" }}>Clear</button>
              {(routeFrom && routeTo) && (
                <button type="button" onClick={handleSaveTrip} disabled={savingTrip}
                  className="ctrl-btn flex-1 px-3 py-2 rounded-xl text-xs font-medium"
                  style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#86efac", opacity: savingTrip ? 0.7 : 1 }}>
                  {savingTrip ? "..." : "Save"}
                </button>
              )}
            </div>
          </div>
        </form>

        {/* Date pickers */}
        <div className="flex gap-3 items-center">
          <div className="flex-1">
            <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.4)", paddingLeft: "4px" }}>Departure (Optional)</p>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
              className="glass-input w-full px-3 py-2 rounded-xl text-xs"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }} />
          </div>
          <div className="flex-1">
            <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.4)", paddingLeft: "4px" }}>Return (Optional)</p>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
              className="glass-input w-full px-3 py-2 rounded-xl text-xs"
              style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }} />
          </div>
        </div>

        {pickingFor && (
          <div className="anim-fade-in flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
            style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.25)", color: "rgba(167,139,250,0.9)" }}>
            <span style={{ fontSize: "14px" }}>◎</span>
            Click anywhere on the map to set the{" "}
            <strong style={{ color: "#a5b4fc" }}>{pickingFor === "from" ? "starting point" : "destination"}</strong>
            <button type="button" onClick={() => setPickingFor(null)} className="ml-auto text-xs" style={{ color: "rgba(167,139,250,0.5)" }}>cancel</button>
          </div>
        )}
      </div>

      <div style={{ height: mapHeight, transition: "height 0.35s cubic-bezier(0.4,0,0.2,1)", flexShrink: 0 }}>
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
                style={{ background: "rgba(139,92,246,0.15)", border: "1px solid rgba(139,92,246,0.25)", color: "rgba(167,139,250,0.8)" }}>
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
                    background: isActive ? "rgba(139,92,246,0.15)" : "transparent",
                    border: isActive ? "1px solid rgba(139,92,246,0.3)" : "1px solid transparent",
                    boxShadow: isActive ? "0 0 12px rgba(139,92,246,0.15)" : "none",
                    transition: "all 0.18s ease", marginBottom: "2px",
                  }}
                  onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.border = "1px solid rgba(255,255,255,0.07)"; } }}
                  onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.border = "1px solid transparent"; } }}>

                  <div className="flex flex-col items-center gap-1 flex-shrink-0" style={{ paddingTop: "1px" }}>
                    <div className="flex items-center justify-center rounded-lg text-sm font-bold"
                      style={{
                        width: "28px", height: "28px",
                        background: isFirst ? "rgba(34,197,94,0.2)" : isLast ? "rgba(239,68,68,0.2)" : isActive ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.07)",
                        border: isFirst ? "1px solid rgba(34,197,94,0.4)" : isLast ? "1px solid rgba(239,68,68,0.4)" : isActive ? "1px solid rgba(139,92,246,0.4)" : "1px solid rgba(255,255,255,0.1)",
                        color: isFirst ? "#4ade80" : isLast ? "#f87171" : isActive ? "#a78bfa" : "rgba(255,255,255,0.5)",
                        fontSize: "13px",
                      }}>{icon}</div>
                    {!isLast && (
                      <div style={{ width: "2px", height: "14px", background: isActive ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.08)", borderRadius: "2px" }} />
                    )}
                  </div>

                  <div className="flex-1" style={{ minWidth: 0 }}>
                    <p className="text-xs leading-snug"
                      style={{ color: isActive ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.7)", fontWeight: isActive ? "600" : "400" }}>
                      {step.text}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: isActive ? "rgba(167,139,250,0.8)" : "rgba(255,255,255,0.3)" }}>
                      {distLabel}
                    </p>
                  </div>

                  {isActive && (
                    <div className="flex-shrink-0 self-center">
                      <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#a78bfa", boxShadow: "0 0 6px rgba(167,139,250,0.8)" }} />
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
            style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "rgba(167,139,250,0.85)" }}>
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
        style={{ width: "290px", background: "rgba(8,8,20,0.96)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.1)", boxShadow: "0 30px 60px rgba(0,0,0,0.7)" }}
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
  const colors   = RISK_COLORS[level] || RISK_COLORS.UNKNOWN;
  const district = risk?.detected_district || risk?.district;
  const state    = risk?.detected_state    || risk?.state;
  const score    = risk?.risk_score;
  const MAX_RAW  = 3000;
  const score10  = score != null ? Math.min((score / MAX_RAW) * 10, 10).toFixed(1) : null;
  const barPct   = score != null ? Math.min((score / MAX_RAW) * 100, 100) : 0;
  const hasData  = risk && !risk.error;

  return (
    <div className={`${delay} glass-card rounded-2xl p-5 relative overflow-hidden`}
      style={{ background: "rgba(255,255,255,0.03)", backdropFilter: "blur(24px)", border: "1px solid rgba(255,255,255,0.07)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)" }}>
      <div className="anim-glow absolute rounded-full blur-3xl pointer-events-none"
        style={{ width: "80px", height: "80px", top: "-20px", right: "-20px", background: colors.glow }} />
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-medium" style={{ color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em" }}>{title.toUpperCase()}</p>
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
                style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.2)", color: "rgba(167,139,250,0.85)" }}>Focus on Map</button>
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
