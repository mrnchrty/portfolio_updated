const {
  getStripe,
  getSupabase,
  sampleOrdersAreAllowed,
  stripeIsConfigured,
} = require('../services/supabase');

const SHOP_SLUGS = new Set(['digicha', 'mochajaki']);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPTION_ID_PATTERN = /^[a-z0-9_-]{1,60}$/i;
const SHOP_PAGE_PATHS = {
  digicha: '/digicha-shop/',
  mochajaki: '/mochajaki-shop/',
};

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function isUuid(value) {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

function normalizeSlug(value) {
  if (!SHOP_SLUGS.has(value)) throw httpError(404, 'Shop not found.');
  return value;
}

function normalizeText(value, fieldName, maximumLength, required = false) {
  if (typeof value !== 'string') {
    if (!required && (value === null || value === undefined)) return '';
    throw httpError(400, `${fieldName} must be text.`);
  }

  const text = value.trim();
  if (required && text.length === 0) throw httpError(400, `${fieldName} is required.`);
  if (text.length > maximumLength) {
    throw httpError(400, `${fieldName} must be ${maximumLength} characters or fewer.`);
  }
  return text;
}

function normalizeSelectedOptions(value) {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw httpError(400, 'Product option selections are not valid.');
  }

  const entries = Object.entries(value);
  if (entries.length > 20) throw httpError(400, 'Too many product options were selected.');

  const normalized = {};
  for (const [groupId, selection] of entries) {
    if (!OPTION_ID_PATTERN.test(groupId)) {
      throw httpError(400, 'A product option group is not valid.');
    }

    if (typeof selection === 'string') {
      if (selection.length > 80) throw httpError(400, 'A product option is too long.');
      normalized[groupId] = selection;
      continue;
    }

    if (!Array.isArray(selection) || selection.length > 20) {
      throw httpError(400, 'Product option selections are not valid.');
    }

    if (selection.some((item) => typeof item !== 'string' || item.length > 80)) {
      throw httpError(400, 'A product option is not valid.');
    }
    normalized[groupId] = [...new Set(selection)];
  }

  return normalized;
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length < 1 || items.length > 50) {
    throw httpError(400, 'Your cart must contain between 1 and 50 items.');
  }

  const merged = new Map();
  for (const item of items) {
    const productId = item?.productId ?? item?.product_id;
    const quantity = Number(item?.quantity);
    if (!isUuid(productId)) throw httpError(400, 'A cart item has an invalid product ID. Refresh the catalog.');
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
      throw httpError(400, 'Each item quantity must be between 1 and 99.');
    }

    const options = normalizeSelectedOptions(item?.options);
    const key = `${productId}:${JSON.stringify(options)}`;
    const existing = merged.get(key);
    const combinedQuantity = (existing?.quantity || 0) + quantity;
    if (combinedQuantity > 99) throw httpError(400, 'An item quantity cannot exceed 99.');

    merged.set(key, {
      product_id: productId,
      quantity: combinedQuantity,
      options,
    });
  }

  return [...merged.values()];
}

function normalizePromoCode(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 60) {
    throw httpError(400, 'Promo code must be 60 characters or fewer.');
  }
  return value.trim().toUpperCase() || null;
}

function raiseDatabaseError(error) {
  if (!error) return;

  if (error.code === 'P0001' || error.code === '22P02' || error.code === '23514') {
    throw httpError(400, error.message || 'The request could not be validated.');
  }
  if (error.code === '23505') {
    throw httpError(409, 'This order or promotion has already been submitted. Refresh and try again.');
  }
  throw error;
}

async function getActiveShop(db, slug) {
  const { data, error } = await db
    .from('shops')
    .select(
      'id, slug, name, description, currency, fulfillment_options, payment_methods, is_demo, is_active',
    )
    .eq('slug', normalizeSlug(slug))
    .eq('is_active', true)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw httpError(404, 'Shop not found or inactive.');
  return data;
}

function publicPaymentOptions(shop) {
  const manualMethods = (shop.payment_methods || []).filter(
    (method) => method && method.id && method.label && method.enabled !== false,
  );
  const stripeReady =
    stripeIsConfigured() && Boolean(process.env.STRIPE_WEBHOOK_SECRET);

  return {
    payment_methods: [
      ...manualMethods.map((method) => ({
        id: method.id,
        label: method.label,
        instructions: method.instructions || '',
        type: 'manual',
      })),
      ...(stripeReady
        ? [
            {
              id: 'stripe',
              label: 'Secure online payment',
              instructions: 'Payment is completed on Stripe’s hosted checkout page.',
              type: 'online',
            },
          ]
        : []),
    ],
    stripe_ready: stripeReady,
    stripe_setup_needed: stripeIsConfigured() && !process.env.STRIPE_WEBHOOK_SECRET,
  };
}

