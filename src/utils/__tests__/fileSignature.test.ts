import { describe, expect, it, vi } from 'vitest';
import {
  FILE_SIGNATURE_MISMATCH_ERROR,
  HEADER_READ_BYTES,
  TEXT_READ_BYTES,
  validateFileSignature,
} from '../fileSignature';

const PNG_BYTES = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
]);
const JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46,
]);
const GIF_BYTES = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
]);
const WEBP_BYTES = new Uint8Array([
  0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
]);
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a,
]);
const MP4_BYTES = new Uint8Array([
  0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d,
]);
const WEBM_BYTES = new Uint8Array([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x86, 0x81, 0x01,
]);
const TEXT_BYTES = new TextEncoder().encode('Milestone evidence summary.\nAll checks pass.');

function buildFile(bytes: Uint8Array, name: string, type: string): File {
  return new File([bytes], name, { type });
}

describe('fileSignature', () => {
  describe('valid files for each supported type', () => {
    const validCases: ReadonlyArray<[string, Uint8Array, string, string]> = [
      ['PNG', PNG_BYTES, 'proof.png', 'image/png'],
      ['JPEG (.jpg)', JPEG_BYTES, 'proof.jpg', 'image/jpeg'],
      ['JPEG (.jpeg)', JPEG_BYTES, 'proof.jpeg', 'image/jpeg'],
      ['GIF', GIF_BYTES, 'proof.gif', 'image/gif'],
      ['WEBP', WEBP_BYTES, 'proof.webp', 'image/webp'],
      ['PDF', PDF_BYTES, 'proof.pdf', 'application/pdf'],
      ['MP4', MP4_BYTES, 'proof.mp4', 'video/mp4'],
      ['WEBM', WEBM_BYTES, 'proof.webm', 'video/webm'],
      ['UTF-8 text/plain', TEXT_BYTES, 'proof.txt', 'text/plain'],
    ];

    it.each(validCases)('accepts valid %s file', async (_label, bytes, name, type) => {
      const file = buildFile(bytes, name, type);
      const result = await validateFileSignature(file);
      expect(result).toEqual({ valid: true });
    });
  });

  describe('signature, MIME, and extension mismatches', () => {
    it('rejects PNG bytes renamed to .pdf with application/pdf MIME', async () => {
      const file = buildFile(PNG_BYTES, 'proof.pdf', 'application/pdf');
      const result = await validateFileSignature(file);
      expect(result).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
    });

    it('rejects HTML payload renamed to .pdf', async () => {
      const htmlBytes = new TextEncoder().encode('<!DOCTYPE html><script>alert(1)</script>');
      const file = buildFile(htmlBytes, 'proof.pdf', 'application/pdf');
      const result = await validateFileSignature(file);
      expect(result).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
    });

    it('rejects valid PDF bytes when extension does not match MIME', async () => {
      const file = buildFile(PDF_BYTES, 'proof.png', 'application/pdf');
      const result = await validateFileSignature(file);
      expect(result).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
    });

    it('rejects RIFF header that is not WEBP (e.g. WAV)', async () => {
      const wavBytes = new Uint8Array([
        0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
      ]);
      const file = buildFile(wavBytes, 'audio.webp', 'image/webp');
      const result = await validateFileSignature(file);
      expect(result).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
    });
  });

  describe('truncated, empty, and invalid text files', () => {
    it('rejects an empty file (0 bytes)', async () => {
      const emptyFile = buildFile(new Uint8Array([]), 'empty.pdf', 'application/pdf');
      const result = await validateFileSignature(emptyFile);
      expect(result).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
    });

    it('rejects an empty text file (0 bytes)', async () => {
      const emptyTxt = buildFile(new Uint8Array([]), 'empty.txt', 'text/plain');
      const result = await validateFileSignature(emptyTxt);
      expect(result).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
    });

    it('rejects truncated binary files (< 4 bytes)', async () => {
      const truncatedPng = buildFile(new Uint8Array([0x89, 0x50, 0x4e]), 'short.png', 'image/png');
      const truncatedJpeg = buildFile(new Uint8Array([0xff, 0xd8, 0xff]), 'short.jpg', 'image/jpeg');
      const truncatedPdf = buildFile(new Uint8Array([0x25, 0x50]), 'short.pdf', 'application/pdf');

      expect(await validateFileSignature(truncatedPng)).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
      expect(await validateFileSignature(truncatedJpeg)).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
      expect(await validateFileSignature(truncatedPdf)).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
    });

    it('rejects text/plain files containing NUL bytes in the first 4 KB', async () => {
      const nulText = new Uint8Array([0x68, 0x65, 0x6c, 0x6c, 0x6f, 0x00, 0x77, 0x6f, 0x72, 0x6c, 0x64]);
      const file = buildFile(nulText, 'notes.txt', 'text/plain');
      const result = await validateFileSignature(file);
      expect(result).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
    });

    it('rejects text/plain files with invalid UTF-8 sequences', async () => {
      const badUtf8 = new Uint8Array([0xff, 0xfe, 0xfd]);
      const file = buildFile(badUtf8, 'notes.txt', 'text/plain');
      const result = await validateFileSignature(file);
      expect(result).toEqual({
        valid: false,
        error: FILE_SIGNATURE_MISMATCH_ERROR,
      });
    });
  });

  describe('bounded byte reading', () => {
    it('slices at most 16 bytes for binary files and 4096 bytes for text files', async () => {
      const pdfFile = buildFile(PDF_BYTES, 'proof.pdf', 'application/pdf');
      const pdfSliceSpy = vi.spyOn(pdfFile, 'slice');
      await validateFileSignature(pdfFile);
      expect(pdfSliceSpy).toHaveBeenCalledWith(0, HEADER_READ_BYTES);

      const txtFile = buildFile(TEXT_BYTES, 'notes.txt', 'text/plain');
      const txtSliceSpy = vi.spyOn(txtFile, 'slice');
      await validateFileSignature(txtFile);
      expect(txtSliceSpy).toHaveBeenCalledWith(0, TEXT_READ_BYTES);
    });
  });
});
