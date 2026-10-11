const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { getCheckoutStatus } = require('../controllers/paymentController');
const { requireAuth, optionalAuth } = require('../middleware/auth');
const authRoutes = require('./auth');
const {
  createOrder,
  getCustomerDashboard,
  getCheckoutConfig,
  listDeals,
  listProducts,
  quoteCart,
} = require('../controllers/shopController');

const router = express.Router();
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many order requests. Please wait and try again.' },
});

// Each storefront authenticates against its own Supabase Auth project and cookie pair.
router.use('/:slug/auth', authRoutes);
router.get('/:slug/payments/sessions/:sessionId', requireAuth, getCheckoutStatus);
router.get('/:slug/products', listProducts);
router.get('/:slug/deals', listDeals);
router.get('/:slug/checkout-config', getCheckoutConfig);
router.post('/:slug/quote', optionalAuth, quoteCart);
router.get('/:slug/dashboard', requireAuth, getCustomerDashboard);
router.post('/:slug/orders', requireAuth, orderLimiter, createOrder);

module.exports = router;
