const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
const SHOP_ENV_PREFIXES = Object.freeze({
  digicha: 'DIGICHA',
  mochajaki: 'MOCHAJAKI',
});

const serviceClients = new Map();
let stripeClient;

function configurationError(message, status = 503) {
  const error = new Error(message);
  error.status = status;
  error.expose = status === 503;
  return error;
}

function normalizeShopSlug(slug) {
  if (typeof slug !== 'string' || !Object.hasOwn(SHOP_ENV_PREFIXES, slug)) {
    throw configurationError('Shop not found.', 404);
  }
  return slug;
}

function shopEnvironment(slug, setting) {
  const normalizedSlug = normalizeShopSlug(slug);
  const prefix = SHOP_ENV_PREFIXES[normalizedSlug];
  return process.env[`${prefix}_SUPABASE_${setting}`];
}

function isPlaceholder(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return !normalized
    || normalized.startsWith('replace_with')
    || normalized.includes('your-digicha-project-ref')
    || normalized.includes('your-mochajaki-project-ref');
}

function getSupabaseUrl(slug) {
  const normalizedSlug = normalizeShopSlug(slug);
  const prefix = SHOP_ENV_PREFIXES[normalizedSlug];
  const url = shopEnvironment(normalizedSlug, 'URL');
  if (isPlaceholder(url)) {
    throw configurationError(
      `Set ${prefix}_SUPABASE_URL in backend/.env to the real URL for the ${normalizedSlug} shop’s Supabase project.`,
    );
  }
  return url.replace(/\/$/, '');
}

function getSupabase(slug) {
  const normalizedSlug = normalizeShopSlug(slug);
  const url = getSupabaseUrl(normalizedSlug);
  const prefix = SHOP_ENV_PREFIXES[normalizedSlug];
  const serviceRoleKey = shopEnvironment(normalizedSlug, 'SERVICE_ROLE_KEY');

  if (isPlaceholder(serviceRoleKey)) {
    throw configurationError(
      `Set ${prefix}_SUPABASE_SERVICE_ROLE_KEY in backend/.env to the real server-only key.`,
    );
  }

  if (!serviceClients.has(normalizedSlug)) {
    serviceClients.set(normalizedSlug, createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }));
  }

  return serviceClients.get(normalizedSlug);
}

function createAuthClient(slug) {
  const normalizedSlug = normalizeShopSlug(slug);
  const url = getSupabaseUrl(normalizedSlug);
  const prefix = SHOP_ENV_PREFIXES[normalizedSlug];
  const anonKey = shopEnvironment(normalizedSlug, 'ANON_KEY');

  if (isPlaceholder(anonKey)) {
    throw configurationError(
      `Set ${prefix}_SUPABASE_ANON_KEY in backend/.env to the real public/anon key for the ${normalizedSlug} project.`,
    );
  }

  // Create one non-persistent client per request. A project's customer session must never be
  // shared with the other shop or stored in browser localStorage.
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function getAuthCookieNames(slug) {
  const normalizedSlug = normalizeShopSlug(slug);
  return {
    access: `cha-shop-${normalizedSlug}-access`,
    refresh: `cha-shop-${normalizedSlug}-refresh`,
  };
}

function cookieOptions(maxAge) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

function saveAuthCookies(response, session, slug) {
  if (!session?.access_token || !session?.refresh_token) return;

  const cookies = getAuthCookieNames(slug);
  const accessLifetime = Math.max(60, Number(session.expires_in) || 3600) * 1000;
  response.cookie(cookies.access, session.access_token, cookieOptions(accessLifetime));
  response.cookie(cookies.refresh, session.refresh_token, cookieOptions(REFRESH_COOKIE_MAX_AGE));
}

function clearAuthCookies(response, slug) {
  const cookies = getAuthCookieNames(slug);
  const options = cookieOptions(0);
  response.clearCookie(cookies.access, options);
  response.clearCookie(cookies.refresh, options);
}

async function getRequestUser(request, response, slug) {
  const cookies = getAuthCookieNames(slug);
  const accessToken = request.cookies?.[cookies.access];
  const refreshToken = request.cookies?.[cookies.refresh];

  if (!accessToken && !refreshToken) return null;

  if (accessToken) {
    try {
      const { data, error } = await createAuthClient(slug).auth.getUser(accessToken);
      if (!error && data?.user) return data.user;
    } catch (error) {
      if (error.status === 503) throw error;
    }
  }

  if (refreshToken) {
    try {
      const { data, error } = await createAuthClient(slug).auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (!error && data?.session && data?.user) {
        saveAuthCookies(response, data.session, slug);
        return data.user;
      }
    } catch (error) {
      if (error.status === 503) throw error;
    }
  }

  clearAuthCookies(response, slug);
  return null;
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw configurationError(
      'Stripe is not configured. Add a server-side STRIPE_SECRET_KEY before offering online payment.',
    );
  }

  if (!stripeClient) stripeClient = new Stripe(secretKey);
  return stripeClient;
}

function stripeIsConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

function sampleOrdersAreAllowed() {
  return (
    process.env.NODE_ENV !== 'production' &&
    String(process.env.ALLOW_SAMPLE_ORDERS).toLowerCase() === 'true'
  );
}

function missingSupabaseSettings(slug) {
  const normalizedSlug = normalizeShopSlug(slug);
  const prefix = SHOP_ENV_PREFIXES[normalizedSlug];
  const requiredSettings = ['URL', 'ANON_KEY', 'SERVICE_ROLE_KEY'];
  return requiredSettings
    .filter((setting) => isPlaceholder(shopEnvironment(normalizedSlug, setting)))
    .map((setting) => `${prefix}_SUPABASE_${setting}`);
}

function supabaseIsConfigured(slug) {
  const shops = slug ? [normalizeShopSlug(slug)] : Object.keys(SHOP_ENV_PREFIXES);
  return shops.every((shopSlug) => missingSupabaseSettings(shopSlug).length === 0);
}

module.exports = {
  clearAuthCookies,
  createAuthClient,
  getAuthCookieNames,
  getRequestUser,
  getStripe,
  getSupabase,
  missingSupabaseSettings,
  saveAuthCookies,
  sampleOrdersAreAllowed,
  stripeIsConfigured,
  supabaseIsConfigured,
};
