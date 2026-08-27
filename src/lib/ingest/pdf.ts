import { extractText } from 'unpdf';
import { AppError } from '@/lib/errors';
import type { PageText } from '@/lib/types';

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46]; // "%PDF"

/**
 * Validate that bytes are a PDF by magic number (not by file extension, per
 * conventions §4) and within the configured size limit.
 */
export function validatePdfBytes(
  bytes: Uint8Array,
  opts: { maxBytes: number },
): void {
  if (bytes.length < 5 || !PDF_MAGIC.every((b, i) => bytes[i] === b)) {
    throw new AppError(
      'invalid_file',
      'That file is not a PDF (missing %PDF header). Only PDF uploads are supported.',
    );
  }
  if (bytes.length > opts.maxBytes) {
    const mb = (opts.maxBytes / (1024 * 1024)).toFixed(0);
    throw new AppError('file_too_large', `File exceeds the ${mb} MB limit.`, 413);
  }
}

export interface ExtractedPdf {
  pageCount: number;
  pages: PageText[];
  /** True when the document looks scanned (very little extractable text). */
  looksScanned: boolean;
}

/**
 * Extract text per page, preserving 1-based page numbers. Flags likely-scanned
 * PDFs (avg < 50 chars/page) so the caller can surface an "OCR not supported"
 * message rather than silently returning empty context.
 */
export async function extractPdf(
  bytes: Uint8Array,
  opts: { maxPages: number },
): Promise<ExtractedPdf> {
  // unpdf may transfer the underlying buffer; hand it a private copy.
  const copy = new Uint8Array(bytes);
  let result: { totalPages: number; text: string[] };
  try {
    result = await extractText(copy, { mergePages: false });
  } catch {
    throw new AppError(
      'parse_failed',
      'Could not read this PDF. It may be corrupted or password-protected.',
      422,
    );
  }

  if (result.totalPages > opts.maxPages) {
    throw new AppError(
      'too_many_pages',
      `PDF has ${result.totalPages} pages; the limit is ${opts.maxPages}.`,
      413,
    );
  }

  const pages: PageText[] = result.text.map((text, i) => ({
    page: i + 1,
    // Normalize whitespace (PDF text extraction is newline-noisy) but keep words.
    text: normalizeWhitespace(text ?? ''),
  }));

  const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0);
  const avgChars = pages.length > 0 ? totalChars / pages.length : 0;
  const looksScanned = pages.length > 0 && avgChars < 50;

  return { pageCount: result.totalPages, pages, looksScanned };
}

function normalizeWhitespace(s: string): string {
  return s.replace(/[ \t\r\n]+/g, ' ').replace(/ {2,}/g, ' ').trim();
}
