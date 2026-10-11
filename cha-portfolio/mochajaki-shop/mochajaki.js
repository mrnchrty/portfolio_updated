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

  window.STOREFRONT_CONFIG = {
    shopName: 'Mochajaki Snack Corner Gasang',
    currency: 'PHP',
    fallbackImage: '../assets/images/food-placeholder.svg',
    fallbackPaymentMethods: paymentPreviewChoices,
    fallbackCatalog: {
      categories: [
        { id: 'pasta', name: 'Pasta', slug: 'pasta' },
      ],
      products: [
        {
          id: 'mochajaki-lasagna',
          category_id: 'pasta',
          category_name: 'Pasta',
          name: 'Lasagna',
          description: 'Choose Small or Big. Menu prices were provided by the shop owner.',
          price: 50,
          available: true,
          image_url: '../assets/images/food-placeholder.svg',
          is_sample: false,
          is_featured: false,
          options: sizeOptions(50, 70),
        },
        {
          id: 'mochajaki-palabok',
          category_id: 'pasta',
          category_name: 'Pasta',
          name: 'Palabok',
          description: 'Choose Small or Big. Menu prices were provided by the shop owner.',
          price: 40,
          available: true,
          image_url: '../assets/images/food-placeholder.svg',
          is_sample: false,
          is_featured: false,
          options: sizeOptions(40, 60),
        },
        {
          id: 'mochajaki-bake-mac',
          category_id: 'pasta',
          category_name: 'Pasta',
          name: 'Bake Mac',
          description: 'Choose Small or Big. Menu prices were provided by the shop owner.',
          price: 50,
          available: true,
          image_url: '../assets/images/food-placeholder.svg',
          is_sample: false,
          is_featured: false,
          options: sizeOptions(50, 70),
        },
        {
          id: 'mochajaki-mac-and-cheese',
          category_id: 'pasta',
          category_name: 'Pasta',
          name: 'Mac & Cheese',
          description: 'Choose Small or Big. Menu prices were provided by the shop owner.',
          price: 50,
          available: true,
          image_url: '../assets/images/food-placeholder.svg',
          is_sample: false,
          is_featured: false,
          options: sizeOptions(50, 70),
        },
      ],
    },
  };

  window.initializeStorefront?.();
})();
