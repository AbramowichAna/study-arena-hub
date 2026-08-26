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
  const [errors, setErrors] = useState<{name?: string; email?: string; password?: string}>({});

  const validateField = (field: string, value: string) => {
    const trimmedValue = value.trim();
    const newErrors = { ...errors };
    
    if (field === 'name') {
      if (!trimmedValue) {
        newErrors.name = "El nombre es obligatorio";
      } else if (trimmedValue.length > 100) {
        newErrors.name = "El nombre no puede exceder 100 caracteres";
      } else {
        delete newErrors.name;
      }
    }
    
    if (field === 'email') {
      if (!trimmedValue) {
        newErrors.email = "El email es obligatorio";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedValue)) {
        newErrors.email = "Por favor ingresa un email válido";
      } else if (trimmedValue.length > 255) {
        newErrors.email = "El email no puede exceder 255 caracteres";
      } else {
        delete newErrors.email;
      }
    }
    
    if (field === 'password') {
      if (!trimmedValue) {
        newErrors.password = "La contraseña es obligatoria";
      } else if (trimmedValue.length < 8) {
        newErrors.password = "La contraseña debe tener al menos 8 caracteres";
      } else if (trimmedValue.length > 128) {
        newErrors.password = "La contraseña no puede exceder 128 caracteres";
      } else if (/^[0-9]+$/.test(trimmedValue)) {
        newErrors.password = "La contraseña no puede ser solo números";
      } else if (trimmedValue.toLowerCase().includes('password') || 
                trimmedValue.toLowerCase().includes('contraseña') ||
                trimmedValue === '12345678' ||
                trimmedValue === 'qwertyui') {
        newErrors.password = "La contraseña es demasiado común. Usa una más segura";
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
    const nameValid = validateField('name', name);
    const emailValid = validateField('email', email);
    const passwordValid = validateField('password', password);
    
    if (!nameValid || !emailValid || !passwordValid) {
      return;
    }
    
    setLoading(true);
    
    try {
      // Normalize input data
      const normalizedName = name.trim();
      const normalizedEmail = email.trim().toLowerCase();
      
      const redirect = invite
        ? `${window.location.origin}/join/${invite}`
        : `${window.location.origin}/dashboard`;
        
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail, 
        password,
        options: {
          data: { name: normalizedName },
          emailRedirectTo: redirect,
        },
      });
      
      if (error) {
        // Handle specific error cases
        if (error.message.includes('User already registered')) {
          toast.error("Este email ya está registrado");
          setPassword(""); // Clear password but preserve email
        } else if (error.message.includes('Invalid email')) {
          toast.error("Por favor ingresa un email válido");
        } else {
          toast.error(error.message);
          setPassword(""); // Clear password on error for security
        }
        return;
      }

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
            <div className="text-xs text-muted-foreground">
              {invite ? "Regístrate para unirte al grupo" : "Crea tu cuenta"}
            </div>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre</Label>
            <Input 
              id="name" 
              required 
              maxLength={100}
              value={name} 
              onChange={(e) => setName(e.target.value)}
              onBlur={(e) => validateField('name', e.target.value)}
              className={errors.name ? "border-red-500" : ""}
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input 
              id="email" 
              type="email" 
              required 
              maxLength={255}
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
              minLength={8}
              maxLength={128}
              value={password} 
              onChange={(e) => setPassword(e.target.value)}
              onBlur={(e) => validateField('password', e.target.value)}
              className={errors.password ? "border-red-500" : ""}
            />
            {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password}</p>}
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
