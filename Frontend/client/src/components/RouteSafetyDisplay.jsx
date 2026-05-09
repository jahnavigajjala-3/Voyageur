import { useState, useMemo } from "react";

const getRiskColor = (level) => {
  switch (level?.toLowerCase()) {
    case "low":    return "#22c55e";
    case "medium": return "#eab308";
    case "high":   return "#ef4444";
    default:       return "#64748b";
  }
};

const getScoreColor = (score) => {
  // 1–10 scale: 1 = lowest risk (green), 10 = highest risk (red)
  if (score <= 3.5) return "#22c55e";
  if (score <= 6.5) return "#eab308";
  return "#ef4444";
};

const fmt = {
  duration: (s) => {
    const m = Math.round(s / 60);
    return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m} min`;
  },
  distance: (m) => `${(m / 1000).toFixed(1)} km`,
};

const TAB_CONFIG = {
  safest:      { label: "Safest",  icon: "🛡️", activeColor: "rgba(34,197,94,0.15)",  activeBorder: "rgba(34,197,94,0.4)",  activeText: "#86efac" },
  alternative: { label: "Normal",  icon: "🗺️", activeColor: "rgba(59,130,246,0.15)", activeBorder: "rgba(59,130,246,0.4)", activeText: "#93c5fd" },
};

const RouteCard = ({ route, isActive, onSelect }) => {
  const scoreColor = getScoreColor(route.safety_score);
  const riskColor  = getRiskColor(route.risk_level);

  return (
    <div
      onClick={() => onSelect?.(route.id)}
      style={{
        padding: "14px",
        borderRadius: "14px",
        border: isActive ? "1px solid rgba(139,92,246,0.45)" : "1px solid rgba(255,255,255,0.07)",
        background: isActive ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.02)",
        cursor: "pointer",
        transition: "all 0.18s ease",
      }}
    >
      {/* Top row */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "10px" }}>
        <div>
          <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.85)", marginBottom: "2px" }}>
            {route.summary || route.type?.toUpperCase()}
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span style={{
              fontSize: "10px", padding: "2px 7px", borderRadius: "6px",
              background: `${riskColor}20`, color: riskColor, fontWeight: 600,
            }}>
              {route.risk_level?.toUpperCase() || "UNKNOWN"} RISK
            </span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ fontSize: "22px", fontWeight: 700, color: scoreColor, lineHeight: 1 }}>
            {route.safety_score?.toFixed ? route.safety_score.toFixed(1) : route.safety_score}
          </p>
          <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", marginTop: "1px" }}>/ 10</p>
        </div>
      </div>

      {/* Score bar — fill represents risk level on 1–10 scale */}
      <div style={{ marginBottom: "10px" }}>
        <div style={{ position: "relative", height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{
            position: "absolute", left: 0, top: 0, height: "100%",
            width: `${((route.safety_score - 1) / 9) * 100}%`, borderRadius: "3px",
            background: scoreColor,
            boxShadow: `0 0 6px ${scoreColor}60`,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: "8px" }}>
        {[
          { label: "Distance", value: fmt.distance(route.distance) },
          { label: "Duration", value: fmt.duration(route.duration) },
        ].map(({ label, value }) => (
          <div key={label} style={{
            flex: 1, padding: "7px 10px", borderRadius: "9px",
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)",
            textAlign: "center",
          }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", marginBottom: "2px" }}>{label}</p>
            <p style={{ fontSize: "12px", fontWeight: 600, color: "rgba(255,255,255,0.8)" }}>{value}</p>
          </div>
        ))}
      </div>

      {isActive && (
        <div style={{ marginTop: "10px", textAlign: "center" }}>
          <span style={{ fontSize: "10px", color: "rgba(167,139,250,0.8)", fontWeight: 500 }}>
            ✓ Selected on map
          </span>
        </div>
      )}
    </div>
  );
};

const RouteSafetyDisplay = ({
  routes = [],
  onRouteSelect,
  activeRouteId,
  isLoading = false,
}) => {
  const [tab, setTab] = useState("safest");

  // Pick the route for each tab
  const routeByTab = useMemo(() => {
    const find = (type) => routes.find((r) => r.type === type);
    return {
      safest:      find("safest")      || routes[0],
      alternative: find("alternative") || routes[routes.length - 1],
    };
  }, [routes]);

  const activeRoute = routeByTab[tab] || routeByTab["safest"] || routes[0];

  // Comparison between safest and normal
  const comparison = useMemo(() => {
    const s = routeByTab.safest;
    const n = routeByTab.alternative;
    if (!s || !n || s.id === n.id) return null;
    return {
      riskDiff: parseFloat((s.safety_score - n.safety_score).toFixed(1)),
      timeDiff: Math.round((s.duration - n.duration) / 60),
    };
  }, [routeByTab]);

  if (isLoading) {
    return (
      <div style={{
        padding: "20px", borderRadius: "18px",
        background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(24px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "18px", height: "18px", borderRadius: "50%",
            border: "2px solid rgba(139,92,246,0.3)",
            borderTopColor: "rgba(139,92,246,0.9)",
            animation: "spin 0.8s linear infinite",
          }} />
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.5)" }}>Computing safe routes…</p>
        </div>
      </div>
    );
  }

  if (!routes || routes.length === 0) return null;

  return (
    <div style={{
      borderRadius: "18px",
      background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)",
      backdropFilter: "blur(24px)", boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{ padding: "14px 16px 0" }}>
        <p style={{ fontSize: "11px", fontWeight: 600, color: "rgba(255,255,255,0.3)", letterSpacing: "0.1em", marginBottom: "10px" }}>
          ROUTE SAFETY
        </p>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
          {Object.entries(TAB_CONFIG).map(([key, cfg]) => {
            const isActive = tab === key;
            const route = routeByTab[key];
            return (
              <button
                key={key}
                onClick={() => {
                  setTab(key);
                  if (route) onRouteSelect?.(route.id);
                }}
                style={{
                  flex: 1, padding: "7px 4px", borderRadius: "10px", cursor: "pointer",
                  background: isActive ? cfg.activeColor : "rgba(255,255,255,0.04)",
                  border: `1px solid ${isActive ? cfg.activeBorder : "rgba(255,255,255,0.07)"}`,
                  color: isActive ? cfg.activeText : "rgba(255,255,255,0.4)",
                  fontSize: "11px", fontWeight: isActive ? 600 : 400,
                  transition: "all 0.18s ease",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
                }}
              >
                <span style={{ fontSize: "14px" }}>{cfg.icon}</span>
                <span>{cfg.label}</span>
                {route && (
                  <span style={{ fontSize: "9px", opacity: 0.7 }}>
                    {route.safety_score?.toFixed ? route.safety_score.toFixed(1) : route.safety_score}/10
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Route card */}
      <div style={{ padding: "0 16px 14px" }}>
        {activeRoute ? (
          <RouteCard
            route={activeRoute}
            isActive={activeRouteId === activeRoute.id}
            onSelect={onRouteSelect}
          />
        ) : (
          <p style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)", textAlign: "center", padding: "16px 0" }}>
            No route available for this option
          </p>
        )}

        {/* Comparison strip */}
        {comparison && (
          <div style={{
            marginTop: "10px", padding: "10px 12px", borderRadius: "10px",
            background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)",
            display: "flex", justifyContent: "space-between", alignItems: "center",
          }}>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", marginBottom: "2px" }}>Risk diff</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: comparison.riskDiff < 0 ? "#86efac" : "#fde68a" }}>
                {comparison.riskDiff > 0 ? `+${comparison.riskDiff}` : comparison.riskDiff} pts
              </p>
            </div>
            <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.2)" }}>vs normal</div>
            <div style={{ textAlign: "center" }}>
              <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", marginBottom: "2px" }}>Time diff</p>
              <p style={{ fontSize: "13px", fontWeight: 700, color: comparison.timeDiff > 0 ? "#fde68a" : "#86efac" }}>
                {comparison.timeDiff > 0 ? `+${comparison.timeDiff} min` : comparison.timeDiff < 0 ? `${comparison.timeDiff} min` : "Same"}
              </p>
            </div>
          </div>
        )}

        {/* All routes mini-list */}
        {routes.length > 1 && (
          <div style={{ marginTop: "10px" }}>
            <p style={{ fontSize: "9px", color: "rgba(255,255,255,0.25)", marginBottom: "6px", letterSpacing: "0.08em" }}>
              ALL ROUTES
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {routes.map((r) => (
                <div
                  key={r.id}
                  onClick={() => {
                    onRouteSelect?.(r.id);
                    const tabKey = r.type === "safest" ? "safest" : "alternative";
                    setTab(tabKey);
                  }}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "6px 10px", borderRadius: "8px", cursor: "pointer",
                    background: activeRouteId === r.id ? "rgba(139,92,246,0.1)" : "rgba(255,255,255,0.02)",
                    border: `1px solid ${activeRouteId === r.id ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.05)"}`,
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "11px" }}>
                      {r.type === "safest" ? "🛡️" : "🗺️"}
                    </span>
                    <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.6)", textTransform: "capitalize" }}>
                      {r.type === "safest" ? "Safest" : "Normal"}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{ fontSize: "10px", color: "rgba(255,255,255,0.4)" }}>
                      {fmt.duration(r.duration)}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: getScoreColor(r.safety_score) }}>
                      {r.safety_score?.toFixed ? r.safety_score.toFixed(1) : r.safety_score}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default RouteSafetyDisplay;
