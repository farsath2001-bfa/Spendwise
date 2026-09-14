import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Receipt,
  PiggyBank,
  ArrowRight,
  BarChart3,
  Sparkles,
  Plus,
  X,
  AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { getAnalyticsSummary } from '../services/analyticsService';
import { getTransactions, createTransaction } from '../services/transactionService';
import { getBudgets } from '../services/budgetService';
import { getGoals } from '../services/goalService';
import { getQuickInsight } from '../services/aiService';
import {
  CATEGORY_MAP,
  CURRENCIES,
  DEFAULT_CURRENCY,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
} from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Spinner } from '../components/common/Spinner';
import { Skeleton } from '../components/common/Skeleton';
import Avatar from '../components/common/Avatar';

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** Swaps in a time-appropriate greeting and emoji instead of a flat "Welcome" every time of day. */
function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', emoji: '☀️' };
  if (hour < 18) return { text: 'Good afternoon', emoji: '👋' };
  return { text: 'Good evening', emoji: '🌙' };
}

/** Tracks the live resolved light/dark state (not just the user's 'system' choice) so chart colors can follow it. */
function useIsDarkMode() {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}

function StatCard({ icon: Icon, label, value, tone }) {
  const toneClasses = {
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="truncate text-lg font-bold text-slate-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-9 flex-shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}

/** Mirrors one real "Recent Transactions" row. */
function ListRowSkeleton() {
  return (
    <li className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
      <Skeleton className="h-8 w-8 flex-shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-1/4" />
      </div>
      <Skeleton className="h-4 w-14 flex-shrink-0" />
    </li>
  );
}

/** Mirrors one real Budget/Goals progress row. */
function ProgressRowSkeleton() {
  return (
    <li>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-8" />
      </div>
      <Skeleton className="mt-1.5 h-1.5 w-full rounded-full" />
    </li>
  );
}

function CardShell({ title, viewAllTo, children }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
        {viewAllTo && (
          <Link
            to={viewAllTo}
            className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            View all
            <ArrowRight size={12} />
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [currencyCode] = useLocalStorage('currency', DEFAULT_CURRENCY);
  const currencySymbol = CURRENCIES.find((c) => c.code === currencyCode)?.symbol || currencyCode;
  const fmt = (n) => `${currencySymbol} ${Number(n).toFixed(2)}`;
  const isDark = useIsDarkMode();

  // Chart chrome - the only pieces recharts needs as real color values
  // rather than Tailwind classes, so they're kept in sync with the live theme.
  const gridColor = isDark ? '#1e293b' : '#e2e8f0';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipStyle = {
    backgroundColor: isDark ? '#0f172a' : '#ffffff',
    border: `1px solid ${isDark ? '#1e293b' : '#e2e8f0'}`,
    borderRadius: 8,
    fontSize: 12,
    color: isDark ? '#f1f5f9' : '#0f172a',
  };

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [budgetAlerts, setBudgetAlerts] = useState([]);
  const [goals, setGoals] = useState([]);
  const [insight, setInsight] = useState('');

  // Pulled out so quick-add can re-run it after saving, not just on mount.
  const loadDashboard = useCallback(async () => {
    try {
      const [summaryData, txData, budgetData, goalData] = await Promise.all([
        getAnalyticsSummary(),
        getTransactions({ limit: 5 }),
        getBudgets(),
        getGoals(),
      ]);
      setSummary(summaryData);
      setRecentTransactions(txData.transactions);
      setBudgets(budgetData.slice(0, 3));
      setGoals(goalData.slice(0, 2));

      // Checked against every budget, not just the 3 shown below - so a
      // category that's over its limit still surfaces here even if it
      // wouldn't otherwise make the "top 3" cut in Budget Overview.
      setBudgetAlerts(
        budgetData
          .filter((b) => b.percentUsed >= 80)
          .sort((a, b) => b.percentUsed - a.percentUsed)
      );
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load your dashboard.');
    }

    // Fetched separately (and failures ignored) so a hiccup on the AI
    // insight never blanks out the rest of an otherwise-working dashboard.
    getQuickInsight()
      .then(setInsight)
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await loadDashboard();
      setLoading(false);
    })();
  }, [loadDashboard]);

  // --- Quick add ---
  const QUICK_ADD_EMPTY_FORM = { amount: '', category: '', note: '' };
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [quickAddType, setQuickAddType] = useState('expense');
  const [quickAddForm, setQuickAddForm] = useState(QUICK_ADD_EMPTY_FORM);
  const [quickAddSaving, setQuickAddSaving] = useState(false);
  const [quickAddError, setQuickAddError] = useState('');

  const openQuickAdd = (type) => {
    setQuickAddType(type);
    setQuickAddForm(QUICK_ADD_EMPTY_FORM);
    setQuickAddError('');
    setQuickAddOpen(true);
  };

  const handleQuickAddTypeChange = (type) => {
    setQuickAddType(type);
    setQuickAddForm((f) => ({ ...f, category: '' }));
  };

  const handleQuickAddSubmit = async (e) => {
    e.preventDefault();
    if (!quickAddForm.category) {
      setQuickAddError('Pick a category.');
      return;
    }
    if (!quickAddForm.amount || Number(quickAddForm.amount) <= 0) {
      setQuickAddError('Enter an amount greater than 0.');
      return;
    }
    setQuickAddSaving(true);
    setQuickAddError('');
    try {
      await createTransaction({
        type: quickAddType,
        amount: quickAddForm.amount,
        category: quickAddForm.category,
        note: quickAddForm.note,
      });
      toast.success(`${quickAddType === 'income' ? 'Income' : 'Expense'} added.`);
      setQuickAddOpen(false);
      loadDashboard();
    } catch (err) {
      setQuickAddError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setQuickAddSaving(false);
    }
  };

  const quickAddCategoryOptions = quickAddType === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const greeting = getGreeting();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={user?.name} size={44} />
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {greeting.text},{' '}
              <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
                {user?.name || 'there'}
              </span>{' '}
              {greeting.emoji}
            </h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Here's where things stand this month.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => openQuickAdd('income')}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/70"
          >
            <Plus size={14} />
            Income
          </button>
          <button
            type="button"
            onClick={() => openQuickAdd('expense')}
            className="flex items-center gap-1.5 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70"
          >
            <Plus size={14} />
            Expense
          </button>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCardSkeleton />
          <StatCardSkeleton />
          <StatCardSkeleton />
        </div>
      ) : (
        summary && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <StatCard icon={TrendingUp} label="Income this month" value={fmt(summary.currentMonth.totalIncome)} tone="emerald" />
            <StatCard icon={TrendingDown} label="Expenses this month" value={fmt(summary.currentMonth.totalExpense)} tone="red" />
            <StatCard icon={Wallet} label="Net this month" value={fmt(summary.currentMonth.net)} tone="slate" />
          </div>
        )
      )}

      {budgetAlerts.length > 0 && (
        <div className="space-y-2">
          {budgetAlerts.slice(0, 3).map((b) => (
            <div
              key={b._id}
              className={`flex items-center gap-3 rounded-xl border p-4 ${
                b.overBudget
                  ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30'
                  : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
              }`}
            >
              <span
                className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${
                  b.overBudget
                    ? 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400'
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400'
                }`}
              >
                <AlertTriangle size={16} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-semibold ${
                    b.overBudget ? 'text-red-700 dark:text-red-400' : 'text-amber-700 dark:text-amber-400'
                  }`}
                >
                  {b.overBudget ? `Over budget on ${b.category}` : `Nearing your ${b.category} budget`}
                </p>
                <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">
                  {b.overBudget
                    ? `${fmt(b.spent - b.monthlyLimit)} over your ${fmt(b.monthlyLimit)} limit.`
                    : `${b.percentUsed}% used - ${fmt(b.remaining)} left this month.`}
                </p>
              </div>
              <Link
                to="/budget"
                className={`flex flex-shrink-0 items-center gap-1 text-xs font-medium ${
                  b.overBudget
                    ? 'text-red-600 hover:text-red-700 dark:text-red-400'
                    : 'text-amber-700 hover:text-amber-800 dark:text-amber-400'
                }`}
              >
                View
                <ArrowRight size={12} />
              </Link>
            </div>
          ))}
          {budgetAlerts.length > 3 && (
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              +{budgetAlerts.length - 3} more -{' '}
              <Link to="/budget" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
                view all budgets
              </Link>
            </p>
          )}
        </div>
      )}

      {loading ? (
        <CardShell title="Spending Trend">
          <Skeleton className="h-[180px] w-full" />
        </CardShell>
      ) : (
        summary && (
        <CardShell title="Spending Trend" viewAllTo="/analytics">
          {summary.monthlyTrend.every((m) => m.income === 0 && m.expense === 0) ? (
            <EmptyRow icon={BarChart3} message="Add some transactions to see your trend over time." />
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={summary.monthlyTrend} barCategoryGap={20}>
                <CartesianGrid strokeDasharray="3 3" stroke={gridColor} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: tickColor, fontSize: 11 }}
                  axisLine={{ stroke: gridColor }}
                  tickLine={false}
                />
                <YAxis tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value) => fmt(value)}
                  cursor={{ fill: isDark ? 'rgba(148,163,184,0.08)' : 'rgba(100,116,139,0.06)' }}
                />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={24} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardShell>
        )
      )}

      {insight && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/30">
          <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
            <Sparkles size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">AI Insight</p>
            <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">{insight}</p>
          </div>
          <Link
            to="/ai-assistant"
            className="flex flex-shrink-0 items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
          >
            Ask more
            <ArrowRight size={12} />
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardShell title="Recent Transactions" viewAllTo="/transactions">
            {loading ? (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {Array.from({ length: 5 }).map((_, i) => (
                  <ListRowSkeleton key={i} />
                ))}
              </ul>
            ) : recentTransactions.length === 0 ? (
              <EmptyRow icon={Receipt} message="No transactions yet - add your first one to get started." />
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {recentTransactions.map((t) => {
                  const meta = CATEGORY_MAP[t.category] || { icon: Receipt, color: '#6b7280' };
                  const Icon = meta.icon;
                  return (
                    <li key={t._id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                      <span
                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                      >
                        <Icon size={14} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{t.category}</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500">{formatDate(t.date)}</p>
                      </div>
                      <span
                        className={`flex-shrink-0 text-sm font-semibold ${
                          t.type === 'income'
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-red-600 dark:text-red-400'
                        }`}
                      >
                        {t.type === 'income' ? '+' : '-'}
                        {fmt(t.amount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardShell>
        </div>

        <div className="space-y-4">
          <CardShell title="Budget Overview" viewAllTo="/budget">
            {loading ? (
              <ul className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <ProgressRowSkeleton key={i} />
                ))}
              </ul>
            ) : budgets.length === 0 ? (
              <EmptyRow icon={Wallet} message="No budgets set yet." />
            ) : (
              <ul className="space-y-3">
                {budgets.map((b) => (
                  <li key={b._id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-600 dark:text-slate-300">{b.category}</span>
                      <span
                        className={`font-semibold ${
                          b.overBudget ? 'text-red-600 dark:text-red-400' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        {b.percentUsed}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className={`h-full rounded-full ${
                          b.percentUsed >= 100 ? 'bg-red-500' : b.percentUsed >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardShell>

          <CardShell title="Savings Goals" viewAllTo="/goals">
            {loading ? (
              <ul className="space-y-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  <ProgressRowSkeleton key={i} />
                ))}
              </ul>
            ) : goals.length === 0 ? (
              <EmptyRow icon={PiggyBank} message="No savings goals yet." />
            ) : (
              <ul className="space-y-3">
                {goals.map((g) => (
                  <li key={g._id}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="truncate font-medium text-slate-600 dark:text-slate-300">{g.name}</span>
                      <span className="flex-shrink-0 font-semibold text-slate-400 dark:text-slate-500">{g.percent}%</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${Math.min(g.percent, 100)}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardShell>
        </div>
      </div>

      {quickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
          <div className="my-8 w-full max-w-sm rounded-xl bg-white p-5 dark:bg-slate-900 sm:my-0">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                Quick add {quickAddType === 'income' ? 'income' : 'expense'}
              </h3>
              <button
                type="button"
                onClick={() => setQuickAddOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuickAddSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickAddTypeChange('expense')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition ${
                    quickAddType === 'expense'
                      ? 'border-red-400 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
                      : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                  }`}
                >
                  <TrendingDown size={14} /> Expense
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickAddTypeChange('income')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition ${
                    quickAddType === 'income'
                      ? 'border-emerald-400 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                      : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                  }`}
                >
                  <TrendingUp size={14} /> Income
                </button>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={quickAddForm.amount}
                  onChange={(e) => setQuickAddForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  autoFocus
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Category
                </label>
                <select
                  value={quickAddForm.category}
                  onChange={(e) => setQuickAddForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select a category</option>
                  {quickAddCategoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={quickAddForm.note}
                  onChange={(e) => setQuickAddForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Grocery run"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <p className="text-xs text-slate-400 dark:text-slate-500">
                Dated today. Need a different date, or to mark it recurring? Use the full form on the
                Transactions page.
              </p>

              {quickAddError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                  {quickAddError}
                </p>
              )}

              <button
                type="submit"
                disabled={quickAddSaving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {quickAddSaving && <Spinner />}
                {quickAddSaving ? 'Saving…' : `Add ${quickAddType === 'income' ? 'income' : 'expense'}`}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyRow({ icon: Icon, message }) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <Icon size={20} className="text-slate-300 dark:text-slate-700" />
      <p className="text-xs text-slate-400 dark:text-slate-500">{message}</p>
    </div>
  );
}