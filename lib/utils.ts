/** The URL if it is http(s), otherwise null. Use before putting any user-supplied link in an href. */
export function safeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
}
