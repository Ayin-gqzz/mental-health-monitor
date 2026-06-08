import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";
import { getUnreadCount } from "../../api/counselor";
import {
  LayoutDashboard, Activity, ClipboardList, Users, BarChart3, AlertTriangle, LogOut,
  FlaskConical, LineChart, KeyRound, UserPlus, Brain, ChevronLeft, ChevronRight,
  ClipboardCheck, History,
} from "lucide-react";

const studentLinks = [
  { path: "/student", label: "首页", icon: LayoutDashboard },
  { path: "/student/behavior", label: "行为记录", icon: Activity },
  { path: "/student/assessments", label: "评估记录", icon: ClipboardList },
  { path: "/student/weekly-assessment", label: "心理测评", icon: ClipboardCheck },
  { path: "/student/weekly-history", label: "测评记录", icon: History },
];

const counselorLinks = [
  { group: "核心功能", items: [
    { path: "/counselor", label: "工作台", icon: LayoutDashboard },
    { path: "/counselor/students", label: "学生管理", icon: Users },
    { path: "/counselor/alerts", label: "预警信息", icon: AlertTriangle, badge: true },
  ]},
  { group: "数据分析", items: [
    { path: "/counselor/statistics", label: "统计分析", icon: BarChart3 },
    { path: "/counselor/stat-analysis", label: "统计检验", icon: FlaskConical },
    { path: "/counselor/model-evaluation", label: "模型评估", icon: LineChart },
  ]},
  { group: "系统管理", items: [
    { path: "/counselor/change-password", label: "修改密码", icon: KeyRound },
    { path: "/counselor/register", label: "注册辅导员", icon: UserPlus },
  ]},
];

export function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { role, displayName, logout } = useAuthStore();
  const [unreadCount, setUnreadCount] = useState(0);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (role === "counselor") {
      getUnreadCount().then((r) => setUnreadCount(r.unread_count)).catch(() => {});
      const timer = setInterval(() => {
        getUnreadCount().then((r) => setUnreadCount(r.unread_count)).catch(() => {});
      }, 30000);
      return () => clearInterval(timer);
    }
  }, [role]);

  const sidebarWidth = collapsed ? 68 : 240;

  return (
    <aside style={{
      width: sidebarWidth,
      minWidth: sidebarWidth,
      background: "var(--bg-sidebar)",
      color: "#fff",
      display: "flex",
      flexDirection: "column",
      transition: "width 0.3s ease, min-width 0.3s ease",
      overflow: "hidden",
      position: "relative",
    }}>
      {/* Logo */}
      <div style={{
        padding: collapsed ? "20px 0" : "20px 20px 24px",
        borderBottom: "1px solid rgba(255,255,255,0.12)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: "rgba(255,255,255,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          <Brain size={20} />
        </div>
        {!collapsed && (
          <div style={{ overflow: "hidden" }}>
            <h2 style={{ fontSize: 15, margin: 0, fontWeight: 700, whiteSpace: "nowrap" }}>心理健康监控</h2>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "2px 0 0", whiteSpace: "nowrap" }}>
              {role === "counselor" ? "辅导员" : "学生"} · {displayName}
            </p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: collapsed ? "12px 0" : "12px 0", overflowY: "auto" }}>
        {role === "counselor" ? (
          counselorLinks.map((group, gi) => (
            <div key={gi} style={{ marginBottom: 8 }}>
              {!collapsed && (
                <p className="section-title" style={{ color: "rgba(255,255,255,0.45)", padding: "8px 20px 4px", fontSize: 11 }}>
                  {group.group}
                </p>
              )}
              {collapsed && gi > 0 && (
                <div style={{ height: 1, background: "rgba(255,255,255,0.1)", margin: "8px 12px" }} />
              )}
              {group.items.map(({ path, label, icon: Icon, badge }) => (
                <SidebarItem
                  key={path}
                  label={label}
                  Icon={Icon}
                  active={location.pathname === path}
                  collapsed={collapsed}
                  badge={badge && unreadCount > 0 ? unreadCount : 0}
                  onClick={() => navigate(path)}
                />
              ))}
            </div>
          ))
        ) : (
          studentLinks.map(({ path, label, icon: Icon }) => (
            <SidebarItem
              key={path}
              label={label}
              Icon={Icon}
              active={location.pathname === path}
              collapsed={collapsed}
              onClick={() => navigate(path)}
            />
          ))
        )}
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          width: "100%", padding: "10px 0", border: "none",
          background: "rgba(255,255,255,0.08)", color: "rgba(255,255,255,0.6)",
          cursor: "pointer", transition: "all var(--transition-fast)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.15)"; e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "rgba(255,255,255,0.6)"; }}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>

      {/* Logout */}
      <button
        onClick={() => { logout(); navigate("/login"); }}
        style={{
          display: "flex", alignItems: "center", gap: 12,
          width: "100%", padding: collapsed ? "14px 0" : "14px 20px",
          justifyContent: collapsed ? "center" : "flex-start",
          border: "none", background: "rgba(255,255,255,0.06)",
          color: "rgba(255,255,255,0.7)", cursor: "pointer",
          fontSize: 13, fontWeight: 500,
          transition: "all var(--transition-fast)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(239,68,68,0.25)"; e.currentTarget.style.color = "#fff"; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; e.currentTarget.style.color = "rgba(255,255,255,0.7)"; }}
      >
        <LogOut size={18} />
        {!collapsed && "退出登录"}
      </button>
    </aside>
  );
}

function SidebarItem({ label, Icon, active, collapsed, badge = 0, onClick }: {
  label: string; Icon: any; active: boolean; collapsed: boolean; badge?: number; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={collapsed ? label : undefined}
      style={{
        display: "flex", alignItems: "center", gap: 12,
        width: "100%", padding: collapsed ? "11px 0" : "10px 20px",
        justifyContent: collapsed ? "center" : "flex-start",
        border: "none", cursor: "pointer", fontSize: 13, textAlign: "left",
        position: "relative",
        background: active ? "rgba(255,255,255,0.18)" : "transparent",
        color: active ? "#fff" : "rgba(255,255,255,0.65)",
        fontWeight: active ? 600 : 400,
        borderRadius: collapsed ? 0 : "0 24px 24px 0",
        marginRight: collapsed ? 0 : 8,
        transition: "all var(--transition-fast)",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = "rgba(255,255,255,0.1)";
          e.currentTarget.style.color = "#fff";
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "rgba(255,255,255,0.65)";
        }
      }}
    >
      <Icon size={18} style={{ flexShrink: 0 }} />
      {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{label}</span>}
      {badge > 0 && (
        <span style={{
          position: "absolute", right: collapsed ? "50%" : 16,
          top: collapsed ? 4 : "50%",
          transform: collapsed ? "translateX(50%)" : "translateY(-50%)",
          background: "#ef4444", color: "#fff", borderRadius: 10,
          padding: "1px 7px", fontSize: 10, fontWeight: 700,
          minWidth: 18, textAlign: "center", lineHeight: "16px",
        }}>
          {badge > 99 ? "99+" : badge}
        </span>
      )}
    </button>
  );
}
