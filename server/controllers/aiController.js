const asyncHandler = require('express-async-handler');
const Transaction = require('../models/Transaction');
const Budget = require('../models/Budget');
const SavingsGoal = require('../models/SavingsGoal');
const { askGemini } = require('../utils/geminiClient');

/**
 * The AI Assistant is a deterministic insights engine, not a language
 * model - it pattern-matches the question to an intent, then computes the
 * real answer straight from the user's own data in MongoDB (transactions,
 * budgets, savings goals). No external AI service, no API key, no
 * hallucination risk: every number in every reply is a genuine aggregate
 * of that user's own data. Swapping this for a real LLM later (e.g. to
 * phrase the same computed numbers more conversationally) would only mean
 * changing how each answer* function's result is worded, not this routing.
 */

// Quick-start chips shown in the UI - kept short on purpose.
const SUGGESTION_CHIPS = [
  'Where am I spending the most money?',
  'Can I afford a 500 purchase?',
  'How am I doing on my budget?',
  "How's my savings goal coming along?",
];

// A wider pool the "I don't understand" fallback samples from, so it
// showcases the assistant's real range instead of always quoting the same
// four questions.
const ALL_EXAMPLES = [
  ...SUGGESTION_CHIPS,
  'Give me a plan to save 1000 this month.',
  'How much did I spend on groceries this month?',
  'What percentage of my income am I saving?',
  'Do I have any recurring expenses?',
  'What was my biggest expense this month?',
  'How many transactions have I logged?',
  'What is my current balance?',
  'Why did my expenses increase this month?',
  'How much have I earned this month?',
];

const monthBounds = (offsetMonths = 0) => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offsetMonths + 1, 1);
  return { start, end };
};

const extractAmount = (text) => {
  const match = text.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
};

// Maps free-text words a person would actually type ("groceries", "gas",
// "rent") to one of the app's real category names, so questions don't have
// to use the exact category label to be understood.
const CATEGORY_ALIASES = {
  'Food & Dining': ['food', 'dining', 'restaurant', 'restaurants', 'grocery', 'groceries', 'takeout', 'eating out'],
  Transportation: ['transport', 'transportation', 'uber', 'taxi', 'fuel', 'gas', 'petrol', 'car'],
  Shopping: ['shopping', 'clothes', 'clothing'],
  Entertainment: ['entertainment', 'movie', 'movies', 'netflix', 'games', 'gaming'],
  'Bills & Utilities': ['bills', 'bill', 'utilities', 'utility', 'electricity', 'internet bill', 'phone bill'],
  'Health & Fitness': ['health', 'fitness', 'gym', 'medical', 'doctor', 'pharmacy'],
  Housing: ['housing', 'rent', 'mortgage'],
  Education: ['education', 'school', 'tuition', 'course', 'courses'],
  Travel: ['travel', 'trip', 'vacation', 'flight', 'hotel'],
  Salary: ['salary', 'paycheck', 'wages'],
  Freelance: ['freelance', 'freelancing', 'gig'],
  Business: ['business income', 'business'],
  Investments: ['investment', 'investments', 'dividend', 'dividends', 'stocks'],
  Gifts: ['gift', 'gifts'],
};

