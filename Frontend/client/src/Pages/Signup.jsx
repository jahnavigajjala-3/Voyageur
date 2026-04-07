import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate } from "react-router-dom";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      await signup(form.name, form.email, form.password);
      alert("Signup successful ✅");
      navigate("/dashboard");
    } catch (err) {
      console.error("SIGNUP ERROR:", err);
      alert("Signup failed");
    }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-green-400 via-blue-500 to-purple-600 relative overflow-hidden">
      {/* Background travel imagery effect */}
      <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800')] bg-cover bg-center opacity-20"></div>
      
      <div className="relative z-10 bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl w-96 border border-white/20">
        <h2 className="text-3xl font-bold mb-6 text-center text-white">Join Amigo</h2>
        <p className="text-center text-white/80 mb-6">Start your travel adventure</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="text"
            placeholder="Full Name"
            className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
            onChange={(e) =>
              setForm({ ...form, name: e.target.value })
            }
          />

          <input
            type="email"
            placeholder="Email"
            className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
            onChange={(e) =>
              setForm({ ...form, email: e.target.value })
            }
          />

          <input
            type="password"
            placeholder="Password"
            className="w-full p-3 bg-white/20 border border-white/30 rounded-lg text-white placeholder-white/70 focus:outline-none focus:ring-2 focus:ring-white/50"
            onChange={(e) =>
              setForm({ ...form, password: e.target.value })
            }
          />

          <button className="w-full bg-white/20 hover:bg-white/30 text-white p-3 rounded-lg border border-white/30 transition-all duration-200">
            Create Account
          </button>
        </form>

        <p className="text-sm text-center mt-4 text-white/80">
          Already have an account?{" "}
          <span
            onClick={() => navigate("/login")}
            className="text-white hover:text-white/80 cursor-pointer underline"
          >
            Login
          </span>
        </p>
      </div>
    </div>
  );
}