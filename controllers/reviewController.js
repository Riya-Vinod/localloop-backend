const Review = require('../models/Review');
const Booking = require('../models/Booking');
const Item = require('../models/Item');
const { updateTrustScore } = require('../services/aiService');

// POST /api/reviews
exports.createReview = async (req, res) => {
  try {
    const { bookingId, rating, comment } = req.body;

    const booking = await Booking.findById(bookingId).populate('item');
    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    // Only completed bookings can be reviewed
    if (booking.status !== 'Completed') {
      return res.status(400).json({ success: false, message: 'Can only review completed bookings' });
    }

    // Check if user is part of the booking
    const isBorrower = booking.borrower.toString() === req.user._id.toString();
    const isOwner = booking.owner.toString() === req.user._id.toString();

    if (!isBorrower && !isOwner) {
      return res.status(403).json({ success: false, message: 'Not authorized to review this booking' });
    }

    // Check if already reviewed
    const existingReview = await Review.findOne({ booking: bookingId, reviewer: req.user._id });
    if (existingReview) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this booking' });
    }

    // Reviewer reviews the other party
    const reviewee = isBorrower ? booking.owner : booking.borrower;

    const review = await Review.create({
      booking: bookingId,
      item: booking.item._id,
      reviewer: req.user._id,
      reviewee,
      rating,
      comment: comment || ''
    });

    // Update item average rating
    const itemReviews = await Review.find({ item: booking.item._id });
    const avgRating = itemReviews.reduce((sum, r) => sum + r.rating, 0) / itemReviews.length;
    await Item.findByIdAndUpdate(booking.item._id, { averageRating: Math.round(avgRating * 10) / 10 });

    // Update trust score for reviewee
    await updateTrustScore(reviewee);

    await review.populate([
      { path: 'reviewer', select: 'name avatar' },
      { path: 'reviewee', select: 'name avatar' },
      { path: 'item', select: 'title' }
    ]);

    res.status(201).json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reviews/item/:itemId
exports.getItemReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ item: req.params.itemId })
      .populate('reviewer', 'name avatar')
      .sort({ createdAt: -1 });

    res.json({ success: true, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/reviews/user/:userId
exports.getUserReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ reviewee: req.params.userId })
      .populate('reviewer', 'name avatar')
      .populate('item', 'title images')
      .sort({ createdAt: -1 });

    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;

    res.json({
      success: true,
      reviews,
      averageRating: Math.round(avgRating * 10) / 10,
      totalReviews: reviews.length
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
