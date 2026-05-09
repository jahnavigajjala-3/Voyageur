import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

// The root "/" route acts as a smart redirect:
//   - Still loading auth state → show nothing (ProtectedRoute handles the spinner)
//   - Authenticated           → go straight to dashboard
//   - Not authenticated       → go to login
export default function Home() {
  const { user, loading } = useContext(AuthContext);

  if (loading) return null; // AuthContext is still reading localStorage

  if (user) return <Navigate to="/dashboard" replace />;

  return <Navigate to="/login" replace />;
}
