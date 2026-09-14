import { Link } from 'react-router-dom';
import { Compass, ArrowLeft } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function NotFound() {
  const { user } = useAuth();

  return (
    <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center dark:bg-slate-950">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
        <Compass size={28} />
      </span>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">404</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Page not found</h1>
        <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
          The page you're looking for doesn't exist or may have moved.
        </p>
      </div>
      <Link
        to={user ? '/dashboard' : '/login'}
        className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
      >
        <ArrowLeft size={16} />
        {user ? 'Back to Dashboard' : 'Back to Login'}
      </Link>
    </div>
  );
}