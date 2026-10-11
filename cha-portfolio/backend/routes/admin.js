const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { requireShopStaff } = require('../middleware/admin');
const {
  createProduct,
  createPromotion,
  getOverview,
  updateOrderStatus,
  updateProduct,
  updatePromotion,
  updateShopSettings,
} = require('../controllers/adminController');

const router = express.Router();

router.get('/shops/:slug/overview', requireAuth, requireShopStaff, getOverview);
router.patch('/shops/:slug/settings', requireAuth, requireShopStaff, updateShopSettings);
router.post('/shops/:slug/products', requireAuth, requireShopStaff, createProduct);
router.patch('/shops/:slug/products/:productId', requireAuth, requireShopStaff, updateProduct);
router.patch('/shops/:slug/orders/:orderId/status', requireAuth, requireShopStaff, updateOrderStatus);
router.post('/shops/:slug/promotions', requireAuth, requireShopStaff, createPromotion);
router.patch('/shops/:slug/promotions/:promotionId', requireAuth, requireShopStaff, updatePromotion);

module.exports = router;
