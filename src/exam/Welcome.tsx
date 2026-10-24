import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Headphones,
  ListChecks,
  LogOut,
  Mic,
  PenLine,
  Search,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Button, Field, Notice } from "../components/ui";
import { SiteFooter, SiteHeader } from "../components/SiteHeader";
import HeroStage from "../components/HeroStage";
import { TiltCard } from "../components/TiltCard";
import {
  getCandidateAccount,
  registerCandidate,
  signInCandidate,
  signOutCandidate,
  type CandidateAccount,
} from "../lib/api";
import { errorMessage } from "../lib/utils";

const SECTIONS = [
  {
    icon: ListChecks,
    title: "Vocabulario y Gramática",
    text: "50 preguntas de gramática, vocabulario y uso.",
    short: "50 preguntas",
  },
  {
    icon: Headphones,
    title: "Comprensión Auditiva",
    text: "Escucha grabaciones y transcribe lo que oyes.",
    short: "Audición guiada",
  },
  {
    icon: PenLine,
    title: "Expresión Escrita",
    text: "Una composición sobre un tema propuesto.",
    short: "Composición",
  },
  {
    icon: Mic,
    title: "Expresión oral",
    text: "Graba tu respuesta sobre un tema abierto.",
    short: "Grabación",
  },
];

export default function Welcome() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [account, setAccount] = useState<CandidateAccount | null>(null);
  const [checking, setChecking] = useState(true);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getCandidateAccount()
      .then((value) => {
        if (active) setAccount(value);
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signInCandidate(email, password);
      navigate("/cuenta");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleRegister(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (fullName.trim().length < 3) {
      setError("Escribe tu nombre y apellidos.");
      return;
    }
    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setBusy(true);
    try {
      const result = await registerCandidate({ fullName, email, password });
      if (result.needsConfirmation) {
        setMessage(
          "Cuenta creada. Revisa tu correo y confirma la dirección antes de iniciar sesión.",
        );
        setMode("login");
      } else {
        navigate("/cuenta");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app-page">
      <SiteHeader
        width="6xl"
        right={
          <>
            <span className="mr-1 hidden items-center gap-1.5 text-[11px] font-medium tracking-[0.04em] text-faint lg:flex">
              <ShieldCheck className="size-3.5 text-gold" />
              Centro de evaluación oficial
            </span>
            <Link
              to="/resultado"
              className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-medium text-muted transition hover:bg-white/70 hover:text-ink"
            >
              <Search className="size-3.5" />
              <span className="hidden sm:inline">Resultados</span>
            </Link>
            <a
              href="#acceso"
              className="focus-ring inline-flex h-9 items-center gap-1.5 rounded-full bg-ink px-3.5 text-[12px] font-medium text-white transition hover:bg-[#0b1120]"
            >
              Acceder
              <ArrowRight className="size-3.5" />
            </a>
          </>
        }
      />

      <main className="mx-auto max-w-6xl px-5 pt-10 sm:px-8 sm:pt-14 lg:pt-20">
        <div className="grid items-start gap-12 lg:grid-cols-[1.06fr_0.94fr] lg:gap-16">
          <section className="anim-rise pt-2 lg:pt-6">
            <span className="premium-kicker">
              <Sparkles className="size-3 text-gold" />
              Evaluación de lengua · A1 — C2
            </span>

            <h1 className="mt-6 text-[clamp(2.9rem,6.4vw,4.9rem)] leading-[0.98] font-semibold tracking-[-0.055em] text-balance">
              Tu español,
              <br />
              <span className="font-display text-[1.02em] font-normal italic text-gradient-blue">
                en cuatro pruebas.
              </span>
            </h1>

            <p className="mt-6 max-w-[32rem] text-[15.5px] leading-[1.7] text-muted">
              Un examen sereno y completo para medir tu nivel real: gramática, escucha, escritura y
              expresión oral. Inicia sesión para ver las pruebas que tu centro te ha asignado.
            </p>

            <div className="mt-8 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:items-center">
              <a href="#acceso" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto" icon={<ArrowRight className="size-4" />}>
                  Acceder a mi examen
                </Button>
              </a>
              <Link to="/resultado" className="w-full sm:w-auto">
                <Button
                  variant="secondary"
                  size="lg"
                  className="w-full sm:w-auto"
                  icon={<Search className="size-4" />}
                >
                  Consultar resultado
                </Button>
              </Link>
            </div>

            <div className="mt-10 grid grid-cols-3 gap-2.5 sm:gap-3">
              {[
                { value: "04", label: "Destrezas", full: "Destrezas evaluadas" },
                { value: "100", label: "Puntos", full: "Puntos en total" },
                { value: "A1—C2", label: "Niveles", full: "Niveles del marco" },
              ].map((item) => (
                <div key={item.label} className="stat-glass px-3.5 py-3.5 sm:px-4">
                  <p className="font-display text-[26px] leading-none font-normal text-ink italic sm:text-[30px]">
                    {item.value}
                  </p>
                  <p className="mt-1.5 text-[9.5px] leading-tight font-semibold tracking-[0.07em] text-faint uppercase sm:text-[10px]">
                    <span className="sm:hidden">{item.label}</span>
                    <span className="hidden sm:inline">{item.full}</span>
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11.5px] text-faint">
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-success" /> Progreso guardado
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-success" /> Sin límite de tiempo
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check className="size-3.5 text-success" /> Constancia de participación
              </span>
            </p>
          </section>

          <section
            id="acceso"
            className="anim-rise scroll-mt-28 lg:sticky lg:top-24"
            style={{ animationDelay: "110ms" }}
          >
            <TiltCard className="premium-panel overflow-hidden rounded-[2rem]" intensity={2.4}>
              <div className="hero-stage" aria-hidden="true">
                <HeroStage />
                <div className="medallion-letter">
                  <span className="font-display text-[62px] leading-none font-normal italic">E</span>
                  <span className="mt-1 text-[7.5px] font-semibold tracking-[0.32em] text-[#6c7d98] uppercase">
                    Español
                  </span>
                </div>
                <span className="float-chip absolute top-4 left-4 z-[3] rounded-full border border-white/80 bg-white/65 px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.12em] text-[#5c6c85] uppercase shadow-[0_8px_20px_-14px_rgba(30,50,85,0.5)] backdrop-blur-md">
                  Nivel A1 — C2
                </span>
                <span className="float-chip absolute right-4 bottom-4 z-[3] rounded-full border border-white/80 bg-white/65 px-2.5 py-1 text-[9.5px] font-semibold tracking-[0.1em] text-[#5c6c85] uppercase shadow-[0_8px_20px_-14px_rgba(30,50,85,0.5)] backdrop-blur-md [animation-delay:-3s]">
                  4 destrezas · 100 puntos
                </span>
              </div>

              <div className="relative bg-[linear-gradient(180deg,rgba(252,253,255,0.94)_0%,rgba(248,251,255,0.88)_100%)] p-6 backdrop-blur-2xl sm:p-7">
                {checking ? (
                  <p className="py-12 text-center text-[13px] text-muted">Comprobando sesión…</p>
                ) : account ? (
                  <div className="text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-full border border-white bg-[#eef8f1] text-success shadow-[0_10px_24px_-16px_rgba(22,132,90,0.6)]">
                      <Check className="size-5" strokeWidth={2.4} />
                    </div>
                    <p className="mt-4 text-[10.5px] font-semibold tracking-[0.16em] text-faint uppercase">
                      Sesión iniciada
                    </p>
                    <h2 className="mt-2 text-[23px] font-semibold tracking-[-0.03em]">
                      Hola, {account.fullName.split(" ")[0]}
                    </h2>
                    <p className="mt-1 truncate text-[12.5px] text-muted">{account.email}</p>
                    <Button className="mt-6 w-full" size="lg" onClick={() => navigate("/cuenta")}>
                      Ver mis exámenes
                    </Button>
                    <button
                      type="button"
                      onClick={async () => {
                        await signOutCandidate();
                        setAccount(null);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] text-muted transition hover:text-ink"
                    >
                      <LogOut className="size-3.5" />
                      Cerrar sesión
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">
                          Área de candidatos
                        </p>
                        <h2 className="mt-1.5 text-[21px] leading-tight font-semibold tracking-[-0.03em]">
                          {mode === "login" ? "Entra en tu examen" : "Crea tu acceso"}
                        </h2>
                      </div>
                      <span className="mb-1 hidden rounded-full border border-white/85 bg-white/60 px-2 py-1 text-[9.5px] font-semibold tracking-[0.1em] text-faint uppercase sm:block">
                        2026
                      </span>
                    </div>

                    <div className="premium-segmented mt-4">
                      {(
                        [
                          { key: "login", label: "Iniciar sesión" },
                          { key: "register", label: "Crear cuenta" },
                        ] as const
                      ).map(({ key, label }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => {
                            setMode(key);
                            setError(null);
                            setMessage(null);
                          }}
                          data-active={mode === key}
                        >
                          {label}
                        </button>
                      ))}
                    </div>

                    {error && (
                      <div className="mt-4">
                        <Notice tone="danger">{error}</Notice>
                      </div>
                    )}
                    {message && (
                      <div className="mt-4">
                        <Notice tone="success">{message}</Notice>
                      </div>
                    )}

                    {mode === "login" ? (
                      <form className="mt-4 space-y-3.5" onSubmit={(event) => void handleLogin(event)}>
                        <Field label="Correo electrónico" htmlFor="login-email">
                          <input
                            id="login-email"
                            type="email"
                            className="field"
                            autoComplete="email"
                            placeholder="lucia@correo.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                          />
                        </Field>
                        <Field label="Contraseña" htmlFor="login-password">
                          <input
                            id="login-password"
                            type="password"
                            className="field"
                            autoComplete="current-password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(event) => setPassword(event.target.value)}
                            required
                          />
                        </Field>
                        <div className="-mt-1 flex justify-end">
                          <Link
                            to="/cuenta/recuperar"
                            className="text-[12px] font-medium text-accent-ink underline-offset-2 hover:underline"
                          >
                            ¿Olvidaste tu contraseña?
                          </Link>
                        </div>
                        <Button type="submit" size="lg" className="w-full" loading={busy}>
                          Entrar
                        </Button>
                      </form>
                    ) : (
                      <form
                        className="mt-4 space-y-3.5"
                        onSubmit={(event) => void handleRegister(event)}
                      >
                        <Field
                          label="Nombre y apellidos"
                          htmlFor="register-name"
                          hint="Aparecerá así en tu informe y en tu constancia."
                        >
                          <input
                            id="register-name"
                            className="field"
                            autoComplete="name"
                            placeholder="Lucía García Ruiz"
                            value={fullName}
                            onChange={(event) => setFullName(event.target.value)}
                            required
                          />
                        </Field>
                        <Field label="Correo electrónico" htmlFor="register-email">
                          <input
                            id="register-email"
                            type="email"
                            className="field"
                            autoComplete="email"
                            placeholder="lucia@correo.com"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            required
                          />
                        </Field>
                        <div className="grid gap-3.5 sm:grid-cols-2">
                          <Field label="Contraseña" htmlFor="register-password" hint="Mínimo 8 caracteres.">
                            <input
                              id="register-password"
                              type="password"
                              className="field"
                              autoComplete="new-password"
                              value={password}
                              onChange={(event) => setPassword(event.target.value)}
                              required
                            />
                          </Field>
                          <Field label="Repetir contraseña" htmlFor="register-confirm">
                            <input
                              id="register-confirm"
                              type="password"
                              className="field"
                              autoComplete="new-password"
                              value={confirm}
                              onChange={(event) => setConfirm(event.target.value)}
                              required
                            />
                          </Field>
                        </div>
                        <Button
                          type="submit"
                          size="lg"
                          className="w-full"
                          loading={busy}
                          icon={<ArrowRight className="size-4" />}
                        >
                          Crear cuenta
                        </Button>
                        <p className="text-[11px] leading-relaxed text-faint">
                          Crea tu cuenta con el correo que usarás en el examen. Cuando tu centro te
                          asigne una prueba, aparecerá automáticamente en tu panel.
                        </p>
                      </form>
                    )}
                  </>
                )}
              </div>
            </TiltCard>

            <p className="mt-4 text-center text-[11px] leading-relaxed text-faint">
              Tus datos se usan únicamente para gestionar tus exámenes y tu constancia de participación.
            </p>
          </section>
        </div>

        <section className="mt-20 lg:mt-24">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <p className="text-[10.5px] font-semibold tracking-[0.18em] text-faint uppercase">
                La prueba
              </p>
              <h2 className="mt-2 text-[27px] leading-tight font-semibold tracking-[-0.04em] sm:text-[32px]">
                Cuatro destrezas,{" "}
                <span className="font-display font-normal italic text-accent-ink">una sola prueba.</span>
              </h2>
            </div>
            <p className="max-w-sm text-[12.5px] leading-relaxed text-muted">
              Cada sección se evalúa por separado y compone una puntuación global sobre 100.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SECTIONS.map(({ icon: Icon, title, text, short }, index) => (
              <TiltCard
                key={title}
                intensity={7}
                className="group relative overflow-hidden rounded-[1.4rem] border border-white/80 bg-white/55 p-5 shadow-[0_20px_50px_-40px_rgba(25,43,76,0.55),inset_0_1px_0_rgba(255,255,255,0.95)] backdrop-blur-xl transition-shadow duration-300 hover:shadow-[0_32px_70px_-40px_rgba(25,43,76,0.55),inset_0_1px_0_rgba(255,255,255,1)]"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div className="flex items-start justify-between">
                  <span className="flex size-10 items-center justify-center rounded-xl border border-white/90 bg-white/75 text-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_10px_24px_-18px_rgba(47,107,255,0.6)]">
                    <Icon className="size-4.5" strokeWidth={1.8} />
                  </span>
                  <span className="font-display text-[22px] leading-none text-[#c8d2e2] italic">
                    0{index + 1}
                  </span>
                </div>
                <p className="mt-5 text-[13.5px] leading-snug font-semibold">{title}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{text}</p>
                <div className="mt-4 flex items-center justify-between border-t border-[rgba(23,35,56,0.07)] pt-3">
                  <span className="text-[10px] font-semibold tracking-[0.09em] text-faint uppercase">
                    {short}
                  </span>
                  <span className="size-1.5 rounded-full bg-gold/70" />
                </div>
              </TiltCard>
            ))}
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
