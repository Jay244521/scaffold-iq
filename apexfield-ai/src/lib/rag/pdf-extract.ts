/**
 * pdfjs-dist adapter: PDF bytes → positioned text items per page.
 * Node-only (used by the ingestion CLI); keeps pdfjs out of the Next.js bundles.
 */
import type { PageText, TextItem } from "./layout";

export type ExtractedPdf = { pageCount: number; title: string | null; pages: PageText[]; rotatedItemsSkipped: number };

type PdfjsTextItem = { str: string; transform: number[]; width: number; height: number };

export async function extractPdf(data: Uint8Array): Promise<ExtractedPdf> {
  // Legacy build runs in plain Node without DOM globals or a worker file.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const task = pdfjs.getDocument({ data, useSystemFonts: false, disableFontFace: true, verbosity: 0 });
  const doc = await task.promise;

  try {
    let title: string | null = null;
    try {
      const meta = await doc.getMetadata();
      const t = (meta.info as { Title?: unknown } | undefined)?.Title;
      if (typeof t === "string" && t.trim()) title = t.trim();
    } catch {
      /* no metadata */
    }

    const pages: PageText[] = [];
    let rotatedItemsSkipped = 0;
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const viewport = page.getViewport({ scale: 1 });
      const content = await page.getTextContent();
      const items: TextItem[] = [];
      for (const raw of content.items) {
        if (!("str" in raw)) continue;
        const it = raw as PdfjsTextItem;
        if (!it.str) continue;
        const [a, b, c, d, e, f] = it.transform;
        // Rotated labels (wiring diagram callouts, vertical axis titles) would scramble line grouping.
        if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01) {
          rotatedItemsSkipped++;
          continue;
        }
        const fontSize = Math.abs(d) || Math.abs(a) || it.height;
        // pdfjs coordinates are bottom-up in user space; flip to top-down for reading order.
        items.push({ str: it.str, x: e - viewport.viewBox[0], y: viewport.viewBox[3] - f, width: it.width, fontSize });
      }
      pages.push({ page: n, width: viewport.width, height: viewport.height, items });
      page.cleanup();
    }
    return { pageCount: doc.numPages, title, pages, rotatedItemsSkipped };
  } finally {
    await task.destroy();
  }
}
