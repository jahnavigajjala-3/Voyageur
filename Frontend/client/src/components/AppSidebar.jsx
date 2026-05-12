import { useContext, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Compass, MessageSquare, LogOut } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { useRouteContext } from "../context/RouteContext";

const NAV_ITEMS = [
  { icon: Home,          label: "Home",         path: "/dashboard" },
  { icon: Compass,       label: "Trip Guide",   path: "/trip-guide" },
  { icon: MessageSquare, label: "AI Assistant", path: "/chat" },
];

export default function AppSidebar() {
  const [isExpanded, setIsExpanded] = useState(false);
  const { isGuest, logout } = useContext(AuthContext);
  const { resetSession } = useRouteContext();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    resetSession();
    logout();
    navigate("/login");
  };

  return (
    <aside
      onMouseEnter={() => setIsExpanded(true)}
      onMouseLeave={() => setIsExpanded(false)}
      style={{
        width: isExpanded ? "180px" : "64px",
        minHeight: "100vh",
        height: "100vh",
        position: "sticky",
        top: 0,
        zIndex: 20,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: isExpanded ? "flex-start" : "center",
        padding: "20px 0",
        gap: "8px",
        background: "rgb(var(--bg-secondary) / 0.92)",
        borderRight: "1px solid rgb(var(--border-primary))",
        backdropFilter: "blur(20px)",
        transition: "width 0.25s ease, align-items 0.25s ease",
      }}
    >
      {/* Logo mark */}
      <div
        onClick={() => navigate("/")}
        title="Voyageur"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: isExpanded ? "flex-start" : "center",
          width: isExpanded ? "100%" : "auto",
          padding: isExpanded ? "0 12px" : "0",
          marginBottom: "16px",
          gap: "12px",
          flexShrink: 0,
          cursor: "pointer",
        }}
      >
        <div
          style={{
            width: "36px",
            height: "36px",
            borderRadius: "10px",
            background: "linear-gradient(145deg, rgb(var(--accent-cyan)), rgb(var(--accent-primary)))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 8px 20px -10px rgb(var(--accent-cyan) / 0.5)",
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" style={{ width: "18px", height: "18px" }}>
            <path
              d="M12 3.5a6 6 0 0 0-6 6c0 4.6 6 11 6 11s6-6.4 6-11a6 6 0 0 0-6-6Z"
              stroke="white"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <circle cx="12" cy="9.5" r="2.2" fill="white" />
            <path
              d="M4.5 20c2-1.4 4.5-2 7.5-2s5.5.6 7.5 2"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </svg>
        </div>
        {isExpanded && (
          <span
            style={{
              fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
              fontSize: "1rem",
              fontWeight: 700,
              color: "rgb(var(--text-primary))",
              whiteSpace: "nowrap",
            }}
          >
            Voyageur
          </span>
        )}
      </div>

      {/* Nav items */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%", alignItems: isExpanded ? "flex-start" : "center", padding: isExpanded ? "0 12px" : "0" }}>
        {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
          const isActive = pathname === path || (path === "/dashboard" && pathname === "/");
          return (
            <button
              key={label}
              onClick={() => navigate(path)}
              title={label}
              style={{
                width: isExpanded ? "100%" : "40px",
                height: "40px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: isExpanded ? "flex-start" : "center",
                gap: isExpanded ? "10px" : "0",
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                background: isActive
                  ? "rgb(var(--accent-cyan) / 0.12)"
                  : "transparent",
                color: isActive
                  ? "rgb(var(--accent-cyan))"
                  : "rgb(var(--text-tertiary))",
                outline: isActive ? "1px solid rgb(var(--accent-cyan) / 0.25)" : "none",
                padding: isExpanded ? "0 14px" : "0",
                overflow: "hidden",
                whiteSpace: "nowrap",
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
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.75} />
              {isExpanded && (
                <span style={{ fontSize: "0.95rem", fontWeight: 500, color: "inherit" }}>{label}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Live dot */}
      <div
        title="AI online"
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: "rgb(var(--accent-cyan))",
          boxShadow: "0 0 0 3px rgb(var(--accent-cyan) / 0.15)",
          marginBottom: "8px",
          flexShrink: 0,
        }}
      />

      {/* Logout */}
      <button
        onClick={handleLogout}
        title={isGuest ? "Exit guest" : "Logout"}
        style={{
          width: isExpanded ? "100%" : "40px",
          height: "40px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: isExpanded ? "flex-start" : "center",
          gap: isExpanded ? "10px" : "0",
          border: "none",
          cursor: "pointer",
          background: "transparent",
          color: "rgb(var(--text-tertiary))",
          transition: "all 0.15s ease",
          padding: isExpanded ? "0 14px" : "0",
          overflow: "hidden",
          whiteSpace: "nowrap",
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
        <LogOut size={16} strokeWidth={1.75} />
        {isExpanded && (
          <span style={{ fontSize: "0.95rem", fontWeight: 500, color: "inherit" }}>
            Logout
          </span>
        )}
      </button>
    </aside>
  );
}
