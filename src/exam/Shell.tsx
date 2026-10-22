import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "../lib/utils";
import type { Level } from "../lib/types";

export const SECTION_LABELS = [
  "Vocabulario y Gramática",
  "Comprensión Auditiva",
  "Expresión Escrita",
  "Oral",
];

export function ExamShell({
  level,
  activeIndex,
  children,
}: {
  level: Level;
  activeIndex: number;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(100%_60%_at_50%_-20%,#edf4ff_0%,#fbfbfd_55%)]">
      <header className="sticky top-0 z-30 border-b border-[rgba(29,29,31,0.06)] glass-bar">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between gap-4 px-5 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex items-baseline gap-1.5">
              <span className="text-[14.5px] font-semibold tracking-[-0.02em]">Examen</span>
              <span className="font-display text-[17.5px] italic text-accent-ink">de Español</span>
            </div>
            <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">
              {level}
            </span>
          </div>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Progreso del examen">
            {SECTION_LABELS.map((label, index) => {
              const done = index < activeIndex;
              const active = index === activeIndex;
              return (
                <div key={label} className="flex items-center gap-1">
                  <span
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-medium whitespace-nowrap transition",
                      active && "bg-ink text-white",
                      done && "text-success",
                      !active && !done && "text-faint",
                    )}
                  >
                    {done ? (
                      <Check className="size-3" strokeWidth={3} />
                    ) : (
                      <span className="text-[10px] tabular-nums">{index + 1}</span>
                    )}
                    {label}
                  </span>
                </div>
              );
            })}
          </nav>

          <span className="text-[11.5px] font-medium text-muted lg:hidden">
            {Math.min(activeIndex + 1, SECTION_LABELS.length)} / {SECTION_LABELS.length}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 pb-24 sm:px-8 sm:py-12">{children}</main>
    </div>
  );
}

export function StepHeader({
  index,
  title,
  description,
  aside,
}: {
  index: number;
  title: string;
  description: string;
  aside?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="anim-rise">
        <p className="text-[11.5px] font-semibold tracking-[0.12em] text-faint uppercase">
          Sección {index} de 4
        </p>
        <h1 className="mt-2 text-[28px] leading-tight font-semibold tracking-[-0.03em] sm:text-[34px]">
          {title}
        </h1>
        <p className="mt-2 max-w-xl text-[14px] leading-relaxed text-muted">{description}</p>
      </div>
      {aside}
    </div>
  );
}

export function StepFooter({
  onBack,
  onNext,
  nextLabel = "Siguiente",
  backLabel = "Anterior",
  nextDisabled,
  hint,
  loading,
}: {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  backLabel?: string;
  nextDisabled?: boolean;
  hint?: ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-6">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="focus-ring rounded-xl px-3 py-2 text-[13px] font-medium text-muted transition hover:bg-[#f2f2f5] hover:text-ink"
        >
          ← {backLabel}
        </button>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-3">
        {hint && <span className="text-[12px] text-faint">{hint}</span>}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
          className="focus-ring inline-flex h-12 items-center gap-2 rounded-2xl bg-ink px-6 text-[14px] font-medium text-white transition hover:bg-black active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#c9c9cf] disabled:active:scale-100"
        >
          {loading ? (
            <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          ) : null}
          {nextLabel}
        </button>
      </div>
    </div>
  );
}

export function SectionEmpty({ message }: { message: string }) {
  return (
    <div className="card flex flex-col items-center px-6 py-14 text-center">
      <p className="text-[14.5px] font-medium">Esta sección todavía no está disponible</p>
      <p className="mt-1.5 max-w-sm text-[13px] leading-relaxed text-muted">{message}</p>
    </div>
  );
}
