const User = require('../models/User');
const Booking = require('../models/Booking');
const Item = require('../models/Item');

/**
 * Sustainability Service — Tracks environmental impact of sharing
 */

// Carbon savings estimates per category (kg CO2 saved per borrow vs. buying new)
const CARBON_ESTIMATES = {
  Electronics: 25, Tools: 15, Sports: 10, Books: 5, Kitchen: 8,
  Garden: 12, Furniture: 30, Clothing: 8, Toys: 6, Music: 10,
  Photography: 20, Camping: 15, Automotive: 35, Office: 12, Other: 10
};

// Waste reduction estimates per category (kg waste avoided)
const WASTE_ESTIMATES = {
  Electronics: 3, Tools: 2, Sports: 1.5, Books: 0.5, Kitchen: 1,
  Garden: 2, Furniture: 15, Clothing: 1, Toys: 0.8, Music: 1.2,
  Photography: 2, Camping: 3, Automotive: 5, Office: 1.5, Other: 1
};

const updateSustainabilityMetrics = async (userId, item) => {
  try {
    const category = item.category || 'Other';
    const carbonSaved = CARBON_ESTIMATES[category] || 10;
    const wasteReduced = WASTE_ESTIMATES[category] || 1;

    await User.findByIdAndUpdate(userId, {
      $inc: {
        'sustainabilityMetrics.carbonSavedKg': carbonSaved,
        'sustainabilityMetrics.itemsReused': 1,
        'sustainabilityMetrics.wasteReducedKg': wasteReduced
      }
    });
  } catch (error) {
    console.error('Sustainability metrics update error:', error.message);
  }
};

const getPlatformStats = async () => {
  try {
    const users = await User.find({}, 'sustainabilityMetrics');

    const totalCarbon = users.reduce((sum, u) => sum + (u.sustainabilityMetrics?.carbonSavedKg || 0), 0);
    const totalWaste = users.reduce((sum, u) => sum + (u.sustainabilityMetrics?.wasteReducedKg || 0), 0);
    const totalReused = users.reduce((sum, u) => sum + (u.sustainabilityMetrics?.itemsReused || 0), 0);

    const completedBookings = await Booking.countDocuments({ status: 'Completed' });
    const totalItems = await Item.countDocuments({ status: 'Available' });
    const totalUsers = await User.countDocuments();

    return {
      carbonSavedKg: Math.round(totalCarbon * 10) / 10,
      wasteReducedKg: Math.round(totalWaste * 10) / 10,
      itemsReused: totalReused,
      completedBookings,
      totalItems,
      totalUsers,
      treesEquivalent: Math.round(totalCarbon / 21), // ~21kg CO2 per tree/year
      plasticBottlesEquivalent: Math.round(totalWaste / 0.025) // ~25g per bottle
    };
  } catch (error) {
    console.error('Platform stats error:', error.message);
    return {
      carbonSavedKg: 0, wasteReducedKg: 0, itemsReused: 0,
      completedBookings: 0, totalItems: 0, totalUsers: 0,
      treesEquivalent: 0, plasticBottlesEquivalent: 0
    };
  }
};

const getUserSustainability = async (userId) => {
  try {
    const user = await User.findById(userId, 'sustainabilityMetrics');
    if (!user) return null;

    const metrics = user.sustainabilityMetrics || {};
    return {
      carbonSavedKg: metrics.carbonSavedKg || 0,
      wasteReducedKg: metrics.wasteReducedKg || 0,
      itemsReused: metrics.itemsReused || 0,
      treesEquivalent: Math.round((metrics.carbonSavedKg || 0) / 21),
      plasticBottlesEquivalent: Math.round((metrics.wasteReducedKg || 0) / 0.025)
    };
  } catch (error) {
    console.error('User sustainability error:', error.message);
    return null;
  }
};

module.exports = {
  updateSustainabilityMetrics,
  getPlatformStats,
  getUserSustainability
};
