import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Swords, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { savePendingInvite } from "@/lib/pendingInvite";
import { notifyGroupsUpdated } from "@/lib/joinGroup";
import { toast } from "sonner";

type Preview = { group_id: string; group_name: string; member_count: number; invited_by: string };

export const Route = createFileRoute("/join/$token")({
  component: JoinPage,
});

function JoinPage() {
  const { token } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [generalError, setGeneralError] = useState(false);
  const [joining, setJoining] = useState(false);

  const loadPreview = async () => {
    setLoading(true); setNotFound(false); setGeneralError(false);
    const { data, error } = await supabase.rpc("get_group_invite_preview", { p_token: token });
    if (error) { setGeneralError(true); setLoading(false); return; }
    const row = (data ?? [])[0];
    if (!row) setNotFound(true);
    else setPreview(row as Preview);
    setLoading(false);
  };

  useEffect(() => { loadPreview(); }, [token]);

  const join = async () => {
    setJoining(true);
    const { data, error } = await supabase.rpc("join_group_via_invite_link", { p_token: token });
    if (error) {
      toast.error("No se pudo unir al grupo. Probá de nuevo.");
      setJoining(false);
      return;
    }
    notifyGroupsUpdated();
    navigate({ to: "/groups/$groupId", params: { groupId: data as string } });
  };

  const goAuth = (to: "/login" | "/register") => {
    if (preview) savePendingInvite({ token, groupId: preview.group_id });
    navigate({ to });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md p-8 border-[0.5px]">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-lg">Study Arena</div>
            <div className="text-xs text-muted-foreground">Invitación a un grupo</div>
          </div>
        </div>

        {loading || authLoading ? (
          <div className="text-sm text-muted-foreground py-6 text-center">Cargando…</div>
        ) : notFound ? (
          <div className="text-sm text-center py-6">Este link de invitación no es válido.</div>
        ) : generalError ? (
          <div className="text-center py-6 space-y-3">
            <div className="text-sm text-muted-foreground">Ocurrió un error al cargar la invitación.</div>
            <Button variant="outline" onClick={loadPreview}>Reintentar</Button>
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-lg font-semibold">{preview.group_name}</div>
              <div className="text-sm text-muted-foreground flex items-center justify-center gap-1 mt-1">
                <Users className="h-3.5 w-3.5" />
                {preview.member_count} {preview.member_count === 1 ? "miembro" : "miembros"}
              </div>
              <div className="text-xs text-muted-foreground mt-1">Te invita {preview.invited_by}</div>
            </div>
            {user ? (
              <Button className="w-full" onClick={join} disabled={joining}>
                {joining ? "Uniéndote…" : "Unirme"}
              </Button>
            ) : (
              <div className="space-y-2">
                <Button className="w-full" onClick={() => goAuth("/register")}>Crear cuenta</Button>
                <Button className="w-full" variant="outline" onClick={() => goAuth("/login")}>Iniciar sesión</Button>
              </div>
            )}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
