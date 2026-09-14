/**
 * A pulsing placeholder block - the building block every page's loading
 * skeleton is made of. Size and shape come entirely from `className`
 * (e.g. "h-4 w-24 rounded", "h-9 w-9 rounded-lg") so it can stand in for
 * anything from a line of text to an icon circle to a whole chart.
 */
export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-md bg-slate-200 dark:bg-slate-800 ${className}`} />;
}