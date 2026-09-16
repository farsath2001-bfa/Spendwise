import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, KeyRound, ArrowLeft } from 'lucide-react';
import * as authService from '../services/authService';
import { Spinner } from '../components/common/Spinner';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authService.forgotPassword(email);
      // Shown regardless of whether the email matched an account - the
      // backend intentionally never reveals that, so the UI shouldn't either.
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen items-center justify-center overflow-hidden bg-slate-900 px-4">
      <div
        className="absolute inset-0 scale-125 bg-cover bg-center blur-2xl motion-safe:animate-[slow-drift_20s_ease-in-out_infinite_alternate]"
        style={{ backgroundImage: "url('/auth-bg.jpg')" }}
      />
      <div
        className="absolute inset-0 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/auth-bg.jpg')" }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-emerald-600/75 via-emerald-400/25 to-white/85 dark:from-emerald-950/80 dark:via-emerald-900/45 dark:to-slate-950/85" />

      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl motion-safe:animate-[fade-slide-up_0.6s_ease-out_both] dark:border-slate-800 dark:bg-slate-900 sm:p-8">
        <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 motion-safe:animate-[soft-pulse-ring_2.5s_ease-in-out_infinite]">
          <KeyRound size={20} />
        </span>

        {sent ? (
          <>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Check your email</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              If an account exists for <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>,
              we've sent a link to reset your password. It expires in 30 minutes.
            </p>
            <p className="mt-4 text-xs text-slate-400 dark:text-slate-500">
              Didn't get it? Check your spam folder, or{' '}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="font-medium text-emerald-600 hover:underline dark:text-emerald-400"
              >
                try again
              </button>
              .
            </p>
          </>
        ) : (
          <>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Forgot your password?</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Enter your email and we'll send you a link to reset it.
            </p>

            {error && (
              <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition-colors focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="you@example.com"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
              >
                {loading && <Spinner />}
                {loading ? 'Sending…' : 'Send reset link'}
              </button>
            </form>
          </>
        )}

        <Link
          to="/login"
          className="mt-6 flex items-center justify-center gap-1.5 text-sm font-medium text-slate-500 hover:text-emerald-600 dark:text-slate-400 dark:hover:text-emerald-400"
        >
          <ArrowLeft size={14} />
          Back to login
        </Link>
      </div>
    </div>
  );
}