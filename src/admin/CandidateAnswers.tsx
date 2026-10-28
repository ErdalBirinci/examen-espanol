import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Download, Users } from "lucide-react";
import {
  listAllListeningQuestions,
  listAttemptsPage,
  signedRecordingUrl,
} from "../lib/api";
import type { Attempt, Level, ListeningQuestionAdmin } from "../lib/types";
import { cn, errorMessage, formatDate, formatSeconds } from "../lib/utils";
import { Badge, Button, Notice, Spinner } from "../components/ui";
import { Panel } from "./shared";

export type AnswerSection = "listening" | "writing" | "speaking";

const SECTION_META: Record<
  AnswerSection,
  { title: string; description: string; scoreOf: (attempt: Attempt) => number | null }
> = {
  listening: {
    title: "Dinleme cevapları",
    description: "Adayların dinleme sorularında işaretlediği seçenekler ve doğru cevaplar.",
    scoreOf: (attempt) => attempt.listening_score,
  },
  writing: {
    title: "Yazma cevapları",
    description: "Adayların iki bölümde yazdığı metinler, kelime sayıları ve verilen puanlar.",
    scoreOf: (attempt) => attempt.writing_score,
  },
  speaking: {
    title: "Konuşma cevapları",
    description: "Adayların yüklediği ses kayıtları, süreleri ve bölüm puanları.",
    scoreOf: (attempt) => attempt.speaking_score,
  },
};

const MAX_ROWS = 300;

/**
 * Sınav içeriğini düzenleyen ekranların altında, o seviyedeki adayların
 * bölüm bazlı cevaplarını gösteren katlanabilir bölüm.
 */
