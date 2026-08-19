import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type RegisterSearch = { invite?: string };

export const Route = createFileRoute("/register")({
  component: RegisterPage,
  validateSearch: (s: Record<string, unknown>): RegisterSearch => ({
    invite: typeof s.invite === "string" ? s.invite : undefined,
  }),
});

function RegisterPage() {
  const navigate = useNavigate();
  const { invite } = useSearch({ from: "/register" });
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const redirect = invite
      ? `${window.location.origin}/join/${invite}`
      : `${window.location.origin}/dashboard`;
    const { data, error } = await supabase.auth.signUp({
      email, password,
      options: {
        data: { name },
        emailRedirectTo: redirect,
      },
    });
    setLoading(false);
    if (error) return toast.error(error.message);

    // If session is immediately available (auto-confirm) and invite present, join now
    if (data.session && invite) {
      navigate({ to: "/join/$inviteCode", params: { inviteCode: invite } });
      return;
    }
    if (data.session) {
      navigate({ to: "/dashboard" });
      return;
    }
    toast.success("¡Cuenta creada! Revisa tu email para verificar, luego inicia sesión.");
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md p-8 border-[0.5px]">
        <div className="flex items-center gap-2 mb-6">
          <div className="h-10 w-10 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
            <Swords className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold text-lg">Study Arena</div>
            <div className="text-xs text-muted-foreground">
              {invite ? "Regístrate para unirte al grupo" : "Crea tu cuenta"}
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creando…" : "Crear cuenta"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-center text-muted-foreground">
          ¿Ya tienes una cuenta?{" "}
          <Link to="/login" className="text-primary font-medium hover:underline">Iniciar sesión</Link>
        </p>
      </Card>
    </div>
  );
}
