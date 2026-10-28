import { useCallback, useEffect, useState } from "react";
import { Mic, Pencil, Plus, Trash2 } from "lucide-react";
import { deleteSpeaking, listSpeaking, promptImageUrl, saveSpeaking } from "../lib/api";
import type { Level, SpeakingPrompt } from "../lib/types";
import { errorMessage, formatSeconds } from "../lib/utils";
import { Button, Field, Modal, Notice, Spinner } from "../components/ui";
import { ConfirmDialog, LevelTabs, PageHeader, Panel } from "./shared";
import CandidateAnswers from "./CandidateAnswers";

interface Slot {
  part: 1 | 2;
  title: string;
  hint: string;
}

const SLOTS: Slot[] = [
  { part: 1, title: "Bölüm 1", hint: "Aday ses kaydı yükler · 10 puan" },
  { part: 2, title: "Bölüm 2", hint: "Kayıt yok, yönetici canlı değerlendirir · 10 puan" },
];

export default function Speaking() {
  const [level, setLevel] = useState<Level>("A1");
  const [items, setItems] = useState<SpeakingPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SpeakingPrompt | null>(null);
  const [part, setPart] = useState<1 | 2>(1);
  const [prompt, setPrompt] = useState("");
  const [guidance, setGuidance] = useState("");
  const [prep, setPrep] = useState(60);
  const [maxSeconds, setMaxSeconds] = useState(120);
  const [imagePath, setImagePath] = useState("");
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

  function findPart(target: 1 | 2): SpeakingPrompt | null {
    return items.find((item) => item.part === target) ?? null;
  }

  function openSlot(target: 1 | 2) {
    const existing = findPart(target);
    setEditing(existing);
    setPart(target);
    setPrompt(existing?.prompt ?? "");
    setGuidance(existing?.guidance ?? "");
    setPrep(existing?.prep_seconds ?? (target === 1 ? 60 : 0));
    setMaxSeconds(existing?.max_seconds ?? (target === 1 ? 150 : 180));
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
      await saveSpeaking({
        id: editing?.id,
        level,
        prompt,
        guidance: guidance.trim() || null,
        prep_seconds: part === 1 ? Math.max(0, prep) : 0,
        max_seconds: Math.max(15, maxSeconds),
        position: part,
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
        description="Her seviye için iki bölüm tanımla. Bölüm 1'de aday ses kaydı yükler; bölüm 2'de kayıt alınmaz, yönetici canlı değerlendirir. Her bölüm 10 puandır."
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
                    <p className="mt-4 text-[13.5px] leading-relaxed whitespace-pre-line">
                      {existing.prompt}
                    </p>
                    {existing.guidance && (
                      <p className="mt-1 text-[12px] leading-relaxed text-muted">{existing.guidance}</p>
                    )}
                    {existing.image_path && (
                      <img
                        src={promptImageUrl(existing.image_path)}
                        alt={`Konuşma ${slot.part}`}
                        className="mt-3 max-h-40 w-full rounded-lg border border-line bg-white object-contain"
                      />
                    )}
                    <p className="mt-2 flex-1 text-[11.5px] text-faint">
                      {slot.part === 1
                        ? `Hazırlık ${formatSeconds(existing.prep_seconds)} · kayıt ${formatSeconds(existing.max_seconds)}`
                        : `Konuşma süresi ${formatSeconds(existing.max_seconds)} · kayıt alınmaz`}
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
                    <Mic className="size-5 text-faint" />
                    <p className="mt-2 text-[12.5px] text-muted">
                      Bu bölüm için henüz konu tanımlanmadı.
                    </p>
                    <Button
                      className="mt-3"
                      onClick={() => openSlot(slot.part)}
                      icon={<Plus className="size-3.5" />}
                    >
                      Konu ekle
                    </Button>
                  </div>
                )}
              </Panel>
            );
          })}
        </div>
      )}

      <CandidateAnswers level={level} section="speaking" />

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`Konuşma ${part}. bölümü ${editing ? "düzenle" : "ekle"}`}
        description={`${level} seviyesi · 10 puan${part === 2 ? " · kayıt yok" : ""}`}
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
            label="Konu"
            hint={
              part === 2
                ? "Adayın fotoğraf üzerine yapacağı konuşma. Yönetici canlı dinleyip puanlar."
                : "Adayın ses kaydında yanıtlayacağı konu."
            }
          >
            <textarea
              className="field min-h-[110px] resize-y"
              placeholder={
                part === 1
                  ? "Habla sobre el transporte público y el transporte privado."
                  : "Describe con detalle lo que ves en la foto y lo que imaginas que está ocurriendo."
              }
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
            />
          </Field>

          <Field label="Yönlendirme (opsiyonel)" hint="Adaya verilecek kısa ipuçları.">
            <textarea
              className="field min-h-[70px] resize-y"
              placeholder="Incluye las ventajas e inconvenientes de cada medio de transporte."
              value={guidance}
              onChange={(event) => setGuidance(event.target.value)}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Hazırlık (sn)" hint={part === 2 ? "Bölüm 2'de hazırlık süresi kullanılmaz." : "0–600"}>
              <input
                type="number"
                min={0}
                max={600}
                className="field"
                disabled={part === 2}
                value={part === 2 ? 0 : prep}
                onChange={(event) => setPrep(Number(event.target.value))}
              />
            </Field>
            <Field label="Konuşma süresi (sn)" hint="15–600">
              <input
                type="number"
                min={15}
                max={600}
                className="field"
                value={maxSeconds}
                onChange={(event) => setMaxSeconds(Number(event.target.value))}
              />
            </Field>
          </div>

          <Field
            label="Görsel yolu (opsiyonel)"
            hint="exam-media kovasındaki yol, örn. prompts/b1-oral-2.jpg. Aday konuyla birlikte fotoğrafı görür."
          >
            <input
              className="field"
              placeholder="prompts/b1-oral-2.jpg"
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
        title="Konuşma konusunu sil"
        description={toDelete ? `${toDelete.part}. bölüm · ${toDelete.prompt.slice(0, 80)}` : ""}
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
