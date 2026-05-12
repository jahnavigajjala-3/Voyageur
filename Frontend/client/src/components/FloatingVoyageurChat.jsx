import { useEffect, useRef, useState } from "react";
import { useLottie } from "lottie-react";
import ghostAnimation from "../assets/Ghostsmart.json";
import { sendChatMessage } from "../api/api";
import useLocation from "../hooks/useLocation";
import { renderMarkdown } from "../utils/renderMarkdown";

function getWeatherLabel(code) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Storm";
  return "Unknown";
}

function FloatingChatLottie() {
  const { View } = useLottie({
    animationData: ghostAnimation,
    loop: true,
    autoplay: true,
    style: { width: 120, height: 120 },
  });
  return View;
}

/**
 * Floating AI assistant used on Dashboard (weather + route) and Trip Guide (trip context only).
 *
 * plannedRoute:
 *   - undefined → derive JSON payload from safeRoutes / selectedRouteId (dashboard)
 *   - null → no route scoring context (trip guide)
 *   - string → send as-is
 */
export default function FloatingVoyageurChat({
  open,
  onToggle,
  weather = null,
  safeRoutes = [],
  selectedRouteId = null,
  tripContextExtra = "",
  plannedRoute: plannedRouteProp,
  quickPrompts,
  variant = "default",
}) {
  const { location } = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  const isEmpty = messages.length === 0;
  const isTripGuide = variant === "trip-guide";
  const prompts =
    quickPrompts && quickPrompts.length > 0
      ? quickPrompts
      : isTripGuide
        ? [
            "Suggest 3 improvements to my itinerary",
            "What should I book first — train or hotel?",
            "Rain plan if weather turns bad?",
          ]
        : ["Is Mumbai safe?", "Hospitals near me", "Safest route"];

  useEffect(() => {
    if (open && !isEmpty) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, isEmpty]);

  const resolvePlannedRoute = () => {
    if (plannedRouteProp !== undefined) {
      return plannedRouteProp;
    }
    const activeRoute =
      safeRoutes.find((r) => r.id === selectedRouteId) ||
      safeRoutes.find((r) => r.type === "safest") ||
      safeRoutes[0] ||
      null;
    if (!activeRoute) return null;
    return JSON.stringify({
      summary: activeRoute.summary || "",
      distance: activeRoute.distance || 0,
      duration: activeRoute.duration || 0,
      risk_level: activeRoute.risk_level || "",
      safety_score: activeRoute.safety_score ?? null,
      polyline: activeRoute.geometry?.coordinates || [],
    });
  };

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const history = [...messages, userMsg];
    const outboundText = input;
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const weatherCtx = weather
        ? `Weather: ${getWeatherLabel(weather.weathercode)}, ${weather.temperature}°C, wind ${weather.windspeed} km/h.`
        : "";
      const tripContext = [weatherCtx, tripContextExtra].filter(Boolean).join("\n");

      const routePayload = resolvePlannedRoute();

      const data = await sendChatMessage({
        history: messages.slice(-5).filter((m) => m.content && m.role),
        message: outboundText,
        trip_context: tripContext,
        current_lat: location?.lat ?? null,
        current_lng: location?.lng ?? null,
        planned_route: routePayload,
      });
      setMessages([...history, { role: "assistant", content: data.response }]);
    } catch {
      setMessages([...history, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {open && (
        <div
          className="anim-fade-up fixed flex flex-col bg-white dark:bg-slate-900 border border-slate-200/50 dark:border-slate-700/50 rounded-2xl shadow-xl transition-colors duration-200"
          style={{
            bottom: "88px",
            right: "24px",
            width: "360px",
            height: "500px",
            zIndex: 9999,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              left: "15%",
              right: "15%",
              height: "2px",
              background: "linear-gradient(90deg, transparent, #0ea5e9, transparent)",
            }}
          />

          <div className="flex items-center justify-between px-4 py-3 flex-shrink-0 border-b border-slate-100 dark:border-slate-800 transition-colors">
            <div className="flex items-center gap-2.5">
              <div className="flex items-center justify-center rounded-xl text-xs font-bold bg-teal-500 text-white w-8 h-8 shadow-sm">
                AI
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 transition-colors">Voyageur AI</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 transition-colors">Online</span>
                </div>
              </div>
            </div>
            <button
              onClick={onToggle}
              className="flex items-center justify-center rounded-lg w-7 h-7 text-xs bg-slate-50 dark:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              title="Close chat"
              type="button"
            >
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 bg-slate-50/50 dark:bg-slate-900 transition-colors">
            {isEmpty ? (
              <div className="flex flex-col items-center justify-center h-full gap-2 text-center px-2">
                <FloatingChatLottie />
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Voyageur AI</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-relaxed">
                  {isTripGuide
                    ? "Trip-planning intelligence: itinerary tweaks, transport, pacing, packing, and alternatives matched to your form — plus safety and nearby places when relevant."
                    : "Ask about routes, safety, hospitals, or nearby places."}
                </p>
                <div className="flex flex-wrap justify-center gap-1.5 mt-1">
                  {prompts.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setInput(s)}
                      className="px-2.5 py-1 rounded-full text-[10px] font-medium border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-teal-400 hover:text-teal-600 dark:hover:text-teal-400 transition-colors bg-white dark:bg-slate-800"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className="anim-fade-in flex"
                  style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
                >
                  <div
                    className={`text-xs leading-relaxed whitespace-pre-wrap px-3 py-2 shadow-sm font-medium ${
                      msg.role === "user"
                        ? "rounded-[16px_16px_4px_16px] bg-teal-600 text-white"
                        : "rounded-[16px_16px_16px_4px] bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700"
                    }`}
                    style={{ maxWidth: "82%" }}
                  >
                    {renderMarkdown(msg.content)}
                  </div>
                </div>
              ))
            )}
            {loading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="w-1.5 h-1.5 rounded-full bg-teal-400"
                      style={{ animation: `pulse-dot 1.2s ease-in-out ${d * 0.2}s infinite` }}
                    />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="px-3 py-3 flex-shrink-0 flex gap-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-colors">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything..."
              className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-teal-400 dark:focus:border-teal-500 transition-colors"
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="flex items-center justify-center rounded-xl flex-shrink-0 w-9 h-9 text-sm font-bold transition-all duration-200 disabled:opacity-50"
              style={{
                background: input.trim() && !loading ? "#0d9488" : "#f1f5f9",
                border: input.trim() && !loading ? "1px solid #0f766e" : "1px solid #e2e8f0",
                color: input.trim() && !loading ? "#fff" : "#94a3b8",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={onToggle}
        className="fixed flex items-center justify-center rounded-full shadow-lg transition-all duration-300 z-[9999]"
        style={{
          bottom: "24px",
          right: "24px",
          width: "52px",
          height: "52px",
          cursor: "pointer",
          background: open ? "#f8fafc" : "#0d9488",
          border: open ? "1px solid #e2e8f0" : "1px solid #0f766e",
          color: open ? "#64748b" : "#fff",
          fontSize: open ? "16px" : "18px",
          transform: open ? "scale(0.9) rotate(45deg)" : "scale(1) rotate(0deg)",
        }}
        title="Voyageur AI"
      >
        {open ? "✕" : "✦"}
      </button>
    </>
  );
}
