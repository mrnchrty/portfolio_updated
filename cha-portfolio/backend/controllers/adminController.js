const { getSupabase, stripeIsConfigured } = require('../services/supabase');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPTION_ID_PATTERN = /^[a-z0-9_-]{1,60}$/i;
const ORDER_STATUSES = new Set([
  'pending',
  'confirmed',
  'preparing',
  'ready_for_pickup',
  'out_for_delivery',
  'completed',
  'cancelled',
]);

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function parseJsonArray(value, fieldName) {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw httpError(400, `${fieldName} must contain valid JSON.`);
    }
  }
  if (!Array.isArray(parsed)) throw httpError(400, `${fieldName} must be a JSON array.`);
  return parsed;
}

function normalizeProductOptions(value) {
  const groups = parseJsonArray(value ?? [], 'Product options');
  if (groups.length > 20) throw httpError(400, 'A product can have at most 20 option groups.');

  const usedGroupIds = new Set();
  return groups.map((group) => {
    if (!group || typeof group !== 'object' || Array.isArray(group)) {
      throw httpError(400, 'Each product option group must be an object.');
    }

    const id = String(group.id || '').trim();
    const label = String(group.label || '').trim();
    const type = group.type === 'multiple' ? 'multiple' : group.type || 'single';
    if (!OPTION_ID_PATTERN.test(id) || usedGroupIds.has(id)) {
      throw httpError(400, 'Product option group IDs must be unique letters, numbers, hyphens, or underscores.');
    }
    if (!label || label.length > 100 || !['single', 'multiple'].includes(type)) {
      throw httpError(400, 'Each option group needs a label and a supported selection type.');
    }
    usedGroupIds.add(id);

    const values = parseJsonArray(group.values, `Values for ${label}`);
    if (values.length < 1 || values.length > 50) {
      throw httpError(400, `The ${label} option group must contain between 1 and 50 choices.`);
    }

    const usedValueIds = new Set();
    const normalizedValues = values.map((optionValue) => {
      const valueId = String(optionValue?.id || '').trim();
      const valueLabel = String(optionValue?.label || '').trim();
      const priceDelta = Number(optionValue?.price_delta ?? 0);
      const hasDisplayPrice = optionValue?.display_price !== undefined
        && optionValue.display_price !== null
        && optionValue.display_price !== '';
      const displayPrice = hasDisplayPrice
        ? normalizePrice(optionValue.display_price, `Display price for ${valueLabel || label}`)
        : null;
      if (!OPTION_ID_PATTERN.test(valueId) || usedValueIds.has(valueId)) {
        throw httpError(400, `Choice IDs in ${label} must be unique and use letters, numbers, hyphens, or underscores.`);
      }
      if (!valueLabel || valueLabel.length > 100 || !Number.isFinite(priceDelta)) {
        throw httpError(400, `A choice in ${label} needs a label and a valid price adjustment.`);
      }
      if (Math.round(priceDelta * 100) !== priceDelta * 100 || Math.abs(priceDelta) > 100000) {
        throw httpError(400, `Price adjustments in ${label} must be valid amounts with up to two decimal places.`);
      }
      usedValueIds.add(valueId);
      return {
        id: valueId,
        label: valueLabel,
        price_delta: priceDelta,
        ...(hasDisplayPrice ? { display_price: displayPrice } : {}),
      };
    });

    const required = Boolean(group.required);
    const minimum = Number(group.min_selected ?? (required ? 1 : 0));
    const maximum = Number(group.max_selected ?? (type === 'single' ? 1 : normalizedValues.length));
    if (
      !Number.isInteger(minimum) ||
      !Number.isInteger(maximum) ||
      minimum < 0 ||
      maximum < 1 ||
      minimum > maximum ||
      maximum > normalizedValues.length ||
      (type === 'single' && maximum > 1)
    ) {
      throw httpError(400, `Selection limits for ${label} are not valid.`);
    }

    return {
      id,
      label,
      type,
      required,
      min_selected: minimum,
      max_selected: maximum,
      values: normalizedValues,
    };
  });
}

