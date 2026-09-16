import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as authService from '../services/authService';

const AuthContext = createContext(null);

/**
 * Holds the logged-in user and the token that proves it. On first load, if
 * a token is already saved from a previous visit, it silently re-fetches
 * the user's profile (getMe) so a page refresh doesn't log anyone out -
 * `loading` covers exactly that one check, so ProtectedRoute knows to wait
 * instead of bouncing a real user to /login before the check finishes.
 */
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    authService
      .getMe()
      .then(setUser)
      .catch(() => localStorage.removeItem('token'))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (credentials) => {
    const data = await authService.login(credentials);
    localStorage.setItem('token', data.token);
    setUser(data);
    return data;
  }, []);

  const register = useCallback(async (details) => {
    const data = await authService.register(details);
    localStorage.setItem('token', data.token);
    setUser(data);
    return data;
  }, []);

  const resetPassword = useCallback(async (token, password) => {
    const data = await authService.resetPassword(token, password);
    localStorage.setItem('token', data.token);
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (updates) => {
    const data = await authService.updateMe(updates);
    setUser((prev) => ({ ...prev, ...data }));
    return data;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside an <AuthProvider>');
  return ctx;
};