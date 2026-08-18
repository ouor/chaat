import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';

import { getUserStatus } from '@/client/chzzk/rest';
import { clearNaverCookies, loadNaverCookies, saveNaverCookies, type NaverCookies } from '@/storage/keychain';

interface AuthState {
  loggedIn: boolean;
  cookie?: string;
  uid?: string;
  login: (cookies: NaverCookies) => Promise<boolean>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  loggedIn: false,
  login: async () => false,
  logout: async () => undefined,
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [state, setState] = useState<{ loggedIn: boolean; cookie?: string; uid?: string }>({ loggedIn: false });

  useEffect(() => {
    let cancelled = false;
    const t = setTimeout(async () => {
      const cookies = await loadNaverCookies();
      if (!cookies) return;
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
      console.log('[login] getUserStatus loggedIn=', status?.loggedIn, 'uid=', status?.userIdHash);
      if (!status.loggedIn) return false;
      await saveNaverCookies(cookies);
      setState({ loggedIn: true, cookie, uid: status.userIdHash });
      return true;
    } catch (e) {
      console.log('[login] getUserStatus error', e);
      return false;
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    await clearNaverCookies();
    setState({ loggedIn: false });
  }, []);

  return <AuthContext.Provider value={{ ...state, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}
