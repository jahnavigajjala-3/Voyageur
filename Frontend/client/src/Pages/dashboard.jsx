import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import CrimeMap from "../components/CrimeMap";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-6">

      {/* Top Bar */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Amigo 🌍</h1>

        <button
          onClick={logout}
          className="bg-black text-white px-4 py-2 rounded-lg"
        >
          Logout
        </button>
      </div>

      {/* Welcome Card */}
      <div className="bg-white p-6 rounded-xl shadow mb-6">
        <h2 className="text-xl font-semibold">
          Welcome {user?.email}
        </h2>
        <p className="text-gray-600 mt-2">
          Your smart travel assistant is active 🚀
        </p>
      </div>

      {/* Map */}
      <div className="bg-white p-4 rounded-xl shadow mb-6">
        <h2 className="text-lg font-semibold mb-3">Live Location</h2>
        <CrimeMap />
      </div>

      {/* AI Chat Button */}
      <div className="text-center">
        <button
          onClick={() => navigate("/chat")}
          className="bg-black text-white px-6 py-3 rounded-xl"
        >
          Open AI Assistant 🤖
        </button>
      </div>

    </div>
  );
}