import { Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles, Swords, Timer, Trophy, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const features = [
  {
    icon: Users,
    title: "Grupos de estudio",
    description:
      "Creá un grupo o unite con un link de invitación. Organizá a tus compañeros de carrera o materia en un solo lugar.",
  },
  {
    icon: Timer,
    title: "Sesiones Pomodoro en vivo",
    description:
      "Timer de foco y descanso sincronizado en tiempo real para todos los participantes de la sala, sin importar quién lo mire.",
  },
  {
    icon: Sparkles,
    title: "Materiales con IA",
    description:
      "Generá flashcards y quizzes a partir de tus apuntes con un clic, o subilos vos mismo para compartirlos con el grupo.",
  },
  {
    icon: Trophy,
    title: "Puntos y ranking",
    description:
      "Sumá puntos por completar sesiones y quizzes, y compará tu progreso con el ranking semanal de cada grupo.",
  },
];

export function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b sticky top-0 bg-background/95 backdrop-blur z-10">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Swords className="h-4 w-4" />
            </div>
            <span className="font-semibold">Study Arena</span>
          </div>
          <nav className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Iniciar sesión
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">Crear cuenta</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="max-w-6xl mx-auto px-6 pt-16 pb-20 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-md border-[0.5px] bg-accent px-3 py-1 text-xs font-medium text-accent-foreground mb-5">
              <Sparkles className="h-3.5 w-3.5" />
              Estudiá en equipo, no en soledad
            </div>
            <h1 className="text-4xl sm:text-5xl font-semibold tracking-tight leading-[1.1] mb-5">
              Estudiar es más fácil cuando lo hacés en grupo
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-lg">
              Study Arena junta a tu grupo de estudio en salas con timer Pomodoro sincronizado,
              materiales generados con IA y un sistema de puntos que premia la constancia.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/register">
                <Button size="lg" className="gap-2">
                  Crear cuenta gratis
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/login">
                <Button size="lg" variant="outline">
                  Ya tengo cuenta
                </Button>
              </Link>
            </div>
          </div>

          <Card className="p-5 border-[0.5px] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="text-xs font-medium uppercase text-muted-foreground tracking-wider">
                Sala en vivo
              </div>
              <div className="flex items-center gap-1.5 rounded-full bg-success/10 text-success text-xs font-medium px-2.5 py-1">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                En curso
              </div>
            </div>

            <Card className="p-4 border-[0.5px] mb-3">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <div className="font-medium">Parcial de Álgebra</div>
                  <div className="text-xs text-muted-foreground">Grupo Ingeniería 2026</div>
                </div>
                <div className="bg-orange-100 text-orange-800 text-xs px-2 py-1 rounded-full font-medium tabular-nums">
                  Foco 24:58
                </div>
              </div>
              <div className="flex items-center justify-between mt-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> 4 estudiando
                </div>
                <Button size="sm" variant="outline" disabled>
                  Unirse
                </Button>
              </div>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3 border-[0.5px]">
                <div className="text-xs text-muted-foreground mb-1">Racha del grupo</div>
                <div className="text-xl font-semibold">6 sesiones</div>
              </Card>
              <Card className="p-3 border-[0.5px]">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Trophy className="h-3.5 w-3.5 text-warning" /> Tu puntaje
                </div>
                <div className="text-xl font-semibold">1,240 pts</div>
              </Card>
            </div>
          </Card>
        </section>

        <section className="border-t bg-muted/20">
          <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="max-w-xl mb-10">
              <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
                Todo lo que necesita tu grupo para estudiar mejor
              </h2>
              <p className="text-muted-foreground">
                De la sala de estudio al material de repaso, todo en un solo lugar y con puntos que
                reconocen el esfuerzo.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {features.map((f) => (
                <Card key={f.title} className="p-5 border-[0.5px]">
                  <div className="h-10 w-10 rounded-md bg-primary/10 text-primary flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5" />
                  </div>
                  <div className="font-medium mb-1.5">{f.title}</div>
                  <div className="text-sm text-muted-foreground leading-relaxed">
                    {f.description}
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>

        <section className="max-w-6xl mx-auto px-6 py-16">
          <Card className="border-[0.5px] bg-primary text-primary-foreground p-10 sm:p-14 text-center">
            <h2 className="text-2xl sm:text-3xl font-semibold tracking-tight mb-3">
              ¿Listo para subir de nivel tus sesiones de estudio?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-lg mx-auto">
              Creá tu cuenta, armá un grupo con tus compañeros y arrancá tu primera sesión en menos
              de 3 minutos.
            </p>
            <Link to="/register">
              <Button size="lg" variant="secondary" className="gap-2">
                Crear cuenta gratis
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </Card>
        </section>
      </main>

      <footer className="border-t">
        <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-6 w-6 rounded-md bg-primary text-primary-foreground flex items-center justify-center">
              <Swords className="h-3.5 w-3.5" />
            </div>
            Study Arena
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link to="/login" className="hover:text-foreground">
              Iniciar sesión
            </Link>
            <Link to="/register" className="hover:text-foreground">
              Crear cuenta
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
