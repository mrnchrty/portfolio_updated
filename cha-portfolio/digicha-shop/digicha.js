(() => {
  const paymentPreviewChoices = [
    {
      id: 'gcash',
      label: 'GCash',
      instructions: 'Preview only. The shop must add verified GCash instructions before accepting payment.',
      type: 'manual',
    },
    {
      id: 'maya',
      label: 'Maya',
      instructions: 'Preview only. The shop must add verified Maya instructions before accepting payment.',
      type: 'manual',
    },
    {
      id: 'other',
      label: 'Other',
      instructions: 'Preview only. Confirm any other payment arrangement with the shop.',
      type: 'manual',
    },
  ];

  const image = '../assets/images/product-placeholder.svg';
  const sampleDescription = 'Sample product idea with a suggested PHP price. Confirm final size, material, artwork, and price before accepting real orders.';
  const categories = [
    { id: 'stickers', name: 'Stickers', slug: 'stickers' },
    { id: 'mugs', name: 'Mugs', slug: 'mugs' },
    { id: 'keychains', name: 'Keychains', slug: 'keychains' },
    { id: 'tarpulins', name: 'Tarpulins', slug: 'tarpulins' },
    { id: 'certificates', name: 'Certificates', slug: 'certificates' },
    { id: 'personalized-gifts', name: 'Personalized Gifts', slug: 'personalized-gifts' },
  ];

  const optionGroup = (id, label, values) => [{
    id,
    label,
    type: 'single',
    required: true,
    min_selected: 1,
    max_selected: 1,
    values: values.map(([valueId, valueLabel, priceDelta, displayPrice]) => ({
      id: valueId,
      label: valueLabel,
      price_delta: priceDelta,
      display_price: displayPrice,
    })),
  }];

  const products = [
    {
      id: 'digicha-sticker-name-sheet', category_id: 'stickers', category_name: 'Stickers',
      name: 'Custom Name Sticker Sheet', price: 80,
      options: optionGroup('size', 'Sheet size', [['small', 'Mini sheet', 0, 80], ['standard', 'Standard sheet', 40, 120]]),
    },
    {
      id: 'digicha-sticker-die-cut-pack', category_id: 'stickers', category_name: 'Stickers',
      name: 'Die-Cut Sticker Pack', price: 120,
      options: optionGroup('finish', 'Finish', [['matte', 'Matte', 0, 120], ['glossy', 'Glossy', 20, 140]]),
    },
    {
      id: 'digicha-sticker-photo-sheet', category_id: 'stickers', category_name: 'Stickers',
      name: 'Photo Sticker Sheet', price: 100,
      options: optionGroup('finish', 'Finish', [['matte', 'Matte', 0, 100], ['glossy', 'Glossy', 20, 120]]),
    },
    {
      id: 'digicha-mug-name', category_id: 'mugs', category_name: 'Mugs',
      name: 'Personalized Name Mug', price: 220,
      options: optionGroup('capacity', 'Mug size', [['11oz', '11 oz', 0, 220], ['15oz', '15 oz', 50, 270]]),
    },
    {
      id: 'digicha-mug-photo-wrap', category_id: 'mugs', category_name: 'Mugs',
      name: 'Photo Print Mug', price: 250,
      options: optionGroup('print', 'Print style', [['one-side', 'One-sided print', 0, 250], ['wrap', 'Full wrap print', 40, 290]]),
    },
    {
      id: 'digicha-mug-quote', category_id: 'mugs', category_name: 'Mugs',
      name: 'Custom Quote Mug', price: 220,
      options: optionGroup('mug-style', 'Mug style', [['classic', 'Classic white', 0, 220], ['accent', 'Color-accent handle', 30, 250]]),
    },
    {
      id: 'digicha-keychain-name', category_id: 'keychains', category_name: 'Keychains',
      name: 'Acrylic Name Keychain', price: 100,
      options: optionGroup('finish', 'Finish', [['clear', 'Clear acrylic', 0, 100], ['glitter', 'Glitter acrylic', 25, 125]]),
    },
    {
      id: 'digicha-keychain-photo', category_id: 'keychains', category_name: 'Keychains',
      name: 'Photo Keychain', price: 120,
      options: optionGroup('print', 'Print sides', [['single', 'Single-sided', 0, 120], ['double', 'Double-sided', 25, 145]]),
    },
    {
      id: 'digicha-keychain-initial', category_id: 'keychains', category_name: 'Keychains',
      name: 'Custom Initial Charm', price: 90,
      options: optionGroup('finish', 'Finish', [['clear', 'Clear acrylic', 0, 90], ['color', 'Color-accent acrylic', 20, 110]]),
    },
    {
      id: 'digicha-tarpulin-birthday', category_id: 'tarpulins', category_name: 'Tarpulins',
      name: 'Birthday Tarpulin · 2 × 3 ft', price: 350,
      options: optionGroup('layout', 'Layout', [['photo-text', 'Photo and text', 0, 350], ['text-only', 'Text-led layout', 0, 350]]),
    },
    {
      id: 'digicha-tarpulin-celebration', category_id: 'tarpulins', category_name: 'Tarpulins',
      name: 'Celebration Tarpulin · 3 × 4 ft', price: 550,
      options: optionGroup('layout', 'Layout', [['photo-text', 'Photo and text', 0, 550], ['text-only', 'Text-led layout', 0, 550]]),
    },
    {
      id: 'digicha-tarpulin-event', category_id: 'tarpulins', category_name: 'Tarpulins',
      name: 'Event Tarpulin · 4 × 6 ft', price: 850,
      options: optionGroup('layout', 'Layout', [['photo-text', 'Photo and text', 0, 850], ['text-only', 'Text-led layout', 0, 850]]),
    },
    {
      id: 'digicha-certificate-appreciation', category_id: 'certificates', category_name: 'Certificates',
      name: 'Appreciation Certificate Print', price: 50,
      options: optionGroup('paper', 'Paper finish', [['standard', 'Standard print', 0, 50], ['laminated', 'Laminated', 20, 70]]),
    },
    {
      id: 'digicha-certificate-recognition', category_id: 'certificates', category_name: 'Certificates',
      name: 'Recognition Certificate Print', price: 55,
      options: optionGroup('paper', 'Paper finish', [['standard', 'Standard print', 0, 55], ['laminated', 'Laminated', 20, 75]]),
    },
    {
      id: 'digicha-certificate-completion', category_id: 'certificates', category_name: 'Certificates',
      name: 'Completion Certificate Print', price: 55,
      options: optionGroup('paper', 'Paper finish', [['standard', 'Standard print', 0, 55], ['laminated', 'Laminated', 20, 75]]),
    },
    {
      id: 'digicha-personalized-notebook', category_id: 'personalized-gifts', category_name: 'Personalized Gifts',
      name: 'Personalized Notebook', price: 150,
      options: optionGroup('cover', 'Cover', [['soft', 'Soft cover', 0, 150], ['hard', 'Hard cover', 50, 200]]),
    },
    {
      id: 'digicha-personalized-pen-mug-set', category_id: 'personalized-gifts', category_name: 'Personalized Gifts',
      name: 'Personalized Pen & Mug Set', price: 300,
      options: optionGroup('set-style', 'Set style', [['classic', 'Classic set', 0, 300], ['gift-box', 'Gift-box presentation', 60, 360]]),
    },
  ].map((product, index) => ({
    ...product,
    description: sampleDescription,
    available: true,
    image_url: image,
    is_sample: true,
    is_featured: Boolean(product.featured),
    display_order: index + 1,
  }));

  window.STOREFRONT_CONFIG = {
    shopName: 'DigiCha',
    currency: 'PHP',
    fallbackImage: image,
    fallbackPaymentMethods: paymentPreviewChoices,
    fallbackCatalog: { categories, products },
  };

  window.initializeStorefront?.();

  const filter = document.getElementById('category-filter');
  const pendingCategory = new WeakMap();
  const applyCategory = (button) => {
    if (!filter) return;
    const requested = String(button.dataset.shopCategory || '').trim().toLocaleLowerCase();
    const option = [...filter.options].find((item) => item.textContent.trim().toLocaleLowerCase() === requested);
    if (!option) {
      pendingCategory.set(button, requested);
      document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    filter.value = option.value;
    filter.dispatchEvent(new Event('change', { bubbles: true }));
    document.getElementById('catalog')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  document.querySelectorAll('.digi-category-card[data-shop-category]').forEach((button) => {
    button.addEventListener('click', () => applyCategory(button));
  });

  if (filter) {
    new MutationObserver(() => {
      document.querySelectorAll('.digi-category-card[data-shop-category]').forEach((button) => {
        if (pendingCategory.has(button)) applyCategory(button);
      });
    }).observe(filter, { childList: true });
  }
})();
