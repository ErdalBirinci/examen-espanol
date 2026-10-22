import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Check, Headphones, ListChecks, Mic, PenLine, ShieldCheck } from "lucide-react";
import { Button, Field, Notice } from "../components/ui";
import { LEVELS, LEVEL_INFO, type Candidate, type Level } from "../lib/types";
import { cn } from "../lib/utils";

const FEATURES = [
  {
    icon: ListChecks,
    title: "Vocabulario y Gramática",
    text: "50 preguntas de gramática, vocabulario y uso.",
  },
  {
    icon: Headphones,
    title: "Comprensión Auditiva",
    text: "Escucha grabaciones y transcribe lo que oyes.",
  },
  {
    icon: PenLine,
    title: "Expresión Escrita",
    text: "Una composición sobre un tema propuesto.",
  },
  {
    icon: Mic,
    title: "Expresión oral",
    text: "Graba tu respuesta sobre un tema abierto.",
  },
];

const STORAGE_KEY = "examen-espanol:candidate";

export default function Welcome() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"details" | "level">("details");
  const [candidate, setCandidate] = useState<Candidate>({ firstName: "", lastName: "", email: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof Candidate, string>>>({});
  const [level, setLevel] = useState<Level | null>(null);

  function validate(): boolean {
    const next: Partial<Record<keyof Candidate, string>> = {};
    if (candidate.firstName.trim().length < 2) next.firstName = "Escribe tu nombre.";
    if (candidate.lastName.trim().length < 2) next.lastName = "Escribe tus apellidos.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(candidate.email.trim()))
      next.email = "Introduce un correo electrónico válido.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function startExam() {
    if (!level) return;
    const clean: Candidate = {
      firstName: candidate.firstName.trim(),
      lastName: candidate.lastName.trim(),
      email: candidate.email.trim().toLowerCase(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(clean));
    navigate(`/examen/${level}`);
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_70%_at_50%_-15%,#e9f2ff_0%,#f7f9fd_38%,#fbfbfd_70%)]">
      <header className="sticky top-0 z-30 border-b border-[rgba(29,29,31,0.06)] glass-bar">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <div className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Examen</span>
            <span className="font-display text-[19px] italic text-accent-ink">de Español</span>
          </div>
          <span className="hidden items-center gap-1.5 text-[12px] text-muted sm:flex">
            <ShieldCheck className="size-3.5" />
            Evaluación oficial interna · 2026
          </span>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-12 px-5 pt-14 pb-20 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pt-24">
        <section className="anim-rise">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#dbe7f8] bg-white/70 px-3 py-1 text-[11.5px] font-medium tracking-[0.02em] text-accent-ink">
            <span className="size-1.5 rounded-full bg-accent" />
            PRUEBA DE NIVEL · A1 — C2
          </span>

          <h1 className="mt-6 text-[42px] leading-[1.04] font-semibold tracking-[-0.035em] sm:text-[58px]">
            Tu español,
            <br />
            en cuatro <span className="font-display italic font-normal text-accent-ink">pruebas</span>.
          </h1>

          <p className="mt-6 max-w-lg text-[16px] leading-relaxed text-muted">
            Elige tu nivel y completa las cuatro secciones del examen: vocabulario y gramática,
            comprensión auditiva, expresión escrita y expresión oral. Tómate tu tiempo, no hay prisa.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-2">
            {FEATURES.map(({ icon: Icon, title, text }, index) => (
              <div
                key={title}
                className="lift rounded-2xl border border-line bg-white/80 p-4 backdrop-blur-sm"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <Icon className="size-4.5 text-accent" strokeWidth={1.8} />
                <p className="mt-2.5 text-[13.5px] font-semibold">{title}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-muted">{text}</p>
              </div>
            ))}
          </div>

          <p className="mt-8 flex items-center gap-2 text-[12px] text-faint">
            <Check className="size-3.5" />
            Duración estimada: 60—90 minutos · Progreso guardado en este dispositivo
          </p>
        </section>

        <section className="anim-rise" style={{ animationDelay: "120ms" }}>
          <div className="card p-6 sm:p-8">
            <div className="flex items-center gap-2 text-[11.5px] font-medium tracking-[0.02em] text-muted">
              <StepDot active={step === "details"} done={step === "level"} index={1} label="Datos" />
              <span className="h-px flex-1 bg-line" />
              <StepDot active={step === "level"} done={false} index={2} label="Nivel" />
            </div>

            {step === "details" ? (
              <div className="anim-fade mt-7">
                <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Crea tu acceso</h2>
                <p className="mt-1.5 text-[13.5px] text-muted">
                  Usaremos estos datos para identificar tu examen.
                </p>

                <form
                  className="mt-6 space-y-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (validate()) setStep("level");
                  }}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Nombre" htmlFor="firstName" error={errors.firstName}>
                      <input
                        id="firstName"
                        className="field"
                        autoComplete="given-name"
                        placeholder="Lucía"
                        value={candidate.firstName}
                        onChange={(e) => setCandidate({ ...candidate, firstName: e.target.value })}
                      />
                    </Field>
                    <Field label="Apellidos" htmlFor="lastName" error={errors.lastName}>
                      <input
                        id="lastName"
                        className="field"
                        autoComplete="family-name"
                        placeholder="García Ruiz"
                        value={candidate.lastName}
                        onChange={(e) => setCandidate({ ...candidate, lastName: e.target.value })}
                      />
                    </Field>
                  </div>

                  <Field label="Correo electrónico" htmlFor="email" error={errors.email}>
                    <input
                      id="email"
                      type="email"
                      className="field"
                      autoComplete="email"
                      placeholder="lucia@correo.com"
                      value={candidate.email}
                      onChange={(e) => setCandidate({ ...candidate, email: e.target.value })}
                    />
                  </Field>

                  <Button type="submit" size="lg" className="mt-2 w-full" icon={<ArrowRight className="size-4" />}>
                    Continuar
                  </Button>
                </form>

                <p className="mt-4 text-center text-[11.5px] leading-relaxed text-faint">
                  Al continuar aceptas que tus respuestas se guarden para su evaluación.
                </p>
              </div>
            ) : (
              <div className="anim-fade mt-7">
                <h2 className="text-[24px] font-semibold tracking-[-0.02em]">Elige tu nivel</h2>
                <p className="mt-1.5 text-[13.5px] text-muted">
                  Sé sincero contigo mismo: el examen se adapta al nivel que elijas.
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2.5">
                  {LEVELS.map((code) => {
                    const info = LEVEL_INFO[code];
                    const active = level === code;
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setLevel(code)}
                        aria-pressed={active}
                        className={cn(
                          "focus-ring relative rounded-2xl border bg-gradient-to-br p-3.5 text-left transition-all duration-200",
                          info.tint,
                          active
                            ? "border-accent/70 shadow-[0_10px_30px_-18px_rgba(0,113,227,0.9)]"
                            : "border-line hover:border-[#cfcfd6]",
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[15px] font-semibold tracking-[-0.01em]">{code}</span>
                          {active && (
                            <span className="flex size-4.5 items-center justify-center rounded-full bg-accent text-white">
                              <Check className="size-3" strokeWidth={3} />
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] font-medium text-ink/70">{info.name}</p>
                        <p className="mt-1 text-[11.5px] leading-snug text-muted">{info.blurb}</p>
                      </button>
                    );
                  })}
                </div>

                {!level && (
                  <div className="mt-4">
                    <Notice>Selecciona un nivel para comenzar.</Notice>
                  </div>
                )}

                <Button
                  size="lg"
                  className="mt-5 w-full"
                  disabled={!level}
                  onClick={startExam}
                  icon={<ArrowRight className="size-4" />}
                >
                  Comenzar el examen
                </Button>

                <button
                  type="button"
                  onClick={() => setStep("details")}
                  className="mt-3 w-full text-center text-[12.5px] text-muted transition hover:text-ink"
                >
                  Volver a mis datos
                </button>
              </div>
            )}
          </div>

          <p className="mt-5 text-center text-[11.5px] text-faint">
            Tus respuestas se envían al finalizar. No compartas tu enlace de examen.
          </p>
        </section>
      </main>
    </div>
  );
}

function StepDot({
  index,
  label,
  active,
  done,
}: {
  index: number;
  label: string;
  active: boolean;
  done: boolean;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded-full text-[10.5px] font-semibold transition",
          done
            ? "bg-success text-white"
            : active
              ? "bg-ink text-white"
              : "bg-[#f0f0f3] text-faint",
        )}
      >
        {done ? <Check className="size-3" strokeWidth={3} /> : index}
      </span>
      <span className={cn("text-[11.5px]", active || done ? "text-ink" : "text-faint")}>{label}</span>
    </span>
  );
}
