import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, loginCounselor } from "../api/auth";
import { useAuthStore } from "../stores/authStore";
import { LogIn } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"student" | "counselor">("student");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const fn = role === "counselor" ? loginCounselor : login;
      const res = await fn({ username, password });
      setAuth(res.access_token, res.role, res.display_name, res.user_id);
      navigate(`/${res.role}`);
    } catch {
      setError("用户名或密码错误");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
    }}>
      <div style={{
        background: "#fff", borderRadius: 16, padding: 40, width: 400,
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        <h1 style={{ textAlign: "center", marginBottom: 8, fontSize: 24 }}>
          🧠 心理健康监测系统
        </h1>
        <p style={{ textAlign: "center", color: "#666", marginBottom: 24 }}>
          大学生心理健康动态监测与预警系统
        </p>

        <div style={{ display: "flex", marginBottom: 24, borderRadius: 8, overflow: "hidden", border: "1px solid #ddd" }}>
          <button
            onClick={() => setRole("student")}
            style={{
              flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
              background: role === "student" ? "#e94560" : "#f5f5f5",
              color: role === "student" ? "#fff" : "#333",
              fontWeight: role === "student" ? 600 : 400,
            }}
          >
            学生
          </button>
          <button
            onClick={() => setRole("counselor")}
            style={{
              flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
              background: role === "counselor" ? "#e94560" : "#f5f5f5",
              color: role === "counselor" ? "#fff" : "#333",
              fontWeight: role === "counselor" ? 600 : 400,
            }}
          >
            辅导员
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            placeholder={role === "counselor" ? "用户名" : "学号"}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{
              width: "100%", padding: 12, marginBottom: 12, border: "1px solid #ddd",
              borderRadius: 8, fontSize: 14, boxSizing: "border-box",
            }}
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{
              width: "100%", padding: 12, marginBottom: 12, border: "1px solid #ddd",
              borderRadius: 8, fontSize: 14, boxSizing: "border-box",
            }}
          />
          {error && <p style={{ color: "#e94560", fontSize: 13, marginBottom: 8 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: "100%", padding: 12, background: "#1a1a2e", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 15, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            }}
          >
            <LogIn size={18} />
            {loading ? "登录中..." : "登录"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 16, fontSize: 13, color: "#888" }}>
          演示：学号 "1001" / 密码 "123456"
        </p>
        <p style={{ textAlign: "center", marginTop: 4, fontSize: 13, color: "#888" }}>
          辅导员："counselor" / "123456"
        </p>
        <p style={{ textAlign: "center", marginTop: 8 }}>
          <a href="/register" style={{ color: "#e94560", fontSize: 13 }}>注册新学生账号</a>
        </p>
      </div>
    </div>
  );
}
