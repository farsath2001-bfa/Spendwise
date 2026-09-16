import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Receipt as ReceiptIcon,
  TrendingUp,
  TrendingDown,
  Search,
  SlidersHorizontal,
  Download,
  Repeat,
  Paperclip,
  ImagePlus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getTransactions,
  getAllTransactions,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  uploadReceipt,
  deleteReceipt,
} from '../services/transactionService';
import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  CATEGORY_MAP,
  CURRENCIES,
  DEFAULT_CURRENCY,
} from '../utils/constants';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { Spinner } from '../components/common/Spinner';
import { Skeleton } from '../components/common/Skeleton';

const EMPTY_FORM = {
  type: 'expense',
  amount: '',
  category: '',
  note: '',
  date: new Date().toISOString().slice(0, 10),
  isRecurring: false,
  recurrence: 'monthly',
  endDate: '',
};

const RECURRENCE_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

/** Mirrors one real transaction row's layout, so the list doesn't jump around once data arrives. */
function TransactionRowSkeleton() {
  return (
    <li className="flex items-center gap-3 px-5 py-3.5">
      <Skeleton className="h-9 w-9 flex-shrink-0 rounded-lg" />
      <div className="min-w-0 flex-1 space-y-2">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
      </div>
      <Skeleton className="h-4 w-16 flex-shrink-0" />
      <div className="flex flex-shrink-0 items-center gap-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </li>
  );
}

