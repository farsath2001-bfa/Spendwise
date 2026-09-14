const Transaction = require('../models/Transaction');

const VALID_RECURRENCES = ['weekly', 'monthly', 'yearly'];

// Safety cap: if a template's nextRunDate somehow falls years behind (an
// account left untouched for a long time), stop catching up after this many
// occurrences in one pass rather than generating an unbounded backlog.
const MAX_CATCHUP = 36;

/** Returns a new Date advanced by one recurrence interval from `date`. */
const addInterval = (date, recurrence) => {
  const d = new Date(date);
  switch (recurrence) {
    case 'weekly':
      d.setDate(d.getDate() + 7);
      break;
    case 'monthly':
      d.setMonth(d.getMonth() + 1);
      break;
    case 'yearly':
      d.setFullYear(d.getFullYear() + 1);
      break;
    default:
      throw new Error(`Unknown recurrence: ${recurrence}`);
  }
  return d;
};

/**
 * Pure function (no DB access) so it's easy to unit test in isolation.
 * Given a recurring template's current schedule and "now", returns every
 * occurrence date that is due, the nextRunDate to save afterwards, and
 * whether the template should keep recurring (false once it has passed
 * its endDate).
 */
const computeDueOccurrences = ({ nextRunDate, recurrence, endDate }, now = new Date()) => {
  const occurrences = [];
  let cursor = new Date(nextRunDate);
  let active = true;
  const end = endDate ? new Date(endDate) : null;

  while (cursor <= now && occurrences.length < MAX_CATCHUP) {
    if (end && cursor > end) {
      active = false;
      break;
    }
    occurrences.push(new Date(cursor));
    cursor = addInterval(cursor, recurrence);
  }

  if (end && cursor > end) active = false;

  return { occurrences, nextRunDate: cursor, active };
};

/**
 * Finds every due recurring template for this user, materializes the
 * transactions it owes (one per missed interval, capped at MAX_CATCHUP each),
 * and advances each template's schedule. Safe to call often - it's a no-op
 * when nothing is due, thanks to the partial index on isRecurring+nextRunDate.
 */
const processDueRecurring = async (userId) => {
  const now = new Date();
  const templates = await Transaction.find({
    user: userId,
    isRecurring: true,
    nextRunDate: { $lte: now },
  });
  if (templates.length === 0) return;

  const toInsert = [];
  const bulkOps = [];

  for (const t of templates) {
    const { occurrences, nextRunDate, active } = computeDueOccurrences(
      { nextRunDate: t.nextRunDate, recurrence: t.recurrence, endDate: t.endDate },
      now
    );

    for (const occDate of occurrences) {
      toInsert.push({
        user: userId,
        type: t.type,
        amount: t.amount,
        category: t.category,
        note: t.note,
        date: occDate,
        isRecurring: false,
        recurringSource: t._id,
      });
    }

    bulkOps.push({
      updateOne: {
        filter: { _id: t._id },
        update: { $set: { nextRunDate, isRecurring: active } },
      },
    });
  }

  if (toInsert.length > 0) await Transaction.insertMany(toInsert);
  if (bulkOps.length > 0) await Transaction.bulkWrite(bulkOps);
};

module.exports = { VALID_RECURRENCES, addInterval, computeDueOccurrences, processDueRecurring };