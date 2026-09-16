const mongoose = require('mongoose');

/**
 * One income or expense entry. `category` is a free string rather than
 * its own collection/model - a fixed, shared category list (defined on
 * the client in utils/constants.js) is simpler to build against and
 * covers the vast majority of personal expense tracking; a user-editable
 * category list is an easy upgrade later without changing this schema
 * (the string just becomes a reference to a Category doc's name).
 */
const transactionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['income', 'expense'], required: true },
    amount: { type: Number, required: true, min: [0.01, 'Amount must be greater than 0'] },
    category: { type: String, required: true, trim: true },
    note: { type: String, trim: true, default: '' },
    date: { type: Date, required: true, default: Date.now },

    // --- Recurring transactions ---
    // A transaction with isRecurring:true acts as a live "template": it's a
    // normal transaction in its own right (it has its own date/amount and
    // shows up in the list), but it also auto-generates a new transaction
    // each time `nextRunDate` arrives, using whatever amount/category/note
    // the template currently has. Auto-generated copies are plain
    // (non-recurring) transactions that carry `recurringSource` pointing
    // back to the template, purely so the UI can show an "auto" hint.
    isRecurring: { type: Boolean, default: false },
    recurrence: { type: String, enum: ['weekly', 'monthly', 'yearly'] },
    nextRunDate: { type: Date },
    endDate: { type: Date },
    recurringSource: { type: mongoose.Schema.Types.ObjectId, ref: 'Transaction' },

    // --- Receipt photo ---
    // Set after a successful upload to Cloudinary (see uploadMiddleware.js /
    // uploadReceipt controller). Storing the hosted URL (not the image
    // itself) keeps documents small and lets the browser load it directly
    // from Cloudinary's CDN.
    receiptUrl: { type: String, default: '' },
    receiptPublicId: { type: String, default: '' },
  },
  { timestamps: true }
);

// Every list/filter query is "this user's transactions, newest first" -
// a compound index makes that the fast path instead of a full scan.
transactionSchema.index({ user: 1, date: -1 });

// processDueRecurring looks up "this user's due recurring templates" -
// sparse because most transactions never set isRecurring at all.
transactionSchema.index(
  { user: 1, isRecurring: 1, nextRunDate: 1 },
  { partialFilterExpression: { isRecurring: true } }
);

module.exports = mongoose.model('Transaction', transactionSchema);