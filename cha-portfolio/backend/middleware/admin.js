const { getSupabase } = require('../services/supabase');
const { getActiveShop } = require('../controllers/shopController');

async function requireShopStaff(request, response, next) {
  try {
    const db = getSupabase(request.params.slug);
    const shop = await getActiveShop(db, request.params.slug);
    const { data: membership, error } = await db
      .from('staff_members')
      .select('id, role, is_active')
      .eq('user_id', request.user.id)
      .eq('shop_id', shop.id)
      .eq('is_active', true)
      .maybeSingle();

    if (error) throw error;
    if (!membership) return response.status(403).json({ error: 'Authorized shop staff only.' });

    request.adminShop = shop;
    request.staffMembership = membership;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { requireShopStaff };
