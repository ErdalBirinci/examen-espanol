export interface ExportableQuestion {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  position: number;
}

const LETTERS = "ABCDEF";

/** Keeps spreadsheet programs from evaluating a cell as a formula. */
function cell(value: string | number): string {
  const text = String(value);
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
}

/**
 * Builds a CSV that `parseQuestionImport` can read back. Quoting every field
 * keeps commas, quotes and line breaks inside prompts intact, and the BOM lets
 * Excel show Spanish characters correctly.
 */
export function questionsToCsv(questions: ExportableQuestion[]): string {
  const maxOptions = Math.max(4, ...questions.map((question) => question.options.length));
  const letters = LETTERS.slice(0, maxOptions).split("");
  const header = [
    "prompt",
    ...letters.map((letter) => `option_${letter.toLowerCase()}`),
    "correct",
    "explanation",
    "position",
  ];

  const lines = [header.join(",")];

  for (const question of questions) {
    const options = Array.from({ length: maxOptions }, (_, index) => question.options[index] ?? "");
    lines.push(
      [
        cell(question.prompt),
        ...options.map((option) => cell(option)),
        cell(letters[question.correct_index] ?? ""),
        cell(question.explanation ?? ""),
        cell(question.position),
      ].join(","),
    );
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function csvFileName(level: string): string {
  return `preguntas-${level}.csv`;
}
