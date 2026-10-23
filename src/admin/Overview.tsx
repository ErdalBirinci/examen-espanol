import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowUpRight,
  ClipboardList,
  Clock,
  Download,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import {
  contentStats,
  exportBackup,
  listAttempts,
  listExamSettings,
  saveExamSettings,
} from "../lib/api";
import type { Attempt, ContentStats, ExamSettings } from "../lib/types";
import { LEVELS } from "../lib/types";
import { errorMessage, formatDate } from "../lib/utils";
import { Badge, Button, EmptyState, Field, Modal, Notice, Spinner } from "../components/ui";
import { LevelBadge, PageHeader, Panel } from "./shared";

export default function Overview() {
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [content, setContent] = useState<ContentStats[]>([]);
  const [settings, setSettings] = useState<ExamSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);

  useEffect(() => {
    Promise.all([listAttempts(), contentStats(), listExamSettings()])
      .then(([rows, stats, config]) => {
        setAttempts(rows);
        setContent(stats);
        setSettings(config);
      })
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  async function downloadBackup() {
    setBackupBusy(true);
    try {
      const json = await exportBackup();
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `examen-espanol-yedek-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBackupBusy(false);
    }
  }

  async function persistSettings() {
    setSavingSettings(true);
    setSettingsError(null);
    try {
      await saveExamSettings(settings);
      setSettings(await listExamSettings());
      setSettingsOpen(false);
    } catch (err) {
      setSettingsError(errorMessage(err));
    } finally {
      setSavingSettings(false);
    }
  }

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
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setSettingsOpen(true)}
              icon={<Settings2 className="size-3.5" />}
            >
              Sınav süreleri
            </Button>
            <Button
              variant="secondary"
              onClick={() => void downloadBackup()}
              loading={backupBusy}
              icon={<Download className="size-3.5" />}
            >
              Yedek indir
            </Button>
            <Link
              to="/adminpanel/sonuclar"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-white px-3.5 py-2 text-[12.5px] font-medium text-ink transition hover:border-[#cfcfd6]"
            >
              Tüm sonuçlar
              <ArrowUpRight className="size-3.5" />
            </Link>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#e5ebf4]/80">
                  <div
                    className="h-full rounded-full bg-[linear-gradient(90deg,#2f6bff,#8fb3ff)] transition-all duration-700"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
                <span className="w-6 text-right text-[11.5px] tabular-nums text-muted">{count}</span>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-xl border border-white/80 bg-white/45 p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            <p className="text-[12px] font-medium">İçerik durumu</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              Soru ve ses kayıtlarını seviye bazında soldaki menüden yönetebilirsin.
            </p>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-5 py-3.5">
          <div>
            <h2 className="text-[13.5px] font-semibold">İçerik tamlık matrisi</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">
              Hedef: 50 test sorusu, 10 dinleme sorusu, 2 yazma ve 1 konuşma konusu.
            </p>
          </div>
          <span className="text-[11.5px] text-faint">{content.length} seviye</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left">
            <thead>
              <tr className="border-b border-white/70 bg-white/35 text-[10.5px] font-semibold tracking-[0.06em] text-faint uppercase">
                <th className="px-5 py-2">Seviye</th>
                <th className="px-3 py-2">Soru</th>
                <th className="px-3 py-2">Dinleme</th>
                <th className="px-3 py-2">Dinleme s.</th>
                <th className="px-3 py-2">Yazma</th>
                <th className="px-3 py-2">Konuşma</th>
                <th className="px-5 py-2 text-right">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f1f4]">
              {LEVELS.map((level) => {
                const row = content.find((entry) => entry.level === level);
                const cells = [
                  { value: row?.questions ?? 0, target: 50 },
                  { value: row?.listening ?? 0, target: 1 },
                  { value: row?.listening_questions ?? 0, target: 10 },
                  { value: row?.writing ?? 0, target: 2 },
                  { value: row?.speaking ?? 0, target: 1 },
                ];
                const complete = cells.every((cell) => cell.value >= cell.target);
                return (
                  <tr key={level}>
                    <td className="px-5 py-2.5">
                      <LevelBadge level={level} />
                    </td>
                    {cells.map((cell, index) => (
                      <td key={index} className="px-3 py-2.5">
                        <span
                          className={
                            cell.value >= cell.target
                              ? "text-[12.5px] font-medium text-success tabular-nums"
                              : "text-[12.5px] font-medium text-warning tabular-nums"
                          }
                        >
                          {cell.value}
                        </span>
                        <span className="text-[11px] text-faint"> / {cell.target}</span>
                      </td>
                    ))}
                    <td className="px-5 py-2.5 text-right">
                      <Badge tone={complete ? "success" : "warning"}>
                        {complete ? "Hazır" : "Eksik"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Modal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        title="Sınav süreleri"
        description="Her seviye için adayın toplam süresi (dakika). Süre dolunca sınav otomatik gönderilir."
        footer={
          <>
            <Button variant="ghost" onClick={() => setSettingsOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => void persistSettings()} loading={savingSettings}>
              Kaydet
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          {settingsError && <Notice tone="danger">{settingsError}</Notice>}
          <div className="grid gap-3 sm:grid-cols-3">
            {LEVELS.map((level) => {
              const row = settings.find((entry) => entry.level === level);
              return (
                <Field key={level} label={level} hint="10–240 dk" htmlFor={`duration-${level}`}>
                  <input
                    id={`duration-${level}`}
                    type="number"
                    min={10}
                    max={240}
                    className="field"
                    value={row?.duration_minutes ?? 60}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      setSettings((prev) => {
                        const next = prev.filter((entry) => entry.level !== level);
                        return [
                          ...next,
                          { level, duration_minutes: Number.isFinite(value) ? value : 60 },
                        ].sort((a, b) => a.level.localeCompare(b.level));
                      });
                    }}
                  />
                </Field>
              );
            })}
          </div>
        </div>
      </Modal>
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
    <div className="relative overflow-hidden rounded-2xl border border-white/85 bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_20px_44px_-40px_rgba(24,41,74,0.5)] backdrop-blur-xl">
      <div
        className={
          tone === "warning"
            ? "flex size-8 items-center justify-center rounded-lg border border-white/80 bg-[#fdf4e7]/85 text-warning"
            : "flex size-8 items-center justify-center rounded-lg border border-white/80 bg-white/70 text-muted"
        }
      >
        {icon}
      </div>
      <p className="mt-3 text-[24px] font-semibold tracking-[-0.04em] tabular-nums">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{label}</p>
      <span className="absolute -top-6 -right-6 size-16 rounded-full bg-[radial-gradient(circle,rgba(47,107,255,0.12),transparent_70%)]" />
    </div>
  );
}
