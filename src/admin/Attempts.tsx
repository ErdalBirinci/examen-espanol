import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Download, Search, Trash2 } from "lucide-react";
import {
  deleteAttempt,
  gradeAttempt,
  listAttemptsPage,
  listListening,
  listQuestions,
  notifyAttemptResult,
  signedRecordingUrl,
} from "../lib/api";
import { LEVELS, type Attempt, type Level, type ListeningItem, type QuestionAdmin } from "../lib/types";
import { cn, errorMessage, formatDate, formatSeconds } from "../lib/utils";
import { attemptTotal } from "../lib/scoring";
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

  function updateAttempt(updated: Attempt) {
    setAttempts((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setSelected(updated);
  }

  return (
    <div>
      <PageHeader
        title="Sınav Sonuçları"
        description="Adayların gönderdiği sınavları incele, dinleme–yazma–konuşma puanlarını gir."
        action={
          <span className="rounded-xl border border-line bg-white px-3 py-1.5 text-[12px] text-muted">
            {total} kayıt
          </span>
        }
      />

      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
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
          attempt={selected}
          onClose={() => setSelected(null)}
          onSaved={updateAttempt}
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
}: {
  attempt: Attempt;
  onClose: () => void;
  onSaved: (attempt: Attempt) => void;
}) {
  const [questions, setQuestions] = useState<QuestionAdmin[]>([]);
  const [listening, setListening] = useState<ListeningItem[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [showAnswers, setShowAnswers] = useState(false);
  const [scores, setScores] = useState({
    listening: attempt.listening_score?.toString() ?? "",
    writing: attempt.writing_score?.toString() ?? "",
    speaking: attempt.speaking_score?.toString() ?? "",
    note: attempt.admin_note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [emailWarning, setEmailWarning] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [qs, ls] = await Promise.all([listQuestions(attempt.level), listListening(attempt.level)]);
        if (active) {
          setQuestions(qs);
          setListening(ls);
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

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        id: attempt.id,
        listening_score: scores.listening ? Number(scores.listening) : null,
        writing_score: scores.writing ? Number(scores.writing) : null,
        speaking_score: scores.speaking ? Number(scores.speaking) : null,
        admin_note: scores.note.trim() || null,
        status: (scores.listening || scores.writing || scores.speaking
          ? "graded"
          : "submitted") as "graded" | "submitted",
      };
      await gradeAttempt(payload);
      onSaved({ ...attempt, ...payload });

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
    }
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
            Puanlar 0–100 arasındadır. Kaydettiğinde durum otomatik güncellenir.
          </span>
          <Button variant="ghost" onClick={onClose}>
            Kapat
          </Button>
          <Button onClick={() => void save()} loading={saving}>
            Değerlendirmeyi kaydet
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Notice tone="danger">{error}</Notice>}
        {emailNotice && <Notice tone={emailWarning ? "warning" : "success"}>{emailNotice}</Notice>}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <ScoreTile label="Test" value={percent === null ? "—" : `%${percent}`} detail={`${attempt.mc_correct ?? 0} / ${attempt.mc_total ?? 0} doğru`} />
          <ScoreTile
            label="Dinleme"
            value={attempt.listening_score !== null ? String(attempt.listening_score) : "—"}
            detail={attempt.listening_score !== null ? "puanlandı" : "bekliyor"}
          />
          <ScoreTile
            label="Yazma"
            value={attempt.writing_score !== null ? String(attempt.writing_score) : "—"}
            detail={attempt.writing_score !== null ? "puanlandı" : "bekliyor"}
          />
          <ScoreTile
            label="Konuşma"
            value={attempt.speaking_score !== null ? String(attempt.speaking_score) : "—"}
            detail={attempt.speaking_score !== null ? "puanlandı" : "bekliyor"}
          />
        </div>

        <p className="text-right text-[11.5px] text-muted">
          Ağırlıklı toplam:{" "}
          <span className="font-semibold text-ink tabular-nums">{attemptTotal(attempt) ?? "—"}</span>{" "}
          / 100{" "}
          <span className="text-faint">(%40 test · %20 dinleme · %20 yazma · %20 konuşma)</span>
        </p>

        <Card title="Test cevapları" action={
          <button
            onClick={() => setShowAnswers((value) => !value)}
            className="flex items-center gap-1 text-[11.5px] font-medium text-accent-ink"
          >
            {showAnswers ? "Gizle" : "Cevapları gör"}
            <ChevronDown className={cn("size-3.5 transition", showAnswers && "rotate-180")} />
          </button>
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

        <Card title="Dinleme transkriptleri">
          {listening.length === 0 ? (
            <p className="text-[12px] text-faint">Bu seviyede dinleme kaydı yok.</p>
          ) : (
            <div className="space-y-3">
              {listening.map((item) => (
                <div key={item.id}>
                  <p className="text-[11.5px] font-medium text-muted">{item.title}</p>
                  <p className="mt-1 rounded-lg bg-[#fcfcfe] px-3 py-2 text-[12.5px] leading-relaxed whitespace-pre-wrap ring-1 ring-line">
                    {attempt.listening_answers?.[item.id]?.trim() || (
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
              ))}
            </div>
          )}
        </Card>

        <Card title="Yazma cevabı">
          <p className="max-h-60 overflow-y-auto rounded-lg bg-[#fcfcfe] px-3 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap ring-1 ring-line">
            {attempt.writing_text?.trim() || <span className="text-faint">Boş bırakıldı</span>}
          </p>
          <p className="mt-1.5 text-[11px] text-faint">
            {attempt.writing_text ? `${attempt.writing_text.trim().split(/\s+/).length} kelime` : "0 kelime"}
          </p>
        </Card>

        <Card title="Konuşma kaydı">
          {attempt.speaking_path ? (
            audioUrl ? (
              <div className="flex flex-wrap items-center gap-3">
                <audio controls src={audioUrl} className="h-9 min-w-[220px] flex-1" />
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
        </Card>

        <Card title="Değerlendirme">
          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                { key: "listening", label: "Dinleme puanı" },
                { key: "writing", label: "Yazma puanı" },
                { key: "speaking", label: "Konuşma puanı" },
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
                      [key]: event.target.value === "" ? "" : String(Math.min(100, Math.max(0, Number(event.target.value)))),
                    }))
                  }
                />
              </Field>
            ))}
          </div>
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
