export function validateVaultPreview(_preview: unknown): { ok: boolean; reason?: string } {
  return { ok: true };
}

export function sanitizeActivity<T>(activity: T): T {
  return activity;
}
