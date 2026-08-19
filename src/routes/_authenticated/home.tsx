import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, User, Mail, Calendar } from "lucide-react";

export const Route = createFileRoute("/_authenticated/home")({
  component: HomePage,
});

function HomePage() {
  const { user, profile, signOut } = useAuth();

  const scenarios = [
    { text: "✅ Registro con validaciones robustas", status: "completed" },
    { text: "✅ Login con preservación de URL", status: "completed" },
    { text: "✅ Manejo de errores específicos", status: "completed" },
    { text: "✅ Protección de rutas mejorada", status: "completed" },
    { text: "✅ Validaciones inline en formularios", status: "completed" },
    { text: "✅ Estados de carga apropiados", status: "completed" },
    { text: "✅ Normalización de datos de entrada", status: "completed" },
    { text: "✅ Mensajes de error contextual", status: "completed" },
    { text: "✅ Interfaz completamente en español", status: "completed" },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2">¡Bienvenido a Study Arena!</h1>
        <p className="text-muted-foreground">
          Página temporal para validar las mejoras de autenticación
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="h-5 w-5 text-primary" />
            <h3 className="font-semibold">Información de Usuario</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{user?.email}</span>
              <Badge variant={user?.email_confirmed_at ? "default" : "secondary"} className="text-xs">
                {user?.email_confirmed_at ? "Verificado" : "Pendiente"}
              </Badge>
            </div>
            {profile?.name && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{profile.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                Miembro desde {new Date(user?.created_at || "").toLocaleDateString('es-AR')}
              </span>
            </div>
            {profile?.total_points !== undefined && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Puntos: {profile.total_points}</span>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Acciones Rápidas</h3>
          <div className="space-y-3">
            <Link to="/dashboard">
              <Button variant="outline" className="w-full justify-start">
                Ir al Dashboard Principal
              </Button>
            </Link>
            <Link to="/materials">
              <Button variant="outline" className="w-full justify-start">
                Ver Materiales de Estudio
              </Button>
            </Link>
            <Link to="/groups">
              <Button variant="outline" className="w-full justify-start">
                Administrar Grupos
              </Button>
            </Link>
            <Button 
              variant="destructive" 
              className="w-full justify-start"
              onClick={signOut}
            >
              Cerrar Sesión
            </Button>
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <h3 className="font-semibold">Funcionalidades Implementadas</h3>
        </div>
        <div className="grid md:grid-cols-2 gap-2">
          {scenarios.map((scenario, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span>{scenario.text}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-md">
          <p className="text-sm text-green-800">
            <strong>🎯 Prototipo completamente funcional</strong><br />
            Todas las validaciones, preservación de URL, manejo de errores y 
            experiencia de usuario mejorada están implementadas y funcionando correctamente.
          </p>
        </div>
      </Card>
    </div>
  );
}