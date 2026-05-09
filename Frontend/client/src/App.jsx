import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Component } from "react";
import { AuthProvider } from "./context/AuthContext";
import { RouteProvider } from "./context/RouteContext";
import Home from "./Pages/Home";
import Login from "./Pages/Login";
import Signup from "./Pages/Signup";
import Dashboard from "./Pages/dashboard";
import TripGuide from "./Pages/TripGuide";
import ChatBox from "./components/ChatBox";
import ProtectedRoute from "./components/ProtectedRoute";

// ---------------------------------------------------------------------------
// Error boundary — catches unhandled React render errors so the whole app
// doesn't go blank. Shows a minimal fallback UI instead.
// ---------------------------------------------------------------------------
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // In production you'd send this to a monitoring service (e.g. Sentry)
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            background: "#05050f",
            color: "rgba(255,255,255,0.7)",
            fontFamily: "'Inter','Segoe UI',sans-serif",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "32px" }}>⚠️</p>
          <p style={{ fontSize: "18px", fontWeight: 600, color: "rgba(255,255,255,0.9)" }}>
            Something went wrong
          </p>
          <p style={{ fontSize: "13px", color: "rgba(255,255,255,0.4)", maxWidth: "360px" }}>
            An unexpected error occurred. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "8px",
              padding: "10px 24px",
              borderRadius: "10px",
              background: "linear-gradient(135deg, rgba(139,92,246,0.7), rgba(59,130,246,0.7))",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "#fff",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Refresh
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <RouteProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <ChatBox />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/trip-guide"
                element={
                  <ProtectedRoute>
                    <TripGuide />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </RouteProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
