import { useEffect, useState } from "react";
import { Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Avatar } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

export type MaterialLike = {
  id: string;
  name: string;
  group_id: string | null;
  user_id: string;
};

/* ---------- Practice Flashcards ---------- */
export function PracticeDialog({ material, onClose }: { material: MaterialLike; onClose: () => void }) {
  const [cards, setCards] = useState<any[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("flashcards").select("*").eq("material_id", material.id).order("order");
      setCards(data ?? []);
    })();
  }, [material.id]);

  if (!cards.length) return (
    <Dialog open onOpenChange={onClose}><DialogContent><div className="py-8 text-center text-muted-foreground">No cards yet.</div></DialogContent></Dialog>
  );

  const cur = cards[i];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{material.name}</DialogTitle></DialogHeader>
        <div className="text-xs text-muted-foreground text-center">Card {i + 1} of {cards.length}</div>
        <div
          onClick={() => setFlipped(!flipped)}
          className="min-h-[220px] flex items-center justify-center p-8 bg-muted/30 rounded-md cursor-pointer text-center text-lg font-medium transition-transform"
          style={{ transform: flipped ? "rotateX(2deg)" : "rotateX(0)" }}
        >
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-3">{flipped ? "Answer" : "Question"}</div>
            {flipped ? cur.back : cur.front}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={i === 0} onClick={() => { setI(i - 1); setFlipped(false); }}>← Previous</Button>
          <Button onClick={() => { if (i + 1 < cards.length) { setI(i + 1); setFlipped(false); } else onClose(); }}>
            {i + 1 < cards.length ? "Next →" : "Finish"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Play Quiz ---------- */
export function PlayQuizDialog({ material, onClose }: { material: MaterialLike; onClose: () => void }) {
  const { user } = useAuth();
  const [qs, setQs] = useState<any[]>([]);
  const [i, setI] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("quiz_questions").select("*").eq("material_id", material.id).order("order");
      setQs(data ?? []);
    })();
  }, [material.id]);

  const finish = async (finalScore: number) => {
    setDone(true);
    if (!user) return;
    const pts = Math.round((finalScore / qs.length) * 50);
    await supabase.from("quiz_attempts").insert({ material_id: material.id, user_id: user.id, score: finalScore });
    if (pts > 0) await supabase.from("point_events").insert({ user_id: user.id, type: "quiz_score", points: pts });
    toast.success(`+${pts} pts!`);
  };

  const next = () => {
    if (i + 1 >= qs.length) finish(score);
    else { setI(i + 1); setSelected(null); }
  };

  if (!qs.length) return (
    <Dialog open onOpenChange={onClose}><DialogContent><div className="py-8 text-center text-muted-foreground">No questions yet.</div></DialogContent></Dialog>
  );

  if (done) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="text-center py-10 max-w-md">
        <Trophy className="h-12 w-12 text-warning mx-auto mb-2" />
        <div className="text-3xl font-semibold mb-1">{score} / {qs.length}</div>
        <div className="text-muted-foreground text-sm mb-6">{Math.round((score / qs.length) * 100)}% correct</div>
        <Button onClick={onClose}>Close</Button>
      </DialogContent>
    </Dialog>
  );

  const cur = qs[i];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>{material.name} — {i + 1}/{qs.length}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="font-medium text-lg">{cur.question}</div>
          <div className="space-y-2">
            {(cur.options as string[]).map((opt, idx) => {
              const isCorrect = idx === cur.correct_index;
              const show = selected !== null;
              return (
                <button key={idx} disabled={selected !== null}
                  onClick={() => { setSelected(idx); if (idx === cur.correct_index) setScore(s => s + 1); }}
                  className={`block w-full text-left px-4 py-3 rounded-md border text-sm transition ${
                    show && isCorrect ? "border-success bg-success/10" :
                    show && selected === idx ? "border-destructive bg-destructive/10" :
                    "hover:bg-muted"
                  }`}>
                  <span className="font-medium mr-2">{String.fromCharCode(65 + idx)}.</span>{opt}
                </button>
              );
            })}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={next} disabled={selected === null}>
            {i + 1 >= qs.length ? "Finish" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Quiz Leaderboard ---------- */
export function QuizLeaderboardDialog({ material, onClose }: { material: MaterialLike; onClose: () => void }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    (async () => {
      const { count } = await supabase.from("quiz_questions").select("*", { count: "exact", head: true }).eq("material_id", material.id);
      setTotal(count ?? 0);

      // group members
      let memberRows: any[] = [];
      if (material.group_id) {
        const { data } = await supabase.from("group_members").select("user_id,profiles(name)").eq("group_id", material.group_id);
        memberRows = data ?? [];
      } else {
        memberRows = [{ user_id: material.user_id, profiles: null }];
      }

      const { data: attempts } = await supabase.from("quiz_attempts")
        .select("user_id,score,completed_at").eq("material_id", material.id).order("score", { ascending: false });

      const bestPerUser = new Map<string, any>();
      for (const a of (attempts ?? []) as any[]) {
        if (!bestPerUser.has(a.user_id)) bestPerUser.set(a.user_id, a);
      }

      const combined = memberRows.map((m: any) => {
        const a = bestPerUser.get(m.user_id);
        return {
          user_id: m.user_id,
          name: m.profiles?.name ?? "?",
          score: a?.score ?? null,
          completed_at: a?.completed_at ?? null,
        };
      });
      combined.sort((a, b) => (b.score ?? -1) - (a.score ?? -1));
      setRows(combined);
    })();
  }, [material.id]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Leaderboard — {material.name}</DialogTitle></DialogHeader>
        <div className="space-y-2 py-2">
          {rows.map((r, i) => {
            const isMe = r.user_id === user?.id;
            const played = r.score !== null;
            const pts = played ? Math.round((r.score / Math.max(1, total)) * 50) : 0;
            return (
              <div key={r.user_id} className={`flex items-center gap-3 p-2 rounded-md ${isMe ? "bg-primary/5 border border-primary/20" : ""} ${!played ? "opacity-50" : ""}`}>
                <div className="w-5 text-xs font-medium text-muted-foreground text-center">{played ? i + 1 : "—"}</div>
                <Avatar name={r.name} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{r.name}{isMe && " (you)"}</div>
                  {played
                    ? <div className="text-xs text-muted-foreground">{format(new Date(r.completed_at), "MMM d, HH:mm")}</div>
                    : <div className="text-xs text-muted-foreground">Not played yet</div>}
                </div>
                {played && <div className="text-sm font-medium">{r.score}/{total} <span className="text-xs text-muted-foreground">+{pts}pts</span></div>}
              </div>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
