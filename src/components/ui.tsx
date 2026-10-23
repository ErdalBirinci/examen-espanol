import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

/* ------------------------------- Button ------------------------------ */

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "dark";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-[linear-gradient(135deg,#1e4fd6_0%,#2f6bff_52%,#6d9bff_100%)] text-white shadow-[0_14px_32px_-18px_rgba(47,107,255,0.95),inset_0_1px_0_rgba(255,255,255,0.24)] hover:brightness-[1.06] disabled:bg-[#9db9ea] disabled:bg-none",
  dark: "bg-[linear-gradient(135deg,#16243d_0%,#2b4a7d_100%)] text-white shadow-[0_14px_30px_-18px_rgba(18,35,62,0.9),inset_0_1px_0_rgba(255,255,255,0.16)] hover:brightness-110",
  secondary:
    "border border-white/85 bg-white/60 text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_10px_24px_-22px_rgba(24,41,74,0.5)] backdrop-blur-md hover:border-white hover:bg-white/85",
  ghost: "bg-transparent text-muted hover:bg-white/55 hover:text-ink",
  danger: "border border-[#f2cfd2] bg-[#fdf0f0]/85 text-danger shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] hover:bg-[#fbe3e4]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3.5 text-[12px] rounded-full gap-1.5",
  md: "h-10 px-4.5 text-[13px] rounded-full gap-2",
  lg: "h-12 px-6.5 text-[14px] rounded-full gap-2",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "focus-ring inline-flex select-none items-center justify-center font-medium transition-all duration-150 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-70 disabled:active:scale-100",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
    </button>
  );
}

/* ------------------------------- Spinner ----------------------------- */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-70",
        className,
      )}
      aria-hidden
    />
  );
}

/* -------------------------------- Field ------------------------------ */

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  className,
}: {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-[12.5px] font-medium tracking-[0.01em] text-muted"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-[12px] text-danger">{error}</p>
      ) : hint ? (
        <p className="text-[12px] text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------- Badge ------------------------------ */

type BadgeTone = "neutral" | "accent" | "success" | "warning" | "danger";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "bg-[#f3f3f6] text-muted",
  accent: "bg-accent-soft text-accent-ink",
  success: "bg-[#eef8f1] text-success",
  warning: "bg-[#fdf4e7] text-warning",
  danger: "bg-[#fdf0f0] text-danger",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11.5px] font-medium",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* --------------------------------- Modal ----------------------------- */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <div
        className="anim-fade absolute inset-0 bg-[rgba(13,26,46,0.32)] backdrop-blur-[6px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "anim-rise relative z-10 max-h-[92vh] w-full overflow-hidden rounded-t-[1.75rem] border border-white/90 bg-[linear-gradient(160deg,rgba(255,255,255,0.97)_0%,rgba(249,251,255,0.9)_100%)] shadow-[0_40px_120px_-40px_rgba(16,28,48,0.6)] backdrop-blur-2xl sm:rounded-[1.75rem]",
          wide ? "sm:max-w-3xl" : "sm:max-w-xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/80 px-6 py-5">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="focus-ring -mr-1 -mt-1 rounded-full p-1.5 text-faint transition hover:bg-white/70 hover:text-ink"
          >
            <X className="size-4.5" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-9rem)] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-white/80 bg-white/35 px-6 py-4 backdrop-blur-md">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------ EmptyState --------------------------- */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#cfdced] bg-white/40 px-6 py-14 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] backdrop-blur-xl">
      {icon && (
        <div className="mb-3 flex size-11 items-center justify-center rounded-2xl border border-white/90 bg-white/80 text-faint shadow-[0_2px_10px_-4px_rgba(16,24,40,0.2)]">
          {icon}
        </div>
      )}
      <p className="text-[14.5px] font-medium text-ink">{title}</p>
      {description && <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------- Notice ----------------------------- */

export function Notice({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "danger" | "success" | "warning";
  children: ReactNode;
}) {
  const tones = {
    neutral: "border-white/85 bg-white/55 text-muted",
    danger: "border-[#f2d3d5] bg-[#fdf4f4]/90 text-danger",
    success: "border-[#d6ecdf] bg-[#f2faf5]/90 text-success",
    warning: "border-[#f1e0c5] bg-[#fdf8ef]/90 text-warning",
  } as const;
  return (
    <div className={cn("rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed shadow-[inset_0_1px_0_rgba(255,255,255,0.85)] backdrop-blur-md", tones[tone])}>
      {children}
    </div>
  );
}
