const mongoose = require('mongoose');
// mongoose is used for ObjectId ref in bannedBy field

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  profilePicture: {
    type: String,
    default: null // Base64 string
  },
  coins: {
    type: Number,
    default: 0
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  isAdmin: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'suspended'],
    default: 'active'
  },
  lastLogin: {
    type: Date,
    default: null
  },
  socketId: {
    type: String,
    default: null
  },
  isOnline: {
    type: Boolean,
    default: false
  },
  isBanned: {
    type: Boolean,
    default: false
  },
  banReason: {
    type: String,
    default: ''
  },
  bannedAt: {
    type: Date,
    default: null
  },
  bannedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for faster queries (unique already creates index, so we only need isOnline)
userSchema.index({ isOnline: 1 });

module.exports = mongoose.model('User', userSchema);