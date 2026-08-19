import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Timer, Clock, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Room = {
  id: string; name: string; status: string; created_at: string;
  group_id: string;
  groups: { name: string } | null;
  room_participants: { id: string }[];
};

const FOCUS_OPTIONS = [15, 20, 25, 30, 45, 50];
const BREAK_OPTIONS = [5, 10, 15];

function Dashboard() {
  const { profile, user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState({ weekSessions: 0, todayMinutes: 0 });
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<string>("");
  const [focusMin, setFocusMin] = useState("25");
  const [breakMin, setBreakMin] = useState("5");

  const load = async () => {
    const [{ data: r }, { data: g }] = await Promise.all([
      supabase.from("rooms").select("id,name,status,created_at,group_id,groups(name),room_participants(id)").eq("status", "active").order("created_at", { ascending: false }).limit(20),
      supabase.from("group_members").select("groups(id,name)"),
    ]);
    setRooms((r as any) ?? []);
    setGroups(((g ?? []) as any).map((x: any) => x.groups).filter(Boolean));

    if (user) {
      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const { data: myEvents } = await supabase
        .from("point_events").select("type,created_at")
        .eq("user_id", user.id).gte("created_at", weekAgo);
      const weekSessions = (myEvents ?? []).filter((e: any) => e.type === "session_complete").length;
      setStats({ weekSessions, todayMinutes: weekSessions * 25 });
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  const createRoom = async () => {
    if (!newName || !newGroup || !user) return;
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        name: newName, group_id: newGroup, created_by: user.id, status: "active",
        focus_duration_minutes: Number(focusMin),
        break_duration_minutes: Number(breakMin),
      })
      .select().single();
    if (error) return toast.error(error.message);
    await supabase.from("room_participants").insert({ room_id: data.id, user_id: user.id });
    toast.success("Sala creada");
    setOpen(false); setNewName(""); setNewGroup(""); setFocusMin("25"); setBreakMin("5");
    load();
  };

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">{greet}, {profile?.name?.split(" ")[0] ?? "there"}</h1>
        <p className="text-muted-foreground text-sm mt-1">¿Listo para una sesión de estudio?</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard icon={Timer} label="Sesiones esta semana" value={String(stats.weekSessions)} accent="text-primary bg-primary/10" />
        <StatCard icon={Clock} label="Tiempo de estudio hoy" value={`${stats.todayMinutes} min`} accent="text-success bg-success/10" progress={Math.min(100, (stats.todayMinutes / 120) * 100)} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Salas Activas</h2>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nueva sala</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Crear sala de estudio</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Nombre de la sala</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Estudio de Cálculo" /></div>
                  <div className="space-y-2">
                    <Label>Grupo</Label>
                    <Select value={newGroup} onValueChange={setNewGroup}>
                      <SelectTrigger><SelectValue placeholder={groups.length ? "Elegir grupo" : "Crea un grupo primero"} /></SelectTrigger>
                      <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <Label>Enfoque (min)</Label>
                      <Select value={focusMin} onValueChange={setFocusMin}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{FOCUS_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Descanso (min)</Label>
                      <Select value={breakMin} onValueChange={setBreakMin}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{BREAK_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Duración total</Label>
                      <div className="px-3 py-2 bg-muted rounded-md text-sm text-center">
                        {Math.ceil((Number(focusMin) + Number(breakMin)) * 3)} min
                      </div>
                    </div>
                  </div>
                </div>
                <DialogFooter><Button onClick={createRoom} disabled={!newName || !newGroup}>Crear e iniciar</Button></DialogFooter>
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
                    {r.status === "active" ? "● En vivo" : r.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between mt-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Users className="h-3.5 w-3.5" /> {r.room_participants?.length ?? 0}
                  </div>
                  <Link to="/session/$roomId" params={{ roomId: r.id }}>
                    <Button size="sm" variant="outline">Unirse</Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          <Card className="p-4 border-[0.5px]">
            <h3 className="font-semibold text-sm mb-3">Tus grupos</h3>
            <div className="space-y-2">
              {groups.length === 0 && <p className="text-xs text-muted-foreground">Aún no te has unido a ningún grupo.</p>}
              {groups.map(g => (
                <Link key={g.id} to="/groups/$groupId" params={{ groupId: g.id }}
                  className="flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-muted">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-primary" />
                    <span className="truncate">{g.name}</span>
                  </div>
                  <Button size="sm" variant="ghost" className="h-6 px-2 text-xs">
                    Administrar
                  </Button>
                </Link>
              ))}
              <Link to="/groups" className="text-xs text-primary hover:underline pt-2 block">Administrar grupos →</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
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
