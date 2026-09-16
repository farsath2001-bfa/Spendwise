import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Wallet,
  LayoutDashboard,
  Receipt,
  PiggyBank,
  BarChart3,
  Bot,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Avatar from '../components/common/Avatar';

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: Receipt },
  { to: '/budget', label: 'Budget', icon: Wallet },
  { to: '/goals', label: 'Savings Goals', icon: PiggyBank },
  { to: '/analytics', label: 'Analytics', icon: BarChart3 },
  { to: '/ai-assistant', label: 'AI Assistant', icon: Bot },
  { to: '/settings', label: 'Settings', icon: Settings },
];

function NavLinks({ onNavigate }) {
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          onClick={onNavigate}
          className={({ isActive }) =>
            `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              isActive
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`
          }
        >
          <Icon size={18} />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}

function BrandRow() {
  return (
    <div className="flex items-center gap-2 px-6 py-5">
      <img src="/logo-icon.png" alt="" className="h-8 w-8" />
      <span className="text-lg font-bold text-slate-900 dark:text-white">SpendWise AI</span>
    </div>
  );
}

function UserRow() {
  const { user, logout } = useAuth();
  return (
    <div className="flex items-center gap-3 border-t border-slate-200 px-4 py-4 dark:border-slate-800">
      <Avatar name={user?.name} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{user?.name}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{user?.email}</p>
      </div>
      <button
        onClick={logout}
        title="Log out"
        className="shrink-0 rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <LogOut size={16} />
      </button>
    </div>
  );
}

export default function DashboardLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex">
        <BrandRow />
        <NavLinks />
        <UserRow />
      </aside>

      {/* Mobile top bar */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:hidden">
          <div className="flex items-center gap-2">
            <img src="/logo-icon.png" alt="" className="h-7 w-7" />
            <span className="font-bold text-slate-900 dark:text-white">SpendWise AI</span>
          </div>
          <button
            onClick={() => setMobileOpen(true)}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <Menu size={20} />
          </button>
        </header>

        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white dark:bg-slate-900">
            <div className="flex items-center justify-between pr-3">
              <BrandRow />
              <button
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X size={18} />
              </button>
            </div>
            <NavLinks onNavigate={() => setMobileOpen(false)} />
            <UserRow />
          </aside>
        </div>
      )}
    </div>
  );
}