import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  CalendarClock,
  CalendarRange,
  ChevronRight,
  ClipboardList,
  Clock3,
  FileText,
  FilterX,
  LogOut,
  Mail,
  RefreshCw,
  Search,
  ShieldCheck,
  ShieldOff,
  Trash2,
  Users as UsersIcon,
  X,
} from "lucide-react";
import {
  deleteCandidateRecordings,
  deleteManagedCandidate,
  getManagedCandidateDetail,
  listManagedCandidates,
  revokeManagedCandidateSessions,
  sendManagedCandidatePasswordReset,
  setManagedCandidateDisabled,
  type ManagedAttempt,
  type ManagedCandidateDetail,
  type ManagedCandidateSummary,
} from "../lib/api";
import { cn, errorMessage, formatDate, initials } from "../lib/utils";
import { Badge, Button, EmptyState, Field, Modal, Notice, Spinner } from "../components/ui";
import { LevelBadge, PageHeader, Panel } from "./shared";

type StatusFilter = "all" | "active" | "disabled" | "unconfirmed";
type ActionKind = "toggle" | "reset" | "revoke" | null;
type ActivityFilter =
  | "all"
  | "signup"
  | "login"
  | "assignment"
  | "draft"
  | "attempt"
  | "certificate";
type DatePreset = "all" | "24h" | "7d" | "30d" | "custom";
type Tone = "success" | "danger" | "warning" | "neutral" | "accent";

const ACTIVITY_OPTIONS: Array<{ value: ActivityFilter; label: string }> = [
  { value: "all", label: "Tüm aktiviteler" },
  { value: "signup", label: "Hesap kaydı" },
  { value: "login", label: "Giriş" },
  { value: "assignment", label: "Sınav ataması" },
  { value: "draft", label: "Taslak kaydı" },
  { value: "attempt", label: "Sınav gönderimi" },
  { value: "certificate", label: "Katılım belgesi" },
];

const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "all", label: "Tümü" },
  { value: "24h", label: "24 saat" },
  { value: "7d", label: "7 gün" },
  { value: "30d", label: "30 gün" },
  { value: "custom", label: "Özel" },
];

function activityTimestamp(
  row: ManagedCandidateSummary,
  activity: ActivityFilter,
): string | null {
  switch (activity) {
    case "signup":
      return row.created_at;
    case "login":
      return row.last_sign_in_at;
    case "assignment":
      return row.last_assignment_at;
    case "draft":
      return row.last_draft_at;
    case "attempt":
      return row.last_attempt_at;
    case "certificate":
      return row.last_certificate_at;
    default:
      return row.latest_activity ?? row.created_at;
  }
}

function timestampValue(value: string | null): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function dayValue(value: string, endOfDay: boolean): number | null {
  if (!value) return null;
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = endOfDay
    ? new Date(year, month - 1, day, 23, 59, 59, 999)
    : new Date(year, month - 1, day, 0, 0, 0, 0);
  const time = date.getTime();
  return Number.isFinite(time) ? time : null;
}

function buildDateRange(
  preset: DatePreset,
  from: string,
  to: string,
): { start: number | null; end: number | null } | null {
  if (preset === "all") return null;

  if (preset === "custom") {
    let start = dayValue(from, false);
    let end = dayValue(to, true);
    if (start !== null && end !== null && start > end) {
      [start, end] = [end, start];
    }
    return start === null && end === null ? null : { start, end };
  }

  const now = Date.now();
  if (preset === "24h") {
    return { start: now - 24 * 60 * 60 * 1000, end: now };
  }

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (preset === "7d" ? 6 : 29));
  return { start: start.getTime(), end: now };
}

function withinRange(
  value: string | null,
  range: { start: number | null; end: number | null } | null,
): boolean {
  if (!range) return true;
  const time = timestampValue(value);
  if (time === null) return false;
  return (range.start === null || time >= range.start) && (range.end === null || time <= range.end);
}

