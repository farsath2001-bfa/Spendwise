import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, PiggyBank, CalendarDays, CircleDollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { getGoals, createGoal, updateGoal, contributeToGoal, deleteGoal } from '../services/goalService';
import { CURRENCIES, DEFAULT_CURRENCY } from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Spinner } from '../components/common/Spinner';
import { Skeleton } from '../components/common/Skeleton';

const EMPTY_FORM = { name: '', targetAmount: '', targetDate: '' };

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Mirrors one real goal card's layout. */
function GoalCardSkeleton() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2.5">
        <Skeleton className="h-9 w-9 flex-shrink-0 rounded-lg" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        <div className="flex items-baseline justify-between">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>
    </div>
  );
}

export default function SavingsGoals() {
  const [currencyCode] = useLocalStorage('currency', DEFAULT_CURRENCY);
  const currencySymbol = CURRENCIES.find((c) => c.code === currencyCode)?.symbol || currencyCode;

  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add / edit goal modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Contribute modal
  const [contributeGoal, setContributeGoal] = useState(null);
  const [contributeAmount, setContributeAmount] = useState('');
  const [contributing, setContributing] = useState(false);
  const [contributeError, setContributeError] = useState('');

  const [deletingId, setDeletingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getGoals();
      setGoals(data);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load savings goals.');
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

  const openEditModal = (g) => {
    setEditingId(g._id);
    setForm({
      name: g.name,
      targetAmount: String(g.targetAmount),
      targetDate: g.targetDate ? g.targetDate.slice(0, 10) : '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError('Give this goal a name.');
      return;
    }
    if (!form.targetAmount || Number(form.targetAmount) <= 0) {
      setFormError('Enter a target amount greater than 0.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      if (editingId) {
        await updateGoal(editingId, form);
        toast.success('Goal updated.');
      } else {
        await createGoal(form);
        toast.success('Goal created.');
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const openContributeModal = (g) => {
    setContributeGoal(g);
    setContributeAmount('');
    setContributeError('');
  };

  const closeContributeModal = () => setContributeGoal(null);

  const handleContribute = async (e) => {
    e.preventDefault();
    if (!contributeAmount || Number(contributeAmount) <= 0) {
      setContributeError('Enter an amount greater than 0.');
      return;
    }
    setContributing(true);
    setContributeError('');
    try {
      await contributeToGoal(contributeGoal._id, Number(contributeAmount));
      toast.success('Contribution added.');
      setContributeGoal(null);
      load();
    } catch (err) {
      setContributeError(err.response?.data?.message || 'Something went wrong.');
    } finally {
      setContributing(false);
    }
  };

  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await deleteGoal(id);
      toast.success('Goal removed.');
      setGoals((prev) => prev.filter((g) => g._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not remove goal.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Savings Goals</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Set a target amount and date, and track your progress toward it.
          </p>
        </div>
        <button
          type="button"
          onClick={openAddModal}
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          <Plus size={16} />
          New goal
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <GoalCardSkeleton key={i} />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <PiggyBank size={28} className="text-slate-300 dark:text-slate-700" />
          <p className="text-sm font-medium text-slate-600 dark:text-slate-300">No savings goals yet</p>
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Create one to start putting money aside toward something specific.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {goals.map((g) => (
            <div
              key={g._id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
                    <PiggyBank size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{g.name}</p>
                    {g.targetDate && (
                      <p className="flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                        <CalendarDays size={11} />
                        {formatDate(g.targetDate)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(g)}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                    aria-label="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(g._id)}
                    disabled={deletingId === g._id}
                    className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                    aria-label="Delete"
                  >
                    {deletingId === g._id ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 size={14} />}
                  </button>
                </div>
              </div>

              <div className="mt-4">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-medium text-slate-600 dark:text-slate-300">
                    {currencySymbol} {g.currentAmount.toFixed(2)}{' '}
                    <span className="text-slate-400 dark:text-slate-500">
                      / {currencySymbol} {g.targetAmount.toFixed(2)}
                    </span>
                  </span>
                  <span
                    className={`font-semibold ${
                      g.reached ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {g.percent}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.min(g.percent, 100)}%` }}
                  />
                </div>
                {g.reached ? (
                  <p className="mt-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    Goal reached 🎉
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                    {currencySymbol} {(g.targetAmount - g.currentAmount).toFixed(2)} to go
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => openContributeModal(g)}
                className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 py-2 text-xs font-semibold text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400 dark:hover:bg-emerald-950/50"
              >
                <CircleDollarSign size={14} />
                Add contribution
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add / edit goal modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
          <div className="my-8 w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:my-0">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                {editingId ? 'Edit goal' : 'New savings goal'}
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Goal name
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. Emergency Fund"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Target amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={form.targetAmount}
                  onChange={(e) => setForm((f) => ({ ...f, targetAmount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Target date (optional)
                </label>
                <input
                  type="date"
                  value={form.targetDate}
                  onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving && <Spinner />}
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create goal'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Contribute modal */}
      {contributeGoal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
          <div className="my-8 w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:my-0">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                Add to "{contributeGoal.name}"
              </h3>
              <button
                type="button"
                onClick={closeContributeModal}
                className="rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleContribute} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  autoFocus
                  value={contributeAmount}
                  onChange={(e) => setContributeAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {contributeError && (
                <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                  {contributeError}
                </p>
              )}

              <button
                type="submit"
                disabled={contributing}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {contributing && <Spinner />}
                {contributing ? 'Adding…' : 'Add contribution'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}