import { useContext, useRef, useState, useEffect } from "react";
import { AuthContext } from "../context/AuthContext";
import CrimeMap from "../components/CrimeMap";
import { useNavigate } from "react-router-dom";
import { sendChatMessage, createTrip } from "../api/api";
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
  const navigate = useNavigate();
  const { location } = useLocation(); // ← needed for weather

  const [activeNav, setActiveNav]       = useState("Home");
  const [liveRisk, setLiveRisk]         = useState(null);
  const [clickedRisk, setClickedRisk]   = useState(null);
  const [chatOpen, setChatOpen]         = useState(false);
  const [hospitalsFor, setHospitalsFor] = useState(null);

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
    if (!location?.lat || !location?.lng) return;

    const fetchWeather = async () => {
      try {
        setWeatherLoading(true);
        const res = await fetch(
          `http://localhost:8000/api/v1/weather?lat=${location.lat}&lon=${location.lng}`
        );
        if (!res.ok) throw new Error("weather fetch failed");
        const data = await res.json();
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
        <div className="anim-float flex items-center justify-center rounded-2xl mb-3 text-sm font-bold"
          style={{
            width: "42px", height: "42px",
            background: "linear-gradient(135deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))",
            boxShadow: "0 0 20px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
            color: "#fff", letterSpacing: "0.05em",
          }}>AI</div>
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
              Hey, {greeting}
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.3)" }}>
              {user?.name ? `Welcome back, ${user.name}` : "Your AI travel companion is ready"}
            </p>
          </div>

          {/* ── WEATHER BADGE ── */}
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-xl"
            style={{
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              backdropFilter: "blur(12px)",
              minWidth: "120px",
            }}>
            {weatherLoading ? (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Loading...</span>
            ) : weather ? (
              <>
                <span style={{ fontSize: "18px" }}>{getWeatherIcon(weather.weathercode)}</span>
                <div>
                  <p className="text-xs font-semibold" style={{ color: "rgba(255,255,255,0.85)" }}>
                    {weather.temperature}°C
                  </p>
                  <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.35)" }}>
                    {getWeatherLabel(weather.weathercode)} · {weather.windspeed} km/h
                  </p>
                </div>
              </>
            ) : (
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>No weather</span>
            )}
          </div>
          {/* ── END WEATHER BADGE ── */}

        </header>

        <div className="flex flex-1 gap-5 p-6 overflow-auto">
          <div className="flex-1 flex flex-col" style={{ minWidth: 0 }}>
            <GlassMapCard onRiskUpdate={setLiveRisk} onClickedRiskUpdate={setClickedRisk} mapRef={mapRef} onHospitalsChange={setHospitalsFor} user={user} />
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

            <RiskPanel liveRisk={liveRisk} clickedRisk={clickedRisk} mapRef={mapRef} hospitalsFor={hospitalsFor}
              onClearSelection={() => { setClickedRisk(null); setHospitalsFor(null); }} />
          </aside>
        </div>
      </main>

      <FloatingChat open={chatOpen} onToggle={() => setChatOpen((v) => !v)} weather={weather} />
    </div>
  );
}

// ─── FloatingChat (weather passed in for AI context) ──────────────────────
function FloatingChat({ open, onToggle, weather }) {
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
      // ── Weather context injected into AI ──
      const weatherCtx = weather
        ? ` Current weather: ${getWeatherLabel(weather.weathercode)}, ${weather.temperature}°C, wind ${weather.windspeed} km/h.`
        : "";

      const tripCtx = location
        ? `User's current location: lat=${location.lat}, lng=${location.lng}.${weatherCtx}`
        : `User location not available.${weatherCtx}`;

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

// ─── GlassMapCard (unchanged) ─────────────────────────────────────────────
function GlassMapCard({ onRiskUpdate, onClickedRiskUpdate, mapRef, onHospitalsChange, user }) {
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
    await crimeMapRef.current?.triggerRoute(routeFromCoords || routeFrom, routeToCoords || routeTo);
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
    if (!routeFrom || !routeTo || !routeDirections.length) return;
    setSavingTrip(true);
    try {
      const dist = routeSummary?.dist || "";
      const time = routeSummary?.time || "";
      let planned_route = `Route from ${routeFrom} to ${routeTo}. Distance: ${dist}, ETA: ${time}.`;
      if (startDate) {
        const [year, month, day] = startDate.split("-");
        planned_route += ` Departure: ${day}/${month}/${year}.`;
      }
      if (endDate) {
        const [year, month, day] = endDate.split("-");
        planned_route += ` Return: ${day}/${month}/${year}.`;
      }
      
      await createTrip({
        user_id: user?.id,
        destination: routeTo,
        start_date: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
        end_date: endDate ? new Date(endDate).toISOString() : new Date().toISOString(),
        planned_route: planned_route,
        notes: "Planned via Live Map",
      });
      alert("Trip saved successfully! The AI will now have access to your planned route.");
    } catch (err) {
      console.error(err);
      alert("Failed to save trip.");
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
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
                {routeDirections.length > 0 && (
                  <button type="button" onClick={handleSaveTrip} disabled={savingTrip}
                    className="ctrl-btn flex-1 px-3 py-2 rounded-xl text-xs font-medium"
                    style={{ background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)", color: "#86efac", opacity: savingTrip ? 0.7 : 1 }}>
                    {savingTrip ? "..." : "Save"}
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3 items-center">
            <div className="flex-1">
              <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.4)", paddingLeft: "4px" }}>Departure (Optional)</p>
              <input type="date" 
                value={startDate} onChange={(e) => setStartDate(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-xl text-xs"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
              />
            </div>
            <div className="flex-1">
              <p className="text-[10px] mb-1" style={{ color: "rgba(255,255,255,0.4)", paddingLeft: "4px" }}>Return (Optional)</p>
              <input type="date" 
                value={endDate} onChange={(e) => setEndDate(e.target.value)}
                className="glass-input w-full px-3 py-2 rounded-xl text-xs"
                style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.8)" }}
              />
            </div>
          </div>
        </form>

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