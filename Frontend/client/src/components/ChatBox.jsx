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
      const data = await sendChatMessage({
        history: messages.slice(-5).filter((m) => m.content && m.role),
        message: input,
        trip_context: "",
        current_lat: location?.lat ?? null,
        current_lng: location?.lng ?? null,
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
    <div className="flex flex-col h-screen font-sans" style={{ background: 'rgb(var(--bg-primary))' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 flex-shrink-0 border-b shadow-sm z-10" style={{
        background: 'rgb(var(--bg-secondary))',
        borderColor: 'rgb(var(--border-primary))',
      }}>
        <div className="flex items-center gap-3">
          {/* Back to dashboard */}
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center justify-center rounded-xl transition-all duration-200 w-9 h-9 text-sm border shadow-sm"
            style={{
              background: 'rgb(var(--bg-secondary))',
              borderColor: 'rgb(var(--border-primary))',
              color: 'rgb(var(--text-secondary))',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgb(var(--bg-tertiary))';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgb(var(--bg-secondary))';
            }}
            title="Back to dashboard"
          >
            ←
          </button>

          <div
            className="flex items-center justify-center rounded-xl text-sm font-bold w-9 h-9 text-white shadow-sm"
            style={{
              background: 'linear-gradient(135deg, rgb(var(--accent-cyan)), rgb(var(--accent-primary)))',
            }}
          >
            AI
          </div>

          <div>
            <p className="text-sm font-bold" style={{ color: 'rgb(var(--text-primary))' }}>
              AI Assistant
            </p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_4px_#10b981]" />
              <span className="text-xs font-medium" style={{ color: 'rgb(var(--text-secondary))' }}>Online · Travel companion</span>
            </div>
          </div>
        </div>

        {/* Message count */}
        <span className="text-xs font-bold px-3 py-1 rounded-full border" style={{
          background: 'rgb(var(--bg-tertiary))',
          color: 'rgb(var(--text-secondary))',
          borderColor: 'rgb(var(--border-primary))',
        }}>
          {messages.length} messages
        </span>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-6" style={{ background: 'rgb(var(--bg-tertiary) / 0.3)' }}>
        <div className="max-w-2xl mx-auto flex flex-col gap-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className="anim-fade-in flex"
              style={{ justifyContent: msg.role === "user" ? "flex-end" : "flex-start" }}
            >
              {/* Assistant avatar */}
              {msg.role === "assistant" && (
                <div className="flex-shrink-0 flex items-center justify-center rounded-xl mr-2.5 self-end mb-1 text-xs font-bold w-7 h-7 text-white shadow-sm"
                  style={{
                    background: 'linear-gradient(135deg, rgb(var(--accent-cyan)), rgb(var(--accent-primary)))',
                  }}
                >
                  AI
                </div>
              )}

              <div
                className="text-sm leading-relaxed whitespace-pre-wrap px-4 py-3 shadow-sm font-medium border"
                style={{ 
                  maxWidth: "75%",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  background: msg.role === "user" ? 'rgb(var(--accent-cyan))' : 'rgb(var(--bg-elevated))',
                  color: msg.role === "user" ? '#ffffff' : 'rgb(var(--text-primary))',
                  borderColor: msg.role === "user" ? 'rgb(var(--accent-cyan))' : 'rgb(var(--border-primary))',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="flex-shrink-0 flex items-center justify-center rounded-xl mr-2.5 self-end mb-1 text-xs font-bold w-7 h-7 text-white shadow-sm"
                style={{
                  background: 'linear-gradient(135deg, rgb(var(--accent-cyan)), rgb(var(--accent-primary)))',
                }}
              >
                AI
              </div>
              <div className="flex items-center gap-1.5 px-4 py-3 rounded-2xl border shadow-sm" style={{
                background: 'rgb(var(--bg-elevated))',
                borderColor: 'rgb(var(--border-primary))',
              }}>
                {[0, 1, 2].map((d) => (
                  <span
                    key={d}
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ 
                      background: 'rgb(var(--accent-cyan))',
                      animation: `pulse-dot 1.2s ease-in-out ${d * 0.2}s infinite` 
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
      <div className="flex-shrink-0 px-6 py-4 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)] z-10" style={{
        background: 'rgb(var(--bg-secondary))',
        borderColor: 'rgb(var(--border-primary))',
      }}>
        <div className="max-w-2xl mx-auto flex gap-3 items-center">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Ask anything about your destination..."
            className="flex-1 px-4 py-3 rounded-xl text-sm border focus:outline-none focus:ring-2 transition-colors"
            style={{
              background: 'rgb(var(--bg-tertiary))',
              borderColor: 'rgb(var(--border-primary))',
              color: 'rgb(var(--text-primary))',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'rgb(var(--accent-cyan))';
              e.currentTarget.style.boxShadow = '0 0 0 2px rgb(var(--accent-cyan) / 0.1)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'rgb(var(--border-primary))';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center rounded-xl flex-shrink-0 w-12 h-12 text-lg font-bold transition-all duration-200 disabled:opacity-50 border"
            style={{
              background: input.trim() && !loading ? 'rgb(var(--accent-cyan))' : 'rgb(var(--bg-tertiary))',
              borderColor: input.trim() && !loading ? 'rgb(var(--accent-cyan))' : 'rgb(var(--border-primary))',
              color: input.trim() && !loading ? '#fff' : 'rgb(var(--text-tertiary))',
              boxShadow: input.trim() && !loading ? '0 2px 4px rgb(var(--accent-cyan) / 0.2)' : 'none',
            }}
          >
            ↑
          </button>
        </div>
      </div>
    </div>
  );
}
