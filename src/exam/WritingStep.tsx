import { PenLine } from "lucide-react";
import { SectionEmpty, StepFooter, StepHeader } from "./Shell";
import { promptImageUrl } from "../lib/api";
import type { WritingPrompt } from "../lib/types";
import { cn, wordCount } from "../lib/utils";

export default function WritingStep({
  prompts,
  value1,
  value2,
  onChange,
  onNext,
  onBack,
}: {
  prompts: WritingPrompt[];
  value1: string;
  value2: string;
  onChange: (part: 1 | 2, text: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  if (prompts.length === 0) {
    return (
      <div>
        <StepHeader
          index={3}
          title="Expresión Escrita"
          description="Escribe dos textos sobre los temas propuestos."
        />
        <SectionEmpty message="El administrador aún no ha definido los temas de escritura para este nivel." />
        <StepFooter onBack={onBack} onNext={onNext} nextLabel="Continuar" />
      </div>
    );
  }

  const ordered = [...prompts].sort((a, b) => a.part - b.part);
  const first = ordered.find((prompt) => prompt.part === 1) ?? ordered[0];
  const second = ordered.find((prompt) => prompt.part === 2) ?? ordered[1] ?? null;
  const words1 = wordCount(value1);
  const words2 = wordCount(value2);

  return (
    <div>
      <StepHeader
        index={3}
        title="Expresión Escrita"
        description="La sección tiene dos tareas independientes. Cada una vale 10 puntos; escribe con tus propias palabras."
        aside={
          <div className="glass-inset rounded-2xl px-4 py-2.5 text-center">
            <p className="text-[10.5px] font-medium tracking-[0.08em] text-faint uppercase">
              Palabras
            </p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums">
              {words1 + words2}
              <span className="text-[13px] font-normal text-faint">
                {" "}
                / mín. {first.min_words + (second?.min_words ?? 0)}
              </span>
            </p>
          </div>
        }
      />

      <div className="space-y-4">
        {[first, second]
          .filter((prompt): prompt is WritingPrompt => Boolean(prompt))
          .map((prompt) => {
            const value = prompt.part === 1 ? value1 : value2;
            const words = prompt.part === 1 ? words1 : words2;
            const enough = words >= prompt.min_words;
            const inputId = `writing-text-${prompt.part}`;
            return (
              <div className="anim-rise card overflow-hidden" key={prompt.id}>
                <div className="border-b border-white/70 bg-[linear-gradient(135deg,rgba(243,248,255,0.8),rgba(255,255,255,0.35))] px-6 py-5 sm:px-8">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.1em] text-accent-ink uppercase">
                      <PenLine className="size-3.5" />
                      Tarea {prompt.part} de {ordered.length} · 10 puntos
                    </div>
                    <span className="text-[11px] text-faint tabular-nums">
                      {words} / mín. {prompt.min_words} palabras
                    </span>
                  </div>
                  <p className="mt-2.5 text-[16.5px] leading-relaxed font-medium tracking-[-0.015em] sm:text-[18px] whitespace-pre-line">
                    {prompt.prompt}
                  </p>
                  {prompt.image_path && (
                    <img
                      src={promptImageUrl(prompt.image_path)}
                      alt={`Tarea ${prompt.part}`}
                      className="mt-3 w-full max-w-lg rounded-xl border border-line bg-white object-contain shadow-sm"
                    />
                  )}
                </div>

                <div className="px-6 py-5 sm:px-8">
                  <label
                    htmlFor={inputId}
                    className="mb-2 block text-[12.5px] font-medium text-muted"
                  >
                    Tu respuesta
                  </label>
                  <textarea
                    id={inputId}
                    className="field min-h-[220px] resize-y text-[15px] leading-[1.7]"
                    placeholder={
                      prompt.part === 1
                        ? "Escribe aquí tu primer texto…"
                        : "Escribe aquí tu segundo texto…"
                    }
                    value={value}
                    onChange={(event) => onChange(prompt.part, event.target.value)}
                    spellCheck
                  />
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11.5px]">
                    <span className="text-faint">
                      Organiza el texto en introducción, desarrollo y conclusión.
                    </span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-medium",
                        enough
                          ? "border border-[#d6ecdf] bg-[#eef8f1]/85 text-success"
                          : "border border-[#f1e0c5] bg-[#fdf4e7]/85 text-warning",
                      )}
                    >
                      {enough
                        ? "Extensión suficiente"
                        : `Faltan ${prompt.min_words - words} palabras`}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
      </div>

      {!second && (
        <p className="mt-4 rounded-xl border border-[#f1e0c5] bg-[#fdf8ec]/80 px-4 py-3 text-[11.5px] leading-relaxed text-warning">
          El administrador todavía no ha definido la segunda tarea de escritura para este nivel. Solo
          se evaluará la primera.
        </p>
      )}

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        nextLabel="Ir a expresión oral"
        hint={value1.trim() || value2.trim() ? "Textos guardados" : "Aún no has escrito nada"}
      />
    </div>
  );
}
