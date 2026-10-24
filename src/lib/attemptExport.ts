import type { Attempt } from "./types";

/** Excel/Sheets must not evaluate a candidate-supplied value as a formula. */
function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function cell(value: string | number | null | undefined): string {
  return `"${neutralizeFormula(String(value ?? "")).replace(/"/g, '""')}"`;
}

function number(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? String(Math.round(parsed * 10) / 10) : null;
}

/**
 * Result rows for the administration console. Section columns keep the raw
 * stored values; `toplam` is the final 100-point total so a spreadsheet can be
 * sorted or averaged directly.
 */
export function attemptsToCsv(rows: Attempt[]): string {
  const header = [
    "referencia",
    "nombre",
    "email",
    "nivel",
    "estado",
    "enviado",
    "test_correctas",
    "test_total",
    "test_puntos",
    "listening_puntos",
    "listening_correctas",
    "listening_total",
    "escrita_tarea1",
    "escrita_tarea2",
    "escrita_puntos",
    "oral_parte1",
    "oral_parte2",
    "oral_puntos",
    "total",
    "constancia",
  ];

  const lines = [header.join(",")];

  for (const attempt of rows) {
    lines.push(
      [
        cell(attempt.id.slice(0, 8).toUpperCase()),
        cell(attempt.full_name),
        cell(attempt.email),
        cell(attempt.level),
        cell(attempt.status === "graded" ? "degerlendirildi" : "bekliyor"),
        cell(attempt.submitted_at),
        cell(number(attempt.mc_correct)),
        cell(number(attempt.mc_total)),
        cell(number(attempt.mc_score)),
        cell(number(attempt.listening_score)),
        cell(number(attempt.listening_correct)),
        cell(number(attempt.listening_total)),
        cell(number(attempt.writing_part1_score)),
        cell(number(attempt.writing_part2_score)),
        cell(number(attempt.writing_score)),
        cell(number(attempt.speaking_part1_score)),
        cell(number(attempt.speaking_part2_score)),
        cell(number(attempt.speaking_score)),
        cell(number(attempt.total_score)),
        cell(attempt.certificate_code ?? ""),
      ].join(","),
    );
  }

  return `\uFEFF${lines.join("\r\n")}\r\n`;
}

export function attemptsCsvFileName(): string {
  return `sonuclar-${new Date().toISOString().slice(0, 10)}.csv`;
}
