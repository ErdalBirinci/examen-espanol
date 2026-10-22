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
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.025em]">{title}</h1>
        {description && <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>}
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
    <div className="mb-5 flex flex-wrap gap-1.5 rounded-xl border border-line bg-white p-1.5">
      {LEVELS.map((level) => (
        <button
          key={level}
          type="button"
          onClick={() => onChange(level)}
          className={cn(
            "focus-ring flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
            value === level ? "bg-ink text-white" : "text-muted hover:bg-[#f3f3f6] hover:text-ink",
          )}
        >
          {level}
          {suffix ? (
            <span
              className={cn(
                "rounded-full px-1.5 text-[10.5px] tabular-nums",
                value === level ? "bg-white/20" : "bg-[#f0f0f4] text-faint",
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
    <div className={cn("rounded-2xl border border-line bg-white", className)}>{children}</div>
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
    <span className="inline-flex items-center rounded-md bg-[#f2f2f5] px-1.5 py-0.5 text-[11px] font-semibold text-muted">
      {level}
    </span>
  );
}
