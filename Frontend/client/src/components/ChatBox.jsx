import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { sendChatMessage } from "../api/api";
import useLocation from "../hooks/useLocation";

export default function ChatBox() {
  const navigate = useNavigate();
  const { location } = useLocation();
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm your AI travel companion. Ask me anything about safety, routes, or destinations." },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const userMsg = { role: "user", content: input };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setLoading(true);
    try {
      const tripCtx = location
        ? `User's current location: lat=${location.lat}, lng=${location.lng}`
        : "User location not available.";
      const data = await sendChatMessage({
        history: messages.slice(-5).filter((m) => m.content && m.role),
        message: input,
        trip_context: tripCtx,
      });
      setMessages([...history, { role: "assistant", content: data.response }]);
    } catch {
      setMessages([...history, { role: "assistant", content: "Sorry, something went wrong. Try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div
      className="flex flex-col h-screen"
      style={{
        background: "radial-gradient(ellipse at 20% 50%, rgba(88,28,135,0.08) 0%, transparent 60%), radial-gradient(ellipse at 80% 20%, rgba(30,58,138,0.08) 0%, transparent 60%), #05050f",
        fontFamily: "'Inter','Segoe UI',sans-serif",
      }}
    >
      {/* Header */}
      <header
        className="flex items-center justify-between px-6 py-4 flex-shrink-0"
        style={{
          background: "rgba(255,255,255,0.025)",
          backdropFilter: "blur(24px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <div className="flex items-center gap-3">
          {/* Back to dashboard */}
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center justify-center rounded-xl transition-all duration-200"
            style={{
              width: "34px", height: "34px", fontSize: "14px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.5)",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(139,92,246,0.12)"; e.currentTarget.style.color = "rgba(167,139,250,0.9)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
            title="Back to dashboard"
          >
            ←
          </button>

          <div
            className="anim-float flex items-center justify-center rounded-xl text-sm font-bold"
            style={{
              width: "36px", height: "36px",
              background: "linear-gradient(135deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))",
              boxShadow: "0 0 16px rgba(139,92,246,0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
              color: "#fff",
            }}
          >
            AI
          </div>

          <div>
            <p
              className="text-sm font-semibold"
              style={{
                background: "linear-gradient(90deg, #e2e8f0, #a5b4fc)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              AI Assistant
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "#22c55e", boxShadow: "0 0 5px #22c55e" }}
              />
              <span className="text-xs" style={{ color: "rgba(255,255,255,0.3)" }}>Online · Travel companion</span>
            </div>
          </div>
        </div>

        {/* Message count */}
        <span
          className="text-xs px-3 py-1 rounded-full"
          style={{
            background: "rgba(139,92,246,0.1)",
            border: "1px solid rgba(139,92,246,0.2)",
            color: "rgba(167,139,250,0.7)",
          }}
        >
          {messages.length} messages
        </span>
      </header>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto px-6 py-6"
        style={{
          background: "radial-gradient(ellipse at top, rgba(139,92,246,0.04) 0%, transparent 50%)",
        }}
      >
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className="anim-fade-in flex"
              style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
            >
              {/* Assistant avatar */}
              {msg.role === "assistant" && (
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-xl mr-2.5 self-end mb-1 text-xs font-bold"
                  style={{
                    width: "28px", height: "28px",
                    background: "linear-gradient(135deg, rgba(139,92,246,0.6), rgba(59,130,246,0.6))",
                    border: "1px solid rgba(139,92,246,0.25)",
                    color: "#fff",
                  }}
                >
                  AI
                </div>
              )}

              <div
                className="text-sm leading-relaxed whitespace-pre-wrap"
                style={{
                  maxWidth: "72%",
                  padding: "12px 16px",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: msg.role === "user"
                    ? "linear-gradient(135deg, rgba(139,92,246,0.22), rgba(59,130,246,0.18))"
                    : "rgba(255,255,255,0.04)",
                  border: msg.role === "user"
                    ? "1px solid rgba(139,92,246,0.25)"
                    : "1px solid rgba(255,255,255,0.07)",
                  color: msg.role === "user"
                    ? "rgba(221,214,254,0.95)"
                    : "rgba(255,255,255,0.75)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-xl mr-2.5 self-end mb-1 text-xs font-bold"
                style={{
                  width: "28px", height: "28px",
                  background: "linear-gradient(135deg, rgba(139,92,246,0.6), rgba(59,130,246,0.6))",
                  border: "1px solid rgba(139,92,246,0.25)",
                  color: "#fff",
                }}
              >
                AI
              </div>
              <div
                className="flex items-center gap-1.5 px-4 py-3 rounded-2xl"
                style={{
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.07)",
                  backdropFilter: "blur(8px)",
                }}
              >
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{
                      background: "rgba(167,139,250,0.6)",
                      animation: `pulse-dot 1.2s ease-in-out ${d * 0.2}s infinite`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div
        className="flex-shrink-0 px-6 py-4"
        style={{
          background: "rgba(255,255,255,0.02)",
          backdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        <div className="max-w-2xl mx-auto flex gap-3 items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your destination..."
            className="glass-input flex-1 px-4 py-3 rounded-2xl text-sm"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "rgba(255,255,255,0.85)",
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="ctrl-btn flex items-center justify-center rounded-2xl flex-shrink-0"
            style={{
              width: "46px", height: "46px", fontSize: "16px",
              background: input.trim() && !loading
                ? "linear-gradient(135deg, rgba(139,92,246,0.8), rgba(59,130,246,0.8))"
                : "rgba(255,255,255,0.05)",
              border: "1px solid rgba(139,92,246,0.25)",
              color: input.trim() && !loading ? "#fff" : "rgba(255,255,255,0.2)",
              boxShadow: input.trim() && !loading ? "0 0 16px rgba(139,92,246,0.3)" : "none",
              transition: "all 0.2s ease",
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
