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

module.exports = { getBudgets, setBudget, deleteBudget };
