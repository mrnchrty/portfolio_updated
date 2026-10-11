function notFound(request, response) {
  if (request.path.startsWith('/api/')) {
    return response.status(404).json({ error: 'API endpoint not found.' });
  }

  response.status(404).type('text/plain').send('Page not found.');
}

function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);

  const status = Number(error.status) || (error.code === 'P0001' ? 400 : 500);
  const message = status >= 500 && !error.expose
    ? 'Unexpected server error. Check the server log for details.'
    : error.message;

  if (status >= 500) {
    console.error(error.message, error.stack);
  } else {
    console.warn(`${request.method} ${request.path}: ${error.message}`);
  }

  response.status(status).json({ error: message });
}

module.exports = { errorHandler, notFound };
