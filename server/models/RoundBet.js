const mongoose = require('mongoose');

const roundBetSchema = new mongoose.Schema({
  roundId: {
    type: Number,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  username: {
    type: String,
    required: true
  },
  bets: {
    monkey: { type: Number, default: 0 },
    rabbit: { type: Number, default: 0 },
    lion: { type: Number, default: 0 },
    panda: { type: Number, default: 0 },
    beast2x: { type: Number, default: 0 },
    swallow: { type: Number, default: 0 },
    pigeon: { type: Number, default: 0 },
    peacock: { type: Number, default: 0 },
    eagle: { type: Number, default: 0 },
    bird2x: { type: Number, default: 0 },
    shark24x: { type: Number, default: 0 },
    goldenShark100x: { type: Number, default: 0 },
    takeAll: { type: Number, default: 0 },
    payAll: { type: Number, default: 0 }
  },
  totalBet: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now,
    expires: 300 // Auto-delete after 5 minutes
  }
});

roundBetSchema.index({ roundId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('RoundBet', roundBetSchema);