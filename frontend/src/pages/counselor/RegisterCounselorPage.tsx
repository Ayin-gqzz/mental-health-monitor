import { useState } from "react";
import { registerCounselor } from "../../api/counselor";
import { User, Lock, AlertCircle, CheckCircle } from "lucide-react";

export default function RegisterCounselorPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

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

    setLoading(true);
    try {
      await registerCounselor(username, password, displayName);
      setSuccess(`辅导员 "${displayName}" 注册成功`);
      setUsername("");
      setPassword("");
      setConfirmPassword("");
      setDisplayName("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "注册失败，用户名可能已被占用");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="page-header">
        <h1>➕ 注册新辅导员</h1>
        <p className="subtitle">创建新的辅导员账号</p>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 28 }}>
        <div className="form-group">
          <label className="form-label">用户名</label>
          <div style={{ position: "relative" }}>
            <User size={16} style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }} />
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="用于登录"
              className="input"
              style={{ paddingLeft: 40 }}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">显示名称</label>
          <div style={{ position: "relative" }}>
            <User size={16} style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }} />
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="如：张老师"
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
              placeholder="请设置密码（至少6位）"
              className="input"
              style={{ paddingLeft: 40 }}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">确认密码</label>
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }} />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入密码"
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

        {success && (
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 14px", borderRadius: "var(--radius-md)",
            background: "var(--success-light)", color: "var(--success)",
            fontSize: 13, marginBottom: 16,
          }}>
            <CheckCircle size={16} />
            {success}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn btn-primary" style={{ width: "100%", padding: "12px 0", fontSize: 14 }}>
          {loading ? "注册中..." : "注册"}
        </button>
      </form>
    </div>
  );
}
