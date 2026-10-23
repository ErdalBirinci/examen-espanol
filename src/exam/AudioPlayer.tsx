import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { formatSeconds } from "../lib/utils";
import { cn } from "../lib/utils";

export default function AudioPlayer({
  src,
  plays,
  maxPlays,
  onPlay,
}: {
  src: string;
  plays: number;
  maxPlays: number;
  onPlay: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const exhausted = plays >= maxPlays;

  useEffect(() => {
    setCurrentTime(0);
    setDuration(0);
    setPlaying(false);
    setError(null);
  }, [src]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    if (exhausted) return;
    try {
      await audio.play();
      setPlaying(true);
      onPlay();
    } catch {
      setError("Este dispositivo no permite reproducir el audio.");
    }
  }

  return (
    <div className="glass-inset rounded-2xl p-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onEnded={() => setPlaying(false)}
        onPause={() => setPlaying(false)}
      />

      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={exhausted && !playing}
          aria-label={playing ? "Pausar" : "Escuchar"}
          className={cn(
            "focus-ring flex size-12 shrink-0 items-center justify-center rounded-full transition active:scale-95",
            exhausted && !playing
              ? "cursor-not-allowed bg-white/50 text-faint"
              : "bg-[linear-gradient(135deg,#16243d_0%,#2b4a7d_100%)] text-white shadow-[0_12px_24px_-14px_rgba(18,35,62,0.8)] hover:brightness-110",
          )}
        >
          {playing ? <Pause className="size-4.5" fill="currentColor" /> : <Play className="size-4.5 translate-x-0.5" fill="currentColor" />}
        </button>

        <div className="min-w-0 flex-1">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={(event) => {
              const audio = audioRef.current;
              if (!audio) return;
              const value = Number(event.target.value);
              audio.currentTime = value;
              setCurrentTime(value);
            }}
            aria-label="Posición del audio"
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-[#e2e9f3] accent-[#2f6bff]"
          />
          <div className="mt-1.5 flex items-center justify-between text-[11px] text-faint tabular-nums">
            <span>{formatSeconds(currentTime)}</span>
            <span>{duration ? formatSeconds(duration) : "—:—"}</span>
          </div>
        </div>

        <div className="shrink-0 text-right">
          <p className="text-[10px] font-medium tracking-[0.06em] text-faint uppercase">Escuchas</p>
          <p className="text-[13px] font-semibold tabular-nums">
            {Math.min(plays, maxPlays)}
            <span className="font-normal text-faint"> / {maxPlays}</span>
          </p>
        </div>
      </div>

      {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
      {exhausted && (
        <p className="mt-2 text-[12px] text-warning">
          Has utilizado todas las reproducciones disponibles para esta pista.
        </p>
      )}
    </div>
  );
}
