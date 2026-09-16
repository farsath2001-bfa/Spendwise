import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Wallet, PieChart as PieChartIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { getAnalyticsSummary } from '../services/analyticsService';
import { CATEGORY_MAP, CURRENCIES, DEFAULT_CURRENCY } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Spinner } from '../components/common/Spinner';
import { Skeleton } from '../components/common/Skeleton';

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

function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
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

function StatCard({ icon: Icon, label, value, tone }) {
  const toneClasses = {
    emerald: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
    red: 'bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400',
    slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-3">
        <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${toneClasses[tone]}`}>
          <Icon size={16} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
          <p className="truncate text-lg font-bold tabular-nums text-slate-900 dark:text-white">{value}</p>
        </div>
      </div>
    </div>
  );
}

export default function Analytics() {
  const [currencyCode] = useLocalStorage('currency', DEFAULT_CURRENCY);
  const currencySymbol = CURRENCIES.find((c) => c.code === currencyCode)?.symbol || currencyCode;
  const isDark = useIsDarkMode();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const summary = await getAnalyticsSummary();
        setData(summary);
      } catch (err) {
        toast.error(err.response?.data?.message || 'Could not load analytics.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const fmt = (n) => `${currencySymbol} ${Number(n).toFixed(2)}`;

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

  if (!loading && !data) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center">
        <PieChartIcon size={28} className="text-slate-300 dark:text-slate-700" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Could not load analytics right now.</p>
      </div>
    );
  }

  const categoryBreakdown = (data?.categoryBreakdown ?? []).map((c) => ({
    ...c,
    color: CATEGORY_MAP[c.category]?.color || '#6b7280',
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Analytics</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          This month's totals and your last 6 months of activity.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {loading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard icon={TrendingUp} label="Income this month" value={fmt(data.currentMonth.totalIncome)} tone="emerald" />
            <StatCard icon={TrendingDown} label="Expenses this month" value={fmt(data.currentMonth.totalExpense)} tone="red" />
            <StatCard icon={Wallet} label="Net this month" value={fmt(data.currentMonth.net)} tone="slate" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-3">
          <h3 className="mb-4 text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Income vs Expense</h3>
          {loading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : data.monthlyTrend.every((m) => m.income === 0 && m.expense === 0) ? (
            <EmptyChartState message="Add some transactions to see your trend over time." />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.monthlyTrend} barCategoryGap={20}>
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
                <Legend wrapperStyle={{ fontSize: 12, color: tickColor }} />
                <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="expense" name="Expense" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
          <h3 className="mb-4 text-sm font-semibold tracking-tight text-slate-900 dark:text-white">Spending by Category</h3>
          {loading ? (
            <Skeleton className="mx-auto h-[220px] w-[220px] rounded-full" />
          ) : categoryBreakdown.length === 0 ? (
            <EmptyChartState message="No expenses recorded this month yet." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={categoryBreakdown}
                    dataKey="amount"
                    nameKey="category"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={2}
                    stroke="none"
                  >
                    {categoryBreakdown.map((c) => (
                      <Cell key={c.category} fill={c.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(value) => fmt(value)} />
                </PieChart>
              </ResponsiveContainer>
              <ul className="mt-2 space-y-1.5">
                {categoryBreakdown.map((c) => (
                  <li key={c.category} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 truncate text-slate-600 dark:text-slate-300">
                      <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                      <span className="truncate">{c.category}</span>
                    </span>
                    <span className="flex-shrink-0 font-medium text-slate-900 dark:text-white">{fmt(c.amount)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyChartState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <PieChartIcon size={24} className="text-slate-300 dark:text-slate-700" />
      <p className="max-w-[220px] text-xs text-slate-400 dark:text-slate-500">{message}</p>
    </div>
  );
}