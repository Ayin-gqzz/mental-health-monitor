import { useState } from "react";
import { changeCounselorPassword } from "../../api/counselor";
import { Lock, AlertCircle, CheckCircle } from "lucide-react";

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!oldPassword || !newPassword || !confirmPassword) {
      setError("请填写所有字段");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("两次输入的新密码不一致");
      return;
    }
    if (newPassword.length < 6) {
      setError("新密码长度不能少于6位");
      return;
    }

    setLoading(true);
    try {
      await changeCounselorPassword(oldPassword, newPassword);
      setSuccess("密码修改成功");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "修改失败，请检查旧密码是否正确");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <div className="page-header">
        <h1>🔑 修改密码</h1>
        <p className="subtitle">更新您的登录密码</p>
      </div>

      <form onSubmit={handleSubmit} className="card" style={{ padding: 28 }}>
        <div className="form-group">
          <label className="form-label">当前密码</label>
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }} />
            <input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="请输入当前密码"
              className="input"
              style={{ paddingLeft: 40 }}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">新密码</label>
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }} />
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="请输入新密码（至少6位）"
              className="input"
              style={{ paddingLeft: 40 }}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">确认新密码</label>
          <div style={{ position: "relative" }}>
            <Lock size={16} style={{
              position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)",
              color: "var(--text-muted)",
            }} />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="请再次输入新密码"
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
          {loading ? "修改中..." : "确认修改"}
        </button>
      </form>
    </div>
  );
}
