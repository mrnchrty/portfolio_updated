(() => {
  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (character) => {
      const entities = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      };
      return entities[character];
    });
  }

  function formatMoney(amount, currency = 'PHP') {
    const value = Number(amount);
    const validAmount = Number.isFinite(value) ? value : 0;
    const currencyCode = /^[A-Z]{3}$/.test(String(currency)) ? currency : 'PHP';

    try {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: currencyCode,
      }).format(validAmount);
    } catch {
      return `${currencyCode} ${validAmount.toFixed(2)}`;
    }
  }

  function safeImageUrl(value, fallback) {
    if (typeof value !== 'string' || value.trim() === '') return fallback;

    try {
      const resolved = new URL(value, window.location.href);
      const safeWebProtocol = ['http:', 'https:'].includes(resolved.protocol);
      const sameOrigin = safeWebProtocol && resolved.origin === window.location.origin;
      const localFile = resolved.protocol === 'file:' && window.location.protocol === 'file:';
      const secureRemoteImage = resolved.protocol === 'https:' && !resolved.username && !resolved.password;
      if (sameOrigin || localFile || secureRemoteImage) return resolved.href;
    } catch {
      return fallback;
    }

    return fallback;
  }

  async function requestJson(path, options = {}) {
    const requestOptions = {
      method: options.method || 'GET',
      credentials: 'same-origin',
      headers: { ...(options.headers || {}) },
    };

    if (options.body !== undefined) {
      requestOptions.headers['Content-Type'] = 'application/json';
      requestOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(path, requestOptions);
    if (response.status === 204) return null;

    const contentType = response.headers.get('content-type') || '';
    const data = contentType.includes('application/json')
      ? await response.json()
      : { error: await response.text() };

    if (!response.ok) {
      const error = new Error(data?.error || 'The request could not be completed.');
      error.status = response.status;
      throw error;
    }

    return data;
  }

  function friendlyStatus(value) {
    const statusLabels = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      ready_for_pickup: 'Ready for pickup',
      out_for_delivery: 'Out for delivery',
      completed: 'Completed',
      cancelled: 'Cancelled',
      unpaid: 'Unpaid',
      paid: 'Paid',
      failed: 'Failed',
      refunded: 'Refunded',
    };

    return statusLabels[value] || String(value || 'Unknown').replaceAll('_', ' ');
  }

  window.ShopApi = {
    escapeHtml,
    formatMoney,
    friendlyStatus,
    requestJson,
    safeImageUrl,
  };
})();
