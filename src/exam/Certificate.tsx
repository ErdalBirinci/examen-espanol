import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download, ExternalLink, FileText, Share2 } from "lucide-react";
import { Button, Modal, Spinner } from "../components/ui";
import {
  certificateFileName,
  certificateShareText,
  certificateVerificationUrl,
  formatCertificateDate,
} from "../lib/certificate";
import { buildPdfFromJpeg, canvasToJpeg } from "../lib/pdf";
import type { CertificateRecord } from "../lib/types";

const WIDTH = 2400;
const HEIGHT = 1697;

const NAVY = "#14253c";
const GOLD = "#b08a4f";
const GOLD_LIGHT = "#dcc59a";
const MUTED = "#626b76";
const IVORY = "#fbf8f0";

export function CertificatePanel({
  certificate,
  publicView = false,
}: {
  certificate: CertificateRecord;
  publicView?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"pdf" | "png" | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const verificationUrl = certificateVerificationUrl(certificate.code);

  useEffect(() => {
    let active = true;
    setPreview(null);
    setRenderError(null);

    (async () => {
      try {
        await document.fonts.ready;
        const canvas = canvasRef.current;
        if (!canvas || !active) return;
        drawCertificate(canvas, certificate);
        setPreview(canvas.toDataURL("image/png"));
      } catch (error) {
        if (active) {
          setRenderError(
            error instanceof Error ? error.message : "No se pudo preparar la constancia.",
          );
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [certificate]);

  async function downloadPng() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy("png");
    try {
      const blob = await canvasBlob(canvas, "image/png");
      saveBlob(blob, `${certificateFileName(certificate)}.png`);
    } finally {
      setBusy(null);
    }
  }

  async function downloadPdf() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy("pdf");
    try {
      const jpeg = await canvasToJpeg(canvas);
      saveBlob(buildPdfFromJpeg(jpeg, canvas.width, canvas.height), `${certificateFileName(certificate)}.pdf`);
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    const canvas = canvasRef.current;
    const text = certificateShareText(certificate);
    if (!canvas) {
      setShareOpen(true);
      return;
    }

    try {
      const blob = await canvasBlob(canvas, "image/png");
      const file = new File([blob], `${certificateFileName(certificate)}.png`, {
        type: "image/png",
      });
      const data: ShareData = {
        title: `Constancia de participación · nivel ${certificate.level}`,
        text,
        url: verificationUrl,
      };
      if (navigator.canShare?.({ files: [file] })) data.files = [file];
      if (navigator.share) {
        await navigator.share(data);
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
    setShareOpen(true);
  }

  async function copyText() {
    const value = `${certificateShareText(certificate)}\n${verificationUrl}`;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  }

  const socialLinks = [
    {
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
        verificationUrl,
      )}`,
    },
    {
      label: "X",
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        certificateShareText(certificate),
      )}&url=${encodeURIComponent(verificationUrl)}`,
    },
    {
      label: "WhatsApp",
      href: `https://wa.me/?text=${encodeURIComponent(
        `${certificateShareText(certificate)} ${verificationUrl}`,
      )}`,
    },
    {
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(verificationUrl)}`,
    },
  ];

  return (
    <section className="anim-rise card mt-6 overflow-hidden" id="constancia">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line bg-[#fcfcfe] px-6 py-5 sm:px-8">
        <div>
          <p className="text-[11px] font-semibold tracking-[0.1em] text-faint uppercase">
            {publicView ? "Constancia verificada" : "Constancia de participación"}
          </p>
          <h2 className="mt-1 text-[21px] font-semibold tracking-[-0.02em]">
            {publicView ? certificate.full_name : `Enhorabuena, ${certificate.full_name.split(" ")[0]}`}
          </h2>
          <p className="mt-1 max-w-xl text-[12.5px] leading-relaxed text-muted">
            Nivel {certificate.level} · Documento de participación · {formatCertificateDate(certificate.submitted_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => void downloadPdf()}
            loading={busy === "pdf"}
            icon={<FileText className="size-3.5" />}
          >
            Descargar PDF
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void downloadPng()}
            loading={busy === "png"}
            icon={<Download className="size-3.5" />}
          >
            PNG
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void share()}
            icon={<Share2 className="size-3.5" />}
          >
            Compartir
          </Button>
        </div>
      </div>

      <div className="bg-[#f4f0e7] px-3 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-[980px] overflow-hidden rounded-[14px] border border-[#d8c8a8] bg-white shadow-[0_24px_60px_-34px_rgba(20,37,60,0.55)]">
          {preview ? (
            <img
              src={preview}
              alt={`Constancia de participación de nivel ${certificate.level} de ${certificate.full_name}`}
              className="block w-full"
              width={WIDTH}
              height={HEIGHT}
            />
          ) : renderError ? (
            <div className="flex aspect-[1.414/1] items-center justify-center px-8 text-center text-[13px] text-danger">
              {renderError}
            </div>
          ) : (
            <div className="flex aspect-[1.414/1] items-center justify-center text-muted">
              <Spinner className="size-6" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line px-6 py-4 sm:px-8">
        <div className="min-w-0">
          <p className="text-[10.5px] font-semibold tracking-[0.1em] text-faint uppercase">
            Código de verificación
          </p>
          <p className="mt-0.5 truncate font-mono text-[12px] font-semibold tracking-[0.06em]">
            {certificate.code.toUpperCase()}
          </p>
        </div>
        <a
          href={verificationUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent-ink hover:underline"
        >
          Abrir verificación pública
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} className="hidden" aria-hidden />

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Compartir constancia"
        description="Comparte el enlace verificado o la imagen de la constancia."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noreferrer"
                className="focus-ring flex h-11 items-center justify-center rounded-xl border border-line bg-white text-[13px] font-medium transition hover:border-[#cfcfd6] hover:bg-[#fcfcfe]"
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="rounded-xl border border-line bg-[#fcfcfe] p-3">
            <p className="break-all font-mono text-[11.5px] leading-relaxed text-muted">
              {verificationUrl}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void copyText()}
                icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
              >
                {copied ? "Copiado" : "Copiar texto y enlace"}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => void downloadPng()}
                loading={busy === "png"}
                icon={<Download className="size-3.5" />}
              >
                Imagen para adjuntar
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function canvasBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("No se pudo generar el archivo de la constancia."));
    }, type);
  });
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

/* ------------------------------------------------------------------ */
/*  Certificate rendering                                              */
/* ------------------------------------------------------------------ */

function drawCertificate(canvas: HTMLCanvasElement, certificate: CertificateRecord) {
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("El lienzo de la constancia no está disponible.");

  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.fillStyle = IVORY;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const wash = ctx.createRadialGradient(WIDTH / 2, HEIGHT * 0.42, 80, WIDTH / 2, HEIGHT / 2, 1400);
  wash.addColorStop(0, "rgba(255,255,255,0.92)");
  wash.addColorStop(0.58, "rgba(255,252,244,0.34)");
  wash.addColorStop(1, "rgba(224,208,175,0.28)");
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  drawBorder(ctx);
  drawWatermark(ctx);

  drawSpaced(ctx, "CENTRO DE EVALUACIÓN DE LENGUA ESPAÑOLA", 154, 8, "600 23px Inter, Arial, sans-serif", GOLD);
  drawSpaced(ctx, "EXAMEN DE ESPAÑOL", 226, 12, "600 45px Inter, Arial, sans-serif", NAVY);
  line(ctx, 760, 266, 1640, 266, GOLD, 2);

  drawSpaced(
    ctx,
    "CONSTANCIA",
    390,
    17,
    "400 100px 'Instrument Serif', Georgia, serif",
    NAVY,
  );
  drawSpaced(
    ctx,
    "DE PARTICIPACIÓN",
    452,
    9,
    "600 24px Inter, Arial, sans-serif",
    GOLD,
  );

  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = "italic 400 36px 'Instrument Serif', Georgia, serif";
  ctx.fillText("Se hace constar que", WIDTH / 2, 545);

  const name = certificate.full_name.trim() || "Aday";
  const nameSize = fitFont(ctx, name, 1880, 112, 62, "400");
  ctx.fillStyle = NAVY;
  ctx.font = `400 ${nameSize}px 'Instrument Serif', Georgia, serif`;
  ctx.fillText(name, WIDTH / 2, 660);

  line(ctx, 730, 704, 1670, 704, GOLD_LIGHT, 3);
  ctx.fillStyle = GOLD;
  diamond(ctx, 1200, 704, 9);

  ctx.fillStyle = MUTED;
  ctx.font = "400 34px Inter, Arial, sans-serif";
  ctx.fillText("ha participado en el Examen de Español de nivel", WIDTH / 2, 782);

  drawSpaced(ctx, "NIVEL DEL EXAMEN", 850, 6, "600 20px Inter, Arial, sans-serif", GOLD);
  drawSpaced(
    ctx,
    certificate.level,
    958,
    8,
    "400 102px 'Instrument Serif', Georgia, serif",
    NAVY,
  );

  ctx.fillStyle = MUTED;
  ctx.font = "400 30px Inter, Arial, sans-serif";
  ctx.fillText(
    "Documento de participación · No acredita nivel de competencia",
    WIDTH / 2,
    1024,
  );

  line(ctx, 160, 1124, WIDTH - 160, 1124, "rgba(176,138,79,0.45)", 2);

  footerBlock(
    ctx,
    300,
    "FECHA DE EVALUACIÓN",
    formatCertificateDate(certificate.submitted_at),
  );
  footerBlock(ctx, WIDTH / 2, "REFERENCIA", certificate.reference);
  footerBlock(ctx, WIDTH - 300, "CARÁCTER", "Participación");

  drawSeal(ctx, WIDTH / 2, 1450);

  signature(ctx, 480, 1480, "Dirección Académica");
  signature(ctx, WIDTH - 480, 1480, "Coordinación de Evaluación");

  ctx.textAlign = "center";
  ctx.fillStyle = "#8a8f98";
  ctx.font = "400 19px Inter, Arial, sans-serif";
  ctx.fillText(
    `Documento emitido electrónicamente · Código de verificación ${certificate.code.toUpperCase()}`,
    WIDTH / 2,
    1618,
  );
}

function drawBorder(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = NAVY;
  ctx.lineWidth = 9;
  ctx.strokeRect(56, 56, WIDTH - 112, HEIGHT - 112);

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 3;
  ctx.strokeRect(82, 82, WIDTH - 164, HEIGHT - 164);

  ctx.strokeStyle = "rgba(20,37,60,0.22)";
  ctx.lineWidth = 1;
  ctx.strokeRect(96, 96, WIDTH - 192, HEIGHT - 192);

  const corners = [
    [96, 96, 1, 1],
    [WIDTH - 96, 96, -1, 1],
    [96, HEIGHT - 96, 1, -1],
    [WIDTH - 96, HEIGHT - 96, -1, -1],
  ];
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  for (const [x, y, sx, sy] of corners) {
    ctx.beginPath();
    ctx.moveTo(x, y + sy * 68);
    ctx.lineTo(x, y);
    ctx.lineTo(x + sx * 68, y);
    ctx.stroke();
    diamond(ctx, x + sx * 16, y + sy * 16, 5);
  }
}

function drawWatermark(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.globalAlpha = 0.037;
  ctx.fillStyle = NAVY;
  ctx.textAlign = "center";
  ctx.font = "400 920px 'Instrument Serif', Georgia, serif";
  ctx.fillText("E", WIDTH / 2, 1240);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = "rgba(176,138,79,0.12)";
  ctx.lineWidth = 1;
  for (let radius = 560; radius <= 610; radius += 14) {
    ctx.beginPath();
    ctx.arc(WIDTH / 2, 1060, radius, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function footerBlock(
  ctx: CanvasRenderingContext2D,
  x: number,
  label: string,
  value: string,
) {
  ctx.textAlign = "center";
  drawSpacedAt(ctx, label, x, 1210, 4, "600 16px Inter, Arial, sans-serif", GOLD);
  ctx.fillStyle = NAVY;
  ctx.font = "500 26px Inter, Arial, sans-serif";
  ctx.fillText(value, x, 1266);
}

function signature(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  role: string,
) {
  line(ctx, x - 250, y, x + 250, y, "rgba(20,37,60,0.4)", 2);
  ctx.textAlign = "center";
  ctx.fillStyle = MUTED;
  ctx.font = "500 20px Inter, Arial, sans-serif";
  ctx.fillText(role, x, y + 36);
}

function drawSeal(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, 108, 0, Math.PI * 2);
  ctx.fillStyle = GOLD;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(x, y, 95, 0, Math.PI * 2);
  ctx.fillStyle = IVORY;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(x, y, 86, 0, Math.PI * 2);
  ctx.strokeStyle = "rgba(176,138,79,0.55)";
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.textAlign = "center";
  drawSpacedAt(ctx, "EXAMEN", x, y - 48, 4, "600 14px Inter, Arial, sans-serif", GOLD);
  ctx.fillStyle = NAVY;
  ctx.font = "400 66px 'Instrument Serif', Georgia, serif";
  ctx.fillText("E", x, y + 14);
  drawSpacedAt(ctx, "DE ESPAÑOL", x, y + 43, 3, "600 12px Inter, Arial, sans-serif", GOLD);
  ctx.fillStyle = "#8a8f98";
  ctx.font = "500 9px Inter, Arial, sans-serif";
  ctx.fillText("PARTICIPACIÓN", x, y + 63);
  ctx.restore();
}

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}

function diamond(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.lineTo(x + size, y);
  ctx.lineTo(x, y + size);
  ctx.lineTo(x - size, y);
  ctx.closePath();
  ctx.fillStyle = GOLD;
  ctx.fill();
}

function drawSpaced(
  ctx: CanvasRenderingContext2D,
  text: string,
  y: number,
  spacing: number,
  font: string,
  color: string,
) {
  drawSpacedAt(ctx, text, WIDTH / 2, y, spacing, font, color);
}

function drawSpacedAt(
  ctx: CanvasRenderingContext2D,
  text: string,
  centerX: number,
  y: number,
  spacing: number,
  font: string,
  color: string,
) {
  ctx.save();
  ctx.font = font;
  ctx.fillStyle = color;
  ctx.textAlign = "left";
  const characters = [...text];
  const widths = characters.map((character) => ctx.measureText(character).width);
  const total = widths.reduce((sum, width) => sum + width, 0) + spacing * (characters.length - 1);
  let x = centerX - total / 2;
  characters.forEach((character, index) => {
    ctx.fillText(character, x, y);
    x += widths[index] + spacing;
  });
  ctx.restore();
}

function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  start: number,
  min: number,
  weight: string,
) {
  let size = start;
  while (size > min) {
    ctx.font = `${weight} ${size}px 'Instrument Serif', Georgia, serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return min;
}
