import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Upload, Volume2 } from "lucide-react";
import { SectionEmpty, StepFooter, StepHeader } from "./Shell";
import { Notice } from "../components/ui";
import type { SpeakingPrompt } from "../lib/types";
import { cn, formatBytes, formatSeconds, errorMessage } from "../lib/utils";

export interface RecordingPayload {
  blob: Blob | null;
  duration: number | null;
  extension: string;
}

const MAX_BYTES = 50 * 1024 * 1024;

export default function SpeakingStep({
  prompt,
  submitting,
  submitError,
  onSubmit,
  onBack,
}: {
  prompt: SpeakingPrompt | null;
  submitting: boolean;
  submitError: string | null;
  onSubmit: (payload: RecordingPayload) => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"record" | "upload">("record");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const maxSeconds = prompt?.max_seconds ?? 120;

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [recording]);

  useEffect(() => {
    if (recording && elapsed >= maxSeconds) stopRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [elapsed, maxSeconds, recording]);

  function setPreview(next: Blob | null, name: string | null) {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = next ? URL.createObjectURL(next) : null;
    setPreviewUrl(previewUrlRef.current);
    setBlob(next);
    setFileName(name);
    setLocalError(null);
  }

  async function startRecording() {
    setLocalError(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setLocalError("Este navegador no permite grabar audio. Usa la opción de subir un archivo.");
      setMode("upload");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setPreview(recorded, "grabación.webm");
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      };

      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setElapsed(0);
    } catch (error) {
      setLocalError(
        `No pudimos acceder al micrófono (${errorMessage(error)}). Puedes subir un archivo de audio.`,
      );
      setMode("upload");
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("audio/")) {
      setLocalError("Solo se permiten archivos de audio (mp3, wav, m4a, ogg…).");
      return;
    }
    if (file.size > MAX_BYTES) {
      setLocalError(`El archivo supera los 50 MB (${formatBytes(file.size)}).`);
      return;
    }
    setPreview(file, file.name);
    setElapsed(Math.round(file.size / 16000));
  }

  function extension(): string {
    if (!blob) return "webm";
    const type = blob.type || "";
    if (type.includes("wav")) return "wav";
    if (type.includes("mp4") || type.includes("m4a")) return "m4a";
    if (type.includes("ogg")) return "ogg";
    if (type.includes("mpeg") || type.includes("mp3")) return "mp3";
    return "webm";
  }

  if (!prompt) {
    return (
      <div>
        <StepHeader
          index={4}
          title="Expresión oral"
          description="Graba tu respuesta sobre el tema propuesto."
        />
        <SectionEmpty message="El administrador aún no ha definido un tema oral para este nivel." />
        <StepFooter
          onBack={onBack}
          onNext={() => onSubmit({ blob: null, duration: null, extension: "webm" })}
          nextLabel="Enviar examen"
          loading={submitting}
        />
      </div>
    );
  }

  return (
    <div>
      <StepHeader
        index={4}
        title="Expresión oral"
        description="Habla con naturalidad durante el tiempo indicado. Puedes grabar tu voz o subir un archivo de audio."
        aside={
          <div className="rounded-2xl border border-line bg-white px-4 py-2.5 text-center">
            <p className="text-[10.5px] font-medium tracking-[0.08em] text-faint uppercase">Duración máx.</p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums">{formatSeconds(maxSeconds)}</p>
          </div>
        }
      />

      <div className="anim-rise card overflow-hidden">
        <div className="border-b border-line bg-gradient-to-br from-[#f6f3ff] to-white px-6 py-6 sm:px-8">
          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.1em] text-[#5b4bb7] uppercase">
            <Volume2 className="size-3.5" />
            Tema para hablar
          </div>
          <p className="mt-2.5 text-[17px] leading-relaxed font-medium tracking-[-0.015em] sm:text-[19px]">
            {prompt.prompt}
          </p>
          {prompt.guidance && (
            <p className="mt-2.5 text-[13px] leading-relaxed text-muted">{prompt.guidance}</p>
          )}
        </div>

        <div className="px-6 py-6 sm:px-8">
          <div className="mb-5 inline-flex rounded-xl bg-[#f2f2f5] p-1">
            {(
              [
                { key: "record", label: "Grabar con micrófono", icon: Mic },
                { key: "upload", label: "Subir archivo", icon: Upload },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  if (recording) return;
                  setMode(key);
                }}
                className={cn(
                  "focus-ring flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition",
                  mode === key ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {mode === "record" ? (
            <div className="rounded-2xl border border-line bg-[#fcfcfe] p-6 text-center">
              <div className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={recording ? stopRecording : startRecording}
                  disabled={submitting}
                  className={cn(
                    "focus-ring flex size-20 items-center justify-center rounded-full transition active:scale-95",
                    recording
                      ? "bg-[#fdecec] text-danger ring-4 ring-[#fbdada]"
                      : "bg-ink text-white shadow-[0_14px_40px_-16px_rgba(0,0,0,0.6)] hover:bg-black",
                  )}
                  aria-label={recording ? "Detener grabación" : "Comenzar grabación"}
                >
                  {recording ? (
                    <Square className="size-6" fill="currentColor" />
                  ) : (
                    <Mic className="size-7" strokeWidth={1.8} />
                  )}
                </button>

                <div>
                  <p className="text-[13px] font-medium">
                    {recording ? "Grabando… pulsa para detener" : blob && mode === "record" ? "Grabación lista" : "Toca para grabar tu respuesta"}
                  </p>
                  <p className="mt-0.5 text-[12px] text-faint tabular-nums">
                    {formatSeconds(elapsed)} / {formatSeconds(maxSeconds)}
                    {recording && <span className="rec-dot ml-2 inline-block size-1.5 rounded-full bg-danger align-middle" />}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#d5d5dd] bg-[#fcfcfe] px-6 py-10 text-center transition hover:border-accent/50 hover:bg-accent-soft/40">
              <Upload className="size-6 text-faint" strokeWidth={1.6} />
              <span className="mt-3 text-[13.5px] font-medium">Selecciona un archivo de audio</span>
              <span className="mt-1 text-[12px] text-faint">MP3, WAV, M4A u OGG · máximo 50 MB</span>
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </label>
          )}

          {blob && previewUrl && (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-white p-3.5">
              <audio controls src={previewUrl} className="h-9 w-full min-w-[200px] flex-1" />
              <span className="text-[11.5px] text-faint">
                {fileName} · {formatBytes(blob.size)}
              </span>
              <button
                type="button"
                onClick={() => setPreview(null, null)}
                className="focus-ring flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-danger transition hover:bg-[#fdf0f0]"
              >
                <Trash2 className="size-3.5" />
                Quitar
              </button>
            </div>
          )}

          {localError && (
            <div className="mt-4">
              <Notice tone="danger">{localError}</Notice>
            </div>
          )}
          {submitError && (
            <div className="mt-4">
              <Notice tone="danger">{submitError}</Notice>
            </div>
          )}

          <p className="mt-4 text-[11.5px] leading-relaxed text-faint">
            Al enviar, tu grabación se guarda junto al resto de tus respuestas para que el equipo
            evaluador la revise. El tamaño máximo es de 50 MB.
          </p>
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={() => onSubmit({ blob, duration: blob ? elapsed : null, extension: extension() })}
        nextLabel="Enviar examen"
        loading={submitting}
        nextDisabled={recording}
        hint={blob ? "Respuesta lista" : "Puedes enviar sin grabación, pero se valorará vacía"}
      />
    </div>
  );
}
