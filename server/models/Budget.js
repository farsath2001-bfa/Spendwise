const mongoose = require('mongoose');

/**
 * A monthly spending limit for one category. Budgets are ongoing (not
 * re-created every month) - the "spent so far" amount is computed on the
 * fly in the controller by summing this month's expense transactions in
 * that category, so the limit itself just carries forward month to month
 * until the user changes it.
 */
const budgetSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    category: { type: String, required: true, trim: true },
    monthlyLimit: { type: Number, required: true, min: [0.01, 'Limit must be greater than 0'] },
  },
  { timestamps: true }
);

// One budget per category per user - creating a second one for the same
// category updates the existing limit instead (see controller upsert).
budgetSchema.index({ user: 1, category: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);