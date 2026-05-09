const Fuse = require('fuse.js');
const Item = require('../models/Item');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Review = require('../models/Review');

/**
 * AI Service — Lightweight Recommendation Engine, Trust Score, and Smart Search
 */

// ═══════════════════════════════════════════════════════
// 1. TRUST SCORE PREDICTION
// ═══════════════════════════════════════════════════════
const updateTrustScore = async (userId) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Get user reviews
    const reviews = await Review.find({ reviewee: userId });
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 3;

    // Calculate components
    const totalTransactions = user.successfulTransactions + user.cancelledTransactions;
    const successRate = totalTransactions > 0
      ? user.successfulTransactions / totalTransactions
      : 0.5;

    const profileCompleteness = calculateProfileCompleteness(user);

    // Weighted trust score formula
    // Rating weight: 40%, Success rate: 30%, Profile: 15%, Activity: 15%
    const ratingScore = (avgRating / 5) * 40;
    const successScore = successRate * 30;
    const profileScore = profileCompleteness * 15;
    const activityScore = Math.min(totalTransactions / 20, 1) * 15; // Cap at 20 transactions

    const trustScore = Math.round(ratingScore + successScore + profileScore + activityScore);

    await User.findByIdAndUpdate(userId, { trustScore: Math.min(100, Math.max(0, trustScore)) });

    return trustScore;
  } catch (error) {
    console.error('Trust score update error:', error.message);
  }
};

const calculateProfileCompleteness = (user) => {
  let score = 0;
  if (user.name) score += 0.2;
  if (user.email) score += 0.2;
  if (user.avatar) score += 0.2;
  if (user.bio) score += 0.2;
  if (user.location && user.location.coordinates[0] !== 0) score += 0.2;
  return score;
};

// ═══════════════════════════════════════════════════════
// 2. SMART RECOMMENDATION ENGINE
// ═══════════════════════════════════════════════════════
const getRecommendations = async (userId, userLng, userLat) => {
  try {
    const user = await User.findById(userId);
    if (!user) return [];

    // Get user's booking history for category preferences
    const userBookings = await Booking.find({
      borrower: userId,
      status: { $in: ['Completed', 'Approved'] }
    }).populate('item', 'category');

    // Build category preference map
    const categoryPreferences = {};
    userBookings.forEach(b => {
      if (b.item && b.item.category) {
        categoryPreferences[b.item.category] = (categoryPreferences[b.item.category] || 0) + 1;
      }
    });

    // Add search history preferences
    if (user.searchHistory && user.searchHistory.length > 0) {
      const recentSearches = user.searchHistory.slice(-20);
      recentSearches.forEach(s => {
        if (s.category) {
          categoryPreferences[s.category] = (categoryPreferences[s.category] || 0) + 0.5;
        }
      });
    }

    // Get nearby available items
    const lng = userLng || (user.location ? user.location.coordinates[0] : 0);
    const lat = userLat || (user.location ? user.location.coordinates[1] : 0);

    let nearbyItems = [];

    if (lng !== 0 || lat !== 0) {
      nearbyItems = await Item.find({
        status: 'Available',
        owner: { $ne: userId },
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: 10000 // 10km
          }
        }
      })
        .populate('owner', 'name avatar trustScore')
        .limit(50);
    } else {
      nearbyItems = await Item.find({
        status: 'Available',
        owner: { $ne: userId }
      })
        .populate('owner', 'name avatar trustScore')
        .sort({ createdAt: -1 })
        .limit(50);
    }

    // Score and rank items
    const scoredItems = nearbyItems.map(item => {
      let score = 0;

      // Category preference score (0-40)
      const catPref = categoryPreferences[item.category] || 0;
      score += Math.min(catPref * 10, 40);

      // Owner trust score (0-20)
      if (item.owner && item.owner.trustScore) {
        score += (item.owner.trustScore / 100) * 20;
      }

      // Item popularity (0-20)
      score += Math.min(item.totalBookings * 2, 20);

      // Rating bonus (0-10)
      score += (item.averageRating / 5) * 10;

      // Recency bonus (0-10)
      const daysSinceCreated = (Date.now() - new Date(item.createdAt)) / (1000 * 60 * 60 * 24);
      score += Math.max(10 - daysSinceCreated, 0);

      return {
        item,
        score: Math.round(score * 10) / 10,
        reason: catPref > 0
          ? `Based on your interest in ${item.category}`
          : item.totalBookings > 3
            ? 'Popular in your area'
            : 'Recently listed nearby'
      };
    });

    // Sort by score descending
    scoredItems.sort((a, b) => b.score - a.score);

    return scoredItems.slice(0, 12);
  } catch (error) {
    console.error('Recommendation error:', error.message);
    return [];
  }
};

