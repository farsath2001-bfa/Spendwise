import { Component } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

/**
 * Catches render errors anywhere below it in the tree and shows a friendly
 * full-page fallback instead of a blank white screen. Has to be a class
 * component - React only supports error boundaries via componentDidCatch /
 * getDerivedStateFromError, there's no hook equivalent.
 */
export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('SpendWise AI crashed:', error, info);
  }

  handleReload = () => {
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center dark:bg-slate-950">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400">
            <AlertTriangle size={28} />
          </span>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Something went wrong</h1>
            <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
              SpendWise AI hit an unexpected error. Your data is safe - try reloading the page.
            </p>
          </div>
          <button
            type="button"
            onClick={this.handleReload}
            className="mt-2 flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <RotateCcw size={16} />
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}