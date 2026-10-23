import type { ReactNode } from "react";
import { LEVELS, type Level } from "../lib/types";
import { cn } from "../lib/utils";
import { Button, Modal } from "../components/ui";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="flex items-center gap-2 text-[9.5px] font-semibold tracking-[0.18em] text-faint uppercase">
          <span className="size-1.5 rounded-full bg-gold" />
          Yönetim
        </p>
        <h1 className="mt-2 text-[26px] leading-tight font-semibold tracking-[-0.04em]">{title}</h1>
        {description && <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function LevelTabs({
  value,
  onChange,
  suffix,
}: {
  value: Level;
  onChange: (level: Level) => void;
  suffix?: (level: Level) => ReactNode;
}) {
  return (
    <div className="mb-5 inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-white/80 bg-white/50 p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl">
      {LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          className={cn(
            "focus-ring flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium transition",
            value === level
              ? "bg-[linear-gradient(135deg,#16243d_0%,#2b4a7d_100%)] text-white shadow-[0_8px_18px_-14px_rgba(18,35,62,0.9)]"
              : "text-muted hover:bg-white/70 hover:text-ink",
          )}
        >
          {level}
          {suffix ? (
            <span
              className={cn(
                "rounded-full px-1.5 text-[10px] tabular-nums",
                value === level ? "bg-white/15 text-white/80" : "bg-white/70 text-faint",
              )}
            >
              {suffix(level)}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-white/85 bg-white/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_22px_50px_-42px_rgba(24,41,74,0.45)] backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Sil",
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Vazgeç
          </Button>
          <Button variant="danger" onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-muted">
        Bu işlem geri alınamaz. Devam etmek istediğine emin misin?
      </p>
    </Modal>
  );
}

export function LevelBadge({ level }: { level: Level }) {
  return (
    <span className="inline-flex items-center rounded-md border border-white/80 bg-white/65 px-1.5 py-0.5 text-[10.5px] font-semibold text-muted shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      {level}
    </span>
  );
}
