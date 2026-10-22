import { CheckCircle2, CircleAlert, Headphones, ListChecks, Mic, PenLine } from "lucide-react";
import { Notice } from "../components/ui";
import { cn } from "../lib/utils";
import type { Candidate, Level } from "../lib/types";

export default function ReviewStep({
  candidate,
  level,
  answered,
  totalQuestions,
  transcribed,
  totalListening,
  writingWords,
  minWords,
  hasRecording,
  submitting,
  error,
  onSubmit,
  onBack,
}: {
  candidate: Candidate;
  level: Level;
  answered: number;
  totalQuestions: number;
  transcribed: number;
  totalListening: number;
  writingWords: number;
  minWords: number | null;
  hasRecording: boolean;
  submitting: boolean;
  error: string | null;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const warnings: string[] = [];
  if (totalQuestions > 0 && answered < totalQuestions) {
    warnings.push(`${totalQuestions - answered} pregunta(s) de vocabulario y gramática sin responder.`);
  }
  if (totalListening > 0 && transcribed < totalListening) {
    warnings.push(`${totalListening - transcribed} pista(s) de comprensión auditiva sin transcribir.`);
  }
  if (minWords !== null && writingWords < minWords) {
    warnings.push(`La expresión escrita tiene ${writingWords} palabras (mínimo ${minWords}).`);
  }
  if (!hasRecording) {
    warnings.push("No has adjuntado ninguna grabación para la expresión oral.");
  }

  return (
    <div>
      <div className="anim-rise">
        <p className="text-[11.5px] font-semibold tracking-[0.12em] text-faint uppercase">
          Antes de enviar
        </p>
        <h1 className="mt-2 text-[30px] leading-tight font-semibold tracking-[-0.03em] sm:text-[38px]">
          Revisa tu examen
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">
          {candidate.firstName}, comprueba que todo está completo. Cuando envíes, ya no podrás
          modificar tus respuestas.
        </p>
      </div>

      <div className="anim-rise mt-7 card divide-y divide-[#f1f1f4]">
        <ReviewRow
          icon={ListChecks}
          title="Vocabulario y Gramática"
          detail={`${answered} de ${totalQuestions} preguntas respondidas`}
          done={totalQuestions > 0 && answered === totalQuestions}
          empty={totalQuestions === 0}
        />
        <ReviewRow
          icon={Headphones}
          title="Comprensión Auditiva"
          detail={
            totalListening === 0
              ? "Esta sección aún no está disponible"
              : `${transcribed} de ${totalListening} pistas transcritas`
          }
          done={totalListening === 0 || transcribed === totalListening}
          empty={totalListening === 0}
        />
        <ReviewRow
          icon={PenLine}
          title="Expresión Escrita"
          detail={`${writingWords} palabras escritas${
            minWords !== null ? ` · mínimo ${minWords}` : ""
          }`}
          done={writingWords > 0}
          empty={writingWords === 0}
        />
        <ReviewRow
          icon={Mic}
          title="Expresión Oral"
          detail={hasRecording ? "Grabación adjunta y lista para enviar" : "Sin grabación"}
          done={hasRecording}
          empty={!hasRecording}
        />
      </div>

      {warnings.length > 0 && (
        <div className="mt-4">
          <Notice tone="warning">
            <p className="font-medium">Todavía quedan cosas pendientes:</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {warnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <p className="mt-1.5">Puedes enviar así, pero las secciones vacías puntuarán como cero.</p>
          </Notice>
        </div>
      )}

      {error && (
        <div className="mt-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="focus-ring rounded-xl px-3 py-2 text-[13px] font-medium text-muted transition hover:bg-[#f2f2f5] hover:text-ink disabled:opacity-50"
        >
          ← Volver a la expresión oral
        </button>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-faint">Nivel {level}</span>
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitting}
            className="focus-ring inline-flex h-12 items-center gap-2 rounded-2xl bg-ink px-7 text-[14px] font-medium text-white transition hover:bg-black active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#c9c9cf]"
          >
            {submitting && (
              <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
            )}
            Enviar examen definitivamente
          </button>
        </div>
      </div>
    </div>
  );
}

function ReviewRow({
  icon: Icon,
  title,
  detail,
  done,
  empty,
}: {
  icon: typeof ListChecks;
  title: string;
  detail: string;
  done: boolean;
  empty: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5 px-5 py-4 sm:px-6">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f3f3f6] text-muted">
        <Icon className="size-4" strokeWidth={1.9} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-medium">{title}</p>
        <p className="text-[12px] text-muted">{detail}</p>
      </div>
      {empty ? (
        <CircleAlert className="size-4.5 shrink-0 text-warning" />
      ) : (
        <CheckCircle2
          className={cn("size-4.5 shrink-0", done ? "text-success" : "text-warning")}
        />
      )}
    </div>
  );
}
