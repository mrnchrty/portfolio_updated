const { getStripe, getSupabase } = require('../services/supabase');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function amountInMinorUnits(value) {
  return Math.round(Number(value) * 100);
}

function sessionMatchesOrder(session, order) {
  const expectedAmount = amountInMinorUnits(order.total);
  return (
    session.id &&
    session.mode === 'payment' &&
    session.metadata?.order_id === order.id &&
    session.client_reference_id === order.id &&
    session.currency?.toUpperCase() === order.currency &&
    session.amount_total === expectedAmount
  );
}

async function findOrderForSession(db, session) {
  const orderId = session.metadata?.order_id || session.client_reference_id;
  if (!UUID_PATTERN.test(String(orderId || ''))) return null;

  const { data, error } = await db
    .from('orders')
    .select('id, customer_id, order_number, total, currency, payment_status, payment_session_id')
    .eq('id', orderId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

async function saveVerifiedPaymentStatus(db, order, session, nextStatus) {
  if (order.payment_status === 'paid' && nextStatus !== 'paid') return;
  if (order.payment_session_id && order.payment_session_id !== session.id) return;

  const update = {
    payment_status: nextStatus,
    payment_session_id: session.id,
  };

  if (session.payment_intent) {
    update.payment_intent_id =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent.id;
  }

  const { error } = await db.from('orders').update(update).eq('id', order.id);
  if (error) throw error;
}

function paymentStatusForSession(eventType, session) {
  if (
    (eventType === 'checkout.session.completed' ||
      eventType === 'checkout.session.async_payment_succeeded') &&
    session.payment_status === 'paid'
  ) {
    return 'paid';
  }
  if (eventType === 'checkout.session.async_payment_failed') return 'failed';
  if (eventType === 'checkout.session.expired') return 'unpaid';
  return null;
}

async function stripeWebhook(request, response) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return response.status(503).json({ error: 'Stripe webhooks are not configured.' });
  }

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      request.body,
      request.get('stripe-signature'),
      webhookSecret,
    );
  } catch (error) {
    return response.status(400).send(`Invalid Stripe webhook signature: ${error.message}`);
  }

  const supportedEvents = new Set([
    'checkout.session.completed',
    'checkout.session.async_payment_succeeded',
    'checkout.session.async_payment_failed',
    'checkout.session.expired',
  ]);

  if (!supportedEvents.has(event.type)) return response.json({ received: true });

  try {
    const session = event.data.object;
    const shopSlug = session.metadata?.shop_slug;
    if (!['digicha', 'mochajaki'].includes(shopSlug)) {
      console.error('Stripe webhook is missing a supported shop slug:', session.id);
      return response.status(400).json({ error: 'Stripe session does not identify a supported shop.' });
    }

    const db = getSupabase(shopSlug);
    const order = await findOrderForSession(db, session);
    if (!order) {
      console.warn('Stripe webhook did not match a stored order:', session.id);
      return response.json({ received: true });
    }

    if (session.metadata?.customer_id !== order.customer_id || !sessionMatchesOrder(session, order)) {
      console.error('Stripe session details did not match the stored order:', order.order_number);
      return response.status(400).json({ error: 'Stripe session did not match the stored order.' });
    }

    const nextStatus = paymentStatusForSession(event.type, session);
    if (nextStatus) await saveVerifiedPaymentStatus(db, order, session, nextStatus);
    response.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook processing failed:', error.message);
    response.status(500).json({ error: 'Stripe webhook could not be processed.' });
  }
}

async function getCheckoutStatus(request, response, next) {
  try {
    const sessionId = request.params.sessionId;
    if (typeof sessionId !== 'string' || !sessionId.startsWith('cs_') || sessionId.length > 200) {
      return response.status(400).json({ error: 'Checkout session ID is not valid.' });
    }

    const shopSlug = request.params.slug;
    const db = getSupabase(shopSlug);
    const { data: order, error } = await db
      .from('orders')
      .select('id, customer_id, order_number, total, currency, payment_status, payment_session_id')
      .eq('payment_session_id', sessionId)
      .eq('customer_id', request.user.id)
      .maybeSingle();

    if (error) throw error;
    if (!order) return response.status(404).json({ error: 'Order not found for this account.' });

    const session = await getStripe().checkout.sessions.retrieve(sessionId);
    if (
      session.metadata?.shop_slug !== shopSlug ||
      session.metadata?.customer_id !== request.user.id ||
      !sessionMatchesOrder(session, order)
    ) {
      return response.status(403).json({ error: 'Checkout session could not be verified for this order.' });
    }

    const status =
      session.payment_status === 'paid'
        ? 'paid'
        : session.status === 'expired'
          ? 'unpaid'
          : 'pending';

    await saveVerifiedPaymentStatus(db, order, session, status);
    response.set('Cache-Control', 'no-store');
    response.json({
      order_number: order.order_number,
      payment_status: status,
      message:
        status === 'paid'
          ? 'Payment confirmed by Stripe.'
          : status === 'unpaid'
            ? 'Checkout ended without a completed payment.'
            : 'Payment is still being verified by Stripe.',
    });
  } catch (error) {
    next(error);
  }
}

module.exports = { getCheckoutStatus, stripeWebhook };
