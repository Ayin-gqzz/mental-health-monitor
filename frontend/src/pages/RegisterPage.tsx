import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { register } from "../api/auth";
import { useAuthStore } from "../stores/authStore";

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
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" }}>
      <div style={{ background: "#fff", borderRadius: 16, padding: 40, width: 440, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <h1 style={{ textAlign: "center", marginBottom: 24 }}>📝 学生注册</h1>
        <form onSubmit={handleSubmit}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <input placeholder="学号" value={form.student_id} onChange={(e) => update("student_id", e.target.value)} style={inputStyle} />
            <input placeholder="姓名" value={form.name} onChange={(e) => update("name", e.target.value)} style={inputStyle} />
            <input type="number" placeholder="年龄" value={form.age} onChange={(e) => update("age", +e.target.value)} style={inputStyle} />
            <select value={form.gender} onChange={(e) => update("gender", e.target.value)} style={inputStyle}>
              <option>男</option><option>女</option>
            </select>
            <select value={form.department} onChange={(e) => update("department", e.target.value)} style={inputStyle}>
              {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
            </select>
            <input type="number" step="0.01" placeholder="学分绩点" value={form.cgpa} onChange={(e) => update("cgpa", +e.target.value)} style={inputStyle} />
          </div>
          <input type="password" placeholder="密码" value={form.password} onChange={(e) => update("password", e.target.value)} style={{ ...inputStyle, width: "100%", marginTop: 12 }} />
          {error && <p style={{ color: "#e94560", fontSize: 13, marginTop: 8 }}>{error}</p>}
          <button type="submit" disabled={loading} style={{ width: "100%", padding: 12, marginTop: 16, background: "#e94560", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, cursor: "pointer" }}>
            {loading ? "注册中..." : "注册"}
          </button>
        </form>
        <p style={{ textAlign: "center", marginTop: 12 }}>
          <a href="/login" style={{ color: "#666", fontSize: 13 }}>已有账号？去登录</a>
        </p>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: 10, border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box",
};
