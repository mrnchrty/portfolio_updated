const {
  clearAuthCookies,
  createAuthClient,
  getAuthCookieNames,
  getSupabase,
  saveAuthCookies,
} = require('../services/supabase');

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function shopSlug(request) {
  return request.params.slug;
}

function normalizeEmail(value) {
  if (typeof value !== 'string') throw validationError('Enter a valid email address.');
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    throw validationError('Enter a valid email address.');
  }
  return email;
}

function normalizeFullName(value) {
  if (typeof value !== 'string' || value.trim().length < 2 || value.length > 120) {
    throw validationError('Enter a name between 2 and 120 characters.');
  }
  return value.trim();
}

function normalizePhone(value) {
  if (typeof value !== 'string' || value.length > 40) {
    throw validationError('Contact number must be 40 characters or fewer.');
  }
  return value.trim();
}

async function getStaffMemberships(userId, slug) {
  const db = getSupabase(slug);
  const { data, error } = await db
    .from('staff_members')
    .select('shop_id, role, shops(slug, name)')
    .eq('user_id', userId)
    .eq('is_active', true);

  if (error) throw error;
  return (data || []).map((membership) => ({
    shop_id: membership.shop_id,
    role: membership.role,
    shop_slug: membership.shops?.slug || null,
    shop_name: membership.shops?.name || null,
  }));
}

async function register(request, response, next) {
  try {
    const slug = shopSlug(request);
    const { email: submittedEmail, password } = request.body || {};
    const fullName = normalizeFullName(request.body?.fullName);
    const email = normalizeEmail(submittedEmail);

    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      throw validationError('Choose a password between 8 and 128 characters.');
    }

    const { data, error } = await createAuthClient(slug).auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });

    if (error) {
      const authError = new Error(error.message || 'Account registration could not be completed.');
      authError.status = 400;
      throw authError;
    }
    if (!data?.user) throw new Error('Supabase did not return a new account.');

    const db = getSupabase(slug);
    const { error: profileError } = await db.from('profiles').upsert(
      { id: data.user.id, full_name: fullName, phone: '' },
      { onConflict: 'id' },
    );
    if (profileError) throw profileError;

    if (data.session) saveAuthCookies(response, data.session, slug);

    response.status(201).json({
      authenticated: Boolean(data.session),
      needsEmailConfirmation: !data.session,
      message: data.session
        ? 'Your account is ready.'
        : 'Check your email to confirm your account, then sign in.',
    });
  } catch (error) {
    next(error);
  }
}

async function login(request, response, next) {
  try {
    const slug = shopSlug(request);
    const email = normalizeEmail(request.body?.email);
    const password = request.body?.password;

    if (typeof password !== 'string' || password.length < 1 || password.length > 128) {
      throw validationError('Enter your email and password.');
    }

    const { data, error } = await createAuthClient(slug).auth.signInWithPassword({ email, password });
    if (error || !data?.session || !data?.user) {
      const signInError = new Error('Email or password is incorrect, or the account needs email confirmation.');
      signInError.status = 401;
      throw signInError;
    }

    saveAuthCookies(response, data.session, slug);
    response.json({ authenticated: true, message: 'You are signed in.' });
  } catch (error) {
    next(error);
  }
}

async function logout(request, response) {
  const slug = shopSlug(request);
  const cookies = getAuthCookieNames(slug);
  const accessToken = request.cookies?.[cookies.access];
  const refreshToken = request.cookies?.[cookies.refresh];

  if (accessToken && refreshToken) {
    try {
      const authClient = createAuthClient(slug);
      await authClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      await authClient.auth.signOut({ scope: 'local' });
    } catch (error) {
      // The shop-specific browser session is cleared even if Auth cannot confirm sign-out.
      console.warn(`Supabase sign-out for ${slug} could not be confirmed:`, error.message);
    }
  }

  clearAuthCookies(response, slug);
  response.status(204).end();
}

async function getMe(request, response, next) {
  try {
    const slug = shopSlug(request);
    const db = getSupabase(slug);
    const { data: profile, error: profileError } = await db
      .from('profiles')
      .select('id, full_name, phone, created_at, updated_at')
      .eq('id', request.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    const memberships = await getStaffMemberships(request.user.id, slug);

    response.set('Cache-Control', 'no-store');
    response.json({
      shop_slug: slug,
      user: {
        id: request.user.id,
        email: request.user.email,
        email_confirmed: Boolean(request.user.email_confirmed_at),
      },
      profile: profile || {
        id: request.user.id,
        full_name: request.user.user_metadata?.full_name || '',
        phone: '',
      },
      staff_memberships: memberships,
    });
  } catch (error) {
    next(error);
  }
}

async function updateProfile(request, response, next) {
  try {
    const fullName = normalizeFullName(request.body?.fullName);
    const phone = normalizePhone(request.body?.phone ?? '');
    const db = getSupabase(shopSlug(request));
    const { data, error } = await db
      .from('profiles')
      .upsert(
        { id: request.user.id, full_name: fullName, phone },
        { onConflict: 'id' },
      )
      .select('id, full_name, phone, created_at, updated_at')
      .single();

    if (error) throw error;
    response.json({ profile: data, message: 'Account information updated.' });
  } catch (error) {
    next(error);
  }
}

module.exports = { getMe, login, logout, register, updateProfile };
