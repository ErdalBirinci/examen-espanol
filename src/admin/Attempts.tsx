import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Download, FileDown, Search, Trash2 } from "lucide-react";
import {
  deleteAttempt,
  gradeAttempt,
  listAllListeningQuestions,
  listAttemptAudit,
  listAttemptsForExport,
  listAttemptsPage,
  listListening,
  listQuestions,
  nextPendingAttempt,
  notifyAttemptResult,
  signedRecordingUrl,
} from "../lib/api";
import {
  LEVELS,
  type Attempt,
  type AttemptIntegrity,
  type GradingAuditEntry,
  type Level,
  type ListeningItem,
  type ListeningQuestionAdmin,
  type QuestionAdmin,
  type SpeakingRubric,
  type WritingRubric,
} from "../lib/types";
import { cn, errorMessage, formatDate, formatSeconds } from "../lib/utils";
import { attemptToResult, attemptTotal } from "../lib/scoring";
import { downloadResultReport } from "../lib/resultReport";
import {
  answerSheetFileName,
  downloadAnswerSheet,
  listeningAnswerRows,
  listeningSheet,
  testAnswerRows,
  testSheet,
} from "../lib/answerReport";
import { attemptsCsvFileName, attemptsToCsv } from "../lib/attemptExport";
import { Badge, Button, EmptyState, Field, Modal, Notice, Spinner } from "../components/ui";
import { ConfirmDialog, LevelBadge, PageHeader, Panel } from "./shared";

type StatusFilter = "all" | "submitted" | "graded";

