import * as Keychain from 'react-native-keychain';

const SERVICE = 'chaat.naver-cookie';

export interface NaverCookies {
  aut: string;
  ses: string;
}

export async function saveNaverCookies(cookies: NaverCookies): Promise<void> {
  await Keychain.setGenericPassword('naver', JSON.stringify(cookies), { service: SERVICE });
}

export async function loadNaverCookies(): Promise<NaverCookies | null> {
  const result = await Keychain.getGenericPassword({ service: SERVICE });
  if (!result) return null;
  try {
    const parsed = JSON.parse(result.password);
    if (typeof parsed.aut === 'string' && typeof parsed.ses === 'string') return parsed;
  } catch {
    return null;
  }
  return null;
}

export async function clearNaverCookies(): Promise<void> {
  await Keychain.resetGenericPassword({ service: SERVICE });
}
