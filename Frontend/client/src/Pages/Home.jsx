import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-gray-100">

      <h1 className="text-4xl font-bold mb-4">Amigo 🌍</h1>
      <p className="text-gray-600 mb-6">
        Your AI Travel Companion
      </p>

      {!user ? (
        <div className="space-x-4">
          <button
            onClick={() => navigate("/login")}
            className="bg-black text-white px-6 py-3 rounded-lg"
          >
            Login
          </button>

          <button
            onClick={() => navigate("/signup")}
            className="bg-gray-300 px-6 py-3 rounded-lg"
          >
            Signup
          </button>
        </div>
      ) : (
        <button
          onClick={() => navigate("/dashboard")}
          className="bg-black text-white px-6 py-3 rounded-lg"
        >
          Go to Dashboard 🚀
        </button>
      )}
    </div>
  );
}