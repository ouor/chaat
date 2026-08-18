import type { NaverCookies } from './keychain';

// ponytail: NID_AUT/NID_SES are HttpOnly so document.cookie can't see them. Reading the
// WebView's shared cookie store needs a native module (not in Expo Go). Lazy-require keeps
// the import safe; Expo Go falls back to manual entry. Upgrade path: none, module is the ceiling.
type CookieManagerModule = typeof import('@react-native-cookies/cookies');

let cookieManager: CookieManagerModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require for Expo Go safety
  cookieManager = require('@react-native-cookies/cookies');
} catch {
  cookieManager = null;
}

export async function readNaverCookiesFromWebView(): Promise<NaverCookies | null> {
  if (!cookieManager) return null;
  try {
    const cookies = await cookieManager.default.get('https://nid.naver.com');
    const aut = cookies['NID_AUT'];
    const ses = cookies['NID_SES'];
    if (aut?.value && ses?.value) return { aut: aut.value, ses: ses.value };
  } catch {
    return null;
  }
  return null;
}