function isDisabled(value: { banned_until: string | null }): boolean {
  if (!value.banned_until) return false;
  const until = new Date(value.banned_until).getTime();
  return Number.isFinite(until) && until > Date.now();
}

function isUnconfirmed(value: { email_confirmed_at: string | null }): boolean {
  return !value.email_confirmed_at;
}

function candidateStatus(candidate: ManagedCandidateSummary): { label: string; tone: Tone } {
  if (isDisabled(candidate)) return { label: "Devre dışı", tone: "danger" };
  if (isUnconfirmed(candidate)) return { label: "Onay bekliyor", tone: "warning" };
  return { label: "Aktif", tone: "success" };
}

function dateText(value: string | null, fallback = "—"): string {
  return value ? formatDate(value) : fallback;
}

function weightedTotal(attempt: ManagedAttempt): number | null {
  if (attempt.scoring_version >= 2) {
    return attempt.total_score === null ? null : Math.round(Number(attempt.total_score));
  }
  if (
    !attempt.mc_total ||
    attempt.mc_correct === null ||
    attempt.listening_score === null ||
    attempt.writing_score === null ||
    attempt.speaking_score === null
  ) {
    return null;
  }
  return Math.round(
    (attempt.mc_correct / attempt.mc_total) * 40 +
      attempt.listening_score * 0.2 +
      attempt.writing_score * 0.2 +
      attempt.speaking_score * 0.2,
  );
}

function testPercent(attempt: ManagedAttempt): number | null {
  if (!attempt.mc_total || attempt.mc_correct === null) return null;
  return Math.round((attempt.mc_correct / attempt.mc_total) * 100);
}

