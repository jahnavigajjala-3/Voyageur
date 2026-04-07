import { useState } from "react";
import { useAuth } from "../hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import bgImage from "../assets/loginbg.jpg";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await login(form.email, form.password);
      navigate("/dashboard");
    } catch (err) {
      console.error("LOGIN ERROR:", err);
      alert("Login failed");
    }
  };

  return (
    <div
      className="min-h-screen bg-cover bg-center bg-no-repeat flex items-center"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      <div className="w-full px-6 sm:px-10 md:px-16 lg:px-20">
        <div
          className="
            w-full max-w-[460px]
            rounded-[34px]
            border border-white/30
            bg-white/20
            backdrop-blur-[18px]
            shadow-[0_20px_60px_rgba(0,0,0,0.18)]
            overflow-hidden
          "
        >
          <div className="bg-gradient-to-br from-white/20 via-white/10 to-blue-100/20 p-8 sm:p-10 md:p-12">
            <h2 className="text-[46px] leading-none font-bold text-slate-900 mb-4">
              Voyageur
            </h2>

            <p className="text-slate-700 text-lg mb-10">
              Login to access your account
            </p>

            <form onSubmit={handleSubmit} className="space-y-5">
              <input
                type="email"
                name="email"
                placeholder="Email"
                value={form.email}
                onChange={handleChange}
                className="
                  w-full h-16 px-6
                  rounded-full
                  bg-white/85
                  text-slate-800
                  placeholder:text-slate-500
                  outline-none
                  border border-white/40
                  focus:ring-2 focus:ring-blue-300
                  transition
                "
              />

              <input
                type="password"
                name="password"
                placeholder="Password"
                value={form.password}
                onChange={handleChange}
                className="
                  w-full h-16 px-6
                  rounded-full
                  bg-white/85
                  text-slate-800
                  placeholder:text-slate-500
                  outline-none
                  border border-white/40
                  focus:ring-2 focus:ring-blue-300
                  transition
                "
              />

              <button
                type="submit"
                className="
                  w-full h-16
                  rounded-full
                  bg-gradient-to-r from-green-800 to-green-500
                  hover:from-green-700 hover:to-green-400
                  text-white
                  text-2xl font-semibold
                  shadow-[0_10px_30px_rgba(20,120,50,0.35)]
                  transition-all duration-300
                "
              >
                Login
              </button>
            </form>

            <p className="text-sm text-slate-600 mt-6 text-center">
              Don&apos;t have an account?{" "}
              <Link
                to="/signup"
                className="font-semibold text-green-900 hover:text-green-700 transition"
              >
                Sign up
              </Link>
            </p>

            <p className="text-sm text-slate-600 mt-4 text-center">
              Secure login • Privacy protected
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}