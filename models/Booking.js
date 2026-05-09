const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Item',
    required: true
  },
  borrower: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Completed', 'Cancelled'],
    default: 'Pending'
  },
  message: {
    type: String,
    maxlength: 500,
    default: ''
  },
  rejectionReason: {
    type: String,
    default: ''
  }
}, {
  timestamps: true
});

bookingSchema.index({ item: 1, status: 1 });
bookingSchema.index({ borrower: 1 });
bookingSchema.index({ owner: 1 });

// Validate no overlapping approved bookings for the same item
bookingSchema.statics.checkOverlap = async function (itemId, startDate, endDate, excludeBookingId = null) {
  const query = {
    item: itemId,
    status: { $in: ['Pending', 'Approved'] },
    $or: [
      { startDate: { $lte: endDate }, endDate: { $gte: startDate } }
    ]
  };
  if (excludeBookingId) {
    query._id = { $ne: excludeBookingId };
  }
  const overlap = await this.findOne(query);
  return !!overlap;
};

module.exports = mongoose.model('Booking', bookingSchema);
