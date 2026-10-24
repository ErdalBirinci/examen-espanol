import type { Attempt, AttemptResult } from "./types";

/** Points available in each section of the 50 + 10 + 20 + 20 model. */
export const SECTION_MAX = {
  test: 50,
  listening: 10,
  writing: 20,
  speaking: 20,
} as const;

export const TOTAL_MAX = 100;

function numeric(value: number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Test result on the 50-point scale (1 point per question when the set has 50). */
export function testScore(attempt: Attempt): number | null {
  const stored = numeric(attempt.mc_score);
  if (stored !== null) return Math.round(stored * 10) / 10;
  if (!attempt.mc_total || attempt.mc_total <= 0) return null;
  return (
    Math.round(((attempt.mc_correct ?? 0) / attempt.mc_total) * SECTION_MAX.test * 10) / 10
  );
}

/** Old percentage view, kept for the answer key and legacy rows. */
export function testPercent(attempt: Attempt): number | null {
  if (!attempt.mc_total || attempt.mc_total <= 0) return null;
  return Math.round(((attempt.mc_correct ?? 0) / attempt.mc_total) * 100);
}

/**
 * Weighted total. New attempts add the four section points directly; rows
 * created before the 50 + 10 + 20 + 20 model keep the old 40/20/20/20 formula.
 * Returns null until every section has a score.
 */
export function attemptTotal(attempt: Attempt): number | null {
  if (attempt.scoring_version >= 2) {
    const test = testScore(attempt);
    const listening = numeric(attempt.listening_score);
    const writing = numeric(attempt.writing_score);
    const speaking = numeric(attempt.speaking_score);
    if (test === null || listening === null || writing === null || speaking === null) {
      return null;
    }
    return Math.round(test + listening + writing + speaking);
  }

  const test = testPercent(attempt);
  const listening = numeric(attempt.listening_score);
  const writing = numeric(attempt.writing_score);
  const speaking = numeric(attempt.speaking_score);
  if (test === null || listening === null || writing === null || speaking === null) {
    return null;
  }
  return Math.round(test * 0.4 + listening * 0.2 + writing * 0.2 + speaking * 0.2);
}

export interface ResultRow {
  key: "test" | "listening" | "writing" | "speaking";
  label: string;
  score: number | null;
  max: number;
  detail: string | null;
}

/**
 * Section-by-section view of a published result. New attempts are shown on the
 * 50 + 10 + 20 + 20 scale, older ones keep their 0–100 section scores.
 */
export function resultBreakdown(result: AttemptResult): ResultRow[] {
  const isNewScale = result.scoring_version >= 2;
  // Bölüm puanları eski satırlarda ya da eski yanıtlarda hiç gelmeyebilir.
  const writing1 = result.writing_part1_score ?? null;
  const writing2 = result.writing_part2_score ?? null;
  const speaking1 = result.speaking_part1_score ?? null;
  const speaking2 = result.speaking_part2_score ?? null;

  return [
    {
      key: "test",
      label: "Vocabulario y Gramática",
      score: isNewScale
        ? result.mc_score ??
          (result.mc_total ? Math.round(((result.mc_correct ?? 0) / result.mc_total) * 50) : null)
        : result.mc_total
          ? Math.round(((result.mc_correct ?? 0) / result.mc_total) * 100)
          : null,
      max: isNewScale ? 50 : 100,
      detail: `${result.mc_correct ?? 0} de ${result.mc_total ?? 0} correctas`,
    },
    {
      key: "listening",
      label: "Comprensión Auditiva",
      score: result.listening_score,
      max: isNewScale ? 10 : 100,
      detail:
        isNewScale && result.listening_total
          ? `${result.listening_correct ?? 0} de ${result.listening_total} correctas`
          : null,
    },
    {
      key: "writing",
      label: "Expresión Escrita",
      score: result.writing_score,
      max: isNewScale ? 20 : 100,
      detail:
        isNewScale && (writing1 !== null || writing2 !== null)
          ? `Tarea 1: ${writing1 ?? "—"}/10 · Tarea 2: ${writing2 ?? "—"}/10`
          : null,
    },
    {
      key: "speaking",
      label: "Expresión Oral",
      score: result.speaking_score,
      max: isNewScale ? 20 : 100,
      detail:
        isNewScale && (speaking1 !== null || speaking2 !== null)
          ? `Parte 1: ${speaking1 ?? "—"}/10 · Parte 2: ${speaking2 ?? "—"}/10`
          : null,
    },
  ];
}
