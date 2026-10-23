/**
 * Tiny single-page PDF writer for the certificate. The professionally rendered
 * canvas is embedded as one JPEG, so no PDF dependency is needed in the browser.
 */
export function buildPdfFromJpeg(
  jpeg: Uint8Array,
  width: number,
  height: number,
  pageWidth = 841.89, // A4 landscape, points
  pageHeight = 595.28,
): Blob {

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

  object(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
  object(2, ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  object(3, [
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      "/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>",
  ]);

  const content = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ\n`;
  object(4, [`<< /Length ${new TextEncoder().encode(content).length} >>\nstream\n`, content, "endstream"]);

  object(5, [
    `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} ` +
      `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`,
    jpeg,
    "\nendstream",
  ]);

  const xrefOffset = length;
  push("xref\n0 6\n");
  push("0000000000 65535 f \n");
  for (let id = 1; id <= 5; id += 1) {
    push(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  }
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`);

  const output = new Uint8Array(length);
  let position = 0;
  for (const chunk of chunks) {
    output.set(chunk, position);
    position += chunk.length;
  }

  return new Blob([output], { type: "application/pdf" });
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
