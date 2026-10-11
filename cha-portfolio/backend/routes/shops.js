const express = require('express');
const { rateLimit } = require('express-rate-limit');
const { optionalAuth, requireAuth } = require('../middleware/auth');
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

router.get('/:slug/products', listProducts);
router.get('/:slug/deals', listDeals);
router.get('/:slug/checkout-config', getCheckoutConfig);
router.post('/:slug/quote', optionalAuth, quoteCart);
router.get('/:slug/dashboard', requireAuth, getCustomerDashboard);
router.post('/:slug/orders', requireAuth, orderLimiter, createOrder);

module.exports = router;
