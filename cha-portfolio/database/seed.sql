-- Development seed and user-provided starter catalog.
-- Mochajaki product names and prices below are the menu values supplied by the owner.
-- DigiCha product names are supplied, but prices/options are still pending; those items stay
-- unavailable and cannot be ordered until real prices and options are entered.
-- GCash, Maya, and Other are manual payment selections only. No funds are collected or verified.

insert into public.shops (
  slug,
  name,
  description,
  currency,
  fulfillment_options,
  payment_methods,
  is_demo
) values
(
  'digicha',
  'DigiCha',
  'Personalized notebook, tarpulin, certificate, and personalized pen and mug listings.',
  'PHP',
  '[{"id":"demo-fulfillment","label":"Development fulfillment (replace before launch)","enabled":true}]'::jsonb,
  '[{"id":"gcash","label":"GCash","enabled":true,"instructions":"Add verified GCash payment instructions before accepting payment. Orders remain unpaid until payment is verified separately."},{"id":"maya","label":"Maya","enabled":true,"instructions":"Add verified Maya payment instructions before accepting payment. Orders remain unpaid until payment is verified separately."},{"id":"other","label":"Other","enabled":true,"instructions":"Confirm any other payment arrangement with the shop. Orders remain unpaid until payment is verified separately."}]'::jsonb,
  true
),
(
  'mochajaki',
  'Mochajaki Snack Corner Gasang',
  'Pasta menu with Small and Big prices supplied by the owner; amounts are in Philippine pesos.',
  'PHP',
  '[{"id":"demo-fulfillment","label":"Development fulfillment (replace before launch)","enabled":true}]'::jsonb,
  '[{"id":"gcash","label":"GCash","enabled":true,"instructions":"Add verified GCash payment instructions before accepting payment. Orders remain unpaid until payment is verified separately."},{"id":"maya","label":"Maya","enabled":true,"instructions":"Add verified Maya payment instructions before accepting payment. Orders remain unpaid until payment is verified separately."},{"id":"other","label":"Other","enabled":true,"instructions":"Confirm any other payment arrangement with the shop. Orders remain unpaid until payment is verified separately."}]'::jsonb,
  true
)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    currency = excluded.currency,
    payment_methods = excluded.payment_methods;

-- Retire only the earlier package's named development sample rows. Order item snapshots remain;
-- custom products (including products with the same name but is_sample=false) are not touched.
delete from public.products as product
using public.shops as shop
where product.shop_id = shop.id
  and product.is_sample
  and (
    (shop.slug = 'digicha' and product.name in (
      'Sample Digital Planner',
      'Sample Resume Template',
      'Sample Study Notes Template',
      'Sample Social Media Bundle',
      'Sample Budget Tracker',
      'Sample Digital Sticker Pack'
    ))
    or (shop.slug = 'mochajaki' and product.name in (
      'Sample Rice Meal',
      'Sample Burger',
      'Sample Snack Combo',
      'Sample Iced Coffee',
      'Sample Milkshake',
      'Sample Baked Treat'
    ))
  );

-- Remove only now-unused category names from the earlier starter catalog.
delete from public.categories as category
using public.shops as shop
where category.shop_id = shop.id
  and (
    (shop.slug = 'digicha' and category.slug in ('digital-products', 'design-templates', 'creative-goods'))
    or (shop.slug = 'mochajaki' and category.slug in ('sample-meals', 'sample-snacks', 'sample-desserts', 'sample-beverages'))
  )
  and not exists (
    select 1
    from public.products as product
    where product.category_id = category.id
  );

insert into public.categories (shop_id, name, slug, sort_order)
select shop.id, category.name, category.slug, category.sort_order
from public.shops as shop
cross join (
  values
    ('digicha', 'DigiCha Products', 'digicha-products', 1),
    ('mochajaki', 'Pasta', 'pasta', 1)
) as category(shop_slug, name, slug, sort_order)
where shop.slug = category.shop_slug
on conflict (shop_id, slug) do nothing;

insert into public.products (
  shop_id,
  category_id,
  name,
  description,
  price,
  available,
  image_url,
  is_sample,
  is_featured,
  display_order,
  options
)
select
  shop.id,
  category.id,
  item.name,
  item.description,
  item.price,
  item.available,
  item.image_url,
  item.is_sample,
  item.is_featured,
  item.display_order,
  item.options_json::jsonb
from (
  values
    ('digicha', 'digicha-products', 'Personalized Notebook', 'Price to be confirmed. This item cannot be ordered until the shop confirms its price and options.', 0.00, false, '/assets/images/product-placeholder.svg', true, false, 1, '[]'),
    ('digicha', 'digicha-products', 'Tarpulin', 'Price to be confirmed. This item cannot be ordered until the shop confirms its price and options.', 0.00, false, '/assets/images/product-placeholder.svg', true, false, 2, '[]'),
    ('digicha', 'digicha-products', 'Certificate', 'Price to be confirmed. This item cannot be ordered until the shop confirms its price and options.', 0.00, false, '/assets/images/product-placeholder.svg', true, false, 3, '[]'),
    ('digicha', 'digicha-products', 'Personalized Pen & Mug', 'Price to be confirmed. This item cannot be ordered until the shop confirms its price and options.', 0.00, false, '/assets/images/product-placeholder.svg', true, false, 4, '[]'),
    ('mochajaki', 'pasta', 'Lasagna', 'Choose Small or Big. Menu prices were provided by the shop owner.', 50.00, true, '/assets/images/food-placeholder.svg', false, false, 1, '[{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"small","label":"Small","price_delta":0,"display_price":50},{"id":"big","label":"Big","price_delta":20,"display_price":70}]}]'),
    ('mochajaki', 'pasta', 'Palabok', 'Choose Small or Big. Menu prices were provided by the shop owner.', 40.00, true, '/assets/images/food-placeholder.svg', false, false, 2, '[{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"small","label":"Small","price_delta":0,"display_price":40},{"id":"big","label":"Big","price_delta":20,"display_price":60}]}]'),
    ('mochajaki', 'pasta', 'Bake Mac', 'Choose Small or Big. Menu prices were provided by the shop owner.', 50.00, true, '/assets/images/food-placeholder.svg', false, false, 3, '[{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"small","label":"Small","price_delta":0,"display_price":50},{"id":"big","label":"Big","price_delta":20,"display_price":70}]}]'),
    ('mochajaki', 'pasta', 'Mac & Cheese', 'Choose Small or Big. Menu prices were provided by the shop owner.', 50.00, true, '/assets/images/food-placeholder.svg', false, false, 4, '[{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"small","label":"Small","price_delta":0,"display_price":50},{"id":"big","label":"Big","price_delta":20,"display_price":70}]}]')
) as item(shop_slug, category_slug, name, description, price, available, image_url, is_sample, is_featured, display_order, options_json)
join public.shops as shop on shop.slug = item.shop_slug
join public.categories as category on category.shop_id = shop.id and category.slug = item.category_slug
where not exists (
  select 1
  from public.products as existing
  where existing.shop_id = shop.id
    and existing.name = item.name
);

-- No discounts are seeded because discount amounts, validity dates, and conditions were not provided.
-- Configure real offers through the admin panel; fixed amounts, thresholds, and totals display in PHP.
