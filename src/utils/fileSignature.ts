export type SupportedEvidenceMime =
  | 'image/png'
  | 'image/jpeg'
  | 'image/gif'
  | 'image/webp'
  | 'application/pdf'
  | 'text/plain'
  | 'video/mp4'
  | 'video/webm';

export const HEADER_READ_BYTES = 16;
export const TEXT_READ_BYTES = 4096;
export const MIN_BINARY_HEADER_BYTES = 4;
export const FILE_SIGNATURE_MISMATCH_ERROR = "File content doesn't match its type";

export const MIME_EXTENSION_MAP: Record<SupportedEvidenceMime, readonly string[]> = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/gif': ['.gif'],
  'image/webp': ['.webp'],
  'application/pdf': ['.pdf'],
  'text/plain': ['.txt'],
  'video/mp4': ['.mp4'],
  'video/webm': ['.webm'],
};

export interface FileSignatureResult {
  valid: boolean;
  error?: string;
}

export function getFileExtension(fileName: string): string {
  const trimmed = fileName.trim().toLowerCase();
  const lastDot = trimmed.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === trimmed.length - 1) {
    return '';
  }
  return trimmed.slice(lastDot);
}

async function readBoundedSlice(file: File, maxBytes: number): Promise<Uint8Array> {
  const slice = file.slice(0, maxBytes);
  if (typeof slice.arrayBuffer === 'function') {
    const buffer = await slice.arrayBuffer();
    return new Uint8Array(buffer);
  }
  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
      } else {
        reject(new Error('Unable to read file slice.'));
      }
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read file slice.'));
    reader.readAsArrayBuffer(slice);
  });
}

export function matchesBinarySignature(
  bytes: Uint8Array,
  mime: Exclude<SupportedEvidenceMime, 'text/plain'>,
): boolean {
  if (bytes.length < MIN_BINARY_HEADER_BYTES) {
    return false;
  }

  switch (mime) {
    case 'image/png':
      // 89 50 4E 47
      return (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      );

    case 'image/jpeg':
      // FF D8 FF
      return (
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );

    case 'image/gif':
      // 47 49 46 38 ("GIF8")
      return (
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38
      );

    case 'image/webp':
      // RIFF....WEBP
      return (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );

    case 'application/pdf':
      // %PDF-
      return (
        bytes.length >= 5 &&
        bytes[0] === 0x25 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x44 &&
        bytes[3] === 0x46 &&
        bytes[4] === 0x2d
      );

    case 'video/mp4':
      // ....ftyp
      return (
        bytes.length >= 8 &&
        bytes[4] === 0x66 &&
        bytes[5] === 0x74 &&
        bytes[6] === 0x79 &&
        bytes[7] === 0x70
      );

    case 'video/webm':
      // 1A 45 DF A3
      return (
        bytes[0] === 0x1a &&
        bytes[1] === 0x45 &&
        bytes[2] === 0xdf &&
        bytes[3] === 0xa3
      );
  }
}

export function isValidPlainTextBytes(bytes: Uint8Array): boolean {
  if (bytes.length === 0) {
    return false;
  }

  for (let i = 0; i < bytes.length; i += 1) {
    if (bytes[i] === 0x00) {
      return false;
    }
  }

  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decoder.decode(bytes);
    return true;
  } catch {
    return false;
  }
}

export async function validateFileSignature(file: File): Promise<FileSignatureResult> {
  if (!file || file.size <= 0) {
    return { valid: false, error: FILE_SIGNATURE_MISMATCH_ERROR };
  }

  const mime = file.type.toLowerCase() as SupportedEvidenceMime;
  const expectedExtensions = MIME_EXTENSION_MAP[mime];
  if (!expectedExtensions) {
    return { valid: false, error: FILE_SIGNATURE_MISMATCH_ERROR };
  }

  const extension = getFileExtension(file.name);
  if (!expectedExtensions.includes(extension)) {
    return { valid: false, error: FILE_SIGNATURE_MISMATCH_ERROR };
  }

  if (mime === 'text/plain') {
    const textBytes = await readBoundedSlice(file, TEXT_READ_BYTES);
    if (!isValidPlainTextBytes(textBytes)) {
      return { valid: false, error: FILE_SIGNATURE_MISMATCH_ERROR };
    }
    return { valid: true };
  }

  const headerBytes = await readBoundedSlice(file, HEADER_READ_BYTES);
  if (!matchesBinarySignature(headerBytes, mime)) {
    return { valid: false, error: FILE_SIGNATURE_MISMATCH_ERROR };
  }

  return { valid: true };
}
