const asyncHandler = require('express-async-handler');
const Transaction = require('../models/Transaction');

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const currentMonthRange = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return { start, end };
};

/**
 * GET /api/analytics/summary
 * Everything the Analytics page needs in one call: this month's totals,
 * where expenses went by category this month, and income vs expense for
 * the last 6 months (including the current one) for the trend chart.
 */
const getSummary = asyncHandler(async (req, res) => {
  const { start, end } = currentMonthRange();
  const now = new Date();
  const trendStart = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const [monthTotals, categoryBreakdown, trendRaw] = await Promise.all([
    Transaction.aggregate([
      { $match: { user: req.user._id, date: { $gte: start, $lt: end } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]),
    Transaction.aggregate([
      { $match: { user: req.user._id, type: 'expense', date: { $gte: start, $lt: end } } },
      { $group: { _id: '$category', amount: { $sum: '$amount' } } },
      { $sort: { amount: -1 } },
    ]),
    Transaction.aggregate([
      { $match: { user: req.user._id, date: { $gte: trendStart, $lt: end } } },
      {
        $group: {
          _id: { year: { $year: '$date' }, month: { $month: '$date' }, type: '$type' },
          total: { $sum: '$amount' },
        },
      },
    ]),
  ]);

  const totalIncome = monthTotals.find((m) => m._id === 'income')?.total || 0;
  const totalExpense = monthTotals.find((m) => m._id === 'expense')?.total || 0;

  // Fixed 6-month scaffold so a month with no transactions still shows as 0
  // instead of just being missing from the chart.
  const monthlyTrend = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12, matches Mongo's $month
    const income =
      trendRaw.find((t) => t._id.year === year && t._id.month === month && t._id.type === 'income')?.total || 0;
    const expense =
      trendRaw.find((t) => t._id.year === year && t._id.month === month && t._id.type === 'expense')?.total || 0;
    monthlyTrend.push({ label: `${MONTH_LABELS[month - 1]} ${year}`, income, expense });
  }

  res.json({
    currentMonth: {
      totalIncome,
      totalExpense,
      net: totalIncome - totalExpense,
    },
    categoryBreakdown: categoryBreakdown.map((c) => ({ category: c._id, amount: c.amount })),
    monthlyTrend,
  });
});

module.exports = { getSummary };