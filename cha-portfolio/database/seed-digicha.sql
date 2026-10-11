-- DigiCha-only catalog seed. Run this file in DigiCha's independent Supabase project only.
-- The listed products/prices are editable sample suggestions authorized for the catalog mockup.
-- Keep the shop in demo mode and confirm specifications/images/prices before accepting live orders.
-- GCash, Maya, and Other are manual choices only; no payment is collected or verified here.

insert into public.shops (
  slug,
  name,
  description,
  currency,
  fulfillment_options,
  payment_methods,
  is_demo
) values (
  'digicha',
  'DigiCha',
  'Custom stickers, mugs, keychains, tarpaulins, certificates, and personalized gifts. Sample prices are for owner review.',
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

-- Retire only this package's earlier named starter rows.
delete from public.products as product
using public.shops as shop
where product.shop_id = shop.id
  and shop.slug = 'digicha'
  and product.is_sample
  and product.name in (
    'Sample Digital Planner',
    'Sample Resume Template',
    'Sample Study Notes Template',
    'Sample Social Media Bundle',
    'Sample Budget Tracker',
    'Sample Digital Sticker Pack'
  );

-- Remove zero-price placeholders from the previous starter seed, but preserve anything an owner edited.
delete from public.products as product
using public.shops as shop
where product.shop_id = shop.id
  and shop.slug = 'digicha'
  and product.is_sample
  and product.available = false
  and product.price = 0
  and product.name in ('Tarpulin', 'Certificate', 'Personalized Pen & Mug');

insert into public.categories (shop_id, name, slug, sort_order)
select shop.id, item.name, item.slug, item.sort_order
from public.shops as shop
cross join (
  values
    ('Stickers', 'stickers', 1),
    ('Mugs', 'mugs', 2),
    ('Keychains', 'keychains', 3),
    ('Tarpulins', 'tarpulins', 4),
    ('Certificates', 'certificates', 5),
    ('Personalized Gifts', 'personalized-gifts', 6)
) as item(name, slug, sort_order)
where shop.slug = 'digicha'
on conflict (shop_id, slug) do nothing;

-- Upgrade only the prior zero-price notebook placeholder to its new sample price and category.
update public.products as product
set category_id = category.id,
    description = 'Sample product idea with a suggested PHP price. Confirm final size, material, artwork, and price before accepting real orders.',
    price = 150.00,
    available = true,
    image_url = '/assets/images/product-placeholder.svg',
    is_sample = true,
    is_featured = false,
    display_order = 16,
    options = '[{"id":"cover","label":"Cover","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"soft","label":"Soft cover","price_delta":0,"display_price":150},{"id":"hard","label":"Hard cover","price_delta":50,"display_price":200}]}]'::jsonb
from public.shops as shop
join public.categories as category
  on category.shop_id = shop.id and category.slug = 'personalized-gifts'
where product.shop_id = shop.id
  and shop.slug = 'digicha'
  and product.name = 'Personalized Notebook'
  and product.is_sample
  and product.price = 0
  and product.available = false;

-- Remove superseded generic categories only when they are empty; preserve any owner-added products.
delete from public.categories as category
using public.shops as shop
where category.shop_id = shop.id
  and shop.slug = 'digicha'
  and category.slug in ('digicha-products', 'digital-products', 'design-templates', 'creative-goods')
  and not exists (
    select 1 from public.products as product where product.category_id = category.id
  );

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
  'Sample product idea with a suggested PHP price. Confirm final size, material, artwork, and price before accepting real orders.',
  item.price,
  true,
  '/assets/images/product-placeholder.svg',
  true,
  item.is_featured,
  item.display_order,
  item.options_json::jsonb
from (
  values
    ('stickers', 'Custom Name Sticker Sheet', 80.00::numeric, false, 1, '[{"id":"size","label":"Sheet size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"small","label":"Mini sheet","price_delta":0,"display_price":80},{"id":"standard","label":"Standard sheet","price_delta":40,"display_price":120}]}]'),
    ('stickers', 'Die-Cut Sticker Pack', 120.00::numeric, false, 2, '[{"id":"finish","label":"Finish","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"matte","label":"Matte","price_delta":0,"display_price":120},{"id":"glossy","label":"Glossy","price_delta":20,"display_price":140}]}]'),
    ('stickers', 'Photo Sticker Sheet', 100.00::numeric, false, 3, '[{"id":"finish","label":"Finish","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"matte","label":"Matte","price_delta":0,"display_price":100},{"id":"glossy","label":"Glossy","price_delta":20,"display_price":120}]}]'),
    ('mugs', 'Personalized Name Mug', 220.00::numeric, false, 4, '[{"id":"capacity","label":"Mug size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"11oz","label":"11 oz","price_delta":0,"display_price":220},{"id":"15oz","label":"15 oz","price_delta":50,"display_price":270}]}]'),
    ('mugs', 'Photo Print Mug', 250.00::numeric, false, 5, '[{"id":"print","label":"Print style","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"one-side","label":"One-sided print","price_delta":0,"display_price":250},{"id":"wrap","label":"Full wrap print","price_delta":40,"display_price":290}]}]'),
    ('mugs', 'Custom Quote Mug', 220.00::numeric, false, 6, '[{"id":"mug-style","label":"Mug style","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"classic","label":"Classic white","price_delta":0,"display_price":220},{"id":"accent","label":"Color-accent handle","price_delta":30,"display_price":250}]}]'),
    ('keychains', 'Acrylic Name Keychain', 100.00::numeric, false, 7, '[{"id":"finish","label":"Finish","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"clear","label":"Clear acrylic","price_delta":0,"display_price":100},{"id":"glitter","label":"Glitter acrylic","price_delta":25,"display_price":125}]}]'),
    ('keychains', 'Photo Keychain', 120.00::numeric, false, 8, '[{"id":"print","label":"Print sides","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"single","label":"Single-sided","price_delta":0,"display_price":120},{"id":"double","label":"Double-sided","price_delta":25,"display_price":145}]}]'),
    ('keychains', 'Custom Initial Charm', 90.00::numeric, false, 9, '[{"id":"finish","label":"Finish","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"clear","label":"Clear acrylic","price_delta":0,"display_price":90},{"id":"color","label":"Color-accent acrylic","price_delta":20,"display_price":110}]}]'),
    ('tarpulins', 'Birthday Tarpulin · 2 × 3 ft', 350.00::numeric, false, 10, '[{"id":"layout","label":"Layout","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"photo-text","label":"Photo and text","price_delta":0,"display_price":350},{"id":"text-only","label":"Text-led layout","price_delta":0,"display_price":350}]}]'),
    ('tarpulins', 'Celebration Tarpulin · 3 × 4 ft', 550.00::numeric, false, 11, '[{"id":"layout","label":"Layout","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"photo-text","label":"Photo and text","price_delta":0,"display_price":550},{"id":"text-only","label":"Text-led layout","price_delta":0,"display_price":550}]}]'),
    ('tarpulins', 'Event Tarpulin · 4 × 6 ft', 850.00::numeric, false, 12, '[{"id":"layout","label":"Layout","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"photo-text","label":"Photo and text","price_delta":0,"display_price":850},{"id":"text-only","label":"Text-led layout","price_delta":0,"display_price":850}]}]'),
    ('certificates', 'Appreciation Certificate Print', 50.00::numeric, false, 13, '[{"id":"paper","label":"Paper finish","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"standard","label":"Standard print","price_delta":0,"display_price":50},{"id":"laminated","label":"Laminated","price_delta":20,"display_price":70}]}]'),
    ('certificates', 'Recognition Certificate Print', 55.00::numeric, false, 14, '[{"id":"paper","label":"Paper finish","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"standard","label":"Standard print","price_delta":0,"display_price":55},{"id":"laminated","label":"Laminated","price_delta":20,"display_price":75}]}]'),
    ('certificates', 'Completion Certificate Print', 55.00::numeric, false, 15, '[{"id":"paper","label":"Paper finish","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"standard","label":"Standard print","price_delta":0,"display_price":55},{"id":"laminated","label":"Laminated","price_delta":20,"display_price":75}]}]'),
    ('personalized-gifts', 'Personalized Notebook', 150.00::numeric, false, 16, '[{"id":"cover","label":"Cover","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"soft","label":"Soft cover","price_delta":0,"display_price":150},{"id":"hard","label":"Hard cover","price_delta":50,"display_price":200}]}]'),
    ('personalized-gifts', 'Personalized Pen & Mug Set', 300.00::numeric, false, 17, '[{"id":"set-style","label":"Set style","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"classic","label":"Classic set","price_delta":0,"display_price":300},{"id":"gift-box","label":"Gift-box presentation","price_delta":60,"display_price":360}]}]')
) as item(category_slug, name, price, is_featured, display_order, options_json)
join public.shops as shop on shop.slug = 'digicha'
join public.categories as category
  on category.shop_id = shop.id and category.slug = item.category_slug
where not exists (
  select 1
  from public.products as existing
  where existing.shop_id = shop.id
    and existing.name = item.name
);

-- No active offers are seeded; configure real offers through the shop admin if desired.