const CATEGORY_TYPE = {
  'Food & Dining': 'expense',
  Transportation: 'expense',
  Shopping: 'expense',
  Entertainment: 'expense',
  'Bills & Utilities': 'expense',
  'Health & Fitness': 'expense',
  Housing: 'expense',
  Education: 'expense',
  Travel: 'expense',
  Salary: 'income',
  Freelance: 'income',
  Business: 'income',
  Investments: 'income',
  Gifts: 'income',
};

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Finds the first known category a question is talking about, matching whole words only (so "car" doesn't match inside "scared"). */
const extractCategory = (text) => {
  const t = text.toLowerCase();
  for (const [canonical, aliases] of Object.entries(CATEGORY_ALIASES)) {
    for (const alias of aliases) {
      if (new RegExp(`\\b${escapeRegExp(alias)}\\b`, 'i').test(t)) {
        return canonical;
      }
    }
  }
  return null;
};

const classifyIntent = (question) => {
  const t = question.toLowerCase();
  if (/(afford|can i (buy|spend|purchase|get))/.test(t)) return 'afford';
  if (/(plan.*\b(save|saving)\b)|(\b(save|saving)\b.*\bplan\b)|(\bsave\b\s+\S*\d)/.test(t)) return 'save_plan';
  if (/\bbudgets?\b/.test(t) && /(status|doing|over|left|remaining|how|much)/.test(t)) return 'budget_status';
  if (/\bgoals?\b/.test(t) && /(saving|savings|progress|much|how|status|doing|reach|close)/.test(t)) return 'goal_progress';
  if (/how much (have|do) i (have )?saved for/.test(t)) return 'goal_progress';
  if (extractCategory(t) && /(spend|spent|spending|cost|paid|pay|earn|earned|earning)/.test(t)) return 'category_spend';
  if (/why.*(increase|more|higher|up)|expenses?\s+increase/.test(t)) return 'expense_change';
  if (/(spending|spend).*(most|highest|biggest)|top category|highest expense/.test(t)) return 'top_category';
  if (/(biggest|largest|most expensive).*(transaction|expense|purchase|income)/.test(t)) return 'biggest_transaction';
  if (/how many.*(transaction|times)/.test(t)) return 'transaction_count';
  if (/(average|per day|daily)/.test(t) && /(spend|spending|expense)/.test(t)) return 'average_spend';
  if (/(recurring|subscription)/.test(t)) return 'recurring_list';
  if (/(savings rate|percentage.*(save|saving|income)|what percent)/.test(t)) return 'savings_rate';
  if (/(income|earn|earning|earned)/.test(t)) return 'income_total';
  if (/(total expense|how much.*(spend|spent)|expenses? this month)/.test(t)) return 'expense_total';
  if (/(balance|net worth|how much (do i have|is left|left))/.test(t)) return 'balance';
  if (/(summary|overview|how am i doing)/.test(t)) return 'summary';
  if (/^\s*(hi|hello|hey|thanks|thank you|good (morning|afternoon|evening))\b/.test(t)) return 'greeting';
  return 'unknown';
};

const getTotals = async (userId, start, end) => {
  const rows = await Transaction.aggregate([
    { $match: { user: userId, date: { $gte: start, $lt: end } } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);
  return {
    income: rows.find((r) => r._id === 'income')?.total || 0,
    expense: rows.find((r) => r._id === 'expense')?.total || 0,
  };
};

const getCategoryTotals = async (userId, start, end, type = 'expense') => {
  const rows = await Transaction.aggregate([
    { $match: { user: userId, type, date: { $gte: start, $lt: end } } },
    { $group: { _id: '$category', amount: { $sum: '$amount' } } },
    { $sort: { amount: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id, amount: r.amount }));
};

const getAllTimeBalance = async (userId) => {
  const rows = await Transaction.aggregate([
    { $match: { user: userId } },
    { $group: { _id: '$type', total: { $sum: '$amount' } } },
  ]);
  const income = rows.find((r) => r._id === 'income')?.total || 0;
  const expense = rows.find((r) => r._id === 'expense')?.total || 0;
  return income - expense;
};

/** Same shape as GET /api/budgets, computed here directly so the assistant doesn't have to make an HTTP call to itself. */
const getBudgetsWithSpend = async (userId) => {
  const { start, end } = monthBounds(0);
  const [budgets, spentByCategory] = await Promise.all([
    Budget.find({ user: userId }),
    Transaction.aggregate([
      { $match: { user: userId, type: 'expense', date: { $gte: start, $lt: end } } },
      { $group: { _id: '$category', spent: { $sum: '$amount' } } },
    ]),
  ]);
  const spentMap = Object.fromEntries(spentByCategory.map((s) => [s._id, s.spent]));
  return budgets.map((b) => {
    const spent = spentMap[b.category] || 0;
    return {
      category: b.category,
      monthlyLimit: b.monthlyLimit,
      spent,
      remaining: Math.max(b.monthlyLimit - spent, 0),
      percentUsed: Math.min(Math.round((spent / b.monthlyLimit) * 100), 999),
      overBudget: spent > b.monthlyLimit,
    };
  });
};

const answerTopCategory = async (userId) => {
  const { start, end } = monthBounds(0);
  const categories = await getCategoryTotals(userId, start, end, 'expense');
  if (categories.length === 0) {
    return "You haven't logged any expenses this month yet, so there's nothing to compare.";
  }
  const total = categories.reduce((sum, c) => sum + c.amount, 0);
  const top = categories[0];
  const percent = Math.round((top.amount / total) * 100);
  let msg = `Your highest expense category this month is ${top.category}, at ${top.amount.toFixed(
    2
  )} - about ${percent}% of your total spending.`;
  if (categories[1]) {
    msg += ` Next is ${categories[1].category} at ${categories[1].amount.toFixed(2)}.`;
  }
  return msg;
};

const answerAfford = async (userId, amount) => {
  if (amount === null) {
    return 'Tell me the amount and I\'ll check - e.g. "Can I afford a 500 purchase?"';
  }
  const balance = await getAllTimeBalance(userId);
  if (balance >= amount) {
    const remaining = balance - amount;
    return `Yes - your current balance is ${balance.toFixed(2)} (all income minus all expenses tracked so far), so a ${amount.toFixed(
      2
    )} purchase would leave you with ${remaining.toFixed(2)}.`;
  }
  const shortfall = amount - balance;
  return `Probably not right now - your current balance is only ${balance.toFixed(
    2
  )}, which is ${shortfall.toFixed(2)} short of ${amount.toFixed(2)}.`;
};

const answerSavePlan = async (userId, amount) => {
  if (amount === null) {
    return 'Tell me your target - e.g. "Give me a plan to save 1000 this month."';
  }
  const { start, end } = monthBounds(0);
  const { income, expense } = await getTotals(userId, start, end);
  const netSoFar = income - expense;

  if (netSoFar >= amount) {
    return `You're already there - you've saved ${netSoFar.toFixed(2)} so far this month, which meets your ${amount.toFixed(
      2
    )} goal.`;
  }

  const shortfall = amount - netSoFar;
  const categories = await getCategoryTotals(userId, start, end, 'expense');

  if (categories.length === 0) {
    return `You need ${shortfall.toFixed(
      2
    )} more to hit ${amount.toFixed(2)} this month. You haven't logged any expenses yet, so there's nothing to trim - just keep an eye on new spending as the month goes on.`;
  }

  const top = categories.slice(0, 3);
  const suggestions = top.map((c) => {
    const cut = Math.min(c.amount * 0.2, shortfall);
    return `trim ${c.category} by about ${cut.toFixed(2)} (currently ${c.amount.toFixed(2)})`;
  });

  return `You need ${shortfall.toFixed(2)} more to hit ${amount.toFixed(
    2
  )} this month. Your biggest categories so far are ${top
    .map((c) => `${c.category} (${c.amount.toFixed(2)})`)
    .join(', ')}. A realistic plan: ${suggestions.join('; ')}.`;
};

const answerExpenseChange = async (userId) => {
  const thisMonth = monthBounds(0);
  const lastMonth = monthBounds(-1);

  const [thisTotals, lastTotals, thisCategories, lastCategories] = await Promise.all([
    getTotals(userId, thisMonth.start, thisMonth.end),
    getTotals(userId, lastMonth.start, lastMonth.end),
    getCategoryTotals(userId, thisMonth.start, thisMonth.end, 'expense'),
    getCategoryTotals(userId, lastMonth.start, lastMonth.end, 'expense'),
  ]);

  if (lastTotals.expense === 0) {
    return "You didn't log any expenses last month, so there's nothing to compare this month against yet.";
  }

  const diff = thisTotals.expense - lastTotals.expense;
  if (diff <= 0) {
    return `Good news - your expenses are actually down ${Math.abs(diff).toFixed(
      2
    )} compared to last month (${thisTotals.expense.toFixed(2)} vs ${lastTotals.expense.toFixed(2)}).`;
  }

  const percent = Math.round((diff / lastTotals.expense) * 100);
  const lastMap = Object.fromEntries(lastCategories.map((c) => [c.category, c.amount]));
  const increases = thisCategories
    .map((c) => ({ category: c.category, increase: c.amount - (lastMap[c.category] || 0) }))
    .filter((c) => c.increase > 0)
    .sort((a, b) => b.increase - a.increase)
    .slice(0, 2);

  let msg = `Your expenses increased by ${diff.toFixed(2)} (${percent}%) compared to last month (${thisTotals.expense.toFixed(
    2
  )} vs ${lastTotals.expense.toFixed(2)}).`;
  if (increases.length > 0) {
    msg += ` The biggest contributors were ${increases
      .map((c) => `${c.category} (+${c.increase.toFixed(2)})`)
      .join(' and ')}.`;
  }
  return msg;
};

const answerBalance = async (userId) => {
  const balance = await getAllTimeBalance(userId);
  return `Your current balance is ${balance.toFixed(2)} - that's all tracked income minus all tracked expenses.`;
};

const answerSummary = async (userId) => {
  const { start, end } = monthBounds(0);
  const { income, expense } = await getTotals(userId, start, end);
  const net = income - expense;
  const categories = await getCategoryTotals(userId, start, end, 'expense');
  let msg = `This month you've earned ${income.toFixed(2)} and spent ${expense.toFixed(
    2
  )}, for a net of ${net.toFixed(2)}.`;
  if (categories[0]) {
    msg += ` Your top expense category is ${categories[0].category} at ${categories[0].amount.toFixed(2)}.`;
  }
  return msg;
};

/** Handles both "am I over budget?" (no category) and "how's my Food & Dining budget?" (category-specific). */
const answerBudgetStatus = async (userId, categoryHint) => {
  const budgets = await getBudgetsWithSpend(userId);
  if (budgets.length === 0) {
    return "You haven't set any budgets yet. Head to the Budget page to set a monthly limit for a category.";
  }

  if (categoryHint) {
    const match = budgets.find((b) => b.category === categoryHint);
    if (match) {
      if (match.overBudget) {
        return `You're over your ${match.category} budget - you've spent ${match.spent.toFixed(
          2
        )} against a ${match.monthlyLimit.toFixed(2)} limit, which is ${(match.spent - match.monthlyLimit).toFixed(
          2
        )} over.`;
      }
      return `You've spent ${match.spent.toFixed(2)} of your ${match.monthlyLimit.toFixed(2)} ${
        match.category
      } budget (${match.percentUsed}% used) - ${match.remaining.toFixed(2)} left this month.`;
    }
    // Falls through to the overall summary below if there's no budget set for that specific category.
  }

  const over = budgets.filter((b) => b.overBudget);
  const near = budgets.filter((b) => !b.overBudget && b.percentUsed >= 80);

  if (over.length > 0) {
    let msg = `You're over budget on ${over.map((b) => b.category).join(', ')}.`;
    msg += near.length > 0 ? ` You're also close to your limit on ${near.map((b) => b.category).join(', ')}.` : ' Everything else is within budget.';
    return msg;
  }
  if (near.length > 0) {
    return `You're within budget everywhere, but getting close on ${near
      .map((b) => `${b.category} (${b.percentUsed}%)`)
      .join(', ')}.`;
  }
  return `You're on track - all ${budgets.length} of your budgets are within their limits this month.`;
};

/** Handles both "how are my goals doing?" and "how's my Emergency Fund goal?" (matched by name). */
const answerGoalProgress = async (userId, question) => {
  const goals = await SavingsGoal.find({ user: userId }).sort({ createdAt: -1 });
  if (goals.length === 0) {
    return "You haven't set any savings goals yet. Head to the Savings Goals page to create one.";
  }

  const t = question.toLowerCase();
  const named = goals.find((g) => t.includes(g.name.toLowerCase()));

  if (named) {
    if (named.currentAmount >= named.targetAmount) {
      return `You've reached your "${named.name}" goal - ${named.currentAmount.toFixed(
        2
      )} saved of ${named.targetAmount.toFixed(2)}. 🎉`;
    }
    const percent = Math.round((named.currentAmount / named.targetAmount) * 100);
    const remaining = named.targetAmount - named.currentAmount;
    return `Your "${named.name}" goal is ${percent}% there - ${named.currentAmount.toFixed(
      2
    )} saved of ${named.targetAmount.toFixed(2)}, ${remaining.toFixed(2)} to go.`;
  }

  const reached = goals.filter((g) => g.currentAmount >= g.targetAmount);
  const inProgress = goals.filter((g) => g.currentAmount < g.targetAmount);

  let msg = `You have ${goals.length} savings goal${goals.length > 1 ? 's' : ''}.`;
  if (reached.length > 0) {
    msg += ` ${reached.length} reached (${reached.map((g) => g.name).join(', ')}).`;
  }
  if (inProgress.length > 0) {
    const closest = [...inProgress].sort(
      (a, b) => b.currentAmount / b.targetAmount - a.currentAmount / a.targetAmount
    )[0];
    const percent = Math.round((closest.currentAmount / closest.targetAmount) * 100);
    msg += ` You're closest on "${closest.name}" at ${percent}% (${closest.currentAmount.toFixed(
      2
    )} of ${closest.targetAmount.toFixed(2)}).`;
  }
  return msg;
};

/** "How much did I spend on groceries?" style questions, resolved to whichever real category the words match. */
const answerCategorySpend = async (userId, category) => {
  const type = CATEGORY_TYPE[category] || 'expense';
  const { start, end } = monthBounds(0);
  const rows = await Transaction.aggregate([
    { $match: { user: userId, category, type, date: { $gte: start, $lt: end } } },
    { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const total = rows[0]?.total || 0;
  const count = rows[0]?.count || 0;
  const verb = type === 'income' ? 'earned' : 'spent';

  if (count === 0) {
    return `You haven't ${verb} anything in ${category} this month yet.`;
  }
  return `You've ${verb} ${total.toFixed(2)} on ${category} this month across ${count} transaction${
    count > 1 ? 's' : ''
  }.`;
};

const answerBiggestTransaction = async (userId, question) => {
  const t = question.toLowerCase();
  const allTime = /(all time|ever|overall)/.test(t);
  const type = /income|earned/.test(t) ? 'income' : 'expense';

  const query = { user: userId, type };
  if (!allTime) {
    const { start, end } = monthBounds(0);
    query.date = { $gte: start, $lt: end };
  }

  const tx = await Transaction.findOne(query).sort({ amount: -1 });
  if (!tx) {
    return `I couldn't find any ${type} transactions${allTime ? '' : ' this month'} to compare.`;
  }
  const when = new Date(tx.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `Your biggest ${type}${allTime ? ' ever' : ' this month'} was ${tx.amount.toFixed(2)} on ${tx.category}${
    tx.note ? ` ("${tx.note}")` : ''
  }, on ${when}.`;
};

const answerTransactionCount = async (userId, question) => {
  const t = question.toLowerCase();
  const thisMonthOnly = /this month/.test(t);

  const query = { user: userId };
  if (/income/.test(t)) query.type = 'income';
  else if (/expense/.test(t)) query.type = 'expense';
  if (thisMonthOnly) {
    const { start, end } = monthBounds(0);
    query.date = { $gte: start, $lt: end };
  }

  const count = await Transaction.countDocuments(query);
  const scope = thisMonthOnly ? 'this month' : 'in total';
  const kind = query.type ? `${query.type} ` : '';
  return `You have ${count} ${kind}transaction${count === 1 ? '' : 's'} logged ${scope}.`;
};

const answerAverageSpend = async (userId) => {
  const { start, end } = monthBounds(0);
  const now = new Date();
  const daysElapsed = Math.max(1, Math.ceil((Math.min(now.getTime(), end.getTime()) - start.getTime()) / 86400000));
  const { expense } = await getTotals(userId, start, end);

  if (expense === 0) {
    return "You haven't logged any expenses this month yet, so there's no average to show.";
  }
  const avg = expense / daysElapsed;
  return `You've spent ${expense.toFixed(2)} over ${daysElapsed} day${
    daysElapsed > 1 ? 's' : ''
  } this month - about ${avg.toFixed(2)} per day on average.`;
};

const answerRecurring = async (userId) => {
  const templates = await Transaction.find({ user: userId, isRecurring: true }).sort({ amount: -1 });
  if (templates.length === 0) {
    return "You don't have any recurring transactions set up. You can turn any transaction into a recurring one from the Transactions page.";
  }
  const lines = templates.map((t) => `${t.category} - ${t.amount.toFixed(2)} (${t.recurrence || 'recurring'})`).join(', ');
  const totalExpense = templates.filter((t) => t.type === 'expense').reduce((sum, t) => sum + t.amount, 0);
  return `You have ${templates.length} recurring transaction${
    templates.length > 1 ? 's' : ''
  }: ${lines}. That's ${totalExpense.toFixed(2)} in recurring expenses each cycle.`;
};

const answerSavingsRate = async (userId) => {
  const { start, end } = monthBounds(0);
  const { income, expense } = await getTotals(userId, start, end);
  if (income === 0) {
    return "You haven't logged any income this month yet, so there's no savings rate to calculate.";
  }
  const rate = Math.round(((income - expense) / income) * 100);
  if (rate < 0) {
    return `You're spending more than you're earning this month - your expenses are running ${Math.abs(
      rate
    )}% above your income.`;
  }
  return `You're saving about ${rate}% of your income this month (earned ${income.toFixed(2)}, spent ${expense.toFixed(
    2
  )}).`;
};

const answerIncomeTotal = async (userId) => {
  const { start, end } = monthBounds(0);
  const { income } = await getTotals(userId, start, end);
  if (income === 0) {
    return "You haven't logged any income this month yet.";
  }
  const categories = await getCategoryTotals(userId, start, end, 'income');
  let msg = `You've earned ${income.toFixed(2)} this month.`;
  if (categories[0]) {
    msg += ` Most of it came from ${categories[0].category} (${categories[0].amount.toFixed(2)}).`;
  }
  return msg;
};

const answerExpenseTotal = async (userId) => {
  const { start, end } = monthBounds(0);
  const { expense } = await getTotals(userId, start, end);
  if (expense === 0) {
    return "You haven't logged any expenses this month yet.";
  }
  return `You've spent ${expense.toFixed(2)} in total this month.`;
};

const answerGreeting = (question) => {
  if (/thank/.test(question.toLowerCase())) {
    return "You're welcome! Let me know if you have more questions about your money.";
  }
  return "Hi! Ask me anything about your spending, income, budgets, or savings goals - I'll pull the real numbers from your account.";
};

const answerUnknown = () => {
  const sample = [...ALL_EXAMPLES].sort(() => Math.random() - 0.5).slice(0, 4);
  return `I can answer real questions about your spending, income, budgets, and savings goals - try things like: ${sample
    .map((q) => `"${q}"`)
    .join(', ')}.`;
};

/**
 * Builds a compact, plain-text snapshot of the user's real data (this
 * month's totals, top categories, budgets, goals, all-time balance) to hand
 * to Gemini as grounding - so a free-form question it answers is still
 * answered from the user's actual numbers, not invented ones.
 */
const buildDataSnapshot = async (userId) => {
  const { start, end } = monthBounds(0);
  const [totals, expenseCategories, incomeCategories, budgets, goals, balance] = await Promise.all([
    getTotals(userId, start, end),
    getCategoryTotals(userId, start, end, 'expense'),
    getCategoryTotals(userId, start, end, 'income'),
    getBudgetsWithSpend(userId),
    SavingsGoal.find({ user: userId }),
    getAllTimeBalance(userId),
  ]);

  const lines = [
    `All-time balance (income minus expenses): ${balance.toFixed(2)}`,
    `This month - income: ${totals.income.toFixed(2)}, expenses: ${totals.expense.toFixed(2)}, net: ${(
      totals.income - totals.expense
    ).toFixed(2)}`,
    expenseCategories.length
      ? `This month's expenses by category: ${expenseCategories.map((c) => `${c.category} ${c.amount.toFixed(2)}`).join(', ')}`
      : "This month's expenses by category: none logged yet",
    incomeCategories.length
      ? `This month's income by category: ${incomeCategories.map((c) => `${c.category} ${c.amount.toFixed(2)}`).join(', ')}`
      : "This month's income by category: none logged yet",
    budgets.length
      ? `Budgets: ${budgets
          .map((b) => `${b.category} - ${b.spent.toFixed(2)} of ${b.monthlyLimit.toFixed(2)} (${b.percentUsed}% used)`)
          .join(', ')}`
      : 'Budgets: none set',
    goals.length
      ? `Savings goals: ${goals.map((g) => `${g.name} - ${g.currentAmount.toFixed(2)} of ${g.targetAmount.toFixed(2)}`).join(', ')}`
      : 'Savings goals: none set',
  ];

  return lines.join('\n');
};

/**
 * Fallback for whatever classifyIntent doesn't recognize. Sends the
 * question to Google's free Gemini API, but only alongside a snapshot of
 * the user's real data and an explicit instruction not to invent numbers -
 * if Gemini is unavailable (no key configured yet, rate-limited, network
 * error) this quietly falls back to the same static answerUnknown()
 * message as before, so a flaky free API can never break the assistant.
 */
const answerWithAI = async (userId, question) => {
  try {
    const snapshot = await buildDataSnapshot(userId);
    const prompt = `You are the AI Assistant inside SpendWise AI, a personal budgeting app. Answer the user's question using ONLY the data below - never invent or estimate a number that isn't given. If the data doesn't cover what they're asking, say so plainly instead of guessing. Keep the reply short (1-3 sentences), plain text, no markdown, friendly and direct.

User's data:
${snapshot}

Question: ${question}`;

    const reply = await askGemini(prompt);
    return reply;
  } catch (err) {
    console.error('Gemini fallback failed, using canned response:', err.message);
    return answerUnknown();
  }
};

/** POST /api/ai/ask */
const askAssistant = asyncHandler(async (req, res) => {
  const question = (req.body.question || '').trim();
  if (!question) {
    res.status(400);
    throw new Error('question is required.');
  }

  const intent = classifyIntent(question);
  const amount = extractAmount(question);
  const category = extractCategory(question);
  const userId = req.user._id;

  let answer;
  switch (intent) {
    case 'afford':
      answer = await answerAfford(userId, amount);
      break;
    case 'save_plan':
      answer = await answerSavePlan(userId, amount);
      break;
    case 'budget_status':
      answer = await answerBudgetStatus(userId, category);
      break;
    case 'goal_progress':
      answer = await answerGoalProgress(userId, question);
      break;
    case 'category_spend':
      answer = await answerCategorySpend(userId, category);
      break;
    case 'expense_change':
      answer = await answerExpenseChange(userId);
      break;
    case 'top_category':
      answer = await answerTopCategory(userId);
      break;
    case 'biggest_transaction':
      answer = await answerBiggestTransaction(userId, question);
      break;
    case 'transaction_count':
      answer = await answerTransactionCount(userId, question);
      break;
    case 'average_spend':
      answer = await answerAverageSpend(userId);
      break;
    case 'recurring_list':
      answer = await answerRecurring(userId);
      break;
    case 'savings_rate':
      answer = await answerSavingsRate(userId);
      break;
    case 'income_total':
      answer = await answerIncomeTotal(userId);
      break;
    case 'expense_total':
      answer = await answerExpenseTotal(userId);
      break;
    case 'balance':
      answer = await answerBalance(userId);
      break;
    case 'summary':
      answer = await answerSummary(userId);
      break;
    case 'greeting':
      answer = answerGreeting(question);
      break;
    default:
      answer = await answerWithAI(userId, question);
  }

  res.json({ question, intent, answer });
});

/** GET /api/ai/suggestions - example prompts for the UI to show as quick-start chips. */
const getSuggestions = asyncHandler(async (req, res) => {
  res.json({ suggestions: SUGGESTION_CHIPS });
});

/**
 * GET /api/ai/insight - one auto-generated insight for the Dashboard's quick
 * card, without the user having to ask anything. Just reuses the same
 * "summary" answer the assistant already gives for "how am I doing?".
 */
const getQuickInsight = asyncHandler(async (req, res) => {
  const insight = await answerSummary(req.user._id);
  res.json({ insight });
});

module.exports = {
  askAssistant,
  getSuggestions,
  getQuickInsight,
  // Exported in addition to the route handlers above purely so the routing
  // logic (which question maps to which intent/category) can be unit
  // tested directly, without needing a database.
  classifyIntent,
  extractCategory,
};