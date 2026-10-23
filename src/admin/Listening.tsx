import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown, Headphones, ListChecks, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  deleteListening,
  deleteListeningQuestion,
  listAllListeningQuestions,
  listListening,
  listeningAudioUrl,
  saveListening,
  saveListeningQuestion,
  uploadListeningAudio,
} from "../lib/api";
import type { Level, ListeningItem, ListeningQuestionAdmin } from "../lib/types";
import { errorMessage, formatBytes } from "../lib/utils";
import { Button, EmptyState, Field, Modal, Notice, Spinner } from "../components/ui";
import { ConfirmDialog, LevelTabs, PageHeader, Panel } from "./shared";

const MAX_BYTES = 50 * 1024 * 1024;
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

export default function Listening() {
  const [level, setLevel] = useState<Level>("A1");
  const [items, setItems] = useState<ListeningItem[]>([]);
  const [questions, setQuestions] = useState<ListeningQuestionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ListeningItem | null>(null);
  const [title, setTitle] = useState("");
  const [maxPlays, setMaxPlays] = useState(2);
  const [position, setPosition] = useState(0);
  const [transcript, setTranscript] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<ListeningItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Multiple-choice questions per audio track.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [questionOpen, setQuestionOpen] = useState(false);
  const [questionItemId, setQuestionItemId] = useState<string | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<ListeningQuestionAdmin | null>(null);
  const [questionPrompt, setQuestionPrompt] = useState("");
  const [questionOptions, setQuestionOptions] = useState(["", "", "", ""]);
  const [questionCorrect, setQuestionCorrect] = useState(0);
  const [questionPosition, setQuestionPosition] = useState(1);
  const [questionSaving, setQuestionSaving] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [questionToDelete, setQuestionToDelete] = useState<ListeningQuestionAdmin | null>(null);
  const [questionDeleting, setQuestionDeleting] = useState(false);

  const load = useCallback(async (target: Level) => {
    setLoading(true);
    try {
      const [rows, allQuestions] = await Promise.all([
        listListening(target),
        listAllListeningQuestions(),
      ]);
      const ids = new Set(rows.map((row) => row.id));
      setItems(rows);
      setQuestions(allQuestions.filter((question) => ids.has(question.item_id)));
      setExpanded(null);
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

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const question of questions) {
      map[question.item_id] = (map[question.item_id] ?? 0) + 1;
    }
    return map;
  }, [questions]);

  function openCreate() {
    setEditing(null);
    setTitle("");
    setMaxPlays(2);
    setPosition(items.length + 1);
    setTranscript("");
    setFile(null);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(item: ListeningItem) {
    setEditing(item);
    setTitle(item.title);
    setMaxPlays(item.max_plays);
    setPosition(item.position);
    setTranscript(item.transcript ?? "");
    setFile(null);
    setFormError(null);
    setOpen(true);
  }

  function pickFile(next: File | undefined) {
    if (!next) return;
    if (!next.type.startsWith("audio/")) {
      setFormError("Yalnızca ses dosyası yükleyebilirsin (mp3, wav, m4a, ogg…).");
      return;
    }
    if (next.size > MAX_BYTES) {
      setFormError(`Dosya 50 MB sınırını aşıyor (${formatBytes(next.size)}).`);
      return;
    }
    setFile(next);
    setFormError(null);
    if (!title) setTitle(next.name.replace(/\.[^.]+$/, ""));
  }

  async function submit() {
    if (!title.trim()) {
      setFormError("Başlık zorunlu.");
      return;
    }
    if (!editing && !file) {
      setFormError("Yeni bir dinleme kaydı için ses dosyası seçmelisin.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      let audioPath = editing?.audio_path ?? "";
      if (file) audioPath = await uploadListeningAudio(file);
      await saveListening({
        id: editing?.id,
        level,
        title,
        audio_path: audioPath,
        max_plays: Math.max(1, maxPlays),
        position: Number(position) || 0,
        transcript: transcript.trim() || null,
      });
      setOpen(false);
      await load(level);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteListening(toDelete);
      setItems((prev) => prev.filter((item) => item.id !== toDelete.id));
      setQuestions((prev) => prev.filter((question) => question.item_id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  function openNewQuestion(itemId: string) {
    const nextPosition = (counts[itemId] ?? 0) + 1;
    // Every question of one recording shares the same answer columns, so the
    // new row starts from the bank an existing row already uses.
    const sibling = questions.find((question) => question.item_id === itemId);
    const inherited = sibling?.options.filter((option) => option.trim()) ?? [];
    setQuestionItemId(itemId);
    setEditingQuestion(null);
    setQuestionPrompt("");
    setQuestionOptions(inherited.length >= MIN_OPTIONS ? inherited : ["", "", "", ""]);
    setQuestionCorrect(0);
    setQuestionPosition(nextPosition);
    setQuestionError(null);
    setQuestionOpen(true);
  }

  function openEditQuestion(question: ListeningQuestionAdmin) {
    setQuestionItemId(question.item_id);
    setEditingQuestion(question);
    setQuestionPrompt(question.prompt);
    const options = question.options.filter((option) => option.trim());
    setQuestionOptions(options.length >= MIN_OPTIONS ? options : ["", "", "", ""]);
    setQuestionCorrect(Math.min(question.correct_index, Math.max(options.length - 1, 0)));
    setQuestionPosition(question.position);
    setQuestionError(null);
    setQuestionOpen(true);
  }

  function removeOption(index: number) {
    if (questionOptions.length <= MIN_OPTIONS) return;
    setQuestionOptions((prev) => prev.filter((_, position) => position !== index));
    setQuestionCorrect((prev) => (prev >= index ? Math.max(0, prev - 1) : prev));
  }

  async function submitQuestion(itemId: string) {
    if (!questionPrompt.trim()) {
      setQuestionError("Soru metni zorunlu.");
      return;
    }
    const trimmedOptions = questionOptions.map((option) => option.trim());
    if (trimmedOptions.length < MIN_OPTIONS) {
      setQuestionError(`En az ${MIN_OPTIONS} seçenek gerekli.`);
      return;
    }
    if (trimmedOptions.some((option) => !option)) {
      setQuestionError("Boş seçenek bırakma; kullanmadığın satırı sil.");
      return;
    }
    if (new Set(trimmedOptions).size !== trimmedOptions.length) {
      setQuestionError("Seçenekler birbirinden farklı olmalı.");
      return;
    }
    setQuestionSaving(true);
    setQuestionError(null);
    try {
      await saveListeningQuestion({
        id: editingQuestion?.id,
        item_id: itemId,
        prompt: questionPrompt,
        options: trimmedOptions,
        correct_index: questionCorrect,
        position: Number(questionPosition) || 0,
      });
      setQuestionOpen(false);
      const allQuestions = await listAllListeningQuestions();
      const ids = new Set(items.map((row) => row.id));
      setQuestions(allQuestions.filter((question) => ids.has(question.item_id)));
    } catch (err) {
      setQuestionError(errorMessage(err));
    } finally {
      setQuestionSaving(false);
    }
  }

  async function handleDeleteQuestion() {
    if (!questionToDelete) return;
    setQuestionDeleting(true);
    try {
      await deleteListeningQuestion(questionToDelete.id);
      setQuestions((prev) => prev.filter((question) => question.id !== questionToDelete.id));
      setQuestionToDelete(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setQuestionDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Dinleme"
        description="Ses kaydını yükle, ortak cevap sütunlarını ve her cümlenin doğru şıkkını belirle. Aday kaydı dinleyip cümleleri doğru seçenekle eşleştirir; her ses kaydı 10 soru ve 10 puanla değerlendirilir."
        action={
          <Button onClick={openCreate} icon={<Plus className="size-4" />}>
            Ses kaydı ekle
          </Button>
        }
      />

      <LevelTabs value={level} onChange={setLevel} suffix={(code) => (code === level ? items.length : undefined)} />

      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-muted">
          <Spinner className="size-5" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Headphones className="size-5" />}
          title={`${level} için dinleme kaydı yok`}
          description="Ses dosyasını yükledikten sonra 10 soruluk testi ekleyebilirsin."
          action={<Button onClick={openCreate}>Ses kaydı ekle</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const itemQuestions = questions.filter((question) => question.item_id === item.id);
            const isExpanded = expanded === item.id;
            const questionCount = counts[item.id] ?? 0;
            const bank = itemQuestions[0]?.options.filter((option) => option.trim()) ?? [];
            const inconsistent =
              itemQuestions.length > 1 &&
              itemQuestions.some(
                (question) =>
                  JSON.stringify(question.options) !== JSON.stringify(itemQuestions[0].options),
              );
            return (
              <Panel key={item.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Headphones className="size-3.5 text-accent" />
                      <p className="text-[13.5px] font-medium">{item.title}</p>
                    </div>
                    <p className="mt-0.5 text-[11.5px] text-faint">
                      Maksimum {item.max_plays} dinleme · sıra {item.position} ·{" "}
                      <span
                        className={
                          questionCount === 10
                            ? "font-medium text-success"
                            : "font-medium text-warning"
                        }
                      >
                        {questionCount} / 10 soru
                      </span>
                    </p>
                    <audio
                      controls
                      preload="none"
                      src={listeningAudioUrl(item.audio_path)}
                      className="mt-2 h-9 w-full max-w-md"
                    />
                    {item.transcript && (
                      <details className="mt-2 max-w-xl text-[11.5px] text-muted">
                        <summary className="cursor-pointer text-faint transition hover:text-ink">
                          Değerlendirme transkripti
                        </summary>
                        <p className="mt-1.5 leading-relaxed whitespace-pre-wrap">{item.transcript}</p>
                      </details>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setExpanded(isExpanded ? null : item.id)}
                      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-muted transition hover:bg-[#f3f3f6] hover:text-ink"
                    >
                      <ListChecks className="size-3.5" />
                      Sorular
                      <ChevronDown className={isExpanded ? "size-3.5 rotate-180 transition" : "size-3.5 transition"} />
                    </button>
                    <button
                      onClick={() => openEdit(item)}
                      className="rounded-lg p-1.5 text-faint transition hover:bg-[#f3f3f6] hover:text-ink"
                      aria-label="Düzenle"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => setToDelete(item)}
                      className="rounded-lg p-1.5 text-faint transition hover:bg-[#fdf0f0] hover:text-danger"
                      aria-label="Sil"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="mt-4 rounded-xl border border-line bg-[#fcfcfe] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11.5px] font-semibold text-muted">
                        Çoktan seçmeli sorular ({itemQuestions.length} / 10)
                      </p>
                      <Button
                        variant="secondary"
                        onClick={() => openNewQuestion(item.id)}
                        icon={<Plus className="size-3.5" />}
                      >
                        Soru ekle
                      </Button>
                    </div>

                    {itemQuestions.length > 0 && (
                      <div className="mt-3 rounded-lg border border-line bg-white px-3 py-2.5">
                        <p className="text-[10.5px] font-semibold tracking-[0.08em] text-faint uppercase">
                          Cevap sütunları
                        </p>
                        <p className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-muted">
                          {bank.map((option, index) => (
                            <span key={`${option}-${index}`} className="inline-flex items-center gap-1">
                              <span className="font-semibold text-faint">{LETTERS[index]}</span>
                              {option}
                            </span>
                          ))}
                        </p>
                        {inconsistent && (
                          <p className="mt-1.5 text-[11px] leading-relaxed text-warning">
                            Soruların seçenekleri birbirinden farklı. Aday ekranındaki sütunlar tüm
                            soruların seçeneklerinden oluşur; aynı kaydın tüm sorularında aynı
                            seçenekleri kullan.
                          </p>
                        )}
                      </div>
                    )}

                    {itemQuestions.length === 0 ? (
                      <p className="mt-3 text-[12px] text-faint">
                        Bu kayıt için henüz soru yok. Adaylar sesi duyar ama cevaplayacak soru
                        bulamaz; sınav öncesi 10 soru ekle.
                      </p>
                    ) : (
                      <ol className="mt-3 space-y-2">
                        {itemQuestions.map((question, index) => (
                          <li
                            key={question.id}
                            className="rounded-lg border border-line bg-white px-3 py-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="text-[12.5px] leading-snug">
                                  <span className="mr-1.5 font-semibold text-faint tabular-nums">
                                    {index + 1}.
                                  </span>
                                  {question.prompt}
                                </p>
                                <p className="mt-1 text-[11px] text-muted">
                                  Doğru: {LETTERS[question.correct_index] ?? "?"} ·{" "}
                                  {question.options[question.correct_index]}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <button
                                  onClick={() => openEditQuestion(question)}
                                  className="rounded-lg p-1.5 text-faint transition hover:bg-[#f3f3f6] hover:text-ink"
                                  aria-label="Soruyu düzenle"
                                >
                                  <Pencil className="size-3.5" />
                                </button>
                                <button
                                  onClick={() => setQuestionToDelete(question)}
                                  className="rounded-lg p-1.5 text-faint transition hover:bg-[#fdf0f0] hover:text-danger"
                                  aria-label="Soruyu sil"
                                >
                                  <Trash2 className="size-3.5" />
                                </button>
                              </div>
                            </div>
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Dinleme kaydını düzenle" : "Yeni dinleme kaydı"}
        description={`${level} seviyesi`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Vazgeç
            </Button>
            <Button onClick={() => void submit()} loading={saving}>
              {editing ? "Güncelle" : "Kaydet"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {formError && <Notice tone="danger">{formError}</Notice>}
          <Field label="Başlık">
            <input
              className="field"
              placeholder="Una conversación en el mercado"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>

          <Field
            label={editing ? "Ses dosyasını değiştir (opsiyonel)" : "Ses dosyası"}
            hint="MP3, WAV, M4A, OGG · maksimum 50 MB"
          >
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#d5d5dd] bg-[#fcfcfe] px-4 py-3 transition hover:border-accent/50">
              <Upload className="size-4 text-faint" />
              <span className="text-[12.5px] text-muted">
                {file ? `${file.name} · ${formatBytes(file.size)}` : editing ? "Yeni dosya seç" : "Dosya seç"}
              </span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(event) => pickFile(event.target.files?.[0])}
              />
            </label>
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Maksimum dinleme sayısı">
              <input
                type="number"
                min={1}
                max={10}
                className="field"
                value={maxPlays}
                onChange={(event) => setMaxPlays(Number(event.target.value))}
              />
            </Field>
            <Field label="Sıra">
              <input
                type="number"
                min={0}
                className="field"
                value={position}
                onChange={(event) => setPosition(Number(event.target.value))}
              />
            </Field>
          </div>

          <Field
            label="Transkript (opsiyonel)"
            hint="Aday görmez; değerlendiriciye referans olur. Sesin birebir metni."
          >
            <textarea
              className="field min-h-[90px] resize-y"
              placeholder="Buenos días, ¿cuánto cuestan estos tomates?"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
            />
          </Field>
        </div>
      </Modal>

      <Modal
        open={questionOpen}
        onClose={() => setQuestionOpen(false)}
        title={editingQuestion ? "Dinleme sorusunu düzenle" : "Yeni dinleme sorusu"}
        description="Cümle, ortak cevap sütunları ve tek doğru şık. Her soru 1 puandır."
        footer={
          <>
            <Button variant="ghost" onClick={() => setQuestionOpen(false)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => {
                if (questionItemId) void submitQuestion(questionItemId);
              }}
              loading={questionSaving}
            >
              {editingQuestion ? "Güncelle" : "Kaydet"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {questionError && <Notice tone="danger">{questionError}</Notice>}

          <Field label="Soru" hint="İspanyolca yaz. Ses kaydında geçen bilgiyi sor.">
            <textarea
              className="field min-h-[90px] resize-y"
              placeholder="¿Qué compra la mujer en el mercado?"
              value={questionPrompt}
              onChange={(event) => setQuestionPrompt(event.target.value)}
            />
          </Field>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-muted">Cevap sütunları</p>
              <span className="text-[11px] text-faint tabular-nums">
                {questionOptions.length} / {MAX_OPTIONS}
              </span>
            </div>
            {questionOptions.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQuestionCorrect(index)}
                  aria-label={`${LETTERS[index]} doğru cevap`}
                  className={
                    questionCorrect === index
                      ? "flex size-7 shrink-0 items-center justify-center rounded-full bg-success text-[11px] font-semibold text-white"
                      : "flex size-7 shrink-0 items-center justify-center rounded-full bg-[#f3f3f6] text-[11px] font-semibold text-muted"
                  }
                >
                  {LETTERS[index]}
                </button>
                <input
                  className="field"
                  placeholder={`${LETTERS[index]} seçeneği`}
                  value={option}
                  onChange={(event) =>
                    setQuestionOptions((prev) =>
                      prev.map((value, position) => (position === index ? event.target.value : value)),
                    )
                  }
                />
                <button
                  type="button"
                  onClick={() => removeOption(index)}
                  disabled={questionOptions.length <= MIN_OPTIONS}
                  aria-label="Seçeneği sil"
                  className="rounded-lg p-1.5 text-faint transition hover:bg-[#fdf0f0] hover:text-danger disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-faint"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            ))}
            {questionOptions.length < MAX_OPTIONS && (
              <button
                type="button"
                onClick={() => setQuestionOptions((prev) => [...prev, ""])}
                className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-[11.5px] font-medium text-accent-ink transition hover:bg-[#f3f7ff]"
              >
                <Plus className="size-3.5" />
                Seçenek ekle
              </button>
            )}
            <p className="text-[11px] leading-relaxed text-faint">
              Bu seçenekler aday ekranında sütun başlığı olur; aynı kaydın tüm sorularında aynı
              bankayı kullan. Doğru cevabı işaretlemek için soldaki harfe tıkla. Seçili:{" "}
              <span className="font-semibold text-success">{LETTERS[questionCorrect]}</span>
            </p>
          </div>

          <Field label="Sıra">
            <input
              type="number"
              min={0}
              className="field"
              value={questionPosition}
              onChange={(event) => setQuestionPosition(Number(event.target.value))}
            />
          </Field>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Dinleme kaydını sil"
        description={toDelete ? `${toDelete.title} · ses dosyası ve soruları da silinir` : ""}
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setToDelete(null)}
      />

      <ConfirmDialog
        open={Boolean(questionToDelete)}
        title="Dinleme sorusunu sil"
        description={questionToDelete?.prompt ?? ""}
        loading={questionDeleting}
        onConfirm={() => void handleDeleteQuestion()}
        onClose={() => setQuestionToDelete(null)}
      />
    </div>
  );
}
