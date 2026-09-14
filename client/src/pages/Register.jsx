import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, PiggyBank, BarChart3, Bot, Mail, Lock, User, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/common/Spinner';

const FEATURES = [
  { icon: Wallet, text: 'Track income and expenses in one place' },
  { icon: PiggyBank, text: 'Set savings goals and watch your progress' },
  { icon: BarChart3, text: 'See exactly where your money goes each month' },
  { icon: Bot, text: 'Ask the built-in AI where you can save' },
];

function BrandPanel() {
  return (
    <div className="relative z-10 hidden w-1/2 flex-col justify-center p-10 text-white lg:flex xl:p-14">
      <div className="max-w-sm">
        <img src="/logo-icon.png" alt="" className="mb-6 h-14 w-14 drop-shadow-lg" />
        <h1 className="text-3xl font-bold xl:text-4xl drop-shadow-sm">SpendWise AI</h1>
        <p className="mt-3 text-sm text-emerald-50 xl:text-base drop-shadow-sm">
          Understand your money, don't just track it.
        </p>
        <ul className="mt-10 space-y-4">
          {FEATURES.map(({ icon: Icon, text }, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-white xl:text-base drop-shadow-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/15">
                <Icon size={16} />
              </span>
              {text}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await register(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not create your account. Try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex h-screen overflow-hidden bg-teal-900 dark:bg-slate-950">
      {/* Blurred, scaled-up copy fills every edge of the screen, so wherever the
          sharp image below doesn't reach shows soft, color-matched content
          instead of a flat black/white bar. */}
      <div
        className="absolute inset-0 scale-125 bg-cover bg-center blur-2xl"
        style={{ backgroundImage: "url('/register-bg.png')" }}
      />
      {/* The real image, sized so it always shows in full with nothing cropped. */}
      <div
        className="absolute inset-0 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/register-bg.png')" }}
      />
      {/* Register gets its own tint (teal/cyan instead of Login's emerald) on the
          same photo, so the two auth pages still read as distinct at a glance. */}
      <div className="absolute inset-0 bg-gradient-to-r from-teal-700/80 via-cyan-600/30 to-white/85 dark:from-teal-950/85 dark:via-emerald-950/50 dark:to-slate-950/85" />

      <BrandPanel />

      <div className="relative z-10 flex w-full flex-1 items-center justify-center overflow-y-auto px-4 py-6">
        <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/30 lg:hidden">
            <UserPlus size={20} />
          </span>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create your account</h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Free forever. No card required.
          </p>

          {error && (
            <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  name="name"
                  required
                  value={form.name}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Your name"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="you@example.com"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {loading && <Spinner />}
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">
              Log in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}