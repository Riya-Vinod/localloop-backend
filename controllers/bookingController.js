const Booking = require('../models/Booking');
const Item = require('../models/Item');
const User = require('../models/User');
const { updateTrustScore } = require('../services/aiService');
const { updateSustainabilityMetrics } = require('../services/sustainabilityService');

// POST /api/bookings
exports.createBooking = async (req, res) => {
  try {
    const { itemId, startDate, endDate, message } = req.body;

    const item = await Item.findById(itemId);
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (item.owner.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: 'You cannot book your own item' });
    }

    if (item.status !== 'Available') {
      return res.status(400).json({ success: false, message: 'Item is not available' });
    }

    // Check for overlapping bookings
    const hasOverlap = await Booking.checkOverlap(itemId, new Date(startDate), new Date(endDate));
    if (hasOverlap) {
      return res.status(400).json({ success: false, message: 'Booking dates overlap with an existing booking' });
    }

    const booking = await Booking.create({
      item: itemId,
      borrower: req.user._id,
      owner: item.owner,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      message: message || ''
    });

    await booking.populate([
      { path: 'item', select: 'title images category' },
      { path: 'borrower', select: 'name avatar' },
      { path: 'owner', select: 'name avatar' }
    ]);

    res.status(201).json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/bookings/:id/approve
exports.approveBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can approve bookings' });
    }

    if (booking.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Booking is not in pending state' });
    }

    booking.status = 'Approved';
    await booking.save();

    await booking.populate([
      { path: 'item', select: 'title images category' },
      { path: 'borrower', select: 'name avatar' },
      { path: 'owner', select: 'name avatar' }
    ]);

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/bookings/:id/reject
exports.rejectBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can reject bookings' });
    }

    if (booking.status !== 'Pending') {
      return res.status(400).json({ success: false, message: 'Booking is not in pending state' });
    }

    booking.status = 'Cancelled';
    booking.rejectionReason = req.body.reason || '';
    await booking.save();

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/bookings/:id/complete
exports.completeBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('item');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    if (booking.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Only the owner can complete bookings' });
    }

    if (booking.status !== 'Approved') {
      return res.status(400).json({ success: false, message: 'Booking must be approved before completing' });
    }

    booking.status = 'Completed';
    await booking.save();

    // Update stats for both users
    await User.findByIdAndUpdate(booking.owner, {
      $inc: { totalLendings: 1, successfulTransactions: 1 }
    });
    await User.findByIdAndUpdate(booking.borrower, {
      $inc: { totalBorrowings: 1, successfulTransactions: 1 }
    });

    // Update item booking count
    await Item.findByIdAndUpdate(booking.item._id, {
      $inc: { totalBookings: 1 }
    });

    // Update trust scores via AI service
    await updateTrustScore(booking.owner);
    await updateTrustScore(booking.borrower);

    // Update sustainability metrics
    await updateSustainabilityMetrics(booking.owner, booking.item);
    await updateSustainabilityMetrics(booking.borrower, booking.item);

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// PUT /api/bookings/:id/cancel
exports.cancelBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isOwner = booking.owner.toString() === req.user._id.toString();
    const isBorrower = booking.borrower.toString() === req.user._id.toString();

    if (!isOwner && !isBorrower) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.status === 'Completed' || booking.status === 'Cancelled') {
      return res.status(400).json({ success: false, message: 'Cannot cancel this booking' });
    }

    booking.status = 'Cancelled';
    await booking.save();

    // Update cancellation count
    const canceller = isOwner ? booking.owner : booking.borrower;
    await User.findByIdAndUpdate(canceller, { $inc: { cancelledTransactions: 1 } });
    await updateTrustScore(canceller);

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bookings/my
exports.getMyBookings = async (req, res) => {
  try {
    const { type = 'all', status } = req.query;
    let query = {};

    if (type === 'borrowing') {
      query.borrower = req.user._id;
    } else if (type === 'lending') {
      query.owner = req.user._id;
    } else {
      query.$or = [{ borrower: req.user._id }, { owner: req.user._id }];
    }

    if (status) query.status = status;

    const bookings = await Booking.find(query)
      .populate('item', 'title images category estimatedValue')
      .populate('borrower', 'name avatar trustScore')
      .populate('owner', 'name avatar trustScore')
      .sort({ createdAt: -1 });

    res.json({ success: true, bookings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// GET /api/bookings/:id
exports.getBooking = async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id)
      .populate('item')
      .populate('borrower', 'name avatar trustScore email')
      .populate('owner', 'name avatar trustScore email');

    if (!booking) {
      return res.status(404).json({ success: false, message: 'Booking not found' });
    }

    const isOwner = booking.owner._id.toString() === req.user._id.toString();
    const isBorrower = booking.borrower._id.toString() === req.user._id.toString();

    if (!isOwner && !isBorrower) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    res.json({ success: true, booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
