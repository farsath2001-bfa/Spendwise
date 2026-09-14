const mongoose = require('mongoose');

/**
 * A named savings target (e.g. "Emergency Fund", "New Laptop").
 * currentAmount is tracked directly on the goal rather than derived from
 * transactions - contributions toward a goal are a separate action from
 * income/expense tracking, so the two are kept independent on purpose.
 */
const savingsGoalSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true },
    targetAmount: { type: Number, required: true, min: [0.01, 'Target must be greater than 0'] },
    currentAmount: { type: Number, default: 0, min: [0, 'Amount saved cannot be negative'] },
    targetDate: { type: Date },
  },
  { timestamps: true }
);

savingsGoalSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('SavingsGoal', savingsGoalSchema);