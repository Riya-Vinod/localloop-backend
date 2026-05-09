const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const { getPlatformStats, getUserSustainability } = require('../services/sustainabilityService');

// GET /api/sustainability/platform
router.get('/platform', async (req, res) => {
  try {
    const stats = await getPlatformStats();
    res.json({ success: true, stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/sustainability/me
router.get('/me', protect, async (req, res) => {
  try {
    const metrics = await getUserSustainability(req.user._id);
    res.json({ success: true, metrics });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
