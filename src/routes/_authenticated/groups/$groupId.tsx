import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { X, ArrowLeft, Trophy, Search, UserPlus, Plus, BookOpen, FileText, Brain, ExternalLink, Play, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { PracticeDialog, PlayQuizDialog, QuizLeaderboardDialog, type MaterialLike } from "@/components/materials/MaterialActionDialogs";

export const Route = createFileRoute("/_authenticated/groups/$groupId")({
  component: GroupDetail,
});

type Material = MaterialLike & {
  type: "flashcard_set" | "quiz" | "file";
  subject: string | null;
  file_url: string | null;
};

type Room = {
  id: string; name: string; status: string; created_at: string; scheduled_at: string | null;
  focus_duration_minutes?: number; break_duration_minutes?: number;
  room_participants: { id: string }[];
};

type UserResult = { id: string; name: string; email: string };

const FOCUS_OPTIONS = [15, 20, 25, 30, 45, 50];
const BREAK_OPTIONS = [5, 10, 15];

function startOfWeek() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // Monday = 0
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - day);
  return d.toISOString();
}

async function openFile(path: string | null) {
  if (!path) return;
  const { data, error } = await supabase.storage.from("study-files").createSignedUrl(path, 3600);
  if (error || !data) return toast.error("No se pudo abrir el archivo");
  window.open(data.signedUrl, "_blank");
}

