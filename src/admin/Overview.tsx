import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, ClipboardList, Clock, Sparkles, Users } from "lucide-react";
import { listAttempts } from "../lib/api";
import type { Attempt } from "../lib/types";
import { LEVELS } from "../lib/types";
import { formatDate } from "../lib/utils";
import { Badge, EmptyState, Notice, Spinner } from "../components/ui";
import { LevelBadge, PageHeader, Panel } from "./shared";

export default function Overview() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listAttempts()
      .then(setAttempts)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const thisMonth = attempts.filter((attempt) => new Date(attempt.created_at) >= monthStart);
    const pending = attempts.filter((attempt) => attempt.status === "submitted");
    const scored = attempts.filter((attempt) => (attempt.mc_total ?? 0) > 0);
    const avg =
      scored.length > 0
        ? Math.round(
            (scored.reduce((sum, attempt) => sum + (attempt.mc_correct ?? 0) / (attempt.mc_total ?? 1), 0) /
              scored.length) *
              100,
          )
        : 0;

    return { total: attempts.length, thisMonth: thisMonth.length, pending: pending.length, avg };
  }, [attempts]);

  const distribution = useMemo(
    () =>
      LEVELS.map((level) => ({
        level,
        count: attempts.filter((attempt) => attempt.level === level).length,
      })),
    [attempts],
  );
  const maxCount = Math.max(1, ...distribution.map((entry) => entry.count));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Genel Bakış"
        description="Sınavlar, adaylar ve değerlendirme durumunun özeti."
        action={
          <Link
            to="/adminpanel/sonuclar"
            className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink transition hover:border-[#cfcfd6]"
          >
            Tüm sonuçlar
            <ArrowUpRight className="size-3.5" />
          </Link>
        }
      />

      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={<Users className="size-4" />} label="Toplam sınav" value={stats.total} />
        <StatCard icon={<Sparkles className="size-4" />} label="Bu ay" value={stats.thisMonth} />
        <StatCard
          icon={<Clock className="size-4" />}
          label="Değerlendirme bekleyen"
          value={stats.pending}
          tone={stats.pending > 0 ? "warning" : "neutral"}
        />
        <StatCard icon={<ClipboardList className="size-4" />} label="Ortalama test başarısı" value={`${stats.avg}%`} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Panel className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-[13.5px] font-semibold">Son sınavlar</h2>
            <span className="text-[11.5px] text-faint">{attempts.length} kayıt</span>
          </div>
          {attempts.length === 0 ? (
            <div className="p-4">
              <EmptyState
                title="Henüz sınav yok"
                description="Bir aday sınavı tamamladığında burada görünecek."
              />
            </div>
          ) : (
            <ul className="divide-y divide-[#f1f1f4]">
              {attempts.slice(0, 6).map((attempt) => (
                <li key={attempt.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[#f3f3f6] text-[11px] font-semibold text-muted">
                      {attempt.full_name
                        .split(" ")
                        .slice(0, 2)
                        .map((part) => part[0])
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[12.5px] font-medium">{attempt.full_name}</p>
                      <p className="truncate text-[11px] text-faint">{formatDate(attempt.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <LevelBadge level={attempt.level} />
                    <Badge tone={attempt.status === "graded" ? "success" : "warning"}>
                      {attempt.status === "graded" ? "Değerlendirildi" : "Bekliyor"}
                    </Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel className="p-5">
          <h2 className="text-[13.5px] font-semibold">Seviye dağılımı</h2>
          <p className="mt-0.5 text-[11.5px] text-muted">Gelen sınavların seviyelere göre dağılımı.</p>
          <div className="mt-5 space-y-3">
            {distribution.map(({ level, count }) => (
              <div key={level} className="flex items-center gap-3">
                <span className="w-6 text-[11.5px] font-semibold text-muted">{level}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#f1f1f4]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-[#0071e3] to-[#63a9f5] transition-all duration-700"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-[11.5px] tabular-nums text-muted">{count}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl bg-[#fcfcfe] p-3.5 ring-1 ring-line">
            <p className="text-[12px] font-medium">İçerik durumu</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              Soru ve ses kayıtlarını seviye bazında soldaki menüden yönetebilirsin.
            </p>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <div
        className={
          tone === "warning"
            ? "flex size-8 items-center justify-center rounded-lg bg-[#fdf4e7] text-warning"
            : "flex size-8 items-center justify-center rounded-lg bg-[#f3f3f6] text-muted"
        }
      >
        {icon}
      </div>
      <p className="mt-3 text-[24px] font-semibold tracking-[-0.03em] tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11.5px] text-muted">{label}</p>
    </div>
  );
}
