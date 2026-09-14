import {
  UtensilsCrossed,
  Car,
  ShoppingBag,
  Film,
  Receipt,
  HeartPulse,
  Home,
  GraduationCap,
  Plane,
  MoreHorizontal,
  Briefcase,
  Laptop,
  Building2,
  TrendingUp,
  Gift,
} from 'lucide-react';

export const CURRENCIES = [
  { code: 'AED', label: 'UAE Dirham (AED)', symbol: 'AED' },
  { code: 'USD', label: 'US Dollar (USD)', symbol: '$' },
  { code: 'EUR', label: 'Euro (EUR)', symbol: '€' },
  { code: 'GBP', label: 'British Pound (GBP)', symbol: '£' },
  { code: 'INR', label: 'Indian Rupee (INR)', symbol: '₹' },
];

export const DEFAULT_CURRENCY = 'AED';

export const EXPENSE_CATEGORIES = [
  { value: 'Food & Dining', icon: UtensilsCrossed, color: '#f97316' },
  { value: 'Transportation', icon: Car, color: '#3b82f6' },
  { value: 'Shopping', icon: ShoppingBag, color: '#ec4899' },
  { value: 'Entertainment', icon: Film, color: '#a855f7' },
  { value: 'Bills & Utilities', icon: Receipt, color: '#ef4444' },
  { value: 'Health & Fitness', icon: HeartPulse, color: '#14b8a6' },
  { value: 'Housing', icon: Home, color: '#8b5cf6' },
  { value: 'Education', icon: GraduationCap, color: '#6366f1' },
  { value: 'Travel', icon: Plane, color: '#06b6d4' },
  { value: 'Other', icon: MoreHorizontal, color: '#6b7280' },
];

export const INCOME_CATEGORIES = [
  { value: 'Salary', icon: Briefcase, color: '#10b981' },
  { value: 'Freelance', icon: Laptop, color: '#22c55e' },
  { value: 'Business', icon: Building2, color: '#059669' },
  { value: 'Investments', icon: TrendingUp, color: '#0ea5e9' },
  { value: 'Gifts', icon: Gift, color: '#eab308' },
  { value: 'Other', icon: MoreHorizontal, color: '#6b7280' },
];

// Quick lookup so any page can render an icon/color for a category name
// without caring whether it's an expense or income category.
export const CATEGORY_MAP = Object.fromEntries(
  [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES].map((c) => [c.value, c])
);