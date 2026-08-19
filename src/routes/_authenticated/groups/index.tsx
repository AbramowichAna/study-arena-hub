import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Plus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/groups/")({
  component: GroupsPage,
});

type Group = { id: string; name: string; admin_id: string; members: number };

function GroupsPage() {
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const load = async () => {
    const { data } = await supabase
      .from("group_members")
      .select("groups(id,name,admin_id,group_members(count))");
    const list = ((data ?? []) as any[]).map(r => ({
      id: r.groups.id,
      name: r.groups.name,
      admin_id: r.groups.admin_id,
      members: r.groups.group_members?.[0]?.count ?? 0,
    }));
    setGroups(list);
  };
  useEffect(() => { load(); }, [user?.id]);

  const create = async () => {
    if (!name || !user) return;
    const { error } = await supabase.from("groups").insert({ name, admin_id: user.id });
    if (error) return toast.error(error.message);
    toast.success("Grupo creado");
    setOpen(false); setName(""); load();
  };

  const join = async () => {
    if (!joinCode || !user) return;
    const { data: g, error } = await supabase.from("groups").select("id").eq("invite_code", joinCode.trim()).maybeSingle();
    if (error || !g) return toast.error("Código de invitación inválido");
    const { error: e2 } = await supabase.from("group_members").insert({ group_id: g.id, user_id: user.id });
    if (e2) return toast.error(e2.message);
    toast.success("Te has unido al grupo");
    setJoinCode(""); load();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Grupos</h1>
          <p className="text-sm text-muted-foreground mt-1">Estudia con tus compañeros</p>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-2">
            <Input placeholder="Código de invitación" value={joinCode} onChange={e => setJoinCode(e.target.value)} className="w-40" />
            <Button variant="outline" onClick={join}>Unirse</Button>
          </div>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Crear</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Crear grupo</DialogTitle></DialogHeader>
              <div className="space-y-2 py-2"><Label>Nombre</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
              <DialogFooter><Button onClick={create}>Crear</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {groups.length === 0 ? (
        <Card className="p-12 text-center border-[0.5px]">
          <Users className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <h3 className="font-medium mb-1">Aún no hay grupos</h3>
          <p className="text-sm text-muted-foreground mb-4">Crea uno o únete con un código de invitación.</p>
          <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 mr-1" /> Crear grupo</Button>
        </Card>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          {groups.map(g => (
            <Card key={g.id} className="p-5 border-[0.5px]">
              <div className="font-medium">{g.name}</div>
              <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <Users className="h-3 w-3" /> {g.members} miembro{g.members === 1 ? "" : "s"}
              </div>
              <Link to="/groups/$groupId" params={{ groupId: g.id }}>
                <Button variant="outline" size="sm" className="mt-4 w-full">Administrar</Button>
              </Link>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
