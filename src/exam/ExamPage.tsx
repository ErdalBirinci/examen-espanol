import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Headphones,
  ListChecks,
  Mic,
  PenLine,
  RotateCcw,
} from "lucide-react";
import { Button, Notice, Spinner } from "../components/ui";
import { SiteHeader } from "../components/SiteHeader";
import { ExamShell, SECTION_LABELS, SECTION_STAGES, type SectionStage } from "./Shell";
import TestStep from "./TestStep";
import ListeningStep from "./ListeningStep";
import WritingStep from "./WritingStep";
import SpeakingStep, { type RecordingPayload } from "./SpeakingStep";
import ReviewStep from "./ReviewStep";
import {
  deleteExamDraft,
  getAssignment,
  getCandidateAccount,
  getExamBundle,
  getExamDraft,
  resumeExamDraft,
  saveExamDraft,
  startExamDraft,
  recordAttemptIntegrity,
  submitAttempt,
  uploadSpeakingRecording,
} from "../lib/api";
import { useExamIntegrity } from "./useExamIntegrity";
import type { Assignment } from "../lib/api";
import { LEVEL_INFO, type Candidate, type ExamBundle, type Level } from "../lib/types";
import { errorMessage, formatSeconds, wordCount } from "../lib/utils";

type Stage = "intro" | "test" | "listening" | "writing" | "speaking" | "review" | "done";

const SESSION_PREFIX = "examen-espanol:session";

interface Draft {
  mcAnswers: Record<string, number>;
  listeningAnswers: Record<string, number>;
  writing: string;
  writing2: string;
  startedAt: number | null;
  stage?: Stage;
}

function isSectionStage(value: unknown): value is SectionStage {
  return typeof value === "string" && (SECTION_STAGES as string[]).includes(value);
}

