const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/authController');
const { validateRequest } = require('../middleware/validateRequest');

// Rate limiting
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 requests per IP
  message: { success: false, message: 'Too many OTP requests, please try again later' }
});

// Send OTP for registration
router.post(
  '/send-otp',
  otpLimiter,
  [
    body('email').isEmail().normalizeEmail(),
    body('purpose').isIn(['verification', 'reset-password'])
  ],
  validateRequest,
  authController.sendOTP
);

// Verify OTP
router.post(
  '/verify-otp',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
    body('purpose').isIn(['verification', 'reset-password'])
  ],
  validateRequest,
  authController.verifyOTP
);

// Register
router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 6 }),
    body('username').isLength({ min: 3, max: 20 }).matches(/^[a-zA-Z0-9_]+$/),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric()
  ],
  validateRequest,
  authController.register
);

// Login
router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty()
  ],
  validateRequest,
  authController.login
);

// Reset password request
router.post(
  '/reset-password-request',
  otpLimiter,
  [
    body('email').isEmail().normalizeEmail()
  ],
  validateRequest,
  authController.resetPasswordRequest
);

// Reset password
router.post(
  '/reset-password',
  [
    body('email').isEmail().normalizeEmail(),
    body('otp').isLength({ min: 6, max: 6 }).isNumeric(),
    body('newPassword').isLength({ min: 6 })
  ],
  validateRequest,
  authController.resetPassword
);

module.exports = router;