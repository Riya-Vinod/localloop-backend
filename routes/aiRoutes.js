const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getRecommendations, smartSearch, getAutoSuggestions, generateDescription } = require('../services/aiService');
const User = require('../models/User');

// GET /api/ai/recommendations
router.get('/recommendations', protect, async (req, res) => {
  try {
    const { lng, lat } = req.query;
    const recommendations = await getRecommendations(req.user._id, parseFloat(lng), parseFloat(lat));
    res.json({ success: true, recommendations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/ai/search
router.get('/search', async (req, res) => {
  try {
    const { q, lng, lat, category } = req.query;
    const results = await smartSearch(q, lng, lat, category);
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/ai/suggestions
router.get('/suggestions', async (req, res) => {
  try {
    const { q } = req.query;
    const data = await getAutoSuggestions(q);
    res.json({ success: true, ...data });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/ai/generate-description
router.post('/generate-description', protect, (req, res) => {
  try {
    const { title, category, condition } = req.body;
    if (!title || !category) {
      return res.status(400).json({ success: false, message: 'Title and category are required' });
    }
    const description = generateDescription(title, category, condition || 'Good');
    res.json({ success: true, description });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/ai/track-search
router.post('/track-search', protect, async (req, res) => {
  try {
    const { query, category } = req.body;
    await User.findByIdAndUpdate(req.user._id, {
      $push: {
        searchHistory: {
          $each: [{ query, category, timestamp: new Date() }],
          $slice: -50 // Keep last 50 searches
        }
      }
    });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
