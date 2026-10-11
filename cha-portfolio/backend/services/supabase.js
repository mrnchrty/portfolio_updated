const { createClient } = require('@supabase/supabase-js');
const Stripe = require('stripe');

const ACCESS_COOKIE = 'cha-shop-access';
const REFRESH_COOKIE = 'cha-shop-refresh';
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

let serviceClient;
let stripeClient;

function configurationError(message) {
  const error = new Error(message);
  error.status = 503;
  return error;
}

function getSupabaseUrl() {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw configurationError('Set SUPABASE_URL in backend/.env to connect this project to Supabase.');
  }
  return url.replace(/\/$/, '');
}

function getSupabase() {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    throw configurationError(
      'Set SUPABASE_SERVICE_ROLE_KEY in backend/.env. Keep this secret on the server only.',
    );
  }

  if (!serviceClient) {
    serviceClient = createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  return serviceClient;
}

function createAuthClient() {
  const url = getSupabaseUrl();
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!anonKey) {
    throw configurationError(
      'Set SUPABASE_ANON_KEY in backend/.env so the server can use Supabase Auth.',
    );
  }

  // Create one non-persistent client per request. Customer sessions must never be shared
  // between Express requests or stored in browser localStorage.
  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
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

function saveAuthCookies(response, session) {
  if (!session?.access_token || !session?.refresh_token) return;

  const accessLifetime = Math.max(60, Number(session.expires_in) || 3600) * 1000;
  response.cookie(ACCESS_COOKIE, session.access_token, cookieOptions(accessLifetime));
  response.cookie(REFRESH_COOKIE, session.refresh_token, cookieOptions(REFRESH_COOKIE_MAX_AGE));
}

function clearAuthCookies(response) {
  const options = cookieOptions(0);
  response.clearCookie(ACCESS_COOKIE, options);
  response.clearCookie(REFRESH_COOKIE, options);
}

async function getRequestUser(request, response) {
  const accessToken = request.cookies?.[ACCESS_COOKIE];
  const refreshToken = request.cookies?.[REFRESH_COOKIE];

  if (!accessToken && !refreshToken) return null;

  if (accessToken) {
    try {
      const { data, error } = await createAuthClient().auth.getUser(accessToken);
      if (!error && data?.user) return data.user;
    } catch (error) {
      if (error.status === 503) throw error;
    }
  }

  if (refreshToken) {
    try {
      const { data, error } = await createAuthClient().auth.refreshSession({
        refresh_token: refreshToken,
      });

      if (!error && data?.session && data?.user) {
        saveAuthCookies(response, data.session);
        return data.user;
      }
    } catch (error) {
      if (error.status === 503) throw error;
    }
  }

  clearAuthCookies(response);
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

function supabaseIsConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
      process.env.SUPABASE_ANON_KEY &&
      process.env.SUPABASE_SERVICE_ROLE_KEY,
  );
}

module.exports = {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  createAuthClient,
  getRequestUser,
  getStripe,
  getSupabase,
  saveAuthCookies,
  sampleOrdersAreAllowed,
  stripeIsConfigured,
  supabaseIsConfigured,
};
