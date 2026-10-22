import { useCallback, useEffect, useState } from "react";
import { Pencil, PenLine, Plus, Trash2 } from "lucide-react";
import { deleteWriting, listWriting, saveWriting } from "../lib/api";
import type { Level, WritingPrompt } from "../lib/types";
import { errorMessage } from "../lib/utils";
import { Button, EmptyState, Field, Modal, Notice, Spinner } from "../components/ui";
import { ConfirmDialog, LevelTabs, PageHeader, Panel } from "./shared";

export default function Writing() {
  const [level, setLevel] = useState<Level>("A1");
  const [items, setItems] = useState<WritingPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WritingPrompt | null>(null);
  const [prompt, setPrompt] = useState("");
  const [minWords, setMinWords] = useState(80);
  const [position, setPosition] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<WritingPrompt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (target: Level) => {
    setLoading(true);
    try {
      setItems(await listWriting(target));
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
    setPrompt("");
    setMinWords(80);
    setPosition(items.length + 1);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(item: WritingPrompt) {
    setEditing(item);
    setPrompt(item.prompt);
    setMinWords(item.min_words);
    setPosition(item.position);
    setFormError(null);
    setOpen(true);
  }

  async function submit() {
    if (!prompt.trim()) {
      setFormError("Konu metni zorunlu.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await saveWriting({
        id: editing?.id,
        level,
        prompt,
        min_words: Math.max(20, minWords),
        position: Number(position) || 0,
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
      await deleteWriting(toDelete.id);
      setItems((prev) => prev.filter((item) => item.id !== toDelete.id));
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
        title="Yazma"
        description="Her seviye için bir yazma konusu belirle. Aday, konuya yorum niteliğinde bir kompozisyon yazar."
        action={
          <Button onClick={openCreate} icon={<Plus className="size-4" />}>
            Konu ekle
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
          icon={<PenLine className="size-5" />}
          title={`${level} için yazma konusu yok`}
          description="Konu eklediğinde adaylar yazma bölümünde bu metni görecek. İlk konu kullanılır."
          action={<Button onClick={openCreate}>Konu ekle</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((item, index) => (
            <Panel key={item.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 gap-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-[#f3f3f6] text-[11px] font-semibold text-muted tabular-nums">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] leading-relaxed">{item.prompt}</p>
                    <p className="mt-1 text-[11.5px] text-faint">
                      Minimum {item.min_words} kelime · sıra {item.position}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
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
            </Panel>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Yazma konusunu düzenle" : "Yeni yazma konusu"}
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
          <Field
            label="Konu / yorum sorusu"
            hint="Adayın yorum yapacağı tek soruyu yaz. İspanyolca olması önerilir."
          >
            <textarea
              className="field min-h-[130px] resize-y"
              placeholder="¿Crees que las redes sociales acercan o alejan a las personas? Explica tu opinión con ejemplos."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Minimum kelime">
              <input
                type="number"
                min={20}
                max={600}
                className="field"
                value={minWords}
                onChange={(event) => setMinWords(Number(event.target.value))}
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
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Yazma konusunu sil"
        description={toDelete?.prompt ?? ""}
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
