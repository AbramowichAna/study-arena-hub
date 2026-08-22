import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

type LoginSearch = { redirect?: string };

export const Route = createFileRoute("/login")({ 
  component: LoginPage,
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
});

function LoginPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { redirect } = useSearch({ from: "/login" });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{email?: string; password?: string}>({});

  useEffect(() => { 
    if (user) {
      // Redirect to intended destination or default to /home
      const destination = redirect ? decodeURIComponent(redirect) : "/home";
      navigate({ to: destination as any, replace: true });
    }
  }, [user, navigate, redirect]);

  const validateField = (field: string, value: string) => {
    const trimmedValue = value.trim();
    const newErrors = { ...errors };
    
    if (field === 'email') {
      if (!trimmedValue) {
        newErrors.email = "El email es obligatorio";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
        newErrors.email = "Por favor ingresa un email válido";
      } else {
        delete newErrors.email;
      }
    }
    
    if (field === 'password') {
      if (!trimmedValue) {
        newErrors.password = "La contraseña es obligatoria";
      } else {
        delete newErrors.password;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate all fields
    const emailValid = validateField('email', email);
    const passwordValid = validateField('password', password);
    
    if (!emailValid || !passwordValid) {
      return;
    }
    
    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    
    try {
      const { error } = await supabase.auth.signInWithPassword({ 
        email: normalizedEmail, 
        password 
      });
      
      if (error) {
        // Handle specific error cases
        if (error.message.includes('Invalid login credentials')) {
          toast.error("Email o contraseña incorrectos");
          setPassword(""); // Clear password on auth error
        } else if (error.message.includes('Email not confirmed')) {
          toast.error("Por favor confirma tu email antes de iniciar sesión");
        } else {
          toast.error(error.message);
          setPassword(""); // Clear password on any auth error
        }
        return;
      }
      
      toast.success("¡Bienvenido de vuelta!");
      // Redirect to intended destination or default to /home  
      const destination = redirect ? decodeURIComponent(redirect) : "/home";
      navigate({ to: destination as any, replace: true });
    } catch (error: any) {
      toast.error("Error de conexión. Por favor intenta nuevamente.");
      setPassword(""); // Clear password on network error
    } finally {
      setLoading(false);
    }
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
            <div className="text-xs text-muted-foreground">Inicia sesión en tu cuenta</div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)}
              onBlur={(e) => validateField('email', e.target.value)}
              className={errors.email ? "border-red-500" : ""}
            />
            {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input 
              id="password" 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              onBlur={(e) => validateField('password', e.target.value)}
              className={errors.password ? "border-red-500" : ""}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Iniciando sesión…" : "Iniciar sesión"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-center text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link to="/register" className="text-primary font-medium hover:underline">Crear una</Link>
        </p>
      </Card>
    </div>
  );
}
