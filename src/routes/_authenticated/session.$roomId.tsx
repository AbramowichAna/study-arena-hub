import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipForward, X, Send, ArrowLeft, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Avatar } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

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
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [celebrate, setCelebrate] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const completedRef = useRef(false);

  const focusSec = (room?.focus_duration_minutes ?? 25) * 60;
  const breakSec = (room?.break_duration_minutes ?? 5) * 60;

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
      loadMessages();
    })();
  }, [roomId, user?.id]);

  const loadParticipants = async () => {
    const { data } = await supabase.from("room_participants").select("id,user_id,status,points_earned,profiles(name)").eq("room_id", roomId).is("left_at", null);
    setParticipants((data as any) ?? []);
  };
  const loadMessages = async () => {
    const { data } = await supabase.from("messages").select("id,user_id,content,created_at,profiles(name)").eq("room_id", roomId).order("created_at").limit(100);
    setMessages((data as any) ?? []);
  };

  useEffect(() => {
    const ch = supabase.channel(`room:${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "sessions", filter: `room_id=eq.${roomId}` },
        (p) => setSession(p.new))
      .on("postgres_changes", { event: "*", schema: "public", table: "room_participants", filter: `room_id=eq.${roomId}` },
        () => loadParticipants())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `room_id=eq.${roomId}` },
        () => loadMessages())
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

  const togglePause = async () => {
    if (!session) return;
    const newState = session.timer_state === "running" ? "paused" : "running";
    await supabase.from("sessions").update({ timer_state: newState }).eq("id", session.id);
  };
  const skipPhase = async () => {
    if (!session) return;
    const newPhase = session.phase === "focus" ? "break" : "focus";
    await supabase.from("sessions").update({
      phase: newPhase,
      duration_seconds: newPhase === "focus" ? focusSec : breakSec,
      started_at: new Date().toISOString(),
      timer_state: "running",
    }).eq("id", session.id);
    completedRef.current = false;
  };
  const abandon = async () => {
    if (!user) return;
    await supabase.from("point_events").insert({ user_id: user.id, type: "abandon_penalty", points: -20 });
    await supabase.from("room_participants").update({ left_at: new Date().toISOString() }).match({ room_id: roomId, user_id: user.id });
    toast.error("Session abandoned: -20 pts");
    navigate({ to: "/dashboard" });
  };

  const send = async () => {
    if (!text.trim() || !user) return;
    await supabase.from("messages").insert({ room_id: roomId, user_id: user.id, content: text.trim() });
    setText("");
  };

  const mins = Math.floor(remaining / 60).toString().padStart(2, "0");
  const secs = (remaining % 60).toString().padStart(2, "0");

  if (!room) return <div className="text-muted-foreground">Loading…</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate({ to: "/dashboard" })} className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1">
          <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div>
            <div className="font-semibold">{room.name}</div>
            <div className="text-xs text-muted-foreground">{room.groups?.name}</div>
          </div>
          <Badge className="bg-success text-success-foreground">● Live</Badge>
        </div>
      </div>

      {/* Video grid */}
      <Card className="p-5 border-[0.5px] bg-slate-900">
        <div className="grid grid-cols-3 gap-3">
          {participants.map(p => {
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
                    {p.profiles?.name ?? "?"}{isMe && " (you)"}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-2 mt-4">
          <Button size="sm" variant={micOn ? "default" : "outline"} onClick={() => setMicOn(v => !v)}
            className={micOn ? "" : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"}>
            {micOn ? <><Mic className="h-4 w-4 mr-1" /> Mic on</> : <><MicOff className="h-4 w-4 mr-1" /> Mic off</>}
          </Button>
          <Button size="sm" variant={camOn ? "default" : "outline"} onClick={() => setCamOn(v => !v)}
            className={camOn ? "" : "bg-slate-800 border-slate-700 text-white hover:bg-slate-700"}>
            {camOn ? <><Video className="h-4 w-4 mr-1" /> Camera on</> : <><VideoOff className="h-4 w-4 mr-1" /> Camera off</>}
          </Button>
        </div>
      </Card>

      <Card className="p-10 border-[0.5px] text-center">
        <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
          {session?.phase === "focus" ? "Focus" : "Break"}
        </div>
        <div className="text-7xl font-semibold tabular-nums">{mins}:{secs}</div>
        <div className="flex justify-center gap-2 mt-6">
          <Button variant="outline" onClick={togglePause}>
            {session?.timer_state === "running" ? <><Pause className="h-4 w-4 mr-1" /> Pause</> : <><Play className="h-4 w-4 mr-1" /> Resume</>}
          </Button>
          <Button variant="outline" onClick={skipPhase}><SkipForward className="h-4 w-4 mr-1" /> Skip phase</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive"><X className="h-4 w-4 mr-1" /> Abandon</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Abandon session?</AlertDialogTitle>
                <AlertDialogDescription>You'll lose 20 points and leave the room.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Stay</AlertDialogCancel>
                <AlertDialogAction onClick={abandon} className="bg-destructive">Abandon</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-5 border-[0.5px]">
          <h3 className="font-semibold text-sm mb-3">Participants ({participants.length})</h3>
          <div className="space-y-2">
            {participants.map(p => (
              <div key={p.id} className="flex items-center gap-3">
                <Avatar name={p.profiles?.name ?? "?"} />
                <div className="flex-1 text-sm">{p.profiles?.name}</div>
                <div className={`h-2 w-2 rounded-full ${p.status === "studying" ? "bg-success" : "bg-warning"}`} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 border-[0.5px] flex flex-col">
          <h3 className="font-semibold text-sm mb-3">Chat</h3>
          <div className="flex-1 overflow-auto space-y-2 mb-3 min-h-[150px] max-h-[250px]">
            {messages.map(m => (
              <div key={m.id} className="text-sm">
                <span className="font-medium text-primary">{m.profiles?.name ?? "?"}: </span>
                <span>{m.content}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} placeholder="Message…" />
            <Button size="icon" onClick={send}><Send className="h-4 w-4" /></Button>
          </div>
        </Card>
      </div>

      <Dialog open={celebrate} onOpenChange={setCelebrate}>
        <DialogContent className="text-center py-10">
          <div className="text-5xl mb-2">🎉</div>
          <div className="text-2xl font-semibold">Session complete!</div>
          <div className="text-muted-foreground my-2">You earned +100 pts</div>
          <Button onClick={() => navigate({ to: "/dashboard" })}>Back to dashboard</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
