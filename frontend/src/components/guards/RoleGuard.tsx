import { Navigate } from "react-router-dom";
import { useAuthStore } from "../../stores/authStore";

export function RoleGuard({ children, role }: { children: React.ReactNode; role: string }) {
  const userRole = useAuthStore((s) => s.role);
  if (userRole !== role) {
    return <Navigate to={`/${userRole}`} replace />;
  }
  return <>{children}</>;
}
