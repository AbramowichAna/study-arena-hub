import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, FileText, Sparkles, Plus, Play, Brain } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { generateMaterial } from "@/lib/ai.functions";

export const Route = createFileRoute("/_authenticated/materials")({
  component: MaterialsPage,
});

type Material = {
  id: string; name: string; type: "flashcard_set" | "quiz" | "file";
  subject: string | null; ai_generated: boolean; group_id: string | null;
};

function MaterialsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [groups, setGroups] = useState<{ id: string; name: string }[]>([]);
  const [playOpen, setPlayOpen] = useState<Material | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async () => {
    const [{ data: m }, { data: g }] = await Promise.all([
      supabase.from("study_materials").select("*").order("created_at", { ascending: false }),
      supabase.from("group_members").select("groups(id,name)"),
    ]);
    setMaterials((m as Material[]) ?? []);
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
        <Button onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4 mr-1" /> Create</Button>
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
          <p className="text-sm text-muted-foreground mb-4">Create flashcards or quizzes, or generate some with AI.</p>
          <Button onClick={() => setCreateOpen(true)}><Sparkles className="h-4 w-4 mr-1" /> Create your first</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {filtered.map(m => (
            <Card key={m.id} className="p-5 border-[0.5px]">
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
                {m.ai_generated && <Badge variant="secondary"><Sparkles className="h-3 w-3 mr-1" />AI</Badge>}
              </div>
              <div className="font-medium">{m.name}</div>
              {m.subject && <div className="text-xs text-muted-foreground mt-0.5">{m.subject}</div>}
              <Button size="sm" variant="outline" className="mt-4 w-full" onClick={() => setPlayOpen(m)}>
                <Play className="h-3.5 w-3.5 mr-1" /> {m.type === "quiz" ? "Play" : "Practice"}
              </Button>
            </Card>
          ))}
        </div>
      )}

      <CreateMaterialDialog open={createOpen} onClose={() => { setCreateOpen(false); load(); }} groups={groups} userId={user?.id} />
      {playOpen && <PlayDialog material={playOpen} onClose={() => setPlayOpen(null)} />}
    </div>
  );
}

function CreateMaterialDialog({ open, onClose, groups, userId }:
  { open: boolean; onClose: () => void; groups: { id: string; name: string }[]; userId?: string }) {
  const [type, setType] = useState<"flashcard_set" | "quiz">("flashcard_set");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [groupId, setGroupId] = useState<string>("");
  const [aiText, setAiText] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (useAI: boolean) => {
    if (!userId || !name) return;
    setLoading(true);
    try {
      const { data: mat, error } = await supabase.from("study_materials").insert({
        name, type, subject: subject || null, group_id: groupId || null, user_id: userId, ai_generated: useAI,
      }).select().single();
      if (error) throw error;

      if (useAI) {
        if (!aiText.trim()) { toast.error("Paste some study text"); setLoading(false); return; }
        const result = await generateMaterial({ data: { text: aiText, type } });
        if (type === "flashcard_set") {
          const cards = (result.items as any[]).map((c, i) => ({ material_id: mat.id, front: c.front, back: c.back, order: i }));
          if (cards.length) await supabase.from("flashcards").insert(cards);
        } else {
          const qs = (result.items as any[]).map((q, i) => ({ material_id: mat.id, question: q.question, options: q.options, correct_index: q.correct_index, order: i }));
          if (qs.length) await supabase.from("quiz_questions").insert(qs);
        }
        toast.success(`Generated ${result.items.length} items with AI`);
      } else {
        toast.success("Created — add content from the card");
      }
      onClose();
      setName(""); setSubject(""); setAiText("");
    } catch (e: any) {
      toast.error(e.message ?? "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Create study material</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v: any) => setType(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flashcard_set">Flashcards</SelectItem>
                  <SelectItem value="quiz">Quiz</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Group (optional)</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="Personal" /></SelectTrigger>
                <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5"><Label>Name</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>Subject</Label><Input value={subject} onChange={e => setSubject(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1"><Sparkles className="h-3.5 w-3.5 text-warning" /> Generate from text (AI)</Label>
            <Textarea rows={5} value={aiText} onChange={e => setAiText(e.target.value)} placeholder="Paste your notes or source text…" />
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" disabled={loading} onClick={() => submit(false)}>Create empty</Button>
          <Button disabled={loading || !name} onClick={() => submit(true)}>
            <Sparkles className="h-4 w-4 mr-1" /> {loading ? "Generating…" : "Generate with AI"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PlayDialog({ material, onClose }: { material: Material; onClose: () => void }) {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      if (material.type === "flashcard_set") {
        const { data } = await supabase.from("flashcards").select("*").eq("material_id", material.id).order("order");
        setItems(data ?? []);
      } else if (material.type === "quiz") {
        const { data } = await supabase.from("quiz_questions").select("*").eq("material_id", material.id).order("order");
        setItems(data ?? []);
      }
    })();
  }, [material.id]);

  const next = async () => {
    setFlipped(false); setSelected(null);
    if (i + 1 >= items.length) {
      setDone(true);
      if (material.type === "quiz" && user) {
        const pts = Math.round((score / items.length) * 50) || 10;
        await supabase.from("quiz_attempts").insert({ material_id: material.id, user_id: user.id, score });
        await supabase.from("point_events").insert({ user_id: user.id, type: "quiz_score", points: pts });
        toast.success(`+${pts} pts!`);
      }
    } else setI(i + 1);
  };

  if (!items.length) return (
    <Dialog open onOpenChange={onClose}><DialogContent><div className="py-8 text-center text-muted-foreground">No content yet.</div></DialogContent></Dialog>
  );

  if (done) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="text-center py-10">
        <div className="text-3xl font-semibold mb-2">{material.type === "quiz" ? `${score}/${items.length}` : "Done!"}</div>
        <div className="text-muted-foreground text-sm mb-6">Great work!</div>
        <Button onClick={onClose}>Close</Button>
      </DialogContent>
    </Dialog>
  );

  const cur = items[i];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{material.name} — {i + 1}/{items.length}</DialogTitle></DialogHeader>
        {material.type === "flashcard_set" ? (
          <div onClick={() => setFlipped(!flipped)} className="min-h-[180px] flex items-center justify-center p-8 bg-muted/30 rounded-md cursor-pointer text-center text-lg font-medium">
            {flipped ? cur.back : cur.front}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="font-medium">{cur.question}</div>
            <div className="space-y-2">
              {(cur.options as string[]).map((opt, idx) => {
                const isCorrect = idx === cur.correct_index;
                const showState = selected !== null;
                return (
                  <button key={idx}
                    disabled={selected !== null}
                    onClick={() => {
                      setSelected(idx);
                      if (idx === cur.correct_index) setScore(s => s + 1);
                    }}
                    className={`block w-full text-left px-3 py-2 rounded-md border text-sm transition ${
                      showState && isCorrect ? "border-success bg-success/10" :
                      showState && selected === idx ? "border-destructive bg-destructive/10" :
                      "hover:bg-muted"
                    }`}>
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={next} disabled={material.type === "quiz" && selected === null}>
            {i + 1 >= items.length ? "Finish" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
