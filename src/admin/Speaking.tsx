import { useCallback, useEffect, useState } from "react";
import { Mic, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteSpeaking, listSpeaking, saveSpeaking } from "../lib/api";
import type { Level, SpeakingPrompt } from "../lib/types";
import { errorMessage, formatSeconds } from "../lib/utils";
import { Button, EmptyState, Field, Modal, Notice, Spinner } from "../components/ui";
import { ConfirmDialog, LevelTabs, PageHeader, Panel } from "./shared";

export default function Speaking() {
  const [level, setLevel] = useState<Level>("A1");
  const [items, setItems] = useState<SpeakingPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SpeakingPrompt | null>(null);
  const [prompt, setPrompt] = useState("");
  const [guidance, setGuidance] = useState("");
  const [prep, setPrep] = useState(60);
  const [maxSeconds, setMaxSeconds] = useState(120);
  const [position, setPosition] = useState(1);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<SpeakingPrompt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async (target: Level) => {
    setLoading(true);
    try {
      setItems(await listSpeaking(target));
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
    setGuidance("");
    setPrep(60);
    setMaxSeconds(120);
    setPosition(items.length + 1);
    setFormError(null);
    setOpen(true);
  }

  function openEdit(item: SpeakingPrompt) {
    setEditing(item);
    setPrompt(item.prompt);
    setGuidance(item.guidance ?? "");
    setPrep(item.prep_seconds);
    setMaxSeconds(item.max_seconds);
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
      await saveSpeaking({
        id: editing?.id,
        level,
        prompt,
        guidance: guidance.trim() || null,
        prep_seconds: Math.max(0, prep),
        max_seconds: Math.max(15, maxSeconds),
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
      await deleteSpeaking(toDelete.id);
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
        title="Konuşma"
        description="Her seviye için sözlü konu belirle. Aday, konu üzerine ses kaydı oluşturup yükler (maksimum 50 MB)."
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
          icon={<Mic className="size-5" />}
          title={`${level} için konuşma konusu yok`}
          description="Konu eklediğinde adaylar konuşma bölümünde bu metni görecek. İlk konu kullanılır."
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
                    {item.guidance && (
                      <p className="mt-1 text-[12px] text-muted">{item.guidance}</p>
                    )}
                    <p className="mt-1 text-[11.5px] text-faint">
                      Hazırlık {formatSeconds(item.prep_seconds)} · kayıt {formatSeconds(item.max_seconds)} · sıra{" "}
                      {item.position}
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
        title={editing ? "Konuşma konusunu düzenle" : "Yeni konuşma konusu"}
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
          <Field label="Konu">
            <textarea
              className="field min-h-[110px] resize-y"
              placeholder="Describe tu ciudad ideal y explica por qué te gustaría vivir allí."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Field>

          <Field label="Yönlendirme (opsiyonel)" hint="Adaya verilecek kısa ipuçları.">
            <textarea
              className="field min-h-[70px] resize-y"
              placeholder="Habla de la ubicación, el clima y las personas."
              value={guidance}
              onChange={(event) => setGuidance(event.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Hazırlık (sn)">
              <input
                type="number"
                min={0}
                max={600}
                className="field"
                value={prep}
                onChange={(event) => setPrep(Number(event.target.value))}
              />
            </Field>
            <Field label="Kayıt süresi (sn)">
              <input
                type="number"
                min={15}
                max={600}
                className="field"
                value={maxSeconds}
                onChange={(event) => setMaxSeconds(Number(event.target.value))}
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
        title="Konuşma konusunu sil"
        description={toDelete?.prompt ?? ""}
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