function normalizePrice(value, label = 'Price') {
  const price = Number(value);
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    price > 99999999.99 ||
    Math.round(price * 100) !== price * 100
  ) {
    throw httpError(400, `${label} must be a non-negative amount with up to two decimal places.`);
  }
  return price;
}

function normalizeImageUrl(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.length > 1000) {
    throw httpError(400, 'Image path must be 1,000 characters or fewer.');
  }
  const url = value.trim();
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (url.startsWith('https://')) return url;
  throw httpError(400, 'Use a root-relative image path or a secure HTTPS image URL.');
}

function normalizeOptionalInteger(value, label, maximum = 1000000) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isInteger(number) || number < 1 || number > maximum) {
    throw httpError(400, `${label} must be a whole number greater than zero.`);
  }
  return number;
}

async function categoryForShop(db, categoryId, shopId) {
  if (!categoryId) return null;
  if (!UUID_PATTERN.test(String(categoryId))) throw httpError(400, 'Choose a valid category.');

  const { data, error } = await db
    .from('categories')
    .select('id')
    .eq('id', categoryId)
    .eq('shop_id', shopId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw httpError(400, 'The selected category is not part of this shop.');
  return data.id;
}

async function getOverview(request, response, next) {
  try {
    const db = getSupabase(request.adminShop.slug);
    const shop = request.adminShop;

    const [ordersResult, productsResult, categoriesResult, promotionsResult] = await Promise.all([
      db
        .from('orders')
        .select(
          'id, order_number, customer_name, customer_email, customer_contact, fulfillment_method, fulfillment_details, payment_method, promo_code, subtotal, discount, total, currency, status, payment_status, is_test_order, created_at, updated_at, order_items(id, product_name, base_unit_price, unit_price, quantity, line_total, selected_options)',
        )
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(50),
      db
        .from('products')
        .select(
          'id, category_id, name, description, price, available, image_url, is_sample, is_featured, options, display_order, categories(name, slug)',
        )
        .eq('shop_id', shop.id)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      db
        .from('categories')
        .select('id, name, slug, sort_order')
        .eq('shop_id', shop.id)
        .order('sort_order', { ascending: true }),
      db
        .from('promotions')
        .select(
          'id, code, name, description, discount_type, discount_value, applies_to, minimum_order_total, maximum_discount, starts_at, ends_at, maximum_redemptions, maximum_redemptions_per_customer, is_active, created_at',
        )
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false }),
    ]);

    for (const result of [ordersResult, productsResult, categoriesResult, promotionsResult]) {
      if (result.error) throw result.error;
    }

    const products = (productsResult.data || []).map((product) => ({
      ...product,
      category_name: product.categories?.name || null,
      category_slug: product.categories?.slug || null,
      categories: undefined,
    }));

    response.set('Cache-Control', 'no-store');
    response.json({
      shop: {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        description: shop.description,
        currency: shop.currency,
        fulfillment_options: shop.fulfillment_options || [],
        payment_methods: shop.payment_methods || [],
        is_demo: shop.is_demo,
      },
      staff_role: request.staffMembership.role,
      orders: ordersResult.data || [],
      products,
      categories: categoriesResult.data || [],
      promotions: promotionsResult.data || [],
    });
  } catch (error) {
    next(error);
  }
}

async function updateOrderStatus(request, response, next) {
  try {
    const { status } = request.body || {};
    if (!ORDER_STATUSES.has(status)) throw httpError(400, 'Choose a valid order status.');

    const db = getSupabase(request.adminShop.slug);
    const { data: currentOrder, error: orderError } = await db
      .from('orders')
      .select('id, fulfillment_method, status')
      .eq('id', request.params.orderId)
      .eq('shop_id', request.adminShop.id)
      .maybeSingle();

    if (orderError) throw orderError;
    if (!currentOrder) throw httpError(404, 'Order not found in this shop.');

    if (status === 'ready_for_pickup' && !/pickup|collection/i.test(currentOrder.fulfillment_method)) {
      throw httpError(400, 'Ready for pickup is only valid for a configured pickup/collection order.');
    }
    if (status === 'out_for_delivery' && !/delivery/i.test(currentOrder.fulfillment_method)) {
      throw httpError(400, 'Out for delivery is only valid for a configured delivery order.');
    }

    const { data, error } = await db
      .from('orders')
      .update({ status })
      .eq('id', currentOrder.id)
      .eq('shop_id', request.adminShop.id)
      .select('id, order_number, status, updated_at')
      .single();

    if (error) throw error;
    response.json({ order: data, message: 'Order status updated.' });
  } catch (error) {
    next(error);
  }
}

