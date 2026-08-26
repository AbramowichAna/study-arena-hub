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
import { PracticeDialog, PlayQuizDialog, QuizLeaderboardDialog } from "@/components/materials/MaterialActionDialogs";

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

const SUBJECT_TAGS = [
  "Matemáticas", "Física", "Química", "Biología", "Historia", "Literatura", 
  "Inglés", "Programación", "Derecho", "Medicina", "Psicología", "Filosofía",
  "Economía", "Contabilidad", "Marketing", "Estadística", "Otro"
];

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
          <h1 className="text-2xl font-semibold">Materiales de Estudio</h1>
          <p className="text-sm text-muted-foreground mt-1">Tarjetas, cuestionarios y archivos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setUploadOpen(true)}><Upload className="h-4 w-4 mr-1" /> Subir archivo</Button>
          <Button variant="outline" onClick={() => setFlashOpen(true)}><BookOpen className="h-4 w-4 mr-1" /> Tarjetas</Button>
          <Button onClick={() => setQuizOpen(true)}><Brain className="h-4 w-4 mr-1" /> Cuestionario</Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="flashcards">Tarjetas</TabsTrigger>
          <TabsTrigger value="quizzes">Cuestionarios</TabsTrigger>
          <TabsTrigger value="files">Archivos</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <Card className="p-12 text-center border-[0.5px]">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">Aún no hay materiales</h3>
          <p className="text-sm text-muted-foreground mb-4">Sube archivos, crea tarjetas o construye cuestionarios para tus grupos.</p>
          <Button onClick={() => setFlashOpen(true)}><Plus className="h-4 w-4 mr-1" /> Crear tarjetas</Button>
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
          <div className="space-y-1.5">
            <Label>Materia/Tag</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue placeholder="Selecciona una materia" /></SelectTrigger>
              <SelectContent>
                {SUBJECT_TAGS.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
            <div className="space-y-1.5">
            <Label>Materia/Tag</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue placeholder="Selecciona una materia" /></SelectTrigger>
              <SelectContent>
                {SUBJECT_TAGS.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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
            <div className="space-y-1.5">
            <Label>Materia/Tag</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue placeholder="Selecciona una materia" /></SelectTrigger>
              <SelectContent>
                {SUBJECT_TAGS.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
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

