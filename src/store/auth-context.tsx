import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { getUserStatus } from '@/client/chzzk/rest';
import { clearWebViewCookies, readNaverCookiesFromWebView } from '@/storage/cookie-reader';
import { clearNaverCookies, loadNaverCookies, saveNaverCookies, type NaverCookies } from '@/storage/keychain';

interface AuthState {
  loggedIn: boolean;
  cookie?: string;
  uid?: string;
  login: (cookies: NaverCookies) => Promise<boolean>;
  /** False if the saved session couldn't be removed (still signed in; try again). */
  logout: () => Promise<boolean>;
  /** Naver session cookies the login WebView has received so far (null until signed in there). */
  readWebViewSession: () => Promise<NaverCookies | null>;
  /** The login screen was left without signing in: drop whatever the WebView received. */
  cancelLogin: () => Promise<void>;
}

export type { NaverCookies };

const AuthContext = createContext<AuthState>({
  loggedIn: false,
  login: async () => false,
  logout: async () => false,
  readWebViewSession: async () => null,
  cancelLogin: async () => undefined,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<{ loggedIn: boolean; cookie?: string; uid?: string }>({ loggedIn: false });

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const cookies = await loadNaverCookies();
      if (!cookies) {
        // A login left half-way (app killed before it finished) can leave NID cookies in the
        // plaintext WebView store; with no saved session, nothing should be there.
        await clearWebViewCookies();
        return;
      }
      const cookie = `NID_AUT=${cookies.aut}; NID_SES=${cookies.ses}`;
      try {
        const status = await getUserStatus(cookie);
        if (!cancelled && status.loggedIn) {
          setState({ loggedIn: true, cookie, uid: status.userIdHash });
        }
      } catch {
        // invalid/expired session
      }
    }, 0);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const login = useCallback(async (cookies: NaverCookies): Promise<boolean> => {
    const cookie = `NID_AUT=${cookies.aut}; NID_SES=${cookies.ses}`;
    try {
      const status = await getUserStatus(cookie);
      if (!status.loggedIn) return false;
      await saveNaverCookies(cookies);
      setState({ loggedIn: true, cookie, uid: status.userIdHash });
      return true;
    } catch {
      return false;
    } finally {
      // The WebView store is a plaintext file and also the native WebSocket cookie jar: once the
      // session is in the keychain (or rejected), nothing else may keep a copy.
      await clearWebViewCookies();
    }
  }, []);

  // Clears this phone only; the Naver session itself isn't revoked server-side.
  const logout = useCallback(async (): Promise<boolean> => {
    await clearWebViewCookies();
    try {
      await clearNaverCookies();
    } catch {
      return false;
    }
    setState({ loggedIn: false });
    return true;
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, readWebViewSession: readNaverCookiesFromWebView, cancelLogin: clearWebViewCookies }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
