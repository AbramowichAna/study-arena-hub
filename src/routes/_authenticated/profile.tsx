import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Clock, Users, Pencil, Check, Camera } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
});

const GOAL_LABELS: Record<string, string> = {
  daily_hours: "Horas de estudio diarias",
  weekly_sessions: "Sesiones semanales",
};

function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const [goals, setGoals] = useState<Record<string, number>>({ daily_hours: 2, weekly_sessions: 10 });
  const [progress, setProgress] = useState<Record<string, number>>({ daily_hours: 0, weekly_sessions: 0 });
  const [editing, setEditing] = useState(false);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await supabase.from("user_goals").select("type,target").eq("user_id", user.id);
    const g: Record<string, number> = { ...goals };
    (data ?? []).forEach((r: any) => (g[r.type] = r.target));
    setGoals(g);

    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const dayAgo = new Date(Date.now() - 86400000).toISOString();
    const { data: events } = await supabase.from("point_events").select("type,points,created_at").eq("user_id", user.id).gte("created_at", weekAgo);
    const ws = (events ?? []).filter((e: any) => e.type === "session_complete").length;
    const ts = (events ?? []).filter((e: any) => e.type === "session_complete" && e.created_at >= dayAgo).length;
    setProgress({ daily_hours: (ts * 25) / 60, weekly_sessions: ws });
  };
  useEffect(() => { load(); }, [user?.id]);

  const save = async () => {
    if (!user) return;
    const rows = Object.entries(goals).map(([type, target]) => ({ user_id: user.id, type: type as any, target }));
    await supabase.from("user_goals").upsert(rows, { onConflict: "user_id,type" });
    toast.success("Metas guardadas");
    setEditing(false);
  };

  if (!profile) return null;

  const initials = profile.name.split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6 border-[0.5px]">
        <div className="flex items-center gap-5">
          <Avatar className="h-[72px] w-[72px]">
            <AvatarImage src={profile.avatar_url ?? undefined} alt={profile.name} />
            <AvatarFallback className="text-lg font-medium">{initials}</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold">{profile.name}</h1>
              <button
                onClick={() => setEditProfileOpen(true)}
                className="text-muted-foreground hover:text-primary transition-colors"
                aria-label="Editar perfil"
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>
            <div className="text-sm text-muted-foreground">{profile.email}</div>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-2 rounded-md bg-warning/10 text-warning text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4" /> {profile.total_points} pts
            </div>
          </div>
        </div>
      </Card>

      <EditProfileDialog
        open={editProfileOpen}
        onClose={() => setEditProfileOpen(false)}
        profile={profile}
        userId={user?.id}
        onSaved={refreshProfile}
      />

      <div className="grid grid-cols-3 gap-4">
        <MetricCard icon={Clock} label="Horas esta semana" value={(progress.weekly_sessions * 25 / 60).toFixed(1) + "h"} />
        <MetricCard icon={Trophy} label="Sesiones esta semana" value={String(progress.weekly_sessions)} />
        <MetricCard icon={Users} label="Horas hoy" value={(progress.daily_hours).toFixed(1) + "h"} />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Metas personales</h2>
            <p className="text-sm text-muted-foreground">Configura tus objetivos de estudio y sigue tu progreso</p>
          </div>
          {editing ? (
            <Button onClick={save} className="bg-green-600 hover:bg-green-700">
              <Check className="h-4 w-4 mr-1" /> Guardar
            </Button>
          ) : (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil className="h-4 w-4 mr-1" /> Editar metas
            </Button>
          )}
        </div>
        
        <div className="grid gap-6">
          {Object.entries(GOAL_LABELS).map(([k, label]) => {
            const target = goals[k] || 1;
            const cur = progress[k] || 0;
            const pct = Math.min(100, (cur / target) * 100);
            const isCompleted = pct >= 100;
            
            return (
              <Card key={k} className={`p-6 border-[0.5px] transition-all ${isCompleted ? 'bg-green-50 border-green-200' : 'hover:shadow-sm'}`}>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${isCompleted ? 'bg-green-500' : 'bg-primary'}`} />
                      <span className="font-medium">{label}</span>
                    </div>
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Meta:</span>
                        <Input 
                          type="number" 
                          min={1} 
                          className="w-20 h-8" 
                          value={target}
                          onChange={e => setGoals(g => ({ ...g, [k]: Number(e.target.value) }))} 
                        />
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground font-medium">
                        {cur.toFixed(k === "daily_hours" ? 1 : 0)} / {target}
                      </span>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progreso</span>
                      <span>{Math.round(pct)}%</span>
                    </div>
                    <Progress 
                      value={pct} 
                      className={`h-2 ${isCompleted ? 'bg-green-100' : ''}`}
                    />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EditProfileDialog({ open, onClose, profile, userId, onSaved }: {
  open: boolean;
  onClose: () => void;
  profile: { name: string; avatar_url: string | null };
  userId?: string;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(profile.name);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(profile.avatar_url);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setName(profile.name);
      setFile(null);
      setPreview(profile.avatar_url);
      setError(undefined);
    }
  }, [open, profile.name, profile.avatar_url]);

  const validateName = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "El nombre es obligatorio";
    if (trimmed.length > 100) return "El nombre no puede exceder 100 caracteres";
    return undefined;
  };

  const pickFile = (f: File | null) => {
    setFile(f);
    if (f) setPreview(URL.createObjectURL(f));
  };

  const submit = async () => {
    const err = validateName(name);
    setError(err);
    if (err || !userId) return;
    setLoading(true);
    try {
      let avatar_url = profile.avatar_url;
      if (file) {
        const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("avatars").upload(path, file);
        if (upErr) throw upErr;
        avatar_url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }
      const { error: updErr } = await supabase.from("profiles").update({ name: name.trim(), avatar_url }).eq("id", userId);
      if (updErr) throw updErr;
      await onSaved();
      toast.success("Perfil actualizado");
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const initials = (name || "?").split(" ").map(s => s[0]).join("").slice(0, 2).toUpperCase();

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Editar perfil</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex flex-col items-center gap-2">
            <label className="relative cursor-pointer">
              <Avatar className="h-20 w-20">
                <AvatarImage src={preview ?? undefined} alt={name} />
                <AvatarFallback className="text-xl font-medium">{initials}</AvatarFallback>
              </Avatar>
              <span className="absolute bottom-0 right-0 h-7 w-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center border-2 border-background">
                <Camera className="h-3.5 w-3.5" />
              </span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => pickFile(e.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nombre de usuario</Label>
            <Input
              id="edit-name"
              value={name}
              maxLength={100}
              onChange={e => { setName(e.target.value); if (error) setError(validateName(e.target.value)); }}
              onBlur={e => setError(validateName(e.target.value))}
              className={error ? "border-red-500" : ""}
            />
            {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={submit} disabled={loading}>{loading ? "Guardando…" : "Guardar cambios"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <Card className="p-5 border-[0.5px]">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-wider">{label}</div>
          <div className="text-2xl font-semibold mt-2">{value}</div>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
    </Card>
  );
}
