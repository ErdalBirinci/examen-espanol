import { cn } from "../lib/utils";

export function Brand({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <span
        className={cn(
          "brand-orb shrink-0 text-[#203457]",
          compact ? "size-7 text-[13px]" : "size-9 text-[16px]",
        )}
        aria-hidden
      >
        <span className="font-display relative z-10 leading-none italic">E</span>
      </span>
      <span className="flex min-w-0 flex-col leading-none">
        <span className="flex items-baseline gap-1.5">
          <span
            className={cn(
              "font-semibold tracking-[-0.035em]",
              compact ? "text-[13px]" : "text-[15px]",
            )}
          >
            Examen
          </span>
          <span
            className={cn(
              "font-display font-normal italic text-accent-ink",
              compact ? "text-[16px]" : "text-[19px]",
            )}
          >
            de Español
          </span>
        </span>
        {!compact && (
          <span className="mt-1 text-[8.5px] font-semibold tracking-[0.19em] text-faint uppercase">
            Evaluación de lengua
          </span>
        )}
      </span>
    </span>
  );
}
