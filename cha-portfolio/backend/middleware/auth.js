const { getRequestUser } = require('../services/supabase');

async function optionalAuth(request, response, next) {
  try {
    request.user = await getRequestUser(request, response);
    next();
  } catch (error) {
    next(error);
  }
}

async function requireAuth(request, response, next) {
  try {
    const user = await getRequestUser(request, response);
    if (!user) {
      return response.status(401).json({ error: 'Sign in to continue.' });
    }

    request.user = user;
    next();
  } catch (error) {
    next(error);
  }
}

module.exports = { optionalAuth, requireAuth };
