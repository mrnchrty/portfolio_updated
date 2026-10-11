(() => {
  const api = window.ShopApi;
  const allowedShops = new Set(['digicha', 'mochajaki']);
  const shopNames = {
    digicha: 'DigiCha',
    mochajaki: 'Mochajaki Snack Corner Gasang',
  };
  const orderStatuses = [
    'pending',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'out_for_delivery',
    'completed',
    'cancelled',
  ];
  const $ = (id) => document.getElementById(id);
  const html = (value) => api.escapeHtml(value);

  let shopSlug = new URLSearchParams(window.location.search).get('shop') || 'digicha';
  if (!allowedShops.has(shopSlug)) shopSlug = 'digicha';
  let currentUser = null;
  let overview = null;
  let busy = false;

  const elements = {
    accessMessage: $('admin-access-message'),
    accessPanel: $('admin-access-panel'),
    description: $('admin-description'),
    demoNotice: $('admin-demo-notice'),
    loginForm: $('admin-login-form'),
    ordersList: $('admin-orders-list'),
    overviewGrid: $('admin-stat-grid'),
    productForm: $('admin-product-form'),
    productFormTitle: $('admin-product-form-title'),
    productList: $('admin-products-list'),
    promotionForm: $('admin-promotion-form'),
    promotionList: $('admin-promotions-list'),
    roleBadge: $('admin-role-badge'),
    sessionLabel: $('admin-session-label'),
    settingsForm: $('admin-settings-form'),
    shopSelect: $('admin-shop-select'),
    signout: $('admin-signout'),
    status: $('admin-status'),
    title: $('admin-title'),
    workspace: $('admin-workspace'),
  };

  function setMessage(element, message, kind = '') {
    if (!element) return;
    element.textContent = message || '';
    const baseClass = element.dataset.baseClass || element.className.replace(/\s+is-(error|success|info)/g, '');
    element.dataset.baseClass = baseClass;
    element.className = `${baseClass}${kind ? ` is-${kind}` : ''}`;
  }

  function shopEndpoint(path = '') {
    return `/api/admin/shops/${encodeURIComponent(shopSlug)}${path}`;
  }

  function authEndpoint(path = '') {
    return `/api/shops/${encodeURIComponent(shopSlug)}/auth${path}`;
  }

  function money(amount) {
    return api.formatMoney(amount, overview?.shop?.currency || 'PHP');
  }

  function dateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Date unavailable';
    return new Intl.DateTimeFormat('en', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(date);
  }

  function dateInputValue(value) {
    const date = value ? new Date(value) : new Date();
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  }

  function setBusy(button, busyState, busyText, defaultText) {
    if (!button) return;
    button.disabled = busyState;
    if (busyState) {
      button.dataset.defaultText = button.textContent;
      button.textContent = busyText;
    } else {
      button.textContent = defaultText || button.dataset.defaultText || button.textContent;
    }
  }

  function setShopSlug(nextSlug) {
    if (!allowedShops.has(nextSlug)) return;
    shopSlug = nextSlug;
    const url = new URL(window.location.href);
    url.searchParams.set('shop', shopSlug);
    window.history.replaceState({}, '', url);
    refreshOverview();
  }

  function renderAccessError(error) {
    elements.workspace.hidden = true;
    elements.accessPanel.hidden = false;
    elements.loginForm.hidden = Boolean(currentUser);
    if (elements.signout) elements.signout.hidden = !currentUser;
    if (elements.sessionLabel) elements.sessionLabel.textContent = currentUser?.email || 'Not signed in';

    if (error?.status === 401) {
      setMessage(elements.accessMessage, 'Sign in with your Supabase account. Admin access is available only after a trusted shop owner adds an active staff membership.', 'info');
      elements.roleBadge.textContent = 'Staff access required';
    } else if (error?.status === 403) {
      setMessage(elements.accessMessage, 'This account is signed in but does not have active staff access to this shop. Ask the project owner to add it to staff_members, then refresh.', 'error');
      elements.roleBadge.textContent = 'Not authorized for this shop';
    } else {
      setMessage(elements.accessMessage, error?.message || 'Shop admin could not be loaded. Check the backend and Supabase setup.', 'error');
      elements.roleBadge.textContent = 'Setup required';
    }
  }

  async function loadSession() {
    try {
      const result = await api.requestJson(authEndpoint('/me'));
      currentUser = result.user || null;
    } catch {
      currentUser = null;
    }
    if (elements.sessionLabel) elements.sessionLabel.textContent = currentUser?.email || 'Not signed in';
    if (elements.signout) elements.signout.hidden = !currentUser;
  }

  async function refreshOverview() {
    if (busy) return;
    busy = true;
    if (elements.shopSelect) elements.shopSelect.value = shopSlug;
    if (elements.title) elements.title.textContent = `${shopNames[shopSlug]} admin`;
    if (elements.description) elements.description.textContent = `Manage the ${shopNames[shopSlug]} catalog, orders, promotions, and shop-specific configuration.`;
    if (elements.status) setMessage(elements.status, 'Loading shop records…', 'info');

    try {
      const result = await api.requestJson(shopEndpoint('/overview'));
      overview = result;
      await loadSession();
      renderOverview();
      elements.accessPanel.hidden = true;
      elements.workspace.hidden = false;
      elements.roleBadge.textContent = `${result.staff_role || 'Staff'} · ${shopNames[shopSlug]}`;
      elements.demoNotice.hidden = !result.shop?.is_demo;
      if (elements.status) setMessage(elements.status, `Loaded ${result.orders?.length || 0} recent orders, ${result.products?.length || 0} products, and ${result.promotions?.length || 0} promotions for ${shopNames[shopSlug]}.`, 'success');
    } catch (error) {
      if (error?.status === 401 || error?.status === 403) await loadSession();
      renderAccessError(error);
      if (elements.status) setMessage(elements.status, '', '');
    } finally {
      busy = false;
    }
  }

  function renderOverview() {
    const orders = Array.isArray(overview?.orders) ? overview.orders : [];
    const products = Array.isArray(overview?.products) ? overview.products : [];
    const promotions = Array.isArray(overview?.promotions) ? overview.promotions : [];
    const unpaid = orders.filter((order) => order.payment_status !== 'paid').length;
    const activePromotions = promotions.filter((promotion) => promotion.is_active).length;

    elements.overviewGrid.innerHTML = [
      ['Recent orders', orders.length],
      ['Catalog entries', products.length],
      ['Unpaid / pending', unpaid],
      ['Active promotions', activePromotions],
    ].map(([label, value]) => `
      <article class="admin-stat-card">
        <span>${html(label)}</span>
        <strong>${Number(value)}</strong>
      </article>
    `).join('');

    fillCategorySelects();
    renderProducts();
    renderOrders();
    renderPromotions();
    fillSettingsForm();
  }

  function fillCategorySelects() {
    const categories = Array.isArray(overview?.categories) ? overview.categories : [];
    const products = Array.isArray(overview?.products) ? overview.products : [];
    const categoryOptions = '<option value="">No category</option>' + categories
      .map((category) => `<option value="${html(category.id)}">${html(category.name)}</option>`).join('');

    const productCategory = elements.productForm?.elements.categoryId;
    if (productCategory) {
      const selected = productCategory.value;
      productCategory.innerHTML = categoryOptions;
      if (categories.some((category) => category.id === selected)) productCategory.value = selected;
    }

    const promotionCategory = elements.promotionForm?.elements.categoryId;
    if (promotionCategory) {
      promotionCategory.innerHTML = '<option value="">Choose a category</option>' + categories
        .map((category) => `<option value="${html(category.id)}">${html(category.name)}</option>`).join('');
    }

    const promotionProduct = elements.promotionForm?.elements.productId;
    if (promotionProduct) {
      promotionProduct.innerHTML = '<option value="">Choose a product</option>' + products
        .map((product) => `<option value="${html(product.id)}">${html(product.name)}</option>`).join('');
    }
  }

  function renderProducts() {
    const products = Array.isArray(overview?.products) ? overview.products : [];
    if (!products.length) {
      elements.productList.innerHTML = '<p class="admin-empty">No catalog entries yet. Add verified product information and image paths to get started.</p>';
      return;
    }

    elements.productList.innerHTML = products.map((product) => {
      const badges = [
        product.available ? '<span class="admin-badge">Available</span>' : '<span class="admin-badge is-disabled">Unavailable</span>',
        product.is_sample ? '<span class="admin-badge is-sample">Demo sample</span>' : '',
        product.is_featured ? '<span class="admin-badge">Featured</span>' : '',
        product.category_name ? `<span class="admin-badge">${html(product.category_name)}</span>` : '',
      ].filter(Boolean).join('');
      const optionSummary = Array.isArray(product.options) && product.options.length
        ? JSON.stringify(product.options, null, 2)
        : 'No product options configured.';

      return `
        <article class="admin-card">
          <div class="admin-card-heading">
            <div>
              <h3>${html(product.name)} <span class="muted">· ${money(product.price)}</span></h3>
              <p>${html(product.description || 'No description set.')}</p>
            </div>
            <span class="admin-badge-row">${badges}</span>
          </div>
          <p class="admin-card-copy">Image: ${html(product.image_url || 'empty product-image slot')}</p>
          <details class="admin-options-details">
            <summary>Product options</summary>
            <pre>${html(optionSummary)}</pre>
          </details>
          <div class="admin-card-actions">
            <button class="admin-button admin-button-secondary" type="button" data-product-edit="${html(product.id)}">Edit product</button>
            <button class="admin-button admin-button-quiet" type="button" data-product-availability="${html(product.id)}" data-next-availability="${product.available ? 'false' : 'true'}">${product.available ? 'Mark unavailable' : 'Mark available'}</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function validStatusesFor(order) {
    const statuses = orderStatuses.filter((status) => {
      if (status === 'ready_for_pickup') return /pickup|collection/i.test(order.fulfillment_method || '');
      if (status === 'out_for_delivery') return /delivery/i.test(order.fulfillment_method || '');
      return true;
    });
    if (!statuses.includes(order.status)) statuses.push(order.status);
    return statuses;
  }

  function renderOrders() {
    const orders = Array.isArray(overview?.orders) ? overview.orders : [];
    if (!orders.length) {
      elements.ordersList.innerHTML = '<p class="admin-empty">No orders have been recorded for this shop.</p>';
      return;
    }

    elements.ordersList.innerHTML = orders.map((order) => {
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      const itemDetails = items.map((item) => {
        const options = item.selected_options && Object.keys(item.selected_options).length
          ? ` · Options: ${Object.entries(item.selected_options).map(([group, choice]) => `${group}: ${Array.isArray(choice) ? choice.join(', ') : choice}`).join('; ')}`
          : '';
        return `<span>${html(item.product_name)} × ${Number(item.quantity)} — ${money(item.line_total)}${html(options)}</span>`;
      }).join('');
      const paymentClass = order.payment_status === 'paid' ? 'admin-badge' : 'admin-badge is-sample';
      const statusOptions = validStatusesFor(order)
        .map((status) => `<option value="${html(status)}" ${status === order.status ? 'selected' : ''}>${html(api.friendlyStatus(status))}</option>`)
        .join('');

      return `
        <article class="admin-card admin-order-card" data-order-card="${html(order.id)}">
          <div class="admin-card-heading">
            <div>
              <h3>${html(order.order_number)} · ${money(order.total)}</h3>
              <p>${html(dateTime(order.created_at))}${order.is_test_order ? ' · Development sample order' : ''}</p>
            </div>
            <div class="admin-badge-row">
              <span class="admin-badge">${html(api.friendlyStatus(order.status))}</span>
              <span class="${paymentClass}">Payment ${html(api.friendlyStatus(order.payment_status))}</span>
              ${order.is_test_order ? '<span class="admin-badge is-sample">DEMO · UNPAID</span>' : ''}
            </div>
          </div>
          <div class="admin-order-meta">
            <span><strong>Customer:</strong> ${html(order.customer_name)} · ${html(order.customer_email)}</span>
            ${order.customer_contact ? `<span><strong>Contact:</strong> ${html(order.customer_contact)}</span>` : ''}
            <span><strong>Fulfillment:</strong> ${html(order.fulfillment_method)}${order.fulfillment_details ? ` · ${html(order.fulfillment_details)}` : ''}</span>
            <span><strong>Payment method:</strong> ${html(order.payment_method)}</span>
            <span><strong>Subtotal:</strong> ${money(order.subtotal)} · <strong>Discount:</strong> ${money(order.discount)} · <strong>Total:</strong> ${money(order.total)}</span>
          </div>
          <div class="admin-order-items"><strong>Order items</strong>${itemDetails || '<span>Item details unavailable.</span>'}</div>
          <form class="admin-status-form" data-order-status-form="${html(order.id)}">
            <label>
              Update fulfillment status
              <select name="status">${statusOptions}</select>
            </label>
            <button class="admin-button admin-button-primary" type="submit">Save status</button>
          </form>
        </article>
      `;
    }).join('');
  }

  function promotionIsCurrent(promotion) {
    const now = Date.now();
    const starts = promotion.starts_at ? new Date(promotion.starts_at).getTime() : 0;
    const ends = promotion.ends_at ? new Date(promotion.ends_at).getTime() : Number.POSITIVE_INFINITY;
    return promotion.is_active && starts <= now && ends > now;
  }

  function promotionTarget(promotion) {
    if (promotion.applies_to === 'product') {
      const product = overview?.products?.find((item) => item.id === promotion.product_id);
      return `Product: ${product?.name || 'selected product'}`;
    }
    if (promotion.applies_to === 'category') {
      const category = overview?.categories?.find((item) => item.id === promotion.category_id);
      return `Category: ${category?.name || 'selected category'}`;
    }
    return 'Whole order';
  }

  function renderPromotions() {
    const promotions = Array.isArray(overview?.promotions) ? overview.promotions : [];
    if (!promotions.length) {
      elements.promotionList.innerHTML = '<p class="admin-empty">No promotions configured. Do not add a discount until its terms, value, dates, and eligibility are confirmed.</p>';
      return;
    }

    elements.promotionList.innerHTML = promotions.map((promotion) => {
      const discount = promotion.discount_type === 'percent'
        ? `${Number(promotion.discount_value)}% off`
        : `${money(promotion.discount_value)} off`;
      const badges = [
        promotion.is_active ? '<span class="admin-badge">Enabled</span>' : '<span class="admin-badge is-disabled">Disabled</span>',
        promotionIsCurrent(promotion) ? '<span class="admin-badge">Currently in date</span>' : '<span class="admin-badge is-sample">Not currently active</span>',
        promotion.code ? `<span class="admin-badge">Code: ${html(promotion.code)}</span>` : '<span class="admin-badge">Automatic</span>',
      ].join('');
      const dates = `${promotion.starts_at ? dateTime(promotion.starts_at) : 'Start date not set'}${promotion.ends_at ? ` → ${dateTime(promotion.ends_at)}` : ' → no end date'}`;
      const limits = [
        Number(promotion.minimum_order_total) > 0 ? `Minimum order ${money(promotion.minimum_order_total)}` : '',
        promotion.maximum_discount ? `Maximum discount ${money(promotion.maximum_discount)}` : '',
        promotion.maximum_redemptions ? `Maximum ${promotion.maximum_redemptions} total redemptions` : '',
        promotion.maximum_redemptions_per_customer ? `${promotion.maximum_redemptions_per_customer} per customer` : '',
      ].filter(Boolean).join(' · ');

      return `
        <article class="admin-card">
          <div class="admin-card-heading">
            <div>
              <h3>${html(promotion.name)} · ${html(discount)}</h3>
              <p>${html(promotion.description || 'No description set.')}</p>
            </div>
            <div class="admin-badge-row">${badges}</div>
          </div>
          <div class="admin-order-meta">
            <span><strong>Applies to:</strong> ${html(promotionTarget(promotion))}</span>
            <span><strong>Dates:</strong> ${html(dates)}</span>
            ${limits ? `<span><strong>Limits:</strong> ${html(limits)}</span>` : ''}
          </div>
          <div class="admin-card-actions">
            <button class="admin-button admin-button-secondary" type="button" data-promotion-active="${html(promotion.id)}" data-next-active="${promotion.is_active ? 'false' : 'true'}">${promotion.is_active ? 'Deactivate' : 'Activate'}</button>
          </div>
        </article>
      `;
    }).join('');
  }

  function fillSettingsForm() {
    const form = elements.settingsForm;
    const shop = overview?.shop;
    if (!form || !shop) return;
    form.elements.currency.value = shop.currency || 'PHP';
    form.elements.isDemo.checked = Boolean(shop.is_demo);
    form.elements.fulfillmentOptions.value = JSON.stringify(shop.fulfillment_options || [], null, 2);
    form.elements.paymentMethods.value = JSON.stringify(shop.payment_methods || [], null, 2);
  }

  function openProductForm(product = null) {
    const form = elements.productForm;
    if (!form) return;
    fillCategorySelects();
    form.reset();
    form.hidden = false;
    form.elements.productId.value = product?.id || '';
    form.elements.name.value = product?.name || '';
    form.elements.price.value = product ? String(product.price) : '';
    form.elements.description.value = product?.description || '';
    form.elements.imageUrl.value = product?.image_url || '';
    form.elements.categoryId.value = product?.category_id || '';
    form.elements.displayOrder.value = String(product?.display_order ?? 0);
    form.elements.options.value = JSON.stringify(product?.options || [], null, 2);
    form.elements.available.checked = product ? Boolean(product.available) : true;
    form.elements.featured.checked = product ? Boolean(product.is_featured) : false;
    form.elements.sample.checked = product ? Boolean(product.is_sample) : Boolean(overview?.shop?.is_demo);
    elements.productFormTitle.textContent = product ? `Edit ${product.name}` : 'Add a product';
    setMessage(form.querySelector('[data-product-feedback]'), '', '');
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    form.elements.name.focus({ preventScroll: true });
  }

  function closeProductForm() {
    elements.productForm.hidden = true;
    elements.productForm.reset();
  }

  async function saveProduct(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const feedback = form.querySelector('[data-product-feedback]');
    const button = form.querySelector('[type="submit"]');
    let options;
    try {
      options = JSON.parse(formData.get('options') || '[]');
      if (!Array.isArray(options)) throw new Error('Product options must be a JSON array.');
    } catch (error) {
      setMessage(feedback, error.message || 'Product options must be valid JSON.', 'error');
      return;
    }

    const productId = String(formData.get('productId') || '');
    const body = {
      name: formData.get('name'),
      description: formData.get('description') || '',
      price: Number(formData.get('price')),
      categoryId: formData.get('categoryId') || null,
      imageUrl: String(formData.get('imageUrl') || '').trim() || null,
      displayOrder: Number(formData.get('displayOrder') || 0),
      available: form.elements.available.checked,
      isFeatured: form.elements.featured.checked,
      isSample: form.elements.sample.checked,
      options,
    };

    setBusy(button, true, 'Saving…');
    setMessage(feedback, '', '');
    try {
      const result = await api.requestJson(shopEndpoint(`/products${productId ? `/${encodeURIComponent(productId)}` : ''}`), {
        method: productId ? 'PATCH' : 'POST',
        body,
      });
      setMessage(feedback, result.message || 'Product saved.', 'success');
      await refreshOverview();
      elements.productForm.hidden = true;
    } catch (error) {
      setMessage(feedback, error.message || 'Product could not be saved.', 'error');
    } finally {
      setBusy(button, false, '', 'Save product');
    }
  }

  async function setProductAvailability(productId, available) {
    try {
      const result = await api.requestJson(shopEndpoint(`/products/${encodeURIComponent(productId)}`), {
        method: 'PATCH',
        body: { available },
      });
      setMessage(elements.status, result.message || 'Product availability updated.', 'success');
      await refreshOverview();
    } catch (error) {
      setMessage(elements.status, error.message || 'Availability could not be updated.', 'error');
    }
  }

  async function updateOrderStatus(event) {
    const form = event.target.closest('[data-order-status-form]');
    if (!form || !elements.ordersList.contains(form)) return;
    event.preventDefault();
    const orderId = form.dataset.orderStatusForm;
    const button = form.querySelector('[type="submit"]');
    setBusy(button, true, 'Saving…');
    try {
      const result = await api.requestJson(shopEndpoint(`/orders/${encodeURIComponent(orderId)}/status`), {
        method: 'PATCH',
        body: { status: form.elements.status.value },
      });
      setMessage(elements.status, result.message || 'Order status updated. Customer tracking will show the latest saved status.', 'success');
      await refreshOverview();
    } catch (error) {
      setMessage(elements.status, error.message || 'Order status could not be updated.', 'error');
    }
  }

  function syncPromotionTargetFields() {
    const form = elements.promotionForm;
    if (!form) return;
    const target = form.elements.appliesTo.value;
    const productField = form.querySelector('[data-promotion-target="product"]');
    const categoryField = form.querySelector('[data-promotion-target="category"]');
    productField.hidden = target !== 'product';
    categoryField.hidden = target !== 'category';
    form.elements.productId.required = target === 'product';
    form.elements.categoryId.required = target === 'category';
  }

  function openPromotionForm() {
    elements.promotionForm.reset();
    elements.promotionForm.hidden = false;
    elements.promotionForm.elements.startsAt.value = dateInputValue(new Date());
    elements.promotionForm.elements.appliesTo.value = 'order';
    elements.promotionForm.elements.isActive.checked = true;
    fillCategorySelects();
    syncPromotionTargetFields();
    setMessage(elements.promotionForm.querySelector('[data-promotion-feedback]'), '', '');
    elements.promotionForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
    elements.promotionForm.elements.name.focus({ preventScroll: true });
  }

  async function savePromotion(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const feedback = form.querySelector('[data-promotion-feedback]');
    const button = form.querySelector('[type="submit"]');
    const dateToIso = (value) => value ? new Date(value).toISOString() : null;
    const optionalNumber = (value) => value === '' ? null : Number(value);
    const body = {
      name: formData.get('name'),
      code: String(formData.get('code') || '').trim().toUpperCase() || null,
      description: formData.get('description') || '',
      discountType: formData.get('discountType'),
      discountValue: Number(formData.get('discountValue')),
      appliesTo: formData.get('appliesTo'),
      productId: formData.get('productId') || null,
      categoryId: formData.get('categoryId') || null,
      minimumOrderTotal: Number(formData.get('minimumOrderTotal') || 0),
      maximumDiscount: optionalNumber(formData.get('maximumDiscount')),
      startsAt: dateToIso(formData.get('startsAt')),
      endsAt: dateToIso(formData.get('endsAt')),
      maximumRedemptions: optionalNumber(formData.get('maximumRedemptions')),
      maximumRedemptionsPerCustomer: optionalNumber(formData.get('maximumRedemptionsPerCustomer')),
      isActive: form.elements.isActive.checked,
    };

    setBusy(button, true, 'Saving…');
    setMessage(feedback, '', '');
    try {
      const result = await api.requestJson(shopEndpoint('/promotions'), { method: 'POST', body });
      setMessage(feedback, result.message || 'Promotion created.', 'success');
      form.reset();
      form.hidden = true;
      await refreshOverview();
    } catch (error) {
      setMessage(feedback, error.message || 'Promotion could not be saved.', 'error');
    } finally {
      setBusy(button, false, '', 'Save promotion');
    }
  }

  async function togglePromotion(promotionId, isActive) {
    try {
      const result = await api.requestJson(shopEndpoint(`/promotions/${encodeURIComponent(promotionId)}`), {
        method: 'PATCH',
        body: { isActive },
      });
      setMessage(elements.status, result.message || 'Promotion state updated.', 'success');
      await refreshOverview();
    } catch (error) {
      setMessage(elements.status, error.message || 'Promotion state could not be changed.', 'error');
    }
  }

  async function saveSettings(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const feedback = form.querySelector('[data-settings-feedback]');
    const button = form.querySelector('[type="submit"]');
    let fulfillmentOptions;
    let paymentMethods;
    try {
      fulfillmentOptions = JSON.parse(formData.get('fulfillmentOptions'));
      paymentMethods = JSON.parse(formData.get('paymentMethods'));
      if (!Array.isArray(fulfillmentOptions) || !Array.isArray(paymentMethods)) {
        throw new Error('Fulfillment and payment settings must both be JSON arrays.');
      }
    } catch (error) {
      setMessage(feedback, error.message || 'Enter valid JSON arrays for shop settings.', 'error');
      return;
    }

    setBusy(button, true, 'Saving…');
    setMessage(feedback, '', '');
    try {
      const result = await api.requestJson(shopEndpoint('/settings'), {
        method: 'PATCH',
        body: {
          currency: formData.get('currency'),
          isDemo: form.elements.isDemo.checked,
          fulfillmentOptions,
          paymentMethods,
        },
      });
      setMessage(feedback, result.message || 'Shop settings updated.', 'success');
      await refreshOverview();
    } catch (error) {
      setMessage(feedback, error.message || 'Shop settings could not be saved.', 'error');
    } finally {
      setBusy(button, false, '', 'Save shop settings');
    }
  }

  async function signIn(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type="submit"]');
    const formData = new FormData(form);
    setBusy(button, true, 'Signing in…');
    setMessage(elements.accessMessage, '', '');
    try {
      await api.requestJson(authEndpoint('/login'), {
        method: 'POST',
        body: { email: formData.get('email'), password: formData.get('password') },
      });
      form.reset();
      await loadSession();
      await refreshOverview();
    } catch (error) {
      setMessage(elements.accessMessage, error.message || 'Sign-in could not be completed.', 'error');
    } finally {
      setBusy(button, false, '', 'Sign in');
    }
  }

  async function signOut() {
    setBusy(elements.signout, true, 'Signing out…');
    try {
      await api.requestJson(authEndpoint('/logout'), { method: 'POST', body: {} });
    } catch (error) {
      setMessage(elements.accessMessage, error.message || 'The server could not confirm sign-out.', 'error');
    } finally {
      currentUser = null;
      overview = null;
      elements.workspace.hidden = true;
      elements.accessPanel.hidden = false;
      elements.loginForm.hidden = false;
      elements.signout.hidden = true;
      elements.sessionLabel.textContent = 'Not signed in';
      setMessage(elements.accessMessage, 'You have signed out.', 'success');
      setBusy(elements.signout, false, '', 'Sign out');
    }
  }

  function bindEvents() {
    elements.shopSelect.addEventListener('change', (event) => setShopSlug(event.target.value));
    elements.loginForm.addEventListener('submit', signIn);
    elements.signout.addEventListener('click', signOut);
    $('admin-refresh').addEventListener('click', refreshOverview);
    $('admin-new-product').addEventListener('click', () => openProductForm());
    $('admin-new-promotion').addEventListener('click', openPromotionForm);
    elements.productForm.addEventListener('submit', saveProduct);
    elements.promotionForm.addEventListener('submit', savePromotion);
    elements.settingsForm.addEventListener('submit', saveSettings);
    elements.ordersList.addEventListener('submit', updateOrderStatus);
    elements.promotionForm.elements.appliesTo.addEventListener('change', syncPromotionTargetFields);

    document.querySelectorAll('[data-cancel-product]').forEach((button) => button.addEventListener('click', closeProductForm));
    document.querySelectorAll('[data-cancel-promotion]').forEach((button) => button.addEventListener('click', () => {
      elements.promotionForm.hidden = true;
      elements.promotionForm.reset();
    }));

    elements.productList.addEventListener('click', (event) => {
      const editButton = event.target.closest('[data-product-edit]');
      if (editButton) {
        const product = overview?.products?.find((item) => item.id === editButton.dataset.productEdit);
        if (product) openProductForm(product);
        return;
      }
      const availabilityButton = event.target.closest('[data-product-availability]');
      if (availabilityButton) {
        setProductAvailability(availabilityButton.dataset.productAvailability, availabilityButton.dataset.nextAvailability === 'true');
      }
    });

    elements.promotionList.addEventListener('click', (event) => {
      const button = event.target.closest('[data-promotion-active]');
      if (!button) return;
      togglePromotion(button.dataset.promotionActive, button.dataset.nextActive === 'true');
    });
  }

  function initialize() {
    if (!api || !elements.workspace) return;
    elements.shopSelect.value = shopSlug;
    bindEvents();
    refreshOverview();
  }

  initialize();
})();
