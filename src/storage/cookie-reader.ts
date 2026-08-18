import type { NaverCookies } from './keychain';

// ponytail: NID_AUT/NID_SES are HttpOnly so document.cookie can't see them. Reading the
// WebView's shared cookie store needs a native module. Lazy-require keeps the import safe;
// if the module isn't available (Expo Go / new-arch interop missing) this returns null.
// Upgrade path: a local Expo module if the interop stops working.

interface CookieValue {
  name: string;
  value: string;
}

// The package ships CJS (`module.exports = { get, ... }`) while its d.ts declares a default
// export — so type it against the real runtime shape.
interface CookieManagerLike {
  get(url: string, useWebKit?: boolean): Promise<Record<string, CookieValue>>;
}

let cookieManager: CookieManagerLike | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require for Expo Go safety
  cookieManager = require('@react-native-cookies/cookies') as CookieManagerLike;
} catch {
  cookieManager = null;
}

export async function readNaverCookiesFromWebView(): Promise<NaverCookies | null> {
  if (!cookieManager) return null;
  try {
    const cookies = await cookieManager.get('https://nid.naver.com');
    const aut = cookies['NID_AUT'];
    const ses = cookies['NID_SES'];
    if (aut?.value && ses?.value) return { aut: aut.value, ses: ses.value };
  } catch {
    return null;
  }
  return null;
}
