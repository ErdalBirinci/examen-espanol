import type { QuestionAdmin } from "./types";

export interface ImportRow {
  prompt: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  position: number;
}

export interface ImportIssue {
  row: number;
  message: string;
}

export interface ImportPreview {
  format: "json" | "csv" | null;
  rows: ImportRow[];
  issues: ImportIssue[];
  duplicates: number;
}

const PROMPT_ALIASES = ["prompt", "soru", "sor", "question", "metin", "text"];
const CORRECT_ALIASES = ["correct", "dogru", "dogrucevap", "cevap", "answer", "correctanswer"];
const EXPLANATION_ALIASES = ["explanation", "aciklama", "not", "note"];
const POSITION_ALIASES = ["position", "sira", "sra", "order", "no"];

const OPTION_ALIASES: string[][] = [
  ["a", "optiona", "seceneka", "sikka", "secenek1", "1"],
  ["b", "optionb", "secenekb", "sikb", "secenek2", "2"],
  ["c", "optionc", "secenekc", "sikc", "secenek3", "3"],
  ["d", "optiond", "secenekd", "sikd", "secenek4", "4"],
  ["e", "optione", "seceneke", "sike", "secenek5", "5"],
  ["f", "optionf", "secenekf", "sikf", "secenek6", "6"],
];

export function normalizeKey(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function emptyPreview(): ImportPreview {
  return { format: null, rows: [], issues: [], duplicates: 0 };
}

function parseCorrect(value: unknown, count: number, zeroBased: boolean): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const index = zeroBased ? value : value - 1;
    return Number.isInteger(index) && index >= 0 && index < count ? index : null;
  }
  if (typeof value === "string") {
    const raw = value.trim().toUpperCase();
    if (/^[A-F]$/.test(raw)) {
      const index = raw.charCodeAt(0) - 65;
      return index < count ? index : null;
    }
    const number = Number(raw.replace(",", "."));
    if (Number.isFinite(raw === "" ? NaN : number)) {
      const index = zeroBased ? number : number - 1;
      return Number.isInteger(index) && index >= 0 && index < count ? index : null;
    }
  }
  return null;
}

function columnIndex(header: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const index = header.indexOf(alias);
    if (index >= 0) return index;
  }
  return -1;
}

function createCollector(existing: QuestionAdmin[]) {
  const seen = new Set(existing.map((question) => normalizeKey(question.prompt)));
  let nextPosition = existing.reduce((max, question) => Math.max(max, question.position), 0) + 1;
  const rows: ImportRow[] = [];
  const issues: ImportIssue[] = [];
  let duplicates = 0;

  function add(
    line: number,
    data: {
      prompt: string;
      options: string[];
      correctIndex: number | null;
      explanation?: string | null;
      position?: number;
    },
  ) {
    const prompt = data.prompt.trim();
    if (prompt.length < 3) {
      issues.push({ row: line, message: "Soru metni çok kısa veya boş." });
      return;
    }
    if (data.options.length < 2) {
      issues.push({ row: line, message: "En az iki seçenek gerekli." });
      return;
    }
    if (data.options.some((option) => !option.trim())) {
      issues.push({ row: line, message: "Boş seçenek var; tüm seçenekleri doldur." });
      return;
    }
    if (
      data.correctIndex === null ||
      data.correctIndex < 0 ||
      data.correctIndex >= data.options.length
    ) {
      issues.push({ row: line, message: "Doğru cevap geçersiz (A–D harfi veya 1–4 numarası)." });
      return;
    }

    const key = normalizeKey(prompt);
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);

    const position =
      data.position && Number.isFinite(data.position) && data.position > 0
        ? Math.round(data.position)
        : nextPosition;
    nextPosition = Math.max(nextPosition, position + 1);

    rows.push({
      prompt,
      options: data.options.map((option) => option.trim()),
      correct_index: data.correctIndex,
      explanation: data.explanation?.trim() || null,
      position,
    });
  }

  return {
    rows,
    issues,
    add,
    get duplicates() {
      return duplicates;
    },
  };
}

