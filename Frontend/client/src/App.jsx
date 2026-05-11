import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Component } from "react";
import { AuthProvider } from "./context/AuthContext";
import { RouteProvider } from "./context/RouteContext";
import { ThemeProvider } from "./context/ThemeContext";
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
            background: "#fafaf9",
            color: "#64748b",
            fontFamily: "'Inter','Segoe UI',sans-serif",
            gap: "16px",
            padding: "24px",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "32px" }}>⚠️</p>
          <p style={{ fontSize: "18px", fontWeight: 600, color: "#0f172a" }}>
            Something went wrong
          </p>
          <p style={{ fontSize: "13px", color: "#64748b", maxWidth: "360px" }}>
            An unexpected error occurred. Please refresh the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "8px",
              padding: "10px 24px",
              borderRadius: "10px",
              background: "#0d9488",
              border: "1px solid #0f766e",
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
    <ThemeProvider>
      <AuthProvider>
        <RouteProvider>
          <ErrorBoundary>
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
          </ErrorBoundary>
        </RouteProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
