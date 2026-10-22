import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, Check, Headphones, ListChecks, LogOut, Mic, PenLine, ShieldCheck } from "lucide-react";
import { Button, Field, Notice } from "../components/ui";
import {
  getCandidateAccount,
  registerCandidate,
  signInCandidate,
  signOutCandidate,
  type CandidateAccount,
} from "../lib/api";
import { errorMessage } from "../lib/utils";

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
            Inicia sesión para ver los exámenes que tu centro te ha asignado. Solo aparecen las
            pruebas asignadas a tu cuenta y puedes completarlas a tu ritmo dentro del plazo.
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
            Tiempo limitado según el nivel · Progreso guardado en el servidor
          </p>

          <p className="mt-3 text-[12px] text-faint">
            ¿Ya hiciste el examen?{" "}
            <Link to="/resultado" className="font-medium text-accent-ink underline-offset-2 hover:underline">
              Consulta tu resultado
            </Link>
          </p>
        </section>

        <section className="anim-rise" style={{ animationDelay: "120ms" }}>
          <div className="card p-6 sm:p-8">
            {checking ? (
              <p className="py-10 text-center text-[13px] text-muted">Comprobando sesión…</p>
            ) : account ? (
              <div className="text-center">
                <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#eef8f1] text-success">
                  <Check className="size-5" strokeWidth={2.4} />
                </div>
                <h2 className="mt-4 text-[22px] font-semibold tracking-[-0.02em]">
                  Hola, {account.fullName.split(" ")[0]}
                </h2>
                <p className="mt-1 text-[13px] text-muted">
                  Sesión iniciada como {account.email}
                </p>
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
                <div className="flex rounded-xl bg-[#f2f2f5] p-1">
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
                      className={`flex-1 rounded-lg px-3 py-2 text-[13px] font-medium transition ${
                        mode === key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                      }`}
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
                  <form className="mt-6 space-y-4" onSubmit={(event) => void handleLogin(event)}>
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
                    <Button type="submit" size="lg" className="w-full" loading={busy}>
                      Entrar
                    </Button>
                  </form>
                ) : (
                  <form className="mt-6 space-y-4" onSubmit={(event) => void handleRegister(event)}>
                    <Field
                      label="Nombre y apellidos"
                      htmlFor="register-name"
                      hint="Los mismos datos que usaste en tu examen anterior."
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
                    <div className="grid gap-4 sm:grid-cols-2">
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
                    <p className="text-[11.5px] leading-relaxed text-faint">
                      Solo pueden registrarse personas que ya hayan realizado un examen con este
                      correo. Si no es tu caso, contacta con tu centro.
                    </p>
                  </form>
                )}
              </>
            )}
          </div>

          <p className="mt-5 text-center text-[11.5px] text-faint">
            Tus datos se usan únicamente para gestionar tus exámenes.
          </p>
        </section>
      </main>
    </div>
  );
}
