import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, loginCounselor } from "../api/auth";
import { useAuthStore } from "../stores/authStore";
import { Brain, User, Lock, AlertCircle, GraduationCap, Briefcase } from "lucide-react";

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
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg, #4f6ef7 0%, #6366f1 50%, #818cf8 100%)",
      padding: 20,
      position: "relative",
      overflow: "hidden",
    }}>
      {/* Decorative elements */}
      <div style={{
        position: "absolute", top: -120, right: -120,
        width: 400, height: 400, borderRadius: "50%",
        background: "rgba(255,255,255,0.06)",
      }} />
      <div style={{
        position: "absolute", bottom: -180, left: -80,
        width: 500, height: 500, borderRadius: "50%",
        background: "rgba(255,255,255,0.04)",
      }} />
      <div style={{
        position: "absolute", top: "40%", left: "10%",
        width: 200, height: 200, borderRadius: "50%",
        background: "rgba(255,255,255,0.03)",
      }} />

      <div style={{
        width: "100%", maxWidth: 420,
        background: "var(--bg-card)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "0 25px 60px rgba(0,0,0,0.15)",
        padding: "48px 40px",
        animation: "scaleIn 0.4s ease",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: "var(--primary-bg)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 16, boxShadow: "0 8px 20px rgba(79, 110, 247, 0.3)",
          }}>
            <Brain size={32} color="#fff" />
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            心理健康监控系统
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            大学生心理健康动态监测与预警系统
          </p>
        </div>

        {/* Role Toggle */}
        <div style={{
          display: "flex", marginBottom: 28, borderRadius: "var(--radius-md)",
          overflow: "hidden", border: "1.5px solid var(--border)", background: "var(--bg-page)",
        }}>
          {[
            { key: "student" as const, label: "学生", icon: GraduationCap },
            { key: "counselor" as const, label: "辅导员", icon: Briefcase },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setRole(key)}
              style={{
                flex: 1, padding: "10px 0", border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                background: role === key ? "var(--primary)" : "transparent",
                color: role === key ? "#fff" : "var(--text-secondary)",
                fontWeight: role === key ? 600 : 400,
                fontSize: 13,
                transition: "all var(--transition-fast)",
              }}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{role === "counselor" ? "用户名" : "学号"}</label>
            <div style={{ position: "relative" }}>
              <User size={16} style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }} />
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={role === "counselor" ? "请输入用户名" : "请输入学号"}
                className="input"
                style={{ paddingLeft: 40 }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">密码</label>
            <div style={{ position: "relative" }}>
              <Lock size={16} style={{
                position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
                color: "var(--text-muted)",
              }} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="请输入密码"
                className="input"
                style={{ paddingLeft: 40 }}
              />
            </div>
          </div>

          {error && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "10px 14px", borderRadius: "var(--radius-md)",
              background: "var(--danger-light)", color: "var(--danger)",
              fontSize: 13, marginBottom: 16,
            }}>
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: "100%", padding: "12px 0", fontSize: 14, marginTop: 4 }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.3)", borderTopColor: "#fff" }} />
                登录中...
              </span>
            ) : "登录"}
          </button>
        </form>

        <div style={{ marginTop: 24, padding: "14px 16px", borderRadius: "var(--radius-md)", background: "var(--bg-page)", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.7 }}>
          <p style={{ fontWeight: 600, color: "var(--text-secondary)", marginBottom: 4 }}>演示账号</p>
          <p>学生：学号 <code style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "1px 6px", borderRadius: 4 }}>1001</code> / 密码 <code style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "1px 6px", borderRadius: 4 }}>123456</code></p>
          <p>辅导员：<code style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "1px 6px", borderRadius: 4 }}>counselor</code> / <code style={{ background: "var(--primary-light)", color: "var(--primary)", padding: "1px 6px", borderRadius: 4 }}>123456</code></p>
        </div>

        <p style={{ textAlign: "center", marginTop: 20, fontSize: 13, color: "var(--text-muted)" }}>
          还没有学生账号？{" "}
          <a href="/register" style={{ color: "var(--primary)", fontWeight: 600 }}>立即注册</a>
        </p>
      </div>
    </div>
  );
}
