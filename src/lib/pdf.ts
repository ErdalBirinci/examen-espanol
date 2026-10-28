/**
 * Tiny PDF writer. The professionally rendered canvases are embedded as one
 * JPEG per page, so no PDF dependency is needed in the browser.
 */

export interface PdfImagePage {
  jpeg: Uint8Array;
  width: number;
  height: number;
}

const A4_LANDSCAPE_WIDTH = 841.89; // points
const A4_LANDSCAPE_HEIGHT = 595.28;

export function buildPdfFromJpegs(
  pages: PdfImagePage[],
  pageWidth = A4_LANDSCAPE_WIDTH,
  pageHeight = A4_LANDSCAPE_HEIGHT,
): Blob {
  if (pages.length === 0) {
    throw new Error("El PDF necesita al menos una página.");
  }

  const chunks: Uint8Array[] = [];
  let length = 0;

  function push(data: string | Uint8Array) {
    const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
    chunks.push(bytes);
    length += bytes.length;
  }

  const offsets: number[] = [];

  function object(id: number, parts: Array<string | Uint8Array>) {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    for (const part of parts) push(part);
    push("\nendobj\n");
  }

  push("%PDF-1.4\n");

  // Object 1 is the catalog, 2 the page tree; every page owns a page, content
  // and image object, so the ids run 3, 4, 5 | 6, 7, 8 | …
  const pageIds = pages.map((_, index) => 3 + index * 3);

  object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  object(2, [
    `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pages.length} >>`,
  ]);

  pages.forEach((page, index) => {
    const pageId = pageIds[index];
    const contentId = pageId + 1;
    const imageId = pageId + 2;

    object(pageId, [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
        `/Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`,
    ]);

    const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
    object(contentId, [
      `<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n`,
      content,
      "endstream",
    ]);

    object(imageId, [
      `<< /Type /XObject /Subtype /Image /Width ${page.width} /Height ${page.height} ` +
        `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${page.jpeg.length} >>\nstream\n`,
      page.jpeg,
      "\nendstream",
    ]);
  });

  const objectCount = 3 + pages.length * 3;
  const xrefOffset = length;
  push(`xref\n0 ${objectCount}\n`);
  push("0000000000 65535 f \n");
  for (let id = 1; id < objectCount; id += 1) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size ${objectCount} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const output = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }

  return new Blob([output], { type: "application/pdf" });
}

/** Single-page helper kept for the participation document. */
export function buildPdfFromJpeg(
  jpeg: Uint8Array,
  width: number,
  height: number,
  pageWidth = A4_LANDSCAPE_WIDTH,
  pageHeight = A4_LANDSCAPE_HEIGHT,
): Blob {
  return buildPdfFromJpegs([{ jpeg, width, height }], pageWidth, pageHeight);
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.94): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new Error("No se pudo generar la imagen del documento."));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/jpeg",
      quality,
    );
  });
}
