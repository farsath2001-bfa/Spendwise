const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const { askAssistant, getSuggestions, getQuickInsight } = require('../controllers/aiController');

const router = express.Router();

router.use(protect); // every route below requires a logged-in user

router.post('/ask', askAssistant);
router.get('/suggestions', getSuggestions);
router.get('/insight', getQuickInsight);

module.exports = router;