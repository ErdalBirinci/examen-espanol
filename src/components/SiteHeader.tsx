import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Brand } from "./Brand";
import { cn } from "../lib/utils";

const WIDTHS = {
  "3xl": "max-w-3xl",
  "4xl": "max-w-4xl",
  "5xl": "max-w-5xl",
  "6xl": "max-w-6xl",
} as const;

export function SiteHeader({
  right,
  width = "6xl",
  className,
}: {
  right?: ReactNode;
  width?: keyof typeof WIDTHS;
  className?: string;
}) {
  return (
    <header className={cn("sticky top-0 z-40 px-3 pt-3 sm:px-5 sm:pt-4", className)}>
      <div
        className={cn(
          "premium-nav mx-auto flex h-16 items-center justify-between gap-3 px-3.5 sm:px-5",
          WIDTHS[width],
        )}
      >
        <Link
          to="/"
          className="focus-ring -m-1 shrink-0 rounded-full p-1"
          aria-label="Examen de Español, inicio"
        >
          <Brand compact />
        </Link>
        <div className="flex min-w-0 items-center gap-1.5 sm:gap-2">{right}</div>
      </div>
    </header>
  );
}

export function BackLink({ to = "/", label = "Inicio" }: { to?: string; label?: string }) {
  return (
    <Link
      to={to}
      className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-medium text-muted transition hover:bg-white/70 hover:text-ink"
    >
      <ArrowLeft className="size-3.5" />
      {label}
    </Link>
  );
}

export function SiteFooter({ note }: { note?: string }) {
  return (
    <footer className="mx-auto mt-20 flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 border-t border-white/70 px-5 py-7 text-[11px] text-faint sm:px-8">
      <span>© 2026 Examen de Español · Certificación de lengua</span>
      <span className="flex items-center gap-4">
        <Link to="/resultado" className="transition hover:text-ink">
          Consultar resultado
        </Link>
        <span>{note ?? "A1 — C2 · Centro de evaluación"}</span>
      </span>
    </footer>
  );
}
