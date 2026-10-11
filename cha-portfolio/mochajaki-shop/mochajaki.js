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

  const image = '../assets/images/food-placeholder.svg';
  const sampleDescription = 'Sample menu idea with a suggested PHP price. Confirm the recipe, portion, availability, and final price before accepting real orders.';
  const categories = [
    { id: 'pasta', name: 'Pasta', slug: 'pasta' },
    { id: 'beverages', name: 'Beverages', slug: 'beverages' },
    { id: 'snacks', name: 'Snacks', slug: 'snacks' },
    { id: 'chicken-rice', name: 'Chicken & Rice', slug: 'chicken-rice' },
  ];

  const sizeOptions = (smallPrice, bigPrice) => [{
    id: 'size',
    label: 'Size',
    type: 'single',
    required: true,
    min_selected: 1,
    max_selected: 1,
    values: [
      { id: 'small', label: 'Small', price_delta: 0, display_price: smallPrice },
      { id: 'big', label: 'Big', price_delta: bigPrice - smallPrice, display_price: bigPrice },
    ],
  }];

  const products = [
    {
      id: 'mochajaki-lasagna', category_id: 'pasta', category_name: 'Pasta',
      name: 'Lasagna', description: 'Choose Small or Big. Menu prices were supplied by the owner.',
      price: 50, available: true, is_sample: false, is_featured: false,
      options: sizeOptions(50, 70),
    },
    {
      id: 'mochajaki-palabok', category_id: 'pasta', category_name: 'Pasta',
      name: 'Palabok', description: 'Choose Small or Big. Menu prices were supplied by the owner.',
      price: 40, available: true, is_sample: false, is_featured: false,
      options: sizeOptions(40, 60),
    },
    {
      id: 'mochajaki-bake-mac', category_id: 'pasta', category_name: 'Pasta',
      name: 'Bake Mac', description: 'Choose Small or Big. Menu prices were supplied by the owner.',
      price: 50, available: true, is_sample: false, is_featured: false,
      options: sizeOptions(50, 70),
    },
    {
      id: 'mochajaki-mac-and-cheese', category_id: 'pasta', category_name: 'Pasta',
      name: 'Mac & Cheese', description: 'Choose Small or Big. Menu prices were supplied by the owner.',
      price: 50, available: true, is_sample: false, is_featured: false,
      options: sizeOptions(50, 70),
    },
    {
      id: 'mochajaki-iced-coffee', category_id: 'beverages', category_name: 'Beverages',
      name: 'Iced Coffee', price: 60,
    },
    {
      id: 'mochajaki-milk-tea', category_id: 'beverages', category_name: 'Beverages',
      name: 'Classic Milk Tea', price: 75,
    },
    {
      id: 'mochajaki-chocolate-milkshake', category_id: 'beverages', category_name: 'Beverages',
      name: 'Chocolate Milkshake', price: 85,
    },
    {
      id: 'mochajaki-homemade-burger', category_id: 'snacks', category_name: 'Snacks',
      name: 'Homemade Burger', price: 85,
    },
    {
      id: 'mochajaki-hotdog', category_id: 'snacks', category_name: 'Snacks',
      name: 'Classic Hotdog', price: 45,
    },
    {
      id: 'mochajaki-fries', category_id: 'snacks', category_name: 'Snacks',
      name: 'French Fries', price: 50,
    },
    {
      id: 'mochajaki-chicken-rice-classic', category_id: 'chicken-rice', category_name: 'Chicken & Rice',
      name: 'Classic Chicken with Rice', price: 100,
    },
    {
      id: 'mochajaki-chicken-rice-garlic', category_id: 'chicken-rice', category_name: 'Chicken & Rice',
      name: 'Garlic Chicken with Rice', price: 110,
    },
    {
      id: 'mochajaki-chicken-rice-spicy', category_id: 'chicken-rice', category_name: 'Chicken & Rice',
      name: 'Spicy Chicken with Rice', price: 110,
    },
  ].map((product, index) => ({
    ...product,
    description: product.description || sampleDescription,
    available: product.available ?? true,
    image_url: image,
    is_sample: product.is_sample ?? true,
    is_featured: Boolean(product.featured ?? product.is_featured),
    display_order: index + 1,
    options: Array.isArray(product.options) ? product.options : [],
  }));

  window.STOREFRONT_CONFIG = {
    shopName: 'Mochajaki Snack Corner Gasang',
    currency: 'PHP',
    fallbackImage: image,
    fallbackPaymentMethods: paymentPreviewChoices,
    fallbackCatalog: { categories, products },
  };

  window.initializeStorefront?.();

  const filter = document.getElementById('category-filter');
  const pendingCategory = new WeakMap();
  const buttons = document.querySelectorAll('[data-shop-category]');
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

  buttons.forEach((button) => button.addEventListener('click', () => applyCategory(button)));

  if (filter) {
    new MutationObserver(() => {
      buttons.forEach((button) => {
        if (pendingCategory.has(button)) applyCategory(button);
      });
    }).observe(filter, { childList: true });
  }
})();
