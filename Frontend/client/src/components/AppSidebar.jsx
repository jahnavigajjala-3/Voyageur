import { useContext } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Home, Compass, MessageSquare, LogOut } from "lucide-react";
import { AuthContext } from "../context/AuthContext";
import { useRouteContext } from "../context/RouteContext";

const NAV_ITEMS = [
  { icon: Home,          label: "Home",       path: "/dashboard" },
  { icon: Compass,       label: "Trip Guide", path: "/trip-guide" },
  { icon: MessageSquare, label: "AI Chat",    path: "/chat" },
];

export default function AppSidebar() {
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
      style={{
        width: "64px",
        minHeight: "100vh",
        height: "100vh",
        position: "sticky",
        top: 0,
        zIndex: 20,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "20px 0",
        gap: "8px",
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
          width: "36px",
          height: "36px",
          borderRadius: "10px",
          background: "linear-gradient(145deg, rgb(var(--accent-cyan)), rgb(var(--accent-primary)))",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          marginBottom: "16px",
          flexShrink: 0,
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

      {/* Nav items */}
      <nav style={{ display: "flex", flexDirection: "column", gap: "4px", width: "100%", alignItems: "center" }}>
        {NAV_ITEMS.map(({ icon: Icon, label, path }) => {
          const isActive = pathname === path || (path === "/dashboard" && pathname === "/");
          return (
            <button
              key={label}
              onClick={() => navigate(path)}
              title={label}
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
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
          width: "40px",
          height: "40px",
          borderRadius: "10px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: "none",
          cursor: "pointer",
          background: "transparent",
          color: "rgb(var(--text-tertiary))",
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
        <LogOut size={16} strokeWidth={1.75} />
      </button>
    </aside>
  );
}
