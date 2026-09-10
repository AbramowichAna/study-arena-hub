import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { X, Mic, MicOff, Video, VideoOff, BookOpen, FileText, Brain, ExternalLink, Play, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/AppShell";
import { PracticeDialog, PlayQuizDialog, QuizLeaderboardDialog, type MaterialLike } from "@/components/materials/MaterialActionDialogs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type Material = MaterialLike & {
  type: "flashcard_set" | "quiz" | "file";
  subject: string | null;
  file_url: string | null;
};

async function openFile(path: string | null) {
  if (!path) return;
  const { data, error } = await supabase.storage.from("study-files").createSignedUrl(path, 3600);
  if (error || !data) return toast.error("No se pudo abrir el archivo");
  window.open(data.signedUrl, "_blank");
}

export const Route = createFileRoute("/_authenticated/session/$roomId")({
  component: SessionPage,
});

function SessionPage() {
  const { roomId } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [participants, setParticipants] = useState<any[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [totalSessionTime, setTotalSessionTime] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [practice, setPractice] = useState<Material | null>(null);
  const [play, setPlay] = useState<Material | null>(null);
  const [leaderboardFor, setLeaderboardFor] = useState<Material | null>(null);
  const completedRef = useRef(false);

  // load + join
  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from("rooms").select("*,groups(name)").eq("id", roomId).maybeSingle();
      setRoom(r);
      const initialFocus = ((r?.focus_duration_minutes ?? 25) as number) * 60;
      const { data: s } = await supabase.from("sessions").select("*").eq("room_id", roomId).order("started_at", { ascending: false }).limit(1).maybeSingle();
      if (s) setSession(s);
      else {
        const { data: ns } = await supabase.from("sessions").insert({ room_id: roomId, phase: "focus", duration_seconds: initialFocus }).select().single();
        setSession(ns);
      }
      if (user) {
        await supabase.from("room_participants").upsert({ room_id: roomId, user_id: user.id, status: "studying" }, { onConflict: "room_id,user_id" } as any).then(() => {});
      }
      loadParticipants();
      
      // Calcular tiempo total de sesión (3 ciclos de foco + descanso)
      if (r) {
        const focusTime = (r.focus_duration_minutes || 25) * 60;
        const breakTime = (r.break_duration_minutes || 5) * 60;
        setTotalSessionTime((focusTime + breakTime) * (r.cycles || 3));
      }

      // Materiales del grupo (para consultarlos sin salir de la sesión)
      if (r?.group_id) {
        const { data: mat } = await supabase.from("study_materials").select("id,name,type,subject,file_url,group_id,user_id").eq("group_id", r.group_id).order("created_at", { ascending: false });
        setMaterials((mat as any) ?? []);
      }
    })();
  }, [roomId, user?.id]);

  const loadParticipants = async () => {
    const { data } = await supabase.from("room_participants").select("id,user_id,status,points_earned,profiles(name)").eq("room_id", roomId).is("left_at", null);
    setParticipants((data as any) ?? []);
  };

  useEffect(() => {
    const ch = supabase.channel(`room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `room_id=eq.${roomId}` },
        (p) => setSession(p.new))
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomId}` },
        () => loadParticipants())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  useEffect(() => {
    if (!session) return;
    const tick = () => {
      const started = new Date(session.started_at).getTime();
      const elapsed = Math.floor((Date.now() - started) / 1000);
      const left = session.duration_seconds - elapsed;
      if (session.timer_state !== "running") return;
      setRemaining(Math.max(0, left));
      if (left <= 0 && !completedRef.current && session.phase === "focus") {
        completedRef.current = true;
        complete();
      }
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [session]);

  const complete = async () => {
    if (!user) return;
    await supabase.from("point_events").insert({ user_id: user.id, type: "session_complete", points: 100 });
    await supabase.from("rooms").update({ status: "finished" }).eq("id", roomId);
    setCelebrate(true);
  };

  const abandon = async () => {
    if (!user) return;
    await supabase.from("point_events").insert({ user_id: user.id, type: "abandon_penalty", points: -20 });
    await supabase.from("room_participants").update({ left_at: new Date().toISOString() }).match({ room_id: roomId, user_id: user.id });
    toast.error("Sesión abandonada: -20 pts");
    navigate({ to: "/dashboard" });
  };


  const mins = Math.floor(remaining / 60).toString().padStart(2, "0");
  const secs = (remaining % 60).toString().padStart(2, "0");
  
  // Calcular tiempo transcurrido total y restante total
  const sessionStartTime = session ? new Date(session.started_at).getTime() : Date.now();
  const totalElapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
  const totalRemaining = Math.max(0, totalSessionTime - totalElapsed);
  const totalMins = Math.floor(totalRemaining / 60);
  const totalHours = Math.floor(totalMins / 60);
  const remainingMins = totalMins % 60;

  if (!room) return <div className="text-muted-foreground">Cargando…</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-semibold">{room.name}</div>
          <div className="text-xs text-muted-foreground">{room.groups?.name}</div>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="text-destructive"><X className="h-4 w-4 mr-1" /> Abandonar</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Abandonar sesión?</AlertDialogTitle>
              <AlertDialogDescription>Perderás 20 puntos y saldrás de la sala.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Quedarse</AlertDialogCancel>
              <AlertDialogAction onClick={abandon} className="bg-destructive">Abandonar</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Video grid */}
      <Card className="p-5 border-[0.5px] bg-slate-900">
        <div className="grid grid-cols-2 gap-3">
          {participants.slice(0, 4).map(p => {
            const isMe = p.user_id === user?.id;
            const cam = isMe ? camOn : false;
            const mic = isMe ? micOn : false;
            return (
              <div key={p.id} className="relative aspect-video bg-slate-800 rounded-md overflow-hidden flex items-center justify-center">
                {!cam && (
                  <div className="flex flex-col items-center gap-2">
                    <Avatar name={p.profiles?.name ?? "?"} size={48} />
                    <VideoOff className="h-5 w-5 text-slate-500" />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <div className="bg-black/50 rounded p-1">
                    {mic ? <Mic className="h-3 w-3 text-white" /> : <MicOff className="h-3 w-3 text-red-400" />}
                  </div>
                  <div className="text-xs text-white bg-black/50 px-2 py-0.5 rounded truncate max-w-[70%]">
                    {p.profiles?.name ?? "?"}{isMe && " (tú)"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-2 mt-4">
          <Button size="sm" variant={micOn ? "default" : "outline"} onClick={() => setMicOn(v => !v)}
            className={micOn ? "" : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"}>
            {micOn ? <><Mic className="h-4 w-4 mr-1" /> Micrófono encendido</> : <><MicOff className="h-4 w-4 mr-1" /> Micrófono apagado</>}
          </Button>
          <Button size="sm" variant={camOn ? "default" : "outline"} onClick={() => setCamOn(v => !v)}
            className={camOn ? "" : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"}>
            {camOn ? <><Video className="h-4 w-4 mr-1" /> Cámara encendida</> : <><VideoOff className="h-4 w-4 mr-1" /> Cámara apagada</>}
          </Button>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-6">
        <Card className="col-span-2 p-10 border-[0.5px] text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          {session?.phase === "focus" ? "Concentración" : "Descanso"}
        </div>
        <div className="text-7xl font-semibold tabular-nums">{mins}:{secs}</div>
        <div className="text-lg text-muted-foreground mt-4 border-t pt-4">
          Tiempo restante de la sesión: <span className="font-semibold text-foreground">
            {totalHours > 0 ? `${totalHours}h ${remainingMins}m` : `${remainingMins}m`}
          </span>
        </div>
        </Card>

        {/* Participantes más pequeños al lado */}
        <Card className="p-4 border-[0.5px]">
          <h3 className="font-semibold text-sm mb-3">Participantes ({participants.length})</h3>
          <div className="space-y-2">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <Avatar name={p.profiles?.name ?? "?"} size={24} />
                <div className="flex-1 text-xs truncate">{p.profiles?.name}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Materiales del grupo — accesibles sin salir de la sesión */}
      <Card className="p-5 border-[0.5px]">
        <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" /> Materiales del grupo
        </h3>
        {materials.length === 0 ? (
          <p className="text-sm text-muted-foreground">Este grupo aún no tiene materiales.</p>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {materials.map(m => (
              <Card key={m.id} className="p-4 border-[0.5px] flex flex-col">
                <div className={`h-8 w-8 rounded-md flex items-center justify-center mb-2 ${
                  m.type === "quiz" ? "bg-warning/10 text-warning" :
                  m.type === "flashcard_set" ? "bg-primary/10 text-primary" :
                  "bg-success/10 text-success"
                }`}>
                  {m.type === "quiz" ? <Brain className="h-4 w-4" /> :
                   m.type === "flashcard_set" ? <BookOpen className="h-4 w-4" /> :
                   <FileText className="h-4 w-4" />}
                </div>
                <div className="font-medium text-sm">{m.name}</div>
                {m.subject && <div className="text-xs text-muted-foreground mt-0.5">{m.subject}</div>}
                <div className="mt-3 flex gap-2">
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
      </Card>

      {practice && <PracticeDialog material={practice} onClose={() => setPractice(null)} />}
      {play && <PlayQuizDialog material={play} onClose={() => setPlay(null)} />}
      {leaderboardFor && <QuizLeaderboardDialog material={leaderboardFor} onClose={() => setLeaderboardFor(null)} />}

      <Dialog open={celebrate} onOpenChange={setCelebrate}>
        <DialogContent className="text-center py-10">
          <div className="text-5xl mb-2">🎉</div>
          <div className="text-2xl font-semibold">¡Sesión completada!</div>
          <div className="text-muted-foreground my-2">Has ganado +100 pts</div>
          <Button onClick={() => navigate({ to: "/dashboard" })}>Volver al panel</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