export default function Attempts() {
  const PAGE_SIZE = 25;
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<Level | "all">("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Attempt | null>(null);
  const [toDelete, setToDelete] = useState<Attempt | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [queueMode, setQueueMode] = useState(false);
  const [queueLoading, setQueueLoading] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Debounce typing so one request runs per pause, not per keystroke.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), 350);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [level, status, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAttemptsPage({
        level,
        status,
        search,
        page,
        pageSize: PAGE_SIZE,
      });
      setAttempts(result.rows);
      setTotal(result.total);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [level, status, search, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteAttempt(toDelete.id);
      setAttempts((prev) => prev.filter((item) => item.id !== toDelete.id));
      setTotal((value) => Math.max(0, value - 1));
      if (selected?.id === toDelete.id) setSelected(null);
      setToDelete(null);
      if (attempts.length === 1 && page > 1) setPage((value) => value - 1);
      else void load();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  async function handleExport() {
    setExporting(true);
    try {
      const rows = await listAttemptsForExport({ level, status, search });
      if (rows.length === 0) {
        setError("Bu filtreyle dışa aktarılacak kayıt yok.");
        return;
      }
      const blob = new Blob([attemptsToCsv(rows)], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attemptsCsvFileName();
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  function updateAttempt(updated: Attempt) {
    setAttempts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelected(updated);
  }

  async function openQueue() {
    setQueueLoading(true);
    setError(null);
    setNotice(null);
    try {
      const next = await nextPendingAttempt();
      if (!next) {
        setNotice("Değerlendirme bekleyen kayıt yok.");
        return;
      }
      setQueueMode(true);
      setSelected(next);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setQueueLoading(false);
    }
  }

  async function handleNext(currentId: string) {
    setQueueLoading(true);
    try {
      const next = await nextPendingAttempt(currentId);
      void load();
      if (next) {
        setSelected(next);
      } else {
        setSelected(null);
        setQueueMode(false);
        setNotice("Değerlendirme kuyruğu tamamlandı.");
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setQueueLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Sınav Sonuçları"
        description="Adayların gönderdiği sınavları incele, dinleme–yazma–konuşma puanlarını gir."
        action={
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-line bg-white px-3 py-1.5 text-[12px] text-muted">
              {total} kayıt
            </span>
            <Button
              variant="secondary"
              onClick={() => void openQueue()}
              loading={queueLoading}
              icon={<ChevronRight className="size-3.5" />}
            >
              Sıradaki bekleyen
            </Button>
            <Button
              variant="secondary"
              onClick={() => void handleExport()}
              loading={exporting}
              icon={<Download className="size-3.5" />}
            >
              CSV indir
            </Button>
          </div>
        }
      />

      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      {notice && (
        <div className="mb-4">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}

      <Panel className="mb-4 flex flex-wrap items-center gap-2 p-3">
        <div className="relative min-w-[190px] flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-3.5 -translate-y-1/2 text-faint" />
          <input
            className="field py-2 pl-8 text-[12.5px]"
            placeholder="İsim veya e-posta ara…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <select
          className="field w-auto py-2 text-[12.5px]"
          value={level}
          onChange={(event) => setLevel(event.target.value as Level | "all")}
        >
          <option value="all">Tüm seviyeler</option>
          {LEVELS.map((code) => (
            <option key={code} value={code}>
              {code}
            </option>
          ))}
        </select>
        <select
          className="field w-auto py-2 text-[12.5px]"
          value={status}
          onChange={(event) => setStatus(event.target.value as StatusFilter)}
        >
          <option value="all">Tüm durumlar</option>
          <option value="submitted">Değerlendirme bekleyen</option>
          <option value="graded">Değerlendirildi</option>
        </select>
      </Panel>

      {loading ? (
        <div className="flex justify-center py-20 text-muted">
          <Spinner className="size-5" />
        </div>
      ) : attempts.length === 0 ? (
        <EmptyState
          title="Kayıt bulunamadı"
          description="Filtreleri değiştir ya da adayların sınav tamamlamasını bekle."
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="hidden grid-cols-[1.6fr_0.6fr_0.7fr_0.7fr_0.9fr_0.8fr_auto] gap-3 border-b border-line bg-[#fcfcfe] px-4 py-2.5 text-[10.5px] font-semibold tracking-[0.06em] text-faint uppercase md:grid">
            <span>Aday</span>
            <span>Seviye</span>
            <span>Test</span>
            <span>Genel</span>
            <span>Tarih</span>
            <span>Durum</span>
            <span />
          </div>
          <ul className="divide-y divide-[#f1f1f4]">
            {attempts.map((attempt) => {
              const percent =
                attempt.mc_total && attempt.mc_total > 0
                  ? Math.round(((attempt.mc_correct ?? 0) / attempt.mc_total) * 100)
                  : null;
              const total = attemptTotal(attempt);
              return (
                <li
                  key={attempt.id}
                  className="grid cursor-pointer grid-cols-2 items-center gap-2 px-4 py-3 transition hover:bg-[#fcfcfe] md:grid-cols-[1.6fr_0.6fr_0.7fr_0.7fr_0.9fr_0.8fr_auto]"
                  onClick={() => setSelected(attempt)}
                >
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <p className="truncate text-[13px] font-medium">{attempt.full_name}</p>
                    <p className="truncate text-[11px] text-faint">{attempt.email}</p>
                  </div>
                  <div>
                    <LevelBadge level={attempt.level} />
                  </div>
                  <div className="text-[12px] tabular-nums">
                    {percent === null ? (
                      <span className="text-faint">—</span>
                    ) : (
                      <span className="font-medium">
                        {attempt.mc_correct}/{attempt.mc_total}
                        <span className="ml-1 text-[11px] text-faint">%{percent}</span>
                      </span>
                    )}
                  </div>
                  <div className="text-[12px] font-medium tabular-nums">
                    {total === null ? <span className="font-normal text-faint">—</span> : total}
                  </div>
                  <div className="text-[11.5px] text-muted">{formatDate(attempt.created_at)}</div>
                  <div>
                    <Badge tone={attempt.status === "graded" ? "success" : "warning"}>
                      {attempt.status === "graded" ? "Değerlendirildi" : "Bekliyor"}
                    </Badge>
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setToDelete(attempt);
                      }}
                      className="rounded-lg p-1.5 text-faint transition hover:bg-[#fdf0f0] hover:text-danger"
                      aria-label="Sil"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </Panel>
      )}

      {!loading && total > PAGE_SIZE && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[11.5px] text-muted">
            Sayfa {page} / {pageCount} · {total} kayıt
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              disabled={page <= 1 || loading}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Önceki
            </Button>
            <Button
              variant="secondary"
              disabled={page >= pageCount || loading}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            >
              Sonraki
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <AttemptDetail
          key={selected.id}
          attempt={selected}
          onClose={() => {
            setSelected(null);
            setQueueMode(false);
          }}
          onSaved={updateAttempt}
          onNext={queueMode ? () => void handleNext(selected.id) : undefined}
        />
      )}

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Sınav kaydını sil"
        description={toDelete ? `${toDelete.full_name} · ${toDelete.email}` : ""}
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}

function AttemptDetail({
  attempt,
  onClose,
  onSaved,
  onNext,
}: {
  attempt: Attempt;
  onClose: () => void;
  onSaved: (attempt: Attempt) => void;
  onNext?: () => void;
}) {
  const [questions, setQuestions] = useState<QuestionAdmin[]>([]);
  const [listening, setListening] = useState<ListeningItem[]>([]);
  const [listeningQuestions, setListeningQuestions] = useState<ListeningQuestionAdmin[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [scores, setScores] = useState({
    part1: attempt.writing_part1_score?.toString() ?? "",
    part2: attempt.writing_part2_score?.toString() ?? "",
    speaking1: attempt.speaking_part1_score?.toString() ?? "",
    speaking2: attempt.speaking_part2_score?.toString() ?? "",
    legacyListening: attempt.listening_score?.toString() ?? "",
    legacyWriting: attempt.writing_score?.toString() ?? "",
    legacySpeaking: attempt.speaking_score?.toString() ?? "",
    note: attempt.admin_note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState(false);
  const [audit, setAudit] = useState<GradingAuditEntry[]>([]);
  const [rubric, setRubric] = useState(() => initialRubric(attempt));
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfSection, setPdfSection] = useState<"test" | "listening" | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [qs, ls, allListeningQuestions, history] = await Promise.all([
          listQuestions(attempt.level),
          listListening(attempt.level),
          listAllListeningQuestions(),
          listAttemptAudit(attempt.id).catch(() => []),
        ]);
        if (active) {
          const testIds = attempt.test_question_ids ?? [];
          const listeningIds = attempt.listening_question_ids ?? [];
          setQuestions(
            testIds.length > 0
              ? testIds
                  .map((id) => qs.find((question) => question.id === id))
                  .filter((question): question is QuestionAdmin => Boolean(question))
              : qs,
          );
          setListeningQuestions(
            listeningIds.length > 0
              ? listeningIds
                  .map((id) => allListeningQuestions.find((question) => question.id === id))
                  .filter((question): question is ListeningQuestionAdmin => Boolean(question))
              : [],
          );
          setListening(ls);
          setAudit(history);
        }
        if (attempt.speaking_path) {
          const url = await signedRecordingUrl(attempt.speaking_path);
          if (active) setAudioUrl(url);
        }
      } catch (err) {
        if (active) setError(errorMessage(err));
      }
    })();
    return () => {
      active = false;
    };
  }, [attempt]);

  async function save(advance = false) {
    setAdvancing(advance);
    setSaving(true);
    setError(null);
    try {
      const isV2 = attempt.scoring_version >= 2;
      const part1 = scores.part1 ? Number(scores.part1) : null;
      const part2 = scores.part2 ? Number(scores.part2) : null;
      const speaking1 = scores.speaking1 ? Number(scores.speaking1) : null;
      const speaking2 = scores.speaking2 ? Number(scores.speaking2) : null;
      const speaking =
        speaking1 !== null || speaking2 !== null ? (speaking1 ?? 0) + (speaking2 ?? 0) : null;
      const legacyListening = scores.legacyListening ? Number(scores.legacyListening) : null;
      const legacyWriting = scores.legacyWriting ? Number(scores.legacyWriting) : null;
      const legacySpeaking = scores.legacySpeaking ? Number(scores.legacySpeaking) : null;
      const note = scores.note.trim() || null;

      await gradeAttempt({
        id: attempt.id,
        scoring_version: attempt.scoring_version,
        writing_part1_score: isV2 ? part1 : null,
        writing_part2_score: isV2 ? part2 : null,
        speaking_part1_score: isV2 ? speaking1 : null,
        speaking_part2_score: isV2 ? speaking2 : null,
        speaking_score: isV2 ? speaking : legacySpeaking,
        admin_note: note,
        writing_rubric: isV2 && rubric.enabled ? rubric.writing : null,
        speaking_rubric: isV2 && rubric.enabled ? rubric.speaking : null,
        listening_score: isV2 ? attempt.listening_score : legacyListening,
        writing_score: isV2 ? null : legacyWriting,
      });

      const writingScore = isV2
        ? part1 === null && part2 === null
          ? null
          : (part1 ?? 0) + (part2 ?? 0)
        : legacyWriting;
      const graded = isV2
        ? part1 !== null && part2 !== null && speaking1 !== null && speaking2 !== null
        : legacyWriting !== null && legacySpeaking !== null;

      onSaved({
        ...attempt,
        writing_part1_score: isV2 ? part1 : attempt.writing_part1_score,
        writing_part2_score: isV2 ? part2 : attempt.writing_part2_score,
        writing_score: writingScore,
        speaking_part1_score: isV2 ? speaking1 : attempt.speaking_part1_score,
        speaking_part2_score: isV2 ? speaking2 : attempt.speaking_part2_score,
        speaking_score: isV2 ? speaking : legacySpeaking,
        listening_score: isV2 ? attempt.listening_score : legacyListening,
        writing_rubric: isV2 && rubric.enabled ? rubric.writing : null,
        speaking_rubric: isV2 && rubric.enabled ? rubric.speaking : null,
        graded_at: graded ? (attempt.graded_at ?? new Date().toISOString()) : attempt.graded_at,
        admin_note: note,
        status: graded ? "graded" : "submitted",
      });

      if (advance) onNext?.();

      const notification = await notifyAttemptResult(attempt.id);
      if (notification.sent) {
        setEmailWarning(false);
        setEmailNotice("Sonuç e-postası adaya gönderildi.");
      } else if (notification.reason === "already_sent") {
        setEmailWarning(false);
        setEmailNotice("Sonuç e-postası daha önce gönderilmiş.");
      } else if (notification.reason === "email_not_configured") {
        setEmailWarning(true);
        setEmailNotice(
          "E-posta servisi yapılandırılmadı: Supabase Edge Function secret'larına RESEND_API_KEY ve RESULT_FROM_EMAIL ekle.",
        );
      } else if (notification.reason === "not_graded") {
        setEmailWarning(true);
        setEmailNotice("E-posta gönderilmedi: sınav henüz değerlendirilmiş sayılmıyor.");
      } else {
        setEmailWarning(true);
        setEmailNotice(`Sonuç e-postası gönderilemedi (${notification.reason ?? "bilinmeyen hata"}).`);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
      setAdvancing(false);
    }
  }

  async function downloadPdf() {
    setPdfBusy(true);
    setPdfError(null);
    try {
      const testRows = testAnswerRows(attempt, questions);
      const listeningRows = listeningAnswerRows(attempt, listeningQuestions);
      await downloadResultReport(attemptToResult(attempt), {
        sheets: [
          ...(testRows.length > 0 ? [testSheet(attempt, testRows)] : []),
          ...(listeningRows.length > 0 ? [listeningSheet(attempt, listeningRows)] : []),
        ],
      });
    } catch (err) {
      setPdfError(errorMessage(err));
    } finally {
      setPdfBusy(false);
    }
  }

  /** Single-section answer sheet, for sending one part at a time. */
  async function downloadSectionPdf(section: "test" | "listening") {
    setPdfSection(section);
    setPdfError(null);
    try {
      const rows =
        section === "test"
          ? testAnswerRows(attempt, questions)
          : listeningAnswerRows(attempt, listeningQuestions);
      const sheet = section === "test" ? testSheet(attempt, rows) : listeningSheet(attempt, rows);
      await downloadAnswerSheet(
        {
          title: "Boletín de respuestas",
          reference: attempt.id.slice(0, 8).toUpperCase(),
          candidate: attempt.full_name,
          level: attempt.level,
          submittedAt: attempt.submitted_at,
        },
        [sheet],
        answerSheetFileName(section === "test" ? "respuestas-test" : "respuestas-dinleme", attempt),
      );
    } catch (err) {
      setPdfError(errorMessage(err));
    } finally {
      setPdfSection(null);
    }
  }

  function toggleRubric(enabled: boolean) {
    if (!enabled) {
      setRubric((prev) => ({ ...prev, enabled: false }));
      return;
    }
    const p1 = splitTotal(Number(scores.part1 || 0), 2);
    const p2 = splitTotal(Number(scores.part2 || 0), 2);
    const s1 = splitTotal(Number(scores.speaking1 || 0), 2);
    const s2 = splitTotal(Number(scores.speaking2 || 0), 2);
    setRubric({
      enabled: true,
      writing: {
        part1: { task: p1[0], language: p1[1] },
        part2: { task: p2[0], language: p2[1] },
      },
      speaking: {
        part1: { content: s1[0], language: s1[1] },
        part2: { content: s2[0], language: s2[1] },
      },
    });
  }

  function setWritingCriterion(
    part: "part1" | "part2",
    key: keyof WritingRubric["part1"],
    value: number,
  ) {
    const writing: WritingRubric = {
      ...rubric.writing,
      [part]: { ...rubric.writing[part], [key]: value },
    };
    setRubric((prev) => ({ ...prev, writing }));
    setScores((prev) => ({
      ...prev,
      part1: String(writing.part1.task + writing.part1.language),
      part2: String(writing.part2.task + writing.part2.language),
    }));
  }

  function setSpeakingCriterion(
    part: "part1" | "part2",
    key: keyof SpeakingRubric["part1"],
    value: number,
  ) {
    const speaking: SpeakingRubric = {
      ...rubric.speaking,
      [part]: { ...rubric.speaking[part], [key]: value },
    };
    setRubric((prev) => ({ ...prev, speaking }));
    setScores((prev) => ({
      ...prev,
      speaking1: String(speaking.part1.content + speaking.part1.language),
      speaking2: String(speaking.part2.content + speaking.part2.language),
    }));
  }

  const percent =
    attempt.mc_total && attempt.mc_total > 0
      ? Math.round(((attempt.mc_correct ?? 0) / attempt.mc_total) * 100)
      : null;

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={attempt.full_name}
      description={`${attempt.email} · ${formatDate(attempt.created_at)} · Seviye ${attempt.level}`}
      footer={
        <>
          <span className="mr-auto text-[11.5px] text-faint">
            {attempt.scoring_version >= 2
              ? "Yazma 0–10 + 0–10, konuşma 0–10 + 0–10. Test ve dinleme sunucuda otomatik puanlanır."
              : "Eski kayıt: puanlar 0–100 arasındadır."}
          </span>
          <Button
            variant="secondary"
            onClick={() => void downloadPdf()}
            loading={pdfBusy}
            disabled={attemptTotal(attempt) === null}
            icon={<FileDown className="size-3.5" />}
          >
            Sonuç PDF'i
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Kapat
          </Button>
          {onNext && (
            <Button variant="secondary" onClick={() => void save(true)} loading={saving && advancing}>
              Kaydet ve sıradakine geç
            </Button>
          )}
          <Button onClick={() => void save()} loading={saving && !advancing}>
            Değerlendirmeyi kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        {pdfError && <Notice tone="danger">{pdfError}</Notice>}
        {emailNotice && <Notice tone={emailWarning ? "warning" : "success"}>{emailNotice}</Notice>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreTile
            label="Test"
            value={
              attempt.mc_score !== null
                ? `${Math.round(Number(attempt.mc_score))} / 50`
                : percent === null
                  ? "—"
                  : `%${percent}`
            }
            detail={`${attempt.mc_correct ?? 0} / ${attempt.mc_total ?? 0} doğru`}
          />
          <ScoreTile
            label="Dinleme"
            value={
              attempt.listening_score !== null
                ? `${Math.round(Number(attempt.listening_score))} / ${attempt.scoring_version >= 2 ? 10 : 100}`
                : "—"
            }
            detail={
              attempt.listening_score !== null
                ? attempt.listening_total
                  ? `${attempt.listening_correct ?? 0} / ${attempt.listening_total} doğru`
                  : "puanlandı"
                : "bekliyor"
            }
          />
          <ScoreTile
            label="Yazma"
            value={
              attempt.writing_score !== null
                ? `${Math.round(Number(attempt.writing_score))} / ${attempt.scoring_version >= 2 ? 20 : 100}`
                : "—"
            }
            detail={
              attempt.scoring_version >= 2
                ? `Bölüm 1: ${attempt.writing_part1_score ?? "—"}/10 · Bölüm 2: ${attempt.writing_part2_score ?? "—"}/10`
                : attempt.writing_score !== null
                  ? "puanlandı"
                  : "bekliyor"
            }
          />
          <ScoreTile
            label="Konuşma"
            value={
              attempt.speaking_score !== null
                ? `${Math.round(Number(attempt.speaking_score))} / ${attempt.scoring_version >= 2 ? 20 : 100}`
                : "—"
            }
            detail={
              attempt.scoring_version >= 2 &&
              (attempt.speaking_part1_score !== null || attempt.speaking_part2_score !== null)
                ? `Bölüm 1: ${attempt.speaking_part1_score ?? "—"}/10 · Bölüm 2: ${attempt.speaking_part2_score ?? "—"}/10`
                : attempt.speaking_score !== null
                  ? "puanlandı"
                  : "bekliyor"
            }
          />
        </div>

        <p className="text-right text-[11.5px] text-muted">
          Toplam:{" "}
          <span className="font-semibold text-ink tabular-nums">{attemptTotal(attempt) ?? "—"}</span>{" "}
          / 100{" "}
          <span className="text-faint">
            {attempt.scoring_version >= 2
              ? "(50 test · 10 dinleme · 20 yazma · 20 konuşma)"
              : "(eski puanlama: %40 test · %20 dinleme · %20 yazma · %20 konuşma)"}
          </span>
        </p>

        <Card title="Test cevapları" action={
          <div className="flex items-center gap-3">
            <button
              onClick={() => void downloadSectionPdf("test")}
              disabled={questions.length === 0 || pdfSection !== null}
              className="flex items-center gap-1 text-[11.5px] font-medium text-accent-ink disabled:opacity-40"
            >
              {pdfSection === "test" ? (
                <Spinner className="size-3.5" />
              ) : (
                <FileDown className="size-3.5" />
              )}
              Sonuç PDF'i
            </button>
            <button
              onClick={() => setShowAnswers((value) => !value)}
              className="flex items-center gap-1 text-[11.5px] font-medium text-accent-ink"
            >
              {showAnswers ? "Gizle" : "Cevapları gör"}
              <ChevronDown className={cn("size-3.5 transition", showAnswers && "rotate-180")} />
            </button>
          </div>
        }>
          {showAnswers ? (
            questions.length === 0 ? (
              <p className="text-[12px] text-faint">Soru bulunamadı.</p>
            ) : (
              <ol className="max-h-72 space-y-2 overflow-y-auto pr-1">
                {questions.map((question, index) => {
                  const answer = attempt.mc_answers?.[question.id];
                  const correct = answer === question.correct_index;
                  return (
                    <li key={question.id} className="rounded-lg border border-line px-3 py-2">
                      <div className="flex items-start gap-2">
                        <span className="text-[11px] font-semibold text-faint tabular-nums">{index + 1}.</span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] leading-snug">{question.prompt}</p>
                          <p className="mt-1 text-[11.5px]">
                            <span className={correct ? "text-success" : "text-danger"}>
                              {answer === undefined ? "Boş" : question.options[answer]}
                            </span>
                            {!correct && (
                              <span className="text-faint">
                                {" "}· doğru: {question.options[question.correct_index]}
                              </span>
                            )}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            correct ? "bg-[#eef8f1] text-success" : "bg-[#fdf0f0] text-danger",
                          )}
                        >
                          {correct ? "D" : "Y"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )
          ) : (
            <p className="text-[12px] text-muted">
              {attempt.mc_correct ?? 0} doğru · {attempt.mc_total ?? 0} soru
              {percent !== null && ` · başarı %${percent}`}
            </p>
          )}
        </Card>

        <Card
          title="Dinleme cevapları"
          action={
            attempt.scoring_version >= 2 && listeningQuestions.length > 0 ? (
              <button
                onClick={() => void downloadSectionPdf("listening")}
                disabled={pdfSection !== null}
                className="flex items-center gap-1 text-[11.5px] font-medium text-accent-ink disabled:opacity-40"
              >
                {pdfSection === "listening" ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <FileDown className="size-3.5" />
                )}
                Sonuç PDF'i
              </button>
            ) : null
          }
        >
          {attempt.scoring_version >= 2 ? (
            listeningQuestions.length === 0 ? (
              <p className="text-[12px] text-faint">Bu sınavda dinleme sorusu bulunmuyor.</p>
            ) : (
              <ol className="max-h-80 space-y-2 overflow-y-auto pr-1">
                {listeningQuestions.map((question, index) => {
                  const answer = attempt.listening_answers?.[question.id];
                  const correct = answer === question.correct_index;
                  return (
                    <li key={question.id} className="rounded-lg border border-line px-3 py-2">
                      <div className="flex items-start gap-2">
                        <span className="text-[11px] font-semibold text-faint tabular-nums">
                          {index + 1}.
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] leading-snug">{question.prompt}</p>
                          <p className="mt-1 text-[11.5px]">
                            <span className={correct ? "text-success" : "text-danger"}>
                              {answer === undefined ? "Boş" : question.options[answer]}
                            </span>
                            {!correct && (
                              <span className="text-faint">
                                {" "}· doğru: {question.options[question.correct_index]}
                              </span>
                            )}
                          </p>
                        </div>
                        <span
                          className={cn(
                            "mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold",
                            correct ? "bg-[#eef8f1] text-success" : "bg-[#fdf0f0] text-danger",
                          )}
                        >
                          {correct ? "D" : "Y"}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )
          ) : listening.length === 0 ? (
            <p className="text-[12px] text-faint">Bu seviyede dinleme kaydı yok.</p>
          ) : (
            <div className="space-y-3">
              {listening.map((item) => {
                const legacyAnswers = attempt.listening_answers as unknown as Record<string, string>;
                return (
                  <div key={item.id}>
                    <p className="text-[11.5px] font-medium text-muted">{item.title}</p>
                    <p className="mt-1 rounded-lg bg-[#fcfcfe] px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ring-1 ring-line">
                      {legacyAnswers?.[item.id]?.trim() || (
                        <span className="text-faint">Boş bırakıldı</span>
                      )}
                    </p>
                    {item.transcript && (
                      <details className="mt-1 text-[11.5px] text-muted">
                        <summary className="cursor-pointer text-faint transition hover:text-ink">
                          Referans transkript
                        </summary>
                        <p className="mt-1 leading-relaxed whitespace-pre-wrap">{item.transcript}</p>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        <Card title="Yazma cevabı">
          {attempt.scoring_version >= 2 ? (
            <div className="space-y-3">
              {([
                { label: "Bölüm 1", text: attempt.writing_text },
                { label: "Bölüm 2", text: attempt.writing_text_2 },
              ] as const).map((part) => (
                <div key={part.label}>
                  <p className="text-[11.5px] font-medium text-muted">{part.label}</p>
                  <p className="mt-1 max-h-52 overflow-y-auto rounded-lg bg-[#fcfcfe] px-3 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap ring-1 ring-line">
                    {part.text?.trim() || <span className="text-faint">Boş bırakıldı</span>}
                  </p>
                  <p className="mt-1 text-[11px] text-faint">
                    {part.text ? `${part.text.trim().split(/\s+/).length} kelime` : "0 kelime"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <>
              <p className="max-h-60 overflow-y-auto rounded-lg bg-[#fcfcfe] px-3 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap ring-1 ring-line">
                {attempt.writing_text?.trim() || <span className="text-faint">Boş bırakıldı</span>}
              </p>
              <p className="mt-1.5 text-[11px] text-faint">
                {attempt.writing_text
                  ? `${attempt.writing_text.trim().split(/\s+/).length} kelime`
                  : "0 kelime"}
              </p>
            </>
          )}
        </Card>

        <Card title={attempt.scoring_version >= 2 ? "Konuşma · Bölüm 1 kaydı" : "Konuşma kaydı"}>
          {attempt.speaking_path ? (
            audioUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <AudioWithSpeed src={audioUrl} />
                <a
                  href={audioUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px] font-medium text-muted transition hover:text-ink"
                >
                  <Download className="size-3.5" />
                  İndir
                </a>
              </div>
            ) : (
              <p className="text-[12px] text-faint">Kayıt bağlantısı hazırlanıyor…</p>
            )
          ) : (
            <p className="text-[12px] text-faint">Ses kaydı yüklenmemiş.</p>
          )}
          {attempt.speaking_duration !== null && (
            <p className="mt-1.5 text-[11px] text-faint">
              Süre: {formatSeconds(attempt.speaking_duration)}
            </p>
          )}
          {attempt.scoring_version >= 2 && (
            <p className="mt-2 rounded-lg bg-[#fcfcfe] px-3 py-2 text-[11.5px] leading-relaxed text-muted ring-1 ring-line">
              Bölüm 2 kayıt içermez: aday fotoğraf üzerine konuşur, puanı yönetici canlı
              değerlendirerek girer.
            </p>
          )}
        </Card>

        {attempt.integrity && <IntegritySummary integrity={attempt.integrity} />}

        <Card title="Değerlendirme geçmişi">
          {audit.length === 0 ? (
            <p className="text-[12px] text-faint">Bu sınav için henüz kayıt yok.</p>
          ) : (
            <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
              {audit.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-line px-2.5 py-1.5 text-[11.5px]"
                >
                  <Badge
                    tone={
                      entry.action === "graded"
                        ? "success"
                        : entry.action === "submitted"
                          ? "accent"
                          : "neutral"
                    }
                  >
                    {AUDIT_LABELS[entry.action] ?? entry.action}
                  </Badge>
                  <span className="text-muted">{formatDate(entry.created_at)}</span>
                  {entry.actor_email && <span className="text-faint">{entry.actor_email}</span>}
                  {auditTotal(entry) !== null && (
                    <span className="ml-auto tabular-nums text-faint">
                      Toplam {auditTotal(entry)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Değerlendirme">
          {attempt.scoring_version >= 2 ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    { key: "part1", label: "Yazma · Bölüm 1", max: 10 },
                    { key: "part2", label: "Yazma · Bölüm 2", max: 10 },
                    { key: "speaking1", label: "Konuşma · Bölüm 1", max: 10 },
                    { key: "speaking2", label: "Konuşma · Bölüm 2", max: 10 },
                  ] as const
                ).map(({ key, label, max }) => (
                  <Field
                    key={key}
                    label={label}
                    hint={rubric.enabled ? "Rubrik toplamı" : `0–${max}`}
                    htmlFor={`score-${key}`}
                  >
                    <input
                      id={`score-${key}`}
                      type="number"
                      min={0}
                      max={max}
                      className="field"
                      placeholder="—"
                      disabled={rubric.enabled}
                      value={scores[key]}
                      onChange={(event) =>
                        setScores((prev) => ({
                          ...prev,
                          [key]:
                            event.target.value === ""
                              ? ""
                              : String(Math.min(max, Math.max(0, Number(event.target.value)))),
                        }))
                      }
                    />
                  </Field>
                ))}
              </div>

              <div className="mt-3 rounded-xl border border-line bg-[#fcfcfe] p-3">
                <label className="flex flex-wrap items-center gap-2 text-[12px] font-medium">
                  <input
                    type="checkbox"
                    className="size-3.5"
                    checked={rubric.enabled}
                    onChange={(event) => toggleRubric(event.target.checked)}
                  />
                  Rubrikle puanla
                  <span className="text-[11px] font-normal text-faint">
                    Her ölçüt 0–5; toplamlar yukarıdaki puan alanlarına yazılır.
                  </span>
                </label>

                {rubric.enabled && (
                  <div className="mt-3 space-y-3">
                    {(
                      [
                        { part: "part1" as const, title: "Yazma · Bölüm 1" },
                        { part: "part2" as const, title: "Yazma · Bölüm 2" },
                      ]
                    ).map(({ part, title }) => (
                      <div key={part}>
                        <p className="text-[11px] font-medium text-muted">{title}</p>
                        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                          {WRITING_CRITERIA.map((criterion) => (
                            <CriterionSelect
                              key={criterion.key}
                              label={criterion.label}
                              value={rubric.writing[part][criterion.key]}
                              onChange={(value) => setWritingCriterion(part, criterion.key, value)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    {(
                      [
                        { part: "part1" as const, title: "Konuşma · Bölüm 1 (kayıt)" },
                        { part: "part2" as const, title: "Konuşma · Bölüm 2 (canlı)" },
                      ]
                    ).map(({ part, title }) => (
                      <div key={part}>
                        <p className="text-[11px] font-medium text-muted">{title}</p>
                        <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                          {SPEAKING_CRITERIA.map((criterion) => (
                            <CriterionSelect
                              key={criterion.key}
                              label={criterion.label}
                              value={rubric.speaking[part][criterion.key]}
                              onChange={(value) => setSpeakingCriterion(part, criterion.key, value)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <p className="mt-2 text-[11.5px] text-faint">
                Dinleme puanı otomatik: {attempt.listening_correct ?? 0} doğru /{" "}
                {attempt.listening_total ?? 0} soru = {Math.round(Number(attempt.listening_score ?? 0))}/10
              </p>
            </>
          ) : (
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  { key: "legacyListening", label: "Dinleme puanı" },
                  { key: "legacyWriting", label: "Yazma puanı" },
                  { key: "legacySpeaking", label: "Konuşma puanı" },
                ] as const
              ).map(({ key, label }) => (
                <Field key={key} label={label} hint="0–100" htmlFor={`score-${key}`}>
                  <input
                    id={`score-${key}`}
                    type="number"
                    min={0}
                    max={100}
                    className="field"
                    placeholder="—"
                    value={scores[key]}
                    onChange={(event) =>
                      setScores((prev) => ({
                        ...prev,
                        [key]:
                          event.target.value === ""
                            ? ""
                            : String(Math.min(100, Math.max(0, Number(event.target.value)))),
                      }))
                    }
                  />
                </Field>
              ))}
            </div>
          )}
          <div className="mt-3">
            <Field
              label="Değerlendirici notu"
              hint="Aday görmez, yalnızca panelde saklanır."
              htmlFor="admin-note"
            >
              <textarea
                id="admin-note"
                className="field min-h-[90px] resize-y"
                placeholder="Gözlemler, güçlü yönler, geliştirilecek alanlar…"
                value={scores.note}
                onChange={(event) => setScores((prev) => ({ ...prev, note: event.target.value }))}
              />
            </Field>
          </div>
        </Card>
      </div>
    </Modal>
  );
}

const WRITING_CRITERIA = [
  { key: "task", label: "Görev" },
  { key: "language", label: "Dil doğruluğu" },
] as const;

const SPEAKING_CRITERIA = [
  { key: "content", label: "İçerik / görev" },
  { key: "language", label: "Dil doğruluğu" },
] as const;

const AUDIT_LABELS: Record<string, string> = {
  submitted: "Gönderildi",
  graded: "Değerlendirildi",
  updated: "Güncellendi",
};

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5];

/** Toplamı eşit (en fazla 5'er) parçalara böler; rubriği mevcut puandan başlatır. */
function splitTotal(total: number, count: number): number[] {
  const value = Math.max(0, Math.min(count * 5, Math.round(total)));
  const base = Math.floor(value / count);
  const extra = value % count;
  return Array.from({ length: count }, (_, index) => base + (index < extra ? 1 : 0));
}

function initialRubric(attempt: Attempt): {
  enabled: boolean;
  writing: WritingRubric;
  speaking: SpeakingRubric;
} {
  const p1 = splitTotal(Number(attempt.writing_part1_score ?? 0), 2);
  const p2 = splitTotal(Number(attempt.writing_part2_score ?? 0), 2);
  const s1 = splitTotal(Number(attempt.speaking_part1_score ?? 0), 2);
  const s2 = splitTotal(Number(attempt.speaking_part2_score ?? 0), 2);
  // Records graded before the two-part model store the old four-criterion shape.
  const storedSpeaking =
    attempt.speaking_rubric && "part1" in attempt.speaking_rubric
      ? attempt.speaking_rubric
      : null;

  return {
    enabled: Boolean(attempt.writing_rubric || storedSpeaking),
    writing: attempt.writing_rubric ?? {
      part1: { task: p1[0], language: p1[1] },
      part2: { task: p2[0], language: p2[1] },
    },
    speaking: storedSpeaking ?? {
      part1: { content: s1[0], language: s1[1] },
      part2: { content: s2[0], language: s2[1] },
    },
  };
}

function auditTotal(entry: GradingAuditEntry): number | null {
  const value = (entry.after as Record<string, unknown> | null)?.total_score;
  return typeof value === "number" ? value : null;
}

function CriterionSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-2 text-[11.5px] text-muted">
      <span>{label}</span>
      <select
        className="field w-16 py-1 text-[12px]"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      >
        {[0, 1, 2, 3, 4, 5].map((score) => (
          <option key={score} value={score}>
            {score}
          </option>
        ))}
      </select>
    </label>
  );
}

function AudioWithSpeed({ src }: { src: string }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [speed, setSpeed] = useState(1);

  useEffect(() => {
    if (ref.current) ref.current.playbackRate = speed;
  }, [src, speed]);

  return (
    <div className="flex min-w-[240px] flex-1 flex-wrap items-center gap-2">
      <audio ref={ref} controls src={src} className="h-9 min-w-[200px] flex-1" />
      <div className="flex items-center gap-0.5 rounded-lg border border-line p-0.5">
        {PLAYBACK_SPEEDS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setSpeed(option)}
            className={cn(
              "rounded-md px-1.5 py-1 text-[10.5px] tabular-nums transition",
              speed === option ? "bg-accent-soft text-accent-ink" : "text-faint hover:text-ink",
            )}
          >
            {option}×
          </button>
        ))}
      </div>
    </div>
  );
}

function IntegritySummary({ integrity }: { integrity: AttemptIntegrity }) {
  const rows = [
    { label: "Sekme değişimi", value: integrity.focus_losses ?? 0 },
    { label: "Yapıştırma denemesi", value: integrity.paste_attempts ?? 0 },
    { label: "Kopyalama denemesi", value: integrity.copy_attempts ?? 0 },
  ].filter((row) => row.value > 0);

  if (rows.length === 0) return null;

  return (
    <Card title="Sınav bütünlüğü">
      <div className="flex flex-wrap gap-2">
        {rows.map((row) => (
          <Badge key={row.label} tone="warning">
            {row.label}: {row.value}
          </Badge>
        ))}
      </div>
      <p className="mt-2 text-[11px] text-faint">
        Adayın sınav sırasındaki bu hareketleri kaydedildi. Puanı etkilemez; değerlendirirken dikkate al.
      </p>
    </Card>
  );
}

function ScoreTile({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-line bg-[#fcfcfe] p-3">
      <p className="text-[10.5px] font-medium tracking-[0.06em] text-faint uppercase">{label}</p>
      <p className="mt-1 text-[20px] font-semibold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted">{detail}</p>
    </div>
  );
}

function Card({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-line p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[12.5px] font-semibold">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}
