import { useEffect, useState } from "react";
import { Trophy, BookOpen, Brain, FileText, Play, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Avatar } from "@/components/AppShell";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

export const SUBJECT_TAGS = [
  "Matemáticas", "Física", "Química", "Biología", "Historia", "Literatura",
  "Inglés", "Programación", "Derecho", "Medicina", "Psicología", "Filosofía",
  "Economía", "Contabilidad", "Marketing", "Estadística", "Otro"
];

export type Group = { id: string; name: string };

export type MaterialLike = {
  id: string;
  name: string;
  group_id: string | null;
  user_id: string;
};

type MaterialFull = MaterialLike & {
  type: "flashcard_set" | "quiz" | "file";
  subject: string | null;
  file_url: string | null;
  groups?: { name: string } | null;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/* ---------- Upload File (mock: no se sube el contenido real) ---------- */
export function UploadFileDialog({ open, onClose, groups, userId, fixedGroupId }:
  { open: boolean; onClose: () => void; groups: Group[]; userId?: string; fixedGroupId?: string }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState(fixedGroupId ?? "");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFile(null); setName("");
    setGroupId(fixedGroupId ?? "");
  }, [open, fixedGroupId]);

  const groupName = groups.find(g => g.id === groupId)?.name;

  const submit = async () => {
    if (!file || !groupId || !userId) return toast.error("Elegí un archivo y un grupo");
    setLoading(true);
    try {
      // No se almacena el archivo real (mock): solo guardamos su referencia.
      const { error } = await supabase.from("study_materials").insert({
        name: name || file.name, type: "file", subject: null,
        group_id: groupId, user_id: userId, file_url: null,
      });
      if (error) throw error;
      toast.success("Archivo compartido con el grupo");
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Subir archivo</DialogTitle></DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Archivo</Label>
            <Input type="file" onChange={e => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !name) setName(f.name);
            }} />
            {file && (
              <div className="text-xs text-muted-foreground">
                {formatBytes(file.size)} — el contenido no se almacena en este entorno de prueba.
              </div>
            )}
          </div>
          <div className="space-y-1.5"><Label>Nombre (opcional)</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder={file?.name ?? "Ej: Apuntes de Cálculo"} /></div>
          {fixedGroupId ? (
            <div className="text-xs text-muted-foreground">
              Se compartirá con <span className="font-medium text-foreground">{groupName}</span>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label>Compartir con el grupo</Label>
              <Select value={groupId} onValueChange={setGroupId}>
                <SelectTrigger><SelectValue placeholder="Elegí un grupo" /></SelectTrigger>
                <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter><Button onClick={submit} disabled={loading || !file || !groupId}>{loading ? "Subiendo…" : "Subir"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Flashcard set: crear / editar ---------- */
export type FlashcardSetMaterial = { id: string; name: string; subject: string | null; group_id: string | null };

export function FlashcardSetDialog({ open, onClose, groups, userId, fixedGroupId, material }:
  {
    open: boolean; onClose: () => void; groups: Group[]; userId?: string; fixedGroupId?: string;
    material?: FlashcardSetMaterial | null;
  }) {
  const isEdit = !!material;
  const [name, setName] = useState("");
  const [groupId, setGroupId] = useState("");
  const [cards, setCards] = useState<{ front: string; back: string }[]>([{ front: "", back: "" }]);
  const [loading, setLoading] = useState(false);
  const [loadingCards, setLoadingCards] = useState(isEdit);

  useEffect(() => {
    if (!open) return;
    setName(material?.name ?? "");
    setGroupId(material?.group_id ?? fixedGroupId ?? "");
    if (material) {
      setLoadingCards(true);
      supabase.from("flashcards").select("front,back").eq("material_id", material.id).order("order")
        .then(({ data }) => {
          setCards(data && data.length ? data.map(c => ({ front: c.front, back: c.back })) : [{ front: "", back: "" }]);
          setLoadingCards(false);
        });
    } else {
      setCards([{ front: "", back: "" }]);
      setLoadingCards(false);
    }
  }, [open, material?.id, fixedGroupId]);

  const groupName = groups.find(g => g.id === groupId)?.name;

  const submit = async () => {
    if (!userId || !name.trim()) return toast.error("Ponele un nombre al set");
    const valid = cards.filter(c => c.front.trim() && c.back.trim());
    if (!valid.length) return toast.error("Agregá al menos una tarjeta completa");
    setLoading(true);
    try {
      let materialId = material?.id;
      if (isEdit && materialId) {
        const { error } = await supabase.from("study_materials").update({ name }).eq("id", materialId);
        if (error) throw error;
        const { error: delErr } = await supabase.from("flashcards").delete().eq("material_id", materialId);
        if (delErr) throw delErr;
      } else {
        const { data: mat, error } = await supabase.from("study_materials").insert({
          name, type: "flashcard_set", subject: null, group_id: groupId || null, user_id: userId,
        }).select().single();
        if (error) throw error;
        materialId = mat.id;
      }
      const { error: insErr } = await supabase.from("flashcards").insert(valid.map((c, i) => ({
        material_id: materialId, front: c.front, back: c.back, order: i,
      })));
      if (insErr) throw insErr;
      toast.success(isEdit ? "Set de tarjetas actualizado" : `Creaste ${valid.length} tarjetas`);
      onClose();
    } catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{isEdit ? "Editar tarjetas" : "Crear tarjetas"}</DialogTitle></DialogHeader>
        {loadingCards ? (
          <div className="py-10 text-center text-sm text-muted-foreground">Cargando…</div>
        ) : (
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Nombre</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
            {isEdit ? (
              <div className="text-xs text-muted-foreground">
                Grupo: <span className="font-medium text-foreground">{groupName ?? "Personal"}</span> (no se puede cambiar)
              </div>
            ) : fixedGroupId ? (
              <div className="text-xs text-muted-foreground">
                Se creará en <span className="font-medium text-foreground">{groupName}</span>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Grupo (opcional)</Label>
                <Select value={groupId} onValueChange={setGroupId}>
                  <SelectTrigger><SelectValue placeholder="Personal" /></SelectTrigger>
                  <SelectContent>{groups.map(g => <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label>Tarjetas</Label>
              {cards.map((c, i) => (
                <div key={i} className="grid grid-cols-[1fr_1fr_auto] gap-2">
                  <Input placeholder="Frente" value={c.front} onChange={e => setCards(prev => prev.map((x, j) => j === i ? { ...x, front: e.target.value } : x))} />
                  <Input placeholder="Dorso" value={c.back} onChange={e => setCards(prev => prev.map((x, j) => j === i ? { ...x, back: e.target.value } : x))} />
                  <Button variant="ghost" size="icon" onClick={() => setCards(cards.filter((_, j) => j !== i))} disabled={cards.length === 1}>×</Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setCards([...cards, { front: "", back: "" }])}>+ Agregar tarjeta</Button>
            </div>
          </div>
        )}
        <DialogFooter>
          <Button onClick={submit} disabled={loading || loadingCards || !name.trim()}>
            {loading ? "Guardando…" : isEdit ? "Guardar cambios" : "Crear"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Tarjeta de material unificada (ver/practicar/jugar + editar/eliminar) ---------- */
export function MaterialCard({
  material, currentUserId, isGroupAdmin, showGroupBadge, groups, onPractice, onPlay, onLeaderboard, onChanged, compact,
}: {
  material: MaterialFull;
  currentUserId?: string;
  isGroupAdmin: boolean;
  showGroupBadge?: boolean;
  groups: Group[];
  onPractice: () => void;
  onPlay: () => void;
  onLeaderboard: () => void;
  onChanged: () => void;
  compact?: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isAuthor = !!currentUserId && material.user_id === currentUserId;
  const canEdit = isAuthor && material.type === "flashcard_set";
  const canDelete = isAuthor || isGroupAdmin;

  const handleView = async () => {
    if (!material.file_url) { setPreviewOpen(true); return; }
    const { data, error } = await supabase.storage.from("study-files").createSignedUrl(material.file_url, 3600);
    if (error || !data) return toast.error("No se pudo abrir el archivo");
    window.open(data.signedUrl, "_blank");
  };

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("study_materials").delete().eq("id", material.id);
    setDeleting(false);
    if (error) return toast.error("No se pudo eliminar el material");
    toast.success("Material eliminado");
    onChanged();
  };

  return (
    <>
      <Card className={`${compact ? "p-4" : "p-5"} border-[0.5px] flex flex-col`}>
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className={`${compact ? "h-8 w-8" : "h-9 w-9"} rounded-md flex items-center justify-center shrink-0 ${
            material.type === "quiz" ? "bg-warning/10 text-warning" :
            material.type === "flashcard_set" ? "bg-primary/10 text-primary" :
            "bg-success/10 text-success"
          }`}>
            {material.type === "quiz" ? <Brain className="h-4 w-4" /> :
             material.type === "flashcard_set" ? <BookOpen className="h-4 w-4" /> :
             <FileText className="h-4 w-4" />}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {showGroupBadge && material.groups && <Badge variant="secondary">{material.groups.name}</Badge>}
            {canEdit && (
              <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Editar tarjetas" onClick={() => setEditOpen(true)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
            {canDelete && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" aria-label="Eliminar material">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>¿Eliminar "{material.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive">
                      {deleting ? "Eliminando…" : "Eliminar"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
        <div className={`font-medium ${compact ? "text-sm" : ""}`}>{material.name}</div>
        {material.subject && <div className="text-xs text-muted-foreground mt-0.5">{material.subject}</div>}
        <div className={`${compact ? "mt-3" : "mt-4"} flex gap-2`}>
          {material.type === "file" && (
            <Button size="sm" variant="outline" className="flex-1" onClick={handleView}>
              <ExternalLink className="h-3.5 w-3.5 mr-1" /> Ver
            </Button>
          )}
          {material.type === "flashcard_set" && (
            <Button size="sm" variant="outline" className="flex-1" onClick={onPractice}>
              <Play className="h-3.5 w-3.5 mr-1" /> Practicar
            </Button>
          )}
          {material.type === "quiz" && (
            <>
              <Button size="sm" className="flex-1" onClick={onPlay}>
                <Play className="h-3.5 w-3.5 mr-1" /> Jugar
              </Button>
              <Button size="sm" variant="outline" onClick={onLeaderboard}>
                <Trophy className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </Card>

      {editOpen && (
        <FlashcardSetDialog
          open
          material={{ id: material.id, name: material.name, subject: material.subject, group_id: material.group_id }}
          groups={groups}
          userId={currentUserId}
          onClose={() => { setEditOpen(false); onChanged(); }}
        />
      )}

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-sm text-center py-8">
          <div className="h-12 w-12 rounded-md bg-success/10 text-success flex items-center justify-center mx-auto mb-3">
            <FileText className="h-6 w-6" />
          </div>
          <div className="font-medium">{material.name}</div>
          {material.subject && <div className="text-xs text-muted-foreground mt-1">{material.subject}</div>}
          <p className="text-xs text-muted-foreground mt-4">
            Vista previa simulada — en este entorno de prueba los archivos no se almacenan realmente.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}

/* ---------- Practicar tarjetas ---------- */
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
    <Dialog open onOpenChange={onClose}><DialogContent><div className="py-8 text-center text-muted-foreground">Todavía no hay tarjetas.</div></DialogContent></Dialog>
  );

  const cur = cards[i];
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>{material.name}</DialogTitle></DialogHeader>
        <div className="text-xs text-muted-foreground text-center">Tarjeta {i + 1} de {cards.length}</div>
        <div
          onClick={() => setFlipped(!flipped)}
          className="min-h-[220px] flex items-center justify-center p-8 bg-muted/30 rounded-md cursor-pointer text-center text-lg font-medium transition-transform"
          style={{ transform: flipped ? "rotateX(2deg)" : "rotateX(0)" }}
        >
          <div>
            <div className="text-xs uppercase text-muted-foreground mb-3">{flipped ? "Respuesta" : "Pregunta"}</div>
            {flipped ? cur.back : cur.front}
          </div>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="outline" disabled={i === 0} onClick={() => { setI(i - 1); setFlipped(false); }}>← Anterior</Button>
          <Button onClick={() => { if (i + 1 < cards.length) { setI(i + 1); setFlipped(false); } else onClose(); }}>
            {i + 1 < cards.length ? "Siguiente →" : "Finalizar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Jugar cuestionario ---------- */
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
    <Dialog open onOpenChange={onClose}><DialogContent><div className="py-8 text-center text-muted-foreground">Todavía no hay preguntas.</div></DialogContent></Dialog>
  );

  if (done) return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="text-center py-10 max-w-md">
        <Trophy className="h-12 w-12 text-warning mx-auto mb-2" />
        <div className="text-3xl font-semibold mb-1">{score} / {qs.length}</div>
        <div className="text-muted-foreground text-sm mb-6">{Math.round((score / qs.length) * 100)}% de aciertos</div>
        <Button onClick={onClose}>Cerrar</Button>
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
            {i + 1 >= qs.length ? "Finalizar" : "Siguiente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Tabla de posiciones del cuestionario ---------- */
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
        <DialogHeader><DialogTitle>Tabla de posiciones — {material.name}</DialogTitle></DialogHeader>
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
                  <div className="text-sm font-medium truncate">{r.name}{isMe && " (vos)"}</div>
                  {played
                    ? <div className="text-xs text-muted-foreground">{format(new Date(r.completed_at), "d MMM, HH:mm")}</div>
                    : <div className="text-xs text-muted-foreground">Todavía no jugó</div>}
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
