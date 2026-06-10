import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Copy, X, ArrowLeft, Trophy, Mail, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupDetail,
});

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.toISOString();
}

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [invites, setInvites] = useState<any[]>([]);
  const [ranking, setRanking] = useState<{ user_id: string; name: string; points: number }[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");

  const load = async () => {
    const [{ data: g }, { data: m }] = await Promise.all([
      supabase.from("groups").select("*").eq("id", groupId).maybeSingle(),
      supabase.from("group_members").select("id,role,user_id,profiles(name,email)").eq("group_id", groupId),
    ]);
    setGroup(g);
    setMembers((m as any) ?? []);

    const memberIds = ((m as any) ?? []).map((x: any) => x.user_id);
    if (memberIds.length) {
      const weekStart = startOfWeek();
      const { data: pe } = await supabase.from("point_events")
        .select("user_id,points,profiles(name)")
        .in("user_id", memberIds)
        .gte("created_at", weekStart);
      const map = new Map<string, { user_id: string; name: string; points: number }>();
      for (const e of (pe ?? []) as any[]) {
        const cur = map.get(e.user_id) ?? { user_id: e.user_id, name: e.profiles?.name ?? "?", points: 0 };
        cur.points += e.points;
        map.set(e.user_id, cur);
      }
      // include members with 0
      for (const mem of (m as any[])) {
        if (!map.has(mem.user_id)) map.set(mem.user_id, { user_id: mem.user_id, name: mem.profiles?.name ?? "?", points: 0 });
      }
      setRanking(Array.from(map.values()).sort((a, b) => b.points - a.points));
    }

    const { data: inv } = await supabase.from("group_invitations").select("*").eq("group_id", groupId).eq("status", "pending");
    setInvites(inv ?? []);
  };
  useEffect(() => { load(); }, [groupId]);

  if (!group) return <div className="text-muted-foreground">Loading…</div>;

  const isAdmin = group.admin_id === user?.id;
  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/join/${group.invite_code}` : "";

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

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    const { error } = await supabase.from("group_invitations").insert({
      group_id: groupId, invited_email: email, invite_code: group.invite_code, status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success("Invitation sent");
    setInviteEmail("");
    load();
  };

  const topPoints = ranking[0]?.points ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate({ to: "/groups" })} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>
      <div>
        <h1 className="text-2xl font-semibold">{group.name}</h1>
        <p className="text-sm text-muted-foreground mt-1">{members.length} members</p>
      </div>

      {/* Weekly Ranking */}
      <Card className="p-5 border-[0.5px]">
        <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" /> Weekly Ranking</h3>
        <div className="space-y-3">
          {ranking.map((r, i) => (
            <div key={r.user_id} className="flex items-center gap-3">
              <div className="w-5 text-xs font-medium text-muted-foreground text-center">{i + 1}</div>
              <Avatar name={r.name} size={28} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{r.name}</div>
                <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                  <div className="h-full bg-primary" style={{ width: `${topPoints > 0 ? (r.points / topPoints) * 100 : 0}%` }} />
                </div>
              </div>
              <div className="text-sm font-medium tabular-nums w-12 text-right">{r.points}</div>
            </div>
          ))}
        </div>
      </Card>

      {isAdmin && (
        <Card className="p-5 border-[0.5px] space-y-4">
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-2"><Link2 className="h-4 w-4" /> Invite link</div>
            <div className="flex gap-2">
              <Input readOnly value={inviteLink} className="font-mono text-xs" />
              <Button variant="outline" onClick={() => { navigator.clipboard.writeText(inviteLink); toast.success("Copied"); }}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div>
            <div className="text-sm font-medium mb-2 flex items-center gap-2"><Mail className="h-4 w-4" /> Invite by email</div>
            <div className="flex gap-2">
              <Input placeholder="user@example.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} type="email" />
              <Button onClick={sendInvite}>Send invite</Button>
            </div>
            {invites.length > 0 && (
              <div className="mt-3 space-y-1">
                <div className="text-xs text-muted-foreground">Pending: {invites.map((i: any) => i.invited_email).join(", ")}</div>
              </div>
            )}
          </div>
        </Card>
      )}

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
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon"><X className="h-4 w-4 text-destructive" /></Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove member?</AlertDialogTitle>
                      <AlertDialogDescription>{m.profiles?.name} will lose access to this group.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => remove(m.id)} className="bg-destructive">Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          ))}
        </div>
      </Card>

      {!isAdmin && (
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" className="text-destructive">Leave group</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Leave this group?</AlertDialogTitle>
              <AlertDialogDescription>You'll lose access to its rooms and materials.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Stay</AlertDialogCancel>
              <AlertDialogAction onClick={leave} className="bg-destructive">Leave</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}
