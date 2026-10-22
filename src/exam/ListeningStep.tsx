import { useState } from "react";
import { Headphones } from "lucide-react";
import { SectionEmpty, StepFooter, StepHeader } from "./Shell";
import AudioPlayer from "./AudioPlayer";
import { listeningAudioUrl } from "../lib/api";
import type { ListeningItem } from "../lib/types";

export default function ListeningStep({
  items,
  answers,
  onChange,
  onNext,
  onBack,
}: {
  items: ListeningItem[];
  answers: Record<string, string>;
  onChange: (itemId: string, text: string) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const [current, setCurrent] = useState(0);
  const [plays, setPlays] = useState<Record<string, number>>({});

  if (items.length === 0) {
    return (
      <div>
        <StepHeader
          index={2}
          title="Audición"
          description="Escucha cada grabación y escribe lo que has entendido."
        />
        <SectionEmpty message="El administrador aún no ha cargado audios para este nivel." />
        <StepFooter onBack={onBack} onNext={onNext} nextLabel="Continuar" />
      </div>
    );
  }

  const item = items[current];
  const isLast = current === items.length - 1;
  const text = answers[item.id] ?? "";

  return (
    <div>
      <StepHeader
        index={2}
        title="Audición"
        description="Escucha la grabación y transcribe con tus propias palabras lo que has escuchado."
        aside={
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-white px-4 py-2.5 text-[12px] text-muted">
            <Headphones className="size-4 text-accent" />
            <span className="tabular-nums">
              Pista {current + 1} de {items.length}
            </span>
          </div>
        }
      />

      <div className="anim-rise card p-6 sm:p-8" key={item.id}>
        <p className="text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">Pista de audio</p>
        <h2 className="mt-1.5 text-[20px] font-semibold tracking-[-0.02em]">{item.title}</h2>

        <div className="mt-5">
          <AudioPlayer
            src={listeningAudioUrl(item.audio_path)}
            plays={plays[item.id] ?? 0}
            maxPlays={item.max_plays}
            onPlay={() =>
              setPlays((prev) => ({
                ...prev,
                [item.id]: Math.min((prev[item.id] ?? 0) + 1, item.max_plays),
              }))
            }
          />
        </div>

        <div className="mt-6">
          <label
            htmlFor={`listening-${item.id}`}
            className="mb-2 block text-[12.5px] font-medium text-muted"
          >
            Escribe lo que has escuchado
          </label>
          <textarea
            id={`listening-${item.id}`}
            className="field min-h-[180px] resize-y leading-relaxed"
            placeholder="En la grabación se habla de…"
            value={text}
            onChange={(event) => onChange(item.id, event.target.value)}
          />
          <div className="mt-1.5 flex justify-between text-[11.5px] text-faint">
            <span>No pasa nada si no entiendes cada palabra: escribe lo que captes.</span>
            <span className="tabular-nums">{text.trim() ? text.trim().split(/\s+/).length : 0} palabras</span>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-line pt-4">
          <button
            type="button"
            onClick={() => setCurrent((index) => Math.max(0, index - 1))}
            disabled={current === 0}
            className="focus-ring rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-muted transition hover:bg-[#f2f2f5] hover:text-ink disabled:opacity-40"
          >
            ← Pista anterior
          </button>
          <button
            type="button"
            onClick={() => (isLast ? onNext() : setCurrent((index) => index + 1))}
            className="focus-ring rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink transition hover:bg-[#f2f2f5]"
          >
            {isLast ? "Ir a escritura →" : "Siguiente pista →"}
          </button>
        </div>
      </div>

      <StepFooter
        onBack={onBack}
        onNext={onNext}
        nextLabel="Ir a la escritura"
        hint={`${items.filter((entry) => (answers[entry.id] ?? "").trim().length > 0).length} de ${items.length} pistas transcritas`}
      />
    </div>
  );
}
