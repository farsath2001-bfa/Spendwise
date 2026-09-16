const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const upload = require('../middleware/uploadMiddleware');
const {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  uploadReceipt,
  deleteReceipt,
} = require('../controllers/transactionController');

const router = express.Router();

router.use(protect); // every route below requires a logged-in user

router.route('/').get(getTransactions).post(createTransaction);
router.route('/:id').get(getTransaction).put(updateTransaction).delete(deleteTransaction);

// upload.single('receipt') runs first - if the file is missing, too large,
// or not an image, it calls next(err) before uploadReceipt ever runs.
// Wrapping it here turns that into a clean 400 instead of falling through
// to the generic 500 the app-level error handler would otherwise give it.
const handleUpload = (req, res, next) => {
  upload.single('receipt')(req, res, (err) => {
    if (err) {
      res.status(400);
      return next(err);
    }
    next();
  });
};

router.route('/:id/receipt').post(handleUpload, uploadReceipt).delete(deleteReceipt);

module.exports = router;