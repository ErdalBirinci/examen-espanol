import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { ArrowRight, CalendarClock, CheckCircle2, ClipboardList, LogOut } from "lucide-react";
import { getCandidateAccount, listMyAssignments, signOutCandidate, type Assignment, type CandidateAccount } from "../lib/api";
import { LEVEL_INFO } from "../lib/types";
import { Button, EmptyState, Notice, Spinner } from "../components/ui";
import { errorMessage } from "../lib/utils";

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function CandidatePortal() {
  const navigate = useNavigate();
  const [account, setAccount] = useState<CandidateAccount | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const user = await getCandidateAccount();
        if (!active) return;
        setAccount(user);
        if (!user) return;
        const rows = await listMyAssignments();
        if (active) setAssignments(rows);
      } catch (err) {
        if (active) setError(errorMessage(err));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!loading && !account) return <Navigate to="/" replace />;

  const pending = assignments.filter((item) => !item.attempt_id);
  const completed = assignments.filter((item) => item.attempt_id);

  return (
    <div className="min-h-dvh bg-[radial-gradient(120%_70%_at_50%_-15%,#e9f2ff_0%,#f7f9fd_38%,#fbfbfd_70%)]">
      <header className="sticky top-0 z-30 border-b border-[rgba(29,29,31,0.06)] glass-bar">
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-5 sm:px-8">
          <Link to="/" className="flex items-baseline gap-1.5">
            <span className="text-[15px] font-semibold tracking-[-0.02em]">Examen</span>
            <span className="font-display text-[19px] italic text-accent-ink">de Español</span>
          </Link>
          <button
            type="button"
            onClick={async () => {
              await signOutCandidate();
              navigate("/");
            }}
            className="flex items-center gap-1.5 text-[12.5px] font-medium text-muted transition hover:text-ink"
          >
            <LogOut className="size-3.5" />
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8 sm:py-14">
        {loading ? (
          <div className="flex justify-center py-24 text-muted">
            <Spinner className="size-5" />
          </div>
        ) : (
          <>
            <div className="anim-rise">
              <p className="text-[11.5px] font-semibold tracking-[0.12em] text-faint uppercase">
                Mi panel
              </p>
              <h1 className="mt-2 text-[32px] leading-tight font-semibold tracking-[-0.035em] sm:text-[38px]">
                Hola, {account?.fullName.split(" ")[0]}
              </h1>
              <p className="mt-2 text-[14px] text-muted">
                {account?.email} · {pending.length} examen(es) pendiente(s)
              </p>
            </div>

            {error && (
              <div className="mt-6">
                <Notice tone="danger">{error}</Notice>
              </div>
            )}

            <section className="mt-8">
              <h2 className="mb-3 text-[13px] font-semibold tracking-[0.04em] text-faint uppercase">
                Exámenes asignados
              </h2>
              {assignments.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="size-5" />}
                  title="Todavía no tienes exámenes"
                  description="Cuando tu centro te asigne una prueba, aparecerá aquí automáticamente."
                />
              ) : (
                <div className="space-y-3">
                  {assignments.map((item) => {
                    const done = Boolean(item.attempt_id);
                    const reference = item.attempt_id?.slice(0, 8).toUpperCase() ?? "";
                    return (
                      <div
                        key={item.id}
                        className="card flex flex-wrap items-center justify-between gap-4 p-5"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full border border-line bg-white px-2 py-0.5 text-[11px] font-semibold text-muted">
                              {item.level}
                            </span>
                            <p className="text-[14.5px] font-semibold">
                              {item.title || `Examen de nivel ${item.level}`}
                            </p>
                            {done && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#eef8f1] px-2 py-0.5 text-[11px] font-semibold text-success">
                                <CheckCircle2 className="size-3" />
                                {item.attempt_status === "graded" ? "Evaluado" : "Enviado"}
                              </span>
                            )}
                          </div>
                          <p className="mt-1 text-[12px] text-muted">
                            {LEVEL_INFO[item.level]?.name} · Asignado el {formatDate(item.created_at)}
                          </p>
                          {item.note && (
                            <p className="mt-1.5 max-w-xl text-[12px] leading-relaxed text-muted">
                              {item.note}
                            </p>
                          )}
                          {item.due_at && (
                            <p className="mt-1.5 flex items-center gap-1 text-[11.5px] text-warning">
                              <CalendarClock className="size-3.5" />
                              Fecha límite: {formatDate(item.due_at)}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          {done ? (
                            <Link
                              to={`/resultado?code=${reference}&email=${encodeURIComponent(
                                account?.email ?? "",
                              )}`}
                            >
                              <Button variant="secondary">Ver resultado</Button>
                            </Link>
                          ) : (
                            <Link to={`/examen/${item.id}`}>
                              <Button icon={<ArrowRight className="size-4" />}>
                                Empezar examen
                              </Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {completed.length > 0 && (
              <p className="mt-6 text-[11.5px] text-faint">
                Los exámenes enviados no se pueden repetir; los resultados aparecen cuando el equipo
                los evalúa.
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}
