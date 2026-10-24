import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CheckCircle2, FlaskConical } from "lucide-react";
import { adminDashboardSummary, questionStats } from "../lib/api";
import type { DashboardSummary, Level, QuestionStat } from "../lib/types";
import { errorMessage } from "../lib/utils";
import { Badge, EmptyState, Notice, Spinner } from "../components/ui";
import { LevelTabs, PageHeader, Panel } from "./shared";

/** Below this many appearances a statistic is too noisy to act on. */
const MIN_APPEARANCES = 10;
/** A level needs 50 questions to draw a full random test. */
const POOL_TARGET = 50;

type Flag = { label: string; tone: "neutral" | "accent" | "success" | "warning" | "danger" };

function flagsFor(row: QuestionStat): Flag[] {
  if (row.appearances < MIN_APPEARANCES) {
    return row.p_value === null
      ? [{ label: "Veri yok", tone: "neutral" }]
      : [{ label: "Veri az", tone: "neutral" }];
  }

  const flags: Flag[] = [];
  const p = row.p_value ?? 0;
  if (p < 0.3) flags.push({ label: "Çok zor", tone: "danger" });
  else if (p > 0.9) flags.push({ label: "Çok kolay", tone: "warning" });
  if (row.discrimination < 0.2) flags.push({ label: "Ayırt etmiyor", tone: "warning" });
  if (flags.length === 0) flags.push({ label: "Sağlıklı", tone: "success" });
  return flags;
}