async function getActiveDeals(db, shopId) {
  const now = new Date();
  const { data, error } = await db
    .from('promotions')
    .select(
      'id, code, name, description, discount_type, discount_value, applies_to, minimum_order_total, maximum_discount, starts_at, ends_at',
    )
    .eq('shop_id', shopId)
    .eq('is_active', true)
    .lte('starts_at', now.toISOString())
    .order('starts_at', { ascending: false });

  if (error) throw error;
  return (data || [])
    .filter((promotion) => !promotion.ends_at || new Date(promotion.ends_at) > now)
    .map((promotion) => ({
      ...promotion,
      // Do not reveal a code to the customer unless it is actually required to redeem.
      code: promotion.code || null,
    }));
}

async function listProducts(request, response, next) {
  try {
    const db = getSupabase(request.params.slug);
    const shop = await getActiveShop(db, request.params.slug);

    const [productResult, categoryResult] = await Promise.all([
      db
        .from('products')
        .select(
          'id, shop_id, category_id, name, description, price, available, image_url, is_sample, is_featured, options, display_order, categories(name, slug)',
        )
        .eq('shop_id', shop.id)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      db
        .from('categories')
        .select('id, name, slug, sort_order')
        .eq('shop_id', shop.id)
        .order('sort_order', { ascending: true })
        .order('name', { ascending: true }),
    ]);

    if (productResult.error) throw productResult.error;
    if (categoryResult.error) throw categoryResult.error;

    const products = (productResult.data || []).map((product) => ({
      ...product,
      category_name: product.categories?.name || null,
      category_slug: product.categories?.slug || null,
      categories: undefined,
    }));

    response.set('Cache-Control', 'no-store');
    response.json({
      shop: {
        slug: shop.slug,
        name: shop.name,
        description: shop.description,
        currency: shop.currency,
        is_demo: shop.is_demo,
      },
      categories: categoryResult.data || [],
      products,
    });
  } catch (error) {
    next(error);
  }
}

async function listDeals(request, response, next) {
  try {
    const db = getSupabase(request.params.slug);
    const shop = await getActiveShop(db, request.params.slug);
    const deals = await getActiveDeals(db, shop.id);
    response.json({ deals });
  } catch (error) {
    next(error);
  }
}

async function getCheckoutConfig(request, response, next) {
  try {
    const db = getSupabase(request.params.slug);
    const shop = await getActiveShop(db, request.params.slug);
    const payment = publicPaymentOptions(shop);

    response.set('Cache-Control', 'no-store');
    response.json({
      shop: {
        id: shop.id,
        slug: shop.slug,
        name: shop.name,
        currency: shop.currency,
        is_demo: shop.is_demo,
        fulfillment_options: (shop.fulfillment_options || []).filter(
          (option) => option && option.id && option.label && option.enabled !== false,
        ),
      },
      payment_methods: payment.payment_methods,
      stripe_ready: payment.stripe_ready,
      stripe_setup_needed: payment.stripe_setup_needed,
      sample_orders_enabled: sampleOrdersAreAllowed(),
    });
  } catch (error) {
    next(error);
  }
}

async function quoteCart(request, response, next) {
  try {
    const db = getSupabase(request.params.slug);
    const shop = await getActiveShop(db, request.params.slug);
    const items = normalizeItems(request.body?.items);
    const promoCode = normalizePromoCode(request.body?.promoCode);

    const { data, error } = await db.rpc('quote_shop_cart', {
      p_shop_id: shop.id,
      p_items: items,
      p_promo_code: promoCode,
      p_customer_id: request.user?.id || null,
      p_allow_sample: sampleOrdersAreAllowed(),
    });

    if (error) raiseDatabaseError(error);
    const quote = Array.isArray(data) ? data[0] : data;
    if (!quote) throw new Error('Supabase did not return a cart quote.');

    response.json({
      subtotal: Number(quote.quote_subtotal),
      discount: Number(quote.quote_discount),
      total: Number(quote.quote_total),
      promotion: quote.applied_promotion_id
        ? {
            id: quote.applied_promotion_id,
            name: quote.applied_promotion_name,
            code: quote.applied_coupon_code,
          }
        : null,
      currency: shop.currency,
    });
  } catch (error) {
    next(error);
  }
}

