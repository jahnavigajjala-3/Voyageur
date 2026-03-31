import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export default function Home() {
  const { user, logout } = useContext(AuthContext);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Amigo 🌍</h1>

        {user && (
          <button
            onClick={logout}
            className="bg-black text-white px-4 py-2 rounded-lg"
          >
            Logout
          </button>
        )}
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