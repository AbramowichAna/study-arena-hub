import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Timer, BookOpen, User, Swords, Trophy, LogOut, Bell, Check, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";

type Group = { id: string; name: string };
type Invitation = { id: string; group_id: string; groups: { name: string } | null };

const navItems = [
  { to: "/dashboard", label: "Tablero", icon: Home },
  { to: "/materials", label: "Materiales", icon: BookOpen },
  { to: "/profile", label: "Perfil", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);

  const loadGroups = () => {
    if (!profile?.id) return;
    supabase
      .from("group_members")
      .select("groups(id,name)")
      .eq("user_id", profile.id)
      .then(({ data }) => {
        const list = (data ?? []).map((r: any) => r.groups).filter(Boolean) as Group[];
        setGroups(list);
      });
  };
  useEffect(() => { loadGroups(); }, [profile?.id]);

  const loadInvitations = () => {
    if (!profile?.email) return;
    supabase
      .from("group_invitations")
      .select("id,group_id,groups(name)")
      .eq("invited_email", profile.email)
      .eq("status", "pending")
      .then(({ data }) => setInvitations((data as any) ?? []));
  };
  useEffect(() => { loadInvitations(); }, [profile?.email]);

  const respond = async (inv: Invitation, status: "accepted" | "declined") => {
    if (!profile?.id) return;
    if (status === "accepted") {
      const { error: joinErr } = await supabase.from("group_members").insert({ group_id: inv.group_id, user_id: profile.id });
      if (joinErr && joinErr.code !== "23505") return toast.error(joinErr.message);
    }
    const { data, error } = await supabase.from("group_invitations").update({ status }).eq("id", inv.id).select();
    if (error) return toast.error(error.message);
    if (!data || data.length === 0) return toast.error("No se pudo actualizar la invitación. Probá de nuevo.");
    toast.success(status === "accepted" ? `Te uniste a ${inv.groups?.name}` : "Invitación rechazada");
    loadInvitations();
    if (status === "accepted") loadGroups();
  };

  const initials = (profile?.name ?? "?")
    .split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();

  const dots = ["bg-primary", "bg-success", "bg-warning", "bg-destructive"];

  return (
    <div className="min-h-screen flex bg-muted/20">
      <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="px-5 py-5 flex items-center gap-2 border-b border-sidebar-border">
          <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Swords className="h-5 w-5" />
          </div>
          <div className="font-semibold">Study Arena</div>
        </div>
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const active = pathname === item.to || pathname.startsWith(item.to + "/");
            return (
              <Link key={item.to} to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}>
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="px-5 mt-4">
          <div className="text-xs font-medium uppercase text-muted-foreground tracking-wider mb-2">
            Mis Grupos
          </div>
          <div className="space-y-1">
            {groups.length === 0 && (
              <Link to="/groups" className="text-xs text-muted-foreground hover:text-primary">
                + Crear un grupo
              </Link>
            )}
            {groups.map((g, i) => (
              <Link key={g.id} to="/groups/$groupId" params={{ groupId: g.id }}
                className="flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-sidebar-accent">
                <span className={cn("h-2 w-2 rounded-full", dots[i % dots.length])} />
                <span className="truncate">{g.name}</span>
              </Link>
            ))}
            {groups.length > 0 && (
              <Link to="/groups" className="text-xs text-muted-foreground hover:text-primary px-2 pt-1 block">
                Administrar grupos →
              </Link>
            )}
          </div>
        </div>

        <div className="mt-auto p-3 border-t border-sidebar-border">
          <button onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-background flex items-center justify-end px-6 gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-warning/10 text-warning font-medium text-sm">
            <Trophy className="h-4 w-4" />
            {profile?.total_points ?? 0} pts
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <button className="relative h-9 w-9 rounded-full flex items-center justify-center hover:bg-muted transition-colors" aria-label="Invitaciones">
                <Bell className="h-4 w-4" />
                {invitations.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-medium">
                    {invitations.length}
                  </span>
                )}
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-80">
              <div className="text-sm font-medium mb-3">Invitaciones</div>
              {invitations.length === 0 ? (
                <div className="text-xs text-muted-foreground">No tenés invitaciones pendientes.</div>
              ) : (
                <div className="space-y-3">
                  {invitations.map(inv => (
                    <div key={inv.id} className="space-y-2 pb-3 border-b last:border-0 last:pb-0">
                      <div className="text-sm">Te invitaron a <span className="font-medium">{inv.groups?.name}</span></div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => respond(inv, "accepted")}>
                          <Check className="h-3.5 w-3.5 mr-1" /> Aceptar
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => respond(inv, "declined")}>
                          <X className="h-3.5 w-3.5 mr-1" /> Rechazar
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>
          <Link to="/profile" className="h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
            {initials}
          </Link>
        </header>
        <main className="flex-1 p-6 overflow-auto">{children}</main>
      </div>
    </div>
  );
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  const initials = name.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full bg-primary/15 text-primary flex items-center justify-center font-medium text-xs flex-shrink-0"
      style={{ width: size, height: size }}>
      {initials}
    </div>
  );
}
