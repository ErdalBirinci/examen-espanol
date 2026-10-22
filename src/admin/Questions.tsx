import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Check, FileUp, Upload, X } from "lucide-react";
import { deleteQuestion, importQuestions, listQuestions, saveQuestion } from "../lib/api";
import { parseQuestionImport } from "../lib/questionImport";
import type { Level, QuestionAdmin } from "../lib/types";
import { cn, errorMessage } from "../lib/utils";
import { Badge, Button, EmptyState, Field, Modal, Notice, Spinner } from "../components/ui";
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
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  const importPreview = useMemo(
    () => parseQuestionImport(importText, questions),
    [importText, questions],
  );

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

  useEffect(() => {
    setImportOpen(false);
    setImportText("");
    setImportNotice(null);
  }, [level]);

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

  function openImport() {
    setImportText("");
    setImportError(null);
    setImportOpen(true);
  }

  async function handleImportFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setImportError("Dosya 2 MB sınırını aşıyor.");
      return;
    }
    setImportText(await file.text());
    setImportError(null);
  }

  async function runImport() {
    if (importPreview.rows.length === 0) return;
    setImporting(true);
    setImportError(null);
    try {
      await importQuestions(level, importPreview.rows);
      setImportNotice(`${importPreview.rows.length} soru ${level} seviyesine eklendi.`);
      setImportOpen(false);
      setImportText("");
      await load(level);
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setImporting(false);
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl border border-line bg-white px-3 py-2 text-[12px] text-muted tabular-nums">
              {questions.length} / 50 soru
            </span>
            <Button variant="secondary" onClick={openImport} icon={<FileUp className="size-4" />}>
              Toplu içe aktar
            </Button>
            <Button onClick={openCreate} icon={<Plus className="size-4" />}>
              Soru ekle
            </Button>
          </div>
        }
      />

      <LevelTabs value={level} onChange={setLevel} suffix={(code) => (code === level ? questions.length : undefined)} />

      {importNotice && (
        <div className="mb-4 flex items-start gap-2">
          <div className="flex-1">
            <Notice tone="success">{importNotice}</Notice>
          </div>
          <button
            type="button"
            onClick={() => setImportNotice(null)}
            aria-label="Bildirimi kapat"
            className="rounded-lg p-1.5 text-faint transition hover:bg-[#f3f3f6] hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

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

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        wide
        title="Toplu soru içe aktar"
        description={`${level} seviyesine aktarılacak · CSV veya JSON`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setImportOpen(false)}>
              Vazgeç
            </Button>
            <Button
              onClick={() => void runImport()}
              loading={importing}
              disabled={importPreview.rows.length === 0}
            >
              {importPreview.rows.length > 0
                ? `${importPreview.rows.length} soruyu aktar`
                : "Aktarılacak soru yok"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {importError && <Notice tone="danger">{importError}</Notice>}

          <div className="rounded-xl border border-line bg-[#fcfcfe] p-3.5">
            <p className="text-[12px] font-semibold">Beklenen biçim</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
              CSV başlıkları:{" "}
              <code className="rounded bg-white px-1 py-0.5 text-[11px] ring-1 ring-line">
                prompt, option_a, option_b, option_c, option_d, correct, explanation, position
              </code>
              . JSON bir dizi olabilir:{" "}
              <code className="rounded bg-white px-1 py-0.5 text-[11px] ring-1 ring-line">
                {'[{"prompt": "…", "options": ["…"], "correct": "B"}]'}
              </code>
              . Doğru cevap A–D harfi veya 1–4 numarası olabilir; JSON'daki{" "}
              <code className="rounded bg-white px-1 py-0.5 text-[11px] ring-1 ring-line">correct_index</code>{" "}
              0 tabanlıdır.
            </p>
            <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-2.5 text-[10.5px] leading-relaxed text-muted ring-1 ring-line">
{`prompt,option_a,option_b,option_c,option_d,correct,explanation,position
"¿Cómo ___?",te llamas,te llama,se llamas,llamas,A,,1`}
            </pre>
          </div>

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-[#d5d5dd] bg-[#fcfcfe] px-4 py-3 transition hover:border-accent/50">
            <Upload className="size-4 text-faint" />
            <span className="text-[12.5px] text-muted">CSV veya JSON dosyası seç (maks. 2 MB)</span>
            <input
              type="file"
              accept=".csv,.json,text/csv,application/json,text/plain"
              className="hidden"
              onChange={(event) => void handleImportFile(event.target.files?.[0])}
            />
          </label>

          <Field label="Ya da içeriği yapıştır" hint="CSV satırları veya JSON dizisi">
            <textarea
              className="field min-h-[160px] resize-y font-mono text-[12px]"
              placeholder={'[{"prompt": "Completa: «Yo ___ de Turquía.»", "options": ["estoy", "soy", "es", "eres"], "correct": "B"}]'}
              value={importText}
              onChange={(event) => {
                setImportText(event.target.value);
                setImportError(null);
              }}
            />
          </Field>

          {importText.trim() && (
            <div className="rounded-xl border border-line p-3.5">
              <div className="flex flex-wrap items-center gap-2 text-[11.5px]">
                <Badge tone="accent">{importPreview.format === "json" ? "JSON" : "CSV"}</Badge>
                <span className="font-medium text-success">
                  {importPreview.rows.length} aktarılabilir
                </span>
                {importPreview.issues.length > 0 && (
                  <span className="font-medium text-danger">
                    {importPreview.issues.length} hatalı
                  </span>
                )}
                {importPreview.duplicates > 0 && (
                  <span className="font-medium text-warning">
                    {importPreview.duplicates} zaten mevcut
                  </span>
                )}
              </div>

              {importPreview.issues.length > 0 && (
                <ul className="mt-2 max-h-32 space-y-1 overflow-y-auto text-[11.5px] text-danger">
                  {importPreview.issues.slice(0, 8).map((issue) => (
                    <li key={`${issue.row}-${issue.message}`}>
                      Satır {issue.row}: {issue.message}
                    </li>
                  ))}
                  {importPreview.issues.length > 8 && (
                    <li>… ve {importPreview.issues.length - 8} hata daha</li>
                  )}
                </ul>
              )}

              {importPreview.rows.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {importPreview.rows.slice(0, 4).map((row, index) => (
                    <li
                      key={`${row.prompt}-${index}`}
                      className="rounded-lg bg-[#fcfcfe] px-2.5 py-2 text-[11.5px] ring-1 ring-line"
                    >
                      <span className="font-medium">{row.prompt}</span>
                      <span className="text-faint">
                        {" "}· doğru: {String.fromCharCode(65 + row.correct_index)} ·{" "}
                        {row.options.length} seçenek · sıra {row.position}
                      </span>
                    </li>
                  ))}
                  {importPreview.rows.length > 4 && (
                    <li className="text-[11px] text-faint">
                      … ve {importPreview.rows.length - 4} soru daha
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}
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
