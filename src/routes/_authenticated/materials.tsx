import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BookOpen, Brain, Plus, Upload } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  PracticeDialog, PlayQuizDialog, QuizLeaderboardDialog, UploadFileDialog, FlashcardSetDialog, MaterialCard,
  SUBJECT_TAGS, type Group,
} from "@/components/materials/MaterialActionDialogs";

export const Route = createFileRoute("/_authenticated/materials")({
  component: MaterialsPage,
});

type Material = {
  id: string; name: string; type: "flashcard_set" | "quiz" | "file";
  subject: string | null; ai_generated: boolean; group_id: string | null;
  file_url: string | null; user_id: string;
  groups?: { name: string } | null;
};

function MaterialsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState("all");
  const [materials, setMaterials] = useState<Material[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [adminGroupIds, setAdminGroupIds] = useState<Set<string>>(new Set());
  const [uploadOpen, setUploadOpen] = useState(false);
  const [flashOpen, setFlashOpen] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [practice, setPractice] = useState<Material | null>(null);
  const [play, setPlay] = useState<Material | null>(null);
  const [leaderboardFor, setLeaderboardFor] = useState<Material | null>(null);

  const load = async () => {
    const [{ data: m }, { data: g }] = await Promise.all([
      supabase.from("study_materials").select("*,groups(name)").order("created_at", { ascending: false }),
      user ? supabase.from("group_members").select("role,groups(id,name)").eq("user_id", user.id) : Promise.resolve({ data: [] as any[] }),
    ]);
    setMaterials((m as any) ?? []);
    const rows = (g ?? []) as any[];
    setGroups(rows.map((x: any) => x.groups).filter(Boolean));
    setAdminGroupIds(new Set(rows.filter((x: any) => x.role === "admin" && x.groups).map((x: any) => x.groups.id)));
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
            <MaterialCard
              key={m.id}
              material={m}
              currentUserId={user?.id}
              isGroupAdmin={!!m.group_id && adminGroupIds.has(m.group_id)}
              showGroupBadge
              groups={groups}
              onPractice={() => setPractice(m)}
              onPlay={() => setPlay(m)}
              onLeaderboard={() => setLeaderboardFor(m)}
              onChanged={load}
            />
          ))}
        </div>
      )}

      <UploadFileDialog open={uploadOpen} onClose={() => { setUploadOpen(false); load(); }} groups={groups} userId={user?.id} />
      <FlashcardSetDialog open={flashOpen} onClose={() => { setFlashOpen(false); load(); }} groups={groups} userId={user?.id} />
      <QuizDialog open={quizOpen} onClose={() => { setQuizOpen(false); load(); }} groups={groups} userId={user?.id} />
      {practice && <PracticeDialog material={practice} onClose={() => setPractice(null)} />}
      {play && <PlayQuizDialog material={play} onClose={() => setPlay(null)} />}
      {leaderboardFor && <QuizLeaderboardDialog material={leaderboardFor} onClose={() => setLeaderboardFor(null)} />}
    </div>
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
    if (!valid.length) return toast.error("Agregá al menos una pregunta completa");
    setLoading(true);
    try {
      const { data: mat, error } = await supabase.from("study_materials").insert({
        name, type: "quiz", subject: subject || null, group_id: groupId || null, user_id: userId,
      }).select().single();
      if (error) throw error;
      await supabase.from("quiz_questions").insert(valid.map((q, i) => ({
        material_id: mat.id, question: q.question, options: q.options, correct_index: q.correct, order: i,
      })));
      toast.success(`Creaste un cuestionario con ${valid.length} preguntas`);
      setName(""); setSubject(""); setGroupId("");
      setQs([{ question: "", options: ["", "", "", ""], correct: 0 }]);
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Crear cuestionario</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            <div className="space-y-1.5">
            <Label>Materia</Label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger><SelectValue placeholder="Elegí una materia" /></SelectTrigger>
              <SelectContent>
                {SUBJECT_TAGS.map(tag => <SelectItem key={tag} value={tag}>{tag}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          </div>
          <div className="space-y-1.5">
            <Label>Grupo (opcional)</Label>
            <Select value={groupId} onValueChange={setGroupId}>
              <SelectTrigger><SelectValue placeholder="Personal" /></SelectTrigger>
              <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-3">
            {qs.map((q, i) => (
              <Card key={i} className="p-3 border-[0.5px] space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Pregunta {i + 1}</Label>
                  <Button variant="ghost" size="sm" onClick={() => setQs(qs.filter((_, j) => j !== i))} disabled={qs.length === 1}>Quitar</Button>
                </div>
                <Input value={q.question} placeholder="Texto de la pregunta" onChange={e => setQs(prev => prev.map((x, j) => j === i ? { ...x, question: e.target.value } : x))} />
                <div className="grid grid-cols-2 gap-2">
                  {q.options.map((opt, oi) => (
                    <div key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`correct-${i}`} checked={q.correct === oi}
                        onChange={() => setQs(prev => prev.map((x, j) => j === i ? { ...x, correct: oi } : x))} />
                      <Input value={opt} placeholder={`Opción ${String.fromCharCode(65 + oi)}`}
                        onChange={e => setQs(prev => prev.map((x, j) => j === i ? { ...x, options: x.options.map((o, k) => k === oi ? e.target.value : o) } : x))} />
                    </div>
                  ))}
                </div>
              </Card>
            ))}
            <Button variant="outline" size="sm" onClick={() => setQs([...qs, { question: "", options: ["", "", "", ""], correct: 0 }])}>
              + Agregar pregunta
            </Button>
          </div>
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading || !name}>{loading ? "Guardando…" : "Crear cuestionario"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
