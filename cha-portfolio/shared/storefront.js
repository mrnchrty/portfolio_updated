(() => {
  const FALLBACK_IMAGES = {
    digicha: '../assets/images/product-placeholder.svg',
    mochajaki: '../assets/images/food-placeholder.svg',
  };
  const PRODUCT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  function initializeStorefront() {
    const app = document.querySelector('[data-shop-app]');
    if (!app || app.dataset.initialized === 'true') return;
    app.dataset.initialized = 'true';

    if (!window.ShopApi) {
      const status = document.querySelector('[data-backend-status]');
      if (status) status.textContent = 'The shop interface could not start. Reload the page.';
      return;
    }

    const api = window.ShopApi;
    const shop = app.dataset.shop;
    const setup = window.STOREFRONT_CONFIG || {};
    const endpoint = `/api/shops/${encodeURIComponent(shop)}`;
    const authEndpoint = (path = '') => `${endpoint}/auth${path}`;
    const $ = (id) => document.getElementById(id);
    const html = api.escapeHtml;

    const elements = {
      accountForms: $('account-forms'),
      accountGateNote: $('account-gate-note'),
      accountMessage: $('account-message'),
      accountSessionLabel: $('account-session-label'),
      backendStatus: document.querySelector('[data-backend-status]'),
      cartCount: $('cart-count'),
      cartCountText: document.querySelector('[data-cart-count-text]'),
      cartDiscount: $('cart-discount'),
      cartItems: $('cart-items'),
      cartSubtotal: $('cart-subtotal'),
      cartTotal: $('cart-total'),
      categoryFilter: $('category-filter'),
      checkoutContact: $('checkout-contact'),
      checkoutForm: $('checkout-form'),
      checkoutMessage: $('checkout-message'),
      checkoutName: $('checkout-name'),
      checkoutReview: $('checkout-review'),
      checkoutSetupNotice: $('checkout-setup-notice'),
      clearCart: $('clear-cart'),
      clearPromo: $('clear-promo'),
      comboGrid: $('combo-grid'),
      continueCheckout: $('continue-checkout'),
      customerDashboard: $('customer-dashboard'),
      customerOrders: $('customer-orders'),
      dashboardDeals: $('dashboard-deals'),
      dashboardEmail: $('dashboard-email'),
      dashboardWelcome: $('dashboard-welcome'),
      dealsGrid: $('deals-grid'),
      discountRow: $('discount-row'),
      fulfillmentDetails: $('fulfillment-details'),
      fulfillmentMethod: $('fulfillment-method'),
      loginForm: $('login-form'),
      loginMessage: $('login-message'),
      memberStoreContent: $('member-store-content'),
      logoutButton: $('logout-button'),
      modeLabel: document.querySelector('[data-mode-label]'),
      noProducts: $('no-products'),
      paymentInstructions: $('payment-instructions'),
      paymentMethodList: $('payment-method-list'),
      paymentOptions: $('payment-options'),
      placeOrder: $('place-order'),
      productDetailContent: $('product-detail-content'),
      productDialog: $('product-dialog'),
      productGrid: $('product-grid'),
      productSearch: $('product-search'),
      profileForm: $('profile-form'),
      profileMessage: $('profile-message'),
      promoCode: $('promo-code'),
      promoForm: $('promo-form'),
      promoMessage: $('promo-message'),
      refreshOrders: $('refresh-orders'),
      registerForm: $('register-form'),
      registerMessage: $('register-message'),
      sortFilter: $('sort-filter'),
      status: $('store-status'),
      suggestionGrid: $('suggestion-grid'),
      availabilityFilter: $('availability-filter'),
    };

    const fallbackCatalog = setup.fallbackCatalog || { categories: [], products: [] };
    const cartStorageKey = `cha-portfolio-cart-v2-${shop}`;
    let products = [];
    let categories = [];
    let deals = [];
    let cart = loadCart();
    let sourceConnected = false;
    let catalogLoaded = false;
    let configurationLoaded = false;
    let sessionLoaded = false;
    let shopInfo = {
      name: setup.shopName || shop,
      currency: setup.currency || 'PHP',
      is_demo: true,
    };
    let checkoutConfig = null;
    let currentUser = null;
    let profile = null;
    let staffMemberships = [];
    let selectedPaymentMethod = '';
    let appliedPromoCode = '';
    let quote = null;
    let quoteFingerprint = '';
    let quoteRequestNumber = 0;
    let editingCartIndex = null;

    function setMessage(element, message, kind = '') {
      if (!element) return;
      element.textContent = message || '';
      const baseClass = element.dataset.baseClass || element.className.replace(/\s+is-(error|success|info)/g, '');
      element.dataset.baseClass = baseClass;
      element.className = `${baseClass}${kind ? ` is-${kind}` : ''}`;
    }

    function money(amount) {
      return api.formatMoney(amount, shopInfo.currency || setup.currency || 'PHP');
    }

    function isPricePending(product) {
      if (product?.price_pending === true) return true;
      const price = Number(product?.price);
      return Number.isFinite(price)
        && price === 0
        && /price\s+(?:is\s+)?to be confirmed/i.test(String(product?.description || ''));
    }

    function normalizedOptionGroups(product) {
      return Array.isArray(product?.options) ? product.options.filter((group) => group && typeof group === 'object') : [];
    }

    function optionMinimum(group) {
      const configuredMinimum = Number(group.min_selected);
      if (Number.isInteger(configuredMinimum) && configuredMinimum >= 0) return configuredMinimum;
      return group.required ? 1 : 0;
    }

    function optionMaximum(group) {
      const configuredMaximum = Number(group.max_selected);
      if (Number.isInteger(configuredMaximum) && configuredMaximum >= 0) return configuredMaximum;
      return group.type === 'multiple' ? 99 : 1;
    }

    function optionLabel(group) {
      return String(group.label || group.name || group.id || 'Option');
    }

    function valueLabel(value) {
      return String(value?.label || value?.name || value?.id || 'Option');
    }

    function getOptionDetails(product, selections = {}) {
      const groups = normalizedOptionGroups(product);
      let delta = 0;
      let valid = true;
      const labels = [];
      const knownIds = new Set();

      for (const group of groups) {
        const groupId = String(group.id || '');
        if (!groupId) {
          valid = false;
          continue;
        }
        knownIds.add(groupId);
        const values = Array.isArray(group.values) ? group.values : [];
        const multiple = group.type === 'multiple';
        const selected = selections[groupId];
        const selectedIds = multiple
          ? (Array.isArray(selected) ? selected.map(String) : [])
          : (typeof selected === 'string' && selected ? [selected] : []);
        const minimum = optionMinimum(group);
        const maximum = optionMaximum(group);

        if (selectedIds.length < minimum || selectedIds.length > maximum) valid = false;
        if (!multiple && selectedIds.length > 1) valid = false;

        for (const selectedId of selectedIds) {
          const value = values.find((candidate) => String(candidate?.id) === selectedId);
          if (!value) {
            valid = false;
            continue;
          }
          const priceDelta = Number(value.price_delta || 0);
          if (!Number.isFinite(priceDelta)) {
            valid = false;
            continue;
          }
          delta += priceDelta;
          labels.push(`${optionLabel(group)}: ${valueLabel(value)}`);
        }
      }

      for (const selectedGroupId of Object.keys(selections || {})) {
        if (!knownIds.has(selectedGroupId)) valid = false;
      }

      return { valid, delta, labels };
    }

    function itemKey(item) {
      const orderedOptions = Object.fromEntries(
        Object.entries(item.options || {}).sort(([left], [right]) => left.localeCompare(right)),
      );
      return `${item.productId}|${JSON.stringify(orderedOptions)}`;
    }

    function loadCart() {
      try {
        const raw = JSON.parse(window.localStorage.getItem(cartStorageKey) || '[]');
        if (!Array.isArray(raw)) return [];
        const items = [];
        for (const stored of raw.slice(0, 100)) {
          const productId = String(stored?.productId || stored?.id || '');
          const quantity = Number(stored?.quantity);
          if (!productId || !Number.isInteger(quantity) || quantity < 1 || quantity > 99) continue;
          const savedOptions = stored?.options && typeof stored.options === 'object' && !Array.isArray(stored.options)
            ? stored.options
            : {};
          const options = {};
          for (const [groupId, selection] of Object.entries(savedOptions).slice(0, 20)) {
            if (typeof selection === 'string' && selection.length <= 80) options[groupId] = selection;
            if (Array.isArray(selection) && selection.length <= 20 && selection.every((item) => typeof item === 'string' && item.length <= 80)) {
              options[groupId] = [...new Set(selection)];
            }
          }
          const item = { productId, quantity, options };
          const existing = items.find((candidate) => itemKey(candidate) === itemKey(item));
          if (existing) existing.quantity = Math.min(99, existing.quantity + quantity);
          else items.push(item);
        }
        return items;
      } catch {
        return [];
      }
    }

    function saveCart() {
      try {
        window.localStorage.setItem(cartStorageKey, JSON.stringify(cart));
      } catch {
        setMessage(elements.status, 'Your browser could not save this cart locally. You can still browse, but the cart may not persist after this page closes.', 'info');
      }
    }

    function productById(productId) {
      return products.find((product) => String(product.id) === String(productId));
    }

    function fallbackImage() {
      return setup.fallbackImage || FALLBACK_IMAGES[shop] || '../assets/images/product-placeholder.svg';
    }

    function productImage(product) {
      return api.safeImageUrl(product?.image_url, fallbackImage());
    }

    function cartSubtotalEstimate() {
      return cart.reduce((sum, item) => {
        const product = productById(item.productId);
        if (!product) return sum;
        const options = getOptionDetails(product, item.options);
        if (!options.valid) return sum;
        return sum + (Number(product.price) + options.delta) * item.quantity;
      }, 0);
    }

    function cartHasValidProducts() {
      return cart.length > 0 && cart.every((item) => {
        const product = productById(item.productId);
        return Boolean(product && product.available && getOptionDetails(product, item.options).valid);
      });
    }

    function cartQuotePayload() {
      return {
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          options: item.options,
        })),
        promoCode: appliedPromoCode || null,
      };
    }

    function currentCartFingerprint() {
      return JSON.stringify(cartQuotePayload());
    }

    function cartItemCount() {
      return cart.reduce((count, item) => count + item.quantity, 0);
    }

    function updateCartCount() {
      const count = cartItemCount();
      if (elements.cartCount) elements.cartCount.textContent = String(count);
      if (elements.cartCountText) elements.cartCountText.textContent = `${count} ${count === 1 ? 'item' : 'items'}`;
    }

    function makeCartLine(item, index) {
      const product = productById(item.productId);
      if (!product) return '';
      const options = getOptionDetails(product, item.options);
      const validPrice = options.valid ? Number(product.price) + options.delta : null;
      const lineTotal = validPrice === null ? null : validPrice * item.quantity;
      const imageAlt = product.is_sample ? `${product.name} image placeholder` : product.name;
      const optionText = options.labels.length ? options.labels.join(' · ') : 'No options selected';
      const availability = product.available ? '' : '<p class="product-availability is-unavailable">Unavailable — remove or refresh this item</p>';
      const needsOptionEdit = !options.valid;

      return `
        <article class="cart-line">
          <img
            class="cart-line-image"
            src="${html(productImage(product))}"
            alt="${html(imageAlt)}"
            data-fallback="${html(fallbackImage())}"
          />
          <div>
            <h3 class="cart-line-title">${html(product.name)}</h3>
            ${product.is_sample ? '<span class="product-badge sample-badge">DEMO ITEM</span>' : ''}
            <p class="cart-line-options">${html(needsOptionEdit ? 'Choose options to continue.' : optionText)}</p>
            <div class="cart-quantity-controls" aria-label="Quantity controls">
              <button class="quantity-button" type="button" data-cart-action="decrease" data-index="${index}" aria-label="Decrease ${html(product.name)} quantity">−</button>
              <span class="quantity-value" aria-live="polite">${item.quantity}</span>
              <button class="quantity-button" type="button" data-cart-action="increase" data-index="${index}" aria-label="Increase ${html(product.name)} quantity">+</button>
            </div>
            <button class="text-button" type="button" data-cart-action="edit" data-index="${index}">${needsOptionEdit ? 'Choose options' : 'Edit options'}</button>
            <button class="remove-cart-line" type="button" data-cart-action="remove" data-index="${index}">Remove item</button>
          </div>
          <strong class="cart-line-total">${lineTotal === null ? '—' : money(lineTotal)}</strong>
        </article>
      `;
    }

    function renderCart() {
      if (!elements.cartItems) return;
      if (!cart.length) {
        elements.cartItems.innerHTML = '<p class="store-empty">Your cart is empty. Browse the catalog above to add an item.</p>';
      } else {
        elements.cartItems.innerHTML = cart.map(makeCartLine).join('') || '<p class="store-empty">Your cart is empty.</p>';
      }

      const fingerprint = currentCartFingerprint();
      const hasCurrentQuote = Boolean(quote && quoteFingerprint === fingerprint);
      const subtotal = hasCurrentQuote ? Number(quote.subtotal) : cartSubtotalEstimate();
      const discount = hasCurrentQuote ? Number(quote.discount) : 0;
      const total = hasCurrentQuote ? Number(quote.total) : subtotal;
      if (elements.cartSubtotal) elements.cartSubtotal.textContent = money(subtotal);
      if (elements.cartDiscount) elements.cartDiscount.textContent = `−${money(discount)}`;
      if (elements.discountRow) elements.discountRow.hidden = discount <= 0;
      if (elements.cartTotal) elements.cartTotal.textContent = money(total);

      if (elements.checkoutReview) {
        if (!cart.length) {
          elements.checkoutReview.innerHTML = '<p class="store-empty">Your cart is empty.</p>';
        } else {
          const reviewLines = cart.map((item) => {
            const product = productById(item.productId);
            if (!product) return '';
            const optionDetails = getOptionDetails(product, item.options);
            const price = optionDetails.valid ? (Number(product.price) + optionDetails.delta) * item.quantity : null;
            const optionSummary = optionDetails.labels.length ? ` <span class="muted">(${html(optionDetails.labels.join(', '))})</span>` : '';
            return `<div class="summary-row"><span class="checkout-item-name">${html(product.name)} × ${item.quantity}${optionSummary}</span><strong>${price === null ? 'Options needed' : money(price)}</strong></div>`;
          }).join('');
          elements.checkoutReview.innerHTML = `${reviewLines}
            <div class="summary-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
            ${discount > 0 ? `<div class="summary-row discount-row"><span>Discount${quote?.promotion?.name ? ` · ${html(quote.promotion.name)}` : ''}</span><strong>−${money(discount)}</strong></div>` : ''}
            <div class="summary-row summary-total"><span>${hasCurrentQuote ? 'Server-quoted total' : 'Estimated total'}</span><strong>${money(total)}</strong></div>
            <p class="summary-note">${hasCurrentQuote ? 'The server will calculate the order again before saving it.' : 'Estimate only. Connect the backend for a server-verified quote.'}</p>`;
        }
      }

      updateCartCount();
      updateCheckoutAvailability();
      renderRecommendations();
    }

    function invalidateQuote() {
      quoteRequestNumber += 1;
      quote = null;
      quoteFingerprint = '';
      renderCart();
    }

    function updatePromoControls() {
      if (elements.promoCode && elements.promoCode.value !== appliedPromoCode) {
        elements.promoCode.value = appliedPromoCode;
      }
      if (elements.clearPromo) elements.clearPromo.hidden = !appliedPromoCode;
    }

    async function refreshQuote() {
      const requestNumber = ++quoteRequestNumber;
      const fingerprint = currentCartFingerprint();
      quote = null;
      quoteFingerprint = '';

      if (!cart.length || !sourceConnected || !cartHasValidProducts()) {
        renderCart();
        return;
      }

      try {
        const result = await api.requestJson(`${endpoint}/quote`, {
          method: 'POST',
          body: cartQuotePayload(),
        });
        if (requestNumber !== quoteRequestNumber || fingerprint !== currentCartFingerprint()) return;

        quote = result;
        quoteFingerprint = fingerprint;
        renderCart();

        if (appliedPromoCode) {
          setMessage(elements.promoMessage, `Code accepted. ${result.promotion?.name ? `${result.promotion.name} is included in the server quote.` : 'No additional discount applies.'}`, result.promotion ? 'success' : 'info');
        } else if (result.promotion) {
          setMessage(elements.promoMessage, `Server-applied offer: ${result.promotion.name}.`, 'success');
        } else {
          setMessage(elements.promoMessage, '', '');
        }
      } catch (error) {
        if (requestNumber !== quoteRequestNumber) return;
        quote = null;
        quoteFingerprint = '';
        if (appliedPromoCode) {
          const failedCode = appliedPromoCode;
          appliedPromoCode = '';
          if (elements.promoCode) elements.promoCode.value = '';
          setMessage(elements.promoMessage, `That code could not be applied: ${error.message}`, 'error');
          updatePromoControls();
          renderCart();
          return;
        }
        if (sourceConnected && cart.length) {
          setMessage(elements.promoMessage, 'A server quote is not available yet. The amount shown is an estimate only.', 'info');
        }
        renderCart();
      }
    }

    function isFoodCombo(product) {
      return String(product?.category_slug || '').toLocaleLowerCase() === 'combo-deals' ||
        String(product?.category_name || '').trim().toLocaleLowerCase() === 'combo deals' ||
        String(product?.category_id || '').toLocaleLowerCase() === 'combo-deals';
    }

    function categoryValue(product) {
      return String(product.category_id || product.category_slug || product.category_name || 'uncategorized');
    }

    function productCategoryName(product) {
      if (product.category_name) return String(product.category_name);
      const category = categories.find((item) => String(item.id || item.slug) === categoryValue(product));
      return String(category?.name || 'Uncategorised');
    }

    function refreshCategoryFilter() {
      if (!elements.categoryFilter) return;
      const selected = elements.categoryFilter.value;
      const visibleCategories = elements.comboGrid
        ? categories.filter((category) =>
            String(category.slug || '').toLocaleLowerCase() !== 'combo-deals' &&
            String(category.name || '').trim().toLocaleLowerCase() !== 'combo deals' &&
            String(category.id || '').toLocaleLowerCase() !== 'combo-deals')
        : categories;
      const options = visibleCategories.map((category) => ({
        value: String(category.id || category.slug || category.name),
        label: String(category.name || category.slug || 'Category'),
      }));
      if (!options.length) {
        const derived = new Map();
        for (const product of products) {
          const value = categoryValue(product);
          if (value !== 'uncategorized' && !derived.has(value)) derived.set(value, productCategoryName(product));
        }
        for (const [value, label] of derived) options.push({ value, label });
      }

      elements.categoryFilter.innerHTML = '<option value="all">All categories</option>' + options
        .map((option) => `<option value="${html(option.value)}">${html(option.label)}</option>`)
        .join('');
      if ([...elements.categoryFilter.options].some((option) => option.value === selected)) {
        elements.categoryFilter.value = selected;
      }
    }

    function productCard(product) {
      const productId = html(product.id);
      const hasOptions = normalizedOptionGroups(product).length > 0;
      const price = Number(product.price);
      const pricePending = isPricePending(product);
      const productIsAvailable = Boolean(product.available) && !pricePending;
      const imageAlt = product.is_sample ? `${product.name} image placeholder` : product.name;
      const primaryAction = hasOptions ? 'details' : 'add';
      const primaryLabel = pricePending
        ? 'Price pending'
        : (!productIsAvailable ? 'Unavailable' : (hasOptions ? 'Choose options' : 'Add to cart'));
      const primaryDisabled = productIsAvailable ? '' : 'disabled';
      const featuredBadge = product.is_featured
        ? `<span class="product-badge">${shop === 'mochajaki' ? 'Top offer' : 'Featured'}</span>`
        : '';
      const sampleBadge = product.is_sample && !pricePending
        ? `<span class="product-badge sample-badge">${shop === 'mochajaki' ? 'Sample idea' : 'Demo sample'}</span>`
        : '';
      const pendingBadge = pricePending ? '<span class="product-badge sample-badge">Price pending</span>' : '';
      const priceLabel = pricePending
        ? 'Price to be confirmed'
        : (!Number.isFinite(price) ? 'Price not set' : `${hasOptions ? 'From ' : ''}${money(price)}`);

      return `
        <article class="store-product-card">
          <div class="store-product-image-wrap">
            <img
              class="store-product-image"
              src="${html(productImage(product))}"
              alt="${html(imageAlt)}"
              loading="lazy"
              data-fallback="${html(fallbackImage())}"
            />
            <div class="product-badges">${featuredBadge}${sampleBadge}${pendingBadge}</div>
          </div>
          <div class="store-product-copy">
            <span class="store-product-category">${html(productCategoryName(product))}</span>
            <h3 class="store-product-title">${html(product.name)}</h3>
            <p class="store-product-description">${html(product.description || 'Product details will be added by the shop owner.')}</p>
            <span class="product-availability${product.is_sample ? ' is-sample' : (productIsAvailable ? '' : ' is-unavailable')}">${pricePending ? 'Price to be confirmed' : (product.is_sample ? 'Sample listing · confirm before live orders' : (productIsAvailable ? 'Available to order' : 'Currently unavailable'))}</span>
            <div class="product-card-footer">
              <strong class="product-price">${priceLabel}</strong>
              <button class="store-button store-button-primary" type="button" data-product-action="${primaryAction}" data-id="${productId}" ${primaryDisabled}>${primaryLabel}</button>
            </div>
            <div class="product-card-actions">
              <button class="store-button store-button-secondary" type="button" data-product-action="details" data-id="${productId}">View details</button>
            </div>
          </div>
        </article>
      `;
    }

    function matchingProducts() {
      const term = (elements.productSearch?.value || '').trim().toLocaleLowerCase();
      const category = elements.categoryFilter?.value || 'all';
      const availability = elements.availabilityFilter?.value || 'all';
      const sort = elements.sortFilter?.value || 'featured';
      const list = products.filter((product) => {
        const searchText = `${product.name || ''} ${product.description || ''} ${productCategoryName(product)}`.toLocaleLowerCase();
        if (elements.comboGrid && isFoodCombo(product)) return false;
        if (term && !searchText.includes(term)) return false;
        if (category !== 'all' && categoryValue(product) !== category) return false;
        if (availability === 'available' && !product.available) return false;
        return true;
      });

      if (sort === 'price-low') list.sort((left, right) => Number(left.price) - Number(right.price));
      if (sort === 'price-high') list.sort((left, right) => Number(right.price) - Number(left.price));
      if (sort === 'name') list.sort((left, right) => String(left.name).localeCompare(String(right.name)));
      if (sort === 'featured') list.sort((left, right) => Number(Boolean(right.is_featured)) - Number(Boolean(left.is_featured)));
      return list;
    }

    function renderCategorySections(list) {
      const groups = new Map();
      for (const product of list) {
        const key = categoryValue(product);
        if (!groups.has(key)) groups.set(key, { name: productCategoryName(product), products: [] });
        groups.get(key).products.push(product);
      }

      const categoryOrder = new Map(categories
        .filter((category) => !isFoodCombo({ category_id: category.id, category_slug: category.slug, category_name: category.name }))
        .map((category, index) => [String(category.id || category.slug || category.name), index]));
      const orderedGroups = [...groups.entries()].sort(([leftKey], [rightKey]) =>
        (categoryOrder.get(leftKey) ?? Number.MAX_SAFE_INTEGER) - (categoryOrder.get(rightKey) ?? Number.MAX_SAFE_INTEGER));

      return orderedGroups.map(([key, group], index) => {
        const headingId = `catalog-category-${index + 1}`;
        return `
          <section class="catalog-category-group" aria-labelledby="${headingId}">
            <div class="catalog-category-heading">
              <div>
                <span class="catalog-category-kicker">Menu section ${String(index + 1).padStart(2, '0')}</span>
                <h3 id="${headingId}">${html(group.name)}</h3>
              </div>
              <span class="catalog-category-count">${group.products.length} ${group.products.length === 1 ? 'item' : 'items'}</span>
            </div>
            <div class="store-product-grid catalog-category-products">${group.products.map(productCard).join('')}</div>
          </section>
        `;
      }).join('');
    }

    function renderFoodCombos() {
      if (!elements.comboGrid) return;
      const comboProducts = products.filter((product) => isFoodCombo(product));
      elements.comboGrid.innerHTML = comboProducts.length
        ? comboProducts.map(productCard).join('')
        : '<p class="store-empty">No combo ideas are available yet.</p>';
    }

    function renderProducts() {
      if (!elements.productGrid) return;
      const list = matchingProducts();
      const useCategorySections = elements.productGrid.dataset.catalogLayout === 'sections';
      elements.productGrid.innerHTML = useCategorySections
        ? renderCategorySections(list)
        : list.map(productCard).join('');
      if (elements.noProducts) elements.noProducts.hidden = list.length > 0;
      if (!products.length) {
        elements.productGrid.innerHTML = '<p class="store-empty">The shop owner has not added any products yet.</p>';
        if (elements.noProducts) elements.noProducts.hidden = true;
      }

      renderRecommendations();
      renderFoodCombos();
    }

    function renderRecommendations() {
      if (!elements.suggestionGrid) return;
      const availableProducts = products.filter((product) => product.available && !isPricePending(product) && !(elements.comboGrid && isFoodCombo(product)));
      const cartProductIds = new Set(cart.map((item) => String(item.productId)));
      const notInCart = availableProducts.filter((product) => !cartProductIds.has(String(product.id)));
      const featuredNotInCart = notInCart.filter((product) => product.is_featured);
      const recommendationPool = featuredNotInCart.length
        ? featuredNotInCart
        : (notInCart.length ? notInCart : availableProducts);
      const suggested = recommendationPool.slice(0, 3);
      elements.suggestionGrid.innerHTML = suggested.length
        ? suggested.map(productCard).join('')
        : '<p class="store-empty">Suggestions will appear when products have confirmed prices and are available to order.</p>';
    }

    function reconcileCartToCatalog() {
      const knownIds = new Set(products.map((product) => String(product.id)));
      const previousCount = cart.length;
      cart = cart.filter((item) => knownIds.has(String(item.productId)));
      saveCart();
      if (cart.length !== previousCount) {
        setMessage(elements.status, 'Some saved cart items are no longer in this shop catalog and were removed. Review the current cart before ordering.', 'info');
      }
      renderCart();
    }

    function renderDeals() {
      const content = deals.length
        ? deals.map((deal) => {
            const discountLabel = deal.discount_type === 'percent'
              ? `${Number(deal.discount_value)}% off`
              : `${money(deal.discount_value)} off`;
            const minimum = Number(deal.minimum_order_total) > 0
              ? `Minimum order ${money(deal.minimum_order_total)}.`
              : '';
            const maxDiscount = Number(deal.maximum_discount) > 0
              ? ` Maximum discount ${money(deal.maximum_discount)}.`
              : '';
            const start = deal.starts_at ? `Starts ${formatDate(deal.starts_at)}.` : '';
            const end = deal.ends_at ? `Ends ${formatDate(deal.ends_at)}.` : '';
            const details = [deal.description, minimum, maxDiscount, start, end].filter(Boolean).join(' ');
            const codeContent = deal.code
              ? `<span class="deal-code">Code: ${html(deal.code)}</span><button class="text-button" type="button" data-apply-promo="${html(deal.code)}">Apply this code</button>`
              : '<span class="deal-code">Applied automatically when eligible</span>';
            return `
              <article class="deal-card">
                <span class="deal-discount">${html(discountLabel)}</span>
                <h3>${html(deal.name || 'Active promotion')}</h3>
                <p>${html(details || 'See the cart for the current server-verified offer.')}</p>
                ${codeContent}
              </article>
            `;
          }).join('')
        : '<p class="store-empty">No active offers are configured for this shop. Add real promotion rules and dates in the admin panel when ready.</p>';

      if (elements.dealsGrid) elements.dealsGrid.innerHTML = content;
      if (elements.dashboardDeals) {
        elements.dashboardDeals.innerHTML = deals.length
          ? deals.map((deal) => {
              const discountLabel = deal.discount_type === 'percent'
                ? `${Number(deal.discount_value)}% off`
                : `${money(deal.discount_value)} off`;
              const code = deal.code ? ` Code: ${deal.code}.` : ' Automatically applied if eligible.';
              return `<article class="dashboard-deal"><strong>${html(deal.name || 'Active promotion')} · ${html(discountLabel)}</strong><span>${html((deal.description || 'Current shop offer.') + code)}</span></article>`;
            }).join('')
          : '<p class="store-empty">No customer deals are active for this shop.</p>';
      }
    }

    function formatDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric' }).format(date);
    }

    function formatDateTime(value) {
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

    function renderOrder(order) {
      const items = Array.isArray(order.order_items) ? order.order_items : [];
      const lineItems = items.map((item) => {
        const selected = item.selected_options && typeof item.selected_options === 'object'
          ? Object.entries(item.selected_options).map(([group, values]) => `${group}: ${Array.isArray(values) ? values.join(', ') : values}`).join(' · ')
          : '';
        const optionLabel = selected ? ` <span class="muted">(${html(selected)})</span>` : '';
        return `<span>${html(item.product_name)} × ${Number(item.quantity)}${optionLabel}</span>`;
      }).join('');
      const paid = order.payment_status === 'paid';
      const testOrder = order.is_test_order
        ? '<span class="product-badge sample-badge">Development order</span>'
        : '';

      return `
        <article class="customer-order-card">
          <div class="customer-order-heading">
            <strong>${html(order.order_number || 'Order reference')}</strong>
            <span class="order-state">${html(api.friendlyStatus(order.status))}</span>
          </div>
          <p>${html(formatDateTime(order.created_at))} · Total <strong>${money(order.total)}</strong></p>
          <p>Payment: <span class="payment-state${paid ? ' is-paid' : ''}">${html(api.friendlyStatus(order.payment_status))}</span> ${testOrder}</p>
          ${order.fulfillment_method ? `<p>Fulfillment: ${html(order.fulfillment_method)}</p>` : ''}
          <div class="customer-order-items">${lineItems || '<span>Order items unavailable.</span>'}</div>
        </article>
      `;
    }

    async function loadDashboard() {
      if (!currentUser || !elements.customerOrders) return;
      elements.customerOrders.innerHTML = '<p class="store-empty">Loading your orders…</p>';
      try {
        const result = await api.requestJson(`${endpoint}/dashboard`);
        profile = result.profile || profile;
        deals = Array.isArray(result.deals) ? result.deals : deals;
        if (elements.profileForm && profile) {
          elements.profileForm.elements.fullName.value = profile.full_name || '';
          elements.profileForm.elements.phone.value = profile.phone || '';
        }
        elements.customerOrders.innerHTML = result.orders?.length
          ? result.orders.map(renderOrder).join('')
          : '<p class="store-empty">No orders have been placed through this shop account yet.</p>';
        renderDeals();
      } catch (error) {
        elements.customerOrders.innerHTML = `<p class="store-empty">Order history could not be loaded. ${html(error.message)}</p>`;
      }
    }

    function updateAdminLink() {
      const link = $('store-admin-link');
      if (!link) return;
      const membership = staffMemberships.find((entry) => entry.shop_slug === shop);
      if (!membership) {
        link.hidden = true;
        return;
      }
      link.href = `../admin/admin.html?shop=${encodeURIComponent(shop)}`;
      link.textContent = `Open ${membership.shop_name || 'shop'} admin (${membership.role})`;
      link.hidden = false;
    }

    function renderAccount() {
      if (!elements.accountForms || !elements.customerDashboard) return;
      const signedIn = Boolean(currentUser);
      elements.accountForms.hidden = signedIn;
      elements.customerDashboard.hidden = !signedIn;
      if (elements.accountGateNote) elements.accountGateNote.hidden = signedIn;
      if (elements.memberStoreContent) elements.memberStoreContent.hidden = !signedIn;
      document.querySelectorAll('[data-member-link]').forEach((link) => { link.hidden = !signedIn; });
      const menuEntryCta = $('menu-entry-cta');
      if (menuEntryCta) {
        menuEntryCta.href = signedIn ? '#top-offers' : '#account';
        menuEntryCta.innerHTML = signedIn
          ? 'View Top Offers <span aria-hidden="true">↑</span>'
          : 'Sign in to view the menu <span aria-hidden="true">↓</span>';
      }
      if (elements.accountSessionLabel) elements.accountSessionLabel.textContent = signedIn ? currentUser.email : 'Not signed in';
      if (elements.dashboardWelcome) elements.dashboardWelcome.textContent = `Welcome${profile?.full_name ? `, ${profile.full_name}` : ''}`;
      if (elements.dashboardEmail) elements.dashboardEmail.textContent = currentUser?.email || '';
      if (signedIn && elements.checkoutName && !elements.checkoutName.value) {
        elements.checkoutName.value = profile?.full_name || '';
      }
      if (signedIn && elements.checkoutContact && !elements.checkoutContact.value) {
        elements.checkoutContact.value = profile?.phone || '';
      }
      if (elements.profileForm && profile) {
        elements.profileForm.elements.fullName.value = profile.full_name || '';
        elements.profileForm.elements.phone.value = profile.phone || '';
      }
      updateAdminLink();
      if (signedIn) loadDashboard();
      updateCatalogStatus();
      updateCheckoutAvailability();
    }

    async function loadAccount() {
      try {
        const result = await api.requestJson(authEndpoint('/me'));
        currentUser = result.user || null;
        profile = result.profile || null;
        staffMemberships = Array.isArray(result.staff_memberships) ? result.staff_memberships : [];
        setMessage(elements.accountMessage, '', '');
      } catch (error) {
        currentUser = null;
        profile = null;
        staffMemberships = [];
        if (error.status === 401 && elements.memberStoreContent) {
          try {
            const health = await api.requestJson('/api/health');
            const missing = health.supabaseMissingSettings?.[shop] || [];
            if (health.supabaseProjects?.[shop] === false) {
              const missingNames = missing.length ? ` Missing settings: ${missing.join(', ')}.` : '';
              setMessage(elements.accountMessage, `Mochajaki accounts are unavailable until its separate Supabase project is connected. ${supabaseSetupSummary()}${missingNames}`, 'info');
            } else {
              setMessage(elements.accountMessage, '', '');
            }
          } catch {
            setMessage(elements.accountMessage, '', '');
          }
        } else if (error.status === 401) {
          setMessage(elements.accountMessage, '', '');
        } else {
          setMessage(elements.accountMessage, 'Account services need the Express server and Supabase Auth configuration before sign-in or order history can work.', 'info');
        }
      } finally {
        sessionLoaded = true;
        renderAccount();
        updateCheckoutAvailability();
        if (currentUser && elements.memberStoreContent && !catalogLoaded) {
          await loadCatalog();
        }
        if (currentUser && elements.memberStoreContent) {
          $('top-offers')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }

    function setButtonBusy(button, busy, busyLabel, normalLabel) {
      if (!button) return;
      button.disabled = busy;
      if (busy) {
        button.dataset.previousText = button.textContent;
        button.textContent = busyLabel;
      } else {
        button.textContent = normalLabel || button.dataset.previousText || button.textContent;
      }
    }

    async function handleLogin(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      setMessage(elements.loginMessage, '', '');
      setButtonBusy(button, true, 'Signing in…');
      try {
        const formData = new FormData(form);
        await api.requestJson(authEndpoint('/login'), {
          method: 'POST',
          body: { email: formData.get('email'), password: formData.get('password') },
        });
        form.reset();
        await loadAccount();
        setMessage(elements.accountMessage, 'You are signed in. Your account and order history are scoped to this shop.', 'success');
      } catch (error) {
        setMessage(elements.loginMessage, error.message || 'Sign-in could not be completed.', 'error');
      } finally {
        setButtonBusy(button, false, '', 'Sign in');
      }
    }

    async function handleRegistration(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      setMessage(elements.registerMessage, '', '');
      setButtonBusy(button, true, 'Creating account…');
      try {
        const formData = new FormData(form);
        const result = await api.requestJson(authEndpoint('/register'), {
          method: 'POST',
          body: {
            fullName: formData.get('fullName'),
            email: formData.get('email'),
            password: formData.get('password'),
          },
        });
        form.reset();
        if (result.authenticated) {
          await loadAccount();
          setMessage(elements.accountMessage, result.message || 'Your account is ready.', 'success');
        } else {
          setMessage(elements.registerMessage, result.message || 'Check your email to confirm your account, then sign in.', 'success');
        }
      } catch (error) {
        setMessage(elements.registerMessage, error.message || 'Account registration could not be completed.', 'error');
      } finally {
        setButtonBusy(button, false, '', 'Create account');
      }
    }

    async function handleProfileUpdate(event) {
      event.preventDefault();
      const form = event.currentTarget;
      const button = form.querySelector('[type="submit"]');
      const formData = new FormData(form);
      setMessage(elements.profileMessage, '', '');
      setButtonBusy(button, true, 'Saving…');
      try {
        const result = await api.requestJson(authEndpoint('/profile'), {
          method: 'PATCH',
          body: { fullName: formData.get('fullName'), phone: formData.get('phone') || '' },
        });
        profile = result.profile || profile;
        if (elements.dashboardWelcome) elements.dashboardWelcome.textContent = `Welcome, ${profile?.full_name || currentUser?.email || ''}`;
        setMessage(elements.profileMessage, result.message || 'Account information updated.', 'success');
      } catch (error) {
        setMessage(elements.profileMessage, error.message || 'Account information could not be saved.', 'error');
      } finally {
        setButtonBusy(button, false, '', 'Save account details');
      }
    }

    async function handleLogout() {
      setButtonBusy(elements.logoutButton, true, 'Signing out…');
      try {
        await api.requestJson(authEndpoint('/logout'), { method: 'POST', body: {} });
      } catch (error) {
        setMessage(elements.accountMessage, error.message || 'Sign-out could not be completed.', 'error');
      } finally {
        currentUser = null;
        profile = null;
        staffMemberships = [];
        renderAccount();
        setButtonBusy(elements.logoutButton, false, '', 'Sign out');
        updateCheckoutAvailability();
      }
    }

    function renderPaymentMethods() {
      const hasConnectedConfiguration = Array.isArray(checkoutConfig?.payment_methods);
      const methods = hasConnectedConfiguration
        ? checkoutConfig.payment_methods
        : (Array.isArray(setup.fallbackPaymentMethods) ? setup.fallbackPaymentMethods : []);
      selectedPaymentMethod = hasConnectedConfiguration && methods.some((method) => method.id === selectedPaymentMethod)
        ? selectedPaymentMethod
        : '';
      if (elements.paymentMethodList) {
        elements.paymentMethodList.innerHTML = methods.length
          ? methods.map((method) => `
            <label class="payment-method-option${hasConnectedConfiguration ? '' : ' is-preview-only'}">
              <input type="radio" name="paymentMethod" value="${html(method.id)}" ${hasConnectedConfiguration && method.id === selectedPaymentMethod ? 'checked' : ''} ${hasConnectedConfiguration ? 'required' : 'disabled'} />
              <span><strong>${html(method.label)}</strong><small>${html(method.type === 'online' ? 'Secure hosted payment' : (method.instructions || 'Manual payment instructions provided by the shop'))}</small></span>
            </label>
          `).join('')
          : '<p class="muted">No payment methods are enabled for this shop.</p>';
      }
      const explanatoryText = elements.paymentOptions?.querySelector('.muted');
      if (explanatoryText) {
        if (!hasConnectedConfiguration && methods.length) {
          explanatoryText.textContent = 'Preview choices only. Connect the shop and add verified payment instructions before accepting orders.';
          explanatoryText.hidden = false;
        } else if (hasConnectedConfiguration && methods.length) {
          explanatoryText.hidden = true;
        } else {
          explanatoryText.textContent = 'No payment methods are enabled for this shop.';
          explanatoryText.hidden = false;
        }
      }
      updatePaymentInstructions();
    }

    function selectedPaymentDetails() {
      const method = checkoutConfig?.payment_methods?.find((candidate) => candidate.id === selectedPaymentMethod);
      return method || null;
    }

    function updatePaymentInstructions() {
      const method = selectedPaymentDetails();
      if (!elements.paymentInstructions) return;
      if (method?.instructions) {
        elements.paymentInstructions.textContent = method.instructions;
        elements.paymentInstructions.hidden = false;
      } else {
        elements.paymentInstructions.textContent = '';
        elements.paymentInstructions.hidden = true;
      }
      updateCheckoutAvailability();
    }

    function selectedFulfillmentDetails() {
      return checkoutConfig?.shop?.fulfillment_options?.find((option) => option.id === elements.fulfillmentMethod?.value) || null;
    }

    function updateFulfillmentRequirement() {
      const option = selectedFulfillmentDetails();
      if (!elements.fulfillmentDetails) return;
      elements.fulfillmentDetails.required = Boolean(option?.requires_details);
      if (option?.details_label) elements.fulfillmentDetails.placeholder = option.details_label;
      else elements.fulfillmentDetails.placeholder = elements.fulfillmentDetails.dataset.placeholder || 'Add only the details requested by this shop.';
      updateCheckoutAvailability();
    }

    function supabaseSetupSummary() {
      const shopName = setup.shopName || shop;
      const seedFile = shop === 'digicha' ? 'seed-digicha.sql' : 'seed-mochajaki.sql';
      return `Connect ${shopName} to its separate Supabase project in backend/.env, then run database/schema.sql and database/${seedFile} in that project.`;
    }

    function updateCheckoutNotice() {
      if (!elements.checkoutSetupNotice) return;
      let message;
      let kind = '';
      if (!sourceConnected && elements.memberStoreContent && !currentUser) {
        message = `Create an account or sign in to see the Mochajaki menu. ${supabaseSetupSummary()} No payment is collected in this preview.`;
      } else if (!sourceConnected) {
        const visibility = elements.memberStoreContent ? 'shown after sign-in' : 'visible';
        message = `Preview only: local sample listings are ${visibility}. ${supabaseSetupSummary()} Accounts and order submission remain unavailable until setup. No payment is collected in this preview.`;
      } else if (!checkoutConfig) {
        message = 'The catalog loaded, but checkout settings could not be loaded. Confirm the shop fulfillment and payment configuration.';
        kind = 'error';
      } else if (shopInfo.is_demo && checkoutConfig.sample_orders_enabled) {
        message = 'Development mode: orders are test orders and remain unpaid. GCash, Maya, and Other are manual payment choices; this site does not collect or verify payment.';
      } else if (shopInfo.is_demo) {
        message = 'This shop is still in demo mode. Confirm prices, fulfillment details, and payment instructions before accepting live orders.';
        kind = 'error';
      } else if (!checkoutConfig.shop?.fulfillment_options?.length || !checkoutConfig.payment_methods?.length) {
        message = 'Ordering is not available until the shop owner enables at least one fulfillment option and one payment method.';
        kind = 'error';
      } else if (checkoutConfig.stripe_setup_needed) {
        message = 'Stripe credentials are incomplete. Only the explicitly configured non-Stripe payment methods can be used.';
        kind = 'info';
      } else {
        message = 'Connected catalog. The server rechecks availability, selected options, promotions, and totals before saving each order.';
      }
      elements.checkoutSetupNotice.textContent = message;
      elements.checkoutSetupNotice.className = `checkout-notice${kind ? ` is-${kind}` : ''}`;
    }

    function updateCatalogStatus() {
      const accountRequired = Boolean(elements.memberStoreContent) && !currentUser;
      if (elements.modeLabel) {
        elements.modeLabel.textContent = accountRequired
          ? 'Account required'
          : (!sourceConnected ? 'Preview · offline' : (shopInfo.is_demo ? 'Supabase demo catalog' : 'Connected catalog'));
      }
      if (elements.backendStatus) {
        elements.backendStatus.textContent = accountRequired
          ? 'Sign in or create a Mochajaki account to access Top Offers and the menu.'
          : (!sourceConnected
            ? `Preview only: local sample listings are shown. ${supabaseSetupSummary()}`
            : (shopInfo.is_demo
              ? 'Development shop connected. Test orders remain unpaid; payment methods are selection only and are not verified here.'
              : 'Connected to the shop catalog. Product availability and totals are confirmed again by the server at checkout.'));
      }
      updateCheckoutNotice();
    }

    function renderFulfillmentMethods() {
      const methods = Array.isArray(checkoutConfig?.shop?.fulfillment_options)
        ? checkoutConfig.shop.fulfillment_options
        : [];
      if (!elements.fulfillmentMethod) return;
      const previous = elements.fulfillmentMethod.value;
      elements.fulfillmentMethod.innerHTML = methods.length
        ? '<option value="">Choose a method</option>' + methods.map((method) => `<option value="${html(method.id)}">${html(method.label)}</option>`).join('')
        : '<option value="">No fulfillment options configured</option>';
      if (methods.some((method) => method.id === previous)) elements.fulfillmentMethod.value = previous;
      else if (methods.length === 1) elements.fulfillmentMethod.value = methods[0].id;
      updateFulfillmentRequirement();
    }

    async function loadCheckoutConfiguration() {
      try {
        checkoutConfig = await api.requestJson(`${endpoint}/checkout-config`);
        if (checkoutConfig?.shop) {
          shopInfo = { ...shopInfo, ...checkoutConfig.shop };
        }
        configurationLoaded = true;
        renderFulfillmentMethods();
        renderPaymentMethods();
        updateCatalogStatus();
      } catch {
        checkoutConfig = null;
        configurationLoaded = true;
        renderPaymentMethods();
        updateCatalogStatus();
      }
      updateCheckoutAvailability();
    }

    function normalizeCatalogProduct(product) {
      if (!product || typeof product !== 'object' || product.id === undefined || typeof product.name !== 'string') return null;
      const price = Number(product.price);
      if (!Number.isFinite(price) || price < 0) return null;
      return {
        ...product,
        id: String(product.id),
        name: product.name.trim(),
        description: String(product.description || ''),
        price,
        available: Boolean(product.available),
        options: Array.isArray(product.options) ? product.options : [],
        is_sample: Boolean(product.is_sample),
        is_featured: Boolean(product.is_featured),
      };
    }

    async function loadCatalog() {
      try {
        const result = await api.requestJson(`${endpoint}/products`);
        const normalized = Array.isArray(result.products)
          ? result.products.map(normalizeCatalogProduct).filter(Boolean)
          : null;
        if (!normalized) throw new Error('The catalog response is incomplete.');

        products = normalized;
        categories = Array.isArray(result.categories) ? result.categories : [];
        shopInfo = { ...shopInfo, ...(result.shop || {}) };
        sourceConnected = true;
      } catch {
        products = Array.isArray(fallbackCatalog.products)
          ? fallbackCatalog.products.map(normalizeCatalogProduct).filter(Boolean)
          : [];
        categories = Array.isArray(fallbackCatalog.categories) ? fallbackCatalog.categories : [];
        sourceConnected = false;
      } finally {
        catalogLoaded = true;
      }

      refreshCategoryFilter();
      renderProducts();
      reconcileCartToCatalog();
      updateCatalogStatus();
      updateCheckoutAvailability();
      if (sourceConnected && cart.length) refreshQuote();
    }

    async function loadDeals() {
      try {
        const result = await api.requestJson(`${endpoint}/deals`);
        deals = Array.isArray(result.deals) ? result.deals : [];
      } catch {
        deals = [];
      }
      renderDeals();
    }

    function updateCheckoutAvailability() {
      if (!elements.placeOrder) return;
      const userReady = Boolean(currentUser);
      const selectedFulfillment = selectedFulfillmentDetails();
      const selectedPayment = selectedPaymentDetails();
      const containsSamples = cart.some((item) => productById(item.productId)?.is_sample);
      const samplesAllowed = Boolean(checkoutConfig?.sample_orders_enabled);
      const demoStoreAllowed = !shopInfo.is_demo || samplesAllowed;
      const validProductIds = cart.every((item) => PRODUCT_ID_PATTERN.test(String(item.productId)));
      const ready = Boolean(
        catalogLoaded &&
        configurationLoaded &&
        sourceConnected &&
        userReady &&
        cartHasValidProducts() &&
        validProductIds &&
        (!containsSamples || samplesAllowed) &&
        demoStoreAllowed &&
        selectedFulfillment &&
        selectedPayment &&
        (selectedPayment.type !== 'online' || checkoutConfig?.stripe_ready),
      );
      elements.placeOrder.disabled = !ready;
      if (!userReady) elements.placeOrder.textContent = 'Sign in to place order';
      else if (!cart.length) elements.placeOrder.textContent = 'Your cart is empty';
      else if (!sourceConnected) elements.placeOrder.textContent = 'Connect shop backend to order';
      else if (containsSamples && !samplesAllowed) elements.placeOrder.textContent = 'Replace demo items before ordering';
      else if (!selectedFulfillment || !selectedPayment) elements.placeOrder.textContent = 'Shop setup required';
      else elements.placeOrder.textContent = 'Place order';
    }

    function addToCart(product, options = {}) {
      if (!product || !product.available) return;
      const candidate = { productId: String(product.id), quantity: 1, options };
      const existing = cart.find((item) => itemKey(item) === itemKey(candidate));
      if (existing) existing.quantity = Math.min(99, existing.quantity + 1);
      else cart.push(candidate);
      saveCart();
      invalidateQuote();
      refreshQuote();
      const cartSection = $('cart');
      if (cartSection) cartSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function renderOptionGroup(group, product, currentSelections) {
      const groupId = String(group.id || '');
      const values = Array.isArray(group.values) ? group.values : [];
      const multiple = group.type === 'multiple';
      const minimum = optionMinimum(group);
      const maximum = optionMaximum(group);
      const required = minimum > 0;
      const label = optionLabel(group);
      const current = currentSelections[groupId];

      if (multiple) {
        const selected = Array.isArray(current) ? current.map(String) : [];
        const choices = values.map((value) => {
          const valueId = String(value.id || '');
          const valueName = valueLabel(value);
          const delta = Number(value.price_delta || 0);
          const displayPrice = Number(value.display_price);
          const hasDisplayPrice = value.display_price !== undefined && value.display_price !== null && value.display_price !== '' && Number.isFinite(displayPrice);
          const extra = hasDisplayPrice
            ? ` · ${money(displayPrice)}`
            : (delta > 0 ? ` · +${money(delta)}` : (delta < 0 ? ` · −${money(Math.abs(delta))}` : ''));
          return `
            <label class="option-checkbox">
              <input type="checkbox" data-option-group="${html(groupId)}" value="${html(valueId)}" ${selected.includes(valueId) ? 'checked' : ''} />
              <span>${html(valueName)}${html(extra)}</span>
            </label>
          `;
        }).join('');
        return `
          <fieldset class="option-group" data-option-fieldset="${html(groupId)}" data-minimum="${minimum}" data-maximum="${maximum}">
            <legend>${html(label)}${required ? ' *' : ' (optional)'}</legend>
            <p class="muted">Choose ${minimum === maximum ? minimum : `between ${minimum} and ${maximum}`}.</p>
            ${choices || '<p class="muted">No options are configured.</p>'}
          </fieldset>
        `;
      }

      const selected = typeof current === 'string' ? current : '';
      const placeholder = required ? `Choose ${label.toLocaleLowerCase()}` : 'No selection';
      const choices = values.map((value) => {
        const valueId = String(value.id || '');
        const valueName = valueLabel(value);
        const delta = Number(value.price_delta || 0);
        const displayPrice = Number(value.display_price);
        const hasDisplayPrice = value.display_price !== undefined && value.display_price !== null && value.display_price !== '' && Number.isFinite(displayPrice);
        const extra = hasDisplayPrice
          ? ` (${money(displayPrice)})`
          : (delta > 0 ? ` (+${money(delta)})` : (delta < 0 ? ` (−${money(Math.abs(delta))})` : ''));
        return `<option value="${html(valueId)}" ${selected === valueId ? 'selected' : ''}>${html(valueName + extra)}</option>`;
      }).join('');
      return `
        <label class="store-field option-group">
          <span>${html(label)}${required ? ' *' : ' (optional)'}</span>
          <select data-option-group="${html(groupId)}" ${required ? 'required' : ''}>
            <option value="" ${selected ? '' : 'selected'}>${html(placeholder)}</option>
            ${choices}
          </select>
        </label>
      `;
    }

    function readOptionSelections(form, product) {
      const selections = {};
      for (const group of normalizedOptionGroups(product)) {
        const groupId = String(group.id || '');
        if (!groupId) continue;
        if (group.type === 'multiple') {
          const checked = [...form.querySelectorAll(`input[data-option-group="${CSS.escape(groupId)}"]:checked`)]
            .map((input) => input.value);
          if (checked.length) selections[groupId] = checked;
        } else {
          const select = form.querySelector(`select[data-option-group="${CSS.escape(groupId)}"]`);
          if (select?.value) selections[groupId] = select.value;
        }
      }
      return selections;
    }

    function validateOptionForm(form, product) {
      const selections = readOptionSelections(form, product);
      let valid = true;
      for (const group of normalizedOptionGroups(product)) {
        const groupId = String(group.id || '');
        const selected = selections[groupId];
        const count = Array.isArray(selected) ? selected.length : (selected ? 1 : 0);
        const minimum = optionMinimum(group);
        const maximum = optionMaximum(group);
        if (count < minimum || count > maximum) {
          valid = false;
          break;
        }
      }
      return { valid, selections, details: getOptionDetails(product, selections) };
    }

    function openProductDetails(product, cartIndex = null) {
      if (!product || !elements.productDetailContent || !elements.productDialog) return;
      editingCartIndex = Number.isInteger(cartIndex) ? cartIndex : null;
      const existingItem = editingCartIndex === null ? null : cart[editingCartIndex];
      const existingSelections = existingItem?.options || {};
      const groups = normalizedOptionGroups(product);
      const optionContent = groups.map((group) => renderOptionGroup(group, product, existingSelections)).join('');
      const pricePending = isPricePending(product);
      const productIsAvailable = Boolean(product.available) && !pricePending;
      const unavailableMessage = pricePending
        ? '<p class="product-availability is-unavailable">Price to be confirmed. Ordering is not available yet.</p>'
        : (productIsAvailable ? '' : '<p class="product-availability is-unavailable">This product is currently unavailable.</p>');
      const sampleNote = product.is_sample && !pricePending
        ? '<p class="checkout-notice">SAMPLE LISTING: the name, price, and options are suggestions; confirm specifications and replace the image before accepting real orders.</p>'
        : '';
      const basePrice = Number(product.price);
      const basePriceLabel = pricePending ? 'Price to be confirmed' : `${groups.length ? 'From ' : ''}${money(basePrice)}`;
      const livePriceLabel = pricePending ? 'Price to be confirmed' : money(basePrice);

      elements.productDetailContent.innerHTML = `
        <div class="product-dialog-content">
          <img class="product-dialog-image" src="${html(productImage(product))}" alt="${html(product.is_sample ? `${product.name} image placeholder` : product.name)}" data-fallback="${html(fallbackImage())}" />
          <div class="product-dialog-copy">
            <span class="store-product-category">${html(productCategoryName(product))}</span>
            <h2 id="product-dialog-title">${html(product.name)}</h2>
            <p>${html(product.description || 'Product details will be added by the shop owner.')}</p>
            ${sampleNote}
            ${unavailableMessage}
            <strong class="product-dialog-price">${basePriceLabel}</strong>
            <form id="product-options-form" data-product-id="${html(product.id)}" data-cart-index="${editingCartIndex === null ? '' : editingCartIndex}">
              ${optionContent || '<p class="muted">No product options are configured.</p>'}
              <div class="product-dialog-actions">
                <span class="dialog-live-price" data-live-price>${livePriceLabel}</span>
                <button class="store-button store-button-secondary" type="button" data-close-product>Cancel</button>
                <button class="store-button store-button-primary" type="submit" ${productIsAvailable ? '' : 'disabled'}>${pricePending ? 'Price pending' : (editingCartIndex === null ? 'Add to cart' : 'Update options')}</button>
              </div>
              <p class="form-feedback" data-option-message role="status" aria-live="polite"></p>
            </form>
          </div>
        </div>
      `;

      if (typeof elements.productDialog.showModal === 'function') elements.productDialog.showModal();
      else elements.productDialog.setAttribute('open', '');
      elements.productDetailContent.querySelector('select, input[type="checkbox"], [type="submit"]')?.focus({ preventScroll: true });
    }

    function updateDialogPrice(form, product) {
      const result = validateOptionForm(form, product);
      const price = Number(product.price) + result.details.delta;
      const label = form.querySelector('[data-live-price]');
      if (label) label.textContent = result.valid ? money(price) : 'Select valid options';
      const message = form.querySelector('[data-option-message]');
      if (result.valid) setMessage(message, '', '');
    }

    function closeProductDialog() {
      if (!elements.productDialog) return;
      if (typeof elements.productDialog.close === 'function' && elements.productDialog.open) elements.productDialog.close();
      else elements.productDialog.removeAttribute('open');
      editingCartIndex = null;
    }

    function applyPromoCode(code) {
      const normalizedCode = String(code || '').trim().toUpperCase();
      if (!normalizedCode) {
        setMessage(elements.promoMessage, 'Enter a promotion code first.', 'error');
        return;
      }
      if (!sourceConnected) {
        setMessage(elements.promoMessage, 'Promotion codes are verified by the connected shop server. This offline preview cannot validate or apply one.', 'error');
        return;
      }
      appliedPromoCode = normalizedCode;
      if (elements.promoCode) elements.promoCode.value = normalizedCode;
      updatePromoControls();
      invalidateQuote();
      refreshQuote();
    }

    async function handleCheckout(event) {
      event.preventDefault();
      if (!currentUser) {
        setMessage(elements.checkoutMessage, 'Sign in or create an account before placing an order.', 'error');
        if ($('account')) $('account').scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (!sourceConnected || !checkoutConfig) {
        setMessage(elements.checkoutMessage, 'Ordering is disabled in this preview. Connect Supabase and configure the shop first.', 'error');
        return;
      }
      if (!cartHasValidProducts()) {
        setMessage(elements.checkoutMessage, 'Review your cart, product availability, and required options before continuing.', 'error');
        return;
      }
      if (cart.some((item) => productById(item.productId)?.is_sample) && !checkoutConfig.sample_orders_enabled) {
        setMessage(elements.checkoutMessage, 'This cart contains demo products. Replace them with confirmed shop items before ordering.', 'error');
        return;
      }

      const form = event.currentTarget;
      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      const payload = {
        customerName: formData.get('customerName'),
        customerContact: formData.get('customerContact') || '',
        fulfillmentMethod: formData.get('fulfillmentMethod'),
        fulfillmentDetails: formData.get('fulfillmentDetails') || '',
        paymentMethod: formData.get('paymentMethod'),
        promoCode: appliedPromoCode || null,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          options: item.options,
        })),
      };
      setMessage(elements.checkoutMessage, '', '');
      setButtonBusy(elements.placeOrder, true, 'Submitting order…');

      try {
        const result = await api.requestJson(`${endpoint}/orders`, { method: 'POST', body: payload });
        if (result.checkout_url) {
          const checkoutUrl = new URL(result.checkout_url);
          if (checkoutUrl.protocol !== 'https:') throw new Error('The payment provider returned an unsafe checkout URL. Contact the shop owner.');
          setMessage(elements.checkoutMessage, 'Order saved. Opening the payment provider’s hosted checkout. Payment is not complete until Stripe confirms it.', 'info');
          window.location.assign(checkoutUrl.href);
          return;
        }

        const savedOrder = result.order || {};
        const isDemoOrder = Boolean(savedOrder.is_test_order || shopInfo.is_demo);
        const paymentStatus = api.friendlyStatus(savedOrder.payment_status);
        const message = [
          result.message || 'Order saved.',
          savedOrder.order_number ? `Reference: ${savedOrder.order_number}.` : '',
          `Payment status: ${paymentStatus}.`,
          isDemoOrder ? 'This is an unpaid development order; no payment was collected.' : '',
          result.payment_instructions || '',
        ].filter(Boolean).join(' ');
        setMessage(elements.checkoutMessage, message, 'success');
        cart = [];
        appliedPromoCode = '';
        quote = null;
        quoteFingerprint = '';
        if (elements.promoCode) elements.promoCode.value = '';
        updatePromoControls();
        saveCart();
        renderCart();
        await loadDashboard();
      } catch (error) {
        setMessage(elements.checkoutMessage, error.message || 'The order could not be saved. Check the shop setup and try again.', 'error');
      } finally {
        setButtonBusy(elements.placeOrder, false, '', 'Place order');
        updateCheckoutAvailability();
      }
    }

    async function verifyPaymentReturn() {
      const parameters = new URLSearchParams(window.location.search);
      const state = parameters.get('payment');
      if (state === 'cancelled') {
        setMessage(elements.checkoutMessage, 'Checkout was cancelled. No payment is confirmed; you can review your cart and try again.', 'info');
        return;
      }
      if (state !== 'return') return;
      const sessionId = parameters.get('session_id');
      if (!sessionId || !currentUser) {
        setMessage(elements.accountMessage, 'Sign in to verify the payment status and see the order in your account.', 'info');
        return;
      }

      setMessage(elements.accountMessage, 'Checking the payment status with the server…', 'info');
      try {
        const result = await api.requestJson(`${endpoint}/payments/sessions/${encodeURIComponent(sessionId)}`);
        const kind = result.payment_status === 'paid' ? 'success' : 'info';
        setMessage(elements.accountMessage, `${result.message} Order reference: ${result.order_number}.`, kind);
        await loadDashboard();
      } catch (error) {
        setMessage(elements.accountMessage, `Payment status could not be verified: ${error.message}`, 'error');
      }
    }

    function closeMobileMenu() {
      const menu = document.querySelector('.store-nav');
      const toggle = document.querySelector('.store-menu-toggle');
      if (!menu || !toggle) return;
      menu.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.setAttribute('aria-label', 'Open shop navigation');
    }

    function bindEvents() {
      elements.productSearch?.addEventListener('input', renderProducts);
      elements.categoryFilter?.addEventListener('change', renderProducts);
      elements.availabilityFilter?.addEventListener('change', renderProducts);
      elements.sortFilter?.addEventListener('change', renderProducts);

      for (const grid of [elements.productGrid, elements.suggestionGrid, elements.comboGrid]) {
        grid?.addEventListener('click', (event) => {
          const button = event.target.closest('[data-product-action]');
          if (!button) return;
          const product = productById(button.dataset.id);
          if (!product) return;
          if (button.dataset.productAction === 'details') openProductDetails(product);
          if (button.dataset.productAction === 'add') addToCart(product);
        });
      }

      elements.cartItems?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-cart-action]');
        if (!button) return;
        const index = Number(button.dataset.index);
        const item = cart[index];
        if (!item) return;
        if (button.dataset.cartAction === 'remove') cart.splice(index, 1);
        if (button.dataset.cartAction === 'increase') item.quantity = Math.min(99, item.quantity + 1);
        if (button.dataset.cartAction === 'decrease') item.quantity = Math.max(1, item.quantity - 1);
        if (button.dataset.cartAction === 'edit') {
          openProductDetails(productById(item.productId), index);
          return;
        }
        saveCart();
        invalidateQuote();
        refreshQuote();
      });

      elements.clearCart?.addEventListener('click', () => {
        cart = [];
        appliedPromoCode = '';
        if (elements.promoCode) elements.promoCode.value = '';
        updatePromoControls();
        setMessage(elements.promoMessage, '', '');
        invalidateQuote();
        saveCart();
        refreshQuote();
      });

      elements.promoForm?.addEventListener('submit', (event) => {
        event.preventDefault();
        applyPromoCode(elements.promoCode?.value);
      });
      elements.clearPromo?.addEventListener('click', () => {
        appliedPromoCode = '';
        if (elements.promoCode) elements.promoCode.value = '';
        updatePromoControls();
        setMessage(elements.promoMessage, '', '');
        invalidateQuote();
        refreshQuote();
      });

      elements.dealsGrid?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-apply-promo]');
        if (!button) return;
        applyPromoCode(button.dataset.applyPromo);
        if ($('cart')) $('cart').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      elements.dashboardDeals?.addEventListener('click', (event) => {
        const button = event.target.closest('[data-apply-promo]');
        if (!button) return;
        applyPromoCode(button.dataset.applyPromo);
        if ($('cart')) $('cart').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });

      elements.productDetailContent?.addEventListener('input', (event) => {
        const form = event.target.closest('#product-options-form');
        if (!form) return;
        const product = productById(form.dataset.productId);
        if (product) updateDialogPrice(form, product);
      });
      elements.productDetailContent?.addEventListener('change', (event) => {
        const form = event.target.closest('#product-options-form');
        if (!form) return;
        const product = productById(form.dataset.productId);
        if (product) updateDialogPrice(form, product);
      });
      elements.productDetailContent?.addEventListener('click', (event) => {
        if (event.target.closest('[data-close-product]')) closeProductDialog();
      });
      elements.productDetailContent?.addEventListener('submit', (event) => {
        if (event.target.id !== 'product-options-form') return;
        event.preventDefault();
        const form = event.target;
        const product = productById(form.dataset.productId);
        if (!product || !product.available) return;
        const validation = validateOptionForm(form, product);
        if (!validation.valid || !validation.details.valid) {
          setMessage(form.querySelector('[data-option-message]'), 'Choose a valid selection for each required option group.', 'error');
          return;
        }
        const cartIndex = form.dataset.cartIndex === '' ? null : Number(form.dataset.cartIndex);
        if (Number.isInteger(cartIndex) && cart[cartIndex]) {
          cart[cartIndex].options = validation.selections;
          saveCart();
          invalidateQuote();
          refreshQuote();
          closeProductDialog();
        } else {
          closeProductDialog();
          addToCart(product, validation.selections);
        }
      });
      elements.productDialog?.addEventListener('click', (event) => {
        if (event.target === elements.productDialog) closeProductDialog();
      });

      elements.checkoutForm?.addEventListener('submit', handleCheckout);
      elements.fulfillmentMethod?.addEventListener('change', updateFulfillmentRequirement);
      elements.paymentMethodList?.addEventListener('change', (event) => {
        if (event.target.matches('input[name="paymentMethod"]')) {
          selectedPaymentMethod = event.target.value;
          updatePaymentInstructions();
        }
      });
      elements.loginForm?.addEventListener('submit', handleLogin);
      elements.registerForm?.addEventListener('submit', handleRegistration);
      elements.profileForm?.addEventListener('submit', handleProfileUpdate);
      elements.logoutButton?.addEventListener('click', handleLogout);
      elements.refreshOrders?.addEventListener('click', loadDashboard);

      document.querySelectorAll('[data-scroll-to]').forEach((button) => {
        button.addEventListener('click', () => {
          const target = $(button.dataset.scrollTo);
          target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      });

      const menu = document.querySelector('.store-nav');
      const toggle = document.querySelector('.store-menu-toggle');
      toggle?.addEventListener('click', () => {
        const isOpen = menu?.classList.toggle('is-open') || false;
        toggle.setAttribute('aria-expanded', String(isOpen));
        toggle.setAttribute('aria-label', isOpen ? 'Close shop navigation' : 'Open shop navigation');
      });
      menu?.addEventListener('click', (event) => {
        if (event.target.closest('a')) closeMobileMenu();
      });
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeMobileMenu();
      });

      app.addEventListener('error', (event) => {
        const image = event.target;
        if (!(image instanceof HTMLImageElement) || !image.dataset.fallback) return;
        const fallbackUrl = api.safeImageUrl(image.dataset.fallback, fallbackImage());
        if (image.src !== fallbackUrl) {
          image.src = fallbackUrl;
          image.removeAttribute('data-fallback');
        }
      }, true);
    }

    bindEvents();
    updatePromoControls();
    renderCart();
    updateCheckoutNotice();

    const requiresMochajakiAccount = shop === 'mochajaki' && Boolean(elements.memberStoreContent);
    Promise.all([
      ...(requiresMochajakiAccount ? [] : [loadCatalog(), loadDeals()]),
      loadCheckoutConfiguration(),
      loadAccount(),
    ]).finally(() => {
      if (!requiresMochajakiAccount || currentUser) catalogLoaded = true;
      configurationLoaded = true;
      sessionLoaded = true;
      renderProducts();
      renderCart();
      updateCatalogStatus();
      updateCheckoutAvailability();
      updatePromoControls();
      verifyPaymentReturn();
    });
  }

  window.initializeStorefront = initializeStorefront;
})();
