import { Check, Headphones } from "lucide-react";
import { SectionEmpty, StepFooter, StepHeader } from "./Shell";
import AudioPlayer from "./AudioPlayer";
import { listeningAudioUrl } from "../lib/api";
import type { ListeningExam } from "../lib/types";
import { cn } from "../lib/utils";

/** Shared answer bank, in the order the administrator entered it. */
function columnBank(listening: ListeningExam): string[] {
  const bank: string[] = [];
  for (const question of listening.questions) {
    for (const option of question.options) {
      if (option.trim() && !bank.includes(option)) bank.push(option);
    }
  }
  return bank;
}

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
          description="Escucha la grabación y elige la opción correcta para cada frase."
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
  const bank = columnBank(listening);
  const answeredCount = questions.filter((entry) => answers[entry.id] !== undefined).length;

  return (
    <div>
      <StepHeader
        index={2}
        title="Comprensión Auditiva"
        description="Escucha la grabación y elige la opción correcta en cada frase. Puedes cambiar tus respuestas cuando quieras."
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

        <div className="overflow-x-auto px-2 py-4 sm:px-6 sm:py-6">
          <table className="w-full min-w-[620px] border-separate border-spacing-0">
            <thead>
              <tr>
                <th scope="col" className="w-[42%] px-2 pb-3 text-left align-bottom">
                  <span className="text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase">
                    Frase
                  </span>
                </th>
                {bank.map((option) => (
                  <th
                    key={option}
                    scope="col"
                    className="max-w-[120px] px-1.5 pb-3 text-center align-bottom text-[11.5px] leading-tight font-medium text-muted"
                  >
                    {option}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {questions.map((question, rowIndex) => {
                const selected = answers[question.id];
                const answered = selected !== undefined;
                return (
                  <tr key={question.id} className={rowIndex % 2 === 1 ? "bg-white/25" : undefined}>
                    <th
                      scope="row"
                      className={cn(
                        "sticky left-0 z-10 px-2 py-3 text-left align-middle text-[13px] leading-snug font-normal sm:static sm:bg-transparent",
                        rowIndex % 2 === 1 ? "bg-[#fbfcff]" : "bg-white",
                      )}
                    >
                      <span className="mr-1.5 text-[11px] text-faint tabular-nums">
                        {String(rowIndex + 1).padStart(2, "0")}
                      </span>
                      <span className={answered ? "text-ink" : "text-muted"}>{question.prompt}</span>
                    </th>

                    {bank.map((option) => {
                      const optionIndex = question.options.indexOf(option);
                      const available = optionIndex >= 0;
                      const active = available && selected === optionIndex;
                      return (
                        <td key={option} className="px-1.5 py-3 text-center align-middle">
                          {available ? (
                            <button
                              type="button"
                              role="radio"
                              aria-checked={active}
                              aria-label={`${question.prompt} — ${option}`}
                              onClick={() => onChange(question.id, optionIndex)}
                              className="focus-ring group mx-auto flex size-8 items-center justify-center rounded-full"
                            >
                              <span
                                className={cn(
                                  "flex size-[22px] items-center justify-center rounded-full border-2 transition-all duration-150",
                                  active
                                    ? "border-accent bg-accent text-white shadow-[0_6px_14px_-8px_rgba(47,107,255,0.9)]"
                                    : "border-[#c9d3e2] bg-white/70 group-hover:border-accent/60 group-hover:bg-white",
                                )}
                              >
                                {active && <Check className="size-3" strokeWidth={3.5} />}
                              </span>
                            </button>
                          ) : (
                            <span aria-hidden className="text-[11px] text-[#d7dde8]">
                              —
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="px-5 pb-1 text-[11px] text-faint sm:hidden">
          Desliza la tabla hacia los lados para ver todas las opciones.
        </p>

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
        hint={`${answeredCount} de ${questions.length} frases respondidas`}
      />
    </div>
  );
}
