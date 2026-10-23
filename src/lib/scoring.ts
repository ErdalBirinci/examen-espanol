import type { Attempt } from "./types";

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
