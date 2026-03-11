const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const CoinRequest = require('../models/CoinRequest');
const bcrypt = require('bcryptjs');

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    
    res.json({
      success: true,
      user
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/users/coins
// @desc    Get user coins balance
// @access  Private
router.get('/coins', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('coins');
    
    res.json({
      success: true,
      coins: user.coins
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PATCH /api/users/coins
// @desc    Update user coins balance
// @access  Private
router.patch('/coins', protect, async (req, res) => {
  try {
    const { coins } = req.body;

    if (coins === undefined || coins === null || typeof coins !== 'number' || coins < 0) {
      return res.status(400).json({ success: false, message: 'Invalid coins value' });
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { coins },
      { new: true }
    ).select('-password');

    res.json({ success: true, user });
  } catch (error) {
    console.error('Update coins error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/users/profile
// @desc    Update username and/or profile picture
// @access  Private
router.patch('/profile', protect, async (req, res) => {
  try {
    const { username, profilePicture } = req.body;
    const updates = {};

    if (username !== undefined) {
      const trimmed = username.trim();
      if (trimmed.length < 3) {
        return res.status(400).json({ success: false, message: 'Username must be at least 3 characters' });
      }
      // Check uniqueness (exclude self)
      const existing = await User.findOne({ username: trimmed, _id: { $ne: req.user._id } });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Username already taken' });
      }
      updates.username = trimmed;
    }

    if (profilePicture !== undefined) {
      // null = remove, string = base64 image
      updates.profilePicture = profilePicture;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ success: false, message: 'Nothing to update' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true }).select('-password');
    res.json({ success: true, user });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   PATCH /api/users/password
// @desc    Change user password
// @access  Private
router.patch('/password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   POST /api/users/coin-request
// @desc    Submit a coin request to admin (max 1 per day, no new request until last resolved)
// @access  Private
router.post('/coin-request', protect, async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number' || amount < 10 || amount > 1000) {
      return res.status(400).json({ success: false, message: 'Amount must be between 10 and 1000 coins' });
    }

    // Block if there is any pending request
    const pendingRequest = await CoinRequest.findOne({ userId: req.user._id, status: 'pending' });
    if (pendingRequest) {
      return res.status(400).json({ success: false, message: 'You already have a pending request. Wait for admin to resolve it.' });
    }

    // Block if already made a request today (any status)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);
    const todayRequest = await CoinRequest.findOne({
      userId: req.user._id,
      createdAt: { $gte: todayStart, $lte: todayEnd },
    });
    if (todayRequest) {
      return res.status(400).json({ success: false, message: 'You can only make one request per day.' });
    }

    const user = await User.findById(req.user._id).select('-password');
    const request = await CoinRequest.create({
      userId: user._id,
      username: user.username,
      email: user.email,
      requestedAmount: amount,
      status: 'pending',
    });

    res.json({ success: true, message: 'Coin request sent to admin!', request });
  } catch (error) {
    console.error('Coin request error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @route   GET /api/users/coin-request/status
// @desc    Get the user's latest coin request status
// @access  Private
router.get('/coin-request/status', protect, async (req, res) => {
  try {
    const request = await CoinRequest.findOne({ userId: req.user._id }).sort({ createdAt: -1 });
    if (!request) {
      return res.json({ success: true, request: null });
    }
    res.json({ success: true, request });
  } catch (error) {
    console.error('Coin request status error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
