import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Spinner } from "../components/ui/Spinner";
import { useAuth } from "../hooks/useAuth";

export default function RequireAuth() {
  const { data: user, isPending } = useAuth();
  const location = useLocation();

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--color-text-muted)]">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
