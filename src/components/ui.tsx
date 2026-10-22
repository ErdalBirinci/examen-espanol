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
    "bg-accent text-white hover:bg-accent-ink shadow-[0_8px_24px_-12px_rgba(0,113,227,0.8)] disabled:bg-[#9dc7f5]",
  dark: "bg-ink text-white hover:bg-black shadow-[0_10px_30px_-16px_rgba(0,0,0,0.7)]",
  secondary:
    "bg-white text-ink border border-line hover:border-[#cfcfd6] hover:bg-[#fcfcfe]",
  ghost: "bg-transparent text-muted hover:text-ink hover:bg-[#f2f2f5]",
  danger: "bg-[#fdf0f0] text-danger border border-[#f6d5d6] hover:bg-[#fbe3e4]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[13px] rounded-[10px] gap-1.5",
  md: "h-11 px-5 text-[14px] rounded-xl gap-2",
  lg: "h-13 px-7 text-[15px] rounded-2xl gap-2",
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
        className="anim-fade absolute inset-0 bg-[rgba(20,20,24,0.28)] backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "anim-rise relative z-10 max-h-[92vh] w-full overflow-hidden rounded-t-[26px] border border-line bg-white shadow-[0_40px_120px_-40px_rgba(16,24,40,0.5)] sm:rounded-[26px]",
          wide ? "sm:max-w-3xl" : "sm:max-w-xl",
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
            {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            className="focus-ring -mr-1 -mt-1 rounded-lg p-1.5 text-faint transition hover:bg-[#f3f3f6] hover:text-ink"
          >
            <X className="size-4.5" />
          </button>
        </div>
        <div className="max-h-[calc(92vh-9rem)] overflow-y-auto px-6 py-5">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-line bg-[#fcfcfe] px-6 py-4">
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
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-[#fcfcfe] px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex size-11 items-center justify-center rounded-2xl bg-white text-faint shadow-[0_2px_10px_-4px_rgba(16,24,40,0.2)]">
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
    neutral: "border-line bg-[#fafafc] text-muted",
    danger: "border-[#f6d5d6] bg-[#fdf4f4] text-danger",
    success: "border-[#d6ecdf] bg-[#f2faf5] text-success",
    warning: "border-[#f3e2c8] bg-[#fdf8ef] text-warning",
  } as const;
  return (
    <div className={cn("rounded-xl border px-3.5 py-2.5 text-[13px] leading-relaxed", tones[tone])}>
      {children}
    </div>
  );
}
