import { Link, useRouterState } from "@tanstack/react-router";
import { Home, Timer, BookOpen, User, Swords, Trophy, LogOut } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

type Group = { id: string; name: string };

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: Home },
  { to: "/materials", label: "Materials", icon: BookOpen },
  { to: "/profile", label: "Profile", icon: User },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [groups, setGroups] = useState<Group[]>([]);

  useEffect(() => {
    supabase
      .from("group_members")
      .select("groups(id,name)")
      .then(({ data }) => {
        const list = (data ?? []).map((r: any) => r.groups).filter(Boolean) as Group[];
        setGroups(list);
      });
  }, [profile?.id]);

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
            My Groups
          </div>
          <div className="space-y-1">
            {groups.length === 0 && (
              <Link to="/groups" className="text-xs text-muted-foreground hover:text-primary">
                + Create a group
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
                Manage groups →
              </Link>
            )}
          </div>
        </div>

        <div className="mt-auto p-3 border-t border-sidebar-border">
          <button onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-sm text-muted-foreground hover:bg-sidebar-accent">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b bg-background flex items-center justify-end px-6 gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-warning/10 text-warning font-medium text-sm">
            <Trophy className="h-4 w-4" />
            {profile?.total_points ?? 0} pts
          </div>
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
