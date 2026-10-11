const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const {
  getMe,
  login,
  logout,
  register,
  updateProfile,
} = require('../controllers/authController');

const router = express.Router({ mergeParams: true });
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many account requests. Please wait and try again.' },
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/logout', logout);
router.get('/me', requireAuth, getMe);
router.patch('/profile', requireAuth, updateProfile);

module.exports = router;