export default function Users() {
  const [rows, setRows] = useState<ManagedCandidateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [activity, setActivity] = useState<ActivityFilter>("all");
  const [datePreset, setDatePreset] = useState<DatePreset>("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [selectedEmail, setSelectedEmail] = useState<string | null>(null);
  const [detail, setDetail] = useState<ManagedCandidateDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [action, setAction] = useState<ActionKind>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [deleteStep, setDeleteStep] = useState(false);
  const [deleteValue, setDeleteValue] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);
    try {
      setRows(await listManagedCandidates());
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      active: rows.filter((row) => !isDisabled(row) && !isUnconfirmed(row)).length,
      disabled: rows.filter((row) => isDisabled(row)).length,
      unconfirmed: rows.filter((row) => !isDisabled(row) && isUnconfirmed(row)).length,
    }),
    [rows],
  );

  const dateRange = useMemo(
    () => buildDateRange(datePreset, fromDate, toDate),
    [datePreset, fromDate, toDate],
  );

  const visibleRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      const matchesQuery =
        !needle ||
        row.full_name.toLowerCase().includes(needle) ||
        row.email.toLowerCase().includes(needle);
      const matchesStatus =
        status === "all" ||
        (status === "active" && !isDisabled(row) && !isUnconfirmed(row)) ||
        (status === "disabled" && isDisabled(row)) ||
        (status === "unconfirmed" && !isDisabled(row) && isUnconfirmed(row));
      const timestamp = activityTimestamp(row, activity);
      const matchesActivity = activity === "all" || Boolean(timestamp);
      const matchesDate = withinRange(timestamp, dateRange);
      return matchesQuery && matchesStatus && matchesActivity && matchesDate;
    });

    return filtered.sort((a, b) => {
      const first = timestampValue(activityTimestamp(a, activity)) ?? 0;
      const second = timestampValue(activityTimestamp(b, activity)) ?? 0;
      return second - first;
    });
  }, [rows, query, status, activity, dateRange]);

  const filtersActive =
    query.trim().length > 0 ||
    status !== "all" ||
    activity !== "all" ||
    datePreset !== "all";

  function clearFilters() {
    setQuery("");
    setStatus("all");
    setActivity("all");
    setDatePreset("all");
    setFromDate("");
    setToDate("");
  }

  const selectedSummary = useMemo(
    () => rows.find((row) => row.email === selectedEmail) ?? null,
    [rows, selectedEmail],
  );

  async function refreshDetail(email: string) {
    try {
      setDetail(await getManagedCandidateDetail(email));
      setDetailError(null);
    } catch (err) {
      setDetailError(errorMessage(err));
    }
  }

  async function openCandidate(email: string) {
    setSelectedEmail(email);
    setNotice(null);
    setDetail(null);
    setDetailError(null);
    setDetailLoading(true);
    setAction(null);
    setConfirmRevoke(false);
    setDeleteStep(false);
    setDeleteValue("");
    setDeleteError(null);
    try {
      setDetail(await getManagedCandidateDetail(email));
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setDetailLoading(false);
    }
  }

  function closeCandidate() {
    setSelectedEmail(null);
    setDetail(null);
    setDetailError(null);
    setAction(null);
    setConfirmRevoke(false);
    setDeleteStep(false);
    setDeleteValue("");
    setDeleteError(null);
  }

  async function toggleDisabled() {
    if (!detail) return;
    const disabled = isDisabled(detail.account);
    setAction("toggle");
    setDetailError(null);
    setNotice(null);
    try {
      await setManagedCandidateDisabled(detail.account.email, !disabled);
      await load(false);
      await refreshDetail(detail.account.email);
      setNotice(
        disabled
          ? `${detail.account.email} hesabı yeniden açıldı.`
          : `${detail.account.email} devre dışı bırakıldı; açık oturumları kapatıldı.`,
      );
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setAction(null);
    }
  }

  async function sendReset() {
    if (!detail) return;
    setAction("reset");
    setDetailError(null);
    setNotice(null);
    try {
      await sendManagedCandidatePasswordReset(detail.account.email);
      setNotice(`${detail.account.email} adresine şifre sıfırlama bağlantısı gönderildi.`);
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setAction(null);
    }
  }

  async function revokeSessions() {
    if (!detail) return;
    setAction("revoke");
    setDetailError(null);
    setNotice(null);
    try {
      await revokeManagedCandidateSessions(detail.account.email);
      setConfirmRevoke(false);
      await refreshDetail(detail.account.email);
      setNotice(`${detail.account.email} için açık oturumlar sonlandırıldı.`);
    } catch (err) {
      setDetailError(errorMessage(err));
    } finally {
      setAction(null);
    }
  }

  async function deleteCandidate() {
    if (!detail) return;
    const email = detail.account.email;
    if (deleteValue.trim().toLowerCase() !== email.toLowerCase()) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      const paths = detail.attempts
        .map((attempt) => attempt.speaking_path)
        .filter((path): path is string => Boolean(path));
      await deleteCandidateRecordings(paths);
      await deleteManagedCandidate(email);
      closeCandidate();
      setNotice(`${email} hesabı ve aday verileri silindi.`);
      await load(false);
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  const canDelete = Boolean(
    detail && deleteValue.trim().toLowerCase() === detail.account.email.toLowerCase(),
  );

  return (
    <div>
      <PageHeader
        title="Kullanıcılar"
        description="Sisteme kaydolan adayları, sınav yaşam döngülerini ve hesap durumlarını tek yerden yönet."
        action={
          <Button
            variant="secondary"
            onClick={() => void load()}
            loading={loading}
            icon={<RefreshCw className="size-4" />}
          >
            Yenile
          </Button>
        }
      />

      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}
      {notice && <DismissibleNotice message={notice} onClose={() => setNotice(null)} />}

      <div className="mb-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <SummaryTile label="Toplam kullanıcı" value={counts.total} />
        <SummaryTile label="Aktif" value={counts.active} tone="success" />
        <SummaryTile label="Devre dışı" value={counts.disabled} tone="danger" />
        <SummaryTile label="Onay bekleyen" value={counts.unconfirmed} tone="warning" />
      </div>

      <Panel className="mb-4 p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[210px] flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
            <input
              className="field py-2 pl-8 text-[12.5px]"
              placeholder="İsim veya e-posta ara…"
              aria-label="Kullanıcı ara"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <select
            className="field w-auto py-2 text-[12.5px]"
            aria-label="Hesap durumu"
            value={status}
            onChange={(event) => setStatus(event.target.value as StatusFilter)}
          >
            <option value="all">Tüm durumlar</option>
            <option value="active">Aktif</option>
            <option value="disabled">Devre dışı</option>
            <option value="unconfirmed">Onay bekleyen</option>
          </select>
          <span className="px-1 text-[11.5px] text-faint tabular-nums">
            {visibleRows.length === rows.length
              ? `${rows.length} kullanıcı`
              : `${visibleRows.length} / ${rows.length} kullanıcı`}
          </span>
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              icon={<FilterX className="size-3.5" />}
            >
              Temizle
            </Button>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-line/70 pt-3">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold tracking-[0.1em] text-faint uppercase">
            <CalendarRange className="size-3.5" />
            Tarih
          </span>
          <div className="inline-flex flex-wrap gap-0.5 rounded-xl border border-white/80 bg-white/50 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
            {DATE_PRESETS.map((preset) => (
              <button
                key={preset.value}
                type="button"
                aria-pressed={datePreset === preset.value}
                onClick={() => setDatePreset(preset.value)}
                className={cn(
                  "focus-ring rounded-lg px-2.5 py-1 text-[11.5px] font-medium transition",
                  datePreset === preset.value
                    ? "bg-[linear-gradient(135deg,#16243d_0%,#2b4a7d_100%)] text-white shadow-[0_8px_18px_-14px_rgba(18,35,62,0.9)]"
                    : "text-muted hover:bg-white/70 hover:text-ink",
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {datePreset === "custom" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <input
                type="date"
                className="field w-auto py-1.5 text-[11.5px]"
                aria-label="Başlangıç tarihi"
                value={fromDate}
                max={toDate || undefined}
                onChange={(event) => setFromDate(event.target.value)}
              />
              <span className="text-faint">–</span>
              <input
                type="date"
                className="field w-auto py-1.5 text-[11.5px]"
                aria-label="Bitiş tarihi"
                value={toDate}
                min={fromDate || undefined}
                onChange={(event) => setToDate(event.target.value)}
              />
            </div>
          )}

          <span className="hidden h-4 w-px bg-line sm:block" />
          <span className="text-[10px] font-semibold tracking-[0.1em] text-faint uppercase">
            Aktivite
          </span>
          <select
            className="field w-auto py-2 text-[12px]"
            aria-label="Aktivite türü"
            value={activity}
            onChange={(event) => setActivity(event.target.value as ActivityFilter)}
          >
            {ACTIVITY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      {loading ? (
        <div className="flex justify-center py-20 text-muted">
          <Spinner className="size-5" />
        </div>
      ) : visibleRows.length === 0 ? (
        <EmptyState
          icon={<UsersIcon className="size-5" />}
          title={rows.length === 0 ? "Henüz kayıtlı kullanıcı yok" : "Eşleşen kullanıcı bulunamadı"}
          description={
            rows.length === 0
              ? "Adaylar ana sayfadaki Crear cuenta formuyla kayıt olduğunda burada görünür."
              : "Arama, durum, tarih veya aktivite filtresini değiştirmeyi dene."
          }
        />
      ) : (
        <Panel className="overflow-hidden">
          <ul className="divide-y divide-[#f1f1f4]">
            {visibleRows.map((row) => {
              const accountStatus = candidateStatus(row);
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => void openCandidate(row.email)}
                    className="group flex w-full flex-col gap-3 px-4 py-4 text-left transition hover:bg-[#fcfcfe] sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[linear-gradient(145deg,#eef4ff,#dce9ff)] text-[11px] font-semibold text-[#1b54d9] ring-1 ring-white/90">
                        {initials(row.full_name)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-[13.5px] font-medium">{row.full_name}</p>
                          <Badge tone={accountStatus.tone}>{accountStatus.label}</Badge>
                        </div>
                        <p className="truncate text-[11.5px] text-faint">{row.email}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-[52px] text-[11.5px] text-muted sm:justify-end sm:pl-0">
                      <span className="inline-flex items-center gap-1">
                        <ClipboardList className="size-3.5 text-faint" />
                        {row.assignments_count} atama
                      </span>
                      <span>
                        {row.attempts_count} sınav
                        {row.pending_count > 0 && (
                          <span className="ml-1 text-warning">· {row.pending_count} bekliyor</span>
                        )}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock3 className="size-3.5 text-faint" />
                        {row.latest_activity ? formatDate(row.latest_activity) : "Hareket yok"}
                      </span>
                      <ChevronRight className="size-4 text-faint transition group-hover:translate-x-0.5 group-hover:text-ink" />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {selectedEmail && (
        <Modal
          open
          onClose={() => {
            if (deleteStep) {
              setDeleteStep(false);
              setDeleteValue("");
              setDeleteError(null);
            } else {
              closeCandidate();
            }
          }}
          wide
          title={
            deleteStep
              ? "Hesabı kalıcı olarak sil"
              : detail?.account.full_name || selectedSummary?.full_name || selectedEmail
          }
          description={deleteStep ? detail?.account.email ?? selectedEmail : selectedEmail}
          footer={
            deleteStep ? (
              <>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setDeleteStep(false);
                    setDeleteValue("");
                    setDeleteError(null);
                  }}
                >
                  Vazgeç
                </Button>
                <Button
                  variant="danger"
                  onClick={() => void deleteCandidate()}
                  loading={deleting}
                  disabled={!canDelete}
                >
                  Hesabı kalıcı olarak sil
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={closeCandidate}>
                Kapat
              </Button>
            )
          }
        >
          {deleteStep && detail ? (
            <div className="space-y-4">
              <Notice tone="danger">
                Bu işlem geri alınamaz. Auth hesabı, tüm sınav atamaları, taslaklar ve sınav
                kayıtları kalıcı olarak silinir.
              </Notice>
              <div className="grid gap-2 text-[12.5px] sm:grid-cols-3">
                <DataPill label="Atama" value={detail.assignments.length} />
                <DataPill label="Sınav" value={detail.attempts.length} />
                <DataPill label="Taslak" value={detail.drafts.length} />
              </div>
              {deleteError && <Notice tone="danger">{deleteError}</Notice>}
              <Field
                label="Onaylamak için e-posta adresini yaz"
                hint={`Silinecek hesap: ${detail.account.email}`}
                htmlFor="delete-candidate-email"
              >
                <input
                  id="delete-candidate-email"
                  className="field"
                  autoComplete="off"
                  placeholder={detail.account.email}
                  value={deleteValue}
                  onChange={(event) => setDeleteValue(event.target.value)}
                />
              </Field>
            </div>
          ) : detailLoading ? (
            <div className="flex justify-center py-16 text-muted">
              <Spinner className="size-5" />
            </div>
          ) : detailError ? (
            <Notice tone="danger">{detailError}</Notice>
          ) : detail ? (
            <div className="space-y-4">
              {notice && <DismissibleNotice message={notice} onClose={() => setNotice(null)} />}
              {detailError && <Notice tone="danger">{detailError}</Notice>}
              {isDisabled(detail.account) && (
                <Notice tone="warning">
                  Bu hesap devre dışı. Kullanıcı yeni oturum açamaz; yeniden açtığında tüm atama ve
                  sınav kayıtları korunur.
                </Notice>
              )}
              {!detail.account.email_confirmed_at && !isDisabled(detail.account) && (
                <Notice tone="warning">
                  E-posta adresi henüz doğrulanmadı. Kullanıcı giriş yaparken sorun yaşayabilir.
                </Notice>
              )}

              <Panel className="p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-[18px] font-semibold tracking-[-0.02em]">
                        {detail.account.full_name}
                      </h2>
                      <Badge
                        tone={
                          isDisabled(detail.account)
                            ? "danger"
                            : isUnconfirmed(detail.account)
                              ? "warning"
                              : "success"
                        }
                      >
                        {isDisabled(detail.account)
                          ? "Devre dışı"
                          : isUnconfirmed(detail.account)
                            ? "Onay bekliyor"
                            : "Aktif"}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-[12.5px] text-muted">{detail.account.email}</p>
                    <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-[11.5px] text-faint">
                      <span>Kayıt: {dateText(detail.account.created_at)}</span>
                      <span>Son giriş: {dateText(detail.account.last_sign_in_at, "Henüz yok")}</span>
                      <span>Açık oturum: {detail.account.sessions}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={isDisabled(detail.account) ? "secondary" : "dark"}
                      onClick={() => void toggleDisabled()}
                      loading={action === "toggle"}
                      disabled={action !== null}
                      icon={
                        isDisabled(detail.account) ? (
                          <ShieldCheck className="size-3.5" />
                        ) : (
                          <ShieldOff className="size-3.5" />
                        )
                      }
                    >
                      {isDisabled(detail.account) ? "Yeniden aç" : "Devre dışı bırak"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => void sendReset()}
                      loading={action === "reset"}
                      disabled={action !== null}
                      icon={<Mail className="size-3.5" />}
                    >
                      Şifre sıfırlama gönder
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setConfirmRevoke(true)}
                      disabled={action !== null || detail.account.sessions === 0}
                      icon={<LogOut className="size-3.5" />}
                    >
                      Oturumları sonlandır
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => {
                        setDeleteStep(true);
                        setDeleteValue("");
                        setDeleteError(null);
                      }}
                      disabled={action !== null}
                      icon={<Trash2 className="size-3.5" />}
                    >
                      Hesabı sil
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <DataPill label="Atama" value={detail.assignments.length} />
                  <DataPill label="Sınav" value={detail.attempts.length} />
                  <DataPill label="Taslak" value={detail.drafts.length} />
                  <DataPill
                    label="Katılım belgesi"
                    value={detail.attempts.filter((attempt) => attempt.certificate_code).length}
                  />
                </div>

                {confirmRevoke && (
                  <div className="mt-4 rounded-xl border border-[#f1e0c5] bg-[#fdf8ef]/90 p-3.5 text-[12px] leading-relaxed text-warning">
                    <p>
                      {detail.account.sessions} açık oturum kapatılacak. Kullanıcı yeniden giriş
                      yapmak zorunda kalacak.
                    </p>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmRevoke(false)}
                        disabled={action === "revoke"}
                      >
                        Vazgeç
                      </Button>
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => void revokeSessions()}
                        loading={action === "revoke"}
                      >
                        Oturumları kapat
                      </Button>
                    </div>
                  </div>
                )}
              </Panel>

              <Panel className="p-4">
                <SectionTitle
                  icon={<Activity className="size-4 text-accent" />}
                  title="Hareket geçmişi"
                  detail="Hesap ve sınav yaşam döngüsü"
                />
                <LifecycleTimeline detail={detail} />
              </Panel>

              <div className="grid gap-4 xl:grid-cols-2">
                <Panel className="p-4">
                  <SectionTitle
                    icon={<CalendarClock className="size-4 text-accent" />}
                    title="Atamalar"
                    detail={`${detail.assignments.length} kayıt`}
                  />
                  {detail.assignments.length === 0 ? (
                    <EmptyLine text="Bu kullanıcıya henüz sınav atanmadı." />
                  ) : (
                    <ul className="divide-y divide-[#f1f1f4]">
                      {detail.assignments.map((assignment) => (
                        <li key={assignment.id} className="py-3 first:pt-0 last:pb-0">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <LevelBadge level={assignment.level} />
                                <p className="text-[12.5px] font-medium">
                                  {assignment.title || `${assignment.level} sınavı`}
                                </p>
                              </div>
                              {assignment.note && (
                                <p className="mt-1 line-clamp-2 text-[11.5px] leading-relaxed text-muted">
                                  {assignment.note}
                                </p>
                              )}
                              <p className="mt-1.5 text-[11px] text-faint">
                                Atandı {formatDate(assignment.created_at)}
                              </p>
                            </div>
                            <Badge tone={attemptStatusTone(assignment.attempt_status)}>
                              {attemptStatusLabel(assignment.attempt_status)}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>

                <Panel className="p-4">
                  <SectionTitle
                    icon={<ClipboardList className="size-4 text-accent" />}
                    title="Sınavlar"
                    detail={`${detail.attempts.length} kayıt`}
                  />
                  {detail.attempts.length === 0 ? (
                    <EmptyLine text="Henüz gönderilmiş bir sınav yok." />
                  ) : (
                    <ul className="divide-y divide-[#f1f1f4]">
                      {detail.attempts.map((attempt) => {
                        const percent = testPercent(attempt);
                        const total = weightedTotal(attempt);
                        return (
                          <li key={attempt.id} className="py-3 first:pt-0 last:pb-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <LevelBadge level={attempt.level} />
                                  <p className="text-[12.5px] font-medium">
                                    {attempt.mc_correct ?? 0}/{attempt.mc_total ?? 0} test doğru
                                  </p>
                                  {percent !== null && (
                                    <span className="text-[11px] text-faint">%{percent}</span>
                                  )}
                                </div>
                                <p className="mt-1.5 text-[11px] text-faint">
                                  Gönderildi {formatDate(attempt.submitted_at)}
                                  {total !== null && ` · Genel ${total}/100`}
                                </p>
                                {attempt.certificate_code && (
                                  <p className="mt-1 text-[11px] text-success">
                                    Katılım belgesi: {attempt.certificate_code}
                                  </p>
                                )}
                              </div>
                              <Badge tone={attempt.status === "graded" ? "success" : "warning"}>
                                {attempt.status === "graded" ? "Değerlendirildi" : "Bekliyor"}
                              </Badge>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Panel>
              </div>

              {detail.drafts.length > 0 && (
                <Panel className="p-4">
                  <SectionTitle
                    icon={<FileText className="size-4 text-accent" />}
                    title="Devam eden taslaklar"
                    detail="Sunucuda saklanan sınav ilerlemesi"
                  />
                  <ul className="divide-y divide-[#f1f1f4]">
                    {detail.drafts.map((draft) => (
                      <li key={draft.code} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <LevelBadge level={draft.level} />
                            <span className="rounded bg-[#f3f3f6] px-1.5 py-0.5 font-mono text-[10.5px] text-muted">
                              {draft.code}
                            </span>
                            <span className="text-[11.5px] text-muted">
                              {draft.answered} test cevabı
                              {draft.listening_answered > 0 &&
                                ` · ${draft.listening_answered} dinleme cevabı`}
                              {draft.writing_chars > 0 && ` · ${draft.writing_chars} karakter`}
                            </span>
                          </div>
                          <span className="text-[11px] text-faint">
                            Son kayıt {formatDate(draft.updated_at)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </Panel>
              )}
            </div>
          ) : null}
        </Modal>
      )}

    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: Tone;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning"
          : "text-ink";
  return (
    <Panel className="px-4 py-3.5">
      <p className="text-[10px] font-semibold tracking-[0.1em] text-faint uppercase">{label}</p>
      <p className={cn("mt-1.5 text-[24px] leading-none font-semibold tabular-nums", color)}>
        {value}
      </p>
    </Panel>
  );
}

function DataPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-line bg-[#fcfcfe] px-3 py-2">
      <p className="text-[10px] font-medium tracking-[0.06em] text-faint uppercase">{label}</p>
      <p className="mt-0.5 text-[16px] font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function SectionTitle({
  icon,
  title,
  detail,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-[12.5px] font-semibold">{title}</h3>
      </div>
      <span className="text-[10.5px] text-faint">{detail}</span>
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-xl bg-[#fcfcfe] px-3 py-4 text-[11.5px] text-faint">{text}</p>;
}

function DismissibleNotice({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="mb-4 flex items-start gap-2">
      <div className="flex-1">
        <Notice tone="success">{message}</Notice>
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="Bildirimi kapat"
        className="rounded-lg p-1.5 text-faint transition hover:bg-[#f3f3f6] hover:text-ink"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function LifecycleTimeline({ detail }: { detail: ManagedCandidateDetail }) {
  const events = useMemo(() => {
    const list: Array<{
      at: string;
      title: string;
      detail: string;
      tone: Tone;
    }> = [
      {
        at: detail.account.created_at,
        title: "Hesap oluşturuldu",
        detail: detail.account.email,
        tone: "accent",
      },
    ];

    if (detail.account.last_sign_in_at) {
      list.push({
        at: detail.account.last_sign_in_at,
        title: "Siteye giriş yaptı",
        detail: detail.account.email,
        tone: "success",
      });
    }

    for (const assignment of detail.assignments) {
      list.push({
        at: assignment.created_at,
        title: "Sınav atandı",
        detail: `${assignment.level}${assignment.title ? ` · ${assignment.title}` : ""}`,
        tone: "neutral",
      });
    }

    for (const draft of detail.drafts) {
      list.push({
        at: draft.updated_at,
        title: "Taslak kaydedildi",
        detail: `${draft.level} · ${draft.answered} test cevabı`,
        tone: "warning",
      });
    }

    for (const attempt of detail.attempts) {
      list.push({
        at: attempt.submitted_at,
        title: "Sınav gönderildi",
        detail: `${attempt.level} · ${
          attempt.status === "graded" ? "değerlendirildi" : "değerlendirme bekliyor"
        }`,
        tone: attempt.status === "graded" ? "success" : "warning",
      });
      if (attempt.certificate_issued_at) {
        list.push({
          at: attempt.certificate_issued_at,
          title: "Katılım belgesi oluşturuldu",
          detail: `${attempt.level} · ${attempt.certificate_code ?? ""}`,
          tone: "success",
        });
      }
    }

    return list
      .filter((event) => event.at)
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 16);
  }, [detail]);

  const dotClass: Record<Tone, string> = {
    success: "bg-success ring-[#eef8f1]",
    warning: "bg-warning ring-[#fdf8ef]",
    danger: "bg-danger ring-[#fdf0f0]",
    neutral: "bg-[#94a3b8] ring-[#f1f5f9]",
    accent: "bg-accent ring-[#eef3ff]",
  };

  return (
    <ol className="relative space-y-3 before:absolute before:top-2 before:bottom-2 before:left-[4px] before:w-px before:bg-line">
      {events.map((event, index) => (
        <li key={`${event.at}-${event.title}-${index}`} className="relative pl-5">
          <span
            className={cn(
              "absolute top-1.5 left-0 size-[9px] rounded-full ring-4",
              dotClass[event.tone],
            )}
          />
          <p className="text-[12px] font-medium">{event.title}</p>
          <p className="mt-0.5 text-[11.5px] text-muted">
            {event.detail} · {formatDate(event.at)}
          </p>
        </li>
      ))}
    </ol>
  );
}

function attemptStatusLabel(status: ManagedCandidateDetail["assignments"][number]["attempt_status"]): string {
  if (status === "graded") return "Değerlendirildi";
  if (status === "submitted") return "Bekliyor";
  return "Başlamadı";
}

function attemptStatusTone(
  status: ManagedCandidateDetail["assignments"][number]["attempt_status"],
): Tone {
  if (status === "graded") return "success";
  if (status === "submitted") return "warning";
  return "neutral";
}

