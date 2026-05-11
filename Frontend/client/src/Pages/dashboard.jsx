import { useContext, useRef, useState, useEffect, useMemo } from "react";
import { AuthContext } from "../context/AuthContext";
import { useRouteContext } from "../context/RouteContext";
import { useTheme } from "../context/ThemeContext";
import CrimeMap from "../components/CrimeMap";
import LocationImageCard from "../components/LocationImageCard";
import { useNavigate } from "react-router-dom";
import { sendChatMessage, getNearbyHospitals, getWeather } from "../api/api";
import useLocation from "../hooks/useLocation";
import { getRiskColorsByLevel, getRiskColor } from "../utils/riskColors";
import { MapPin, Navigation, Home, Compass, MessageSquare, LogOut, ShieldCheck, Map, ChevronDown, Trash2 } from "lucide-react";
import { getLocationDisplayName, reverseGeocode } from "../services/geocodingService";

const NAV_ITEMS = [
  { icon: Home, label: "Home", path: "/dashboard" },
  { icon: Compass, label: "Trip Guide", path: "/trip-guide" },
  { icon: MessageSquare, label: "AI Chat", path: "/chat" },
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
  const { isDarkMode, toggleTheme } = useTheme();
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
  const [nearbyHospitalCount, setNearbyHospitalCount] = useState(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [locationName, setLocationName] = useState("");
  const [locationCity, setLocationCity] = useState(""); // city-only for image search
  const [routeLocationNames, setRouteLocationNames] = useState({}); // Cache for route history location names

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

  // ─── Fetch weather and location name whenever location changes ───────────
  useEffect(() => {
    if (location?.lat == null || location?.lng == null) return;

    const fetchWeatherAndLocation = async () => {
      try {
        setWeatherLoading(true);
        
        // Fetch weather
        const weatherData = await getWeather(location.lat, location.lng);
        setWeather(weatherData);
        
        // Fetch location name — null means geocoding failed, keep empty
        const loc = await reverseGeocode(location.lat, location.lng);
        if (loc) {
          const city = loc.city || loc.state || "";
          const specific = loc.specific;
          // Display name: "Neighbourhood, City" or just "City"
          const displayName = (specific && city && specific.toLowerCase() !== city.toLowerCase())
            ? `${specific}, ${city}`
            : (specific || city || "");
          setLocationName(displayName);
          setLocationCity(city); // city-only for Unsplash image search
        }
      } catch (err) {
        console.error("Weather fetch failed:", err);
      } finally {
        setWeatherLoading(false);
      }
    };

    fetchWeatherAndLocation();
  }, [location]);

  useEffect(() => {
    if (location?.lat == null || location?.lng == null) return;
    let active = true;
    const fetchNearbyHospitals = async () => {
      try {
        const hospitals = await getNearbyHospitals(location.lat, location.lng, 30, 10);
        if (!active) return;
        setNearbyHospitalCount(Array.isArray(hospitals) ? hospitals.length : 0);
      } catch (err) {
        console.warn("Nearby hospital fetch failed:", err);
        if (active) setNearbyHospitalCount(null);
      }
    };
    fetchNearbyHospitals();
    return () => { active = false; };
  }, [location]);

  // ─── Fetch location names for route history ──────────────────────────────
  useEffect(() => {
    const fetchLocationNames = async () => {
      const newNames = {};
      for (const historyItem of routeHistory.slice(0, 5)) {
        const originKey = `${historyItem.origin.lat},${historyItem.origin.lng}`;
        const destKey = `${historyItem.destination.lat},${historyItem.destination.lng}`;
        
        if (!routeLocationNames[originKey]) {
          const name = await getLocationDisplayName(historyItem.origin.lat, historyItem.origin.lng);
          // Only store if we got a real name (not null)
          if (name) newNames[originKey] = name;
        }
        
        if (!routeLocationNames[destKey]) {
          const name = await getLocationDisplayName(historyItem.destination.lat, historyItem.destination.lng);
          if (name) newNames[destKey] = name;
        }
      }
      
      if (Object.keys(newNames).length > 0) {
        setRouteLocationNames(prev => ({ ...prev, ...newNames }));
      }
    };
    
    if (routeHistory.length > 0) {
      fetchLocationNames();
    }
  }, [routeHistory]);
  // ─────────────────────────────────────────────────────────────────────────

  const surfaceCard = {
    background: "rgb(var(--bg-elevated) / 0.92)",
    borderColor: "rgb(var(--border-primary))",
    boxShadow: "0 0 0 1px rgb(255 255 255 / 0.04), 0 24px 48px -24px rgb(0 0 0 / 0.45)",
  };

  return (
    <div
      className="voyageur-page-bg flex min-h-screen w-full"
      style={{ color: "rgb(var(--text-primary))" }}
    >
      {/* ── Command rail (navigation) ── */}
      <aside
        style={{
          width: "64px",
          minHeight: "100vh",
          position: "sticky",
          top: 0,
          zIndex: 20,
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "20px 0",
          gap: "4px",
          background: "rgb(var(--bg-secondary) / 0.92)",
          borderRight: "1px solid rgb(var(--border-primary))",
          backdropFilter: "blur(20px)",
        }}
      >
        {/* Logo mark */}
        <div
          onClick={() => navigate("/")}
          title="Voyageur"
          style={{
            width: "36px", height: "36px", borderRadius: "10px",
            background: "linear-gradient(145deg, rgb(var(--accent-cyan)), rgb(var(--accent-primary)))",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", marginBottom: "16px", flexShrink: 0,
            boxShadow: "0 8px 20px -10px rgb(var(--accent-cyan) / 0.5)",
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white" style={{ width: "16px", height: "16px" }}>
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </div>

        {/* Nav items */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%", alignItems: "center" }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeNav === item.label;
            return (
              <button
                key={item.label}
                onClick={() => { setActiveNav(item.label); if (item.path !== "#") navigate(item.path); }}
                title={item.label}
                style={{
                  width: "40px", height: "40px", borderRadius: "10px",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  border: "none", cursor: "pointer", transition: "all 0.15s ease",
                  background: isActive ? "rgb(var(--accent-cyan) / 0.12)" : "transparent",
                  color: isActive ? "rgb(var(--accent-cyan))" : "rgb(var(--text-tertiary))",
                  outline: isActive ? "1px solid rgb(var(--accent-cyan) / 0.25)" : "none",
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "rgb(var(--bg-tertiary))";
                    e.currentTarget.style.color = "rgb(var(--text-secondary))";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = "transparent";
                    e.currentTarget.style.color = "rgb(var(--text-tertiary))";
                  }
                }}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={isActive ? 2.2 : 1.75} />
              </button>
            );
          })}
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Live dot */}
        <div title="AI online" style={{
          width: "8px", height: "8px", borderRadius: "50%",
          background: "rgb(var(--accent-cyan))",
          boxShadow: "0 0 0 3px rgb(var(--accent-cyan) / 0.15)",
          marginBottom: "8px", flexShrink: 0,
        }} />

        {/* Logout */}
        <button
          onClick={handleLogout}
          title={isGuest ? "Exit guest" : "Logout"}
          style={{
            width: "40px", height: "40px", borderRadius: "10px",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: "none", cursor: "pointer",
            background: "transparent", color: "rgb(var(--text-tertiary))",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgb(var(--danger) / 0.08)";
            e.currentTarget.style.color = "rgb(var(--danger))";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "rgb(var(--text-tertiary))";
          }}
        >
          <LogOut className="h-4 w-4" strokeWidth={1.75} />
        </button>
      </aside>

      {/* ── Mission surface ── */}
      <main
        className="flex-1 flex flex-col min-h-screen min-w-0 overflow-hidden transition-colors duration-200"
        style={{
          position: "relative",
          zIndex: 1,
          background: "transparent",
        }}
      >
        <header
          className="shrink-0 z-10 flex flex-col gap-4 px-6 pt-6 pb-4 md:px-8 md:pt-7 md:pb-5 lg:flex-row lg:items-end lg:justify-between border-b transition-colors duration-200"
          style={{
            borderColor: "rgb(var(--border-primary))",
            background: "rgb(var(--bg-primary) / 0.55)",
            backdropFilter: "blur(20px)",
          }}
        >
          <div className="min-w-0 max-w-3xl space-y-2">
            <h1
              className="text-2xl sm:text-3xl lg:text-[2.25rem] font-semibold tracking-tight leading-[1.08]"
              style={{ color: "rgb(var(--text-primary))" }}
            >
              {isGuest ? "Good evening, Guest" : user?.name ? `${greeting}, ${user.name}` : "Good evening"}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-start lg:justify-end lg:pb-1">
            {weather && (
              <div
                className="flex items-center gap-3 px-4 py-3 rounded-xl border min-w-[140px] transition-colors duration-200"
                style={{
                  borderColor: "rgb(var(--border-primary))",
                  background: "rgb(var(--bg-elevated) / 0.9)",
                  boxShadow: "0 18px 40px -28px rgb(0 0 0 / 0.55)",
                }}
              >
                <span className="text-2xl leading-none">
                  {weather.weathercode === 0
                    ? "☀️"
                    : [1, 2, 3].includes(weather.weathercode)
                      ? "⛅"
                      : [45, 48].includes(weather.weathercode)
                        ? "🌫️"
                        : [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(weather.weathercode)
                          ? "🌧️"
                          : [71, 73, 75, 77, 85, 86].includes(weather.weathercode)
                            ? "❄️"
                            : [95, 96, 99].includes(weather.weathercode)
                              ? "⛈️"
                              : "🌤️"}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-lg font-semibold leading-none" style={{ color: "rgb(var(--text-primary))" }}>
                    {weather.temperature}°C
                  </span>
                  <span className="text-xs font-medium" style={{ color: "rgb(var(--text-tertiary))" }}>
                    {getWeatherLabel(weather.weathercode)}
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={toggleTheme}
              className="h-12 w-12 flex items-center justify-center rounded-xl border transition-all duration-200"
              style={{
                borderColor: "rgb(var(--border-primary))",
                color: "rgb(var(--text-secondary))",
                background: "rgb(var(--bg-elevated) / 0.65)",
              }}
              title={isDarkMode ? "Switch to light mode" : "Switch to dark mode"}
            >
              {isDarkMode ? (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
                </svg>
              )}
            </button>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors"
              style={{
                borderColor: "rgb(var(--border-primary))",
                background: "rgb(var(--bg-elevated) / 0.85)",
                color: "rgb(var(--text-primary))",
              }}
            >
              <LogOut className="h-4 w-4 text-rose-500" />
              Logout
            </button>
          </div>
        </header>

        <div
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
          style={{
            scrollbarGutter: "stable",
          }}
        >
          <div className="mx-auto w-full max-w-[1920px] px-6 py-6 md:px-8 md:py-7 lg:px-10 lg:py-8">
            <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_360px] gap-6 xl:gap-8 xl:items-start">
              {/* Primary theater: telemetry + map */}
              <section className="flex flex-col gap-6 min-w-0 min-h-0">
                <div>
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-lg sm:text-xl font-semibold tracking-tight" style={{ color: "rgb(var(--text-primary))" }}>
                        Risk telemetry
                      </h2>
                    </div>
                  </div>

                  <div
                    className={`grid gap-4 ${
                      clickedRisk ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
                    }`}
                  >
                    <div
                      className="rounded-2xl border p-5 md:p-5 transition-colors duration-200 w-full"
                      style={surfaceCard}
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1 min-w-0 space-y-0.5">
                          <p className="text-base md:text-lg font-semibold tracking-tight truncate" style={{ color: "rgb(var(--text-primary))" }}>
                            {locationName || "Current location"}
                          </p>
                          <p className="text-xs truncate" style={{ color: "rgb(var(--text-secondary))" }}>
                            {liveRisk?.detected_district || liveRisk?.district || "Live location"}
                          </p>
                        </div>
                        <div
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl shrink-0"
                          style={{
                            background: liveRisk ? getRiskColorsByLevel(liveRisk.risk_level).bg : "rgb(var(--bg-tertiary))",
                            border: liveRisk
                              ? `1px solid ${getRiskColorsByLevel(liveRisk.risk_level).border}`
                              : "1px solid rgb(var(--border-primary))",
                          }}
                        >
                          <span
                            className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                            style={{
                              background: liveRisk
                                ? getRiskColorsByLevel(liveRisk.risk_level).accent
                                : "rgb(var(--text-tertiary))",
                            }}
                          />
                          <span
                            className="text-[10px] font-bold tracking-wide"
                            style={{
                              color: liveRisk ? getRiskColorsByLevel(liveRisk.risk_level).text : "rgb(var(--text-tertiary))",
                            }}
                          >
                            {liveRisk?.risk_level?.toUpperCase() || "UNKNOWN"}
                          </span>
                        </div>
                      </div>

                      {liveRisk ? (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "rgb(var(--text-secondary))" }}>
                            <span>Crime score</span>
                            <span style={{ color: liveRisk ? getRiskColorsByLevel(liveRisk.risk_level).text : "rgb(var(--text-tertiary))" }}>
                              {liveRisk.risk_score != null ? Math.min((liveRisk.risk_score / 3000) * 10, 10).toFixed(1) : "—"} / 10
                            </span>
                          </div>
                          <div className="rounded-full overflow-hidden h-1.5" style={{ background: "rgb(var(--bg-tertiary))" }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min((liveRisk.risk_score ?? 0) / 3000 * 100, 100)}%`,
                                background: getRiskColorsByLevel(liveRisk.risk_level || "UNKNOWN").accent,
                              }}
                            />
                          </div>
                          <div className="flex gap-2 pt-0.5">
                            <button
                              onClick={() => mapRef.current?.focusMap("live")}
                              className="flex-1 py-2 rounded-xl text-[10px] font-bold transition-colors"
                              style={{
                                background: "rgb(var(--bg-tertiary))",
                                border: "1px solid rgb(var(--border-primary))",
                                color: "rgb(var(--text-secondary))",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgb(var(--bg-secondary))";
                                e.currentTarget.style.color = "rgb(var(--text-primary))";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgb(var(--bg-tertiary))";
                                e.currentTarget.style.color = "rgb(var(--text-secondary))";
                              }}
                            >
                              Focus
                            </button>
                            <button
                              onClick={() => mapRef.current?.showHospitalsFor("live")}
                              className="flex-1 py-2 rounded-xl text-[10px] font-bold transition-colors"
                              style={{
                                background: hospitalsFor === "live" ? "rgb(var(--success) / 0.15)" : "rgb(var(--success) / 0.08)",
                                border:
                                  hospitalsFor === "live"
                                    ? "1px solid rgb(var(--success) / 0.3)"
                                    : "1px solid rgb(var(--success) / 0.15)",
                                color: hospitalsFor === "live" ? "rgb(var(--success))" : "rgb(var(--success) / 0.8)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgb(var(--success) / 0.2)";
                                e.currentTarget.style.color = "rgb(var(--success))";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  hospitalsFor === "live" ? "rgb(var(--success) / 0.15)" : "rgb(var(--success) / 0.08)";
                                e.currentTarget.style.color =
                                  hospitalsFor === "live" ? "rgb(var(--success))" : "rgb(var(--success) / 0.8)";
                              }}
                            >
                              {hospitalsFor === "live" ? "Hide hospitals" : "Hospitals"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <p className="text-xs font-medium pt-1" style={{ color: "rgb(var(--text-secondary))" }}>
                          Loading live risk…
                        </p>
                      )}
                    </div>

                    {clickedRisk && (
                      <div className="rounded-2xl border p-5 md:p-5 transition-colors duration-200 w-full" style={surfaceCard}>
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="text-base md:text-lg font-semibold tracking-tight truncate" style={{ color: "rgb(var(--text-primary))" }}>
                              {clickedRisk.detected_district || clickedRisk.district || "Unknown"}
                            </p>
                            <p className="text-xs truncate" style={{ color: "rgb(var(--text-secondary))" }}>
                              {clickedRisk.detected_state || clickedRisk.state || ""}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <div
                              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl"
                              style={{
                                background: getRiskColorsByLevel(clickedRisk.risk_level || "UNKNOWN").bg,
                                border: `1px solid ${getRiskColorsByLevel(clickedRisk.risk_level || "UNKNOWN").border}`,
                              }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full shrink-0 animate-pulse"
                                style={{ background: getRiskColorsByLevel(clickedRisk.risk_level || "UNKNOWN").accent }}
                              />
                              <span
                                className="text-[10px] font-bold tracking-wide"
                                style={{ color: getRiskColorsByLevel(clickedRisk.risk_level || "UNKNOWN").text }}
                              >
                                {clickedRisk.risk_level?.toUpperCase() || "UNKNOWN"}
                              </span>
                            </div>
                            <button
                              onClick={() => {
                                mapRef.current?.clearAll();
                                setClickedRisk(null);
                                setHospitalsFor(null);
                              }}
                              className="flex items-center justify-center rounded-xl w-7 h-7 text-xs transition-colors"
                              style={{ color: "rgb(var(--text-tertiary))" }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgb(var(--danger) / 0.1)";
                                e.currentTarget.style.color = "rgb(var(--danger))";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "transparent";
                                e.currentTarget.style.color = "rgb(var(--text-tertiary))";
                              }}
                              aria-label="Clear selection"
                            >
                              ✕
                            </button>
                          </div>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs font-semibold" style={{ color: "rgb(var(--text-secondary))" }}>
                            <span>Crime score</span>
                            <span style={{ color: getRiskColorsByLevel(clickedRisk.risk_level || "UNKNOWN").text }}>
                              {clickedRisk.risk_score != null ? Math.min((clickedRisk.risk_score / 3000) * 10, 10).toFixed(1) : "—"} / 10
                            </span>
                          </div>
                          <div className="rounded-full overflow-hidden h-1.5" style={{ background: "rgb(var(--bg-tertiary))" }}>
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min((clickedRisk.risk_score ?? 0) / 3000 * 100, 100)}%`,
                                background: getRiskColorsByLevel(clickedRisk.risk_level || "UNKNOWN").accent,
                              }}
                            />
                          </div>
                          <div className="flex gap-2 pt-0.5">
                            <button
                              onClick={() => mapRef.current?.focusMap("selected")}
                              className="flex-1 py-2 rounded-xl text-[10px] font-bold transition-colors"
                              style={{
                                background: "rgb(var(--bg-tertiary))",
                                border: "1px solid rgb(var(--border-primary))",
                                color: "rgb(var(--text-secondary))",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgb(var(--bg-secondary))";
                                e.currentTarget.style.color = "rgb(var(--text-primary))";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = "rgb(var(--bg-tertiary))";
                                e.currentTarget.style.color = "rgb(var(--text-secondary))";
                              }}
                            >
                              Focus
                            </button>
                            <button
                              onClick={() => mapRef.current?.showHospitalsFor("selected")}
                              className="flex-1 py-2 rounded-xl text-[10px] font-bold transition-colors"
                              style={{
                                background: hospitalsFor === "selected" ? "rgb(var(--success) / 0.15)" : "rgb(var(--success) / 0.08)",
                                border:
                                  hospitalsFor === "selected"
                                    ? "1px solid rgb(var(--success) / 0.3)"
                                    : "1px solid rgb(var(--success) / 0.15)",
                                color: hospitalsFor === "selected" ? "rgb(var(--success))" : "rgb(var(--success) / 0.8)",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = "rgb(var(--success) / 0.2)";
                                e.currentTarget.style.color = "rgb(var(--success))";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background =
                                  hospitalsFor === "selected" ? "rgb(var(--success) / 0.15)" : "rgb(var(--success) / 0.08)";
                                e.currentTarget.style.color =
                                  hospitalsFor === "selected" ? "rgb(var(--success))" : "rgb(var(--success) / 0.8)";
                              }}
                            >
                              {hospitalsFor === "selected" ? "Hide hospitals" : "Hospitals"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div
                  className="flex-1 min-h-[min(480px,58vh)] xl:min-h-[calc(100vh-280px)] flex flex-col rounded-2xl border overflow-hidden transition-colors duration-200"
                  style={{
                    ...surfaceCard,
                    boxShadow: `${surfaceCard.boxShadow}, 0 40px 120px -48px rgb(0 0 0 / 0.65)`,
                  }}
                >
                  <GlassMapCard
                    liveRisk={liveRisk}
                    onRiskUpdate={setLiveRisk}
                    onClickedRiskUpdate={setClickedRisk}
                    mapRef={mapRef}
                    onHospitalsChange={setHospitalsFor}
                    hospitalsFor={hospitalsFor}
                    nearbyHospitalCount={nearbyHospitalCount}
                    locationName={locationName}
                    safeRoutes={safeRoutes}
                    selectedRouteId={selectedRouteId}
                    onRouteSelect={setSelectedRouteId}
                    isLoadingRoutes={isLoadingRoutes}
                    user={user}
                    userLocation={location}
                  />
                </div>
              </section>

              {/* Operations rail */}
              <aside
                className="flex flex-col gap-5 min-w-0 xl:sticky xl:top-6 xl:self-start xl:max-h-[calc(100vh-48px)] xl:overflow-y-auto"
                style={{ scrollbarGutter: "stable" }}
              >
                {confirmDeleteId && (
                  <div
                    style={{
                      position: "fixed",
                      inset: 0,
                      zIndex: 9998,
                      background: "rgba(0,0,0,0.5)",
                      backdropFilter: "blur(4px)",
                      display: "flex",
                      alignItems: "center",
                      justifyItems: "center",
                    }}
                    onClick={() => setConfirmDeleteId(null)}
                  >
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className="rounded-2xl p-6 w-72 shadow-xl m-auto transition-colors duration-200 border"
                      style={{
                        background: "rgb(var(--bg-elevated))",
                        borderColor: "rgb(var(--border-primary))",
                      }}
                    >
                      <p className="text-base font-bold mb-2 transition-colors" style={{ color: "rgb(var(--text-primary))" }}>
                        Delete route?
                      </p>
                      <p className="text-sm mb-6 transition-colors" style={{ color: "rgb(var(--text-secondary))" }}>
                        Are you sure you want to delete this route?
                      </p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="flex-1 py-2.5 rounded-xl border text-sm font-semibold transition-colors"
                          style={{
                            borderColor: "rgb(var(--border-primary))",
                            color: "rgb(var(--text-secondary))",
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => {
                            deleteRoute(confirmDeleteId);
                            setConfirmDeleteId(null);
                          }}
                          className="flex-1 py-2.5 rounded-xl bg-rose-500 text-white text-sm font-semibold hover:bg-rose-600 transition-colors shadow-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <div
                    className="voyageour-panel rounded-2xl overflow-hidden border p-1 transition-colors duration-200"
                    style={{
                      background: "rgb(var(--bg-elevated) / 0.95)",
                      borderColor: "rgb(var(--border-primary))",
                      boxShadow: "0 28px 64px -36px rgb(0 0 0 / 0.55)",
                    }}
                  >
                    <LocationImageCard
                      locationName={locationCity || locationName}
                      locationType="current"
                      width="100%"
                      height="240px"
                      showTitle={true}
                    />
                  </div>
                </div>

                {routeHistory.length > 0 && (
                  <div
                    className="voyageour-panel rounded-2xl p-5 border transition-colors duration-200"
                    style={{
                      background: "rgb(var(--bg-elevated) / 0.95)",
                      borderColor: "rgb(var(--border-primary))",
                      boxShadow: "0 28px 64px -36px rgb(0 0 0 / 0.55)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-4 gap-3">
                      <p className="text-base font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
                        Recent routes
                      </p>
                      <span
                        className="text-xs font-semibold px-2.5 py-1 rounded-full shrink-0"
                        style={{
                          background: "rgb(var(--bg-tertiary))",
                          color: "rgb(var(--text-secondary))",
                          border: "1px solid rgb(var(--border-primary))",
                        }}
                      >
                        {routeHistory.length}
                      </span>
                    </div>
                    <div className="flex flex-col gap-3 max-h-[min(380px,45vh)] overflow-y-auto pr-1">
                      {routeHistory.slice(0, 5).map((historyItem, index) => (
                        <div
                          key={historyItem.id}
                          className="group p-4 rounded-2xl border transition-colors"
                          style={{
                            borderColor: "rgb(var(--border-primary) / 0.6)",
                            background: "rgb(var(--bg-secondary) / 0.5)",
                          }}
                        >
                          <div className="flex items-start gap-2.5">
                            <div
                              className="flex-1 cursor-pointer min-w-0"
                              onClick={() => mapRef.current?.triggerRoute(historyItem.origin, historyItem.destination, true)}
                            >
                              <div className="flex items-center justify-between gap-2 mb-2.5">
                                <span className="text-sm font-semibold truncate" style={{ color: "rgb(var(--text-primary))" }}>
                                  Route {index + 1}
                                </span>
                                <span className="text-[10px] font-medium shrink-0" style={{ color: "rgb(var(--text-tertiary))" }}>
                                  {new Date(historyItem.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                </span>
                              </div>
                              <div className="text-xs space-y-2" style={{ color: "rgb(var(--text-secondary))" }}>
                                <div className="flex items-start gap-2">
                                  <span className="inline-flex mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                  <span className="leading-snug">
                                    Origin: {routeLocationNames[`${historyItem.origin.lat},${historyItem.origin.lng}`] || `${historyItem.origin.lat.toFixed(4)}, ${historyItem.origin.lng.toFixed(4)}`}
                                  </span>
                                </div>
                                <div className="flex items-start gap-2">
                                  <span className="inline-flex mt-1 h-1.5 w-1.5 rounded-full bg-rose-500 shrink-0" />
                                  <span className="leading-snug">
                                    Destination: {routeLocationNames[`${historyItem.destination.lat},${historyItem.destination.lng}`] || `${historyItem.destination.lat.toFixed(4)}, ${historyItem.destination.lng.toFixed(4)}`}
                                  </span>
                                </div>
                              </div>
                              {historyItem.routes?.length > 0 && (
                                <div className="mt-5 flex items-center justify-between">
                                  <div
                                    className={`rounded-full px-3 py-1 text-[11px] font-semibold transition-colors ${
                                      historyItem.routes[0].type === "safest"
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800"
                                        : "bg-blue-50 text-blue-700 border border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"
                                    }`}
                                  >
                                    {historyItem.routes[0].type.toUpperCase()}
                                  </div>
                                  <span className="text-xs font-semibold" style={{ color: "rgb(var(--text-primary))" }}>
                                    {historyItem.routes[0].safety_score?.toFixed(1) ?? "—"}/10
                                  </span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDeleteId(historyItem.id);
                              }}
                              title="Delete route"
                              className="flex-shrink-0 rounded-xl p-2 transition-colors hover:bg-rose-500/10"
                              style={{ color: "rgb(var(--text-tertiary))" }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            </div>
          </div>
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
        <div className="anim-fade-up fixed flex flex-col bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-xl transition-colors duration-200"
          style={{
            bottom: "88px", right: "24px", width: "360px", height: "500px", zIndex: 9999,
            overflow: "hidden",
          }}>
          {/* Top accent line */}
          <div style={{ position: "absolute", top: 0, left: "15%", right: "15%", height: "2px", background: "linear-gradient(90deg, transparent, #0ea5e9, transparent)" }} />

          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-slate-100 dark:border-slate-800 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center rounded-xl text-xs font-bold bg-teal-500 text-white w-8 h-8 shadow-sm">AI</div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors">AI Assistant</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 transition-colors">Online</span>
                </div>
              </div>
            </div>
            <button onClick={onToggle}
              className="flex items-center justify-center rounded-lg w-7 h-7 text-xs bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Close chat">✕</button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-900 transition-colors">
            {messages.map((msg, i) => (
              <div key={i} className="anim-fade-in flex" style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div className={`text-xs leading-relaxed whitespace-pre-wrap px-3 py-2 shadow-sm font-medium ${
                  msg.role === "user"
                    ? "rounded-[16px_16px_4px_16px] bg-teal-600 text-white"
                    : "rounded-[16px_16px_16px_4px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                }`} style={{ maxWidth: "82%" }}>
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                  {[0,1,2].map((d) => (
                    <span key={d} className="w-1.5 h-1.5 rounded-full bg-teal-400"
                      style={{ animation: `pulse-dot 1.2s ease-in-out ${d * 0.2}s infinite` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-3 flex-shrink-0 flex gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
            <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKey}
              placeholder="Ask anything..." className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 dark:focus:border-teal-500 transition-colors"
            />
            <button onClick={handleSend} disabled={loading || !input.trim()}
              className="flex items-center justify-center rounded-xl flex-shrink-0 w-9 h-9 text-sm font-bold transition-all duration-200 disabled:opacity-50"
              style={{
                background: input.trim() && !loading ? "#0d9488" : "#f1f5f9",
                border: input.trim() && !loading ? "1px solid #0f766e" : "1px solid #e2e8f0",
                color: input.trim() && !loading ? "#fff" : "#94a3b8",
              }}>↑</button>
          </div>
        </div>
      )}

      <button onClick={onToggle} className="fixed flex items-center justify-center rounded-full shadow-lg transition-all duration-300 z-[9999]"
        style={{
          bottom: "24px", right: "24px", width: "52px", height: "52px", cursor: "pointer",
          background: open ? "#f8fafc" : "#0d9488",
          border: open ? "1px solid #e2e8f0" : "1px solid #0f766e",
          color: open ? "#64748b" : "#fff", fontSize: open ? "16px" : "18px",
          transform: open ? "scale(0.9) rotate(45deg)" : "scale(1) rotate(0deg)",
        }}
        title="AI Assistant">{open ? "✕" : "✦"}</button>
    </>
  );
}

// ─── RouteSafetyBar — horizontal strip + directions dropdown ─────────────
const ROUTE_TAB = {
  safest:      { icon: ShieldCheck, label: "Safest",  color: "#22c55e", bg: "rgba(34,197,94,0.15)",  border: "rgba(34,197,94,0.35)"  },
  alternative: { icon: Map, label: "Normal",  color: "#60a5fa", bg: "rgba(59,130,246,0.15)", border: "rgba(59,130,246,0.35)" },
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
      <div className="border-t border-slate-200 dark:border-slate-800 p-3 px-4 flex items-center gap-2 bg-slate-50 dark:bg-slate-900/50 transition-colors">
        <div className="w-4 h-4 rounded-full border-2 border-teal-200 dark:border-teal-800 border-t-teal-500 animate-spin flex-shrink-0" />
        <span className="text-xs text-slate-500 dark:text-slate-400 transition-colors">Computing safe routes…</span>
      </div>
    );
  }

  if (!routes || routes.length === 0) return null;

  const scoreColor = current ? getRiskColor(current.safety_score) : "#64748b";
  const riskColor  = current ? getRiskColorsByLevel(current.risk_level).accent : "#64748b";
  const steps      = current?.id ? (stepsMap[current.id] || []) : [];
  const isLoadingSteps = current?.id ? !!loadingSteps[current.id] : false;

  return (
    <div className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 shadow-sm transition-colors">
      {/* ── Route bar (stacked rows avoid gauge overlapping RISK/DISTANCE/DURATION) ── */}
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {availableTabs.map(([key, cfg]) => {
              const r = byType[key];
              const isActive = activeTab === key;
              return (
                <button key={key} onClick={() => handleTab(key)} 
                  className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm transition-colors border ${
                    isActive 
                      ? "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 shadow-sm font-semibold" 
                      : "bg-transparent border-transparent text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-300 font-medium"
                  }`}>
                  <cfg.icon className="h-4 w-4" />
                  <span>{cfg.label}</span>
                  {r && (
                    <span className={`text-[11px] ml-1 ${isActive ? "" : "opacity-80"}`} style={{ color: getRiskColor(r.safety_score), fontWeight: isActive ? 700 : 600 }}>
                      {r.safety_score?.toFixed ? r.safety_score.toFixed(1) : r.safety_score}
                      <span className="text-[9px] font-normal opacity-70 ml-1 text-slate-500 dark:text-slate-400 transition-colors">risk</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          {availableTabs.length === 1 && (
            <span className="text-[10px] text-slate-400 dark:text-slate-500 px-2 self-center transition-colors">
              Only one route available for this trip
            </span>
          )}
        </div>

        {current && (
          <div className="flex flex-col gap-4 border-t border-slate-100 pt-4 dark:border-slate-800/80 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
            <div className="grid min-w-0 flex-1 grid-cols-3 gap-x-6 gap-y-2 sm:max-w-xl">
              {[
                { label: "RISK",     val: current.risk_level?.toUpperCase() || "—", color: riskColor },
                { label: "DISTANCE", val: `${(current.distance / 1000).toFixed(1)} km`, color: "#94a3b8" },
                { label: "DURATION", val: `${Math.round(current.duration / 60)} min`,   color: "#94a3b8" },
              ].map(({ label, val, color }) => (
                <div key={label} className="min-w-0">
                  <p className="text-[9px] text-slate-400 dark:text-slate-500 font-medium mb-0.5 transition-colors">{label}</p>
                  <p className="truncate text-sm font-bold" style={{ color }}>{val}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-end gap-4 sm:flex-nowrap sm:justify-end sm:shrink-0">
              <div className="flex min-w-[160px] flex-1 flex-col gap-2 sm:flex-initial sm:min-w-[180px]">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white shadow-sm transition-colors dark:bg-slate-900" style={{ border: `2px solid ${scoreColor}` }}>
                    <span className="text-base font-bold leading-none" style={{ color: scoreColor }}>
                      {current.safety_score?.toFixed ? current.safety_score.toFixed(1) : current.safety_score}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-0.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Risk score</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">vs. maximum risk band</p>
                  </div>
                </div>
                <div className="h-3.5 overflow-hidden rounded-full bg-slate-200 transition-colors dark:bg-slate-700">
                  <div className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(Math.max(((current.safety_score - 1) / 9) * 100, 0), 100)}%`,
                      background: scoreColor,
                    }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400">
                  <span>Risk score</span>
                  <span>{current.safety_score?.toFixed ? `${Math.round(((current.safety_score - 1) / 9) * 100)}%` : "—"}</span>
                </div>
              </div>

              <button onClick={() => onRouteSelect?.(current.id)} 
                className={`h-10 shrink-0 self-stretch rounded-lg border px-4 text-[11px] font-semibold transition-colors sm:self-center ${
                  selectedRouteId === current.id 
                    ? "border-teal-200 bg-teal-100 text-teal-700 dark:border-teal-800 dark:bg-teal-900/40 dark:text-teal-400" 
                    : "border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                }`}>
                {selectedRouteId === current.id ? "✓ Selected" : "Select"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Directions toggle ── */}
      <div className="border-t border-slate-200 dark:border-slate-800 transition-colors">
        <button
          onClick={() => {
            setDirectionsOpen(v => !v);
            if (!directionsOpen && current?.id && !stepsMap[current.id] && !loadingSteps[current.id]) {
              setLoadingSteps(prev => ({ ...prev, [current.id]: true }));
              fetchStepsForRoute(current).then(steps => {
                setStepsMap(prev => ({ ...prev, [current.id]: steps }));
                setLoadingSteps(prev => ({ ...prev, [current.id]: false }));
              });
            }
          }}
          className="w-full px-4 py-3 flex items-center justify-between text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />
            <span className="font-semibold text-slate-700 dark:text-slate-200 transition-colors">
              Directions
              {steps.length > 0 && (
                <span className="ml-2 text-[11px] text-slate-500 dark:text-slate-400 font-normal transition-colors">
                  ({steps.length} steps)
                </span>
              )}
            </span>
            {userLocation && steps.length > 0 && (
              <span className="text-[10px] px-2 py-1 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-300 font-semibold transition-colors">
                LIVE
              </span>
            )}
          </div>
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${directionsOpen ? "rotate-180" : ""}`} />
        </button>

        {directionsOpen && (
          <div className="max-h-64 overflow-y-auto px-2 pb-2">
            {isLoadingSteps ? (
              <div className="p-4 text-center">
                <div className="inline-block w-4 h-4 rounded-full border-2 border-teal-200 dark:border-teal-800 border-t-teal-500 animate-spin" />
                <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-2 transition-colors">Loading directions…</p>
              </div>
            ) : steps.length === 0 ? (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 p-3 text-center transition-colors">
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
                    className={`flex items-start gap-3 p-2 rounded-xl cursor-pointer mb-0.5 transition-colors border ${
                      isActive 
                        ? "bg-teal-50 dark:bg-teal-900/30 border-teal-100 dark:border-teal-800" 
                        : "bg-transparent border-transparent hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    {/* Step icon */}
                    <div className={`w-7 h-7 rounded-lg flex-shrink-0 flex items-center justify-center text-[13px] border transition-colors ${
                      isFirst ? "bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400" 
                      : isLast ? "bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400" 
                      : isActive ? "bg-teal-100 dark:bg-teal-900/40 border-teal-200 dark:border-teal-800 text-teal-700 dark:text-teal-400" 
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400"
                    }`}>
                      {stepIcon(step.text)}
                    </div>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-[11px] leading-snug transition-colors ${isActive ? "text-teal-900 dark:text-teal-100 font-semibold" : "text-slate-600 dark:text-slate-400 font-medium"}`}>
                        {step.text}
                      </p>
                      <p className={`text-[10px] mt-0.5 ${isActive ? "text-teal-600" : "text-slate-400"}`}>
                        {fmtDist(step.distance)}
                      </p>
                    </div>

                    {/* Live indicator */}
                    {isActive && userLocation && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 self-center" />
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

// Photon bbox: India (minLon,minLat,maxLon,maxLat). Used with country filter — bbox alone can include neighbours.
const INDIA_PHOTON_BBOX = "68.0,6.0,97.9,37.5";

function isIndiaPhotonFeature(feat) {
  const p = feat?.properties || {};
  const cc = String(p.countrycode || "").toLowerCase();
  if (cc === "in") return true;
  const country = String(p.country || "").toLowerCase();
  return country === "india";
}

// ─── PlaceAutocomplete ────────────────────────────────────────────────────
function PlaceAutocomplete({ value, onChange, onSelect, placeholder, inputClassName }) {
  const [suggestions, setSuggestions] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef(null);
  const containerRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleChange = (e) => {
    const v = e.target.value;
    onChange(v);
    if (!v.trim()) { setSuggestions([]); setOpen(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(v)}&limit=20&lang=en&bbox=${INDIA_PHOTON_BBOX}`
        );
        const data = await res.json();
        const items = (data.features || [])
          .filter(isIndiaPhotonFeature)
          .slice(0, 8)
          .map((f) => {
            const p = f.properties;
            const parts = [p.name, p.city || p.town || p.village, p.state, p.country].filter(Boolean);
            return { label: parts.join(", "), name: p.name, coords: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] } };
          });
        setSuggestions(items);
        setOpen(items.length > 0);
      } catch {
        setSuggestions([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 320);
  };

  const handleSelect = (item) => {
    onChange(item.label);
    onSelect({ name: item.label, lat: item.coords.lat, lng: item.coords.lng });
    setSuggestions([]);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <input
        value={value}
        onChange={handleChange}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        placeholder={placeholder}
        className={inputClassName}
        autoComplete="off"
      />
      {loading && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 animate-pulse">…</span>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full left-0 right-0 mt-1 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xl overflow-hidden max-h-56 overflow-y-auto">
          {suggestions.map((item, i) => (
            <li
              key={i}
              onMouseDown={(e) => { e.preventDefault(); handleSelect(item); }}
              className="px-3 py-2.5 text-xs cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-900/30 text-slate-800 dark:text-slate-200 border-b border-slate-100 dark:border-slate-800 last:border-0 flex items-start gap-2"
            >
              <span className="text-teal-500 mt-0.5 shrink-0">◎</span>
              <span className="leading-snug">{item.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ─── GlassMapCard (unchanged) ─────────────────────────────────────────────
function GlassMapCard({ liveRisk, onRiskUpdate, onClickedRiskUpdate, mapRef, onHospitalsChange, hospitalsFor, nearbyHospitalCount, locationName, safeRoutes = [], selectedRouteId, onRouteSelect, isLoadingRoutes = false, userLocation }) {
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

  const handleRoutePick = async (coords) => {
    // Fetch location name for picked coordinates
    const locationName = await getLocationDisplayName(coords.lat, coords.lng);
    const displayName = locationName || `${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`;
    const coordsWithName = { ...coords, name: displayName };

    if (pickingFor === "from") {
      setRouteFrom(displayName);
      setRouteFromCoords(coordsWithName);
    }
    if (pickingFor === "to") {
      setRouteTo(displayName);
      setRouteToCoords(coordsWithName);
    }
    setPickingFor(null);
  };

  const handleStepClick = (index) => {
    setActiveStep(index);
    crimeMapRef.current?.focusStep?.(index);
  };

  return (
    <div className="flex-1 flex flex-col relative w-full h-full min-h-0 bg-white dark:bg-slate-900 z-10 transition-colors">
      <div className="px-5 sm:px-6 py-4 sm:py-4 flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="text-base text-teal-600 dark:text-teal-400 transition-colors mt-0.5 shrink-0">◈</span>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400 transition-colors">
                Geospatial canvas
              </p>
              <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100 transition-colors tracking-tight">
                Live operating map
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 transition-colors mt-0.5">
                Crime risk · Hospitals · Routes
              </p>
            </div>
          </div>
          {routeSummary && (
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-medium bg-teal-50 dark:bg-teal-900/30 border border-teal-100 dark:border-teal-800 text-teal-700 dark:text-teal-400 transition-colors shrink-0">
              <span>🕐 {routeSummary.time}</span>
              <span className="text-teal-200 dark:text-teal-600">·</span>
              <span>📍 {routeSummary.dist}</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-2.5">
          <div className="flex gap-2 items-center">
            <PlaceAutocomplete
              value={routeFrom}
              onChange={(v) => { setRouteFrom(v); setRouteFromCoords(null); }}
              onSelect={(s) => { setRouteFrom(s.name); setRouteFromCoords(s); }}
              placeholder={pickingFor === "from" ? "Click on map…" : "From — origin"}
              inputClassName={`w-full px-3 py-2 rounded-xl text-xs border focus:outline-none transition-colors ${pickingFor === "from" ? "bg-teal-50 dark:bg-teal-900/40 border-teal-300 dark:border-teal-600 text-teal-900 dark:text-teal-100" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-teal-400 dark:focus:border-teal-500"}`}
            />
            <button type="button" title="Use current location"
              onClick={() => { setRouteFrom("Current Location"); setPickingFor(null); }}
              className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl flex-shrink-0 text-[10px] font-medium bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors">
              <Navigation size={11} /> Current
            </button>
            <button type="button" title="Pick on map"
              onClick={() => setPickingFor((p) => p === "from" ? null : "from")}
              className={`flex items-center gap-1.5 px-2.5 py-2 rounded-xl flex-shrink-0 text-[10px] font-medium transition-colors ${pickingFor === "from" ? "bg-teal-100 dark:bg-teal-900/40 border-teal-300 dark:border-teal-600 text-teal-800 dark:text-teal-300" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
              <MapPin size={11} /> Map
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <PlaceAutocomplete
              value={routeTo}
              onChange={(v) => { setRouteTo(v); setRouteToCoords(null); }}
              onSelect={(s) => { setRouteTo(s.name); setRouteToCoords(s); }}
              placeholder={pickingFor === "to" ? "Click on map…" : "To — destination"}
              inputClassName={`w-full px-3 py-2.5 rounded-xl text-xs border focus:outline-none transition-colors ${pickingFor === "to" ? "bg-teal-50 dark:bg-teal-900/40 border-teal-300 dark:border-teal-600 text-teal-900 dark:text-teal-100" : "bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:border-teal-400 dark:focus:border-teal-500"}`}
            />
            <button type="button" title="Pick on map"
              onClick={() => setPickingFor((p) => p === "to" ? null : "to")}
              className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl flex-shrink-0 text-[11px] font-medium transition-colors ${pickingFor === "to" ? "bg-teal-100 dark:bg-teal-900/40 border-teal-300 dark:border-teal-600 text-teal-800 dark:text-teal-300" : "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"}`}>
              <MapPin size={12} /> Map
            </button>
            <button type="submit" disabled={routeLoading}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex-shrink-0 transition-colors shadow-sm ${routeLoading ? "bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 cursor-not-allowed" : "bg-teal-600 text-white hover:bg-teal-500 hover:-translate-y-0.5"}`}>
              {routeLoading ? "…" : "Search"}
            </button>
            <button type="button" onClick={handleClear}
              className="px-3 py-2.5 rounded-xl text-xs flex-shrink-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Clear</button>
          </div>
        </form>

        {pickingFor && (
          <div className="anim-fade-in flex items-center gap-2 px-3 py-2 rounded-xl text-xs bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-300 transition-colors">
            <span className="text-[14px]">◎</span>
            Click anywhere on the map to set the{" "}
            <strong className="text-teal-900 dark:text-teal-100">{pickingFor === "from" ? "starting point" : "destination"}</strong>
            <button type="button" onClick={() => setPickingFor(null)} className="ml-auto text-xs text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-300 underline transition-colors">cancel</button>
          </div>
        )}
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{
          flex: "1 1 0%",
          minHeight: directionsOpen ? "min(40vh, 420px)" : "min(44vh, 480px)",
          transition: "min-height 0.35s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-6 sm:pb-6">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-slate-950/40 shadow-[inset_0_1px_0_rgb(255_255_255/0.04),0_0_0_1px_rgb(0_0_0/0.2)] dark:border-slate-800 dark:bg-slate-950">
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
        </div>
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


    </div>
  );
}

// ─── RiskPanel ────────────────────────────────────────────────────────────
function RiskPanel({ clickedRisk, mapRef, onClearSelection }) {
  const [showModal, setShowModal] = useState(false);
  const handleClearConfirm = () => { setShowModal(false); mapRef.current?.clearAll(); onClearSelection(); };
  return (
    <>
      {clickedRisk !== null && (
        <RiskCard title="Selected Location" risk={clickedRisk} delay="card-enter-3"
          onClear={() => setShowModal(true)} />
      )}
      {showModal && <ClearModal onCancel={() => setShowModal(false)} onConfirm={handleClearConfirm} />}
    </>
  );
}

// ─── ClearModal ───────────────────────────────────────────────────────────
function ClearModal({ onCancel, onConfirm }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[99999] bg-slate-900/40 backdrop-blur-sm transition-colors"
      onClick={onCancel}>
      <div className="anim-fade-up rounded-2xl p-6 w-[290px] bg-white dark:bg-slate-800 shadow-xl border border-slate-200 dark:border-slate-700 transition-colors"
        onClick={(e) => e.stopPropagation()}>
        <p className="text-base font-bold text-slate-900 dark:text-slate-100 mb-2 transition-colors">Clear selected location?</p>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed transition-colors">
          This will remove:<br />· Selected location marker<br />· Hospitals on map<br />· Any active routes
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-xl text-sm font-semibold border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="flex-1 py-2 rounded-xl text-sm font-semibold bg-rose-500 text-white shadow-sm hover:bg-rose-600 transition-colors">
            Clear
          </button>
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
    <div className={`${delay} voyageour-panel rounded-2xl p-5 relative overflow-hidden transition-colors duration-200`}
      style={{ 
        background: 'rgb(var(--bg-elevated))',
        border: '1px solid rgb(var(--border-primary))',
        boxShadow: 'var(--shadow-sm)'
      }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-bold tracking-wider uppercase transition-colors" 
          style={{ color: 'rgb(var(--text-tertiary))' }}>
          {title}
        </p>
        {onClear && (
          <button onClick={onClear} title="Clear selection" 
            className="flex items-center justify-center rounded-lg w-6 h-6 transition-colors"
            style={{ color: 'rgb(var(--text-tertiary))' }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgb(var(--danger) / 0.1)';
              e.currentTarget.style.color = 'rgb(var(--danger))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'rgb(var(--text-tertiary))';
            }}>
            ✕
          </button>
        )}
      </div>
      {!risk ? (
        <div className="flex flex-col gap-2">
          <div className="h-3 rounded-full w-[60%] transition-colors" 
            style={{ background: 'rgb(var(--bg-tertiary))' }} />
          <div className="h-2 rounded-full w-[40%] transition-colors" 
            style={{ background: 'rgb(var(--bg-tertiary))' }} />
        </div>
      ) : risk.error ? (
        <p className="text-sm font-medium transition-colors" 
          style={{ color: 'rgb(var(--danger))' }}>
          {risk.error}
        </p>
      ) : (
        <>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl mb-4 shadow-sm"
            style={{ background: colors.bg, border: `1px solid ${colors.border}` }}>
            <span className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse" 
              style={{ background: colors.accent }} />
            <span className="text-xs font-bold tracking-wide" 
              style={{ color: colors.text, fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
              {level} RISK
            </span>
          </div>
          {district && (
            <p className="text-base font-bold mb-0.5 transition-colors" 
              style={{ 
                color: 'rgb(var(--text-primary))',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              }}>
              {district}
            </p>
          )}
          {state && (
            <p className="text-xs font-medium mb-4 transition-colors" 
              style={{ 
                color: 'rgb(var(--text-secondary))',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
              }}>
              {state}
            </p>
          )}
          {score !== undefined && (
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-semibold transition-colors" 
                  style={{ 
                    color: 'rgb(var(--text-secondary))',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  }}>
                  Crime Score
                </span>
                <span className="text-xs font-bold" 
                  style={{ 
                    color: colors.text,
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  }}>
                  {score10} / 10
                </span>
              </div>
              <div className="rounded-full overflow-hidden h-1.5 transition-colors"
                style={{ background: 'rgb(var(--bg-tertiary))' }}>
                <div className="h-full rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${barPct}%`, background: colors.accent }} />
              </div>
            </div>
          )}
          {hasData && (onFocus || onHospitals) && (
            <div className="flex gap-3">
              {onFocus && (
                <button onClick={onFocus} 
                  className="flex-1 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm"
                  style={{
                    background: 'rgb(var(--bg-tertiary))',
                    border: '1px solid rgb(var(--border-primary))',
                    color: 'rgb(var(--text-secondary))',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgb(var(--bg-secondary))';
                    e.currentTarget.style.color = 'rgb(var(--text-primary))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgb(var(--bg-tertiary))';
                    e.currentTarget.style.color = 'rgb(var(--text-secondary))';
                  }}>
                  Focus on Map
                </button>
              )}
              {onHospitals && (
                <button onClick={onHospitals} 
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-colors shadow-sm`}
                  style={{
                    background: hospitalsActive ? 'rgb(var(--success) / 0.15)' : 'rgb(var(--success) / 0.08)',
                    border: hospitalsActive ? '1px solid rgb(var(--success) / 0.3)' : '1px solid rgb(var(--success) / 0.15)',
                    color: hospitalsActive ? 'rgb(var(--success))' : 'rgb(var(--success) / 0.8)',
                    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgb(var(--success) / 0.2)';
                    e.currentTarget.style.color = 'rgb(var(--success))';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = hospitalsActive ? 'rgb(var(--success) / 0.15)' : 'rgb(var(--success) / 0.08)';
                    e.currentTarget.style.color = hospitalsActive ? 'rgb(var(--success))' : 'rgb(var(--success) / 0.8)';
                  }}>
                  {hospitalsActive ? "Hide Hospitals" : "Show Hospitals"}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
