import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Landing } from "@/components/marketing/Landing";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  if (loading || user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Cargando Study Arena…</div>
      </div>
    );
  }

  return <Landing />;
}