async function createProduct(request, response, next) {
  try {
    const db = getSupabase(request.adminShop.slug);
    const body = request.body || {};
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    if (name.length < 2 || name.length > 140) throw httpError(400, 'Product name must be 2 to 140 characters.');
    if (description.length > 2000) throw httpError(400, 'Product description must be 2,000 characters or fewer.');

    const categoryId = await categoryForShop(db, body.categoryId || null, request.adminShop.id);
    const options = normalizeProductOptions(body.options);
    const price = normalizePrice(body.price);
    const imageUrl = normalizeImageUrl(body.imageUrl);

    const { data, error } = await db
      .from('products')
      .insert({
        shop_id: request.adminShop.id,
        category_id: categoryId,
        name,
        description,
        price,
        image_url: imageUrl,
        available: body.available !== false,
        is_sample: Boolean(body.isSample),
        is_featured: Boolean(body.isFeatured),
        options,
        display_order: Number.isInteger(Number(body.displayOrder)) ? Number(body.displayOrder) : 0,
      })
      .select('id, name, price, available, is_sample, is_featured, options')
      .single();

    if (error) throw error;
    response.status(201).json({ product: data, message: 'Product created.' });
  } catch (error) {
    next(error);
  }
}

async function updateProduct(request, response, next) {
  try {
    const db = getSupabase(request.adminShop.slug);
    const body = request.body || {};
    const update = {};

    if (Object.hasOwn(body, 'name')) {
      const name = String(body.name || '').trim();
      if (name.length < 2 || name.length > 140) throw httpError(400, 'Product name must be 2 to 140 characters.');
      update.name = name;
    }
    if (Object.hasOwn(body, 'description')) {
      if (typeof body.description !== 'string' || body.description.length > 2000) {
        throw httpError(400, 'Product description must be text of 2,000 characters or fewer.');
      }
      update.description = body.description.trim();
    }
    if (Object.hasOwn(body, 'price')) update.price = normalizePrice(body.price);
    if (Object.hasOwn(body, 'available')) {
      if (typeof body.available !== 'boolean') throw httpError(400, 'Product availability must be true or false.');
      update.available = body.available;
    }
    if (Object.hasOwn(body, 'isFeatured')) {
      if (typeof body.isFeatured !== 'boolean') throw httpError(400, 'Featured state must be true or false.');
      update.is_featured = body.isFeatured;
    }
    if (Object.hasOwn(body, 'isSample')) {
      if (typeof body.isSample !== 'boolean') throw httpError(400, 'Sample state must be true or false.');
      update.is_sample = body.isSample;
    }
    if (Object.hasOwn(body, 'imageUrl')) update.image_url = normalizeImageUrl(body.imageUrl);
    if (Object.hasOwn(body, 'categoryId')) {
      update.category_id = await categoryForShop(db, body.categoryId || null, request.adminShop.id);
    }
    if (Object.hasOwn(body, 'options')) update.options = normalizeProductOptions(body.options);
    if (Object.hasOwn(body, 'displayOrder')) {
      const displayOrder = Number(body.displayOrder);
      if (!Number.isInteger(displayOrder) || displayOrder < 0 || displayOrder > 100000) {
        throw httpError(400, 'Display order must be a whole number from 0 to 100,000.');
      }
      update.display_order = displayOrder;
    }
    if (Object.keys(update).length === 0) throw httpError(400, 'There are no product changes to save.');

    const { data, error } = await db
      .from('products')
      .update(update)
      .eq('id', request.params.productId)
      .eq('shop_id', request.adminShop.id)
      .select('id, name, description, price, available, image_url, is_sample, is_featured, options, display_order')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw httpError(404, 'Product not found in this shop.');
    response.json({ product: data, message: 'Product updated.' });
  } catch (error) {
    next(error);
  }
}

