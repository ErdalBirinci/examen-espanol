import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { SectionEmpty, StepFooter, StepHeader } from "./Shell";
import type { QuestionPublic } from "../lib/types";
import { cn } from "../lib/utils";

const LETTERS = ["A", "B", "C", "D", "E", "F"];

export default function TestStep({
  questions,
  answers,
  onSelect,
  onNext,
  onBack,
}: {
  questions: QuestionPublic[];
  answers: Record<string, number>;
  onSelect: (questionId: string, optionIndex: number) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [current, setCurrent] = useState(0);

  const answeredCount = useMemo(
    () => questions.filter((question) => answers[question.id] !== undefined).length,
    [questions, answers],
  );

  if (questions.length === 0) {
    return (
      <div>
        <StepHeader
          index={1}
          title="Vocabulario y Gramática"
          description="Preguntas de gramática, vocabulario y uso de la lengua."
        />
        <SectionEmpty message="El administrador aún no ha cargado preguntas para este nivel." />
        <StepFooter onBack={onBack} onNext={onNext} nextLabel="Continuar" />
      </div>
    );
  }

  const question = questions[current];
  const selected = answers[question.id];
  const isLast = current === questions.length - 1;

  return (
    <div>
      <StepHeader
        index={1}
        title="Vocabulario y Gramática"
        description="Elige la opción correcta en cada pregunta. Puedes volver atrás y cambiar tus respuestas."
        aside={
          <div className="glass-inset rounded-2xl px-4 py-2.5 text-center">
            <p className="text-[10.5px] font-medium tracking-[0.08em] text-faint uppercase">Respondidas</p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums">
              {answeredCount}
              <span className="text-[13px] font-normal text-faint"> / {questions.length}</span>
            </p>
          </div>
        }
      />

      <div
        key={question.id}
        className="anim-rise card overflow-hidden"
      >
        <div className="border-b border-white/70 bg-white/25 px-6 py-4 sm:px-8">
          <div className="flex items-center justify-between text-[11.5px] font-medium text-muted">
            <span className="tabular-nums">
              Pregunta {String(current + 1).padStart(2, "0")} / {questions.length}
            </span>
            <span>{Math.round((answeredCount / questions.length) * 100)}% completado</span>
          </div>
          <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-[#e4eaf3]/80">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#2f6bff,#8fb3ff)] transition-all duration-500"
              style={{ width: `${(answeredCount / questions.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="px-6 py-7 sm:px-8 sm:py-9">
          <p className="text-[19px] leading-relaxed font-medium tracking-[-0.015em] sm:text-[22px]">
            {question.prompt}
          </p>

          <div className="mt-6 space-y-2.5" role="radiogroup" aria-label="Opciones">
            {question.options.map((option, optionIndex) => {
              const active = selected === optionIndex;
              return (
                <button
                  key={optionIndex}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onSelect(question.id, optionIndex)}
                  className={cn(
                    "focus-ring group flex w-full items-center gap-3.5 rounded-2xl border px-4 py-3.5 text-left transition-all duration-150",
                    active
                      ? "border-[#a9c8f2] bg-[linear-gradient(140deg,rgba(238,245,255,0.96),rgba(255,255,255,0.75))] shadow-[inset_0_0_0_1px_rgba(47,107,255,0.18),0_12px_28px_-24px_rgba(47,107,255,0.7)]"
                      : "border-white/80 bg-white/45 hover:border-white hover:bg-white/75",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold transition",
                      active
                        ? "bg-accent text-white shadow-[0_5px_12px_-6px_rgba(47,107,255,0.8)]"
                        : "bg-white/70 text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] group-hover:bg-white",
                    )}
                  >
                    {active ? <Check className="size-3.5" strokeWidth={3} /> : LETTERS[optionIndex]}
                  </span>
                  <span className="text-[14.5px] leading-snug">{option}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-white/70 bg-white/30 px-6 py-3.5 sm:px-8">
          <button
            type="button"
            onClick={() => setCurrent((index) => Math.max(0, index - 1))}
            disabled={current === 0}
            className="focus-ring rounded-full px-3 py-1.5 text-[12.5px] font-medium text-muted transition hover:bg-white/70 hover:text-ink disabled:opacity-40"
          >
            ← Pregunta anterior
          </button>

          <div className="hidden max-w-[50%] flex-wrap justify-center gap-1.5 sm:flex">
            {questions.map((item, index) => {
              const answered = answers[item.id] !== undefined;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCurrent(index)}
                  aria-label={`Ir a la pregunta ${index + 1}`}
                  className={cn(
                    "size-5 rounded-[6px] text-[9.5px] font-semibold transition",
                    index === current
                      ? "bg-[linear-gradient(135deg,#16243d,#2b4a7d)] text-white shadow-[0_4px_10px_-6px_rgba(18,35,62,0.8)]"
                      : answered
                        ? "bg-accent/15 text-accent-ink"
                        : "bg-white/55 text-faint hover:bg-white/80",
                  )}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => (isLast ? onNext() : setCurrent((index) => index + 1))}
            className="focus-ring rounded-full px-3 py-1.5 text-[12.5px] font-medium text-ink transition hover:bg-white/70"
          >
            {isLast ? "Continuar →" : "Siguiente pregunta →"}
          </button>
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        nextLabel="Ir a comprensión auditiva"
        hint={`${answeredCount} de ${questions.length} respondidas`}
      />
    </div>
  );
}
