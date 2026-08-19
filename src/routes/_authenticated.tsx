import { createFileRoute, Outlet, useNavigate, useLocation } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/_authenticated")({
  component: AuthLayout,
});

function AuthLayout() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  useEffect(() => {
    if (!loading && !user) {
      // Preserve the current URL as the intended destination
      const redirectTo = encodeURIComponent(location.pathname + location.search);
      navigate({ 
        to: "/login", 
        search: { redirect: redirectTo },
        replace: true 
      });
    }
  }, [user, loading, navigate, location]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Cargando…
      </div>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
