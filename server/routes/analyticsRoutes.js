const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { getSummary } = require('../controllers/analyticsController');

const router = express.Router();

router.use(protect); // every route below requires a logged-in user

router.get('/summary', getSummary);

module.exports = router;