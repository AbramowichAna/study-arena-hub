import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, X, ArrowLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupDetail,
});

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);

  const load = async () => {
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("group_members").select("id,role,user_id,profiles(name,email)").eq("group_id", groupId),
    ]);
    setGroup(g);
    setMembers((m as any) ?? []);
  };
  useEffect(() => { load(); }, [groupId]);

  if (!group) return <div className="text-muted-foreground">Loading…</div>;

  const isAdmin = group.admin_id === user?.id;
  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/groups (code: ${group.invite_code})` : group.invite_code;

  const leave = async () => {
    if (!user) return;
    const { error } = await supabase.from("group_members").delete().match({ group_id: groupId, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Left group");
    navigate({ to: "/groups" });
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("group_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Removed");
    load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => navigate({ to: "/groups" })} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <div>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{members.length} members</p>
      </div>

      <Card className="p-5 border-[0.5px]">
        <div className="text-sm font-medium mb-2">Invite code</div>
        <div className="flex gap-2">
          <Input readOnly value={group.invite_code} className="font-mono" />
          <Button variant="outline" onClick={() => { navigator.clipboard.writeText(group.invite_code); toast.success("Copied"); }}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Share this code so others can join via Groups → Join.</p>
      </Card>

      <Card className="p-5 border-[0.5px]">
        <div className="text-sm font-medium mb-3">Members</div>
        <div className="space-y-2">
          {members.map(m => (
            <div key={m.id} className="flex items-center gap-3 py-2 border-b last:border-0">
              <Avatar name={m.profiles?.name ?? "?"} />
              <div className="flex-1">
                <div className="text-sm font-medium">{m.profiles?.name}</div>
                <div className="text-xs text-muted-foreground">{m.profiles?.email}</div>
              </div>
              <Badge variant="outline">{m.role}</Badge>
              {isAdmin && m.user_id !== user?.id && (
                <Button variant="ghost" size="icon" onClick={() => remove(m.id)}>
                  <X className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </Card>

      {!isAdmin && (
        <Button variant="outline" className="text-destructive" onClick={leave}>Leave group</Button>
      )}
    </div>
  );
}
