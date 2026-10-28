import { describe, expect, it } from "vitest";
import { buildPdfFromJpeg, buildPdfFromJpegs } from "./pdf";

function fakeJpeg(tag: string): Uint8Array {
  return new TextEncoder().encode(`JPEG${tag}`);
}

async function asText(blob: Blob): Promise<string> {
  return new TextDecoder().decode(await blob.arrayBuffer());
}

describe("buildPdfFromJpegs", () => {
  it("declares one page per image", async () => {
    const pdf = await asText(
      buildPdfFromJpegs(
        [
          { jpeg: fakeJpeg("A"), width: 1654, height: 2339 },
          { jpeg: fakeJpeg("B"), width: 1654, height: 2339 },
        ],
        595.28,
        841.89,
      ),
    );

    expect(pdf.startsWith("%PDF-1.4")).toBe(true);
    expect(pdf).toContain("/Type /Pages /Kids [3 0 R 6 0 R] /Count 2");
    expect(pdf).toContain("/MediaBox [0 0 595.28 841.89]");
    expect(pdf).toContain("JPEGA");
    expect(pdf).toContain("JPEGB");
    expect(pdf.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("writes cross-reference offsets that point at the objects", async () => {
    const pdf = await asText(
      buildPdfFromJpegs([
        { jpeg: fakeJpeg("A"), width: 10, height: 10 },
        { jpeg: fakeJpeg("B"), width: 10, height: 10 },
      ]),
    );

    const xrefStart = Number(/startxref\n(\d+)/.exec(pdf)?.[1]);
    expect(pdf.slice(xrefStart, xrefStart + 4)).toBe("xref");

    const offsets = [...pdf.matchAll(/(\d{10}) 00000 n /g)].map((match) => Number(match[1]));
    expect(offsets).toHaveLength(8);
    offsets.forEach((offset, index) => {
      expect(pdf.slice(offset, offset + `${index + 1} 0 obj`.length)).toBe(`${index + 1} 0 obj`);
    });
  });

  it("refuses to build an empty document", () => {
    expect(() => buildPdfFromJpegs([])).toThrow(/al menos una página/);
  });
});

describe("buildPdfFromJpeg", () => {
  it("keeps the single-page helper working", async () => {
    const pdf = await asText(buildPdfFromJpeg(fakeJpeg("ONE"), 20, 20));
    expect(pdf).toContain("/Count 1");
    expect(pdf).toContain("/MediaBox [0 0 841.89 595.28]");
  });
});
