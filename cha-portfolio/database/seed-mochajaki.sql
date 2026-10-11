-- Mochajaki-only starter seed. Run this in Mochajaki's separate Supabase project only.
-- Small/Big PHP prices below are the menu values supplied by the owner.
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

-- Retire only this package's earlier Mochajaki development samples.
delete from public.products as product
using public.shops as shop
where product.shop_id = shop.id
  and shop.slug = 'mochajaki'
  and product.is_sample
  and product.name in (
    'Sample Rice Meal',
    'Sample Burger',
    'Sample Snack Combo',
    'Sample Iced Coffee',
    'Sample Milkshake',
    'Sample Baked Treat'
  );

delete from public.categories as category
using public.shops as shop
where category.shop_id = shop.id
  and shop.slug = 'mochajaki'
  and category.slug in ('sample-meals', 'sample-snacks', 'sample-desserts', 'sample-beverages')
  and not exists (
    select 1
    from public.products as product
    where product.category_id = category.id
  );

insert into public.categories (shop_id, name, slug, sort_order)
select shop.id, 'Pasta', 'pasta', 1
from public.shops as shop
where shop.slug = 'mochajaki'
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
  'Choose Small or Big. Menu prices were provided by the shop owner.',
  item.price,
  true,
  '/assets/images/food-placeholder.svg',
  false,
  false,
  item.display_order,
  jsonb_build_array(jsonb_build_object(
    'id', 'size',
    'label', 'Size',
    'type', 'single',
    'required', true,
    'min_selected', 1,
    'max_selected', 1,
    'values', jsonb_build_array(
      jsonb_build_object('id', 'small', 'label', 'Small', 'price_delta', 0, 'display_price', item.price),
      jsonb_build_object('id', 'big', 'label', 'Big', 'price_delta', item.big_delta, 'display_price', item.big_price)
    )
  ))
from (
  values
    ('Lasagna', 50.00::numeric, 70.00::numeric, 20.00::numeric, 1),
    ('Palabok', 40.00::numeric, 60.00::numeric, 20.00::numeric, 2),
    ('Bake Mac', 50.00::numeric, 70.00::numeric, 20.00::numeric, 3),
    ('Mac & Cheese', 50.00::numeric, 70.00::numeric, 20.00::numeric, 4)
) as item(name, price, big_price, big_delta, display_order)
join public.shops as shop on shop.slug = 'mochajaki'
join public.categories as category
  on category.shop_id = shop.id and category.slug = 'pasta'
where not exists (
  select 1
  from public.products as existing
  where existing.shop_id = shop.id
    and existing.name = item.name
);
