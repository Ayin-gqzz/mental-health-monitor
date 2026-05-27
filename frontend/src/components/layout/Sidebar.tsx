import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import {
  LayoutDashboard, Activity, ClipboardList, Users, BarChart3, AlertTriangle, LogOut,
} from "lucide-react";

const studentLinks = [
  { path: "/student", label: "首页", icon: LayoutDashboard },
  { path: "/student/behavior", label: "行为记录", icon: Activity },
  { path: "/student/assessments", label: "评估记录", icon: ClipboardList },
];

const counselorLinks = [
  { path: "/counselor", label: "工作台", icon: LayoutDashboard },
  { path: "/counselor/students", label: "学生管理", icon: Users },
  { path: "/counselor/statistics", label: "统计分析", icon: BarChart3 },
  { path: "/counselor/alerts", label: "预警信息", icon: AlertTriangle },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, displayName, logout } = useAuthStore();

  const links = role === "counselor" ? counselorLinks : studentLinks;

  return (
    <aside style={{
      width: 240, background: "#1a1a2e", color: "#fff", display: "flex",
      flexDirection: "column", padding: "16px 0",
    }}>
      <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #333" }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>🧠 心理健康监控</h2>
        <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>
          {role === "counselor" ? "辅导员" : "学生"} · {displayName}
        </p>
      </div>
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {links.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              width: "100%", padding: "10px 20px", border: "none",
              background: location.pathname === path ? "#16213e" : "transparent",
              color: location.pathname === path ? "#e94560" : "#ccc",
              cursor: "pointer", fontSize: 14, textAlign: "left",
            }}
          >
            <Icon size={18} />
            {label}
          </button>
        ))}
      </nav>
      <button
        onClick={() => { logout(); navigate("/login"); }}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          width: "100%", padding: "10px 20px", border: "none",
          background: "transparent", color: "#ccc", cursor: "pointer",
          fontSize: 14, borderTop: "1px solid #333",
        }}
      >
        <LogOut size={18} />
        退出登录
      </button>
    </aside>
  );
}
