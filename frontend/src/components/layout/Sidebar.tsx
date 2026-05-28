import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { getUnreadCount } from "../../api/counselor";
import {
  LayoutDashboard, Activity, ClipboardList, Users, BarChart3, AlertTriangle, LogOut,
  FlaskConical, LineChart, KeyRound, UserPlus,
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
  { path: "/counselor/stat-analysis", label: "统计检验", icon: FlaskConical },
  { path: "/counselor/model-evaluation", label: "模型评估", icon: LineChart },
  { path: "/counselor/alerts", label: "预警信息", icon: AlertTriangle, badge: true },
  { path: "/counselor/change-password", label: "修改密码", icon: KeyRound },
  { path: "/counselor/register", label: "注册辅导员", icon: UserPlus },
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, displayName, logout } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);

  const links = role === "counselor" ? counselorLinks : studentLinks;

  useEffect(() => {
    if (role === "counselor") {
      getUnreadCount().then((r) => setUnreadCount(r.unread_count)).catch(() => {});
      const timer = setInterval(() => {
        getUnreadCount().then((r) => setUnreadCount(r.unread_count)).catch(() => {});
      }, 30000);
      return () => clearInterval(timer);
    }
  }, [role]);

  return (
    <aside style={{
      width: 240, background: "#1a1a2e", color: "#fff", display: "flex",
      flexDirection: "column", padding: "16px 0",
    }}>
      <div style={{ padding: "0 20px 24px", borderBottom: "1px solid #333" }}>
        <h2 style={{ fontSize: 16, margin: 0 }}>心理健康监控</h2>
        <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>
          {role === "counselor" ? "辅导员" : "学生"} · {displayName}
        </p>
      </div>
      <nav style={{ flex: 1, padding: "12px 0" }}>
        {links.map(({ path, label, icon: Icon, badge }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              display: "flex", alignItems: "center", gap: 12,
              width: "100%", padding: "10px 20px", border: "none",
              background: location.pathname === path ? "#16213e" : "transparent",
              color: location.pathname === path ? "#e94560" : "#ccc",
              cursor: "pointer", fontSize: 14, textAlign: "left",
              position: "relative",
            }}
          >
            <Icon size={18} />
            {label}
            {badge && unreadCount > 0 && (
              <span style={{
                position: "absolute", right: 16, top: "50%", transform: "translateY(-50%)",
                background: "#e94560", color: "#fff", borderRadius: 10,
                padding: "1px 7px", fontSize: 11, fontWeight: 700, minWidth: 18, textAlign: "center",
              }}>
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
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