/** Wraps a value in quotes (doubling any internal quotes) only when it needs escaping for CSV. */
function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function transactionsToCSV(transactions) {
  const header = ['Date', 'Type', 'Category', 'Amount', 'Note'];
  const rows = transactions.map((t) => [
    new Date(t.date).toISOString().slice(0, 10),
    t.type,
    t.category,
    t.amount,
    t.note || '',
  ]);
  return [header, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
}

export default function Transactions() {
  const [currencyCode] = useLocalStorage('currency', DEFAULT_CURRENCY);
  const currencySymbol = CURRENCIES.find((c) => c.code === currencyCode)?.symbol || currencyCode;

  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all'); // all | income | expense

  // Search is debounced so typing doesn't fire a request on every keystroke.
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showDateFilters, setShowDateFilters] = useState(false);

  const hasActiveFilters = typeFilter !== 'all' || search || dateFrom || dateTo;

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const clearFilters = () => {
    setTypeFilter('all');
    setSearchInput('');
    setSearch('');
    setDateFrom('');
    setDateTo('');
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Receipt photo: kept separate from `form` since it's a File object (or
  // a URL already stored on the server), not a plain field value.
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(''); // local object URL for a newly-picked file
  const [existingReceiptUrl, setExistingReceiptUrl] = useState(''); // already saved on the server
  const [removeExistingReceipt, setRemoveExistingReceipt] = useState(false);
  const fileInputRef = useRef(null);

  const [deletingId, setDeletingId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const categoryOptions = form.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100 };
      if (typeFilter !== 'all') params.type = typeFilter;
      if (search) params.search = search;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;
      const data = await getTransactions(params);
      setTransactions(data.transactions);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not load transactions.');
    } finally {
      setLoading(false);
    }
  }, [typeFilter, search, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const resetReceiptState = (existingUrl = '') => {
    setReceiptFile(null);
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptPreview('');
    setExistingReceiptUrl(existingUrl);
    setRemoveExistingReceipt(false);
  };

  const openAddModal = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    resetReceiptState('');
    setModalOpen(true);
  };

  const openEditModal = (t) => {
    setEditingId(t._id);
    setForm({
      type: t.type,
      amount: String(t.amount),
      category: t.category,
      note: t.note || '',
      date: t.date.slice(0, 10),
      isRecurring: !!t.isRecurring,
      recurrence: t.recurrence || 'monthly',
      endDate: t.endDate ? t.endDate.slice(0, 10) : '',
    });
    setFormError('');
    resetReceiptState(t.receiptUrl || '');
    setModalOpen(true);
  };

  const closeModal = () => setModalOpen(false);

  const handleReceiptSelect = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow picking the same file again later
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB.');
      return;
    }
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
    setRemoveExistingReceipt(false);
  };

  const handleRemoveReceipt = () => {
    if (receiptPreview) URL.revokeObjectURL(receiptPreview);
    setReceiptFile(null);
    setReceiptPreview('');
    if (existingReceiptUrl) setRemoveExistingReceipt(true);
  };

  const handleTypeChange = (type) => {
    setForm((f) => ({ ...f, type, category: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category) {
      setFormError('Pick a category.');
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError('Enter an amount greater than 0.');
      return;
    }
    setSaving(true);
    setFormError('');
    try {
      // recurrence only means anything while isRecurring is on; endDate sent
      // as '' when it's off so editing a transaction back to non-recurring
      // clears any previously-set schedule on the server.
      const payload = {
        ...form,
        recurrence: form.isRecurring ? form.recurrence : undefined,
        endDate: form.isRecurring ? form.endDate : '',
      };
      let saved;
      if (editingId) {
        saved = await updateTransaction(editingId, payload);
        toast.success('Transaction updated.');
      } else {
        saved = await createTransaction(payload);
        toast.success('Transaction added.');
      }

      // Receipt is uploaded as a separate step once we have a real
      // transaction id - a failure here shouldn't undo the transaction
      // that already saved successfully, just warn about the photo.
      try {
        if (receiptFile) {
          await uploadReceipt(saved._id, receiptFile);
        } else if (removeExistingReceipt && existingReceiptUrl) {
          await deleteReceipt(saved._id);
        }
      } catch (receiptErr) {
        toast.error(receiptErr.response?.data?.message || 'Transaction saved, but the receipt photo failed to upload.');
      }

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
      await deleteTransaction(id);
      toast.success('Transaction deleted.');
      setTransactions((prev) => prev.filter((t) => t._id !== id));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not delete.');
    } finally {
      setDeletingId(null);
    }
  };

  // Exports honor whatever filters are currently active - "all" transactions
  // when nothing's filtered, or just the filtered set when something is.
  const handleExport = async () => {
    setExporting(true);
    try {
      const params = {};
      if (typeFilter !== 'all') params.type = typeFilter;
      if (search) params.search = search;
      if (dateFrom) params.from = dateFrom;
      if (dateTo) params.to = dateTo;

      const all = await getAllTransactions(params);
      if (all.length === 0) {
        toast.error('No transactions to export.');
        return;
      }

      const csv = transactionsToCSV(all);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `spendwise-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      toast.success(`Exported ${all.length} transaction${all.length === 1 ? '' : 's'}.`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Could not export transactions.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">Transactions</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Every income and expense entry, newest first.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {exporting ? <Spinner className="h-4 w-4" /> : <Download size={16} />}
            {exporting ? 'Exporting…' : 'Export CSV'}
          </button>
          <button
            type="button"
            onClick={openAddModal}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
          >
            <Plus size={16} />
            Add transaction
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {['all', 'income', 'expense'].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTypeFilter(value)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold capitalize transition ${
                typeFilter === value
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              {value}
            </button>
          ))}

          <div className="relative ml-auto w-full max-w-[220px] sm:w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search category or note…"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowDateFilters((s) => !s)}
            className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
              showDateFilters || dateFrom || dateTo
                ? 'border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            <SlidersHorizontal size={13} />
            Dates
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs font-medium text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
            >
              <X size={13} />
              Clear
            </button>
          )}
        </div>

        {showDateFilters && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {Array.from({ length: 6 }).map((_, i) => (
              <TransactionRowSkeleton key={i} />
            ))}
          </ul>
        ) : transactions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <ReceiptIcon size={28} className="text-slate-300 dark:text-slate-700" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              {hasActiveFilters ? 'No matching transactions' : 'No transactions yet'}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500">
              {hasActiveFilters
                ? 'Try a different search term or widen your filters.'
                : 'Add your first income or expense to get started.'}
            </p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-1 text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {transactions.map((t) => {
              const meta = CATEGORY_MAP[t.category] || { icon: ReceiptIcon, color: '#6b7280' };
              const Icon = meta.icon;
              return (
                <li key={t._id} className="flex items-center gap-3 px-5 py-3.5">
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ backgroundColor: `${meta.color}20`, color: meta.color }}
                  >
                    <Icon size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{t.category}</p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(t.date)}
                        {t.note ? ` · ${t.note}` : ''}
                      </p>
                      {t.isRecurring && (
                        <span className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium capitalize text-sky-700 dark:bg-sky-500/10 dark:text-sky-400">
                          <Repeat size={10} />
                          {t.recurrence}
                        </span>
                      )}
                      {t.recurringSource && (
                        <span className="inline-flex flex-shrink-0 items-center rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                          Auto
                        </span>
                      )}
                      {t.receiptUrl && (
                        <a
                          href={t.receiptUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 hover:bg-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
                        >
                          <Paperclip size={10} />
                          Receipt
                        </a>
                      )}
                    </div>
                  </div>
                  <span
                    className={`text-sm font-semibold ${
                      t.type === 'income'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-red-600 dark:text-red-400'
                    }`}
                  >
                    {t.type === 'income' ? '+' : '-'}
                    {currencySymbol} {Number(t.amount).toFixed(2)}
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(t)}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
                      aria-label="Edit"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(t._id)}
                      disabled={deletingId === t._id}
                      className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                      aria-label="Delete"
                    >
                      {deletingId === t._id ? <Spinner className="h-4 w-4" /> : <Trash2 size={15} />}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-4 sm:items-center">
          <div className="my-8 w-full max-w-sm rounded-xl bg-white p-5 shadow-xl dark:bg-slate-900 sm:my-0">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">
                {editingId ? 'Edit transaction' : 'Add transaction'}
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('expense')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition ${
                    form.type === 'expense'
                      ? 'border-red-400 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
                      : 'border-slate-200 text-slate-500 dark:border-slate-700 dark:text-slate-400'
                  }`}
                >
                  <TrendingDown size={14} /> Expense
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('income')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 text-xs font-semibold transition ${
                    form.type === 'income'
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
                  value={form.amount}
                  onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Category
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">Select a category</option>
                  {categoryOptions.map((c) => (
                    <option key={c.value} value={c.value}>
                      {c.value}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Date
                </label>
                <input
                  type="date"
                  value={form.date}
                  onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Note (optional)
                </label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="e.g. Grocery run"
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
                <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.isRecurring}
                    onChange={(e) => setForm((f) => ({ ...f, isRecurring: e.target.checked }))}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <Repeat size={14} className="text-slate-400" />
                  Repeat this transaction
                </label>

                {form.isRecurring && (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        Every
                      </label>
                      <select
                        value={form.recurrence}
                        onChange={(e) => setForm((f) => ({ ...f, recurrence: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >
                        {RECURRENCE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                        End date (optional)
                      </label>
                      <input
                        type="date"
                        value={form.endDate}
                        onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Receipt photo (optional)
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptSelect}
                  className="hidden"
                />

                {receiptPreview || (existingReceiptUrl && !removeExistingReceipt) ? (
                  <div className="flex items-center gap-3 rounded-lg border border-slate-200 p-2 dark:border-slate-700">
                    <img
                      src={receiptPreview || existingReceiptUrl}
                      alt="Receipt preview"
                      className="h-14 w-14 flex-shrink-0 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                    />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {receiptFile ? receiptFile.name : 'Saved receipt'}
                      </span>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="text-xs font-medium text-emerald-600 hover:underline dark:text-emerald-400"
                        >
                          Replace
                        </button>
                        <button
                          type="button"
                          onClick={handleRemoveReceipt}
                          className="text-xs font-medium text-red-500 hover:underline dark:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 py-3 text-xs font-medium text-slate-500 transition-colors hover:border-emerald-400 hover:text-emerald-600 dark:border-slate-700 dark:text-slate-400 dark:hover:border-emerald-700 dark:hover:text-emerald-400"
                  >
                    <ImagePlus size={15} />
                    Add receipt photo
                  </button>
                )}
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
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add transaction'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}