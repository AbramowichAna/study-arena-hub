import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Timer, Clock, Users, CalendarClock, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Room = {
  id: string; name: string; status: string; created_at: string; scheduled_at: string | null;
  group_id: string; created_by: string;
  groups: { name: string } | null;
  room_participants: { id: string }[];
  focus_duration_minutes?: number;
  break_duration_minutes?: number;
  cycles?: number;
  sessions?: { started_at: string; phase: string; duration_seconds: number; timer_state: string }[];
};

const FOCUS_OPTIONS = [15, 20, 25, 30, 45, 50];
const BREAK_OPTIONS = [5, 10, 15];
const CYCLE_OPTIONS = [1, 2, 3, 4, 5, 6];

// ISO string -> "YYYY-MM-DDTHH:mm" en hora local para <input type="datetime-local">
function toLocalInput(iso: string) {
  const d = new Date(iso);
  const off = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - off).toISOString().slice(0, 16);
}

function Dashboard() {
  const { profile, user } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [stats, setStats] = useState({ weekSessions: 0, todayMinutes: 0 });
  const [goals, setGoals] = useState<Record<string, number>>({ daily_hours: 2, weekly_sessions: 10 });
  const [open, setOpen] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newGroup, setNewGroup] = useState<string>("");
  const [focusMin, setFocusMin] = useState("25");
  const [breakMin, setBreakMin] = useState("5");
  const [cycles, setCycles] = useState("3");
  const [sessionMode, setSessionMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");
  const [, setNow] = useState(Date.now());

  // Tick para actualizar las cuentas regresivas de las salas activas
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const load = async () => {
    const [{ data: r }, { data: g }] = await Promise.all([
      supabase.from("rooms").select("id,name,status,created_at,scheduled_at,group_id,created_by,focus_duration_minutes,break_duration_minutes,cycles,groups(name),room_participants(id),sessions(started_at,phase,duration_seconds,timer_state)").in("status", ["active", "waiting"]).order("created_at", { ascending: false }).limit(40),
      user ? supabase.from("group_members").select("groups(id,name)").eq("user_id", user.id) : Promise.resolve({ data: [] as any[] }),
    ]);
    setRooms((r as any) ?? []);
    setGroups(((g ?? []) as any).map((x: any) => x.groups).filter(Boolean));

    if (user) {
      // Cargar objetivos del usuario
      const { data: userGoals } = await supabase.from("user_goals").select("type,target").eq("user_id", user.id);
      const g: Record<string, number> = { daily_hours: 2, weekly_sessions: 10 };
      (userGoals ?? []).forEach((r: any) => (g[r.type] = r.target));
      setGoals(g);

      const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
      const dayAgo = new Date(Date.now() - 86400000).toISOString();
      const { data: myEvents } = await supabase
        .from("point_events").select("type,created_at")
        .eq("user_id", user.id).gte("created_at", weekAgo);
      const weekSessions = (myEvents ?? []).filter((e: any) => e.type === "session_complete").length;
      const todaySessions = (myEvents ?? []).filter((e: any) => e.type === "session_complete" && e.created_at >= dayAgo).length;
      setStats({ weekSessions, todayMinutes: (todaySessions * 25) / 60 });
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  // Tiempo total restante de la sesión (ciclos de foco + descanso), en formato H:MM:SS / MM:SS
  const getTotalSessionRemaining = (room: Room) => {
    const focusTime = (room.focus_duration_minutes || 25) * 60;
    const breakTime = (room.break_duration_minutes || 5) * 60;
    const totalSessionTime = (focusTime + breakTime) * (room.cycles || 3);

    // Si ya hay una sesión en curso usamos su inicio; si nadie entró todavía,
    // arrancamos la cuenta desde la creación de la sala para mostrarla siempre.
    const session = room.sessions?.[0];
    const startTime = new Date(session?.started_at ?? room.created_at).getTime();
    const totalElapsed = Math.floor((Date.now() - startTime) / 1000);
    const totalRemaining = Math.max(0, totalSessionTime - totalElapsed);

    if (totalRemaining === 0) return null;

    const h = Math.floor(totalRemaining / 3600);
    const m = Math.floor((totalRemaining % 3600) / 60);
    const s = totalRemaining % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`
      : `${m}:${s.toString().padStart(2, "0")}`;
  };

  const resetForm = () => {
    setEditingRoomId(null); setNewName(""); setNewGroup(""); setFocusMin("25"); setBreakMin("5"); setCycles("3"); setSessionMode("now"); setScheduledAt("");
  };

  const openCreate = () => { resetForm(); setOpen(true); };

  const deleteRoom = async (id: string) => {
    const { error } = await supabase.from("rooms").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sesión eliminada");
    load();
  };

  const openEdit = (r: Room) => {
    setEditingRoomId(r.id);
    setNewName(r.name);
    setNewGroup(r.group_id);
    setFocusMin(String(r.focus_duration_minutes ?? 25));
    setBreakMin(String(r.break_duration_minutes ?? 5));
    setCycles(String(r.cycles ?? 3));
    setSessionMode("later");
    setScheduledAt(r.scheduled_at ? toLocalInput(r.scheduled_at) : "");
    setOpen(true);
  };

  const createRoom = async () => {
    if (!newName || !newGroup || !user) return;
    if (sessionMode === "later" && !scheduledAt) return toast.error("Elegí una fecha para programar la sesión");

    if (editingRoomId) {
      const { error } = await supabase
        .from("rooms")
        .update({
          name: newName, group_id: newGroup,
          status: sessionMode === "now" ? "active" : "waiting",
          scheduled_at: sessionMode === "later" ? new Date(scheduledAt).toISOString() : null,
          focus_duration_minutes: Number(focusMin),
          break_duration_minutes: Number(breakMin),
          cycles: Number(cycles),
        })
        .eq("id", editingRoomId);
      if (error) return toast.error(error.message);
      toast.success(sessionMode === "now" ? "Sesión iniciada" : "Sesión actualizada");
      setOpen(false); resetForm(); load();
      return;
    }

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        name: newName, group_id: newGroup, created_by: user.id,
        status: sessionMode === "now" ? "active" : "waiting",
        scheduled_at: sessionMode === "later" ? new Date(scheduledAt).toISOString() : null,
        focus_duration_minutes: Number(focusMin),
        break_duration_minutes: Number(breakMin),
        cycles: Number(cycles),
      })
      .select().single();
    if (error) return toast.error(error.message);
    await supabase.from("room_participants").insert({ room_id: data.id, user_id: user.id });
    toast.success(sessionMode === "now" ? "Sala creada" : "Sesión programada");
    setOpen(false); resetForm(); load();
  };

  const greet = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 18) return "Buenas tardes";
    return "Buenas noches";
  })();

  const activeRooms = rooms.filter(r => r.status === "active");
  const scheduledRooms = rooms
    .filter(r => r.status === "waiting" && r.scheduled_at)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime());

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold">{greet}, {profile?.name?.split(" ")[0] ?? "there"}</h1>
        <p className="text-muted-foreground text-sm mt-1">¿Listo para una sesión de estudio?</p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <StatCard 
          icon={Timer} 
          label="Sesiones esta semana" 
          value={`${stats.weekSessions} / ${goals.weekly_sessions}`} 
          accent="text-primary bg-primary/10" 
          progress={Math.min(100, (stats.weekSessions / goals.weekly_sessions) * 100)} 
        />
        <StatCard 
          icon={Clock} 
          label="Horas de estudio hoy" 
          value={`${stats.todayMinutes.toFixed(1)} / ${goals.daily_hours}h`} 
          accent="text-success bg-success/10" 
          progress={Math.min(100, (stats.todayMinutes / goals.daily_hours) * 100)} 
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Salas Activas</h2>
            <Dialog open={open} onOpenChange={v => { setOpen(v); if (!v) resetForm(); }}>
              <DialogTrigger asChild><Button size="sm" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> Nueva sala</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editingRoomId ? "Editar sesión programada" : "Crear sala de estudio"}</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-2"><Label>Nombre de la sala</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Estudio de Cálculo" /></div>
                  <div className="space-y-2">
                    <Label>Grupo</Label>
                    <Select value={newGroup} onValueChange={setNewGroup}>
                      <SelectTrigger><SelectValue placeholder={groups.length ? "Elegir grupo" : "Crea un grupo primero"} /></SelectTrigger>
                      <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>¿Cuándo?</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant={sessionMode === "now" ? "default" : "outline"} className="flex-1" onClick={() => setSessionMode("now")}>Ahora</Button>
                      <Button type="button" variant={sessionMode === "later" ? "default" : "outline"} className="flex-1" onClick={() => setSessionMode("later")}>Programar</Button>
                    </div>
                  </div>
                  {sessionMode === "later" && (
                    <div className="space-y-2">
                      <Label>Fecha y hora</Label>
                      <Input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
                    </div>
                  )}
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
                      <Label>Ciclos</Label>
                      <Select value={cycles} onValueChange={setCycles}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CYCLE_OPTIONS.map(n => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 bg-muted rounded-md text-sm">
                    <span className="text-muted-foreground">Duración total de la sesión</span>
                    <span className="font-medium">{(Number(focusMin) + Number(breakMin)) * Number(cycles)} min</span>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={createRoom} disabled={!newName || !newGroup || (sessionMode === "later" && !scheduledAt)}>
                    {sessionMode === "now" ? (editingRoomId ? "Iniciar ahora" : "Crear e iniciar") : (editingRoomId ? "Guardar cambios" : "Programar sesión")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {activeRooms.length === 0 ? (
            <Card className="p-8 text-center border-[0.5px] text-sm text-muted-foreground">
              No hay salas activas. Creá una con el botón "Nueva sala".
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {activeRooms.map(r => {
                const totalRemaining = getTotalSessionRemaining(r);
                return (
                  <Card key={r.id} className="p-4 border-[0.5px] hover:border-primary/40 transition relative">
                    {totalRemaining && (
                      <div className="absolute top-3 right-3 bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-medium tabular-nums">
                        {totalRemaining}
                      </div>
                    )}
                    <div className="flex items-start justify-between mb-2">
                      <div className="pr-16">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-xs text-muted-foreground">{r.groups?.name}</div>
                      </div>
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
                );
              })}
            </div>
          )}

          {scheduledRooms.length > 0 && (
            <div className="space-y-3 pt-2">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" /> Próximas sesiones
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {scheduledRooms.map(r => {
                  const canEdit = r.created_by === user?.id;
                  const canJoin = new Date(r.scheduled_at!).getTime() <= Date.now();
                  return (
                    <Card key={r.id} className="p-4 border-[0.5px]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">{r.groups?.name}</div>
                        </div>
                        {canEdit && (
                          <div className="flex items-center gap-1 shrink-0">
                            <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(r)} aria-label="Editar sesión">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Eliminar sesión">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>¿Eliminar sesión programada?</AlertDialogTitle>
                                  <AlertDialogDescription>Se eliminará "{r.name}". Esta acción no se puede deshacer.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteRoom(r.id)} className="bg-destructive">Eliminar</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
                        <CalendarClock className="h-3.5 w-3.5" /> {format(new Date(r.scheduled_at!), "d MMM, HH:mm")}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" /> {r.room_participants?.length ?? 0}
                        </div>
                        {canJoin ? (
                          <Link to="/session/$roomId" params={{ roomId: r.id }}>
                            <Button size="sm" variant="outline">Entrar</Button>
                          </Link>
                        ) : (
                          <Button size="sm" variant="outline" disabled title="Disponible en el horario programado">
                            <Clock className="h-3.5 w-3.5 mr-1" /> Aún no disponible
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
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
