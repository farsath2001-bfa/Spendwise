const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getBudgets, setBudget, deleteBudget } = require('../controllers/budgetController');

const router = express.Router();

router.use(protect); // every route below requires a logged-in user

router.route('/').get(getBudgets).post(setBudget);
router.route('/:id').delete(deleteBudget);

module.exports = router;