async function getCustomerDashboard(request, response, next) {
  try {
    const db = getSupabase(request.params.slug);
    const shop = await getActiveShop(db, request.params.slug);

    const [profileResult, ordersResult, deals] = await Promise.all([
      db
        .from('profiles')
        .select('id, full_name, phone, created_at, updated_at')
        .eq('id', request.user.id)
        .maybeSingle(),
      db
        .from('orders')
        .select(
          'id, order_number, fulfillment_method, fulfillment_details, payment_method, promo_code, subtotal, discount, total, currency, status, payment_status, is_test_order, created_at, updated_at, order_items(id, product_name, base_unit_price, unit_price, quantity, line_total, selected_options)',
        )
        .eq('customer_id', request.user.id)
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
        .limit(30),
      getActiveDeals(db, shop.id),
    ]);

    if (profileResult.error) throw profileResult.error;
    if (ordersResult.error) throw ordersResult.error;

    response.set('Cache-Control', 'no-store');
    response.json({
      shop: { slug: shop.slug, name: shop.name, currency: shop.currency },
      user: { id: request.user.id, email: request.user.email },
      profile: profileResult.data || {
        id: request.user.id,
        full_name: request.user.user_metadata?.full_name || '',
        phone: '',
      },
      orders: ordersResult.data || [],
      deals,
    });
  } catch (error) {
    next(error);
  }
}

function validateFulfillmentSelection(shop, methodId, details) {
  const option = (shop.fulfillment_options || []).find(
    (candidate) => candidate?.id === methodId && candidate.enabled !== false,
  );
  if (!option) throw httpError(400, 'Choose an available fulfillment method.');
  if (option.requires_details && !details) {
    throw httpError(400, 'Add the fulfillment details requested by this shop.');
  }
  return option;
}

async function createStripeCheckout({ db, shop, order, user, paymentMethod }) {
  const stripe = getStripe();
  const baseUrl = (process.env.PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
  let publicUrl;

  try {
    publicUrl = new URL(baseUrl);
  } catch {
    throw httpError(503, 'PUBLIC_APP_URL must be a valid public URL before Stripe Checkout is enabled.');
  }

  if (!['http:', 'https:'].includes(publicUrl.protocol)) {
    throw httpError(503, 'PUBLIC_APP_URL must use HTTP or HTTPS.');
  }

  const { data: lineItems, error: lineItemsError } = await db
    .from('order_items')
    .select('product_name, unit_price, quantity')
    .eq('order_id', order.id);
  if (lineItemsError) throw lineItemsError;

  const itemSummary = (lineItems || [])
    .map((item) => `${item.quantity} × ${item.product_name}`)
    .join(', ')
    .slice(0, 480);

  const pagePath = SHOP_PAGE_PATHS[shop.slug];
  const session = await stripe.checkout.sessions.create(
    {
      mode: 'payment',
      client_reference_id: order.id,
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: String(shop.currency || 'PHP').toLowerCase(),
            product_data: {
              name: `${shop.name} order ${order.order_number}`,
              description: itemSummary || 'Shop order',
            },
            unit_amount: Math.round(Number(order.total) * 100),
          },
          quantity: 1,
        },
      ],
      metadata: {
        order_id: order.id,
        shop_slug: shop.slug,
        customer_id: user.id,
      },
      success_url: `${baseUrl}${pagePath}?payment=return&session_id={CHECKOUT_SESSION_ID}#account`,
      cancel_url: `${baseUrl}${pagePath}?payment=cancelled#checkout`,
    },
    { idempotencyKey: `cha-order-${order.id}` },
  );

  if (!session.url) throw new Error('Stripe did not return a hosted Checkout URL.');

  const { error: saveSessionError } = await db
    .from('orders')
    .update({ payment_session_id: session.id, payment_status: 'pending' })
    .eq('id', order.id);

  if (saveSessionError) {
    try {
      await stripe.checkout.sessions.expire(session.id);
    } catch (expireError) {
      console.error('Could not expire an unlinked Stripe session:', expireError.message);
    }
    throw saveSessionError;
  }

  return session;
}