function pColor(p: number): string {
  if (p < 0.3) return "bg-[#e46a6a]";
  if (p > 0.9) return "bg-[#d6a54a]";
  return "bg-[linear-gradient(90deg,#2f6bff,#8fb3ff)]";
}

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export default function Analysis() {
  const [level, setLevel] = useState<Level>("A1");
  const [rows, setRows] = useState<QuestionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [summaryData, setSummaryData] = useState<DashboardSummary | null>(null);

  const load = useCallback(async (target: Level) => {
    setLoading(true);
    try {
      const [stats, overview] = await Promise.all([
        questionStats(target),
        adminDashboardSummary().catch(() => null),
      ]);
      setRows(stats);
      setSummaryData(overview);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(level);
  }, [level, load]);

  const summary = useMemo(() => {
    const measured = rows.filter((row) => row.appearances >= MIN_APPEARANCES);
    const weak = measured.filter((row) => row.discrimination < 0.2);
    const hard = measured.filter((row) => (row.p_value ?? 0) < 0.3);
    const averageP =
      measured.length === 0
        ? null
        : measured.reduce((sum, row) => sum + (row.p_value ?? 0), 0) / measured.length;
    return { measured: measured.length, weak: weak.length, hard: hard.length, averageP };
  }, [rows]);

  const visible = useMemo(
    () =>
      onlyProblems
        ? rows.filter((row) => {
            const flags = flagsFor(row).map((flag) => flag.label);
            return flags.some((label) => label !== "Sağlıklı" && label !== "Veri az" && label !== "Veri yok");
          })
        : rows,
    [rows, onlyProblems],
  );

  return (
    <div>
      <PageHeader
        title="Madde Analizi"
        description="Her test sorusunun doğru oranı ve ayırt ediciliği. Sorunlu maddeleri görüp havuzu bilinçli olarak yenile."
        action={
          <button
            type="button"
            onClick={() => setOnlyProblems((value) => !value)}
            className={
              onlyProblems
                ? "focus-ring rounded-xl border border-[#f2d3d5] bg-[#fdf4f4] px-3 py-1.5 text-[12px] font-medium text-danger"
                : "focus-ring rounded-xl border border-line bg-white px-3 py-1.5 text-[12px] text-muted transition hover:text-ink"
            }
          >
            {onlyProblems ? "Tüm maddeler" : "Yalnızca sorunlular"}
          </button>
        }
      />

      {summaryData && (
        <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <Panel className="p-4">
            <p className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
              Toplam deneme
            </p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums">
              {summaryData.attempts.total}
            </p>
            <p className="mt-1 text-[11px] text-muted">son 7 gün {summaryData.attempts.last7}</p>
          </Panel>
          <Panel className="p-4">
            <p className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
              Değerlendirme bekleyen
            </p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums">
              {summaryData.attempts.pending}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {summaryData.attempts.graded} değerlendirildi
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
              Ortalama puan
            </p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums">
              {summaryData.attempts.avg_total ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted">
              {summaryData.attempts.passed} aday 60 ve üzeri
            </p>
          </Panel>
          <Panel className="p-4">
            <p className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
              E-posta bekleyen
            </p>
            <p className="mt-1 text-[22px] font-semibold tabular-nums">
              {summaryData.attempts.awaiting_email}
            </p>
            <p className="mt-1 text-[11px] text-muted">sonuç e-postası gönderilmedi</p>
          </Panel>
        </div>
      )}

      <LevelTabs
        value={level}
        onChange={setLevel}
        suffix={(code) =>
          summaryData?.levels.find((row) => row.level === code)?.attempts ?? 0
        }
      />

      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-muted">
          <Spinner className="size-5" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<BarChart3 className="size-5" />}
          title={`${level} için test sorusu yok`}
          description="Soruları ekledikten ve denemeler değerlendirildikten sonra istatistikler burada görünür."
        />
      ) : (
        <>
          <div className="mb-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            <Panel className="p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">Havuz</p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums">{rows.length}</p>
              <p className="mt-1 text-[11px] text-muted">
                {rows.length >= POOL_TARGET
                  ? `${POOL_TARGET} soruluk sınav için yeterli`
                  : `${POOL_TARGET - rows.length} soru daha gerekli`}
              </p>
            </Panel>
            <Panel className="p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
                Ölçülen madde
              </p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums">{summary.measured}</p>
              <p className="mt-1 text-[11px] text-muted">en az {MIN_APPEARANCES} denemede yer aldı</p>
            </Panel>
            <Panel className="p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
                Ortalama doğru oranı
              </p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums">
                {percent(summary.averageP)}
              </p>
              <p className="mt-1 text-[11px] text-muted">hedef aralık %40–%80</p>
            </Panel>
            <Panel className="p-4">
              <p className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
                Zayıf ayırt edicilik
              </p>
              <p className="mt-1 text-[22px] font-semibold tabular-nums">{summary.weak}</p>
              <p className="mt-1 text-[11px] text-muted">D &lt; 0,20 · {summary.hard} çok zor madde</p>
            </Panel>
          </div>

          {summary.measured === 0 && (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-[#f1e0c5] bg-[#fdf8ef]/90 px-4 py-3 text-[12px] leading-relaxed text-warning">
              <FlaskConical className="mt-0.5 size-4 shrink-0" />
              Henüz istatistik için yeterli değerlendirilmiş deneme yok. Madde analizi, aynı soru en az{" "}
              {MIN_APPEARANCES} denemede yer aldığında anlamlı olur.
            </div>
          )}

          <Panel className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-[12px] font-medium">{level} test soruları</p>
              <p className="text-[11px] text-faint">{visible.length} madde</p>
            </div>

            {visible.length === 0 ? (
              <div className="flex items-center gap-2 px-4 py-6 text-[12.5px] text-muted">
                <CheckCircle2 className="size-4 text-success" />
                Bu seviyede sorunlu madde yok.
              </div>
            ) : (
              <ol className="divide-y divide-[#f1f1f4]">
                {visible.map((row, index) => {
                  const flags = flagsFor(row);
                  return (
                    <li key={row.question_id} className="px-4 py-3">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] leading-snug">
                            <span className="mr-1.5 text-[11px] font-semibold text-faint tabular-nums">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            {row.prompt}
                          </p>
                          <p className="mt-1 text-[11px] text-faint">
                            Doğru: {row.options[row.correct_index] ?? "—"} · {row.correct_count}/
                            {row.appearances} doğru
                          </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {flags.map((flag) => (
                            <Badge key={flag.label} tone={flag.tone}>
                              {flag.label}
                            </Badge>
                          ))}
                        </div>
                      </div>

                      <div className="mt-2.5 grid grid-cols-[1fr_auto_auto] items-center gap-3">
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#e8edf6]">
                          <div
                            className={`h-full rounded-full ${pColor(row.p_value ?? 0)}`}
                            style={{ width: `${Math.round((row.p_value ?? 0) * 100)}%` }}
                          />
                        </div>
                        <span className="w-16 text-right text-[11px] text-muted tabular-nums">
                          p {percent(row.p_value)}
                        </span>
                        <span className="w-20 text-right text-[11px] text-muted tabular-nums">
                          D {row.discrimination.toFixed(2)}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Panel>

          <div className="mt-3 flex items-start gap-2 text-[11px] leading-relaxed text-faint">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
            p çok düşükse soru gereğinden zor, çok yüksekse ayırt edici değil; D 0,20'nin altındaysa güçlü
            adaylarla zayıf adayları aynı oranda doğru yanıtlıyor demektir. Bu maddeleri gözden geçirip
            yenilemek sınavın güvenilirliğini artırır.
          </div>
        </>
      )}
    </div>
  );
}
