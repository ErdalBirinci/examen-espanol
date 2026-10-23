import { useCallback, useEffect, useState } from "react";
import { Download, KeyRound, Printer } from "lucide-react";
import { listQuestions } from "../lib/api";
import { questionsToCsv } from "../lib/questionExport";
import type { Level, QuestionAdmin } from "../lib/types";
import { errorMessage } from "../lib/utils";
import { Button, EmptyState, Notice, Spinner } from "../components/ui";
import { LevelTabs, PageHeader, Panel } from "./shared";

const LETTERS = "ABCDEF";

export default function AnswerKey() {
  const [level, setLevel] = useState<Level>("B1");
  const [questions, setQuestions] = useState<QuestionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (target: Level) => {
    setLoading(true);
    try {
      setQuestions(await listQuestions(target));
      setError(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(level);
  }, [level, load]);

  function exportCsv() {
    if (questions.length === 0) return;
    const blob = new Blob([questionsToCsv(questions)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `respuestas-${level}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Cevap Anahtarı"
        description="Seçili seviyedeki doğru cevapları ve değerlendirme notlarını tek tabloda görüntüle. Bu sayfa yalnızca yöneticilere açıktır."
        action={
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <span className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] text-muted tabular-nums">
              {questions.length} soru
            </span>
            <Button
              variant="secondary"
              onClick={exportCsv}
              disabled={questions.length === 0}
              icon={<Download className="size-4" />}
            >
              CSV indir
            </Button>
            <Button
              variant="secondary"
              onClick={() => window.print()}
              disabled={questions.length === 0}
              icon={<Printer className="size-4" />}
            >
              Yazdır
            </Button>
          </div>
        }
      />

      <div className="print:hidden">
        <LevelTabs
          value={level}
          onChange={setLevel}
          suffix={(code) => (code === level ? questions.length : undefined)}
        />
      </div>

      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-muted">
          <Spinner className="size-5" />
        </div>
      ) : questions.length === 0 ? (
        <EmptyState
          icon={<KeyRound className="size-5" />}
          title={`${level} için henüz cevap anahtarı yok`}
          description="Bu seviyeye soru eklediğinde doğru cevaplar burada görünür."
        />
      ) : (
        <Panel className="overflow-hidden">
          <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/70 px-5 py-4">
            <div>
              <p className="text-[10px] font-semibold tracking-[0.16em] text-faint uppercase">
                Cevap anahtarı · {level}
              </p>
              <h2 className="mt-1 text-[18px] font-semibold tracking-[-0.02em]">
                {level} seviyesi · {questions.length} soru
              </h2>
            </div>
            <p className="text-[11.5px] text-muted">
              Doğru seçenek yeşil olarak işaretlidir. Açıklamalar adaya gösterilmez.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead className="bg-white/45 text-[10px] font-semibold tracking-[0.09em] text-faint uppercase">
                <tr>
                  <th className="w-14 px-5 py-3">#</th>
                  <th className="w-56 px-3 py-3">Doğru cevap</th>
                  <th className="px-3 py-3">Soru</th>
                  <th className="w-64 px-5 py-3">Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((question, index) => {
                  const letter = LETTERS[question.correct_index] ?? "?";
                  const answer = question.options[question.correct_index] ?? "";
                  return (
                    <tr
                      key={question.id}
                      className="break-inside-avoid border-t border-[rgba(23,35,56,0.07)] align-top"
                    >
                      <td className="px-5 py-3.5 text-[11.5px] font-semibold text-faint tabular-nums">
                        {index + 1}
                      </td>
                      <td className="px-3 py-3.5">
                        <span className="inline-flex items-center gap-2">
                          <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-[#d6ecdf] bg-[#eef8f1] text-[11px] font-bold text-success">
                            {letter}
                          </span>
                          <span className="text-[12.5px] leading-snug font-medium text-success">
                            {answer}
                          </span>
                        </span>
                      </td>
                      <td className="px-3 py-3.5 text-[12.5px] leading-relaxed">{question.prompt}</td>
                      <td className="px-5 py-3.5 text-[11.5px] leading-relaxed text-muted">
                        {question.explanation || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="hidden border-t border-white/70 px-5 py-3 text-[10px] text-faint print:block">
            Examen de Español · {level} cevap anahtarı · {questions.length} soru
          </div>
        </Panel>
      )}
    </div>
  );
}