export default function ExamPage() {
  const { assignmentId } = useParams();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessError, setAccessError] = useState<string | null>(null);

  const level: Level | null = assignment?.level ?? null;
  const draftKey = candidate && assignmentId ? `examen-espanol:draft:${candidate.email}:${assignmentId}` : "";
  const sessionKey = candidate && assignmentId ? `${SESSION_PREFIX}:${candidate.email}:${assignmentId}` : "";

  const [bundle, setBundle] = useState<ExamBundle | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("intro");
  const [startSection, setStartSection] = useState<SectionStage>("test");

  const [mcAnswers, setMcAnswers] = useState<Record<string, number>>({});
  const [listeningAnswers, setListeningAnswers] = useState<Record<string, number>>({});
  const [listeningPlays, setListeningPlays] = useState(0);
  const [writing, setWriting] = useState("");
  const [writing2, setWriting2] = useState("");
  const [recording, setRecording] = useState<RecordingPayload | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [hydrated, setHydrated] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [attemptCode, setAttemptCode] = useState<string | null>(null);
  const [draftToken, setDraftToken] = useState<string | null>(null);
  const [draftCode, setDraftCode] = useState<string | null>(null);
  const [draftBusy, setDraftBusy] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const { focusLosses, snapshot: integritySnapshot } = useExamIntegrity(
    Boolean(bundle) && stage !== "intro" && stage !== "done",
  );

  const submitRef = useRef(false);

  // Access is granted only while signed in and only for an assignment that
  // belongs to this account; the assignment is re-read from the server.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const account = await getCandidateAccount();
        if (!active) return;
        if (!account) {
          setAccessError("Debes iniciar sesión para abrir este examen.");
          return;
        }
        if (!assignmentId) {
          setAccessError("Este enlace de examen no es válido.");
          return;
        }
        const row = await getAssignment(assignmentId);
        if (!active) return;
        if (!row) {
          setAccessError("Este examen no está asignado a tu cuenta.");
          return;
        }
        if (row.attempt_id) {
          setAccessError("Ya has enviado este examen. No se puede repetir.");
          return;
        }
        const parts = account.fullName.split(/\s+/);
        setCandidate({
          firstName: parts[0] ?? "Aday",
          lastName: parts.slice(1).join(" "),
          email: account.email,
        });
        setAssignment(row);
      } catch (error) {
        if (active) setAccessError(errorMessage(error));
      } finally {
        if (active) setAccessLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [assignmentId]);

  const loadBundle = useCallback(async (token: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      setBundle(await getExamBundle(token));
    } catch (error) {
      setLoadError(errorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  // Restore a previous draft so a refresh mid-exam does not lose work.
  useEffect(() => {
    setHydrated(false);
    let active = true;

    async function restore() {
      if (!draftKey) return;
      try {
        const raw = localStorage.getItem(draftKey);
        if (raw) {
          const draft = JSON.parse(raw) as Partial<Draft>;
          if (draft.mcAnswers) setMcAnswers(draft.mcAnswers);
          if (draft.listeningAnswers) setListeningAnswers(draft.listeningAnswers);
          if (typeof draft.writing === "string") setWriting(draft.writing);
          if (typeof draft.writing2 === "string") setWriting2(draft.writing2);
          if (typeof draft.startedAt === "number") setStartedAt(draft.startedAt);
          if (isSectionStage(draft.stage) || draft.stage === "review") {
            setStage(draft.stage);
            if (isSectionStage(draft.stage)) setStartSection(draft.stage);
          }
        }
      } catch {
        /* ignore corrupt drafts */
      }

      // The server copy wins when it is available, so a draft also survives a
      // cleared browser or a different device.
      const rawSession = sessionKey ? localStorage.getItem(sessionKey) : null;
      if (!rawSession) return;
      try {
        const session = JSON.parse(rawSession) as { token?: string; code?: string };
        if (!session.token) return;
        const snapshot = await getExamDraft(session.token);
        if (!active) return;
        if (!snapshot) {
          localStorage.removeItem(sessionKey);
          return;
        }
        applyDraftSnapshot(snapshot);
        await loadBundle(snapshot.token);
      } catch {
        /* keep the local copy if the server is unreachable */
      }
    }

    void restore().finally(() => {
      if (active) setHydrated(true);
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, sessionKey]);

  useEffect(() => {
    // Never write before the restore above has run, otherwise the empty initial
    // state would wipe the saved draft on every reload.
    if (!draftKey || !hydrated || stage === "done") return;
    const draft: Draft = {
      mcAnswers,
      listeningAnswers,
      writing,
      writing2,
      startedAt,
      stage: stage === "intro" ? undefined : stage,
    };
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [draftKey, hydrated, mcAnswers, listeningAnswers, writing, writing2, startedAt, stage]);

  // Mirror the answers to the server so another device can resume the exam.
  useEffect(() => {
    if (!draftToken || !hydrated || !startedAt || stage === "done") return;
    const timer = window.setTimeout(() => {
      void saveExamDraft(draftToken, mcAnswers, listeningAnswers, writing, writing2).catch(
        () => undefined,
      );
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [draftToken, hydrated, startedAt, stage, mcAnswers, listeningAnswers, writing, writing2]);

  const durationMinutes =
    assignment?.duration_minutes ?? bundle?.settings.duration_minutes ?? 60;
  const endsAt = startedAt ? startedAt + durationMinutes * 60_000 : null;
  const remainingSeconds = endsAt ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : null;
  const expired = remainingSeconds !== null && remainingSeconds <= 0;

  useEffect(() => {
    if (!startedAt || stage === "done") return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, stage]);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [stage]);

  function applyDraftSnapshot(snapshot: {
    token: string;
    code: string;
    started_at: string;
    mc_answers: Record<string, number>;
    listening_answers: Record<string, number>;
    writing_text: string;
    writing_text_2: string;
  }) {
    setDraftToken(snapshot.token);
    setDraftCode(snapshot.code);
    setMcAnswers(snapshot.mc_answers ?? {});
    setListeningAnswers(snapshot.listening_answers ?? {});
    setWriting(snapshot.writing_text ?? "");
    setWriting2(snapshot.writing_text_2 ?? "");
    setStartedAt(new Date(snapshot.started_at).getTime());
  }

  async function beginExam(section: SectionStage) {
    if (expired || !candidate || !level || !assignmentId || draftBusy) return;
    setDraftBusy(true);
    setSubmitError(null);
    try {
      let token = draftToken;
      if (!token) {
        const draft = await startExamDraft(candidate, level, assignmentId);
        token = draft.token;
        setDraftToken(draft.token);
        setDraftCode(draft.code);
        setStartedAt(new Date(draft.startedAt).getTime());
        try {
          localStorage.setItem(sessionKey, JSON.stringify({ token: draft.token, code: draft.code }));
        } catch {
          /* storage can be unavailable */
        }
      }
      if (!bundle) {
        await loadBundle(token);
      }
      setStage(section);
    } catch (error) {
      setSubmitError(errorMessage(error));
      setLoadError(errorMessage(error));
    } finally {
      setDraftBusy(false);
    }
  }

  async function handleResume(code: string, email: string, section: SectionStage) {
    if (!level || draftBusy) return;
    setDraftBusy(true);
    setResumeError(null);
    try {
      const snapshot = await resumeExamDraft(code, email, level);
      if (!snapshot) {
        setResumeError("Bu kod ve e-posta ile açık bir taslak bulunamadı.");
        return;
      }
      applyDraftSnapshot(snapshot);
      await loadBundle(snapshot.token);
      try {
        localStorage.setItem(sessionKey, JSON.stringify({ token: snapshot.token, code: snapshot.code }));
      } catch {
        /* storage can be unavailable */
      }
      setStage(section);
    } catch (error) {
      setResumeError(errorMessage(error));
    } finally {
      setDraftBusy(false);
    }
  }

  const handleSubmit = useCallback(async () => {
    if (!candidate || !level || submitRef.current) return;
    if (!draftToken) {
      setSubmitError("Sınav oturumu bulunamadı. Sayfayı yenileyip sınava yeniden başla.");
      setStage("review");
      return;
    }
    submitRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      let speakingPath: string | null = null;
      if (recording) {
        speakingPath = await uploadSpeakingRecording(recording.blob, recording.extension);
      }
      const id = await submitAttempt({
        candidate,
        level,
        mcAnswers,
        listeningAnswers,
        writingText: writing,
        writingText2: writing2,
        speakingPath,
        speakingDuration: recording?.duration ?? null,
        assignmentId: assignmentId ?? "",
        draftToken,
      });
      setAttemptCode(id.slice(0, 8).toUpperCase());
      void recordAttemptIntegrity(id, integritySnapshot());
      try {
        localStorage.removeItem(draftKey);
        if (sessionKey) localStorage.removeItem(sessionKey);
      } catch {
        /* storage can be unavailable in private mode */
      }
      if (draftCode) void deleteExamDraft(draftCode, candidate.email).catch(() => undefined);
      setStage("done");
    } catch (error) {
      setSubmitError(errorMessage(error));
      setStage((current) => (current === "speaking" ? "review" : current));
    } finally {
      submitRef.current = false;
      setSubmitting(false);
    }
  }, [
    candidate,
    level,
    mcAnswers,
    listeningAnswers,
    writing,
    writing2,
    recording,
    draftKey,
    sessionKey,
    draftCode,
    draftToken,
    assignmentId,
    integritySnapshot,
  ]);

  // Time is up: submit whatever has been answered, from any active section.
  useEffect(() => {
    if (stage === "intro" || stage === "done") return;
    if (!expired) return;
    void handleSubmit();
  }, [expired, stage, handleSubmit]);

  if (accessLoading) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-3 text-muted">
        <Spinner className="size-6" />
        <p className="text-[13px]">Comprobando tu acceso…</p>
      </div>
    );
  }

  if (accessError) {
    return (
      <div className="app-page flex min-h-dvh items-center justify-center px-5">
        <div className="card w-full max-w-md p-8 text-center">
          <h1 className="text-[20px] font-semibold">No se puede abrir este examen</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-muted">{accessError}</p>
          <Link to="/cuenta" className="mt-5 inline-block">
            <Button variant="secondary">Volver a mi panel</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!level || !candidate) return <Navigate to="/cuenta" replace />;

  const activeIndex =
    stage === "test"
      ? 0
      : stage === "listening"
        ? 1
        : stage === "writing"
          ? 2
          : stage === "speaking" || stage === "review"
            ? 3
            : 0;

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
        remainingSeconds={remainingSeconds}
        expired={expired}
        submitting={submitting}
        submitError={submitError}
        draftBusy={draftBusy}
        resumeError={resumeError}
        draftCode={draftCode}
        startSection={startSection}
        onSelectStart={setStartSection}
        onRetry={() => {
          if (draftToken) void loadBundle(draftToken);
        }}
        onStart={() => void beginExam(startSection)}
        onResume={(code, email) => void handleResume(code, email, startSection)}
        onSubmit={() => void handleSubmit()}
      />
    );
  }

  return (
    <ExamShell
      level={level}
      activeIndex={activeIndex}
      remainingSeconds={remainingSeconds ?? undefined}
      onSelectSection={(index) => setStage(SECTION_STAGES[index])}
    >
      {loading && !bundle ? (
        <div className="flex flex-col items-center gap-3 py-24 text-muted">
          <Spinner className="size-6" />
          <p className="text-[13px]">Cargando tu examen…</p>
        </div>
      ) : loadError ? (
        <div className="card p-8 text-center">
          <Notice tone="danger">{loadError}</Notice>
          <Button
            className="mt-4"
            onClick={() => {
              if (draftToken) void loadBundle(draftToken);
            }}
          >
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
              listening={bundle.listening}
              answers={listeningAnswers}
              onChange={(questionId, optionIndex) =>
                setListeningAnswers((prev) => ({ ...prev, [questionId]: optionIndex }))
              }
              plays={listeningPlays}
              onPlay={() =>
                setListeningPlays((value) =>
                  Math.min(value + 1, bundle.listening?.item.max_plays ?? 1),
                )
              }
              onNext={() => setStage("writing")}
              onBack={() => setStage("test")}
            />
          )}

          {stage === "writing" && (
            <WritingStep
              prompts={bundle.writing}
              value1={writing}
              value2={writing2}
              onChange={(part, text) => (part === 1 ? setWriting(text) : setWriting2(text))}
              onNext={() => setStage("speaking")}
              onBack={() => setStage("listening")}
            />
          )}

          {stage === "speaking" && (
            <SpeakingStep
              prompts={bundle.speaking}
              value={recording}
              onChange={setRecording}
              onContinue={() => setStage("review")}
              onBack={() => setStage("writing")}
            />
          )}

          {stage === "review" && (
            <ReviewStep
              candidate={candidate}
              level={level}
              answered={bundle.questions.filter((question) => mcAnswers[question.id] !== undefined).length}
              totalQuestions={bundle.questions.length}
              listeningAnswered={
                bundle.listening
                  ? bundle.listening.questions.filter(
                      (question) => listeningAnswers[question.id] !== undefined,
                    ).length
                  : 0
              }
              totalListening={bundle.listening?.questions.length ?? 0}
              writingWords={wordCount(writing)}
              writingWords2={wordCount(writing2)}
              minWords1={bundle.writing.find((prompt) => prompt.part === 1)?.min_words ?? null}
              minWords2={bundle.writing.find((prompt) => prompt.part === 2)?.min_words ?? null}
              hasRecording={Boolean(recording)}
              submitting={submitting}
              error={submitError}
              onSubmit={() => void handleSubmit()}
              onBack={() => setStage("speaking")}
            />
          )}
        </>
      ) : null}

      {focusLosses >= 2 && (
        <div className="fixed bottom-4 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-xl border border-[#f1e0c5] bg-[#fdf8ef] px-3.5 py-2.5 text-[11.5px] leading-relaxed text-warning shadow-lg">
          Sekme değişimi algılandı ({focusLosses}). Sınav sırasında bu sayfada kalman beklenir;
          bu hareket kaydedilir.
        </div>
      )}
    </ExamShell>
  );
}

function IntroScreen({
  candidate,
  level,
  bundle,
  loading,
  error,
  remainingSeconds,
  expired,
  submitting,
  submitError,
  draftBusy,
  resumeError,
  draftCode,
  startSection,
  onSelectStart,
  onRetry,
  onStart,
  onResume,
  onSubmit,
}: {
  candidate: Candidate;
  level: Level;
  bundle: ExamBundle | null;
  loading: boolean;
  error: string | null;
  remainingSeconds: number | null;
  expired: boolean;
  submitting: boolean;
  submitError: string | null;
  draftBusy: boolean;
  resumeError: string | null;
  draftCode: string | null;
  startSection: SectionStage;
  onSelectStart: (stage: SectionStage) => void;
  onRetry: () => void;
  onStart: () => void;
  onResume: (code: string, email: string) => void;
  onSubmit: () => void;
}) {
  const info = LEVEL_INFO[level];
  const [resumeOpen, setResumeOpen] = useState(false);
  const [resumeCode, setResumeCode] = useState("");
  const [resumeEmail, setResumeEmail] = useState(candidate.email);
  const sections: {
    stage: SectionStage;
    icon: typeof ListChecks;
    title: string;
    detail: string;
  }[] = [
    {
      stage: "test",
      icon: ListChecks,
      title: "Vocabulario y Gramática",
      detail: bundle ? `${bundle.questions.length} preguntas` : "50 preguntas",
    },
    {
      stage: "listening",
      icon: Headphones,
      title: "Comprensión Auditiva",
      detail: bundle?.listening
        ? `${bundle.listening.questions.length} preguntas`
        : "10 preguntas",
    },
    {
      stage: "writing",
      icon: PenLine,
      title: "Expresión Escrita",
      detail: bundle ? `${bundle.writing.length} tareas` : "2 tareas",
    },
    {
      stage: "speaking",
      icon: Mic,
      title: "Expresión oral",
      detail: "2 partes · 1 grabación + entrevista",
    },
  ];
  const selectedSection = sections.find((section) => section.stage === startSection) ?? sections[0];

  return (
    <ExamShell level={level} activeIndex={0}>
      <div className="anim-rise">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11.5px] font-semibold tracking-[0.12em] text-faint uppercase">
            Nivel {level} · {info.name}
          </p>
          {remainingSeconds !== null && (
            <div
              className={
                expired
                  ? "flex items-center gap-1.5 rounded-full bg-[#fdf0f0] px-3 py-1 text-[12px] font-semibold text-danger tabular-nums"
                  : "flex items-center gap-1.5 rounded-full bg-[#f2f2f5] px-3 py-1 text-[12px] font-medium text-muted tabular-nums"
              }
            >
              <Clock3 className="size-3.5" />
              {expired ? "Tiempo agotado" : `${formatSeconds(remainingSeconds)} restantes`}
            </div>
          )}
        </div>
        <h1 className="mt-3 text-[34px] leading-[1.04] font-semibold tracking-[-0.045em] sm:text-[48px]">
          Hola, <span className="font-display font-normal italic text-gradient-blue">{candidate.firstName}</span>.
          <br />
          <span className="text-[0.72em] font-semibold tracking-[-0.03em] text-ink">
            ¿Empezamos?
          </span>
        </h1>
        <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-muted">
          El examen tiene cuatro secciones y puedes empezar por la que prefieras. Cambia de sección
          cuando quieras desde la cabecera; tu progreso se guarda hasta que lo envíes.
        </p>

        <p className="mt-8 text-[11.5px] font-semibold tracking-[0.12em] text-faint uppercase">
          Elige una sección para empezar
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {sections.map(({ stage, icon: Icon, title, detail }) => {
            const selected = startSection === stage;
            return (
              <button
                key={stage}
                type="button"
                onClick={() => onSelectStart(stage)}
                aria-pressed={selected}
                className={`focus-ring group flex items-center gap-4 rounded-2xl border p-4 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl transition ${
                  selected
                    ? "border-[#a9c8f2] bg-[linear-gradient(140deg,rgba(238,245,255,0.96)_0%,rgba(255,255,255,0.72)_100%)] shadow-[0_18px_38px_-30px_rgba(47,107,255,0.8),inset_0_1px_0_rgba(255,255,255,1)]"
                    : "border-white/80 bg-white/50 hover:border-white hover:bg-white/75"
                }`}
              >
                <div
                  className={`flex size-10 shrink-0 items-center justify-center rounded-xl border border-white/80 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${
                    selected ? "bg-white text-accent" : "bg-white/60 text-accent"
                  }`}
                >
                  <Icon className="size-4.5" strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13.5px] font-semibold">{title}</p>
                  <p className="text-[12px] text-muted">{detail}</p>
                </div>
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
                    selected
                      ? "border-accent bg-accent text-white shadow-[0_4px_10px_-4px_rgba(47,107,255,0.7)]"
                      : "border-white bg-white/70 text-transparent"
                  }`}
                  aria-hidden
                >
                  <CheckCircle2 className="size-3.5" strokeWidth={2.5} />
                </span>
              </button>
            );
          })}
        </div>

        {error && (
          <div className="mt-6">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}
        {expired && (
          <div className="mt-6">
            <Notice tone="warning">
              El tiempo del examen ha terminado. Puedes enviar lo que llevas respondido; las
              secciones incompletas puntuarán como cero.
            </Notice>
          </div>
        )}
        {submitError && (
          <div className="mt-6">
            <Notice tone="danger">{submitError}</Notice>
          </div>
        )}
        {!loading && !error && bundle && bundle.questions.length === 0 && (
          <div className="mt-6">
            <Notice tone="warning">
              Este nivel todavía no tiene preguntas cargadas. Puedes continuar, pero la sección de
              vocabulario y gramática quedará vacía.
            </Notice>
          </div>
        )}

        <div className="mt-8 flex flex-wrap items-center gap-3">
          {expired ? (
            <Button
              size="lg"
              onClick={onSubmit}
              loading={submitting}
              icon={<ArrowRight className="size-4" />}
            >
              Enviar examen
            </Button>
          ) : (
            <Button size="lg" onClick={onStart} disabled={loading} icon={<ArrowRight className="size-4" />}>
              {loading
                ? "Preparando el examen…"
                : `Comenzar por ${selectedSection.title}`}
            </Button>
          )}
          {error && (
            <Button variant="secondary" size="lg" onClick={onRetry} icon={<RotateCcw className="size-4" />}>
              Reintentar
            </Button>
          )}
        </div>

        {draftCode && (
          <p className="mt-3 text-[11.5px] text-muted">
            Tu borrador está guardado en el servidor. Código:{" "}
            <span className="font-mono font-semibold tracking-[0.06em]">{draftCode}</span>
          </p>
        )}

        <div className="mt-5">
          {remainingSeconds === null && (
          <p className="mt-3 text-[11.5px] text-faint">
            Puedes cambiar de sección en cualquier momento desde la cabecera del examen.
          </p>
        )}

        {!resumeOpen ? (
            <button
              type="button"
              onClick={() => setResumeOpen(true)}
              className="text-[12px] font-medium text-accent-ink underline-offset-2 hover:underline"
            >
              ¿Empezaste en otro dispositivo? Continúa aquí
            </button>
          ) : (
            <div className="premium-panel max-w-md rounded-2xl p-4">
              <p className="text-[12.5px] font-medium">Continuar un examen empezado</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
                Introduce el código del borrador y el correo con el que te registraste.
              </p>
              {resumeError && (
                <div className="mt-3">
                  <Notice tone="danger">{resumeError}</Notice>
                </div>
              )}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  className="field font-mono uppercase"
                  placeholder="Código (8)"
                  maxLength={8}
                  value={resumeCode}
                  onChange={(event) =>
                    setResumeCode(event.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase())
                  }
                />
                <input
                  type="email"
                  className="field"
                  placeholder="Correo electrónico"
                  value={resumeEmail}
                  onChange={(event) => setResumeEmail(event.target.value)}
                />
              </div>
              <div className="mt-2 flex items-center gap-2">
                <Button
                  onClick={() => onResume(resumeCode, resumeEmail)}
                  loading={draftBusy}
                  disabled={resumeCode.length !== 8 || !resumeEmail.includes("@")}
                >
                  Continuar
                </Button>
                <button
                  type="button"
                  onClick={() => setResumeOpen(false)}
                  className="text-[12px] text-muted hover:text-ink"
                >
                  Cancelar
                </button>
              </div>
            </div>
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
    <div className="app-page min-h-dvh">
      <SiteHeader
        width="4xl"
        right={
          <Link to="/cuenta" className="text-[12px] font-medium text-muted transition hover:text-ink">
            Mi panel
          </Link>
        }
      />
      <main className="flex min-h-[calc(100dvh-6rem)] items-center justify-center px-5 py-12">
      <div className="anim-rise card w-full max-w-lg p-8 text-center sm:p-10">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-white bg-[#eef8f1] text-success shadow-[0_14px_30px_-22px_rgba(22,132,90,0.7)]">
          <CheckCircle2 className="size-7" strokeWidth={1.8} />
        </div>
        <h1 className="mt-5 text-[28px] font-semibold tracking-[-0.03em]">Examen enviado</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          Gracias, {candidate.firstName}. Hemos recibido tus respuestas de nivel {level} y el equipo
          evaluador las revisará en breve.
        </p>

        <div className="mt-6 rounded-2xl border border-white/85 bg-white/55 px-5 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-md">
          <p className="text-[10.5px] font-medium tracking-[0.1em] text-faint uppercase">Referencia</p>
          <p className="mt-1 font-mono text-[16px] font-semibold tracking-[0.06em]">{code ?? "—"}</p>
          <p className="mt-2 text-[11.5px] text-faint">Guarda este código por si necesitas consultarlo.</p>
        </div>

        <div className="mt-4 flex flex-wrap justify-center gap-2 text-[11.5px] text-muted">
          {SECTION_LABELS.map((label) => (
            <span
              key={label}
              className="rounded-full border border-white/80 bg-white/55 px-2.5 py-1 text-[10.5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
            >
              {label} ✓
            </span>
          ))}
        </div>

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          <Link to="/resultado">
            <Button size="lg">Consultar mi resultado</Button>
          </Link>
          <Link to="/">
            <Button variant="secondary" size="lg">
              Volver al inicio
            </Button>
          </Link>
        </div>
      </div>
      </main>
    </div>
  );
}
