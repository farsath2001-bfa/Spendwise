import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Wallet, PiggyBank, BarChart3, Bot, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/common/Spinner';

const FEATURES = [
  { icon: Wallet, text: 'Track income and expenses in one place' },
  { icon: PiggyBank, text: 'Set savings goals and watch your progress' },
  { icon: BarChart3, text: 'See exactly where your money goes each month' },
  { icon: Bot, text: 'Ask the built-in AI where you can save' },
];

// Number of dashes in the rotating ring around the login card - matches the
// Uiverse reference (by Yaya12085) this component is modeled on.
const RING_COUNT = 50;

function BrandPanel() {
  return (
    <div className="relative z-10 hidden w-1/2 flex-col justify-center p-10 text-white lg:flex xl:p-14">
      <div className="max-w-sm motion-safe:animate-[fade-slide-up_0.6s_ease-out_both]">
        <img src="/logo-icon.png" alt="" className="mb-6 h-14 w-14 drop-shadow-lg" />
        <h1 className="text-3xl font-bold xl:text-4xl drop-shadow-sm">SpendWise AI</h1>
        <p className="mt-3 text-sm text-emerald-50 xl:text-base drop-shadow-sm">
          Understand your money, don't just track it.
        </p>
        <ul className="mt-10 space-y-4">
          {FEATURES.map(({ icon: Icon, text }, i) => (
            <li
              key={i}
              style={{ animationDelay: `${180 + i * 90}ms` }}
              className="flex items-center gap-3 text-sm text-white xl:text-base drop-shadow-sm motion-safe:animate-[fade-slide-up_0.5s_ease-out_both]"
            >
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

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Could not log in. Check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  const floatingLabel =
    'pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400 transition-all ' +
    'peer-focus:-top-0.5 peer-focus:rounded peer-focus:bg-slate-900 peer-focus:px-1.5 peer-focus:text-[10px] peer-focus:text-emerald-400 ' +
    'peer-[&:not(:placeholder-shown)]:-top-0.5 peer-[&:not(:placeholder-shown)]:rounded peer-[&:not(:placeholder-shown)]:bg-slate-900 peer-[&:not(:placeholder-shown)]:px-1.5 peer-[&:not(:placeholder-shown)]:text-[10px]';

  return (
    <div className="relative flex h-screen overflow-hidden bg-slate-900">
      {/* Blurred, scaled-up copy fills every edge of the screen, so wherever the
          sharp image below doesn't reach (any screen wider/taller than its own
          ratio) shows soft, color-matched content instead of a flat black/white bar. */}
      <div
        className="absolute inset-0 scale-125 bg-cover bg-center blur-2xl motion-safe:animate-[slow-drift_20s_ease-in-out_infinite_alternate]"
        style={{ backgroundImage: "url('/auth-bg.jpg')" }}
      />
      {/* The real image, sized so it always shows in full with nothing cropped. */}
      <div
        className="absolute inset-0 bg-contain bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/auth-bg.jpg')" }}
      />
      {/* One continuous wash across the whole page - strong enough on the left for
          white text over the photo, fading to a light tint on the right so the
          form card sits on an airy background instead of a hard color split. */}
      <div className="absolute inset-0 bg-gradient-to-r from-emerald-600/75 via-emerald-400/25 to-white/85 dark:from-emerald-950/80 dark:via-emerald-900/45 dark:to-slate-950/85" />

      <BrandPanel />

      <div className="relative z-10 flex w-full flex-1 items-center justify-center overflow-y-auto px-4 py-6">
        {/* The login box itself - the circular "radar dial" component the
            person pointed to directly, recolored from cyan to the app's
            emerald accent so the ring matches the background photo and the
            rest of SpendWise AI, dropped into the same split-screen layout
            as the other auth pages. .login-ring / .login-ring-content and
            the ring-blink keyframe live in index.css. */}
        <div
          style={{ animationDelay: '120ms' }}
          className="login-ring motion-safe:animate-[fade-slide-up_0.6s_ease-out_both]"
        >
          {Array.from({ length: RING_COUNT }).map((_, i) => (
            <span key={i} className="login-ring-dash" style={{ '--i': i }} />
          ))}

          <div className="login-ring-content">
            <div className="flex flex-col items-center gap-1">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/5 p-1 ring-1 ring-white/10 motion-safe:animate-[soft-pulse-ring_2.5s_ease-in-out_infinite] lg:h-9 lg:w-9 lg:p-1.5">
                <img src="/favicon.png" alt="SpendWise AI" className="h-full w-full object-contain" />
              </span>
              <h2 className="text-base font-bold tracking-tight text-emerald-400 lg:text-xl">Login</h2>
            </div>

            {error && <p className="mt-1.5 text-center text-[10px] leading-snug text-red-400 lg:text-xs">{error}</p>}

            <form onSubmit={handleSubmit} className="mt-3 space-y-2 lg:mt-5 lg:space-y-3">
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  name="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  placeholder=" "
                  className="peer w-full rounded-full border-2 border-slate-700 bg-transparent px-3.5 py-2 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400 lg:px-5 lg:py-3 lg:text-base"
                />
                <label htmlFor="login-email" className={floatingLabel}>
                  Email
                </label>
              </div>

              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={handleChange}
                  placeholder=" "
                  className="peer w-full rounded-full border-2 border-slate-700 bg-transparent px-3.5 py-2 pr-9 text-sm text-slate-100 outline-none transition-colors focus:border-emerald-400 lg:px-5 lg:py-3 lg:pr-11 lg:text-base"
                />
                <label htmlFor="login-password" className={floatingLabel}>
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 transition-colors hover:text-slate-300 lg:right-4"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <div className="flex justify-center pt-0.5">
                <Link
                  to="/forgot-password"
                  className="text-[11px] text-slate-400 transition-colors hover:text-emerald-400 hover:underline lg:text-sm"
                >
                  Forgot your password?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-emerald-500 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-70 lg:py-3 lg:text-base"
              >
                {loading && <Spinner />}
                {loading ? 'Signing in…' : 'Login'}
              </button>
            </form>

            <p className="mt-2 text-center text-[11px] lg:mt-4 lg:text-sm">
              <Link to="/register" className="font-medium text-emerald-400 hover:underline">
                Sign Up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}