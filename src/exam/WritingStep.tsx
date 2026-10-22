import { PenLine } from "lucide-react";
import { SectionEmpty, StepFooter, StepHeader } from "./Shell";
import type { WritingPrompt } from "../lib/types";
import { cn, wordCount } from "../lib/utils";

export default function WritingStep({
  prompt,
  value,
  onChange,
  onNext,
  onBack,
}: {
  prompt: WritingPrompt | null;
  value: string;
  onChange: (text: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  if (!prompt) {
    return (
      <div>
        <StepHeader
          index={3}
          title="Escritura"
          description="Escribe una composición sobre el tema propuesto."
        />
        <SectionEmpty message="El administrador aún no ha definido un tema de escritura para este nivel." />
        <StepFooter onBack={onBack} onNext={onNext} nextLabel="Continuar" />
      </div>
    );
  }

  const words = wordCount(value);
  const enough = words >= prompt.min_words;

  return (
    <div>
      <StepHeader
        index={3}
        title="Escritura"
        description="Responde con tus propias palabras. No hay respuestas correctas o incorrectas: valoramos claridad y riqueza."
        aside={
          <div className="rounded-2xl border border-line bg-white px-4 py-2.5 text-center">
            <p className="text-[10.5px] font-medium tracking-[0.08em] text-faint uppercase">Palabras</p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums">
              {words}
              <span className="text-[13px] font-normal text-faint"> / mín. {prompt.min_words}</span>
            </p>
          </div>
        }
      />

      <div className="anim-rise card overflow-hidden">
        <div className="border-b border-line bg-gradient-to-br from-[#f4f9ff] to-white px-6 py-6 sm:px-8">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.1em] text-accent-ink uppercase">
            <PenLine className="size-3.5" />
            Tema propuesto
          </div>
          <p className="mt-2.5 text-[17px] leading-relaxed font-medium tracking-[-0.015em] sm:text-[19px]">
            {prompt.prompt}
          </p>
        </div>

        <div className="px-6 py-6 sm:px-8">
          <label htmlFor="writing-text" className="mb-2 block text-[12.5px] font-medium text-muted">
            Tu respuesta
          </label>
          <textarea
            id="writing-text"
            className="field min-h-[320px] resize-y text-[15px] leading-[1.7]"
            placeholder="Escribe aquí tu composición…"
            value={value}
            onChange={(event) => onChange(event.target.value)}
            spellCheck
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
            <span className="text-faint">
              Consejo: organiza tu texto en introducción, desarrollo y conclusión.
            </span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 font-medium",
                enough ? "bg-[#eef8f1] text-success" : "bg-[#fdf4e7] text-warning",
              )}
            >
              {enough ? "Extensión suficiente" : `Faltan ${prompt.min_words - words} palabras`}
            </span>
          </div>
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        nextLabel="Ir a la expresión oral"
        hint={value.trim() ? "Texto guardado" : "Aún no has escrito nada"}
      />
    </div>
  );
}