function parseDate(value, label, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw httpError(400, `${label} is not a valid date.`);
  return date.toISOString();
}

async function validatePromotionTarget(db, body, shopId) {
  const appliesTo = body.appliesTo || 'order';
  if (!['order', 'product', 'category'].includes(appliesTo)) {
    throw httpError(400, 'Promotion target must be order, product, or category.');
  }

  const target = { applies_to: appliesTo, product_id: null, category_id: null };
  if (appliesTo === 'product') {
    if (!UUID_PATTERN.test(String(body.productId || ''))) throw httpError(400, 'Choose a valid eligible product.');
    const { data, error } = await db
      .from('products')
      .select('id')
      .eq('id', body.productId)
      .eq('shop_id', shopId)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw httpError(400, 'The eligible product is not part of this shop.');
    target.product_id = data.id;
  }
  if (appliesTo === 'category') {
    target.category_id = await categoryForShop(db, body.categoryId, shopId);
    if (!target.category_id) throw httpError(400, 'Choose an eligible category.');
  }
  return target;
}

async function createPromotion(request, response, next) {
  try {
    const db = getSupabase(request.adminShop.slug);
    const body = request.body || {};
    const name = String(body.name || '').trim();
    const description = String(body.description || '').trim();
    const discountType = body.discountType;
    const discountValue = normalizePrice(body.discountValue, 'Discount amount');
    const minimumOrderTotal = normalizePrice(body.minimumOrderTotal ?? 0, 'Minimum order amount');
    const maximumDiscount =
      body.maximumDiscount === '' || body.maximumDiscount === null || body.maximumDiscount === undefined
        ? null
        : normalizePrice(body.maximumDiscount, 'Maximum discount');
    const code = body.code === '' || body.code === null || body.code === undefined
      ? null
      : String(body.code).trim().toUpperCase();

    if (!name || name.length > 140) throw httpError(400, 'Promotion name must be 1 to 140 characters.');
    if (description.length > 1000) throw httpError(400, 'Promotion description must be 1,000 characters or fewer.');
    if (!['percent', 'fixed'].includes(discountType)) throw httpError(400, 'Choose a percentage or fixed discount.');
    if (discountValue <= 0 || (discountType === 'percent' && discountValue > 100)) {
      throw httpError(400, 'Discount amount must be greater than zero and percentage cannot exceed 100.');
    }
    if (code && !/^[A-Z0-9_-]{2,32}$/.test(code)) {
      throw httpError(400, 'Promo code must use 2 to 32 letters, numbers, hyphens, or underscores.');
    }

    const startsAt = parseDate(body.startsAt, 'Start date', new Date().toISOString());
    const endsAt = parseDate(body.endsAt, 'End date', null);
    if (endsAt && new Date(endsAt) <= new Date(startsAt)) {
      throw httpError(400, 'Promotion end date must be later than its start date.');
    }
    const target = await validatePromotionTarget(db, body, request.adminShop.id);

    const { data, error } = await db
      .from('promotions')
      .insert({
        shop_id: request.adminShop.id,
        code,
        name,
        description,
        discount_type: discountType,
        discount_value: discountValue,
        applies_to: target.applies_to,
        product_id: target.product_id,
        category_id: target.category_id,
        minimum_order_total: minimumOrderTotal,
        maximum_discount: maximumDiscount,
        starts_at: startsAt,
        ends_at: endsAt,
        maximum_redemptions: normalizeOptionalInteger(body.maximumRedemptions, 'Maximum redemptions'),
        maximum_redemptions_per_customer: normalizeOptionalInteger(
          body.maximumRedemptionsPerCustomer,
          'Maximum redemptions per customer',
        ),
        is_active: Boolean(body.isActive),
      })
      .select('id, code, name, description, discount_type, discount_value, starts_at, ends_at, is_active')
      .single();

    if (error) throw error;
    response.status(201).json({ promotion: data, message: 'Promotion saved.' });
  } catch (error) {
    next(error);
  }
}

