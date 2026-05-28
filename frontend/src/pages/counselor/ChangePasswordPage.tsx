import { useState } from "react";
import { changeCounselorPassword } from "../../api/counselor";

export default function ChangePasswordPage() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

    try {
      await changeCounselorPassword(oldPassword, newPassword);
      setSuccess("密码修改成功");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.response?.data?.detail || "修改失败，请检查旧密码是否正确");
    }
  };

  return (
    <div style={{ maxWidth: 480 }}>
      <h1 style={{ marginBottom: 24 }}>修改密码</h1>

      <form onSubmit={handleSubmit} style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, color: "#555" }}>当前密码</label>
          <input
            type="password"
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, color: "#555" }}>新密码</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", marginBottom: 6, fontSize: 14, color: "#555" }}>确认新密码</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            style={inputStyle}
          />
        </div>

        {error && <p style={{ color: "#e94560", fontSize: 13, marginBottom: 12 }}>{error}</p>}
        {success && <p style={{ color: "#22c55e", fontSize: 13, marginBottom: 12 }}>{success}</p>}

        <button type="submit" style={{ width: "100%", padding: 10, background: "#e94560", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 14, fontWeight: 600 }}>
          确认修改
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 14px", border: "1px solid #ddd", borderRadius: 8, fontSize: 14, boxSizing: "border-box",
};
