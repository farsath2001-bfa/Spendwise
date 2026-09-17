import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Bell, AlertTriangle, TrendingUp, PartyPopper, Target } from 'lucide-react';
import { getBudgets } from '../../services/budgetService';
import { getGoals } from '../../services/goalService';
import { useLocalStorage } from '../../hooks/useLocalStorage';

const NEAR_LIMIT_THRESHOLD = 90; // percentUsed at/above this (but not yet over) counts as a warning
const GOAL_HALFWAY_THRESHOLD = 50;

/**
 * Turns the budgets and goals the user already has into a flat list of
 * "worth mentioning" alerts. Nothing here is stored server-side as a
 * notification - it's recomputed from the real, current budget/goal state
 * every time, so an alert simply stops existing on its own once it's no
 * longer true (spending drops back under the limit, a goal is edited,
 * etc.) instead of needing to be manually cleared.
 */
function buildAlerts(budgets, goals) {
  const alerts = [];

  budgets.forEach((b) => {
    if (b.overBudget) {
      alerts.push({
        id: `budget-over-${b._id}`,
        tone: 'danger',
        icon: AlertTriangle,
        to: '/budget',
        message: `${b.category} is over budget`,
        detail: `${b.percentUsed}% of this month's limit used`,
      });
    } else if (b.percentUsed >= NEAR_LIMIT_THRESHOLD) {
      alerts.push({
        id: `budget-near-${b._id}`,
        tone: 'warning',
        icon: TrendingUp,
        to: '/budget',
        message: `${b.category} is close to its limit`,
        detail: `${b.percentUsed}% of this month's limit used`,
      });
    }
  });

  goals.forEach((g) => {
    if (g.reached) {
      alerts.push({
        id: `goal-reached-${g._id}`,
        tone: 'success',
        icon: PartyPopper,
        to: '/goals',
        message: `"${g.name}" goal reached!`,
        detail: 'Time to set a new target, or celebrate a bit first.',
      });
    } else if (g.percent >= GOAL_HALFWAY_THRESHOLD) {
      alerts.push({
        id: `goal-halfway-${g._id}`,
        tone: 'info',
        icon: Target,
        to: '/goals',
        message: `"${g.name}" is ${g.percent}% of the way there`,
        detail: 'Over halfway to the target.',
      });
    }
  });

  return alerts;
}

const TONE_CLASSES = {
  danger: 'bg-red-50 text-red-600 dark:bg-red-950/40 dark:text-red-400',
  warning: 'bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400',
  success: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400',
  info: 'bg-sky-50 text-sky-600 dark:bg-sky-950/40 dark:text-sky-400',
};

export default function NotificationsBell() {
  const [open, setOpen] = useState(false);
  const [budgets, setBudgets] = useState([]);
  const [goals, setGoals] = useState([]);
  const [seenIds, setSeenIds] = useLocalStorage('seenAlertIds', []);
  const containerRef = useRef(null);

  const refresh = useCallback(() => {
    getBudgets()
      .then(setBudgets)
      .catch(() => {});
    getGoals()
      .then(setGoals)
      .catch(() => {});
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Close on an outside click or Escape - same expectation as any other
  // dropdown/menu in the app.
  useEffect(() => {
    if (!open) return undefined;
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    const handleKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  const alerts = useMemo(() => buildAlerts(budgets, goals), [budgets, goals]);
  const unreadCount = alerts.filter((a) => !seenIds.includes(a.id)).length;

  const handleToggle = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      refresh(); // grab anything that's changed since the last time it was opened
      setSeenIds((prev) => Array.from(new Set([...prev, ...alerts.map((a) => a.id)])));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
      >
        <Bell size={19} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Notifications</p>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {alerts.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                You're all caught up.
              </p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {alerts.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={a.to}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    >
                      <span className={`mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${TONE_CLASSES[a.tone]}`}>
                        <a.icon size={14} />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-slate-900 dark:text-white">{a.message}</span>
                        <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}