async function updatePromotion(request, response, next) {
  try {
    if (typeof request.body?.isActive !== 'boolean') {
      throw httpError(400, 'Promotion active state must be true or false.');
    }
    const db = getSupabase(request.adminShop.slug);
    const { data, error } = await db
      .from('promotions')
      .update({ is_active: request.body.isActive })
      .eq('id', request.params.promotionId)
      .eq('shop_id', request.adminShop.id)
      .select('id, code, name, is_active, starts_at, ends_at')
      .maybeSingle();

    if (error) throw error;
    if (!data) throw httpError(404, 'Promotion not found in this shop.');
    response.json({ promotion: data, message: 'Promotion updated.' });
  } catch (error) {
    next(error);
  }
}

function normalizeShopOptions(value, label, includeInstructions = false) {
  const options = parseJsonArray(value, label);
  if (options.length > 20) throw httpError(400, `${label} can contain at most 20 options.`);

  const ids = new Set();
  return options.map((option) => {
    const id = String(option?.id || '').trim();
    const name = String(option?.label || '').trim();
    if (!OPTION_ID_PATTERN.test(id) || ids.has(id) || !name || name.length > 120) {
      throw httpError(400, `Each ${label.toLowerCase()} entry needs a unique ID and a label.`);
    }
    if (includeInstructions && id === 'stripe') {
      throw httpError(400, 'Stripe is configured from server environment variables, not manual payment methods.');
    }
    ids.add(id);

    const normalized = { id, label: name, enabled: option.enabled !== false };
    if (includeInstructions) {
      const instructions = String(option.instructions || '');
      if (instructions.length > 1000) throw httpError(400, 'Payment instructions must be 1,000 characters or fewer.');
      normalized.instructions = instructions.trim();
    } else {
      normalized.requires_details = Boolean(option.requires_details);
      if (option.type) normalized.type = String(option.type).slice(0, 40);
    }
    return normalized;
  });
}

async function updateShopSettings(request, response, next) {
  try {
    const body = request.body || {};
    const fulfillmentOptions = normalizeShopOptions(
      body.fulfillmentOptions,
      'Fulfillment options',
      false,
    );
    const paymentMethods = normalizeShopOptions(body.paymentMethods, 'Payment methods', true);
    if (typeof body.isDemo !== 'boolean') throw httpError(400, 'Demo mode must be true or false.');
    const db = getSupabase(request.adminShop.slug);

    if (!body.isDemo) {
      const { count, error: sampleError } = await db
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('shop_id', request.adminShop.id)
        .eq('is_sample', true);
      if (sampleError) throw sampleError;
      if (count > 0) {
        throw httpError(409, 'Replace or remove all sample products before disabling demo mode.');
      }
      if (fulfillmentOptions.filter((item) => item.enabled).length === 0) {
        throw httpError(409, 'Enable at least one real fulfillment option before disabling demo mode.');
      }
      const manualPaymentAvailable = paymentMethods.some((method) => method.enabled);
      const stripeAvailable = stripeIsConfigured() && Boolean(process.env.STRIPE_WEBHOOK_SECRET);
      if (!manualPaymentAvailable && !stripeAvailable) {
        throw httpError(409, 'Configure a manual payment method or Stripe Checkout before disabling demo mode.');
      }
    }

    const currency = String(body.currency || request.adminShop.currency || 'PHP').toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw httpError(400, 'Currency must be a three-letter ISO code.');

    const { data, error } = await db
      .from('shops')
      .update({
        fulfillment_options: fulfillmentOptions,
        payment_methods: paymentMethods,
        is_demo: body.isDemo,
        currency,
      })
      .eq('id', request.adminShop.id)
      .select('id, slug, name, currency, fulfillment_options, payment_methods, is_demo')
      .single();

    if (error) throw error;
    response.json({ shop: data, message: 'Shop settings updated.' });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createProduct,
  createPromotion,
  getOverview,
  updateOrderStatus,
  updateProduct,
  updatePromotion,
  updateShopSettings,
};
