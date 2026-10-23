import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { Award, ClipboardCheck, Clock3, Search } from "lucide-react";
import { Button, Field, Notice, Spinner } from "../components/ui";
import { BackLink, SiteFooter, SiteHeader } from "../components/SiteHeader";
import { CertificatePanel } from "./Certificate";
import { issueCertificate, lookupAttemptResult } from "../lib/api";
import { isCertificateEligible } from "../lib/certificate";
import type { AttemptResult, CertificateRecord } from "../lib/types";
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
  const [certificate, setCertificate] = useState<CertificateRecord | null>(null);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const [certificateLoading, setCertificateLoading] = useState(false);
  const lookupSeq = useRef(0);

  async function handleLookup(event: FormEvent) {
    event.preventDefault();
    const sequence = ++lookupSeq.current;
    setLoading(true);
    setError(null);
    setResult(null);
    setCertificate(null);
    setCertificateError(null);
    setCertificateLoading(false);
    try {
      const found = await lookupAttemptResult(code, email);
      if (sequence !== lookupSeq.current) return;
      setResult(found);
      setSearched(true);

      if (found && isCertificateEligible(found)) {
        setCertificateLoading(true);
        try {
          const issued = await issueCertificate(found.reference, email);
          if (sequence === lookupSeq.current) setCertificate(issued);
        } catch (err) {
          if (sequence === lookupSeq.current) setCertificateError(errorMessage(err));
        } finally {
          if (sequence === lookupSeq.current) setCertificateLoading(false);
        }
      }
    } catch (err) {
      if (sequence === lookupSeq.current) {
        setError(errorMessage(err));
        setSearched(false);
      }
    } finally {
      if (sequence === lookupSeq.current) setLoading(false);
    }
  }

  return (
    <div className="app-page">
      <SiteHeader width="3xl" right={<BackLink label="Inicio" />} />

      <main className="mx-auto max-w-3xl px-5 py-12 sm:px-8 sm:py-16">
        <div className="anim-rise">
          <span className="premium-kicker">
            <span className="size-1.5 rounded-full bg-gold" />
            Consulta de resultados
          </span>
          <h1 className="mt-5 text-[clamp(2.6rem,6vw,3.5rem)] leading-[1] font-semibold tracking-[-0.05em]">
            ¿Cómo{" "}
            <span className="font-display font-normal italic text-gradient-blue">te fue?</span>
          </h1>
          <p className="mt-4 max-w-xl text-[14px] leading-relaxed text-muted">
            Introduce el código de referencia que viste al enviar el examen y el mismo correo con el
            que te registraste.
          </p>
        </div>

        <form onSubmit={(event) => void handleLookup(event)} className="anim-rise premium-panel mt-8 rounded-[1.75rem] p-6 sm:p-8">
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
            size="lg"
            className="mt-5 w-full sm:w-auto"
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

        {result && isCertificateEligible(result) && (
          <>
            {certificate && <CertificatePanel certificate={certificate} />}
            {certificateLoading && (
              <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-white/85 bg-white/60 px-4 py-3 text-[12.5px] text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md">
                <Spinner className="size-4" />
                Preparando tu certificado…
              </div>
            )}
            {certificateError && (
              <div className="mt-4">
                <Notice tone="warning">{certificateError}</Notice>
              </div>
            )}
          </>
        )}

        {result &&
          result.results_visible !== false &&
          result.status === "graded" &&
          result.total_score !== null &&
          result.total_score < 60 && (
            <div className="mt-5 flex items-start gap-2.5 rounded-xl border border-white/85 bg-white/60 px-4 py-3 text-[12.5px] leading-relaxed text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md">
              <Award className="mt-0.5 size-4 shrink-0 text-faint" />
              El certificado se emite a partir de 60/100. Puedes consultar con tu centro las opciones
              para volver a preparar el examen.
            </div>
          )}
      </main>
      <SiteFooter note="Consulta privada de resultados" />
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
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/70 bg-white/35 px-6 py-5 backdrop-blur-md sm:px-8">
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
      <div className="grid items-center gap-7 px-6 py-7 sm:grid-cols-[1fr_auto] sm:px-8">
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-medium">{row.label}</p>
                  {row.detail && <p className="text-[10.5px] text-faint">{row.detail}</p>}
                </div>
                <span className="text-[13px] font-semibold tabular-nums">
                  {row.value === null ? "—" : `${row.value}%`}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#e5ebf4]/80">
                <div
                  className="h-full rounded-full bg-[linear-gradient(90deg,#2f6bff,#8fb3ff)] transition-[width] duration-700"
                  style={{ width: `${Math.max(0, Math.min(100, row.value ?? 0))}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center justify-center sm:w-[164px]">
          <div
            className="progress-ring size-[132px]"
            style={{ "--value": graded ? result.total_score ?? 0 : 0 } as CSSProperties}
          >
            <div className="text-center">
              <p className="text-[38px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
                {result.total_score ?? "—"}
              </p>
              <p className="mt-1 text-[9px] font-semibold tracking-[0.1em] text-faint uppercase">
                sobre 100
              </p>
            </div>
          </div>
          <p className="mt-3 text-center text-[9.5px] font-semibold tracking-[0.12em] text-faint uppercase">
            Puntuación global
          </p>
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
