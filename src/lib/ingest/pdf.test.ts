import { describe, it, expect } from 'vitest';
import { validatePdfBytes } from './pdf';
import { AppError } from '@/lib/errors';

const pdfHeader = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]); // "%PDF-1.4"

describe('validatePdfBytes', () => {
  it('accepts bytes with a %PDF magic header', () => {
    expect(() => validatePdfBytes(pdfHeader, { maxBytes: 1000 })).not.toThrow();
  });

  it('rejects non-PDF bytes by magic number, not extension', () => {
    const notPdf = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // a ZIP header
    try {
      validatePdfBytes(notPdf, { maxBytes: 1000 });
      expect.unreachable('should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('invalid_file');
    }
  });

  it('rejects files over the size limit', () => {
    const big = new Uint8Array(2000);
    big.set(pdfHeader, 0);
    try {
      validatePdfBytes(big, { maxBytes: 1000 });
      expect.unreachable('should have thrown');
    } catch (e) {
      expect((e as AppError).code).toBe('file_too_large');
      expect((e as AppError).status).toBe(413);
    }
  });
});
