require('dotenv').config();

const path = require('path');
const cookieParser = require('cookie-parser');
const express = require('express');
const helmet = require('helmet');
const adminRoutes = require('./routes/admin');
const shopRoutes = require('./routes/shops');
const { stripeWebhook } = require('./controllers/paymentController');
const { errorHandler, notFound } = require('./middleware/errors');
const {
  sampleOrdersAreAllowed,
  stripeIsConfigured,
  supabaseIsConfigured,
} = require('./services/supabase');

const app = express();
const projectRoot = path.join(__dirname, '..');
const appUrl = process.env.PUBLIC_APP_URL || 'http://localhost:3000';

app.disable('x-powered-by');
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        formAction: ["'self'", 'https://checkout.stripe.com'],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'https:', 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      },
    },
    crossOriginEmbedderPolicy: false,
  }),
);
app.use(cookieParser());

// Stripe needs the unparsed request body to verify the signed webhook payload.
app.post(
  '/api/payments/webhook',
  express.raw({ type: 'application/json', limit: '100kb' }),
  stripeWebhook,
);

app.use(express.json({ limit: '50kb' }));

function requireSameOriginForMutations(request, response, next) {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) return next();

  const origin = request.get('origin');
  if (!origin) {
    return response.status(403).json({ error: 'This request needs a same-origin browser session.' });
  }

  let originUrl;
  try {
    originUrl = new URL(origin);
  } catch {
    return response.status(403).json({ error: 'Request origin is not valid.' });
  }

  const requestHost = request.get('host');
  const requestProtocol = request.protocol;
  const sameRequestOrigin =
    originUrl.host.toLowerCase() === String(requestHost || '').toLowerCase() &&
    originUrl.protocol === `${requestProtocol}:`;

  let configuredOrigin = false;
  if (process.env.FRONTEND_ORIGIN) {
    try {
      configuredOrigin = originUrl.origin === new URL(process.env.FRONTEND_ORIGIN).origin;
    } catch {
      configuredOrigin = false;
    }
  }

  if (!sameRequestOrigin && !configuredOrigin) {
    return response.status(403).json({ error: 'Cross-origin requests are not allowed.' });
  }

  next();
}

app.use('/api', requireSameOriginForMutations);

app.get('/api/health', (request, response) => {
  response.set('Cache-Control', 'no-store');
  response.json({
    status: 'ok',
    supabaseConfigured: supabaseIsConfigured(),
    supabaseProjects: {
      digicha: supabaseIsConfigured('digicha'),
      mochajaki: supabaseIsConfigured('mochajaki'),
    },
    stripeSecretConfigured: stripeIsConfigured(),
    stripeWebhookConfigured: Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    stripePaymentsReady: stripeIsConfigured() && Boolean(process.env.STRIPE_WEBHOOK_SECRET),
    sampleOrdersEnabled: sampleOrdersAreAllowed(),
    publicAppUrl: appUrl,
  });
});

app.use('/api/shops', shopRoutes);
app.use('/api/admin', adminRoutes);

app.use('/api', (request, response) => {
  response.status(404).json({ error: 'API endpoint not found.' });
});
app.use(express.static(projectRoot, { extensions: ['html'] }));
app.get('/', (request, response) => {
  response.sendFile(path.join(projectRoot, 'portfolio', 'index.html'));
});
app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT || 3000);
app.listen(port, '0.0.0.0', () => {
  console.log(`Cha Portfolio is serving on ${appUrl} (0.0.0.0:${port})`);
});
