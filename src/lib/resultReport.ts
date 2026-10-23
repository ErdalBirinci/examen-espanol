import { certificateGrade } from "./certificate";
import { buildPdfFromJpeg, canvasToJpeg } from "./pdf";
import { resultBreakdown } from "./scoring";
import type { AttemptResult } from "./types";

/** A4 portrait at ~200 dpi; the rendered page is embedded in the PDF as one JPEG. */
const WIDTH = 1654;
const HEIGHT = 2339;
const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;

const MARGIN = 120;
const RIGHT = WIDTH - MARGIN;

const NAVY = "#14253c";
const GOLD = "#b08a4f";
const GOLD_LIGHT = "#e6cda1";
const MUTED = "#626b76";
const FAINT = "#8a8f98";
const LINE = "#e4e8f0";
const TRACK = "#e8edf6";

/** Pass mark shown on the score report; the participation document has no threshold. */
const PASS_MARK = 60;

function formatSubmitted(value: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function scoreLabel(score: number): string {
  return certificateGrade(score);
}

export function resultReportFileName(result: AttemptResult): string {
  const reference = (result.reference || "examen").toLowerCase();
  return `informe-resultados-${result.level.toLowerCase()}-${reference}.pdf`;
}

export async function downloadResultReport(result: AttemptResult): Promise<void> {
  if (result.total_score === null) {
    throw new Error("El informe estará disponible cuando el examen esté evaluado.");
  }

  try {
    await document.fonts.ready;
  } catch {
    // A missing webfont should not block the report.
  }

  const canvas = document.createElement("canvas");
  drawResultReport(canvas, result);
  const jpeg = await canvasToJpeg(canvas, 0.94);
  const blob = buildPdfFromJpeg(jpeg, WIDTH, HEIGHT, PAGE_WIDTH, PAGE_HEIGHT);
  saveBlob(blob, resultReportFileName(result));
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

export function drawResultReport(canvas: HTMLCanvasElement, result: AttemptResult) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El lienzo del informe no está disponible.");

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const total = result.total_score ?? 0;
  const rows = resultBreakdown(result);

  /* ---------------- header ---------------- */
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, WIDTH, 250);

  drawSpaced(ctx, "CENTRO DE EVALUACIÓN DE LENGUA ESPAÑOLA", MARGIN, 94, 7, "600 18px Inter, Arial, sans-serif", GOLD_LIGHT);
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 50px Inter, Arial, sans-serif";
  ctx.fillText("Informe de resultados", MARGIN, 168);
  ctx.fillStyle = "#b9c6d9";
  ctx.font = "400 24px Inter, Arial, sans-serif";
  ctx.fillText(`Examen de Español · Nivel ${result.level}`, MARGIN, 212);

  ctx.textAlign = "right";
  ctx.fillStyle = "#8fa2bd";
  ctx.font = "600 16px Inter, Arial, sans-serif";
  ctx.fillText("REFERENCIA", RIGHT, 120);
  ctx.fillStyle = "#ffffff";
  ctx.font = "600 30px 'SFMono-Regular', Consolas, monospace";
  ctx.fillText(result.reference, RIGHT, 162);

  /* ---------------- candidate ---------------- */
  ctx.textAlign = "left";
  drawSpaced(ctx, "CANDIDATO", MARGIN, 340, 6, "600 17px Inter, Arial, sans-serif", GOLD);
  ctx.fillStyle = NAVY;
  ctx.font = "400 52px 'Instrument Serif', Georgia, serif";
  ctx.fillText(result.full_name.trim() || "Candidato", MARGIN, 404);
  ctx.fillStyle = MUTED;
  ctx.font = "400 21px Inter, Arial, sans-serif";
  ctx.fillText(
    `Enviado el ${formatSubmitted(result.submitted_at)} · Nivel ${result.level} · ${
      result.status === "graded" ? "Evaluado" : "En revisión"
    }`,
    MARGIN,
    452,
  );

  /* ---------------- total ---------------- */
  const cardX = MARGIN;
  const cardY = 500;
  const cardW = RIGHT - MARGIN;
  const cardH = 250;
  roundedPath(ctx, cardX, cardY, cardW, cardH, 24);
  ctx.fillStyle = "#f6f8fc";
  ctx.fill();
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.stroke();

  drawSpaced(ctx, "PUNTUACIÓN GLOBAL", cardX + 56, cardY + 66, 6, "600 17px Inter, Arial, sans-serif", MUTED);

  const totalText = String(Math.round(total));
  ctx.fillStyle = NAVY;
  ctx.font = "600 108px Inter, Arial, sans-serif";
  ctx.textAlign = "left";
  ctx.fillText(totalText, cardX + 54, cardY + 170);
  const totalWidth = ctx.measureText(totalText).width;
  ctx.fillStyle = FAINT;
  ctx.font = "400 32px Inter, Arial, sans-serif";
  ctx.fillText("/ 100", cardX + 54 + totalWidth + 16, cardY + 170);

  const pillLabel = scoreLabel(total);
  ctx.font = "600 24px Inter, Arial, sans-serif";
  const pillTextWidth = ctx.measureText(pillLabel).width;
  const pillW = pillTextWidth + 64;
  const pillH = 62;
  const pillX = cardX + cardW - 56 - pillW;
  const pillY = cardY + 40;
  roundedPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = total >= PASS_MARK ? "#eef8f1" : "#fdf3f3";
  ctx.fill();
  ctx.fillStyle = total >= PASS_MARK ? "#1f7a4c" : "#a33b3b";
  ctx.textAlign = "center";
  ctx.fillText(pillLabel, pillX + pillW / 2, pillY + 41);

  const barX = cardX + 56;
  const barW = cardW - 112;
  const barY = cardY + 196;
  const barH = 16;
  roundedPath(ctx, barX, barY, barW, barH, barH / 2);
  ctx.fillStyle = TRACK;
  ctx.fill();
  const filled = Math.max(0, Math.min(1, total / 100));
  if (filled > 0) {
    roundedPath(ctx, barX, barY, Math.max(barH, barW * filled), barH, barH / 2);
    const gradient = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    gradient.addColorStop(0, "#2f6bff");
    gradient.addColorStop(1, "#8fb3ff");
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  /* ---------------- breakdown ---------------- */
  ctx.textAlign = "left";
  drawSpaced(ctx, "DESGLOSE POR SECCIONES", MARGIN, 848, 6, "600 17px Inter, Arial, sans-serif", GOLD);
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, 872);
  ctx.lineTo(RIGHT, 872);
  ctx.stroke();

  let y = 940;
  for (const row of rows) {
    ctx.textAlign = "left";
    ctx.fillStyle = NAVY;
    ctx.font = "600 28px Inter, Arial, sans-serif";
    ctx.fillText(row.label, MARGIN, y);

    if (row.detail) {
      ctx.fillStyle = MUTED;
      ctx.font = "400 20px Inter, Arial, sans-serif";
      ctx.fillText(row.detail, MARGIN, y + 38);
    }

    ctx.textAlign = "right";
    ctx.fillStyle = NAVY;
    ctx.font = "600 28px Inter, Arial, sans-serif";
    const value = row.score === null ? "—" : String(Math.round(Number(row.score)));
    ctx.fillText(`${value} / ${row.max}`, RIGHT, y);

    const rowBarY = y + 72;
    const rowBarH = 14;
    roundedPath(ctx, MARGIN, rowBarY, RIGHT - MARGIN, rowBarH, rowBarH / 2);
    ctx.fillStyle = TRACK;
    ctx.fill();
    const ratio = row.score === null ? 0 : Math.max(0, Math.min(1, Number(row.score) / row.max));
    if (ratio > 0) {
      roundedPath(
        ctx,
        MARGIN,
        rowBarY,
        Math.max(rowBarH, (RIGHT - MARGIN) * ratio),
        rowBarH,
        rowBarH / 2,
      );
      ctx.fillStyle = "#4a7cf5";
      ctx.fill();
    }

    ctx.strokeStyle = LINE;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(MARGIN, rowBarY + 54);
    ctx.lineTo(RIGHT, rowBarY + 54);
    ctx.stroke();

    y = rowBarY + 54 + 94;
  }

  /* ---------------- notes ---------------- */
  const newScale = result.scoring_version >= 2;
  const notes = [
    newScale
      ? "La puntuación global suma las cuatro secciones: 50 puntos de vocabulario y gramática (1 punto por pregunta), 10 de comprensión auditiva (1 punto por pregunta), 20 de expresión escrita (10 por cada una de las dos tareas) y 20 de expresión oral."
      : "Este examen se evaluó con la escala anterior: cada sección se puntuó sobre 100 y la puntuación global se calculó con los pesos 40 / 20 / 20 / 20.",
    "La constancia de participación puede descargarse desde la consulta de resultados, con un código de verificación público. Documenta la asistencia al examen y no acredita nivel de competencia.",
  ];

  ctx.textAlign = "left";
  drawSpaced(ctx, "CÓMO SE CALCULA", MARGIN, 1840, 6, "600 17px Inter, Arial, sans-serif", GOLD);

  let noteY = 1888;
  for (const note of notes) {
    noteY = wrapText(ctx, note, MARGIN, noteY, RIGHT - MARGIN, 34, "400 21px Inter, Arial, sans-serif", MUTED);
    noteY += 26;
  }

  /* ---------------- footer ---------------- */
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(MARGIN, 2196);
  ctx.lineTo(RIGHT, 2196);
  ctx.stroke();

  ctx.fillStyle = FAINT;
  ctx.font = "400 17px Inter, Arial, sans-serif";
  ctx.fillText(`Documento informativo generado el ${formatSubmitted(new Date().toISOString())}`, MARGIN, 2240);

  ctx.textAlign = "right";
  ctx.font = "400 17px Inter, Arial, sans-serif";
  ctx.fillText(`Referencia ${result.reference} · Todos los derechos reservados`, RIGHT, 2240);
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  font: string,
  color: string,
): number {
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "left";

  let line = "";
  let cursor = y;
  for (const word of text.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      ctx.fillText(line, x, cursor);
      cursor += lineHeight;
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) ctx.fillText(line, x, cursor);
  return cursor + lineHeight;
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
