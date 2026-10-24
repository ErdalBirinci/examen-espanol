import { describe, expect, it } from "vitest";
import { attemptsCsvFileName, attemptsToCsv } from "./attemptExport";
import type { Attempt } from "./types";

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    id: "abcdef12-0000-0000-0000-000000000000",
    full_name: "Pérez, Ana",
    email: "ana@example.com",
    level: "B1",
    status: "graded",
    scoring_version: 2,
    mc_answers: {},
    mc_correct: 40,
    mc_total: 50,
    mc_score: 40,
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
    writing_part1_score: 8.25,
    writing_part2_score: 7,
    writing_score: 15.25,
    speaking_part1_score: 8,
    speaking_part2_score: 6,
    speaking_score: 14,
    total_score: 77,
    admin_note: null,
    created_at: "2026-10-01T10:00:00.000Z",
    submitted_at: "2026-10-01T11:00:00.000Z",
    ...overrides,
  };
}

describe("attemptsToCsv", () => {
  it("starts with a BOM so Excel reads accents", () => {
    const csv = attemptsToCsv([]);
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv.split("\r\n")[0].startsWith("\uFEFFreferencia,")).toBe(true);
  });

  it("quotes names that contain a comma and rounds decimals", () => {
    const csv = attemptsToCsv([attempt()]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain('"Pérez, Ana"');
    expect(row).toContain('"8.3"');
    expect(row).toContain('"ABCDEF12"');
  });

  it("marks legacy attempts as pending when they have no grade", () => {
    const csv = attemptsToCsv([attempt({ status: "submitted", total_score: null })]);
    expect(csv).toContain('"bekliyor"');
  });

  it("neutralizes spreadsheet formulas in candidate values", () => {
    const csv = attemptsToCsv([
      attempt({ full_name: '=HYPERLINK("http://evil","x")', email: "+cmd@example.com" }),
    ]);
    const row = csv.split("\r\n")[1];
    expect(row).toContain("\"'=HYPERLINK");
    expect(row).toContain("\"'+cmd@example.com\"");
  });

  it("names the file after the export date", () => {
    expect(attemptsCsvFileName()).toMatch(/^sonuclar-\d{4}-\d{2}-\d{2}\.csv$/);
  });
});
