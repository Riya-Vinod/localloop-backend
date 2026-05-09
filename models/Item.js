const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Title is required'],
    trim: true,
    maxlength: 100
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    maxlength: 1000
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    enum: [
      'Electronics', 'Tools', 'Sports', 'Books', 'Kitchen',
      'Garden', 'Furniture', 'Clothing', 'Toys', 'Music',
      'Photography', 'Camping', 'Automotive', 'Office', 'Other'
    ]
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    },
    address: {
      type: String,
      default: ''
    }
  },
  images: [{
    type: String // URLs
  }],
  condition: {
    type: String,
    enum: ['New', 'Like New', 'Good', 'Fair', 'Worn'],
    default: 'Good'
  },
  status: {
    type: String,
    enum: ['Available', 'Booked', 'Hidden'],
    default: 'Available'
  },
  estimatedValue: {
    type: Number,
    default: 0
  },
  carbonFootprint: {
    type: Number,
    default: 0 // kg CO2 saved per borrow
  },
  totalBookings: {
    type: Number,
    default: 0
  },
  averageRating: {
    type: Number,
    default: 0
  },
  tags: [{
    type: String,
    lowercase: true
  }]
}, {
  timestamps: true
});

// GeoJSON 2dsphere index for geospatial queries
itemSchema.index({ location: '2dsphere' });
itemSchema.index({ category: 1, status: 1 });
itemSchema.index({ owner: 1 });
itemSchema.index({ title: 'text', description: 'text', tags: 'text' });

module.exports = mongoose.model('Item', itemSchema);
