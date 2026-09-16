/** Consistent white card + heading used for every group of settings. */
export default function SectionCard({ title, description, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
      {description && (
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{description}</p>
      )}
      <div className="mt-4">{children}</div>
    </div>
  );
}