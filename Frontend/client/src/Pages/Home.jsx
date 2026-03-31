import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Amigo 🌍</h1>

        <div className="space-x-3">
          {!user && (
            <>
              <button
                onClick={() => navigate("/login")}
                className="bg-black text-white px-4 py-2 rounded-lg"
              >
                Login
              </button>

              <button
                onClick={() => navigate("/signup")}
                className="bg-gray-300 px-4 py-2 rounded-lg"
              >
                Signup
              </button>
            </>
          )}

          {user && (
            <button
              onClick={logout}
              className="bg-black text-white px-4 py-2 rounded-lg"
            >
              Logout
            </button>
          )}
        </div>
      </div>

      <div className="bg-white p-6 rounded-xl shadow">
        <h2 className="text-xl font-semibold mb-2">
          Welcome {user?.email || "Traveler"}
        </h2>

        <p className="text-gray-600">
          Your AI travel assistant will appear here.
        </p>
      </div>
    </div>
  );
}