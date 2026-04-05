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
        history: messages, // previous messages only, not including current
        message: input,
        trip_context: buildTripContext(),
      });

      setMessages([
        ...updatedHistory,
        { role: "assistant", content: data.response },
      ]);
    } catch (err) {
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
    <div className="flex flex-col h-screen bg-gray-100">

      {/* Header */}
      <div className="bg-black text-white p-4 text-lg font-bold">
        Amigo AI Assistant 🤖
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-xs md:max-w-md px-4 py-2 rounded-2xl text-sm whitespace-pre-wrap ${
                msg.role === "user"
                  ? "bg-black text-white rounded-br-none"
                  : "bg-white text-gray-800 shadow rounded-bl-none"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-400 px-4 py-2 rounded-2xl shadow text-sm animate-pulse">
              Amigo is thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="p-4 bg-white border-t flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your destination..."
          className="flex-1 border rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-black"
        />
        <button
          onClick={handleSend}
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded-xl text-sm disabled:opacity-50"
        >
          Send
        </button>
      </div>

    </div>
  );
}