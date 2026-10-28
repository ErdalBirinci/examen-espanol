import { describe, expect, it } from "vitest";
import {
  answerSheetFileName,
  listeningAnswerRows,
  listeningSheet,
  testAnswerRows,
  testSheet,
} from "./answerReport";
import type { Attempt, ListeningQuestionAdmin, QuestionAdmin } from "./types";

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "ab12cd34-0000-0000-0000-000000000000",
    full_name: "Ana Pérez",
    email: "ana@example.com",
    level: "B1",
    status: "graded",
    scoring_version: 2,
    mc_answers: {},
    mc_correct: null,
    mc_total: null,
    mc_score: null,
    test_question_ids: [],
    listening_answers: {},
    listening_question_ids: [],
    listening_correct: null,
    listening_total: null,
    writing_text: null,
    writing_text_2: null,
    speaking_path: null,
    speaking_duration: null,
    listening_score: null,
    writing_part1_score: null,
    writing_part2_score: null,
    writing_score: null,
    speaking_part1_score: null,
    speaking_part2_score: null,
    speaking_score: null,
    total_score: null,
    admin_note: null,
    created_at: "2026-10-01T10:00:00.000Z",
    submitted_at: "2026-10-01T11:00:00.000Z",
    ...overrides,
  };
}

function question(index: number, correct: number): QuestionAdmin {
  return {
    id: `q${index}`,
    level: "B1",
    prompt: `Pregunta ${index}`,
    options: ["uno", "dos", "tres", "cuatro"],
    position: index,
    correct_index: correct,
    explanation: null,
    created_at: "2026-09-01T10:00:00.000Z",
  };
}

function listeningQuestion(index: number, correct: number): ListeningQuestionAdmin {
  return {
    id: `l${index}`,
    item_id: "item-1",
    prompt: `Escucha ${index}`,
    options: ["a", "b", "c"],
    position: index,
    correct_index: correct,
    created_at: "2026-09-01T10:00:00.000Z",
  };
}

describe("testAnswerRows", () => {
  const questions = [question(1, 1), question(2, 3), question(3, 0)];

  it("marks the chosen options as correct or wrong", () => {
    const rows = testAnswerRows(attempt({ mc_answers: { q1: 1, q2: 0, q3: 0 } }), questions);

    expect(rows.map((row) => row.position)).toEqual([1, 2, 3]);
    expect(rows[0]).toMatchObject({ given: "dos", correct: true });
    expect(rows[1]).toMatchObject({ given: "uno", correct: false, expected: "cuatro" });
    expect(rows[2]).toMatchObject({ given: "uno", correct: true });
  });

  it("treats unanswered questions as wrong with no chosen option", () => {
    const rows = testAnswerRows(
      attempt({ mc_answers: { q3: 0 }, test_question_ids: ["q1", "q2", "q3"] }),
      questions,
    );

    expect(rows[0]).toMatchObject({ given: null, correct: false, expected: "dos" });
    expect(rows[1]).toMatchObject({ given: null, correct: false });
    expect(rows).toHaveLength(3);
  });

  it("keeps the stored question set instead of the level's current questions", () => {
    const rows = testAnswerRows(
      attempt({ mc_answers: { q2: 3 }, test_question_ids: ["q2"] }),
      questions,
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ prompt: "Pregunta 2", given: "cuatro", correct: true });
  });

  it("lists only the answered questions when no set was recorded", () => {
    const rows = testAnswerRows(attempt({ mc_answers: { q2: 0 } }), questions);

    expect(rows.map((row) => row.prompt)).toEqual(["Pregunta 2"]);
    expect(rows[0]).toMatchObject({ given: "uno", correct: false });
  });

  it("ignores an answer index that no longer exists in the options", () => {
    const rows = testAnswerRows(
      attempt({ mc_answers: { q1: 9 }, test_question_ids: ["q1"] }),
      [question(1, 1)],
    );

    expect(rows[0]).toMatchObject({ given: null, correct: false });
  });
});

describe("listeningAnswerRows", () => {
  it("keeps the administrator's order and marks each answer", () => {
    const rows = listeningAnswerRows(
      attempt({
        listening_answers: { l2: 2, l1: 0 },
        listening_question_ids: ["l1", "l2"],
      }),
      [listeningQuestion(1, 0), listeningQuestion(2, 1)],
    );

    expect(rows.map((row) => row.prompt)).toEqual(["Escucha 1", "Escucha 2"]);
    expect(rows.map((row) => row.correct)).toEqual([true, false]);
    expect(rows[1].expected).toBe("b");
  });
});

describe("section sheets", () => {
  const rows = testAnswerRows(
    attempt({ mc_answers: { q1: 1, q2: 0 }, test_question_ids: ["q1", "q2"] }),
    [question(1, 1), question(2, 3)],
  );

  it("counts right answers and keeps the stored test score", () => {
    const sheet = testSheet(attempt({ mc_score: 1.5 }), rows);

    expect(sheet.heading).toBe("Vocabulario y Gramática");
    expect(sheet.subtitle).toBe("1 de 2 respuestas correctas · 1,5 / 2 puntos");
    expect(sheet.rows).toHaveLength(2);
  });

  it("falls back to the correct count when no score is stored", () => {
    expect(testSheet(attempt(), rows).subtitle).toBe("1 de 2 respuestas correctas · 1 / 2 puntos");
  });

  it("reports the listening section out of ten", () => {
    const sheet = listeningSheet(attempt({ listening_score: 8 }), [
      ...listeningAnswerRows(attempt({ listening_answers: { l1: 0 } }), [listeningQuestion(1, 0)]),
    ]);

    expect(sheet.heading).toBe("Comprensión Auditiva");
    expect(sheet.subtitle).toBe("1 de 1 respuestas correctas · 8 / 10 puntos");
  });

  it("names the file after the reference code", () => {
    expect(answerSheetFileName("respuestas-test", attempt())).toBe(
      "respuestas-test-b1-ab12cd34.pdf",
    );
  });
});
