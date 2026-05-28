import { useState } from "react";
import { registerCounselor } from "../../api/counselor";
import { useAuthStore } from "../../stores/authStore";

export default function RegisterCounselorPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const { setAuth } = useAuthStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!username || !password || !confirmPassword || !displayName) {
      setError("请填写所有字段");
      return;
    }
    if (password !== confirmPassword) {
      setError("两次输入的密码不一致");
      return;
    }
    if (password.length < 6) {
      setError("密码长度不能少于6位");
      return;
    }

    try {
      const data = await registerCounselor(username, password, displayName);
      setSuccess(`辅导员 "${displayName}" 注册成功`);
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setDisplayName("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "注册失败，用户名可能已被占用");
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ marginBottom: 24 }}>注册新辅导员</h1>

      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, color: "#555" }}>用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="用于登录"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, color: "#555" }}>显示名称</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="如：张老师"
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, color: "#555" }}>密码</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, color: "#555" }}>确认密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        {error && <p style={{ color: "#e94560", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ color: "#22c55e", fontSize: 13, marginBottom: 12 }}>{success}</p>}

        <button type="submit" style={{ width: "100%", padding: 10, background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          注册
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box",
};
