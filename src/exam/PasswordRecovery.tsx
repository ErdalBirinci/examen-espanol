import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CheckCircle2, KeyRound, Mail } from "lucide-react";
import { Button, Field, Notice, Spinner } from "../components/ui";
import { BackLink, SiteHeader } from "../components/SiteHeader";
import {
  clearRecoverySession,
  requestPasswordReset,
  restoreRecoverySession,
  signOutCandidate,
  updateCandidatePassword,
} from "../lib/api";
import { errorMessage } from "../lib/utils";

function RecoveryShell({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="app-page min-h-dvh">
      <SiteHeader width="3xl" right={<BackLink label="Inicio" />} />

      <main className="mx-auto max-w-md px-5 py-12 sm:py-20">
        <div className="anim-rise">
          <span className="premium-kicker">
            <span className="size-1.5 rounded-full bg-gold" />
            {eyebrow}
          </span>
          <h1 className="mt-5 text-[clamp(2.2rem,5vw,2.6rem)] leading-[1.04] font-semibold tracking-[-0.045em]">
            {title}
          </h1>
          <p className="mt-3.5 text-[13.5px] leading-relaxed text-muted">{description}</p>
        </div>
        <div className="anim-rise premium-panel mt-7 rounded-[1.75rem] p-6 sm:p-8">{children}</div>
      </main>
    </div>
  );
}

export function RequestPasswordReset() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <RecoveryShell
      eyebrow="Acceso a tu cuenta"
      title="Recupera tu contraseña"
      description="Escribe el correo con el que te registraste y te enviaremos un enlace para crear una contraseña nueva."
    >
      {sent ? (
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#eef8f1] text-success">
            <Mail className="size-5" strokeWidth={1.9} />
          </div>
          <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.02em]">Revisa tu correo</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Si existe una cuenta con <span className="font-medium text-ink">{email}</span>, recibirás
            un enlace para restablecer la contraseña. Revisa también la carpeta de spam.
          </p>
          <div className="mt-6 grid gap-2">
            <Button variant="secondary" onClick={() => setSent(false)}>
              Usar otro correo
            </Button>
            <Link to="/">
              <Button variant="ghost" className="w-full">
                Volver a iniciar sesión
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="Correo electrónico" htmlFor="recovery-email">
            <input
              id="recovery-email"
              type="email"
              className="field"
              autoComplete="email"
              placeholder="lucia@correo.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy} icon={<Mail className="size-4" />}>
            Enviar enlace
          </Button>
          <Link
            to="/"
            className="block text-center text-[12.5px] font-medium text-muted hover:text-ink"
          >
            Volver a iniciar sesión
          </Link>
        </form>
      )}
    </RecoveryShell>
  );
}

export function ResetPassword() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [ready, setReady] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let active = true;
    restoreRecoverySession()
      .then((hasSession) => {
        if (!active) return;
        if (hasSession) setReady(true);
        else
          setLinkError(
            "Este enlace no es válido o ha caducado. Solicita un enlace nuevo para continuar.",
          );
      })
      .catch((err) => {
        if (active) setLinkError(errorMessage(err));
      })
      .finally(() => {
        if (active) setChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
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
      await updateCandidatePassword(password);
      clearRecoverySession();
      await signOutCandidate();
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <RecoveryShell
      eyebrow="Acceso a tu cuenta"
      title="Crea una contraseña nueva"
      description="Elige una contraseña de al menos 8 caracteres. Después podrás iniciar sesión con ella."
    >
      {checking ? (
        <div className="flex flex-col items-center gap-3 py-8 text-muted">
          <Spinner className="size-5" />
          <p className="text-[12.5px]">Comprobando el enlace…</p>
        </div>
      ) : done ? (
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#eef8f1] text-success">
            <CheckCircle2 className="size-6" strokeWidth={1.9} />
          </div>
          <h2 className="mt-4 text-[19px] font-semibold tracking-[-0.02em]">Contraseña actualizada</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            Ya puedes iniciar sesión con tu nueva contraseña.
          </p>
          <Button className="mt-6 w-full" size="lg" onClick={() => navigate("/")}>
            Ir a iniciar sesión
          </Button>
        </div>
      ) : !ready ? (
        <div className="text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#fdf4f4] text-danger">
            <KeyRound className="size-5" strokeWidth={1.9} />
          </div>
          <h2 className="mt-4 text-[18px] font-semibold">Enlace no válido</h2>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">
            {linkError ?? "Solicita un enlace nuevo para restablecer tu contraseña."}
          </p>
          <Link to="/cuenta/recuperar" className="mt-5 inline-block">
            <Button>Solicitar un enlace nuevo</Button>
          </Link>
        </div>
      ) : (
        <form className="space-y-4" onSubmit={(event) => void submit(event)}>
          {error && <Notice tone="danger">{error}</Notice>}
          <Field label="Nueva contraseña" htmlFor="reset-password" hint="Mínimo 8 caracteres.">
            <input
              id="reset-password"
              type="password"
              className="field"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </Field>
          <Field label="Repetir contraseña" htmlFor="reset-confirm">
            <input
              id="reset-confirm"
              type="password"
              className="field"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </Field>
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Guardar contraseña
          </Button>
        </form>
      )}
    </RecoveryShell>
  );
}
