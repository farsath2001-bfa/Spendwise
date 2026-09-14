import { useEffect, useState } from 'react';

const applyTheme = (theme) => {
  const isDark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.toggle('dark', isDark);
};

/**
 * Theme is 'light' | 'dark' | 'system', saved under the same 'theme' key
 * the boot script in index.html reads before React even mounts (that
 * script is what stops a flash of the wrong theme on first paint) - so
 * this hook and that script have to agree on what gets stored there.
 */
export function useTheme() {
  const [theme, setThemeState] = useState(() => localStorage.getItem('theme') || 'system');

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // If the user picked "system", keep following the OS setting live.
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => applyTheme('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  const setTheme = (next) => {
    localStorage.setItem('theme', next);
    setThemeState(next);
  };

  return [theme, setTheme];
}