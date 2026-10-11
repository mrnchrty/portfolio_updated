-- DigiCha-only starter seed. Run this in DigiCha's Supabase project only.
-- DigiCha product prices/options were not supplied, so all four products remain unavailable.
-- Manual GCash/Maya/Other choices do not collect or verify payment.

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
  'Personalized notebook, tarpulin, certificate, and personalized pen and mug listings.',
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

-- Retire only this package's earlier DigiCha development samples.
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

delete from public.categories as category
using public.shops as shop
where category.shop_id = shop.id
  and shop.slug = 'digicha'
  and category.slug in ('digital-products', 'design-templates', 'creative-goods')
  and not exists (
    select 1
    from public.products as product
    where product.category_id = category.id
  );

insert into public.categories (shop_id, name, slug, sort_order)
select shop.id, 'DigiCha Products', 'digicha-products', 1
from public.shops as shop
where shop.slug = 'digicha'
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
  'Price to be confirmed. This item cannot be ordered until the shop confirms its price and options.',
  0.00,
  false,
  '/assets/images/product-placeholder.svg',
  true,
  false,
  item.display_order,
  '[]'::jsonb
from (
  values
    ('Personalized Notebook', 1),
    ('Tarpulin', 2),
    ('Certificate', 3),
    ('Personalized Pen & Mug', 4)
) as item(name, display_order)
join public.shops as shop on shop.slug = 'digicha'
join public.categories as category
  on category.shop_id = shop.id and category.slug = 'digicha-products'
where not exists (
  select 1
  from public.products as existing
  where existing.shop_id = shop.id
    and existing.name = item.name
);
