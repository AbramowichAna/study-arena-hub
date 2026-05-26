import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Timer, Trophy, Flame, Clock, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar } from "@/components/AppShell";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Room = {
  id: string; name: string; status: string; created_at: string;
  group_id: string;
  groups: { name: string } | null;
  room_participants: { id: string }[];
};

function Dashboard() {
  const { profile, user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState({ weekSessions: 0, todayMinutes: 0, streak: 0 });
  const [leaderboard, setLeaderboard] = useState<{ name: string; points: number }[]>([]);
  const [activity, setActivity] = useState<{ id: string; type: string; points: number; created_at: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<string>("");

  const load = async () => {
    const [{ data: r }, { data: g }] = await Promise.all([
      supabase.from("rooms").select("id,name,status,created_at,group_id,groups(name),room_participants(id)").order("created_at", { ascending: false }).limit(20),
      supabase.from("group_members").select("groups(id,name)"),
    ]);
    setRooms((r as any) ?? []);
    setGroups(((g ?? []) as any).map((x: any) => x.groups).filter(Boolean));

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: pe } = await supabase
      .from("point_events")
      .select("id,type,points,created_at,profiles(name)")
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(50);
    const events = (pe ?? []) as any[];
    setActivity(events.slice(0, 8).map(e => ({ id: e.id, type: e.type, points: e.points, created_at: e.created_at, name: e.profiles?.name ?? "Someone" })));

    // leaderboard
    const totals = new Map<string, { name: string; points: number }>();
    for (const e of events) {
      const key = e.profiles?.name ?? "?";
      const cur = totals.get(key) ?? { name: key, points: 0 };
      cur.points += e.points;
      totals.set(key, cur);
    }
    setLeaderboard(Array.from(totals.values()).sort((a, b) => b.points - a.points).slice(0, 5));

    // user stats
    if (user) {
      const { data: myEvents } = await supabase
        .from("point_events").select("type,created_at")
        .eq("user_id", user.id).gte("created_at", weekAgo);
      const weekSessions = (myEvents ?? []).filter((e: any) => e.type === "session_complete").length;
      setStats({ weekSessions, todayMinutes: weekSessions * 25, streak: profile?.streak_days ?? 0 });
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const createRoom = async () => {
    if (!newName || !newGroup || !user) return;
    const { data, error } = await supabase
      .from("rooms")
      .insert({ name: newName, group_id: newGroup, created_by: user.id, status: "active" })
      .select().single();
    if (error) return toast.error(error.message);
    await supabase.from("room_participants").insert({ room_id: data.id, user_id: user.id });
    toast.success("Room created");
    setOpen(false); setNewName(""); setNewGroup("");
    load();
  };

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  })();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">{greet}, {profile?.name?.split(" ")[0] ?? "there"}</h1>
        <p className="text-muted-foreground text-sm mt-1">Ready for a focus session?</p>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={Timer} label="Sessions this week" value={String(stats.weekSessions)} accent="text-primary bg-primary/10" />
        <StatCard icon={Clock} label="Study time today" value={`${stats.todayMinutes} min`} accent="text-success bg-success/10" progress={Math.min(100, (stats.todayMinutes / 120) * 100)} />
        <StatCard icon={Flame} label="Current streak" value={`${stats.streak} days`} accent="text-warning bg-warning/10" />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Active Rooms</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> New room</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create study room</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Room name</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Calculus Cram" /></div>
                  <div className="space-y-2">
                    <Label>Group</Label>
                    <Select value={newGroup} onValueChange={setNewGroup}>
                      <SelectTrigger><SelectValue placeholder={groups.length ? "Choose group" : "Create a group first"} /></SelectTrigger>
                      <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter><Button onClick={createRoom} disabled={!newName || !newGroup}>Create & start</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {rooms.map(r => (
              <Card key={r.id} className="p-4 border-[0.5px] hover:border-primary/40 transition">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground">{r.groups?.name}</div>
                  </div>
                  <Badge variant={r.status === "active" ? "default" : "secondary"} className={r.status === "active" ? "bg-success text-success-foreground" : ""}>
                    {r.status === "active" ? "● Live" : r.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {r.room_participants?.length ?? 0}
                  </div>
                  <Link to="/session/$roomId" params={{ roomId: r.id }}>
                    <Button size="sm" variant="outline">Join</Button>
                  </Link>
                </div>
              </Card>
            ))}
            <Card className="p-4 border border-dashed flex items-center justify-center cursor-pointer hover:bg-muted/40 min-h-[120px]"
              onClick={() => setOpen(true)}>
              <div className="text-center text-muted-foreground text-sm">
                <Plus className="h-5 w-5 mx-auto mb-1" />
                Create room
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card className="p-4 border-[0.5px]">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" /> Weekly leaderboard</h3>
            <div className="space-y-2">
              {leaderboard.length === 0 && <p className="text-xs text-muted-foreground">No activity this week.</p>}
              {leaderboard.map((u, i) => (
                <div key={u.name} className="flex items-center gap-2">
                  <div className="text-xs font-medium text-muted-foreground w-4">{i + 1}</div>
                  <Avatar name={u.name} size={24} />
                  <div className="text-sm flex-1 truncate">{u.name}</div>
                  <div className="text-xs font-medium">{u.points}</div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4 border-[0.5px]">
            <h3 className="font-semibold text-sm mb-3">Recent activity</h3>
            <div className="space-y-2.5">
              {activity.length === 0 && <p className="text-xs text-muted-foreground">No recent activity.</p>}
              {activity.map(a => (
                <div key={a.id} className="text-xs flex items-start gap-2">
                  <div className={`h-1.5 w-1.5 rounded-full mt-1.5 ${a.points > 0 ? "bg-success" : "bg-destructive"}`} />
                  <div className="flex-1">
                    <div className="text-foreground"><span className="font-medium">{a.name}</span> {labelFor(a.type)} <span className={a.points > 0 ? "text-success" : "text-destructive"}>{a.points > 0 ? "+" : ""}{a.points} pts</span></div>
                    <div className="text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function labelFor(t: string) {
  if (t === "session_complete") return "completed a session";
  if (t === "abandon_penalty") return "abandoned a session";
  if (t === "quiz_score") return "scored on a quiz";
  return t;
}

function StatCard({ icon: Icon, label, value, accent, progress }: { icon: any; label: string; value: string; accent: string; progress?: number }) {
  return (
    <Card className="p-5 border-[0.5px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-semibold mt-2">{value}</div>
        </div>
        <div className={`h-9 w-9 rounded-md flex items-center justify-center ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {progress !== undefined && <Progress value={progress} className="mt-3 h-1.5" />}
    </Card>
  );
}
