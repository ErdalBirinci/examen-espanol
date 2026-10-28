import { useCallback, useEffect, useState } from "react";
import { Pencil, PenLine, Plus, Trash2 } from "lucide-react";
import { deleteWriting, listWriting, promptImageUrl, saveWriting } from "../lib/api";
import type { Level, WritingPrompt } from "../lib/types";
import { errorMessage } from "../lib/utils";
import { Button, Field, Modal, Notice, Spinner } from "../components/ui";
import { ConfirmDialog, LevelTabs, PageHeader, Panel } from "./shared";
import CandidateAnswers from "./CandidateAnswers";

interface Slot {
  part: 1 | 2;
  title: string;
  hint: string;
}

const SLOTS: Slot[] = [
  { part: 1, title: "Bölüm 1", hint: "Kısa ve yönlendirilmiş görev · 10 puan" },
  { part: 2, title: "Bölüm 2", hint: "Daha uzun, görüş bildiren görev · 10 puan" },
];

export default function Writing() {
  const [level, setLevel] = useState<Level>("A1");
  const [items, setItems] = useState<WritingPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WritingPrompt | null>(null);
  const [part, setPart] = useState<1 | 2>(1);
  const [prompt, setPrompt] = useState("");
  const [minWords, setMinWords] = useState(80);
  const [imagePath, setImagePath] = useState("");
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

  function findPart(target: 1 | 2): WritingPrompt | null {
    return items.find((item) => item.part === target) ?? null;
  }

  function openSlot(target: 1 | 2) {
    const existing = findPart(target);
    setEditing(existing);
    setPart(target);
    setPrompt(existing?.prompt ?? "");
    setMinWords(existing?.min_words ?? (target === 1 ? 80 : 120));
    setImagePath(existing?.image_path ?? "");
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
        position: editing?.position ?? part,
        part,
        image_path: imagePath.trim() || null,
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
        description="Her seviye için iki ayrı yazma görevi tanımla. Aday her iki metni de yazar; her bölüm 10 puan, toplam 20 puandır."
      />

      <LevelTabs value={level} onChange={setLevel} />

      {error && (
        <div className="mb-4">
          <Notice tone="danger">{error}</Notice>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20 text-muted">
          <Spinner className="size-5" />
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {SLOTS.map((slot) => {
            const existing = findPart(slot.part);
            return (
              <Panel key={slot.part} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase">
                      {slot.title}
                    </p>
                    <p className="mt-1 text-[11.5px] text-muted">{slot.hint}</p>
                  </div>
                  <span
                    className={
                      existing
                        ? "rounded-full bg-[#eef8f1] px-2.5 py-1 text-[10.5px] font-semibold text-success"
                        : "rounded-full bg-[#fdf8ec] px-2.5 py-1 text-[10.5px] font-semibold text-warning"
                    }
                  >
                    {existing ? "Hazır" : "Eksik"}
                  </span>
                </div>

                {existing ? (
                  <>
                    <p className="mt-4 flex-1 text-[13.5px] leading-relaxed whitespace-pre-line">
                      {existing.prompt}
                    </p>
                    {existing.image_path && (
                      <img
                        src={promptImageUrl(existing.image_path)}
                        alt={`Yazma ${slot.part}`}
                        className="mt-3 max-h-40 w-full rounded-lg border border-line bg-white object-contain"
                      />
                    )}
                    <p className="mt-2 text-[11.5px] text-faint">
                      Minimum {existing.min_words} kelime
                    </p>
                    <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
                      <Button
                        variant="secondary"
                        onClick={() => openSlot(slot.part)}
                        icon={<Pencil className="size-3.5" />}
                      >
                        Düzenle
                      </Button>
                      <button
                        type="button"
                        onClick={() => setToDelete(existing)}
                        className="rounded-lg p-2 text-faint transition hover:bg-[#fdf0f0] hover:text-danger"
                        aria-label="Sil"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="mt-4 flex flex-1 flex-col items-start justify-center rounded-xl border border-dashed border-[#e2e2e9] bg-[#fcfcfe] p-5">
                    <PenLine className="size-5 text-faint" />
                    <p className="mt-2 text-[12.5px] text-muted">
                      Bu bölüm için henüz konu tanımlanmadı.
                    </p>
                    <Button className="mt-3" onClick={() => openSlot(slot.part)} icon={<Plus className="size-3.5" />}>
                      Konu ekle
                    </Button>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <CandidateAnswers level={level} section="writing" />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? `Yazma ${part}. bölümü düzenle` : `Yazma ${part}. bölümü ekle`}
        description={`${level} seviyesi · 10 puan`}
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
            label="Konu / görev"
            hint="Adayın yanıtlayacağı görevi İspanyolca yaz. İki bölüm birbirinden bağımsız puanlanır."
          >
            <textarea
              className="field min-h-[130px] resize-y"
              placeholder={
                part === 1
                  ? "Escribe un correo a un amigo contándole tus planes para el fin de semana."
                  : "¿Crees que las redes sociales acercan o alejan a las personas? Explica tu opinión con ejemplos."
              }
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Field>

          <Field label="Minimum kelime" hint="20–600 kelime">
            <input
              type="number"
              min={20}
              max={600}
              className="field"
              value={minWords}
              onChange={(event) => setMinWords(Number(event.target.value))}
            />
          </Field>

          <Field
            label="Görsel yolu (opsiyonel)"
            hint="exam-media kovasındaki yol, örn. prompts/b1-writing-1.jpg. Aday görevin görselini görür."
          >
            <input
              className="field"
              placeholder="prompts/b1-writing-1.jpg"
              value={imagePath}
              onChange={(event) => setImagePath(event.target.value)}
            />
          </Field>
          {imagePath.trim() && (
            <img
              src={promptImageUrl(imagePath.trim())}
              alt="Görsel önizleme"
              className="max-h-48 w-full rounded-lg border border-line bg-white object-contain"
            />
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Yazma konusunu sil"
        description={toDelete ? `${toDelete.part}. bölüm · ${toDelete.prompt.slice(0, 80)}` : ""}
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
