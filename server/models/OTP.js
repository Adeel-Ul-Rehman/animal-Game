const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    lowercase: true
  },
  otp: {
    type: String,
    required: true
  },
  purpose: {
    type: String,
    enum: ['verification', 'reset-password'],
    required: true
  },
  expiresAt: {
    type: Date,
    required: true,
    default: () => new Date(+new Date() + 5*60*1000) // 5 minutes
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // Auto-delete after 5 minutes
  }
});

otpSchema.index({ email: 1, purpose: 1 });
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('OTP', otpSchema);