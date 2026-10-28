import { buildPdfFromJpegs, canvasToJpeg, type PdfImagePage } from "./pdf";
import type { Attempt, Level, ListeningQuestionAdmin, QuestionAdmin } from "./types";

/**
 * Answer sheet rendering for the administration console. Every question of a
 * section is printed with the option the candidate chose and a clear
 * correcta / incorrecta mark, paginated over A4 portrait pages.
 */

const WIDTH = 1654;
const HEIGHT = 2339;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN = 120;
const RIGHT = WIDTH - MARGIN;

const BAND_H = 168;
const TOP = 300;
const BOTTOM = 2108;

const NAVY = "#14253c";
const GOLD_LIGHT = "#e6cda1";
const MUTED = "#626b76";
const FAINT = "#8a8f98";
const LINE = "#e4e8f0";
const OK = "#1f7a4c";
const OK_BG = "#eef8f1";
const BAD = "#a33b3b";
const BAD_BG = "#fdf1f1";

const PROMPT_FONT = "400 25px Inter, Arial, sans-serif";
const PROMPT_LINE = 32;
const PROMPT_MAX_LINES = 2;
const ANSWER_FONT = "400 22px Inter, Arial, sans-serif";

const NUMBER_X = MARGIN;
const PROMPT_X = MARGIN + 62;
const BADGE_W = 160;
const BADGE_H = 46;
const PROMPT_WIDTH = RIGHT - PROMPT_X - BADGE_W - 24;

const SHEET_HEADER_HEIGHT = 112;
const ROW_GAP = 96;

/** One printed question: what the candidate chose and what was expected. */
export interface AnswerRow {
  position: number;
  prompt: string;
  given: string | null;
  expected: string | null;
  correct: boolean;
}

export interface AnswerSheet {
  heading: string;
  subtitle: string;
  rows: AnswerRow[];
}

export interface SheetDocument {
  title: string;
  reference: string;
  candidate: string;
  level: Level;
  submittedAt: string;
}

export function testAnswerRows(attempt: Attempt, questions: QuestionAdmin[]): AnswerRow[] {
  const answers = attempt.mc_answers ?? {};
  return scopeQuestions(attempt.test_question_ids, questions, answers).map((question, index) => {
    const answer = answers[question.id];
    const given =
      typeof answer === "number" && question.options[answer] !== undefined
        ? question.options[answer]
        : null;
    return {
      position: index + 1,
      prompt: question.prompt,
      given,
      expected: question.options[question.correct_index] ?? null,
      correct: given !== null && answer === question.correct_index,
    };
  });
}

export function listeningAnswerRows(
  attempt: Attempt,
  questions: ListeningQuestionAdmin[],
): AnswerRow[] {
  const answers = attempt.listening_answers ?? {};
  const scoped = scopeQuestions(attempt.listening_question_ids, questions, answers);
  return scoped.map((question, index) => {
    const answer = answers[question.id];
    const given =
      typeof answer === "number" && question.options[answer] !== undefined
        ? question.options[answer]
        : null;
    return {
      position: index + 1,
      prompt: question.prompt,
      given,
      expected: question.options[question.correct_index] ?? null,
      correct: given !== null && answer === question.correct_index,
    };
  });
}

/**
 * Attempts recorded before the fixed question set existed do not carry the ids
 * they were given; printing the whole level would invent questions the
 * candidate never saw, so those sheets only list the questions they answered.
 */
function scopeQuestions<T extends { id: string }>(
  ids: string[] | null,
  questions: T[],
  answers: Record<string, number>,
): T[] {
  if (ids && ids.length > 0) {
    return questions.filter((question) => ids.includes(question.id));
  }
  return questions.filter((question) => question.id in answers);
}

function countCorrect(rows: AnswerRow[]): number {
  return rows.filter((row) => row.correct).length;
}

function points(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(Math.round(Number(value) * 10) / 10).replace(".", ",");
}

export function testSheet(attempt: Attempt, rows: AnswerRow[]): AnswerSheet {
  const correct = countCorrect(rows);
  const score = attempt.mc_score ?? correct;
  return {
    heading: "Vocabulario y Gramática",
    subtitle:
      attempt.scoring_version >= 2
        ? `${correct} de ${rows.length} respuestas correctas · ${points(score)} / ${rows.length} puntos`
        : `${correct} de ${rows.length} respuestas correctas`,
    rows,
  };
}

export function listeningSheet(attempt: Attempt, rows: AnswerRow[]): AnswerSheet {
  const correct = countCorrect(rows);
  const score = attempt.listening_score ?? correct;
  return {
    heading: "Comprensión Auditiva",
    subtitle: `${correct} de ${rows.length} respuestas correctas · ${points(score)} / 10 puntos`,
    rows,
  };
}

export function answerSheetFileName(prefix: string, attempt: Attempt): string {
  const reference = (attempt.id.slice(0, 8) || "examen").toLowerCase();
  return `${prefix}-${attempt.level.toLowerCase()}-${reference}.pdf`;
}

