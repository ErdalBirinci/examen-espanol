import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, Clock3, Search } from "lucide-react";
import { Button, Field, Notice } from "../components/ui";
import { lookupAttemptResult } from "../lib/api";
import type { AttemptResult } from "../lib/types";
import { errorMessage } from "../lib/utils";

const CANDIDATE_KEY = "examen-espanol:candidate";

function readEmail(): string {
  try {
    const raw = localStorage.getItem(CANDIDATE_KEY);
    if (!raw) return "";
    return (JSON.parse(raw) as { email?: string }).email ?? "";
  } catch {
    return "";
  }
}

function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ResultPage() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => (params.get("code") ?? "").slice(0, 8).toUpperCase());
  const [email, setEmail] = useState(() => params.get("email") ?? readEmail());
  const [result, setResult] = useState<AttemptResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLookup(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const found = await lookupAttemptResult(code, email);
      setResult(found);
      setSearched(true);
    } catch (err) {
      setError(errorMessage(err));
      setSearched(false);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_70%_at_50%_-15%,#e9f2ff_0%,#f7f9fd_38%,#fbfbfd_70%)]">
      <header className="sticky top-0 z-30 border-b border-[rgba(29,29,31,0.06)] glass-bar">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Examen</span>
            <span className="font-display text-[19px] italic text-accent-ink">de Español</span>
          </Link>
          <Link
            to="/"
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-ink"
          >
            <ArrowLeft className="size-3.5" />
            Inicio
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="anim-rise">
          <p className="text-[11.5px] font-semibold tracking-[0.12em] text-faint uppercase">
            Consulta de resultados
          </p>
          <h1 className="mt-3 text-[34px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[42px]">
            ¿Cómo te fue?
          </h1>
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-muted">
            Introduce el código de referencia que viste al enviar el examen y el mismo correo con el
            que te registraste.
          </p>
        </div>

        <form onSubmit={(event) => void handleLookup(event)} className="anim-rise card mt-8 p-6 sm:p-8">
          <div className="grid gap-4 sm:grid-cols-[1fr_1.2fr]">
            <Field label="Código de referencia" htmlFor="code" hint="8 caracteres, por ejemplo 4F2A9C1B.">
              <input
                id="code"
                className="field font-mono tracking-[0.08em] uppercase"
                placeholder="4F2A9C1B"
                value={code}
                maxLength={8}
                onChange={(event) => setCode(event.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                required
              />
            </Field>
            <Field label="Correo electrónico" htmlFor="result-email">
              <input
                id="result-email"
                type="email"
                className="field"
                autoComplete="email"
                placeholder="lucia@correo.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Field>
          </div>

          <Button
            type="submit"
            className="mt-5"
            loading={loading}
            icon={<Search className="size-4" />}
          >
            Consultar resultado
          </Button>
        </form>

        {error && (
          <div className="mt-5">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}

        {searched && !result && !error && (
          <div className="mt-5">
            <Notice tone="warning">
              No encontramos ningún examen con esos datos. Revisa el código y el correo; si el
              problema continúa, escribe al equipo evaluador.
            </Notice>
          </div>
        )}

        {result && <ResultCard result={result} />}
      </main>
    </div>
  );
}

function ResultCard({ result }: { result: AttemptResult }) {
  const hidden = result.results_visible === false;
  const graded = !hidden && result.status === "graded" && result.total_score !== null;
  const testPercent =
    result.mc_total && result.mc_total > 0
      ? Math.round(((result.mc_correct ?? 0) / result.mc_total) * 100)
      : null;

  const rows = [
    {
      label: "Vocabulario y Gramática",
      value: testPercent,
      detail: `${result.mc_correct ?? 0} de ${result.mc_total ?? 0} correctas`,
    },
    { label: "Comprensión Auditiva", value: result.listening_score, detail: null },
    { label: "Expresión Escrita", value: result.writing_score, detail: null },
    { label: "Expresión Oral", value: result.speaking_score, detail: null },
  ];

  return (
    <section className="anim-rise card mt-6 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line bg-[#fcfcfe] px-6 py-5 sm:px-8">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
            Referencia {result.reference} · Nivel {result.level}
          </p>
          <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.02em]">{result.full_name}</h2>
          <p className="mt-1 flex items-center gap-1.5 text-[12px] text-muted">
            <Clock3 className="size-3.5" />
            Enviado el {formatDate(result.submitted_at)}
          </p>
        </div>
        <span
          className={
            graded
              ? "inline-flex items-center gap-1.5 rounded-full bg-[#eef8f1] px-3 py-1 text-[11.5px] font-semibold text-success"
              : "inline-flex items-center gap-1.5 rounded-full bg-[#fdf8ec] px-3 py-1 text-[11.5px] font-semibold text-warning"
          }
        >
          <ClipboardCheck className="size-3.5" />
          {graded ? "Evaluado" : "En revisión"}
        </span>
      </div>

      {hidden ? (
        <div className="px-6 py-6 sm:px-8">
          <Notice tone="warning">
            Tu examen está enviado, pero el centro todavía no ha publicado los resultados. Esta misma
            consulta mostrará las puntuaciones cuando estén disponibles.
          </Notice>
        </div>
      ) : (
      <div className="grid gap-6 px-6 py-6 sm:grid-cols-[1fr_auto] sm:px-8">
        <div className="space-y-3">
          {rows.map((row) => (
            <div key={row.label} className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium">{row.label}</p>
                {row.detail && <p className="text-[11.5px] text-faint">{row.detail}</p>}
              </div>
              <span className="w-14 text-right text-[14px] font-semibold tabular-nums">
                {row.value === null ? "—" : `${row.value}%`}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center rounded-2xl bg-ink px-8 py-6 text-center text-white sm:w-40">
          <p className="text-[10.5px] font-medium tracking-[0.1em] text-white/60 uppercase">
            Puntuación global
          </p>
          <p className="mt-1.5 text-[38px] leading-none font-semibold tabular-nums">
            {result.total_score ?? "—"}
          </p>
          <p className="mt-1 text-[11px] text-white/60">sobre 100</p>
        </div>
      </div>
      )}

      {!hidden && (
        <div className="border-t border-line px-6 py-4 sm:px-8">
          <p className="text-[11.5px] leading-relaxed text-faint">
            {graded
              ? "La puntuación global combina las cuatro secciones: 40 % vocabulario y gramática, 20 % cada una de las destrezas."
              : "Las secciones de expresión se están evaluando manualmente. Cuando el equipo termine, esta misma consulta mostrará la puntuación global."}
          </p>
        </div>
      )}
    </section>
  );
}
