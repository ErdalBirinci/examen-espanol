import { useState } from "react";
import { Link } from "react-router-dom";
import { RotateCcw, Sparkles } from "lucide-react";
import { BackLink, SiteHeader } from "../components/SiteHeader";
import { Button, Notice, Spinner } from "../components/ui";
import { practiceBundle, practiceCheck } from "../lib/api";
import {
  LEVELS,
  LEVEL_INFO,
  type Level,
  type PracticeResult,
  type QuestionPublic,
} from "../lib/types";
import { cn, errorMessage } from "../lib/utils";

const QUESTION_COUNT = 10;

type Stage = "pick" | "quiz" | "result";

export default function Practice() {
  const [level, setLevel] = useState<Level>("A1");
  const [stage, setStage] = useState<Stage>("pick");
  const [questions, setQuestions] = useState<QuestionPublic[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [session, setSession] = useState<string | null>(null);
  const [result, setResult] = useState<PracticeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setLoading(true);
    setError(null);
    try {
      const bundle = await practiceBundle(level, QUESTION_COUNT);
      if (bundle.questions.length === 0) {
        setError("Bu seviyede henüz deneme sorusu yok. Başka bir seviye dene.");
        return;
      }
      if (!bundle.session) {
        setError("Deneme oturumu başlatılamadı. Tekrar dene.");
        return;
      }
      setQuestions(bundle.questions);
      setAnswers({});
      setSession(bundle.session);
      setResult(null);
      setStage("quiz");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function check() {
    setLoading(true);
    setError(null);
    if (!session) {
      setError("Deneme oturumu bulunamadı. Yeni bir deneme başlat.");
      setLoading(false);
      return;
    }
    try {
      setResult(await practiceCheck(session, answers));
      setStage("result");
      window.scrollTo({ top: 0 });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStage("pick");
    setQuestions([]);
    setAnswers({});
    setSession(null);
    setResult(null);
    setError(null);
  }

  const answered = Object.keys(answers).length;
  const correct = result?.correct ?? 0;
  const total = result?.total ?? questions.length;

  return (
    <div className="app-page min-h-dvh">
      <SiteHeader width="4xl" right={<BackLink to="/" label="Inicio" />} />

      <main className="mx-auto max-w-4xl px-5 py-9 pb-24 sm:px-8">
        <p className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.16em] text-faint uppercase">
          <span className="size-1.5 rounded-full bg-gold" />
          Modo de práctica
        </p>
        <h1 className="mt-2.5 text-[30px] leading-[1.08] font-semibold tracking-[-0.04em] sm:text-[38px]">
          Deneme testi
        </h1>
        <p className="mt-2.5 max-w-xl text-[13.5px] leading-relaxed text-muted">
          {QUESTION_COUNT} rastgele soruyla seviyeni ölç. Sonuçlar anında gösterilir, hiçbir kayıt
          oluşturulmaz ve panelde görünmez.
        </p>

        {error && (
          <div className="mt-5">
            <Notice tone="danger">{error}</Notice>
          </div>
        )}

        {stage === "pick" && (
          <section className="mt-7 rounded-2xl border border-line bg-white/85 p-5">
            <p className="text-[12.5px] font-medium">Seviye seç</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {LEVELS.map((code) => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setLevel(code)}
                  className={cn(
                    "focus-ring rounded-xl border px-3.5 py-2 text-left transition",
                    level === code
                      ? "border-[#2b4a7d] bg-[#f2f6fd] text-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
                      : "border-line bg-white text-muted hover:text-ink",
                  )}
                >
                  <span className="text-[13px] font-semibold">{code}</span>
                  <span className="ml-1.5 text-[11px] text-faint">{LEVEL_INFO[code].name}</span>
                </button>
              ))}
            </div>
            <Button
              className="mt-5"
              onClick={() => void start()}
              loading={loading}
              icon={<Sparkles className="size-4" />}
            >
              Denemeye başla
            </Button>
          </section>
        )}

        {stage === "quiz" && (
          <>
            <div className="sticky top-20 z-20 mt-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-white/90 px-4 py-2.5 backdrop-blur">
              <span className="text-[12px] font-medium">
                {level} · {answered}/{questions.length} yanıtlandı
              </span>
              <span className="text-[11.5px] text-faint">Süre sınırı yok</span>
            </div>

            <ol className="mt-4 space-y-3">
              {questions.map((question, index) => {
                const chosen = answers[question.id];
                return (
                  <li key={question.id} className="rounded-xl border border-line bg-white p-4">
                    <p className="text-[13px] leading-snug">
                      <span className="mr-1.5 text-[11px] font-semibold text-faint tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {question.prompt}
                    </p>
                    <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2">
                      {question.options.map((option, optionIndex) => {
                        const active = chosen === optionIndex;
                        return (
                          <label
                            key={optionIndex}
                            className={cn(
                              "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[12.5px] transition",
                              active
                                ? "border-[#2b4a7d] bg-[#f2f6fd]"
                                : "border-line hover:border-[#c9d5e8]",
                            )}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              className="size-3.5"
                              checked={active}
                              onChange={() =>
                                setAnswers((prev) => ({ ...prev, [question.id]: optionIndex }))
                              }
                            />
                            <span className="text-faint">{String.fromCharCode(65 + optionIndex)}</span>
                            {option}
                          </label>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <Button variant="ghost" onClick={reset}>
                Vazgeç
              </Button>
              <div className="flex items-center gap-3">
                <span className="text-[11.5px] text-faint">
                  {answered === questions.length
                    ? "Tüm sorular yanıtlandı"
                    : `${questions.length - answered} soru kaldı`}
                </span>
                <Button
                  onClick={() => void check()}
                  loading={loading}
                  disabled={answered === 0}
                >
                  Cevapları kontrol et
                </Button>
              </div>
            </div>
          </>
        )}

        {stage === "result" && (
          <>
            <section className="mt-6 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white p-5">
              <div className="flex size-16 items-center justify-center rounded-full bg-[#f2f6fd] text-[20px] font-semibold tabular-nums">
                {correct}/{total}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold">
                  {total > 0 ? `%${Math.round((correct / total) * 100)} doğru` : "Sonuç yok"}
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  Bu bir alıştırmadır; katılım belgesi veya resmi sonuç üretmez. Sınav güvenliği için
                  doğru şıklar gösterilmez, yalnızca toplam skor paylaşılır.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="secondary" onClick={() => void start()} loading={loading} icon={<RotateCcw className="size-3.5" />}>
                  Yeni deneme
                </Button>
                <Button variant="ghost" onClick={reset}>
                  Seviye değiştir
                </Button>
              </div>
            </section>

            <ol className="mt-4 space-y-3">
              {questions.map((question, index) => {
                const chosen = answers[question.id];
                return (
                  <li
                    key={question.id}
                    className="rounded-xl border border-line bg-white p-4"
                  >
                    <p className="text-[13px] leading-snug">
                      <span className="mr-1.5 text-[11px] font-semibold text-faint tabular-nums">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      {question.prompt}
                    </p>
                    <p className="mt-1.5 text-[12px] text-muted">
                      {chosen === undefined
                        ? "Boş bırakıldı"
                        : `Seçimin: ${question.options[chosen]}`}
                    </p>
                  </li>
                );
              })}
            </ol>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white/70 px-4 py-3">
              <p className="text-[12px] text-muted">
                Gerçek sınava hazır mısın? Aday panelinden atanmış sınavını açabilirsin.
              </p>
              <Link
                to="/cuenta"
                className="focus-ring rounded-full bg-[linear-gradient(135deg,#16243d_0%,#2b4a7d_100%)] px-4 py-2 text-[12.5px] font-medium text-white"
              >
                Aday panelim
              </Link>
            </div>
          </>
        )}

        {loading && stage === "pick" && (
          <div className="mt-6 flex justify-center text-muted">
            <Spinner className="size-5" />
          </div>
        )}
      </main>
    </div>
  );
}
