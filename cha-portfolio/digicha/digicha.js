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

  window.STOREFRONT_CONFIG = {
    shopName: 'DigiCha',
    currency: 'PHP',
    fallbackImage: '../assets/images/product-placeholder.svg',
    fallbackPaymentMethods: paymentPreviewChoices,
    fallbackCatalog: {
      categories: [
        { id: 'digicha-products', name: 'DigiCha Products', slug: 'digicha-products' },
      ],
      products: [
        {
          id: 'digicha-personalized-notebook',
          category_id: 'digicha-products',
          category_name: 'DigiCha Products',
          name: 'Personalized Notebook',
          description: 'Price to be confirmed. This item cannot be ordered until the shop confirms its price and options.',
          price: 0,
          price_pending: true,
          available: false,
          image_url: '../assets/images/product-placeholder.svg',
          is_sample: true,
          is_featured: false,
          options: [],
        },
        {
          id: 'digicha-tarpulin',
          category_id: 'digicha-products',
          category_name: 'DigiCha Products',
          name: 'Tarpulin',
          description: 'Price to be confirmed. This item cannot be ordered until the shop confirms its price and options.',
          price: 0,
          price_pending: true,
          available: false,
          image_url: '../assets/images/product-placeholder.svg',
          is_sample: true,
          is_featured: false,
          options: [],
        },
        {
          id: 'digicha-certificate',
          category_id: 'digicha-products',
          category_name: 'DigiCha Products',
          name: 'Certificate',
          description: 'Price to be confirmed. This item cannot be ordered until the shop confirms its price and options.',
          price: 0,
          price_pending: true,
          available: false,
          image_url: '../assets/images/product-placeholder.svg',
          is_sample: true,
          is_featured: false,
          options: [],
        },
        {
          id: 'digicha-personalized-pen-mug',
          category_id: 'digicha-products',
          category_name: 'DigiCha Products',
          name: 'Personalized Pen & Mug',
          description: 'Price to be confirmed. This item cannot be ordered until the shop confirms its price and options.',
          price: 0,
          price_pending: true,
          available: false,
          image_url: '../assets/images/product-placeholder.svg',
          is_sample: true,
          is_featured: false,
          options: [],
        },
      ],
    },
  };

  window.initializeStorefront?.();
})();
