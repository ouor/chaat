// Trust checks for the login WebView's navigation. Hand-parsed on purpose: RN's URL polyfill
// finds the host with a regex that a '@' later in the path or query throws off.

// Authority as a browser splits it: up to the first / ? # or \ (WebView treats \ as /).
const HTTP_AUTHORITY = /^https?:\/\/([^/?#\\]*)/i;
const HTTPS_AUTHORITY = /^https:\/\/([^/?#\\]*)/i;

function authorityOf(url: string, re: RegExp): string | null {
  return re.exec(url)?.[1] ?? null;
}

/** Host shown to the user: what the browser connects to (after any userinfo, without port). */
export function urlHost(url: string): string {
  const authority = authorityOf(url, HTTP_AUTHORITY);
  if (authority === null) return '';
  return authority
    .slice(authority.lastIndexOf('@') + 1)
    .replace(/:\d*$/, '')
    .toLowerCase();
}

/**
 * Top-level login pages must be https on naver.com or a subdomain. Any userinfo is refused:
 * `https://nid.naver.com:x@evil.example/` really goes to evil.example.
 */
export function isNaverUrl(url: string): boolean {
  const authority = authorityOf(url, HTTPS_AUTHORITY);
  if (authority === null || authority.includes('@')) return false;
  return /^([a-z0-9-]+\.)*naver\.com(:\d+)?$/i.test(authority);
}
