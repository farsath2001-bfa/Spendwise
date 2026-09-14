import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, Wallet } from 'lucide-react';
import toast from 'react-hot-toast';
import { getBudgets, setBudget, deleteBudget } from '../services/budgetService';
import { EXPENSE_CATEGORIES, CATEGORY_MAP, CURRENCIES, DEFAULT_CURRENCY } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Spinner } from '../components/common/Spinner';
import { Skeleton } from '../components/common/Skeleton';

const EMPTY_FORM = { category: '', monthlyLimit: '' };

function barColor(percentUsed) {
  if (percentUsed >= 100) return 'bg-red-500';
  if (percentUsed >= 80) return 'bg-amber-500';
  return 'bg-emerald-500';
}
/** Mirrors one real budget card's layout. */
function BudgetCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-9 w-9 flex-shrink-0 rounded-lg" />
        <Skeleton className="h-4 w-24" />
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}
export default function Budget() {
  const [currencyCode] = useLocalStorage('currency', DEFAULT_CURRENCY);
  const currencySymbol = CURRENCIES.find((c) => c.code === currencyCode)?.symbol || currencyCode;

  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getBudgets();
      setBudgets(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load budgets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEditModal = (b) => {
    setEditingId(b._id);
    setForm({ category: b.category, monthlyLimit: String(b.monthlyLimit) });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) {
      setFormError('Pick a category.');
      return;
    }
    if (!form.monthlyLimit || Number(form.monthlyLimit) <= 0) {
      setFormError('Enter a limit greater than 0.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      await setBudget(form);
      toast.success(editingId ? 'Budget updated.' : 'Budget set.');
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteBudget(id);
      toast.success('Budget removed.');
      setBudgets((prev) => prev.filter((b) => b._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove budget.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Monthly Budget</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Set a spending limit per category and track this month's progress.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <Plus size={16} />
          Set budget
        </button>
      </div>

      {loading ? (
  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: 3 }).map((_, i) => (
      <BudgetCardSkeleton key={i} />
    ))}
  </div>
) : budgets.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-center dark:border-slate-800 dark:bg-slate-900">
          <Wallet size={28} className="text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No budgets set</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Set a monthly limit on a category to start tracking it here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {budgets.map((b) => {
            const meta = CATEGORY_MAP[b.category] || { icon: Wallet, color: '#6b7280' };
            const Icon = meta.icon;
            return (
              <div
                key={b._id}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                    >
                      <Icon size={16} />
                    </span>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{b.category}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(b)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                      aria-label="Edit"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(b._id)}
                      disabled={deletingId === b._id}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      aria-label="Delete"
                    >
                      {deletingId === b._id ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="flex items-baseline justify-between text-xs">
                    <span className="font-medium text-slate-600 dark:text-slate-300">
                      {currencySymbol} {b.spent.toFixed(2)}{' '}
                      <span className="text-slate-400 dark:text-slate-500">
                        / {currencySymbol} {b.monthlyLimit.toFixed(2)}
                      </span>
                    </span>
                    <span
                      className={`font-semibold ${
                        b.overBudget ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {b.percentUsed}%
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${barColor(b.percentUsed)}`}
                      style={{ width: `${Math.min(b.percentUsed, 100)}%` }}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                    {b.overBudget
                      ? `${currencySymbol} ${(b.spent - b.monthlyLimit).toFixed(2)} over budget`
                      : `${currencySymbol} ${b.remaining.toFixed(2)} remaining`}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
  <div className="my-8 w-full max-w-sm rounded-xl bg-white p-5 dark:bg-slate-900 sm:my-0">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                {editingId ? 'Edit budget' : 'Set budget'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  disabled={!!editingId}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:disabled:bg-slate-800/50"
                >
                  <option value="">Select a category</option>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Monthly limit
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.monthlyLimit}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyLimit: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {formError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                  {formError}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving && <Spinner />}
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Set budget'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}