import React, { createContext, useCallback, useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import api, { ensureCsrf, setCsrfToken, clearCsrfToken } from '../services/api';
import { useFlash } from './FlashContext.jsx';
import { profileUpdated, sessionCleared, sessionReady, statusReady } from '../store/authSlice';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const dispatch = useDispatch();
  const auth = useSelector((state) => state.auth);
  const flash = useFlash();

  const refresh = useCallback(async () => {
    const [{ data: me }, meta] = await Promise.all([
      api.get('/auth/me'),
      api.get('/meta').catch(() => ({ data: {} })),
    ]);
    dispatch(sessionReady({ user: me.user, profile: me.profile || null, features: meta.data?.features || {} }));
    if (meta.data?.flashAutoDismissMs) window.__FLASH_MS = meta.data.flashAutoDismissMs;
  }, [dispatch]);

  useEffect(() => {
    // Fire CSRF, /auth/me and /meta all at once so startup only needs ONE round trip.
    // ensureCsrf() starts the CSRF fetch and caches it; the me/meta calls fire in
    // parallel without waiting for CSRF (they are GET requests, no token needed).
    const csrfProm  = ensureCsrf().catch(() => null);
    const meProm    = api.get('/auth/me').catch(() => ({ data: { user: null, profile: null } }));
    const metaProm  = api.get('/meta').catch(() => ({ data: {} }));

    Promise.all([csrfProm, meProm, metaProm])
      .then(([token, me, meta]) => {
        if (token) setCsrfToken(token);
        dispatch(sessionReady({
          user: me.data?.user || null,
          profile: me.data?.profile || null,
          features: meta.data?.features || {},
        }));
        if (meta.data?.flashAutoDismissMs) window.__FLASH_MS = meta.data.flashAutoDismissMs;
      })
      .catch(() => dispatch(sessionCleared()))
      .finally(() => dispatch(statusReady()));
  }, [dispatch]);

  const login = async (payload) => {
    const { data } = await api.post('/auth/login', payload);
    if (data.csrfToken) setCsrfToken(data.csrfToken);
    flash.push(data.flash);
    await refresh();
    return data.user;
  };

  const logout = async () => {
    try {
      const { data } = await api.post('/auth/logout');
      flash.push(data?.flash);
    } catch {
      /* ignore */
    } finally {
      clearCsrfToken();
      dispatch(sessionCleared());
    }
  };

  const value = useMemo(
    () => ({
      user: auth.user,
      profile: auth.profile,
      features: auth.features,
      loading: auth.status === 'loading',
      refresh,
      login,
      logout,
      setProfile: (profile) => dispatch(profileUpdated({ profile })),
    }),
    [auth.user, auth.profile, auth.features, auth.status, refresh, dispatch]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
