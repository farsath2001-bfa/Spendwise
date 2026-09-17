const { Readable } = require('stream');
const asyncHandler = require('express-async-handler');
const Transaction = require('../models/Transaction');
const cloudinary = require('../utils/cloudinary');
const { VALID_RECURRENCES, addInterval, processDueRecurring } = require('../utils/recurring');

const VALID_TYPES = ['income', 'expense'];

const validateBody = ({ type, amount, category, date, isRecurring, recurrence, endDate }) => {
  if (!type || !VALID_TYPES.includes(type)) {
    return 'type must be "income" or "expense".';
  }
  if (amount === undefined || amount === null || Number.isNaN(Number(amount)) || Number(amount) <= 0) {
    return 'amount must be a positive number.';
  }
  if (!category || !category.trim()) {
    return 'category is required.';
  }
  if (date && Number.isNaN(new Date(date).getTime())) {
    return 'date is invalid.';
  }
  if (isRecurring) {
    if (!recurrence || !VALID_RECURRENCES.includes(recurrence)) {
      return 'recurrence must be "weekly", "monthly", or "yearly" when isRecurring is set.';
    }
    if (endDate && Number.isNaN(new Date(endDate).getTime())) {
      return 'endDate is invalid.';
    }
  }
  return null;
};

/** Escapes regex special characters so free-text search can't break or abuse the pattern. */
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * GET /api/transactions
 * Optional query params: type, category, from, to (ISO dates), search, limit, page.
 * `search` does a case-insensitive match against category and note - a
 * lightweight text search without needing a separate search index.
 * Every query is scoped to req.user._id - users only ever see their own data.
 */
const getTransactions = asyncHandler(async (req, res) => {
  // Cheap no-op when nothing is due (partial index keeps the lookup fast) -
  // materializes any recurring transactions the user is now owed before
  // we read the list back, so they show up without needing a background job.
  await processDueRecurring(req.user._id);

  const { type, category, from, to, search } = req.query;
  const filter = { user: req.user._id };

  if (type && VALID_TYPES.includes(type)) filter.type = type;
  if (category) filter.category = category;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lte = new Date(to);
  }
  if (search && search.trim()) {
    const regex = new RegExp(escapeRegex(search.trim()), 'i');
    filter.$or = [{ category: regex }, { note: regex }];
  }

  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const page = Math.max(Number(req.query.page) || 1, 1);

  const [transactions, total] = await Promise.all([
    Transaction.find(filter)
      .sort({ date: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Transaction.countDocuments(filter),
  ]);

  res.json({ transactions, total, page, pages: Math.ceil(total / limit) || 1 });
});

/** GET /api/transactions/:id */
const getTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found.');
  }
  res.json(transaction);
});

/** POST /api/transactions */
const createTransaction = asyncHandler(async (req, res) => {
  const error = validateBody(req.body);
  if (error) {
    res.status(400);
    throw new Error(error);
  }

  const isRecurring = !!req.body.isRecurring;
  const date = req.body.date ? new Date(req.body.date) : new Date();

  const transaction = await Transaction.create({
    user: req.user._id,
    type: req.body.type,
    amount: Number(req.body.amount),
    category: req.body.category.trim(),
    note: (req.body.note || '').trim(),
    date,
    isRecurring,
    recurrence: isRecurring ? req.body.recurrence : undefined,
    nextRunDate: isRecurring ? addInterval(date, req.body.recurrence) : undefined,
    endDate: isRecurring && req.body.endDate ? new Date(req.body.endDate) : undefined,
  });

  res.status(201).json(transaction);
});

/** PUT /api/transactions/:id */
const updateTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found.');
  }

  const merged = { ...transaction.toObject(), ...req.body };
  const error = validateBody(merged);
  if (error) {
    res.status(400);
    throw new Error(error);
  }

  const wasRecurring = transaction.isRecurring;
  const recurrenceChanged = req.body.recurrence !== undefined && req.body.recurrence !== transaction.recurrence;

  if (req.body.type !== undefined) transaction.type = req.body.type;
  if (req.body.amount !== undefined) transaction.amount = Number(req.body.amount);
  if (req.body.category !== undefined) transaction.category = req.body.category.trim();
  if (req.body.note !== undefined) transaction.note = req.body.note.trim();
  if (req.body.date !== undefined) transaction.date = new Date(req.body.date);
  if (req.body.isRecurring !== undefined) transaction.isRecurring = !!req.body.isRecurring;
  if (req.body.recurrence !== undefined) transaction.recurrence = req.body.recurrence;
  if (req.body.endDate !== undefined) {
    transaction.endDate = req.body.endDate ? new Date(req.body.endDate) : undefined;
  }

  if (transaction.isRecurring) {
    // Only reschedule when recurring was just turned on, or the interval
    // itself changed - editing the amount/note/category on an already-active
    // template must not push its next auto-generation date out.
    if (!wasRecurring || recurrenceChanged) {
      transaction.nextRunDate = addInterval(transaction.date, transaction.recurrence);
    }
  } else {
    transaction.recurrence = undefined;
    transaction.nextRunDate = undefined;
    transaction.endDate = undefined;
  }

  const updated = await transaction.save();
  res.json(updated);
});

/** DELETE /api/transactions/:id */
const deleteTransaction = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found.');
  }
  await transaction.deleteOne();
  res.json({ message: 'Transaction deleted.' });
});

/** Uploads a buffer to Cloudinary without writing it to disk first. */
const streamToCloudinary = (buffer) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: 'spendwise-receipts', resource_type: 'image' },
      (error, result) => (result ? resolve(result) : reject(error))
    );
    Readable.from(buffer).pipe(uploadStream);
  });

/**
 * POST /api/transactions/:id/receipt
 * Expects a single-file multipart upload under the field name "receipt"
 * (see uploadMiddleware.js). Replaces any receipt already on the
 * transaction, deleting the old Cloudinary image so nothing orphaned piles
 * up against the free-tier storage quota.
 */
const uploadReceipt = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found.');
  }
  if (!req.file) {
    res.status(400);
    throw new Error('No image file was uploaded.');
  }

  let result;
  try {
    result = await streamToCloudinary(req.file.buffer);
  } catch (err) {
    // Logged server-side (never sent to the client) so a misconfigured or
    // missing CLOUDINARY_* env var shows up clearly in the Render logs
    // instead of just a bare "502" with no way to tell why.
    console.error('Cloudinary receipt upload failed:', err?.message || err);
    res.status(502);
    throw new Error('Could not upload the image. Please try again.');
  }

  const oldPublicId = transaction.receiptPublicId;

  transaction.receiptUrl = result.secure_url;
  transaction.receiptPublicId = result.public_id;
  await transaction.save();

  if (oldPublicId) {
    cloudinary.uploader.destroy(oldPublicId).catch(() => {});
  }

  res.json(transaction);
});

/** DELETE /api/transactions/:id/receipt */
const deleteReceipt = asyncHandler(async (req, res) => {
  const transaction = await Transaction.findOne({ _id: req.params.id, user: req.user._id });
  if (!transaction) {
    res.status(404);
    throw new Error('Transaction not found.');
  }

  const oldPublicId = transaction.receiptPublicId;
  transaction.receiptUrl = '';
  transaction.receiptPublicId = '';
  await transaction.save();

  if (oldPublicId) {
    cloudinary.uploader.destroy(oldPublicId).catch(() => {});
  }

  res.json(transaction);
});

module.exports = {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  uploadReceipt,
  deleteReceipt,
};