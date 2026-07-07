import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clearStoredToken,
  getCurrentUserRequest,
  loginRequest,
  logoutRequest,
  persistToken,
  readStoredToken,
  registerRequest,
} from '../services/authService';
import { extractApiErrorMessage } from '../services/error';
import { mapCurrentUser } from '../services/mappers';
import { AuthContext } from './auth-context';
import { getStoredLanguage } from '../services/language';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(readStoredToken());
  const [isLoading, setIsLoading] = useState(true);

  const clearAuth = useCallback(() => {
    clearStoredToken();
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const profile = await getCurrentUserRequest();
    const mappedUser = mapCurrentUser(profile);
    setUser(mappedUser);
    return mappedUser;
  }, []);

  const login = useCallback(async (email, password) => {
    const response = await loginRequest(email, password);
    persistToken(response.access_token);
    setToken(response.access_token);
    return refreshUser();
  }, [refreshUser]);

  const register = useCallback(async (payload) => {
    return registerRequest({
      full_name: payload.name.trim(),
      email: payload.email.trim(),
      password: payload.password,
      role: payload.role,
    });
  }, []);

  const logout = useCallback(async () => {
    try {
      if (readStoredToken()) {
        await logoutRequest();
      }
    } catch {
      // Local cleanup is the source of truth for logout UX.
    } finally {
      clearAuth();
    }
  }, [clearAuth]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      const storedToken = readStoredToken();
      if (!storedToken) {
        if (isMounted) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const profile = await getCurrentUserRequest();
        if (!isMounted) {
          return;
        }
        setToken(storedToken);
        setUser(mapCurrentUser(profile));
      } catch {
        if (isMounted) {
          clearAuth();
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    bootstrap();

    function handleUnauthorized() {
      clearAuth();
    }

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      isMounted = false;
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [clearAuth]);

  const value = useMemo(() => ({
    user,
    token,
    role: user?.role ?? null,
    employeeId: user?.employeeId ?? null,
    isAuthenticated: Boolean(user && token),
    isLoading,
    loading: isLoading,
    login,
    register,
    logout,
    refreshUser,
    clearAuth,
    extractErrorMessage: (error, fallbackMessage, language = getStoredLanguage()) => (
      extractApiErrorMessage(error, fallbackMessage, language)
    ),
  }), [clearAuth, isLoading, login, logout, refreshUser, register, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
