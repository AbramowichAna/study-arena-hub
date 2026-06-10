import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, FileText, Brain, Plus, Play, Trophy, Upload, ExternalLink } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Avatar } from "@/components/AppShell";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/materials")({
  component: MaterialsPage,
});

type Material = {
  id: string; name: string; type: "flashcard_set" | "quiz" | "file";
  subject: string | null; ai_generated: boolean; group_id: string | null;
  file_url: string | null; user_id: string;
  groups?: { name: string } | null;
};

type Group = { id: string; name: string };

function MaterialsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [flashOpen, setFlashOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [practice, setPractice] = useState<Material | null>(null);
  const [play, setPlay] = useState<Material | null>(null);
  const [leaderboardFor, setLeaderboardFor] = useState<Material | null>(null);

  const load = async () => {
    const [{ data: m }, { data: g }] = await Promise.all([
      supabase.from("study_materials").select("*,groups(name)").order("created_at", { ascending: false }),
      supabase.from("group_members").select("groups(id,name)"),
    ]);
    setMaterials((m as any) ?? []);
    setGroups(((g ?? []) as any).map((x: any) => x.groups).filter(Boolean));
  };
  useEffect(() => { load(); }, [user?.id]);

  const filtered = materials.filter(m => {
    if (tab === "all") return true;
    if (tab === "flashcards") return m.type === "flashcard_set";
    if (tab === "quizzes") return m.type === "quiz";
    if (tab === "files") return m.type === "file";
    return true;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Study Materials</h1>
          <p className="text-sm text-muted-foreground mt-1">Flashcards, quizzes, and files</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1" /> Upload file</Button>
          <Button variant="outline" onClick={() => setFlashOpen(true)}><BookOpen className="h-4 w-4 mr-1" /> Flashcards</Button>
          <Button onClick={() => setQuizOpen(true)}><Brain className="h-4 w-4 mr-1" /> Quiz</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="flashcards">Flashcards</TabsTrigger>
          <TabsTrigger value="quizzes">Quizzes</TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-[0.5px]">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">No materials yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Upload files, create flashcards, or build quizzes for your groups.</p>
          <Button onClick={() => setFlashOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create flashcards</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(m => (
            <Card key={m.id} className="p-5 border-[0.5px] flex flex-col">
              <div className="flex items-start justify-between mb-3">
                <div className={`h-9 w-9 rounded-md flex items-center justify-center ${
                  m.type === "quiz" ? "bg-warning/10 text-warning" :
                  m.type === "flashcard_set" ? "bg-primary/10 text-primary" :
                  "bg-success/10 text-success"
                }`}>
                  {m.type === "quiz" ? <Brain className="h-4 w-4" /> :
                   m.type === "flashcard_set" ? <BookOpen className="h-4 w-4" /> :
                   <FileText className="h-4 w-4" />}
                </div>
                {m.groups && <Badge variant="secondary">{m.groups.name}</Badge>}
              </div>
              <div className="font-medium">{m.name}</div>
              {m.subject && <div className="text-xs text-muted-foreground mt-0.5">{m.subject}</div>}
              <div className="mt-4 flex gap-2">
                {m.type === "file" && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => openFile(m.file_url)}>
                    <ExternalLink className="h-3.5 w-3.5 mr-1" /> View
                  </Button>
                )}
                {m.type === "flashcard_set" && (
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => setPractice(m)}>
                    <Play className="h-3.5 w-3.5 mr-1" /> Practice
                  </Button>
                )}
                {m.type === "quiz" && (
                  <>
                    <Button size="sm" className="flex-1" onClick={() => setPlay(m)}>
                      <Play className="h-3.5 w-3.5 mr-1" /> Play
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

      <UploadFileDialog open={uploadOpen} onClose={() => { setUploadOpen(false); load(); }} groups={groups} userId={user?.id} />
      <FlashcardsDialog open={flashOpen} onClose={() => { setFlashOpen(false); load(); }} groups={groups} userId={user?.id} />
      <QuizDialog open={quizOpen} onClose={() => { setQuizOpen(false); load(); }} groups={groups} userId={user?.id} />
      {practice && <PracticeDialog material={practice} onClose={() => setPractice(null)} />}
      {play && <PlayQuizDialog material={play} onClose={() => setPlay(null)} />}
      {leaderboardFor && <QuizLeaderboardDialog material={leaderboardFor} onClose={() => setLeaderboardFor(null)} />}
    </div>
  );
}

async function openFile(path: string | null) {
  if (!path) return;
  const { data, error } = await supabase.storage.from("study-files").createSignedUrl(path, 3600);
  if (error || !data) return toast.error("Cannot open file");
  window.open(data.signedUrl, "_blank");
}

/* ---------- Upload File ---------- */
function UploadFileDialog({ open, onClose, groups, userId }:
  { open: boolean; onClose: () => void; groups: Group[]; userId?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [subject, setSubject] = useState("");
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!file || !groupId || !userId) return toast.error("File and group required");
    setLoading(true);
    try {
      const path = `${groupId}/${crypto.randomUUID()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("study-files").upload(path, file);
      if (upErr) throw upErr;
      const { error } = await supabase.from("study_materials").insert({
        name: name || file.name, type: "file", subject: subject || null,
        group_id: groupId, user_id: userId, file_url: path,
      });
      if (error) throw error;
      toast.success("Uploaded");
      setFile(null); setSubject(""); setName(""); setGroupId("");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Upload file</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5"><Label>File</Label><Input type="file" onChange={e => setFile(e.target.files?.[0] ?? null)} /></div>
          <div className="space-y-1.5"><Label>Name (optional)</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={file?.name ?? ""} /></div>
          <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Share with group</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Pick a group" /></SelectTrigger>
              <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading || !file || !groupId}>{loading ? "Uploading…" : "Upload"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Flashcards Create ---------- */
function FlashcardsDialog({ open, onClose, groups, userId }:
  { open: boolean; onClose: () => void; groups: Group[]; userId?: string }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [groupId, setGroupId] = useState("");
  const [cards, setCards] = useState<{ front: string; back: string }[]>([{ front: "", back: "" }]);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!userId || !name) return;
    const valid = cards.filter(c => c.front.trim() && c.back.trim());
    if (!valid.length) return toast.error("Add at least one card");
    setLoading(true);
    try {
      const { data: mat, error } = await supabase.from("study_materials").insert({
        name, type: "flashcard_set", subject: subject || null, group_id: groupId || null, user_id: userId,
      }).select().single();
      if (error) throw error;
      await supabase.from("flashcards").insert(valid.map((c, i) => ({
        material_id: mat.id, front: c.front, back: c.back, order: i,
      })));
      toast.success(`Created ${valid.length} flashcards`);
      setName(""); setSubject(""); setGroupId(""); setCards([{ front: "", back: "" }]);
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create flashcards</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Group (optional)</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Personal" /></SelectTrigger>
              <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Cards</Label>
            {cards.map((c, i) => (
              <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                <Input placeholder="Front" value={c.front} onChange={e => setCards(prev => prev.map((x, j) => j === i ? { ...x, front: e.target.value } : x))} />
                <Input placeholder="Back" value={c.back} onChange={e => setCards(prev => prev.map((x, j) => j === i ? { ...x, back: e.target.value } : x))} />
                <Button variant="ghost" size="icon" onClick={() => setCards(cards.filter((_, j) => j !== i))} disabled={cards.length === 1}>×</Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setCards([...cards, { front: "", back: "" }])}>+ Add card</Button>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading || !name}>{loading ? "Saving…" : "Create"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Quiz Create ---------- */
function QuizDialog({ open, onClose, groups, userId }:
  { open: boolean; onClose: () => void; groups: Group[]; userId?: string }) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [groupId, setGroupId] = useState("");
  const [qs, setQs] = useState<{ question: string; options: string[]; correct: number }[]>([
    { question: "", options: ["", "", "", ""], correct: 0 },
  ]);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!userId || !name) return;
    const valid = qs.filter(q => q.question.trim() && q.options.every(o => o.trim()));
    if (!valid.length) return toast.error("Add at least one complete question");
    setLoading(true);
    try {
      const { data: mat, error } = await supabase.from("study_materials").insert({
        name, type: "quiz", subject: subject || null, group_id: groupId || null, user_id: userId,
      }).select().single();
      if (error) throw error;
      await supabase.from("quiz_questions").insert(valid.map((q, i) => ({
        material_id: mat.id, question: q.question, options: q.options, correct_index: q.correct, order: i,
      })));
      toast.success(`Created quiz with ${valid.length} questions`);
      setName(""); setSubject(""); setGroupId("");
      setQs([{ question: "", options: ["", "", "", ""], correct: 0 }]);
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Create quiz</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Group (optional)</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Personal" /></SelectTrigger>
              <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {qs.map((q, i) => (
              <Card key={i} className="p-3 border-[0.5px] space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Question {i + 1}</Label>
                  <Button variant="ghost" size="sm" onClick={() => setQs(qs.filter((_, j) => j !== i))} disabled={qs.length === 1}>Remove</Button>
                </div>
                <Input value={q.question} placeholder="Question text" onChange={e => setQs(prev => prev.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} />
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${i}`} checked={q.correct === oi}
                        onChange={() => setQs(prev => prev.map((x, j) => j === i ? { ...x, correct: oi } : x))} />
                      <Input value={opt} placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                        onChange={e => setQs(prev => prev.map((x, j) => j === i ? { ...x, options: x.options.map((o, k) => k === oi ? e.target.value : o) } : x))} />
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={() => setQs([...qs, { question: "", options: ["", "", "", ""], correct: 0 }])}>
              + Add question
            </Button>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading || !name}>{loading ? "Saving…" : "Create quiz"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Practice Flashcards ---------- */
function PracticeDialog({ material, onClose }: { material: Material; onClose: () => void }) {
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
function PlayQuizDialog({ material, onClose }: { material: Material; onClose: () => void }) {
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
function QuizLeaderboardDialog({ material, onClose }: { material: Material; onClose: () => void }) {
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
