const express = require('express');
const router = express.Router();
const {
  createBooking, approveBooking, rejectBooking,
  completeBooking, cancelBooking, getMyBookings, getBooking
} = require('../controllers/bookingController');
const { protect } = require('../middleware/auth');

router.post('/', protect, createBooking);
router.get('/my', protect, getMyBookings);
router.get('/:id', protect, getBooking);
router.put('/:id/approve', protect, approveBooking);
router.put('/:id/reject', protect, rejectBooking);
router.put('/:id/complete', protect, completeBooking);
router.put('/:id/cancel', protect, cancelBooking);

module.exports = router;
