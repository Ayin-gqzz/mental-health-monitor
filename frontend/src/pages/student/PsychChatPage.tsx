import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Send, ArrowLeft, Bot, User } from "lucide-react";

const COUNSELOR_REPLY = "我特别懂你熬夜失眠、看书毫无头绪又满心迷茫的煎熬，别逼自己硬扛，先放过紧绷的自己，睡前放下书本停止内耗，复习不用追求高强度，从很短的小任务慢慢找回状态，考研只是人生一条路，不必把所有未来押在这一次，允许自己疲惫低落，先好好安抚身心，调整好节奏再往前走就好。";

interface Message {
  role: "user" | "counselor";
  text: string;
  time: string;
}

export default function PsychChatPage() {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "counselor",
      text: "你好，我是你的心理咨询师。有什么想聊的都可以跟我说，我会认真倾听。",
      time: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || typing) return;

    const now = new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });

    // 添加用户消息
    const userMsg: Message = { role: "user", text: input.trim(), time: now };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    // 模拟打字延迟
    setTimeout(() => {
      const counselorMsg: Message = { role: "counselor", text: COUNSELOR_REPLY, time: now };
      setMessages((prev) => [...prev, counselorMsg]);
      setTyping(false);
    }, 1500);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 56px)" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "var(--bg-card)",
      }}>
        <button className="btn btn-ghost btn-sm" onClick={() => navigate("/student")} style={{ padding: "6px 8px" }}>
          <ArrowLeft size={16} />
        </button>
        <div style={{
          width: 40, height: 40, borderRadius: "50%",
          background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "#fff", flexShrink: 0,
        }}>
          <Bot size={20} />
        </div>
        <div>
          <h2 style={{ margin: 0, fontSize: 16 }}>心理咨询师</h2>
          <p style={{ margin: 0, fontSize: 12, color: "var(--success)" }}>在线</p>
        </div>
      </div>

      {/* Messages */}
      <div style={{
        flex: 1,
        overflow: "auto",
        padding: "20px",
        background: "var(--bg-page)",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                marginBottom: 16,
                gap: 8,
              }}
            >
              {msg.role === "counselor" && (
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#fff",
                }}>
                  <Bot size={18} />
                </div>
              )}
              <div style={{ maxWidth: "75%" }}>
                <div style={{
                  padding: "12px 16px",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: msg.role === "user" ? "var(--primary)" : "var(--bg-card)",
                  color: msg.role === "user" ? "#fff" : "var(--text-primary)",
                  boxShadow: "var(--shadow-sm)",
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: "pre-wrap",
                }}>
                  {msg.text}
                </div>
                <p style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  margin: "4px 0 0",
                  textAlign: msg.role === "user" ? "right" : "left",
                }}>
                  {msg.time}
                </p>
              </div>
              {msg.role === "user" && (
                <div style={{
                  width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                  background: "var(--primary-light)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--primary)",
                }}>
                  <User size={18} />
                </div>
              )}
            </div>
          ))}

          {typing && (
            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #8b5cf6, #6366f1)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff",
              }}>
                <Bot size={18} />
              </div>
              <div style={{
                padding: "14px 18px",
                borderRadius: "16px 16px 16px 4px",
                background: "var(--bg-card)",
                boxShadow: "var(--shadow-sm)",
              }}>
                <div style={{ display: "flex", gap: 4 }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)", animation: "bounce 1.4s infinite ease-in-out", animationDelay: "0s" }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)", animation: "bounce 1.4s infinite ease-in-out", animationDelay: "0.2s" }} />
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--text-muted)", animation: "bounce 1.4s infinite ease-in-out", animationDelay: "0.4s" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div style={{
        padding: "16px 20px",
        borderTop: "1px solid var(--border)",
        background: "var(--bg-card)",
      }}>
        <div style={{ maxWidth: 700, margin: "0 auto", display: "flex", gap: 12 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            placeholder="输入你想说的话..."
            className="input"
            style={{ flex: 1 }}
            disabled={typing}
          />
          <button
            className="btn btn-primary"
            onClick={handleSend}
            disabled={typing || !input.trim()}
            style={{ padding: "0 16px" }}
          >
            <Send size={16} />
          </button>
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0); }
          40% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