export default function CandidateAnswers({
  level,
  section,
}: {
  level: Level;
  section: AnswerSection;
}) {
  const meta = SECTION_META[section];
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Attempt[]>([]);
  const [questions, setQuestions] = useState<ListeningQuestionAdmin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [page, listeningQuestions] = await Promise.all([
        listAttemptsPage({ level, status: "all", search: "", page: 1, pageSize: MAX_ROWS }),
        section === "listening" ? listAllListeningQuestions() : Promise.resolve([]),
      ]);
      setRows(page.rows);
      setQuestions(listeningQuestions);
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [level, section]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    setExpandedId(null);
    setRows([]);
  }, [level, section]);

  const questionById = new Map(questions.map((question) => [question.id, question]));

  return (
    <Panel className="mt-4 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/40"
      >
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl bg-[#f3f6fc] text-accent-ink">
            <Users className="size-4" />
          </div>
          <div>
            <p className="text-[13.5px] font-medium">Aday cevapları</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted">
              {level} seviyesinde sınava giren adayların {meta.title.toLowerCase()} burada listelenir.
            </p>
          </div>
        </div>
        <span className="flex shrink-0 items-center gap-2 text-[11.5px] font-medium text-muted">
          {open ? "Gizle" : "Göster"}
          <ChevronDown className={cn("size-3.5 transition", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div className="border-t border-line px-5 pb-5">
          <div className="flex flex-wrap items-center justify-between gap-2 py-3">
            <p className="text-[11.5px] text-faint">
              {loading ? "Yükleniyor…" : `${rows.length} sınav kaydı · en yeniden eskiye`}
            </p>
            <Button variant="secondary" onClick={() => void load()} disabled={loading}>
              Yenile
            </Button>
          </div>

          {error && <Notice tone="danger">{error}</Notice>}

          {loading ? (
            <div className="flex justify-center py-10 text-muted">
              <Spinner className="size-5" />
            </div>
          ) : rows.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#e2e2e9] bg-[#fcfcfe] px-4 py-8 text-center text-[12.5px] text-muted">
              Bu seviyede henüz sınav kaydı yok.
            </p>
          ) : (
            <ul className="space-y-2">
              {rows.map((attempt) => {
                const isOpen = expandedId === attempt.id;
                return (
                  <li key={attempt.id} className="rounded-xl border border-line bg-white/70">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : attempt.id)}
                      className="flex w-full items-center gap-3 px-3 py-2.5 text-left"
                    >
                      <ChevronRight
                        className={cn("size-3.5 shrink-0 text-faint transition", isOpen && "rotate-90")}
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-medium">{attempt.full_name}</p>
                        <p className="truncate text-[11px] text-faint">
                          {attempt.email} · {formatDate(attempt.created_at ?? attempt.submitted_at)}
                        </p>
                      </div>
                      <span className="shrink-0 text-[11.5px] font-semibold tabular-nums text-muted">
                        {scoreLabel(meta.scoreOf(attempt))}
                      </span>
                      <Badge tone={attempt.status === "graded" ? "success" : "warning"}>
                        {attempt.status === "graded" ? "Puanlandı" : "Bekliyor"}
                      </Badge>
                    </button>

                    {isOpen && (
                      <div className="border-t border-line px-3 py-3">
                        {section === "listening" && (
                          <ListeningAnswers attempt={attempt} questionById={questionById} />
                        )}
                        {section === "writing" && <WritingAnswers attempt={attempt} />}
                        {section === "speaking" && <SpeakingAnswers attempt={attempt} />}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </Panel>
  );
}

function scoreLabel(score: number | null): string {
  return score === null || score === undefined ? "—" : `${score} puan`;
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-[12px] text-faint">{text}</p>;
}

function ListeningAnswers({
  attempt,
  questionById,
}: {
  attempt: Attempt;
  questionById: Map<string, ListeningQuestionAdmin>;
}) {
  const answers = attempt.listening_answers ?? {};
  const ids =
    attempt.listening_question_ids && attempt.listening_question_ids.length > 0
      ? attempt.listening_question_ids
      : Object.keys(answers);

  if (ids.length === 0) {
    return <EmptyRow text="Bu aday dinleme bölümüne cevap vermemiş." />;
  }

  return (
    <div className="space-y-2">
      <p className="text-[11.5px] text-muted">
        {attempt.listening_correct ?? 0} doğru · {attempt.listening_total ?? ids.length} soru
        {attempt.listening_score !== null && ` · ${attempt.listening_score} puan`}
      </p>
      <ol className="max-h-80 space-y-2 overflow-y-auto pr-1">
        {ids.map((id, index) => {
          const question = questionById.get(id);
          const answer = answers[id];
          const correct = question ? answer === question.correct_index : false;
          return (
            <li key={id} className="rounded-lg border border-line px-3 py-2">
              <div className="flex items-start gap-2">
                <span className="text-[11px] font-semibold text-faint tabular-nums">
                  {index + 1}.
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] leading-snug">
                    {question?.prompt ?? "Soru artık mevcut değil"}
                  </p>
                  <p className="mt-1 text-[11.5px]">
                    <span className={correct ? "text-success" : "text-danger"}>
                      {answer === undefined ? "Boş" : (question?.options[answer] ?? "—")}
                    </span>
                    {!correct && question && (
                      <span className="text-faint">
                        {" "}
                        · doğru: {question.options[question.correct_index]}
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
    </div>
  );
}

function WritingAnswers({ attempt }: { attempt: Attempt }) {
  const parts = [
    { label: "Bölüm 1", text: attempt.writing_text, score: attempt.writing_part1_score },
    { label: "Bölüm 2", text: attempt.writing_text_2, score: attempt.writing_part2_score },
  ] as const;

  const hasAny = parts.some((part) => part.text?.trim());
  if (!hasAny) return <EmptyRow text="Bu aday yazma bölümüne metin yazmamış." />;

  return (
    <div className="space-y-3">
      {parts.map((part) => (
        <div key={part.label}>
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11.5px] font-medium text-muted">{part.label}</p>
            <span className="text-[11px] font-semibold text-muted tabular-nums">
              {scoreLabel(part.score)}
            </span>
          </div>
          <p className="mt-1 max-h-52 overflow-y-auto rounded-lg bg-[#fcfcfe] px-3 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap ring-1 ring-line">
            {part.text?.trim() || <span className="text-faint">Boş bırakıldı</span>}
          </p>
          <p className="mt-1 text-[11px] text-faint">
            {part.text ? `${part.text.trim().split(/\s+/).length} kelime` : "0 kelime"}
          </p>
        </div>
      ))}
    </div>
  );
}

function SpeakingAnswers({ attempt }: { attempt: Attempt }) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    if (!attempt.speaking_path) return;
    void signedRecordingUrl(attempt.speaking_path).then((url) => {
      if (!active) return;
      if (url) setAudioUrl(url);
      else setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [attempt.speaking_path]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-[11.5px] text-muted">
        <span>
          Bölüm 1:{" "}
          <span className="font-semibold text-ink">{scoreLabel(attempt.speaking_part1_score)}</span>
        </span>
        <span className="text-faint">·</span>
        <span>
          Bölüm 2:{" "}
          <span className="font-semibold text-ink">{scoreLabel(attempt.speaking_part2_score)}</span>
        </span>
        {attempt.speaking_duration !== null && (
          <>
            <span className="text-faint">·</span>
            <span>Kayıt süresi: {formatSeconds(attempt.speaking_duration)}</span>
          </>
        )}
      </div>

      {attempt.speaking_path ? (
        failed ? (
          <p className="text-[12px] text-faint">Kayıt bağlantısı oluşturulamadı.</p>
        ) : audioUrl ? (
          <div className="flex flex-wrap items-center gap-2">
            <audio controls preload="none" src={audioUrl} className="h-9 w-full max-w-md" />
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

      <p className="rounded-lg bg-[#fcfcfe] px-3 py-2 text-[11.5px] leading-relaxed text-muted ring-1 ring-line">
        Bölüm 2 kayıt içermez; aday fotoğraf üzerine konuşur ve puanı yönetici canlı
        değerlendirerek girer.
      </p>
    </div>
  );
}
