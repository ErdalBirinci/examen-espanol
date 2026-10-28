import { describe, expect, it } from "vitest";
import { attemptToResult, attemptTotal, resultBreakdown, testPercent, testScore } from "./scoring";
import type { Attempt, AttemptResult } from "./types";

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "00000000-0000-0000-0000-000000000000",
    full_name: "Ana Pérez",
    email: "ana@example.com",
    level: "B1",
    status: "graded",
    scoring_version: 2,
    mc_answers: {},
    mc_correct: 40,
    mc_total: 50,
    mc_score: null,
    test_question_ids: [],
    listening_answers: {},
    listening_question_ids: [],
    listening_correct: 8,
    listening_total: 10,
    writing_text: null,
    writing_text_2: null,
    speaking_path: null,
    speaking_duration: null,
    listening_score: 8,
    writing_part1_score: 8,
    writing_part2_score: 7,
    writing_score: 15,
    speaking_part1_score: 8,
    speaking_part2_score: 6,
    speaking_score: 14,
    total_score: null,
    admin_note: null,
    created_at: "2026-10-01T10:00:00.000Z",
    submitted_at: "2026-10-01T11:00:00.000Z",
    ...overrides,
  };
}

describe("testScore", () => {
  it("uses the stored 50-point score when present", () => {
    expect(testScore(attempt({ mc_score: 42.5 }))).toBe(42.5);
  });

  it("derives one point per question from correct answers", () => {
    expect(testScore(attempt({ mc_score: null }))).toBe(40);
  });

  it("returns null without a question set", () => {
    expect(testScore(attempt({ mc_score: null, mc_total: 0, mc_correct: 0 }))).toBeNull();
  });
});

describe("attemptTotal", () => {
  it("adds the four sections on the 100-point model", () => {
    expect(attemptTotal(attempt())).toBe(40 + 8 + 15 + 14);
  });

  it("waits for every section before publishing a total", () => {
    expect(attemptTotal(attempt({ speaking_score: null }))).toBeNull();
  });

  it("keeps the weighted formula for legacy attempts", () => {
    const legacy = attempt({
      scoring_version: 1,
      mc_score: null,
      mc_correct: 40,
      mc_total: 50,
      listening_score: 80,
      writing_score: 60,
      speaking_score: 40,
    });
    expect(testPercent(legacy)).toBe(80);
    expect(attemptTotal(legacy)).toBe(68);
  });
});

describe("attemptToResult", () => {
  it("reuses the result reference and total the candidate sees", () => {
    const result = attemptToResult(
      attempt({ id: "ab12cd34-0000-0000-0000-000000000000" }),
    );
    expect(result.reference).toBe("AB12CD34");
    expect(result.total_score).toBe(77);
    expect(result.writing_part2_score).toBe(7);
  });

  it("leaves the total empty until every section is scored", () => {
    expect(attemptToResult(attempt({ writing_score: null })).total_score).toBeNull();
  });
});

describe("resultBreakdown", () => {
  it("reports section maxima for new attempts", () => {
    const result: AttemptResult = {
      reference: "ABCD1234",
      full_name: "Ana Pérez",
      level: "B1",
      status: "graded",
      submitted_at: "2026-10-01T11:00:00.000Z",
      scoring_version: 2,
      mc_correct: 40,
      mc_total: 50,
      mc_score: 40,
      listening_score: 8,
      listening_correct: 8,
      listening_total: 10,
      writing_score: 15,
      writing_part1_score: 8,
      writing_part2_score: 7,
      speaking_part1_score: 8,
      speaking_part2_score: 6,
      speaking_score: 14,
      total_score: 77,
    };

    expect(resultBreakdown(result).map((row) => row.max)).toEqual([50, 10, 20, 20]);
  });

  it("shows both speaking part scores in the detail line", () => {
    const rows = resultBreakdown({
      reference: "ABCD1234",
      full_name: "Ana Pérez",
      level: "B1",
      status: "graded",
      submitted_at: "2026-10-01T11:00:00.000Z",
      scoring_version: 2,
      mc_correct: 40,
      mc_total: 50,
      mc_score: 40,
      listening_score: 8,
      listening_correct: 8,
      listening_total: 10,
      writing_score: 15,
      writing_part1_score: 8,
      writing_part2_score: 7,
      speaking_part1_score: 6,
      speaking_part2_score: 9,
      speaking_score: 15,
      total_score: 78,
    });

    expect(rows.find((row) => row.key === "speaking")?.detail).toBe(
      "Parte 1: 6/10 · Parte 2: 9/10",
    );
  });

  it("keeps the section rows readable when the server omits part scores", () => {
    const result = {
      reference: "ABCD1234",
      full_name: "Ana Pérez",
      level: "B1",
      status: "graded",
      submitted_at: "2026-10-01T11:00:00.000Z",
      scoring_version: 2,
      mc_correct: 40,
      mc_total: 50,
      mc_score: 40,
      listening_score: 8,
      listening_correct: 8,
      listening_total: 10,
      writing_score: 15,
      writing_part1_score: 8,
      writing_part2_score: 7,
      speaking_score: 15,
      total_score: 78,
    } as unknown as AttemptResult;

    const speaking = resultBreakdown(result).find((row) => row.key === "speaking");
    expect(speaking).toMatchObject({ score: 15, max: 20, detail: null });
  });
});