async function createOrder(request, response, next) {
  try {
    const db = getSupabase(request.params.slug);
    const shop = await getActiveShop(db, request.params.slug);
    const body = request.body || {};
    const items = normalizeItems(body.items);
    const promoCode = normalizePromoCode(body.promoCode);
    const customerContact = normalizeText(body.customerContact ?? '', 'Contact number', 40);
    const fulfillmentDetails = normalizeText(
      body.fulfillmentDetails ?? '',
      'Fulfillment details',
      1000,
    );
    const paymentMethod = normalizeText(body.paymentMethod, 'Payment method', 60, true);
    const fulfillmentMethod = normalizeText(
      body.fulfillmentMethod,
      'Fulfillment method',
      60,
      true,
    );
    const profileResult = await db
      .from('profiles')
      .select('full_name, phone')
      .eq('id', request.user.id)
      .maybeSingle();
    if (profileResult.error) throw profileResult.error;

    const customerName = normalizeText(
      body.customerName || profileResult.data?.full_name || request.user.user_metadata?.full_name || '',
      'Full name',
      120,
      true,
    );
    const customerEmail = normalizeText(request.user.email || '', 'Account email', 254, true);
    if (!shop.fulfillment_options?.some((option) => option?.enabled !== false)) {
      throw httpError(409, 'This shop has not configured a fulfillment method yet.');
    }
    validateFulfillmentSelection(shop, fulfillmentMethod, fulfillmentDetails);

    const paymentOptions = publicPaymentOptions(shop);
    const selectedPayment = paymentOptions.payment_methods.find(
      (method) => method.id === paymentMethod,
    );
    if (!selectedPayment) {
      throw httpError(409, 'This shop has not configured that payment method.');
    }
    if (paymentMethod === 'stripe' && !paymentOptions.stripe_ready) {
      throw httpError(409, 'Stripe Checkout needs a server secret key and webhook secret.');
    }

    const allowSample = sampleOrdersAreAllowed();
    if (shop.is_demo && !allowSample) {
      throw httpError(409, 'This is a development shop. Replace its demo catalog and configuration before live ordering.');
    }

    if (paymentMethod === 'stripe') {
      const productIds = items.map((item) => item.product_id);
      const { data: catalogItems, error: catalogError } = await db
        .from('products')
        .select('id, is_sample')
        .in('id', productIds);
      if (catalogError) throw catalogError;

      const containsSample = (catalogItems || []).some((item) => item.is_sample);
      const stripeKey = process.env.STRIPE_SECRET_KEY || '';
      const isTestKey = stripeKey.startsWith('sk_test_') || stripeKey.startsWith('rk_test_');
      if (containsSample && !isTestKey) {
        throw httpError(400, 'Sample catalog products can only be checked out with a Stripe test-mode key.');
      }
    }

    const { data: created, error: orderError } = await db.rpc('create_shop_order', {
      p_shop_id: shop.id,
      p_customer_id: request.user.id,
      p_customer_name: customerName,
      p_customer_email: customerEmail,
      p_customer_contact: customerContact || profileResult.data?.phone || '',
      p_fulfillment_method: fulfillmentMethod,
      p_fulfillment_details: fulfillmentDetails,
      p_payment_method: paymentMethod,
      p_promo_code: promoCode,
      p_items: items,
      p_allow_sample: allowSample,
      p_stripe_available: paymentOptions.stripe_ready,
    });

    if (orderError) raiseDatabaseError(orderError);
    const savedOrder = Array.isArray(created) ? created[0] : created;
    if (!savedOrder) throw new Error('Supabase did not return the saved order.');

    if (paymentMethod === 'stripe') {
      try {
        const session = await createStripeCheckout({
          db,
          shop,
          order: {
            id: savedOrder.created_order_id,
            order_number: savedOrder.created_order_number,
            total: Number(savedOrder.created_total),
          },
          user: request.user,
        });

        return response.status(201).json({
          order: {
            id: savedOrder.created_order_id,
            order_number: savedOrder.created_order_number,
            subtotal: Number(savedOrder.created_subtotal),
            discount: Number(savedOrder.created_discount),
            total: Number(savedOrder.created_total),
            status: savedOrder.created_status,
            payment_status: 'pending',
            currency: shop.currency,
            is_test_order: allowSample,
          },
          checkout_url: session.url,
          message: 'Order created. Payment status remains pending until Stripe verifies payment.',
        });
      } catch (paymentError) {
        await db
          .from('orders')
          .update({ payment_status: 'unpaid' })
          .eq('id', savedOrder.created_order_id);
        paymentError.status = paymentError.status || 502;
        paymentError.message = `Order ${savedOrder.created_order_number} was saved, but online checkout could not start. ${paymentError.message}`;
        throw paymentError;
      }
    }

    response.status(201).json({
      order: {
        id: savedOrder.created_order_id,
        order_number: savedOrder.created_order_number,
        subtotal: Number(savedOrder.created_subtotal),
        discount: Number(savedOrder.created_discount),
        total: Number(savedOrder.created_total),
        status: savedOrder.created_status,
        payment_status: savedOrder.created_payment_status,
        currency: shop.currency,
        is_test_order: allowSample,
      },
      payment_instructions: selectedPayment.instructions || '',
      message:
        savedOrder.created_payment_status === 'unpaid'
          ? 'Order saved. Payment is unpaid; no payment has been collected.'
          : 'Order saved.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  createOrder,
  getActiveShop,
  getCustomerDashboard,
  getCheckoutConfig,
  listDeals,
  listProducts,
  normalizeItems,
  quoteCart,
  raiseDatabaseError,
};
