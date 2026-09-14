import { useState, useEffect } from 'react';

/** Generic "state that persists to localStorage" hook - same value shape as useState. */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const item = localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private browsing / storage disabled - the app still works, it just
      // won't remember this preference across visits.
    }
  }, [key, value]);

  return [value, setValue];
}