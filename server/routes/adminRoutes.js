const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { protect, adminOnly } = require('../middleware/auth');
const User = require('../models/User');
const CoinRequest = require('../models/CoinRequest');
const AdminCoinLog = require('../models/AdminCoinLog');
const GameHistory = require('../models/GameHistory');
const { sendCoinNotification, sendBanNotification } = require('../utils/emailService');
const { forceDisconnectUser, getGameStopped, setGameStopped, getOnlinePlayersList } = require('../sockets/gameSocket');
const { getIo } = require('../utils/ioRef');

router.get('/stats', protect, adminOnly, async (req, res) => {
  try {
    const [totalUsers, onlineCount, pendingRequests, bannedCount, totalCoinsAgg] = await Promise.all([
      User.countDocuments({ isAdmin: false }),
      User.countDocuments({ isAdmin: false, isOnline: true }),
      CoinRequest.countDocuments({ status: 'pending' }),
      User.countDocuments({ isAdmin: false, isBanned: true }),
      User.aggregate([{ $match: { isAdmin: false } }, { $group: { _id: null, total: { $sum: '$coins' } } }]),
    ]);
    const totalCoins = totalCoinsAgg[0]?.total || 0;
    const recentRequests = await CoinRequest.find({ status: 'pending' }).sort({ createdAt: -1 }).limit(5).lean();
    res.json({ success: true, stats: { totalUsers, onlineCount, pendingRequests, bannedCount, totalCoins, gameStopped: getGameStopped() }, recentRequests });
  } catch (error) { console.error('Stats error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const { search } = req.query;
    const query = { isAdmin: false };
    if (search) query.$or = [{ username: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    const users = await User.find(query).select('-password').sort({ createdAt: -1 });
    res.json({ success: true, users });
  } catch (error) { console.error('Get users error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.post('/users/:id/ban', protect, adminOnly, async (req, res) => {
  try {
    const { banReason } = req.body;
    if (!banReason || !banReason.trim()) return res.status(400).json({ success: false, message: 'Ban reason is required' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    if (user.isAdmin) return res.status(400).json({ success: false, message: 'Cannot ban admin' });
    user.isBanned = true; user.banReason = banReason.trim(); user.bannedAt = new Date(); user.bannedBy = req.user._id;
    await user.save();
    forceDisconnectUser(user._id);
    const contactEmail = process.env.SMTP_USER || process.env.EMAIL_FROM || 'admin@mail.com';
    await sendBanNotification(user.email, user.username, banReason.trim(), contactEmail);
    console.log(`BAN: ${user.username} by ${req.user.username}. Reason: ${banReason}`);
    res.json({ success: true, message: `${user.username} has been banned` });
  } catch (error) { console.error('Ban error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.post('/users/:id/unban', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.isBanned = false; user.banReason = ''; user.bannedAt = null; user.bannedBy = null;
    await user.save();
    console.log(`UNBAN: ${user.username} by ${req.user.username}`);
    res.json({ success: true, message: `${user.username} has been unbanned` });
  } catch (error) { console.error('Unban error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.get('/online-players', protect, adminOnly, async (req, res) => {
  try {
    const players = await getOnlinePlayersList();
    res.json({ success: true, players });
  } catch (error) { console.error('Online players error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.get('/coin-requests', protect, adminOnly, async (req, res) => {
  try {
    const { status, dateFrom, dateTo, search } = req.query;
    const query = {};
    if (status && status !== 'all') query.status = status;
    if (dateFrom || dateTo) {
      query.createdAt = {};
      if (dateFrom) query.createdAt.$gte = new Date(dateFrom);
      if (dateTo) { const end = new Date(dateTo); end.setHours(23,59,59,999); query.createdAt.$lte = end; }
    }
    if (search) query.$or = [{ username: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];
    const requests = await CoinRequest.find(query).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, requests });
  } catch (error) { console.error('Coin requests error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.post('/coin-requests/:id/process', protect, adminOnly, async (req, res) => {
  try {
    const { status, adminNote } = req.body;
    if (!['approved','rejected'].includes(status)) return res.status(400).json({ success: false, message: 'Invalid status' });
    const request = await CoinRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ success: false, message: 'Request not found' });
    if (request.status !== 'pending') return res.status(400).json({ success: false, message: 'Already processed' });
    request.status = status; request.adminNote = adminNote || (status === 'approved' ? 'Approved' : 'Rejected');
    request.processedBy = req.user._id; request.processedAt = new Date();
    await request.save();
    if (status === 'approved') {
      const user = await User.findById(request.userId);
      if (user) {
        user.coins += request.requestedAmount; await user.save();
        await AdminCoinLog.create({ adminId: req.user._id, adminEmail: req.user.email, userId: user._id, userEmail: user.email, username: user.username, amount: request.requestedAmount, type: 'request_approved', requestId: request._id });
        await sendCoinNotification(user.email, user.username, request.requestedAmount, 'approved');
      }
    }
    res.json({ success: true, message: `Request ${status}` });
  } catch (error) { console.error('Process request error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.post('/add-coins', protect, adminOnly, async (req, res) => {
  try {
    const { userId, amount, reason } = req.body;
    if (!userId || !amount || amount <= 0) return res.status(400).json({ success: false, message: 'Invalid request' });
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    user.coins += parseInt(amount); await user.save();
    await AdminCoinLog.create({ adminId: req.user._id, adminEmail: req.user.email, userId: user._id, userEmail: user.email, username: user.username, amount: parseInt(amount), type: 'manual_add', reason: reason || 'Admin manual add' });
    await sendCoinNotification(user.email, user.username, parseInt(amount), 'bonus');
    res.json({ success: true, message: 'Coins added', user: { _id: user._id, username: user.username, coins: user.coins } });
  } catch (error) { console.error('Add coins error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.get('/game/status', protect, adminOnly, async (req, res) => {
  try {
    const onlineCount = await User.countDocuments({ isAdmin: false, isOnline: true });
    res.json({ success: true, gameStopped: getGameStopped(), onlineCount });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
});

router.post('/game/stop', protect, adminOnly, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Password required' });
    const admin = await User.findById(req.user._id).select('+password');
    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) return res.status(401).json({ success: false, message: 'Incorrect password' });
    setGameStopped(true);
    const io = getIo();
    if (io) io.to('game-room').emit('game-stopped', { message: 'The game has been temporarily stopped by the administrator.', stoppedAt: new Date() });
    console.log(`GAME STOPPED by ${req.user.username}`);
    res.json({ success: true, message: 'Game stopped' });
  } catch (error) { console.error('Stop game error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.post('/game/resume', protect, adminOnly, async (req, res) => {
  try {
    setGameStopped(false);
    const io = getIo();
    if (io) io.to('game-room').emit('game-resumed', { message: 'The game has been resumed.', resumedAt: new Date() });
    console.log(`GAME RESUMED by ${req.user.username}`);
    res.json({ success: true, message: 'Game resumed' });
  } catch (error) { console.error('Resume game error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.get('/game-history', protect, adminOnly, async (req, res) => {
  try {
    const results = await GameHistory.find().sort({ createdAt: -1 }).limit(25).lean();
    res.json({ success: true, results: results.reverse() });
  } catch (error) { console.error('History error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.put('/profile', protect, adminOnly, async (req, res) => {
  try {
    const { username, profilePicture, currentPassword, newPassword } = req.body;
    const admin = await User.findById(req.user._id).select('+password');
    if (username && username.trim()) {
      const existing = await User.findOne({ username: username.trim(), _id: { $ne: admin._id } });
      if (existing) return res.status(400).json({ success: false, message: 'Username already taken' });
      admin.username = username.trim();
    }
    if (profilePicture !== undefined) admin.profilePicture = profilePicture;
    if (currentPassword && newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, admin.password);
      if (!isMatch) return res.status(401).json({ success: false, message: 'Current password incorrect' });
      if (newPassword.length < 6) return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
      admin.password = await bcrypt.hash(newPassword, 10);
    }
    await admin.save();
    res.json({ success: true, message: 'Profile updated', user: { id: admin._id, email: admin.email, username: admin.username, profilePicture: admin.profilePicture, isAdmin: admin.isAdmin } });
  } catch (error) { console.error('Admin profile error:', error); res.status(500).json({ success: false, message: 'Server error' }); }
});

router.get('/coin-logs', protect, adminOnly, async (req, res) => {
  try {
    const logs = await AdminCoinLog.find().sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, logs });
  } catch (error) { res.status(500).json({ success: false, message: 'Server error' }); }
});

module.exports = router;