export async function downloadAnswerSheet(
  doc: SheetDocument,
  sheets: AnswerSheet[],
  filename: string,
): Promise<void> {
  const printable = sheets.filter((sheet) => sheet.rows.length > 0);
  if (printable.length === 0) {
    throw new Error("Bu bölüm için yazdırılacak cevap bulunamadı.");
  }

  try {
    await document.fonts.ready;
  } catch {
    // A missing webfont should not block the document.
  }

  const pages: PdfImagePage[] = [];
  for (const canvas of drawAnswerSheetPages(doc, printable)) {
    pages.push({
      jpeg: await canvasToJpeg(canvas, 0.9),
      width: canvas.width,
      height: canvas.height,
    });
  }

  saveBlob(buildPdfFromJpegs(pages, PAGE_WIDTH, PAGE_HEIGHT), filename);
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

type Block =
  | { kind: "sheet"; sheet: AnswerSheet; height: number }
  | { kind: "row"; row: AnswerRow; lines: string[]; height: number };

interface SheetPage {
  blocks: Block[];
  heading: string;
}

export function drawAnswerSheetPages(
  doc: SheetDocument,
  sheets: AnswerSheet[],
): HTMLCanvasElement[] {
  const measure = document.createElement("canvas");
  measure.width = WIDTH;
  measure.height = HEIGHT;
  const measureCtx = measure.getContext("2d");
  if (!measureCtx) throw new Error("El lienzo del informe no está disponible.");

  /* ---------------- pagination ---------------- */
  const pages: SheetPage[] = [];
  let blocks: Block[] = [];
  let heading = sheets[0]?.heading ?? "";
  let y = TOP;

  function flush() {
    if (blocks.length > 0) pages.push({ blocks, heading });
    blocks = [];
    y = TOP;
  }

  for (const sheet of sheets) {
    heading = sheet.heading;
    const rows = sheet.rows.map<Block>((row) => {
      const lines = wrapPrompt(measureCtx, row.prompt);
      return { kind: "row", row, lines, height: lines.length * PROMPT_LINE + ROW_GAP };
    });

    // Keep the section heading together with at least its first question.
    const firstRowHeight = rows[0]?.height ?? 0;
    if (y + SHEET_HEADER_HEIGHT + firstRowHeight > BOTTOM) {
      flush();
    }
    heading = sheet.heading;
    blocks.push({ kind: "sheet", sheet, height: SHEET_HEADER_HEIGHT });
    y += SHEET_HEADER_HEIGHT;

    for (const block of rows) {
      if (y + block.height > BOTTOM) {
        flush();
      }
      blocks.push(block);
      y += block.height;
    }
  }
  flush();

  /* ---------------- rendering ---------------- */
  return pages.map((page, index) => {
    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("El lienzo del informe no está disponible.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    drawBand(ctx, doc, index > 0 ? page.heading : null);

    if (index === 0) {
      ctx.textAlign = "left";
      ctx.fillStyle = NAVY;
      ctx.font = "600 27px Inter, Arial, sans-serif";
      ctx.fillText(doc.candidate.trim() || "Candidato", MARGIN, 232);

      ctx.textAlign = "right";
      ctx.fillStyle = MUTED;
      ctx.font = "400 20px Inter, Arial, sans-serif";
      ctx.fillText(
        `Nivel ${doc.level} · Enviado el ${formatSubmitted(doc.submittedAt)}`,
        RIGHT,
        232,
      );
    }

    ctx.textAlign = "left";
    let cursor = TOP;
    for (const block of page.blocks) {
      if (block.kind === "sheet") {
        drawSheetHeader(ctx, block.sheet, cursor);
      } else {
        drawRow(ctx, block.row, block.lines, cursor);
      }
      cursor += block.height;
    }

    /* ---------------- footer ---------------- */
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(MARGIN, 2196);
    ctx.lineTo(RIGHT, 2196);
    ctx.stroke();

    ctx.textAlign = "left";
    ctx.fillStyle = FAINT;
    ctx.font = "400 17px Inter, Arial, sans-serif";
    ctx.fillText(`${doc.title} · documento informativo`, MARGIN, 2240);

    ctx.textAlign = "right";
    ctx.fillText(`Página ${index + 1} de ${pages.length}`, RIGHT, 2240);

    return canvas;
  });
}

function drawBand(ctx: CanvasRenderingContext2D, doc: SheetDocument, continuation: string | null) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, WIDTH, BAND_H);

  drawSpaced(
    ctx,
    "CENTRO DE EVALUACIÓN DE LENGUA ESPAÑOLA",
    MARGIN,
    56,
    6,
    "600 16px Inter, Arial, sans-serif",
    GOLD_LIGHT,
  );

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 36px Inter, Arial, sans-serif";
  ctx.fillText(doc.title, MARGIN, 112);

  if (continuation) {
    ctx.fillStyle = "#9fb0c9";
    ctx.font = "400 21px Inter, Arial, sans-serif";
    ctx.fillText(`${continuation} · continuación`, MARGIN, 150);
  }

  ctx.textAlign = "right";
  ctx.fillStyle = "#8fa2bd";
  ctx.font = "600 14px Inter, Arial, sans-serif";
  ctx.fillText("REFERENCIA", RIGHT, 64);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 26px 'SFMono-Regular', Consolas, monospace";
  ctx.fillText(doc.reference, RIGHT, 106);
}

