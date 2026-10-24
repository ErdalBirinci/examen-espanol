import { describe, expect, it } from "vitest";
import { parseQuestionImport } from "./questionImport";
import type { QuestionAdmin } from "./types";

function existingQuestion(overrides: Partial<QuestionAdmin> = {}): QuestionAdmin {
  return {
    id: "11111111-1111-1111-1111-111111111111",
    level: "B1",
    prompt: "Pablo es alto y …",
    options: ["hermanos", "pesimista", "fotos", "fuerte"],
    correct_index: 3,
    explanation: null,
    position: 1,
    created_at: "2026-10-01T10:00:00.000Z",
    ...overrides,
  };
}

describe("parseQuestionImport", () => {
  it("reads a JSON array with letter answers", () => {
    const preview = parseQuestionImport(
      JSON.stringify([
        {
          prompt: "Los ojos de Pablo son …",
          options: ["hermanos", "pesimista", "fotos", "azules"],
          correct: "D",
          explanation: "azules = mavi",
        },
      ]),
      [],
    );

    expect(preview.format).toBe("json");
    expect(preview.issues).toEqual([]);
    expect(preview.rows).toHaveLength(1);
    expect(preview.rows[0].correct_index).toBe(3);
    expect(preview.rows[0].explanation).toBe("azules = mavi");
  });

  it("flags rows that already exist in the level", () => {
    const preview = parseQuestionImport(
      JSON.stringify([
        {
          prompt: "Pablo es alto y …",
          options: ["hermanos", "pesimista", "fotos", "fuerte"],
          correct: 3,
        },
      ]),
      [existingQuestion()],
    );

    expect(preview.rows).toHaveLength(0);
    expect(preview.duplicates).toBe(1);
  });

  it("reports invalid JSON instead of throwing", () => {
    const preview = parseQuestionImport("{ nope", []);
    expect(preview.rows).toEqual([]);
    expect(preview.issues[0]?.message).toContain("JSON");
  });

  it("rejects a question without options", () => {
    const preview = parseQuestionImport(
      JSON.stringify([{ prompt: "Solo una opción", options: ["a"], correct: "A" }]),
      [],
    );
    expect(preview.rows).toHaveLength(0);
    expect(preview.issues.length).toBeGreaterThan(0);
  });
});
