/** Stand-in for a page that hasn't been built yet - keeps the sidebar fully navigable while we build page by page. */
export default function PagePlaceholder({ icon: Icon, title, description }) {
  return (
    <div className="flex h-full min-h-[60vh] flex-col items-center justify-center gap-3 text-center">
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          <Icon size={22} />
        </span>
      )}
      <h2 className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
      <p className="max-w-xs text-sm text-slate-500 dark:text-slate-400">{description}</p>
      <span className="mt-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        Coming in a later step
      </span>
    </div>
  );
}