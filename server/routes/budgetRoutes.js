const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getBudgets, setBudget, deleteBudget, getBudgetStreak } = require('../controllers/budgetController');

const router = express.Router();

router.use(protect); // every route below requires a logged-in user

router.route('/').get(getBudgets).post(setBudget);
router.get('/streak', getBudgetStreak); // before /:id so "streak" is never read as an id
router.route('/:id').delete(deleteBudget);

module.exports = router;