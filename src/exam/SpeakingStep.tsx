import { useEffect, useRef, useState } from "react";
import { Mic, Square, Trash2, Upload, Volume2 } from "lucide-react";
import { SectionEmpty, StepFooter, StepHeader } from "./Shell";
import { Notice } from "../components/ui";
import type { SpeakingPrompt } from "../lib/types";
import { cn, formatBytes, formatSeconds, errorMessage } from "../lib/utils";

export interface RecordingPayload {
  blob: Blob;
  duration: number | null;
  extension: string;
  name: string;
}

const MAX_BYTES = 50 * 1024 * 1024;
const RING_RADIUS = 44;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function extensionFor(mime: string): string {
  if (mime.includes("wav")) return "wav";
  if (mime.includes("mp4") || mime.includes("m4a")) return "m4a";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mpeg") || mime.includes("mp3")) return "mp3";
  return "webm";
}

export default function SpeakingStep({
  prompt,
  value,
  onChange,
  onContinue,
  onBack,
}: {
  prompt: SpeakingPrompt | null;
  value: RecordingPayload | null;
  onChange: (payload: RecordingPayload | null) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [mode, setMode] = useState<"record" | "upload">("record");
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [localError, setLocalError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [prepRemaining, setPrepRemaining] = useState(0);
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0.08));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const maxSeconds = prompt?.max_seconds ?? 120;

  useEffect(() => {
    if (!value?.blob) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value.blob);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value?.blob]);

  useEffect(() => {
    setPrepRemaining(value ? 0 : (prompt?.prep_seconds ?? 0));
  }, [prompt?.id, prompt?.prep_seconds, value]);

  useEffect(() => {
    if (prepRemaining <= 0) return;
    const timer = window.setInterval(() => {
      setPrepRemaining((remaining) => Math.max(0, remaining - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [prepRemaining]);

  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      void audioCtxRef.current?.close().catch(() => undefined);
    };
  }, []);

  function stopMeter() {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    void audioCtxRef.current?.close().catch(() => undefined);
    audioCtxRef.current = null;
    setLevels(Array(28).fill(0.08));
  }

  function startMeter(stream: MediaStream) {
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.72;
      source.connect(analyser);
      audioCtxRef.current = ctx;

      const buffer = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(buffer);
        setLevels(
          Array.from({ length: 28 }, (_, index) => {
            const sourceIndex = Math.floor((index / 28) * buffer.length);
            return Math.max(0.08, buffer[sourceIndex] / 255);
          }),
        );
        rafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      // The waveform is decorative; recording still works without it.
    }
  }

  function stopRecording() {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
    setRecording(false);
  }

  const stopRef = useRef(stopRecording);
  stopRef.current = stopRecording;

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const seconds = Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000));
      setElapsed(seconds);
      if (seconds >= maxSeconds) stopRef.current();
    }, 400);
    return () => window.clearInterval(timer);
  }, [recording, maxSeconds]);

  async function startRecording() {
    setLocalError(null);
    if (prepRemaining > 0) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setLocalError("Este navegador no permite grabar audio. Usa la opción de subir un archivo.");
      setMode("upload");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      startMeter(stream);

      const preferred = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"].find((type) =>
        MediaRecorder.isTypeSupported(type),
      );
      const recorder = new MediaRecorder(stream, preferred ? { mimeType: preferred } : undefined);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const duration = Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000));
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        stopMeter();
        onChange({
          blob: recorded,
          duration,
          extension: extensionFor(recorded.type),
          name: "grabación",
        });
      };

      recorder.start();
      recorderRef.current = recorder;
      startedAtRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
    } catch (error) {
      setLocalError(
        `No pudimos acceder al micrófono (${errorMessage(error)}). Puedes subir un archivo de audio.`,
      );
      setMode("upload");
    }
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
    setLocalError(null);
    setConfirmRemove(false);
    onChange({
      blob: file,
      duration: Math.max(1, Math.round(file.size / 16000)),
      extension: extensionFor(file.type),
      name: file.name,
    });
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
        <StepFooter onBack={onBack} onNext={onContinue} nextLabel="Revisar y enviar" />
      </div>
    );
  }

  const ringProgress = Math.min(1, elapsed / maxSeconds);

  return (
    <div>
      <StepHeader
        index={4}
        title="Expresión oral"
        description="Prepara tu respuesta, graba con naturalidad y revisa la grabación antes de enviar."
        aside={
          <div className="glass-inset rounded-2xl px-4 py-2.5 text-center">
            <p className="text-[10.5px] font-medium tracking-[0.08em] text-faint uppercase">Duración máx.</p>
            <p className="mt-0.5 text-[17px] font-semibold tabular-nums">{formatSeconds(maxSeconds)}</p>
          </div>
        }
      />

      <div className="anim-rise card overflow-hidden">
        <div className="border-b border-white/70 bg-[linear-gradient(135deg,rgba(243,247,255,0.85),rgba(255,255,255,0.35))] px-6 py-6 sm:px-8">
          <div className="flex items-center gap-2 text-[10.5px] font-semibold tracking-[0.12em] text-accent-ink uppercase">
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
          <div className="premium-segmented mb-5 inline-flex w-auto">
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
                data-active={mode === key}
                className={cn(
                  "focus-ring flex items-center justify-center gap-1.5",
                  recording && "cursor-not-allowed opacity-60",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>

          {mode === "record" ? (
            <div className="glass-inset rounded-2xl p-6">
              {prepRemaining > 0 ? (
                <div className="flex flex-col items-center gap-3 py-2 text-center">
                  <div className="relative flex size-24 items-center justify-center">
                    <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                      <circle cx="50" cy="50" r={RING_RADIUS} fill="none" stroke="#e4eaf4" strokeWidth="5" />
                      <circle
                        cx="50"
                        cy="50"
                        r={RING_RADIUS}
                        fill="none"
                        stroke="#2f6bff"
                        strokeWidth="5"
                        strokeLinecap="round"
                        strokeDasharray={RING_CIRCUMFERENCE}
                        strokeDashoffset={
                          RING_CIRCUMFERENCE * (1 - prepRemaining / Math.max(1, prompt.prep_seconds))
                        }
                        className="transition-all duration-1000 ease-linear"
                      />
                    </svg>
                    <span className="text-[20px] font-semibold tabular-nums">
                      {formatSeconds(prepRemaining)}
                    </span>
                  </div>
                  <div>
                    <p className="text-[13.5px] font-medium">Tiempo de preparación</p>
                    <p className="mt-0.5 text-[12px] text-muted">
                      Piensa lo que vas a decir. La grabación se activará al terminar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPrepRemaining(0)}
                    className="text-[11.5px] font-medium text-accent-ink underline-offset-2 hover:underline"
                  >
                    Empezar antes
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4">
                  <button
                    type="button"
                    onClick={recording ? stopRecording : startRecording}
                    aria-label={recording ? "Detener grabación" : "Comenzar grabación"}
                    className={cn(
                      "focus-ring relative flex size-24 items-center justify-center rounded-full transition active:scale-95",
                      recording
                        ? "bg-[#fdecec] text-danger ring-4 ring-[#fbdada]"
                        : "bg-[linear-gradient(145deg,#1b2f4f,#2f5588)] text-white shadow-[0_18px_40px_-18px_rgba(18,35,62,0.9),inset_0_1px_0_rgba(255,255,255,0.2)] hover:brightness-110",
                    )}
                  >
                    {recording && (
                      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90">
                        <circle
                          cx="50"
                          cy="50"
                          r={RING_RADIUS}
                          fill="none"
                          stroke="#e5484d"
                          strokeWidth="4"
                          strokeLinecap="round"
                          strokeDasharray={RING_CIRCUMFERENCE}
                          strokeDashoffset={RING_CIRCUMFERENCE * (1 - ringProgress)}
                          className="transition-[stroke-dashoffset] duration-300 ease-linear"
                        />
                      </svg>
                    )}
                    {recording ? (
                      <Square className="size-6" fill="currentColor" />
                    ) : (
                      <Mic className="size-7" strokeWidth={1.8} />
                    )}
                  </button>

                  <div className="w-full max-w-xs">
                    <div className="flex h-10 items-end justify-center gap-[3px]">
                      {levels.map((level, index) => (
                        <span
                          key={index}
                          className={cn(
                            "w-[5px] rounded-full transition-[height] duration-100",
                            recording ? "bg-[#2f6bff]/70" : "bg-[#dbe6f5]",
                          )}
                          style={{ height: `${Math.round(level * 100)}%` }}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-center text-[12px] text-faint tabular-nums">
                      {formatSeconds(elapsed)} / {formatSeconds(maxSeconds)}
                      {recording && (
                        <span className="rec-dot ml-2 inline-block size-1.5 rounded-full bg-danger align-middle" />
                      )}
                    </p>
                  </div>

                  <p className="text-center text-[13px] font-medium">
                    {recording
                      ? "Grabando… pulsa para detener"
                      : value
                        ? "Puedes volver a grabar si lo necesitas"
                        : "Toca para grabar tu respuesta"}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#c9d9ee] bg-white/35 px-6 py-10 text-center backdrop-blur-xl transition hover:border-accent/50 hover:bg-white/65">
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

          {value && previewUrl && (
            <div className="glass-inset mt-4 rounded-2xl p-3.5">
              <audio controls src={previewUrl} className="h-9 w-full" />
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11.5px] text-faint">
                  {value.name} · {formatBytes(value.blob.size)}
                  {value.duration ? ` · ${formatSeconds(value.duration)}` : ""}
                </span>
                {confirmRemove ? (
                  <span className="flex items-center gap-2 text-[12px]">
                    <span className="text-danger">¿Descartar la grabación?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(null);
                        setConfirmRemove(false);
                        setElapsed(0);
                      }}
                      className="rounded-lg bg-[#fdf0f0] px-2 py-1 font-medium text-danger"
                    >
                      Sí, descartar
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmRemove(false)}
                      className="rounded-lg px-2 py-1 font-medium text-muted hover:bg-[#f3f3f6]"
                    >
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(true)}
                    className="focus-ring flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium text-danger transition hover:bg-[#fdf0f0]"
                  >
                    <Trash2 className="size-3.5" />
                    Quitar
                  </button>
                )}
              </div>
            </div>
          )}

          {localError && (
            <div className="mt-4">
              <Notice tone="danger">{localError}</Notice>
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
        onNext={onContinue}
        nextLabel="Revisar y enviar"
        nextDisabled={recording}
        hint={value ? "Respuesta lista" : "Puedes continuar sin grabación, pero puntuará vacía"}
      />
    </div>
  );
}
