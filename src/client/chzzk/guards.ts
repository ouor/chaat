// Type guards shared by the REST and WebSocket parsers: both read untrusted server JSON.

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

/** A JSON object given either as an object or as JSON text (extras/profile come both ways); {} otherwise. */
export function parseObject(v: unknown): Record<string, unknown> {
  if (typeof v === 'string') {
    try {
      const p = JSON.parse(v);
      return isRecord(p) ? p : {};
    } catch {
      return {};
    }
  }
  return isRecord(v) ? v : {};
}

// Every CHZZK image (emoji packs, profile/channel images, subscription emojis) is served from
// Naver's pstatic.net CDN (checked against live responses). Sender-controlled URLs (extras.emojis)
// must not make every viewer fetch an arbitrary host, so anything else is dropped.
const TRUSTED_IMAGE = /^https:\/\/([a-z0-9-]+\.)*pstatic\.net\//i;

/** True for https URLs on the CHZZK/Naver image CDN. */
export function isTrustedImageUrl(url: unknown): url is string {
  return typeof url === 'string' && TRUSTED_IMAGE.test(url);
}
