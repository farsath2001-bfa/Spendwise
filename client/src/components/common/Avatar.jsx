/** Initials-based avatar - no image upload needed, works for any user immediately. */
export default function Avatar({ name, size = 36 }) {
  const initials = (name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-semibold text-white"
    >
      {initials || '?'}
    </div>
  );
}