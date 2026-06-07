import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../api/auth";
import { useAuthStore } from "../stores/authStore";
import { Brain, AlertCircle, Lock } from "lucide-react";

const DEPARTMENTS = ["理学", "工学", "医学", "商学", "艺术"];

export default function RegisterPage() {
  const [form, setForm] = useState({
    student_id: "", name: "", password: "", age: 20, gender: "男", department: "理学", cgpa: 3.0,
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await register(form);
      setAuth(res.access_token, res.role, res.display_name, res.user_id);
      navigate("/student");
    } catch (err: any) {
      setError(err.response?.data?.detail || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  const update = (key: string, value: any) => setForm({ ...form, [key]: value });

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
        width: "100%", maxWidth: 480,
        background: "var(--bg-card)",
        borderRadius: "var(--radius-xl)",
        boxShadow: "0 25px 60px rgba(0,0,0,0.15)",
        padding: "48px 40px",
        animation: "scaleIn 0.4s ease",
        position: "relative",
        zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 14,
            background: "var(--primary-bg)",
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            marginBottom: 14, boxShadow: "0 8px 20px rgba(79, 110, 247, 0.3)",
          }}>
            <Brain size={28} color="#fff" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
            学生注册
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)" }}>
            创建您的心理健康监控账号
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="form-group">
              <label className="form-label">学号</label>
              <input
                value={form.student_id}
                onChange={(e) => update("student_id", e.target.value)}
                placeholder="请输入学号"
                className="input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">姓名</label>
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="请输入姓名"
                className="input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">年龄</label>
              <input
                type="number"
                value={form.age}
                onChange={(e) => update("age", +e.target.value)}
                className="input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">性别</label>
              <select value={form.gender} onChange={(e) => update("gender", e.target.value)} className="select">
                <option>男</option>
                <option>女</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">院系</label>
              <select value={form.department} onChange={(e) => update("department", e.target.value)} className="select">
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">学分绩点</label>
              <input
                type="number"
                step="0.01"
                value={form.cgpa}
                onChange={(e) => update("cgpa", +e.target.value)}
                className="input"
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
                value={form.password}
                onChange={(e) => update("password", e.target.value)}
                placeholder="请设置密码（至少6位）"
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
                注册中...
              </span>
            ) : "注册"}
          </button>
        </form>

        <p style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--text-muted)" }}>
          已有账号？{" "}
          <a href="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>去登录</a>
        </p>
      </div>
    </div>
  );
}
