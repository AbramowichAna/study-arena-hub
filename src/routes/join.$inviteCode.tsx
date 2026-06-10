import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/join/$inviteCode")({
  component: JoinPage,
});

function JoinPage() {
  const { inviteCode } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/register", search: { invite: inviteCode } as any });
      return;
    }
    (async () => {
      const { data: g, error } = await supabase.from("groups").select("id").eq("invite_code", inviteCode).maybeSingle();
      if (error || !g) {
        toast.error("Invalid invite link");
        navigate({ to: "/groups" });
        return;
      }
      const { error: e2 } = await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id });
      if (e2 && !e2.message.includes("duplicate")) {
        toast.error(e2.message);
      } else {
        toast.success("Joined group!");
      }
      navigate({ to: "/groups/$groupId", params: { groupId: g.id } });
    })();
  }, [loading, user?.id, inviteCode]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-muted-foreground text-sm">Joining group…</div>
    </div>
  );
}
