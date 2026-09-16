import { useEffect, useRef, useState } from 'react';

// Minimum time the splash stays on screen, so a fast auth check doesn't
// just flash the logo for a fraction of a second - the counter should
// always be visibly "counting" rather than jumping straight to 100%.
const MIN_DURATION_MS = 1400;

/**
 * Full-screen branded splash shown once while the app boots (checking a
 * saved login token). The percentage is mostly cosmetic - it eases up to
 * 90% on its own timer, then only jumps to 100% once `appLoading` actually
 * turns false, so it never claims to be "done" before the real work is.
 */
export default function PageLoader({ appLoading, onDone }) {
  const [percent, setPercent] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    let raf;
    const tick = () => {
      const elapsed = Date.now() - startRef.current;
      const cosmeticTarget = Math.min(90, (elapsed / MIN_DURATION_MS) * 90);
      setPercent((p) => Math.max(p, cosmeticTarget));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (appLoading) return;
    const elapsed = Date.now() - startRef.current;
    const remaining = Math.max(MIN_DURATION_MS - elapsed, 0);
    const timer = setTimeout(() => {
      setPercent(100);
      const done = setTimeout(onDone, 350);
      return () => clearTimeout(done);
    }, remaining);
    return () => clearTimeout(timer);
  }, [appLoading, onDone]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-slate-50 dark:bg-slate-950">
      <img
        src="/favicon.png"
        alt="SpendWise AI"
        className="h-40 w-40 animate-pulse rounded-2xl shadow-lg shadow-emerald-500/20"
      />
      <div className="flex flex-col items-center gap-2">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">SpendWise AI</span>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500 transition-[width] duration-200 ease-out"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="text-xs font-medium tabular-nums text-slate-400 dark:text-slate-500">
          {Math.round(percent)}%
        </span>
      </div>
    </div>
  );
}