import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Trophy, Clock, Users, Pencil, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar } from "@/components/AppShell";
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
  const { profile, user } = useAuth();
  const [goals, setGoals] = useState<Record<string, number>>({ daily_hours: 2, weekly_sessions: 10 });
  const [progress, setProgress] = useState<Record<string, number>>({ daily_hours: 0, weekly_sessions: 0 });
  const [editing, setEditing] = useState(false);

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

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="p-6 border-[0.5px]">
        <div className="flex items-center gap-5">
          <Avatar name={profile.name} size={72} />
          <div className="flex-1">
            <h1 className="text-2xl font-semibold">{profile.name}</h1>
            <div className="text-sm text-muted-foreground">{profile.email}</div>
          </div>
          <div className="flex gap-2">
            <div className="px-3 py-2 rounded-md bg-warning/10 text-warning text-sm font-medium flex items-center gap-2">
              <Trophy className="h-4 w-4" /> {profile.total_points} pts
            </div>
          </div>
        </div>
      </Card>

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
