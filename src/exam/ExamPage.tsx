import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Headphones,
  ListChecks,
  Mic,
  PenLine,
  RotateCcw,
} from "lucide-react";
import { Button, Notice, Spinner } from "../components/ui";
import { ExamShell, SECTION_LABELS } from "./Shell";
import TestStep from "./TestStep";
import ListeningStep from "./ListeningStep";
import WritingStep from "./WritingStep";
import SpeakingStep, { type RecordingPayload } from "./SpeakingStep";
import { loadExamBundle, submitAttempt, uploadSpeakingRecording } from "../lib/api";
import { LEVELS, LEVEL_INFO, type Candidate, type ExamBundle, type Level } from "../lib/types";
import { errorMessage } from "../lib/utils";

type Stage = "intro" | "test" | "listening" | "writing" | "speaking" | "done";

const CANDIDATE_KEY = "examen-espanol:candidate";

interface Draft {
  mcAnswers: Record<string, number>;
  listeningAnswers: Record<string, string>;
  writing: string;
}

function readCandidate(): Candidate | null {
  try {
    const raw = localStorage.getItem(CANDIDATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Candidate;
    if (!parsed.firstName || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default function ExamPage() {
  const { level: levelParam } = useParams();
  const level = (LEVELS as readonly string[]).includes(levelParam ?? "")
    ? (levelParam as Level)
    : null;

  const candidate = useMemo(readCandidate, [level]);
  const draftKey = candidate && level ? `examen-espanol:draft:${candidate.email}:${level}` : "";

  const [bundle, setBundle] = useState<ExamBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("intro");

  const [mcAnswers, setMcAnswers] = useState<Record<string, number>>({});
  const [listeningAnswers, setListeningAnswers] = useState<Record<string, string>>({});
  const [writing, setWriting] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptCode, setAttemptCode] = useState<string | null>(null);

  const fetchBundle = useCallback(async () => {
    if (!level) return;
    setLoading(true);
    setLoadError(null);
    try {
      setBundle(await loadExamBundle(level));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [level]);

  useEffect(() => {
    void fetchBundle();
  }, [fetchBundle]);

  // Restore a previous draft so a refresh mid-exam does not lose work.
  useEffect(() => {
    if (!draftKey) return;
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<Draft>;
      if (draft.mcAnswers) setMcAnswers(draft.mcAnswers);
      if (draft.listeningAnswers) setListeningAnswers(draft.listeningAnswers);
      if (typeof draft.writing === "string") setWriting(draft.writing);
    } catch {
      /* ignore corrupt drafts */
    }
  }, [draftKey]);

  useEffect(() => {
    if (!draftKey || stage === "done") return;
    const draft: Draft = { mcAnswers, listeningAnswers, writing };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draftKey, mcAnswers, listeningAnswers, writing, stage]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  if (!level) return <Navigate to="/" replace />;
  if (!candidate) return <Navigate to="/" replace />;

  const activeIndex =
    stage === "test" ? 0 : stage === "listening" ? 1 : stage === "writing" ? 2 : stage === "speaking" ? 3 : 0;

  async function handleSubmit(payload: RecordingPayload) {
    if (!candidate || !level) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let speakingPath: string | null = null;
      if (payload.blob) {
        speakingPath = await uploadSpeakingRecording(payload.blob, payload.extension);
      }
      const id = await submitAttempt({
        candidate,
        level,
        mcAnswers,
        listeningAnswers,
        writingText: writing,
        speakingPath,
        speakingDuration: payload.duration,
      });
      setAttemptCode(id.slice(0, 8).toUpperCase());
      localStorage.removeItem(draftKey);
      setStage("done");
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  if (stage === "done") {
    return <CompletionScreen code={attemptCode} level={level} candidate={candidate} />;
  }

  if (stage === "intro") {
    return (
      <IntroScreen
        candidate={candidate}
        level={level}
        bundle={bundle}
        loading={loading}
        error={loadError}
        onRetry={() => void fetchBundle()}
        onStart={() => setStage("test")}
      />
    );
  }

  return (
    <ExamShell level={level} activeIndex={activeIndex}>
      {loading && !bundle ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted">
          <Spinner className="size-6" />
          <p className="text-[13px]">Cargando tu examen…</p>
        </div>
      ) : loadError ? (
        <div className="card p-8 text-center">
          <Notice tone="danger">{loadError}</Notice>
          <Button className="mt-4" onClick={() => void fetchBundle()}>
            Reintentar
          </Button>
        </div>
      ) : bundle ? (
        <>
          {stage === "test" && (
            <TestStep
              questions={bundle.questions}
              answers={mcAnswers}
              onSelect={(questionId, optionIndex) =>
                setMcAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
              }
              onNext={() => setStage("listening")}
              onBack={() => setStage("intro")}
            />
          )}

          {stage === "listening" && (
            <ListeningStep
              items={bundle.listening}
              answers={listeningAnswers}
              onChange={(itemId, text) =>
                setListeningAnswers((prev) => ({ ...prev, [itemId]: text }))
              }
              onNext={() => setStage("writing")}
              onBack={() => setStage("test")}
            />
          )}

          {stage === "writing" && (
            <WritingStep
              prompt={bundle.writing}
              value={writing}
              onChange={setWriting}
              onNext={() => setStage("speaking")}
              onBack={() => setStage("listening")}
            />
          )}

          {stage === "speaking" && (
            <SpeakingStep
              prompt={bundle.speaking}
              submitting={submitting}
              submitError={submitError}
              onSubmit={(payload) => void handleSubmit(payload)}
              onBack={() => setStage("writing")}
            />
          )}
        </>
      ) : null}
    </ExamShell>
  );
}

function IntroScreen({
  candidate,
  level,
  bundle,
  loading,
  error,
  onRetry,
  onStart,
}: {
  candidate: Candidate;
  level: Level;
  bundle: ExamBundle | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onStart: () => void;
}) {
  const info = LEVEL_INFO[level];
  const sections = [
    { icon: ListChecks, title: "Comprensión", detail: `${bundle?.questions.length ?? "—"} preguntas` },
    { icon: Headphones, title: "Audición", detail: `${bundle?.listening.length ?? "—"} pistas` },
    { icon: PenLine, title: "Escritura", detail: "1 composición" },
    { icon: Mic, title: "Expresión oral", detail: "1 grabación" },
  ];

  return (
    <ExamShell level={level} activeIndex={0}>
      <div className="anim-rise">
        <p className="text-[11.5px] font-semibold tracking-[0.12em] text-faint uppercase">
          Nivel {level} · {info.name}
        </p>
        <h1 className="mt-3 text-[34px] leading-[1.08] font-semibold tracking-[-0.035em] sm:text-[46px]">
          Hola, {candidate.firstName}.
          <br />
          <span className="font-display text-[0.95em] font-normal italic text-accent-ink">
            ¿Empezamos?
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          El examen tiene cuatro secciones y puedes avanzar a tu ritmo. Tu progreso se guarda en este
          dispositivo hasta que lo envíes.
        </p>

        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {sections.map(({ icon: Icon, title, detail }) => (
            <div key={title} className="card flex items-center gap-4 p-4.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon className="size-4.5" strokeWidth={1.8} />
              </div>
              <div>
                <p className="text-[13.5px] font-semibold">{title}</p>
                <p className="text-[12px] text-muted">{detail}</p>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-6">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}
        {!loading && !error && bundle && bundle.questions.length === 0 && (
          <div className="mt-6">
            <Notice tone="warning">
              Este nivel todavía no tiene preguntas cargadas. Puedes continuar, pero la sección de
              comprensión quedará vacía.
            </Notice>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Button size="lg" onClick={onStart} disabled={loading} icon={<ArrowRight className="size-4" />}>
            {loading ? "Preparando el examen…" : "Comenzar"}
          </Button>
          {error && (
            <Button variant="secondary" size="lg" onClick={onRetry} icon={<RotateCcw className="size-4" />}>
              Reintentar
            </Button>
          )}
        </div>

        <p className="mt-6 text-[11.5px] text-faint">
          {candidate.firstName} {candidate.lastName} · {candidate.email}
        </p>
      </div>
    </ExamShell>
  );
}

function CompletionScreen({
  code,
  level,
  candidate,
}: {
  code: string | null;
  level: Level;
  candidate: Candidate;
}) {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-[radial-gradient(100%_70%_at_50%_-10%,#e9f4ff_0%,#fbfbfd_60%)] px-5 py-16">
      <div className="anim-rise card w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#eef8f1] text-success">
          <CheckCircle2 className="size-7" strokeWidth={1.8} />
        </div>
        <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">Examen enviado</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Gracias, {candidate.firstName}. Hemos recibido tus respuestas de nivel {level} y el equipo
          evaluador las revisará en breve.
        </p>

        <div className="mt-6 rounded-2xl border border-line bg-[#fcfcfe] px-5 py-4">
          <p className="text-[10.5px] font-medium tracking-[0.1em] text-faint uppercase">Referencia</p>
          <p className="mt-1 font-mono text-[16px] font-semibold tracking-[0.06em]">{code ?? "—"}</p>
          <p className="mt-2 text-[11.5px] text-faint">Guarda este código por si necesitas consultarlo.</p>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11.5px] text-muted">
          {SECTION_LABELS.map((label) => (
            <span key={label} className="rounded-full bg-[#f2f2f5] px-2.5 py-1">
              {label} ✓
            </span>
          ))}
        </div>

        <Link to="/" className="mt-7 inline-block">
          <Button variant="secondary" size="lg">
            Volver al inicio
          </Button>
        </Link>
      </div>
    </div>
  );
}
