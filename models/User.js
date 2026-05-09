const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    maxlength: 50
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  avatar: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: '',
    maxlength: 300
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0]
    },
    address: {
      type: String,
      default: ''
    }
  },
  trustScore: {
    type: Number,
    default: 50,
    min: 0,
    max: 100
  },
  totalLendings: {
    type: Number,
    default: 0
  },
  totalBorrowings: {
    type: Number,
    default: 0
  },
  successfulTransactions: {
    type: Number,
    default: 0
  },
  cancelledTransactions: {
    type: Number,
    default: 0
  },
  sustainabilityMetrics: {
    carbonSavedKg: { type: Number, default: 0 },
    itemsReused: { type: Number, default: 0 },
    wasteReducedKg: { type: Number, default: 0 }
  },
  searchHistory: [{
    query: String,
    category: String,
    timestamp: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true
});

// GeoJSON index for location-based queries
userSchema.index({ 'location': '2dsphere' });

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
