import { useCallback, useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Check } from "lucide-react";
import { deleteQuestion, listQuestions, saveQuestion } from "../lib/api";
import type { Level, QuestionAdmin } from "../lib/types";
import { cn, errorMessage } from "../lib/utils";
import { Button, EmptyState, Field, Modal, Notice, Spinner } from "../components/ui";
import { ConfirmDialog, LevelTabs, PageHeader, Panel } from "./shared";

const EMPTY_FORM = {
  prompt: "",
  options: ["", "", "", ""],
  correct: 0,
  explanation: "",
  position: 0,
};

export default function Questions() {
  const [level, setLevel] = useState<Level>("A1");
  const [questions, setQuestions] = useState<QuestionAdmin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionAdmin | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<QuestionAdmin | null>(null);
  const [deleting, setDeleting] = useState(false);

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

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, position: questions.length + 1 });
    setFormError(null);
    setOpen(true);
  }

  function openEdit(question: QuestionAdmin) {
    setEditing(question);
    setForm({
      prompt: question.prompt,
      options: [...question.options, "", "", "", ""].slice(0, 4),
      correct: question.correct_index,
      explanation: question.explanation ?? "",
      position: question.position,
    });
    setFormError(null);
    setOpen(true);
  }

  async function submit() {
    if (!form.prompt.trim() || form.options.some((option) => !option.trim())) {
      setFormError("Soru metni ve dört seçenek de doldurulmalı.");
      return;
    }
    setSaving(true);
    try {
      await saveQuestion({
        id: editing?.id,
        level,
        prompt: form.prompt,
        options: form.options,
        correct_index: form.correct,
        explanation: form.explanation,
        position: Number(form.position) || 0,
      });
      setOpen(false);
      setFormError(null);
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
      await deleteQuestion(toDelete.id);
      setQuestions((prev) => prev.filter((question) => question.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Test Soruları"
        description="Her seviye için çoktan seçmeli soruları yönet. Adaylar soruları doğru cevapları görmeden alır."
        action={
          <div className="flex items-center gap-2">
            <span className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] text-muted tabular-nums">
              {questions.length} / 50 soru
            </span>
            <Button onClick={openCreate} icon={<Plus className="size-4" />}>
              Soru ekle
            </Button>
          </div>
        }
      />

      <LevelTabs value={level} onChange={setLevel} suffix={(code) => (code === level ? questions.length : undefined)} />

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
          icon={<Plus className="size-5" />}
          title={`${level} için henüz soru yok`}
          description="İlk soruyu eklediğinde adaylar bu seviyede testi görmeye başlar."
          action={<Button onClick={openCreate}>Soru ekle</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {questions.map((question, index) => (
            <Panel key={question.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[#f3f3f6] text-[11px] font-semibold text-muted tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] leading-relaxed font-medium">{question.prompt}</p>
                    <div className="mt-2 grid gap-1 sm:grid-cols-2">
                      {question.options.map((option, optionIndex) => (
                        <div
                          key={optionIndex}
                          className={cn(
                            "flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px]",
                            optionIndex === question.correct_index
                              ? "bg-[#eef8f1] text-success"
                              : "text-muted",
                          )}
                        >
                          {optionIndex === question.correct_index ? (
                            <Check className="size-3 shrink-0" strokeWidth={3} />
                          ) : (
                            <span className="w-3 shrink-0 text-center text-[10px] font-semibold text-faint">
                              {String.fromCharCode(65 + optionIndex)}
                            </span>
                          )}
                          {option}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  <span className="mr-1 hidden text-[11px] text-faint sm:block tabular-nums">
                    sıra {question.position}
                  </span>
                  <button
                    onClick={() => openEdit(question)}
                    className="rounded-lg p-1.5 text-faint transition hover:bg-[#f3f3f6] hover:text-ink"
                    aria-label="Düzenle"
                  >
                    <Pencil className="size-3.5" />
                  </button>
                  <button
                    onClick={() => setToDelete(question)}
                    className="rounded-lg p-1.5 text-faint transition hover:bg-[#fdf0f0] hover:text-danger"
                    aria-label="Sil"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            </Panel>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        wide
        title={editing ? "Soruyu düzenle" : "Yeni soru"}
        description={`${level} seviyesi · çoktan seçmeli`}
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
          <Field label="Soru metni">
            <textarea
              className="field min-h-[90px] resize-y"
              placeholder="Completa la frase: «Ayer ___ al cine con mis amigos.»"
              value={form.prompt}
              onChange={(event) => setForm({ ...form, prompt: event.target.value })}
            />
          </Field>

          <div>
            <p className="mb-2 text-[12.5px] font-medium text-muted">Seçenekler (doğru olanı işaretle)</p>
            <div className="space-y-2">
              {form.options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, correct: index })}
                    aria-label={`${String.fromCharCode(65 + index)} doğru cevap`}
                    className={cn(
                      "flex size-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition",
                      form.correct === index
                        ? "border-success bg-success text-white"
                        : "border-line bg-white text-muted hover:border-[#cfcfd6]",
                    )}
                  >
                    {form.correct === index ? <Check className="size-3.5" strokeWidth={3} /> : String.fromCharCode(65 + index)}
                  </button>
                  <input
                    className="field"
                    placeholder={`${String.fromCharCode(65 + index)} seçeneği`}
                    value={option}
                    onChange={(event) => {
                      const next = [...form.options];
                      next[index] = event.target.value;
                      setForm({ ...form, options: next });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_140px]">
            <Field label="Açıklama (opsiyonel)" hint="Aday görmez; yalnızca yönetici notu.">
              <input
                className="field"
                placeholder="Örn. geçmiş zaman kullanımı"
                value={form.explanation}
                onChange={(event) => setForm({ ...form, explanation: event.target.value })}
              />
            </Field>
            <Field label="Sıra" hint="Küçük sayı önce gelir.">
              <input
                type="number"
                min={0}
                className="field"
                value={form.position}
                onChange={(event) => setForm({ ...form, position: Number(event.target.value) })}
              />
            </Field>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Soruyu sil"
        description={toDelete?.prompt ?? ""}
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
