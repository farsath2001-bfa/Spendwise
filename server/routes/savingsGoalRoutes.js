const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getGoals,
  createGoal,
  updateGoal,
  contributeToGoal,
  deleteGoal,
} = require('../controllers/savingsGoalController');

const router = express.Router();

router.use(protect); // every route below requires a logged-in user

router.route('/').get(getGoals).post(createGoal);
router.route('/:id').put(updateGoal).delete(deleteGoal);
router.route('/:id/contribute').post(contributeToGoal);

module.exports = router;