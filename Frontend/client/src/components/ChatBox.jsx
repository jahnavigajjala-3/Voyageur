import { useState, useEffect, useRef } from "react";
import { sendChatMessage } from "../api/api";
import useLocation from "../hooks/useLocation";

export default function ChatBox() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hi! I'm Amigo 🌍 Your safety companion. Ask me anything about your destination.",
    },
  ]);
  const [input, setInput]     = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef(null);
  const { location }          = useLocation();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const buildTripContext = () => {
    if (location) {
      return `User's current live location: lat=${location.lat}, lng=${location.lng}`;
    }
    return "User location not available.";
  };

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage = { role: "user", content: input };
    const updatedHistory = [...messages, userMessage];
    setMessages(updatedHistory);
    setInput("");
    setLoading(true);

    try {
      const data = await sendChatMessage({
        history: messages
        .slice(-5)
        .filter(m => m.content && m.role), // previous messages only, not including current
        message: input,
        trip_context: buildTripContext(),
      });

      setMessages([
        ...updatedHistory,
        { role: "assistant", content: data.response },
      ]);
    } catch (_) { // eslint-disable-line no-unused-vars
      setMessages([
        ...updatedHistory,
        { role: "assistant", content: "Sorry, something went wrong. Try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">

      {/* Header */}
      <div className="bg-slate-900/95 border-b border-slate-800 p-4 md:p-6">
        <div className="max-w-6xl mx-auto flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.35em] text-cyan-300/70">
                Voyageur AI Assistant
              </p>
              
            </div>
            <div className="hidden md:flex items-center gap-2 rounded-2xl bg-slate-800/90 px-4 py-2 text-sm text-slate-300 ring-1 ring-white/5">
            </div>
          </div>
          
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(79,70,229,0.08),_transparent_25%),_rgba(15,23,42,1)]">
        <div className="max-w-6xl mx-auto space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-xs md:max-w-2xl px-5 py-3 rounded-3xl text-sm leading-6 whitespace-pre-wrap shadow-[0_16px_50px_-40px_rgba(15,23,42,0.8)] ${
                  msg.role === "user"
                    ? "bg-cyan-500/15 text-cyan-100 ring-1 ring-cyan-400/20 rounded-br-none"
                    : "bg-slate-900/90 text-slate-100 ring-1 ring-slate-700/60 rounded-bl-none"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-slate-900/90 text-slate-400 px-5 py-3 rounded-3xl shadow-[0_16px_50px_-40px_rgba(15,23,42,0.8)] text-sm animate-pulse ring-1 ring-slate-700/50">
                Amigo is thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input */}
      <div className="p-4 md:p-6 bg-slate-900/95 border-t border-slate-800">
        <div className="max-w-6xl mx-auto flex flex-col gap-3 md:flex-row md:items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here..."
            className="flex-1 rounded-2xl border border-slate-700/80 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/20"
          />
          <button
            onClick={handleSend}
            disabled={loading}
            className="inline-flex items-center justify-center rounded-2xl bg-cyan-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 md:ml-4"
          >
            Send
          </button>
        </div>
      </div>

    </div>
  );
}