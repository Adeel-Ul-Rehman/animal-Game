const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema({
  roundId: {
    type: Number,
    required: true,
    unique: true
  },
  result: {
    type: String,
    required: true,
    enum: [
      'monkey', 'rabbit', 'lion', 'panda',
      'swallow', 'pigeon', 'peacock', 'eagle',
      'shark_24x', 'golden_shark_100x',
      'take_all', 'pay_all'
    ]
  },
  resultDisplay: {
    type: String,
    required: true
  },
  winningMultiplier: {
    type: Number,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Keep only last 50 records
gameHistorySchema.index({ createdAt: -1 });
gameHistorySchema.index({ roundId: -1 });

module.exports = mongoose.model('GameHistory', gameHistorySchema);