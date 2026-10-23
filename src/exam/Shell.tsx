import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Check, Clock3 } from "lucide-react";
import { cn, formatSeconds } from "../lib/utils";
import type { Level } from "../lib/types";
import { Brand } from "../components/Brand";

export const SECTION_LABELS = [
  "Vocabulario y Gramática",
  "Comprensión Auditiva",
  "Expresión Escrita",
  "Oral",
];

export const SECTION_SHORT_LABELS = ["Gramática", "Auditiva", "Escrita", "Oral"];

export type SectionStage = "test" | "listening" | "writing" | "speaking";

export const SECTION_STAGES: SectionStage[] = ["test", "listening", "writing", "speaking"];

export function ExamShell({
  level,
  activeIndex,
  remainingSeconds,
  onSelectSection,
  children,
}: {
  level: Level;
  activeIndex: number;
  remainingSeconds?: number;
  onSelectSection?: (index: number) => void;
  children: ReactNode;
}) {
  return (
    <div className="app-page min-h-dvh">
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4">
        <div className="premium-nav mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-3.5 sm:px-4">
          <div className="flex shrink-0 items-center gap-2.5">
            <Link to="/cuenta" className="focus-ring -m-1 rounded-full p-1" aria-label="Mi panel">
              <Brand compact />
            </Link>
            <span className="hidden rounded-full border border-white/80 bg-white/60 px-2.5 py-1 text-[10.5px] font-semibold tracking-[0.04em] text-muted sm:inline-flex">
              Nivel {level}
            </span>
          </div>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Secciones del examen">
            {SECTION_LABELS.map((label, index) => {
              const active = index === activeIndex;
              const classes = cn(
                "focus-ring flex items-center gap-1.5 rounded-full px-3 py-2 text-[11.5px] font-medium whitespace-nowrap transition",
                active &&
                  "bg-[linear-gradient(135deg,#16243d_0%,#2b4a7d_100%)] text-white shadow-[0_8px_20px_-14px_rgba(18,35,62,0.8)]",
                !active && onSelectSection && "text-muted hover:bg-white/70 hover:text-ink",
                !active && !onSelectSection && "text-faint",
              );
              const content = (
                <>
                  <span className={cn("text-[9.5px] tabular-nums", active ? "text-white/60" : "text-faint")}>
                    0{index + 1}
                  </span>
                  {label}
                  {active && <Check className="size-3" strokeWidth={3} />}
                </>
              );
              return onSelectSection ? (
                <button
                  key={label}
                  type="button"
                  onClick={() => onSelectSection(index)}
                  aria-current={active ? "step" : undefined}
                  className={classes}
                >
                  {content}
                </button>
              ) : (
                <span key={label} className={classes} aria-current={active ? "step" : undefined}>
                  {content}
                </span>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2.5">
            {remainingSeconds !== undefined && <ExamTimer seconds={remainingSeconds} />}
            <span className="text-[11px] font-semibold text-muted tabular-nums lg:hidden">
              {Math.min(activeIndex + 1, SECTION_LABELS.length)} / {SECTION_LABELS.length}
            </span>
          </div>
        </div>

        {onSelectSection && (
          <div className="premium-nav mx-auto mt-2 flex max-w-6xl gap-1 overflow-x-auto p-1.5 lg:hidden">
            {SECTION_SHORT_LABELS.map((label, index) => {
              const active = index === activeIndex;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => onSelectSection(index)}
                  aria-current={active ? "step" : undefined}
                  className={cn(
                    "focus-ring shrink-0 rounded-full px-3 py-1.5 text-[11px] font-medium transition",
                    active
                      ? "bg-[linear-gradient(135deg,#16243d_0%,#2b4a7d_100%)] text-white shadow-[0_6px_16px_-12px_rgba(18,35,62,0.8)]"
                      : "text-muted hover:bg-white/70 hover:text-ink",
                  )}
                >
                  <span className={cn("mr-1 text-[9px] tabular-nums", active ? "text-white/60" : "text-faint")}>
                    0{index + 1}
                  </span>
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8 pb-24 sm:px-8 sm:py-11">{children}</main>
    </div>
  );
}

function ExamTimer({ seconds }: { seconds: number }) {
  const critical = seconds <= 60;
  const warning = seconds <= 300;
  return (
    <span
      role="timer"
      aria-label={`Tiempo restante: ${formatSeconds(seconds)}`}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[11.5px] font-semibold tabular-nums shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-md transition-colors",
        critical
          ? "border-[#fbdada] bg-[#fdf0f0]/90 text-danger"
          : warning
            ? "border-[#f4e6c8] bg-[#fdf8ec]/90 text-warning"
            : "border-white/85 bg-white/65 text-muted",
      )}
    >
      <Clock3 className={cn("size-3.5", critical && "animate-pulse")} />
      {formatSeconds(seconds)}
    </span>
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
        <p className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.16em] text-faint uppercase">
          <span className="size-1.5 rounded-full bg-gold" />
          Sección {index} de 4
        </p>
        <h1 className="mt-2.5 text-[30px] leading-[1.08] font-semibold tracking-[-0.04em] sm:text-[38px]">
          {title}
        </h1>
        <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-muted">{description}</p>
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
    <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-white/70 pt-6">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="focus-ring rounded-full border border-white/80 bg-white/55 px-4 py-2 text-[12.5px] font-medium text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition hover:bg-white/80 hover:text-ink"
        >
          ← {backLabel}
        </button>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-3">
        {hint && <span className="text-[11.5px] text-faint">{hint}</span>}
        <button
          type="button"
          onClick={onNext}
          disabled={nextDisabled || loading}
          className="focus-ring inline-flex h-11 items-center gap-2 rounded-full bg-[linear-gradient(135deg,#16243d_0%,#2b4a7d_100%)] px-6 text-[13.5px] font-medium text-white shadow-[0_14px_30px_-18px_rgba(18,35,62,0.9),inset_0_1px_0_rgba(255,255,255,0.16)] transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#c9cfda] disabled:shadow-none disabled:active:scale-100"
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
