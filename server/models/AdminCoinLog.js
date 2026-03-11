const mongoose = require('mongoose');

const adminCoinLogSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  adminEmail: {
    type: String,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userEmail: {
    type: String,
    required: true
  },
  username: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  type: {
    type: String,
    enum: ['manual_add', 'request_approved'],
    required: true
  },
  reason: {
    type: String,
    default: ''
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CoinRequest',
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('AdminCoinLog', adminCoinLogSchema);