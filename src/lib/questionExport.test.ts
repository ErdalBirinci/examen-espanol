import { describe, expect, it } from "vitest";
import { questionsToCsv } from "./questionExport";

describe("questionsToCsv", () => {
  it("neutralizes prompts that start with a formula character", () => {
    const csv = questionsToCsv([
      {
        prompt: "=1+1",
        options: ["a", "b", "c", "d"],
        correct_index: 0,
        explanation: null,
        position: 1,
      },
    ]);

    expect(csv).toContain("\"'=1+1\"");
  });

  it("keeps commas and quotes inside quoted cells", () => {
    const csv = questionsToCsv([
      {
        prompt: 'Pablo dijo "hola", luego …',
        options: ["a", "b", "c", "d"],
        correct_index: 0,
        explanation: null,
        position: 1,
      },
    ]);

    expect(csv).toContain('"Pablo dijo ""hola"", luego …"');
  });
});
