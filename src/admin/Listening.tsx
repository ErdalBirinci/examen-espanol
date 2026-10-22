import { useCallback, useEffect, useState } from "react";
import { Headphones, Pencil, Plus, Trash2, Upload } from "lucide-react";
import {
  deleteListening,
  listListening,
  listeningAudioUrl,
  saveListening,
  uploadListeningAudio,
} from "../lib/api";
import type { Level, ListeningItem } from "../lib/types";
import { errorMessage, formatBytes } from "../lib/utils";
import { Button, EmptyState, Field, Modal, Notice, Spinner } from "../components/ui";
import { ConfirmDialog, LevelTabs, PageHeader, Panel } from "./shared";

const MAX_BYTES = 50 * 1024 * 1024;

export default function Listening() {
  const [level, setLevel] = useState<Level>("A1");
  const [items, setItems] = useState<ListeningItem[]>([]);
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

  const load = useCallback(async (target: Level) => {
    setLoading(true);
    try {
      setItems(await listListening(target));
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
        title="Dinleme"
        description="Her seviye için ses kayıtları yükle. Aday kaydı belirlenen sayıda dinleyip duyduğunu yazar."
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
          description="Ses dosyasını yükle; adaylar bu seviyede dinleme bölümünü görecek."
          action={<Button onClick={openCreate}>Ses kaydı ekle</Button>}
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => (
            <Panel key={item.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Headphones className="size-3.5 text-accent" />
                    <p className="text-[13.5px] font-medium">{item.title}</p>
                  </div>
                  <p className="mt-0.5 text-[11.5px] text-faint">
                    Maksimum {item.max_plays} dinleme · sıra {item.position}
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

      <ConfirmDialog
        open={Boolean(toDelete)}
        title="Dinleme kaydını sil"
        description={toDelete ? `${toDelete.title} · ses dosyası da silinir` : ""}
        loading={deleting}
        onConfirm={() => void handleDelete()}
        onClose={() => setToDelete(null)}
      />
    </div>
  );
}
