const asyncHandler = require('express-async-handler');
const Budget = require('../models/Budget');
const Transaction = require('../models/Transaction');

const validateBody = ({ category, monthlyLimit }) => {
  if (!category || !category.trim()) {
    return 'category is required.';
  }
  if (
    monthlyLimit === undefined ||
    monthlyLimit === null ||
    Number.isNaN(Number(monthlyLimit)) ||
    Number(monthlyLimit) <= 0
  ) {
    return 'monthlyLimit must be a positive number.';
  }
  return null;
};

/** Start (inclusive) and end (exclusive) of the current calendar month. */
const currentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
};

/**
 * GET /api/budgets
 * Every budget the user has set, each annotated with how much they've
 * actually spent in that category so far this month.
 */
const getBudgets = asyncHandler(async (req, res) => {
  const { start, end } = currentMonthRange();

  const [budgets, spentByCategory] = await Promise.all([
    Budget.find({ user: req.user._id }).sort({ category: 1 }),
    Transaction.aggregate([
      {
        $match: {
          user: req.user._id,
          type: 'expense',
          date: { $gte: start, $lt: end },
        },
      },
      { $group: { _id: '$category', spent: { $sum: '$amount' } } },
    ]),
  ]);

  const spentMap = Object.fromEntries(spentByCategory.map((s) => [s._id, s.spent]));

  const result = budgets.map((b) => {
    const spent = spentMap[b.category] || 0;
    return {
      _id: b._id,
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      spent,
      remaining: Math.max(b.monthlyLimit - spent, 0),
      percentUsed: Math.min(Math.round((spent / b.monthlyLimit) * 100), 999),
      overBudget: spent > b.monthlyLimit,
    };
  });

  res.json(result);
});

/**
 * POST /api/budgets
 * Upsert - setting a budget for a category the user already has one for
 * just updates the limit instead of creating a duplicate.
 */
const setBudget = asyncHandler(async (req, res) => {
  const error = validateBody(req.body);
  if (error) {
    res.status(400);
    throw new Error(error);
  }

  const category = req.body.category.trim();
  const monthlyLimit = Number(req.body.monthlyLimit);

  const budget = await Budget.findOneAndUpdate(
    { user: req.user._id, category },
    { monthlyLimit },
    { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true }
  );

  res.status(201).json(budget);
});

/** DELETE /api/budgets/:id */
const deleteBudget = asyncHandler(async (req, res) => {
  const budget = await Budget.findOne({ _id: req.params.id, user: req.user._id });
  if (!budget) {
    res.status(404);
    throw new Error('Budget not found.');
  }
  await budget.deleteOne();
  res.json({ message: 'Budget deleted.' });
});

const STREAK_MONTHS_TO_CHECK = 12; // never look back more than a year

/**
 * GET /api/budgets/streak
 * How many consecutive, fully-completed calendar months (most recent
 * first) the user stayed under every category limit they currently have
 * set. The still-in-progress current month never counts either way.
 *
 * Budgets don't keep a history of what the limit *used to be* - only
 * today's value - so "under budget" for a past month means "would have
 * been under the limit as it stands right now", not necessarily whatever
 * the limit actually was back then. That's the honest tradeoff for not
 * needing a separate budget-history table.
 */
const getBudgetStreak = asyncHandler(async (req, res) => {
  const budgets = await Budget.find({ user: req.user._id });

  if (budgets.length === 0) {
    res.json({ streak: 0, hasBudgets: false });
    return;
  }

  const now = new Date();
  const rangeStart = new Date(now.getFullYear(), now.getMonth() - STREAK_MONTHS_TO_CHECK, 1);
  const rangeEnd = new Date(now.getFullYear(), now.getMonth(), 1); // exclusive - excludes current month

  const rows = await Transaction.aggregate([
    { $match: { user: req.user._id, type: 'expense', date: { $gte: rangeStart, $lt: rangeEnd } } },
    {
      $group: {
        _id: { year: { $year: '$date' }, month: { $month: '$date' }, category: '$category' },
        spent: { $sum: '$amount' },
      },
    },
  ]);

  const accountCreated = req.user.createdAt;
  let streak = 0;

  for (let i = 1; i <= STREAK_MONTHS_TO_CHECK; i += 1) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);

    // Don't credit (or break) a streak using months from before the account
    // even existed - an empty month with no possible activity isn't a real win.
    if (accountCreated && end <= accountCreated) break;

    const year = start.getFullYear();
    const month = start.getMonth() + 1; // 1-12, matches Mongo's $month

    const wentOverBudget = budgets.some((b) => {
      const row = rows.find((r) => r._id.year === year && r._id.month === month && r._id.category === b.category);
      return (row?.spent || 0) > b.monthlyLimit;
    });

    if (wentOverBudget) break;
    streak += 1;
  }

  res.json({ streak, hasBudgets: true });
});

module.exports = { getBudgets, setBudget, deleteBudget, getBudgetStreak };