import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { Navigate } from "react-router-dom";

// Smart redirect — authenticated users and guests go to dashboard,
// everyone else goes to login.
export default function Home() {
  const { user, isGuest, loading } = useContext(AuthContext);

  if (loading) return null;

  if (user || isGuest) return <Navigate to="/dashboard" replace />;

  return <Navigate to="/login" replace />;
}