function GroupDetail() {
  const { groupId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [ranking, setRanking] = useState<{ user_id: string; name: string; points: number }[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteQuery, setInviteQuery] = useState("");
  const [inviteResults, setInviteResults] = useState<UserResult[]>([]);
  const [selectedInvitee, setSelectedInvitee] = useState<UserResult | null>(null);

  const [sessionOpen, setSessionOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [focusMin, setFocusMin] = useState("25");
  const [breakMin, setBreakMin] = useState("5");
  const [sessionMode, setSessionMode] = useState<"now" | "later">("now");
  const [scheduledAt, setScheduledAt] = useState("");

  const [practice, setPractice] = useState<Material | null>(null);
  const [play, setPlay] = useState<Material | null>(null);
  const [leaderboardFor, setLeaderboardFor] = useState<Material | null>(null);

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

    const { data: mat } = await supabase.from("study_materials").select("id,name,type,subject,file_url,group_id,user_id").eq("group_id", groupId).order("created_at", { ascending: false });
    setMaterials((mat as any) ?? []);

    const { data: r } = await supabase.from("rooms").select("id,name,status,created_at,scheduled_at,focus_duration_minutes,break_duration_minutes,room_participants(id)").eq("group_id", groupId).order("created_at", { ascending: false });
    setRooms((r as any) ?? []);
  };
  useEffect(() => { load(); }, [groupId]);

  // Live search for invite-by-user
  useEffect(() => {
    const q = inviteQuery.trim();
    if (q.length < 2) { setInviteResults([]); return; }
    const handle = setTimeout(async () => {
      const safe = q.replace(/[%,()]/g, "");
      const memberIds = new Set(members.map((m: any) => m.user_id));
      const { data } = await supabase.from("profiles").select("id,name,email")
        .or(`name.ilike.%${safe}%,email.ilike.%${safe}%`)
        .limit(8);
      setInviteResults(((data ?? []) as UserResult[]).filter(u => u.id !== user?.id && !memberIds.has(u.id)));
    }, 300);
    return () => clearTimeout(handle);
  }, [inviteQuery, members, user?.id]);

  if (!group) return <div className="text-muted-foreground">Cargando…</div>;

  const isAdmin = group.admin_id === user?.id;

  const leave = async () => {
    if (!user) return;
    const { error } = await supabase.from("group_members").delete().match({ group_id: groupId, user_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Has salido del grupo");
    navigate({ to: "/groups" });
  };
  const remove = async (id: string) => {
    const { error } = await supabase.from("group_members").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminado");
    load();
  };

  const sendInvite = async () => {
    if (!selectedInvitee) return;
    const { error } = await supabase.from("group_invitations").insert({
      group_id: groupId, invited_email: selectedInvitee.email, invite_code: group.invite_code, status: "pending",
    });
    if (error) return toast.error(error.message);
    toast.success(`Invitación enviada a ${selectedInvitee.name}`);
    setSelectedInvitee(null); setInviteQuery("");
    load();
  };

  const createSession = async () => {
    if (!newName || !user) return;
    if (sessionMode === "later" && !scheduledAt) return toast.error("Elegí una fecha para programar la sesión");
    const { data, error } = await supabase
      .from("rooms")
      .insert({
        name: newName, group_id: groupId, created_by: user.id,
        status: sessionMode === "now" ? "active" : "waiting",
        scheduled_at: sessionMode === "later" ? new Date(scheduledAt).toISOString() : null,
        focus_duration_minutes: Number(focusMin),
        break_duration_minutes: Number(breakMin),
      })
      .select().single();
    if (error) return toast.error(error.message);
    await supabase.from("room_participants").insert({ room_id: data.id, user_id: user.id });
    setSessionOpen(false); setNewName(""); setFocusMin("25"); setBreakMin("5"); setSessionMode("now"); setScheduledAt("");
    if (sessionMode === "now") {
      toast.success("Sesión creada");
      navigate({ to: "/session/$roomId", params: { roomId: data.id } });
    } else {
      toast.success("Sesión programada");
      load();
    }
  };

  const topPoints = ranking[0]?.points ?? 0;
  const upcomingRooms = rooms.filter(r => r.status !== "finished");
  const finishedRooms = rooms.filter(r => r.status === "finished");

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button onClick={() => navigate({ to: "/groups" })} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{group.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">{members.length} miembros</p>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Dialog open={inviteOpen} onOpenChange={v => { setInviteOpen(v); if (!v) { setInviteQuery(""); setInviteResults([]); setSelectedInvitee(null); } }}>
              <DialogTrigger asChild>
                <Button variant="outline"><UserPlus className="h-4 w-4 mr-1" /> Invitar</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Invitar al grupo</DialogTitle></DialogHeader>
                <div className="space-y-4 py-2">
                  <div>
                    <div className="text-sm font-medium mb-2 flex items-center gap-2"><Search className="h-4 w-4" /> Buscar usuario</div>
                    {selectedInvitee ? (
                      <div className="flex items-center gap-3 p-3 rounded-md border bg-muted/30">
                        <Avatar name={selectedInvitee.name} size={32} />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{selectedInvitee.name}</div>
                          <div className="text-xs text-muted-foreground truncate">{selectedInvitee.email}</div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setSelectedInvitee(null)}><X className="h-4 w-4" /></Button>
                      </div>
                    ) : (
                      <>
                        <Input placeholder="Nombre o email" value={inviteQuery} onChange={e => setInviteQuery(e.target.value)} />
                        {inviteResults.length > 0 && (
                          <div className="mt-2 border rounded-md divide-y max-h-48 overflow-auto">
                            {inviteResults.map(u => (
                              <button key={u.id} onClick={() => { setSelectedInvitee(u); setInviteQuery(""); setInviteResults([]); }}
                                className="w-full flex items-center gap-3 p-2 hover:bg-muted text-left">
                                <Avatar name={u.name} size={28} />
                                <div className="flex-1 min-w-0">
                                  <div className="text-sm font-medium truncate">{u.name}</div>
                                  <div className="text-xs text-muted-foreground truncate">{u.email}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {inviteQuery.trim().length >= 2 && inviteResults.length === 0 && (
                          <div className="text-xs text-muted-foreground mt-2">Sin resultados</div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <DialogFooter><Button onClick={sendInvite} disabled={!selectedInvitee}>Invitar</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={sessionOpen} onOpenChange={setSessionOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-1" /> Crear sesión</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Crear sesión de estudio</DialogTitle></DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-2"><Label>Nombre de la sesión</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Estudio de Cálculo" /></div>
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
                    <Label>Duración total</Label>
                    <div className="px-3 py-2 bg-muted rounded-md text-sm text-center">
                      {Math.ceil((Number(focusMin) + Number(breakMin)) * 3)} min
                    </div>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createSession} disabled={!newName || (sessionMode === "later" && !scheduledAt)}>
                  {sessionMode === "now" ? "Crear e iniciar" : "Programar sesión"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="sessions">
        <TabsList>
          <TabsTrigger value="sessions">Sesiones</TabsTrigger>
          <TabsTrigger value="members">Miembros</TabsTrigger>
          <TabsTrigger value="materials">Materiales</TabsTrigger>
        </TabsList>

        <TabsContent value="sessions" className="space-y-6">
          <div>
            <h3 className="font-semibold text-sm mb-3">Próximas y en curso</h3>
            {upcomingRooms.length === 0 ? (
              <Card className="p-8 text-center border-[0.5px] text-sm text-muted-foreground">
                No hay sesiones activas. Crea una con el botón "Crear sesión".
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {upcomingRooms.map(r => {
                  const isScheduled = r.status === "waiting" && r.scheduled_at;
                  return (
                    <Card key={r.id} className="p-4 border-[0.5px]">
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-medium">{r.name}</div>
                        {isScheduled && <Badge variant="outline">Programada</Badge>}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {isScheduled
                          ? `Programada: ${format(new Date(r.scheduled_at as string), "d MMM, HH:mm")}`
                          : format(new Date(r.created_at), "d MMM, HH:mm")}
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Users className="h-3.5 w-3.5" /> {r.room_participants?.length ?? 0}
                        </div>
                        <Link to="/session/$roomId" params={{ roomId: r.id }}>
                          <Button size="sm" variant="outline">{r.status === "active" ? "Unirse" : "Entrar"}</Button>
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3">Terminadas</h3>
            {finishedRooms.length === 0 ? (
              <Card className="p-8 text-center border-[0.5px] text-sm text-muted-foreground">
                Todavía no hay sesiones terminadas.
              </Card>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {finishedRooms.map(r => (
                  <Card key={r.id} className="p-4 border-[0.5px] opacity-80">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{format(new Date(r.created_at), "d MMM, HH:mm")}</div>
                    <Badge variant="outline" className="mt-2">Terminada</Badge>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="members" className="space-y-6">
          <Card className="p-5 border-[0.5px]">
            <h3 className="font-semibold text-sm mb-4 flex items-center gap-2"><Trophy className="h-4 w-4 text-warning" /> Ranking Semanal</h3>
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

          <Card className="p-5 border-[0.5px]">
            <div className="text-sm font-medium mb-3">Miembros</div>
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
                          <AlertDialogTitle>¿Eliminar miembro?</AlertDialogTitle>
                          <AlertDialogDescription>{m.profiles?.name} perderá el acceso a este grupo.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove(m.id)} className="bg-destructive">Eliminar</AlertDialogAction>
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
                <Button variant="outline" className="text-destructive">Salir del grupo</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Salir de este grupo?</AlertDialogTitle>
                  <AlertDialogDescription>Perderás acceso a sus salas y materiales.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Quedarse</AlertDialogCancel>
                  <AlertDialogAction onClick={leave} className="bg-destructive">Salir</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </TabsContent>

        <TabsContent value="materials" className="space-y-4">
          {materials.length === 0 ? (
            <Card className="p-12 text-center border-[0.5px]">
              <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <h3 className="font-medium mb-1">Aún no hay materiales</h3>
              <p className="text-sm text-muted-foreground mb-4">Comparte archivos, tarjetas o cuestionarios con este grupo desde Materiales.</p>
              <Link to="/materials"><Button><Plus className="h-4 w-4 mr-1" /> Ir a Materiales</Button></Link>
            </Card>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              {materials.map(m => (
                <Card key={m.id} className="p-5 border-[0.5px] flex flex-col">
                  <div className={`h-9 w-9 rounded-md flex items-center justify-center mb-3 ${
                    m.type === "quiz" ? "bg-warning/10 text-warning" :
                    m.type === "flashcard_set" ? "bg-primary/10 text-primary" :
                    "bg-success/10 text-success"
                  }`}>
                    {m.type === "quiz" ? <Brain className="h-4 w-4" /> :
                     m.type === "flashcard_set" ? <BookOpen className="h-4 w-4" /> :
                     <FileText className="h-4 w-4" />}
                  </div>
                  <div className="font-medium">{m.name}</div>
                  {m.subject && <div className="text-xs text-muted-foreground mt-0.5">{m.subject}</div>}
                  <div className="mt-4 flex gap-2">
                    {m.type === "file" && (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => openFile(m.file_url)}>
                        <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver
                      </Button>
                    )}
                    {m.type === "flashcard_set" && (
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setPractice(m)}>
                        <Play className="h-3.5 w-3.5 mr-1" /> Practicar
                      </Button>
                    )}
                    {m.type === "quiz" && (
                      <>
                        <Button size="sm" className="flex-1" onClick={() => setPlay(m)}>
                          <Play className="h-3.5 w-3.5 mr-1" /> Jugar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setLeaderboardFor(m)}>
                          <Trophy className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {practice && <PracticeDialog material={practice} onClose={() => setPractice(null)} />}
      {play && <PlayQuizDialog material={play} onClose={() => setPlay(null)} />}
      {leaderboardFor && <QuizLeaderboardDialog material={leaderboardFor} onClose={() => setLeaderboardFor(null)} />}
    </div>
  );
}