function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const candidates = [",", ";", "\t"].map((delimiter) => ({
    delimiter,
    count: firstLine.split(delimiter).length - 1,
  }));
  candidates.sort((a, b) => b.count - a.count);
  const delimiter = candidates[0].count > 0 ? candidates[0].delimiter : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === delimiter) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function parseJson(text: string, existing: QuestionAdmin[]): ImportPreview {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      ...emptyPreview(),
      format: "json",
      issues: [{ row: 0, message: "JSON okunamadı; dosyanın geçerli JSON olduğundan emin ol." }],
    };
  }

  const asRecord = data as Record<string, unknown> | null;
  const list = Array.isArray(data)
    ? data
    : asRecord && Array.isArray(asRecord.questions)
      ? (asRecord.questions as unknown[])
      : null;

  if (!list) {
    return {
      ...emptyPreview(),
      format: "json",
      issues: [{ row: 0, message: "JSON bir dizi ya da { \"questions\": [...] } biçiminde olmalı." }],
    };
  }

  const collector = createCollector(existing);

  list.forEach((item, index) => {
    const line = index + 1;
    if (!item || typeof item !== "object") {
      collector.issues.push({ row: line, message: "Kayıt bir nesne değil." });
      return;
    }
    const record = item as Record<string, unknown>;
    const prompt =
      typeof record.prompt === "string"
        ? record.prompt
        : typeof record.soru === "string"
          ? record.soru
          : "";

    let options: string[] = [];
    if (Array.isArray(record.options)) {
      options = record.options.map((option) => String(option ?? ""));
    } else {
      // Only use the letter keys that are actually present, so a question with
      // two options is not rejected because e/f are missing.
      options = ["a", "b", "c", "d", "e", "f"]
        .filter((key) => typeof record[key] === "string")
        .map((key) => record[key] as string);
    }

    const correct =
      record.correct_index !== undefined
        ? parseCorrect(record.correct_index, options.length, true)
        : parseCorrect(record.correct, options.length, false);

    const position =
      typeof record.position === "number"
        ? record.position
        : typeof record.sira === "number"
          ? record.sira
          : undefined;

    const explanation =
      typeof record.explanation === "string"
        ? record.explanation
        : typeof record.aciklama === "string"
          ? record.aciklama
          : null;

    collector.add(line, { prompt, options, correctIndex: correct, explanation, position });
  });

  return {
    format: "json",
    rows: collector.rows,
    issues: collector.issues,
    duplicates: collector.duplicates,
  };
}

function parseCsvText(text: string, existing: QuestionAdmin[]): ImportPreview {
  const rows = parseCsv(text);
  if (rows.length === 0) return emptyPreview();

  const header = rows[0].map(normalizeKey);
  const hasHeader = header.some((cell) => PROMPT_ALIASES.includes(cell));

  const mapping = hasHeader
    ? {
        prompt: columnIndex(header, PROMPT_ALIASES),
        options: OPTION_ALIASES.map((aliases) => columnIndex(header, aliases)),
        correct: columnIndex(header, CORRECT_ALIASES),
        explanation: columnIndex(header, EXPLANATION_ALIASES),
        position: columnIndex(header, POSITION_ALIASES),
      }
    : {
        prompt: 0,
        options: [1, 2, 3, 4],
        correct: 5,
        explanation: 6,
        position: 7,
      };

  const collector = createCollector(existing);
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const optionColumns = mapping.options.filter((column) => column >= 0);

  dataRows.forEach((cells, index) => {
    const line = index + (hasHeader ? 2 : 1);
    const options = optionColumns.map((column) => cells[column] ?? "");
    const correct = parseCorrect(cells[mapping.correct] ?? "", options.length, false);
    const positionRaw = mapping.position >= 0 ? Number(cells[mapping.position]) : NaN;

    collector.add(line, {
      prompt: cells[mapping.prompt] ?? "",
      options,
      correctIndex: correct,
      explanation: mapping.explanation >= 0 ? (cells[mapping.explanation] ?? null) : null,
      position: Number.isFinite(positionRaw) && positionRaw > 0 ? positionRaw : undefined,
    });
  });

  return {
    format: "csv",
    rows: collector.rows,
    issues: collector.issues,
    duplicates: collector.duplicates,
  };
}

export function parseQuestionImport(text: string, existing: QuestionAdmin[]): ImportPreview {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return emptyPreview();
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    return parseJson(trimmed, existing);
  }
  return parseCsvText(trimmed, existing);
}
