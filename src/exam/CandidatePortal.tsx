import { useEffect, useState, type CSSProperties } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LogOut,
  Sparkles,
} from "lucide-react";
import { getCandidateAccount, listMyAssignments, signOutCandidate, type Assignment, type CandidateAccount } from "../lib/api";
import { LEVEL_INFO } from "../lib/types";
import { Button, EmptyState, Notice, Spinner } from "../components/ui";
import { SiteFooter, SiteHeader } from "../components/SiteHeader";
import { errorMessage, initials } from "../lib/utils";

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
  const progress = assignments.length > 0 ? Math.round((completed.length / assignments.length) * 100) : 0;

  return (
    <div className="app-page">
      <SiteHeader
        width="5xl"
        right={
          account ? (
            <>
              <span className="hidden items-center gap-2.5 rounded-full py-1 pr-2 pl-1 sm:flex">
                <span className="flex size-8 items-center justify-center rounded-full bg-ink text-[11px] font-semibold text-white shadow-[0_6px_16px_-10px_rgba(15,28,50,0.8)]">
                  {initials(account.fullName)}
                </span>
                <span className="hidden max-w-[150px] flex-col leading-tight md:flex">
                  <span className="truncate text-[12px] font-semibold">{account.fullName}</span>
                  <span className="truncate text-[10.5px] text-faint">{account.email}</span>
                </span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await signOutCandidate();
                  navigate("/");
                }}
                className="focus-ring inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12px] font-medium text-muted transition hover:bg-white/70 hover:text-ink"
              >
                <LogOut className="size-3.5" />
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </>
          ) : null
        }
      />

      <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8 sm:py-14">
        {loading ? (
          <div className="flex justify-center py-28 text-muted">
            <Spinner className="size-5" />
          </div>
        ) : (
          <>
            <section className="anim-rise grid items-stretch gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="relative">
                <span className="premium-kicker">
                  <Sparkles className="size-3 text-gold" />
                  Mi panel · Nivel {assignments[0]?.level ?? "—"}
                </span>
                <h1 className="mt-5 text-[clamp(2.3rem,5vw,3.6rem)] leading-[1.02] font-semibold tracking-[-0.05em]">
                  Hola,{" "}
                  <span className="font-display font-normal italic text-gradient-blue">
                    {account?.fullName.split(" ")[0]}
                  </span>
                  .
                </h1>
                <p className="mt-4 max-w-lg text-[14.5px] leading-relaxed text-muted">
                  Aquí encontrarás las pruebas asignadas a tu cuenta. Puedes empezar por la sección
                  que prefieras y continuar donde lo dejaste.
                </p>

                <div className="mt-6 grid max-w-lg grid-cols-3 gap-2.5">
                  {[
                    { value: assignments.length, label: "Asignados" },
                    { value: pending.length, label: "Pendientes" },
                    { value: completed.length, label: "Completados" },
                  ].map((item) => (
                    <div key={item.label} className="stat-glass px-3.5 py-3">
                      <p className="text-[22px] leading-none font-semibold tracking-[-0.04em] tabular-nums">
                        {String(item.value).padStart(2, "0")}
                      </p>
                      <p className="mt-1.5 text-[9.5px] font-semibold tracking-[0.09em] text-faint uppercase">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card flex items-center gap-5 p-5 sm:p-6">
                <div
                  className="progress-ring size-[104px] shrink-0"
                  style={{ "--value": progress } as CSSProperties}
                >
                  <div className="text-center">
                    <p className="text-[21px] leading-none font-semibold tabular-nums">{progress}%</p>
                    <p className="mt-1 text-[8.5px] font-semibold tracking-[0.08em] text-faint uppercase">
                      completado
                    </p>
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold tracking-[0.15em] text-faint uppercase">
                    Tu progreso
                  </p>
                  <h2 className="mt-1.5 text-[18px] leading-snug font-semibold tracking-[-0.025em]">
                    {assignments.length === 0
                      ? "Aún sin exámenes"
                      : pending.length === 0
                        ? "Todo al día"
                        : `${pending.length} prueba${pending.length > 1 ? "s" : ""} por delante`}
                  </h2>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
                    {completed.length} de {assignments.length} exámenes enviados. Los resultados
                    aparecen cuando el equipo los publica.
                  </p>
                </div>
              </div>
            </section>

            {error && (
              <div className="mt-6">
                <Notice tone="danger">{error}</Notice>
              </div>
            )}

            <section className="mt-10">
              <div className="mb-3.5 flex items-end justify-between px-1">
                <h2 className="text-[10.5px] font-semibold tracking-[0.16em] text-faint uppercase">
                  Exámenes asignados
                </h2>
                {assignments.length > 0 && (
                  <span className="text-[11px] text-faint">
                    Actualizado {formatDate(assignments[0]?.created_at ?? null)}
                  </span>
                )}
              </div>

              {assignments.length === 0 ? (
                <EmptyState
                  icon={<ClipboardList className="size-5" />}
                  title="Todavía no tienes exámenes"
                  description="Cuando tu centro te asigne una prueba, aparecerá aquí automáticamente."
                />
              ) : (
                <div className="space-y-3">
                  {assignments.map((item, index) => {
                    const done = Boolean(item.attempt_id);
                    const reference = item.attempt_id?.slice(0, 8).toUpperCase() ?? "";
                    return (
                      <article
                        key={item.id}
                        className="card lift anim-rise group relative overflow-hidden p-5 sm:p-6"
                        style={{ animationDelay: `${Math.min(index, 5) * 55}ms` }}
                      >
                        <div className="flex flex-wrap items-start gap-4 sm:flex-nowrap sm:items-center">
                          <div className="level-medallion size-[58px] shrink-0 sm:size-[64px]">
                            <span className="relative z-10 font-display text-[25px] leading-none font-normal text-[#243b60] italic">
                              {item.level}
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[9.5px] font-semibold tracking-[0.13em] text-faint uppercase">
                                Examen de nivel
                              </span>
                              {done && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-[#d6ecdf] bg-[#eef8f1]/90 px-2 py-0.5 text-[10px] font-semibold text-success">
                                  <CheckCircle2 className="size-2.5" />
                                  {item.attempt_status === "graded" ? "Evaluado" : "Enviado"}
                                </span>
                              )}
                            </div>
                            <h3 className="mt-1 text-[16.5px] leading-snug font-semibold tracking-[-0.02em]">
                              {item.title || `Examen de nivel ${item.level}`}
                            </h3>
                            <p className="mt-1 text-[11.5px] text-muted">
                              {LEVEL_INFO[item.level]?.name} ·{" "}
                              {item.duration_minutes ? `${item.duration_minutes} min` : "Duración estándar"} ·{" "}
                              Asignado el {formatDate(item.created_at)}
                            </p>
                            {item.note && (
                              <p className="mt-2 max-w-2xl rounded-lg border border-white/70 bg-white/45 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-muted">
                                {item.note}
                              </p>
                            )}
                            {item.due_at && (
                              <p className="mt-2 flex items-center gap-1 text-[11px] font-medium text-warning">
                                <CalendarClock className="size-3.5" />
                                Fecha límite: {formatDate(item.due_at)}
                              </p>
                            )}
                          </div>

                          <div className="flex w-full shrink-0 items-center justify-end gap-2 sm:w-auto">
                            {done ? (
                              item.results_visible ? (
                                <Link
                                  to={`/resultado?code=${reference}&email=${encodeURIComponent(
                                    account?.email ?? "",
                                  )}`}
                                >
                                  <Button variant="secondary">Ver resultado</Button>
                                </Link>
                              ) : (
                                <span className="rounded-full border border-[#f3e2c8] bg-[#fdf8ec]/90 px-3 py-1.5 text-[11px] font-medium text-warning">
                                  Resultados no publicados
                                </span>
                              )
                            ) : (
                              <Link to={`/examen/${item.id}`}>
                                <Button icon={<ArrowRight className="size-4" />}>
                                  Empezar examen
                                </Button>
                              </Link>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {completed.length > 0 && (
                <p className="mt-5 px-1 text-[11px] leading-relaxed text-faint">
                  Los exámenes enviados no se pueden repetir; los resultados aparecen cuando el
                  equipo los evalúa.
                </p>
              )}
            </section>
          </>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
