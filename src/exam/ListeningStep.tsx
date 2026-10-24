import { Check, Headphones } from "lucide-react";
import { SectionEmpty, StepFooter, StepHeader } from "./Shell";
import AudioPlayer from "./AudioPlayer";
import { listeningAudioUrl } from "../lib/api";
import type { ListeningExam } from "../lib/types";
import { cn } from "../lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function ListeningStep({
  listening,
  answers,
  onChange,
  onNext,
  onBack,
  plays,
  onPlay,
}: {
  listening: ListeningExam | null;
  answers: Record<string, number>;
  onChange: (questionId: string, optionIndex: number) => void;
  onNext: () => void;
  onBack: () => void;
  plays: number;
  onPlay: () => void;
}) {
  if (!listening || listening.questions.length === 0) {
    return (
      <div>
        <StepHeader
          index={2}
          title="Comprensión Auditiva"
          description="Escucha los diálogos y elige la respuesta de la mujer en cada uno."
        />
        <SectionEmpty
          message={
            listening
              ? "El administrador todavía no ha cargado las preguntas de esta grabación."
              : "El administrador aún no ha cargado audios para este nivel."
          }
        />
        <StepFooter onBack={onBack} onNext={onNext} nextLabel="Continuar" />
      </div>
    );
  }

  const { item, questions } = listening;
  const answeredCount = questions.filter((entry) => answers[entry.id] !== undefined).length;

  return (
    <div>
      <StepHeader
        index={2}
        title="Comprensión Auditiva"
        description="Escucha los diálogos y elige la respuesta de la mujer en cada uno. Puedes cambiar tus respuestas cuando quieras."
        aside={
          <div className="glass-inset flex items-center gap-2 rounded-2xl px-4 py-2.5 text-[12px] text-muted">
            <Headphones className="size-4 text-accent" />
            <span className="tabular-nums">
              {answeredCount} / {questions.length} respondidas
            </span>
          </div>
        }
      />

      <div className="anim-rise card overflow-hidden" key={item.id}>
        <div className="border-b border-white/70 bg-[linear-gradient(135deg,rgba(243,248,255,0.8),rgba(255,255,255,0.35))] px-5 py-5 sm:px-8">
          <p className="text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
            Escucha y elige la opción correcta
          </p>
          <h2 className="mt-1.5 text-[19px] font-semibold tracking-[-0.02em] sm:text-[20px]">
            {item.title}
          </h2>
          <div className="mt-4">
            <AudioPlayer
              src={listeningAudioUrl(item.audio_path)}
              plays={plays}
              maxPlays={item.max_plays}
              onPlay={onPlay}
            />
          </div>
        </div>

        <ol className="space-y-3 px-4 py-5 sm:px-8 sm:py-6">
          {questions.map((question, rowIndex) => {
            const selected = answers[question.id];
            const answered = selected !== undefined;
            return (
              <li
                key={question.id}
                className="rounded-2xl border border-line/80 bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
              >
                <div className="flex items-start gap-2.5">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[#f3f3f6] text-[11px] font-semibold text-muted tabular-nums">
                    {rowIndex + 1}
                  </span>
                  <p
                    className={cn(
                      "text-[14px] leading-relaxed",
                      answered ? "font-medium text-ink" : "text-muted",
                    )}
                  >
                    {question.prompt}
                  </p>
                </div>

                <div
                  role="radiogroup"
                  aria-label={`Pregunta ${rowIndex + 1}`}
                  className="mt-3 space-y-1.5 pl-0 sm:pl-8"
                >
                  {question.options.map((option, optionIndex) => {
                    const active = selected === optionIndex;
                    return (
                      <button
                        key={optionIndex}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => onChange(question.id, optionIndex)}
                        className={cn(
                          "focus-ring flex w-full items-start gap-2.5 rounded-xl border px-3 py-2 text-left transition",
                          active
                            ? "border-[#b9d0f5] bg-[linear-gradient(135deg,rgba(238,245,255,0.95),rgba(255,255,255,0.7))] shadow-[0_10px_24px_-22px_rgba(47,107,255,0.9)]"
                            : "border-line/70 bg-white/45 hover:border-[#d9e2f0] hover:bg-white/80",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition",
                            active
                              ? "border-accent bg-accent text-white"
                              : "border-[#c9d3e2] bg-white/80 text-faint",
                          )}
                          aria-hidden
                        >
                          {active ? (
                            <Check className="size-3" strokeWidth={3.5} />
                          ) : (
                            LETTERS[optionIndex]
                          )}
                        </span>
                        <span className="text-[12.5px] leading-snug">{option}</span>
                      </button>
                    );
                  })}
                </div>
              </li>
            );
          })}
        </ol>

        <div className="border-t border-white/70 bg-white/30 px-6 py-4 sm:px-8">
          <div className="flex items-center justify-between text-[11.5px] font-medium text-muted">
            <span className="tabular-nums">
              {answeredCount} / {questions.length} respondidas
            </span>
            <span className="tabular-nums">
              {Math.round((answeredCount / questions.length) * 100)}% completado
            </span>
          </div>
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-[#e4eaf3]/80">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#2f6bff,#8fb3ff)] transition-all duration-500"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        nextLabel="Ir a expresión escrita"
        hint={`${answeredCount} de ${questions.length} diálogos respondidos`}
      />
    </div>
  );
}