// ═══════════════════════════════════════════════════════
// 3. SMART SEARCH WITH FUZZY MATCHING
// ═══════════════════════════════════════════════════════
const smartSearch = async (query, userLng, userLat, category) => {
  try {
    // Get candidate items
    const filter = { status: 'Available' };
    if (category) filter.category = category;

    let items;
    if (userLng && userLat && (parseFloat(userLng) !== 0 || parseFloat(userLat) !== 0)) {
      items = await Item.find({
        ...filter,
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: [parseFloat(userLng), parseFloat(userLat)] },
            $maxDistance: 15000
          }
        }
      })
        .populate('owner', 'name avatar trustScore')
        .limit(100);
    } else {
      items = await Item.find(filter)
        .populate('owner', 'name avatar trustScore')
        .limit(100);
    }

    if (!query || query.trim() === '') {
      return items.slice(0, 20);
    }

    // Fuse.js fuzzy search for typo tolerance
    const fuse = new Fuse(items, {
      keys: [
        { name: 'title', weight: 0.4 },
        { name: 'description', weight: 0.3 },
        { name: 'category', weight: 0.2 },
        { name: 'tags', weight: 0.1 }
      ],
      threshold: 0.4, // 0 = exact, 1 = match anything
      includeScore: true,
      minMatchCharLength: 2
    });

    const results = fuse.search(query);

    return results.map(r => ({
      ...r.item.toObject(),
      searchScore: Math.round((1 - r.score) * 100) // Convert to 0-100 relevance
    }));
  } catch (error) {
    console.error('Smart search error:', error.message);
    return [];
  }
};

// ═══════════════════════════════════════════════════════
// 4. AUTO-SUGGESTIONS
// ═══════════════════════════════════════════════════════
const getAutoSuggestions = async (query) => {
  try {
    if (!query || query.length < 2) return [];

    const items = await Item.find({
      status: 'Available',
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ]
    })
      .select('title category')
      .limit(8);

    const suggestions = [...new Set(items.map(i => i.title))];
    const categories = [...new Set(items.map(i => i.category))];

    return { suggestions, categories };
  } catch (error) {
    console.error('Auto-suggestion error:', error.message);
    return { suggestions: [], categories: [] };
  }
};

// ═══════════════════════════════════════════════════════
// 5. AI DESCRIPTION GENERATOR (Simulated)
// ═══════════════════════════════════════════════════════
const generateDescription = (title, category, condition) => {
  const templates = {
    Electronics: `This ${condition.toLowerCase()} ${title.toLowerCase()} is perfect for anyone in need of reliable electronics. Well-maintained and ready to use, this item saves you from buying new while reducing electronic waste. Available for borrowing in your neighborhood.`,
    Tools: `Need a ${title.toLowerCase()}? This ${condition.toLowerCase()} tool is available for lending. Perfect for DIY projects, home repairs, or one-time tasks. Save money and reduce waste by borrowing instead of buying.`,
    Sports: `Get active with this ${condition.toLowerCase()} ${title.toLowerCase()}! Available for borrowing locally — perfect for trying a new sport or for occasional use. Why buy when you can borrow from your neighbors?`,
    Books: `Discover this ${condition.toLowerCase()} copy of ${title}. Available for borrowing from a fellow reader in your area. Sharing books builds community and reduces paper waste.`,
    Kitchen: `This ${condition.toLowerCase()} ${title.toLowerCase()} is ready for your next cooking adventure. Perfect for special occasions or trying out new recipes without the commitment of purchasing.`,
    default: `This ${condition.toLowerCase()} ${title.toLowerCase()} is available for borrowing in your neighborhood. By sharing instead of buying new, we reduce waste and build stronger communities. Currently in ${condition.toLowerCase()} condition and ready for use.`
  };

  return templates[category] || templates.default;
};

module.exports = {
  updateTrustScore,
  getRecommendations,
  smartSearch,
  getAutoSuggestions,
  generateDescription
};