function drawSheetHeader(ctx: CanvasRenderingContext2D, sheet: AnswerSheet, y: number) {
  ctx.textAlign = "left";
  ctx.fillStyle = NAVY;
  ctx.font = "600 30px Inter, Arial, sans-serif";
  ctx.fillText(sheet.heading, MARGIN, y + 12);

  ctx.fillStyle = MUTED;
  ctx.font = "400 21px Inter, Arial, sans-serif";
  ctx.fillText(sheet.subtitle, MARGIN, y + 54);

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, y + 84);
  ctx.lineTo(RIGHT, y + 84);
  ctx.stroke();
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  row: AnswerRow,
  lines: string[],
  y: number,
) {
  ctx.textAlign = "left";
  ctx.fillStyle = FAINT;
  ctx.font = "600 21px 'SFMono-Regular', Consolas, monospace";
  ctx.fillText(String(row.position).padStart(2, "0"), NUMBER_X, y + 4);

  ctx.fillStyle = NAVY;
  ctx.font = PROMPT_FONT;
  lines.forEach((line, index) => ctx.fillText(line, PROMPT_X, y + index * PROMPT_LINE + 4));

  const answerY = y + lines.length * PROMPT_LINE + 28;
  ctx.font = ANSWER_FONT;

  // The chosen option is trimmed so the correct answer after it keeps its room.
  const givenLimit = row.correct ? PROMPT_WIDTH : PROMPT_WIDTH * 0.54;
  const givenText = fit(ctx, row.given === null ? "Sin responder" : row.given, givenLimit);
  ctx.fillStyle = row.given === null ? FAINT : row.correct ? OK : BAD;
  const givenWidth = ctx.measureText(givenText).width;
  ctx.fillText(givenText, PROMPT_X, answerY);

  if (!row.correct && row.expected) {
    const prefix = " · Correcta: ";
    ctx.fillStyle = MUTED;
    ctx.fillText(prefix, PROMPT_X + givenWidth, answerY);
    const prefixWidth = ctx.measureText(prefix).width;
    ctx.fillStyle = OK;
    ctx.fillText(
      fit(ctx, row.expected, PROMPT_WIDTH - givenWidth - prefixWidth),
      PROMPT_X + givenWidth + prefixWidth,
      answerY,
    );
  }

  /* ---------------- correcta / incorrecta ---------------- */
  const badgeX = RIGHT - BADGE_W;
  const badgeY = y - 22;
  roundedPath(ctx, badgeX, badgeY, BADGE_W, BADGE_H, BADGE_H / 2);
  ctx.fillStyle = row.correct ? OK_BG : BAD_BG;
  ctx.fill();
  ctx.fillStyle = row.correct ? OK : BAD;
  ctx.font = "600 20px Inter, Arial, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText(row.correct ? "Correcta" : "Incorrecta", badgeX + BADGE_W / 2, badgeY + 31);
  ctx.textAlign = "left";

  ctx.strokeStyle = LINE;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(MARGIN, answerY + 34);
  ctx.lineTo(RIGHT, answerY + 34);
  ctx.stroke();
}

function wrapPrompt(ctx: CanvasRenderingContext2D, text: string): string[] {
  ctx.font = PROMPT_FONT;
  const words = (text.trim() || "—").split(/\s+/);
  const lines: string[] = [];
  let line = "";

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(candidate).width > PROMPT_WIDTH) {
      lines.push(line);
      line = word;
      if (lines.length === PROMPT_MAX_LINES) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < PROMPT_MAX_LINES && line) lines.push(line);

  if (lines.length === PROMPT_MAX_LINES) {
    // The prompt was cut: keep the second line inside the column.
    lines[PROMPT_MAX_LINES - 1] = fit(ctx, lines[PROMPT_MAX_LINES - 1], PROMPT_WIDTH - 24);
  }

  return lines.length > 0 ? lines : ["—"];
}

function fit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && ctx.measureText(`${value}…`).width > maxWidth) {
    value = value.slice(0, -1);
  }
  return `${value.trimEnd()}…`;
}

function formatSubmitted(value: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function drawSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  spacing: number,
  font: string,
  color: string,
) {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + spacing;
  }
}

function roundedPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arcTo(x + width, y, x + width, y + r, r);
  ctx.lineTo(x + width, y + height - r);
  ctx.arcTo(x + width, y + height, x + width - r, y + height, r);
  ctx.lineTo(x + r, y + height);
  ctx.arcTo(x, y + height, x, y + height - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
