const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const GameHistory = require('../models/GameHistory');
const CoinRequest = require('../models/CoinRequest');

// @route   GET /api/game/history
// @desc    Get game history (last 50 rounds)
// @access  Public
router.get('/history', async (req, res) => {
  try {
    const history = await GameHistory.find()
      .select('roundNumber winningBox multiplier timestamp')
      .sort({ roundNumber: -1 })
      .limit(50);
    
    res.json({
      success: true,
      history
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/game/history/:roundNumber
// @desc    Get specific round details
// @access  Public
router.get('/history/:roundNumber', async (req, res) => {
  try {
    const round = await GameHistory.findOne({ roundNumber: req.params.roundNumber });
    
    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Round not found'
      });
    }

    res.json({
      success: true,
      round
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/game/request-coins
// @desc    Request coins from admin
// @access  Private
router.post('/request-coins', protect, async (req, res) => {
  try {
    const { amount, reason } = req.body;

    if (!amount || amount < 100) {
      return res.status(400).json({
        success: false,
        message: 'Minimum request is 100 coins'
      });
    }

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a detailed reason (minimum 10 characters)'
      });
    }

    // Check if user has pending request
    const pendingRequest = await CoinRequest.findOne({
      user: req.user._id,
      status: 'pending'
    });

    if (pendingRequest) {
      return res.status(400).json({
        success: false,
        message: 'You already have a pending coin request'
      });
    }

    const request = await CoinRequest.create({
      user: req.user._id,
      amount,
      reason
    });

    res.json({
      success: true,
      message: 'Coin request submitted successfully',
      request
    });
  } catch (error) {
    console.error('Request coins error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/game/my-requests
// @desc    Get user's coin requests
// @access  Private
router.get('/my-requests', protect, async (req, res) => {
  try {
    const requests = await CoinRequest.find({ user: req.user._id })
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/game/save-result
// @desc    Save a spin result; keep only the latest 25 records
// @access  Private
router.post('/save-result', protect, async (req, res) => {
  try {
    const { result, resultDisplay, winningMultiplier } = req.body;

    if (!result || resultDisplay === undefined || winningMultiplier === undefined) {
      return res.status(400).json({ success: false, message: 'Missing required fields' });
    }

    const roundId = Date.now();

    const record = await GameHistory.create({ roundId, result, resultDisplay, winningMultiplier });

    // Enforce 25-record cap: delete oldest extras
    const totalCount = await GameHistory.countDocuments();
    if (totalCount > 25) {
      const oldest = await GameHistory.find()
        .sort({ createdAt: 1 })
        .limit(totalCount - 25)
        .select('_id');
      const idsToDelete = oldest.map((d) => d._id);
      await GameHistory.deleteMany({ _id: { $in: idsToDelete } });
    }

    res.json({ success: true, record });
  } catch (error) {
    console.error('Save result error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/game/results
// @desc    Get last 25 spin results (newest first)
// @access  Private
router.get('/results', protect, async (req, res) => {
  try {
    const results = await GameHistory.find()
      .sort({ createdAt: -1 })
      .limit(25)
      .select('roundId result resultDisplay winningMultiplier createdAt');

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
