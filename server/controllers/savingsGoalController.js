const asyncHandler = require('express-async-handler');
const SavingsGoal = require('../models/SavingsGoal');

const validateBody = ({ name, targetAmount, targetDate }) => {
  if (!name || !name.trim()) {
    return 'name is required.';
  }
  if (
    targetAmount === undefined ||
    targetAmount === null ||
    Number.isNaN(Number(targetAmount)) ||
    Number(targetAmount) <= 0
  ) {
    return 'targetAmount must be a positive number.';
  }
  if (targetDate && Number.isNaN(new Date(targetDate).getTime())) {
    return 'targetDate is invalid.';
  }
  return null;
};

const shapeGoal = (goal) => {
  const obj = goal.toObject ? goal.toObject() : goal;
  const percent = Math.min(Math.round((obj.currentAmount / obj.targetAmount) * 100), 999);
  return { ...obj, percent, reached: obj.currentAmount >= obj.targetAmount };
};

/** GET /api/goals */
const getGoals = asyncHandler(async (req, res) => {
  const goals = await SavingsGoal.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(goals.map(shapeGoal));
});

/** POST /api/goals */
const createGoal = asyncHandler(async (req, res) => {
  const error = validateBody(req.body);
  if (error) {
    res.status(400);
    throw new Error(error);
  }

  const goal = await SavingsGoal.create({
    user: req.user._id,
    name: req.body.name.trim(),
    targetAmount: Number(req.body.targetAmount),
    currentAmount: req.body.currentAmount ? Math.max(Number(req.body.currentAmount), 0) : 0,
    targetDate: req.body.targetDate ? new Date(req.body.targetDate) : undefined,
  });

  res.status(201).json(shapeGoal(goal));
});

/** PUT /api/goals/:id - edits the goal's name/target/date. */
const updateGoal = asyncHandler(async (req, res) => {
  const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user._id });
  if (!goal) {
    res.status(404);
    throw new Error('Savings goal not found.');
  }

  const merged = { ...goal.toObject(), ...req.body };
  const error = validateBody(merged);
  if (error) {
    res.status(400);
    throw new Error(error);
  }

  if (req.body.name !== undefined) goal.name = req.body.name.trim();
  if (req.body.targetAmount !== undefined) goal.targetAmount = Number(req.body.targetAmount);
  if (req.body.targetDate !== undefined) {
    goal.targetDate = req.body.targetDate ? new Date(req.body.targetDate) : undefined;
  }

  const updated = await goal.save();
  res.json(shapeGoal(updated));
});

/** POST /api/goals/:id/contribute - add money toward a goal. */
const contributeToGoal = asyncHandler(async (req, res) => {
  const amount = Number(req.body.amount);
  if (!amount || Number.isNaN(amount) || amount <= 0) {
    res.status(400);
    throw new Error('amount must be a positive number.');
  }

  const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user._id });
  if (!goal) {
    res.status(404);
    throw new Error('Savings goal not found.');
  }

  goal.currentAmount += amount;
  const updated = await goal.save();
  res.json(shapeGoal(updated));
});

/** DELETE /api/goals/:id */
const deleteGoal = asyncHandler(async (req, res) => {
  const goal = await SavingsGoal.findOne({ _id: req.params.id, user: req.user._id });
  if (!goal) {
    res.status(404);
    throw new Error('Savings goal not found.');
  }
  await goal.deleteOne();
  res.json({ message: 'Savings goal deleted.' });
});

module.exports = { getGoals, createGoal, updateGoal, contributeToGoal, deleteGoal };