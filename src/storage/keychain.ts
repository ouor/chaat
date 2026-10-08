const SERVICE = 'chaat.naver-cookie';

// ponytail: Expo Go lacks react-native-keychain's native module. Lazy-require keeps the
// import from throwing; in-memory fallback is debug-only. Real devices always use keychain.
type KeychainModule = typeof import('react-native-keychain');

let keychain: KeychainModule | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- lazy require so Expo Go without the keychain native module doesn't crash at import
  keychain = require('react-native-keychain');
} catch {
  keychain = null;
}

const mem = new Map<string, string>();

export interface NaverCookies {
  aut: string;
  ses: string;
}

export async function saveNaverCookies(cookies: NaverCookies): Promise<void> {
  const raw = JSON.stringify(cookies);
  if (keychain) {
    try {
      await keychain.setGenericPassword('naver', raw, { service: SERVICE });
      return;
    } catch {
      // fall through to memory
    }
  }
  mem.set(SERVICE, raw);
}

export async function loadNaverCookies(): Promise<NaverCookies | null> {
  let raw: string | null = null;
  if (keychain) {
    try {
      const result = await keychain.getGenericPassword({ service: SERVICE });
      raw = result ? result.password : null;
    } catch {
      // fall through to memory
    }
  }
  raw ??= mem.get(SERVICE) ?? null;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.aut === 'string' && typeof parsed.ses === 'string') return parsed;
  } catch {
    return null;
  }
  return null;
}

/** Throws if the keychain entry couldn't be removed: the session would come back next launch. */
export async function clearNaverCookies(): Promise<void> {
  mem.delete(SERVICE);
  if (keychain) await keychain.resetGenericPassword({ service: SERVICE });
}
