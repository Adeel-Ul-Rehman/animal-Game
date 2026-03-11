const User = require('../models/User');
const OTP = require('../models/OTP');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sendOTPEmail } = require('../utils/emailService');

// Generate 6-digit OTP
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP
exports.sendOTP = async (req, res) => {
  try {
    const { email, purpose } = req.body;
    
    // Check if email already exists for registration
    if (purpose === 'verification') {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
    }
    
    // Check if email exists for password reset
    if (purpose === 'reset-password') {
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Email not found'
        });
      }
    }
    
    // Delete any existing OTPs for this email and purpose
    await OTP.deleteMany({ email, purpose });
    
    // Generate new OTP
    const otp = generateOTP();
    
    // Save OTP to database
    await OTP.create({
      email,
      otp,
      purpose,
      expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
    });
    
    // Send email
    const emailSent = await sendOTPEmail(email, otp, purpose);
    
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: 'Failed to send OTP email'
      });
    }
    
    res.json({
      success: true,
      message: 'OTP sent successfully'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const { email, otp, purpose } = req.body;
    
    const otpRecord = await OTP.findOne({
      email,
      otp,
      purpose,
      expiresAt: { $gt: new Date() }
    });
    
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }
    
    // Don't delete OTP yet, it will be used in register/reset
    // But mark it as verified in session? We'll just let register use it
    
    res.json({
      success: true,
      message: 'OTP verified successfully'
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Register
exports.register = async (req, res) => {
  try {
    const { email, password, username, otp } = req.body;
    
    // Verify OTP
    const otpRecord = await OTP.findOne({
      email,
      otp,
      purpose: 'verification',
      expiresAt: { $gt: new Date() }
    });
    
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }
    
    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        return res.status(400).json({
          success: false,
          message: 'Email already registered'
        });
      }
      if (existingUser.username === username) {
        return res.status(400).json({
          success: false,
          message: 'Username already taken'
        });
      }
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // Create user
    const user = new User({
      email,
      password: hashedPassword,
      username,
      isVerified: true,
      coins: 500 // Welcome bonus
    });
    
    await user.save();
    
    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Registration successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        coins: user.coins,
        isAdmin: user.isAdmin,
        profilePicture: user.profilePicture
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    
    // Find user and select password
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Check if suspended
    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Contact admin.'
      });
    }
    
    // Verify password
    const isMatch = await bcrypt.compare(password, user.password);
    
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
    
    // Update last login
    user.lastLogin = new Date();
    await user.save();
    
    // Generate JWT
    const token = jwt.sign(
      { userId: user._id, isAdmin: user.isAdmin },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        email: user.email,
        username: user.username,
        coins: user.coins,
        isAdmin: user.isAdmin,
        profilePicture: user.profilePicture,
        isBanned: user.isBanned || false,
        banReason: user.banReason || ''
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Reset password request
exports.resetPasswordRequest = async (req, res) => {
  try {
    const { email } = req.body;
    
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Email not found'
      });
    }
    
    // Delete any existing OTPs
    await OTP.deleteMany({ email, purpose: 'reset-password' });
    
    // Generate OTP
    const otp = generateOTP();
    
    // Save OTP
    await OTP.create({
      email,
      otp,
      purpose: 'reset-password',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    
    // Send email
    await sendOTPEmail(email, otp, 'reset-password');
    
    res.json({
      success: true,
      message: 'Reset password OTP sent'
    });
  } catch (error) {
    console.error('Reset password request error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

// Reset password
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;
    
    // Verify OTP
    const otpRecord = await OTP.findOne({
      email,
      otp,
      purpose: 'reset-password',
      expiresAt: { $gt: new Date() }
    });
    
    if (!otpRecord) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired OTP'
      });
    }
    
    // Find user
    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'User not found'
      });
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update password
    user.password = hashedPassword;
    await user.save();
    
    // Delete used OTP
    await OTP.deleteOne({ _id: otpRecord._id });
    
    res.json({
      success: true,
      message: 'Password reset successful'
    });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};