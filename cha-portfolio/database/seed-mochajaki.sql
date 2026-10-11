-- Mochajaki-only catalog seed. Run this file in Mochajaki's independent Supabase project only.
-- The Small/Big pasta prices are the values supplied by the owner.
-- Drinks, snacks, chicken-rice meal variants, and food-combo bundles are sample ideas with suggested PHP prices for owner review.
-- The listed flavor/size choices are suggestions, not confirmed live menu details. Keep this shop in demo mode until reviewed.
-- GCash, Maya, and Other remain manual choices only; no payment is collected or verified here.

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
  'Pasta, beverages, snacks, chicken-with-rice meals, and owner-review food-combo suggestions.',
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

-- Retire only this package's earlier named development samples.
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
select shop.id, item.name, item.slug, item.sort_order
from public.shops as shop
cross join (
  values
    ('Pasta', 'pasta', 1),
    ('Beverages', 'beverages', 2),
    ('Snacks', 'snacks', 3),
    ('Chicken & Rice', 'chicken-rice', 4),
    ('Combo Deals', 'combo-deals', 5)
) as item(name, slug, sort_order)
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
  'Choose Small or Big. Menu prices were supplied by the owner.',
  item.price,
  true,
  '/assets/images/food-placeholder.svg',
  false,
  item.is_featured,
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
    ('Lasagna', 50.00::numeric, 70.00::numeric, 20.00::numeric, false, 1),
    ('Palabok', 40.00::numeric, 60.00::numeric, 20.00::numeric, false, 2),
    ('Bake Mac', 50.00::numeric, 70.00::numeric, 20.00::numeric, false, 3),
    ('Mac & Cheese', 50.00::numeric, 70.00::numeric, 20.00::numeric, false, 4)
) as item(name, price, big_price, big_delta, is_featured, display_order)
join public.shops as shop on shop.slug = 'mochajaki'
join public.categories as category
  on category.shop_id = shop.id and category.slug = 'pasta'
where not exists (
  select 1
  from public.products as existing
  where existing.shop_id = shop.id
    and existing.name = item.name
);

-- Rename only our earlier sample milkshake row. Do not change a non-sample owner listing.
update public.products as product
set name = 'Milkshake',
    updated_at = now()
from public.shops as shop
where product.shop_id = shop.id
  and shop.slug = 'mochajaki'
  and product.name = 'Chocolate Milkshake'
  and product.is_sample
  and product.description like 'Sample menu idea with a suggested PHP price.%'
  and not exists (
    select 1
    from public.products as existing
    where existing.shop_id = shop.id
      and existing.name = 'Milkshake'
  );

-- Refresh only this seed's prior sample rows so an already-seeded project gains the new choices.
with sample_items (
  category_slug, name, description, price, is_featured, display_order, options
) as (
  values
    (
      'beverages', 'Iced Coffee',
      'Sample menu idea with a suggested PHP price. Choose Classic, Caramel, or Mocha and Regular or Large.',
      60.00::numeric, true, 5,
      '[{"id":"flavor","label":"Flavor","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"classic","label":"Classic","price_delta":0},{"id":"caramel","label":"Caramel","price_delta":10},{"id":"mocha","label":"Mocha","price_delta":10}]},{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":20}]}]'::jsonb
    ),
    (
      'beverages', 'Classic Milk Tea',
      'Sample menu idea with a suggested PHP price. Choose Classic, Wintermelon, Taro, or Brown Sugar and Regular or Large.',
      75.00::numeric, false, 6,
      '[{"id":"flavor","label":"Flavor","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"classic","label":"Classic","price_delta":0},{"id":"wintermelon","label":"Wintermelon","price_delta":0},{"id":"taro","label":"Taro","price_delta":0},{"id":"brown-sugar","label":"Brown sugar","price_delta":10}]},{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":20}]}]'::jsonb
    ),
    (
      'beverages', 'Milkshake',
      'Sample menu idea with a suggested PHP price. Choose Chocolate, Strawberry, or Mango and Regular or Large.',
      85.00::numeric, false, 7,
      '[{"id":"flavor","label":"Flavor","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"chocolate","label":"Chocolate","price_delta":0},{"id":"strawberry","label":"Strawberry","price_delta":0},{"id":"mango","label":"Mango","price_delta":0}]},{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":25}]}]'::jsonb
    ),
    (
      'snacks', 'Homemade Burger',
      'Sample menu idea with a suggested PHP price. Choose a Single or Double patty.',
      85.00::numeric, true, 8,
      '[{"id":"size","label":"Patty size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"single","label":"Single patty","price_delta":0},{"id":"double","label":"Double patty","price_delta":35}]}]'::jsonb
    ),
    (
      'snacks', 'Classic Hotdog',
      'Sample menu idea with a suggested PHP price. Choose Regular or Jumbo.',
      45.00::numeric, false, 9,
      '[{"id":"size","label":"Hotdog size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"jumbo","label":"Jumbo","price_delta":20}]}]'::jsonb
    ),
    (
      'snacks', 'French Fries',
      'Sample menu idea with a suggested PHP price. Choose Regular or Large and Original, Cheese, or Barbecue seasoning.',
      50.00::numeric, false, 10,
      '[{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":20}]},{"id":"seasoning","label":"Seasoning","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"original","label":"Original","price_delta":0},{"id":"cheese","label":"Cheese","price_delta":10},{"id":"barbecue","label":"Barbecue","price_delta":10}]}]'::jsonb
    ),
    (
      'chicken-rice', 'Classic Chicken with Rice',
      'Sample menu idea with a suggested PHP price. Choose a Regular or Large meal.',
      100.00::numeric, true, 11,
      '[{"id":"size","label":"Meal size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":30}]}]'::jsonb
    ),
    (
      'chicken-rice', 'Garlic Chicken with Rice',
      'Sample menu idea with a suggested PHP price. Choose a Regular or Large meal.',
      110.00::numeric, false, 12,
      '[{"id":"size","label":"Meal size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":30}]}]'::jsonb
    ),
    (
      'chicken-rice', 'Spicy Chicken with Rice',
      'Sample menu idea with a suggested PHP price. Choose a Regular or Large meal.',
      110.00::numeric, false, 13,
      '[{"id":"size","label":"Meal size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":30}]}]'::jsonb
    ),
    (
      'combo-deals', 'Palabok & Iced Coffee Combo',
      'Sample combo idea with a suggested PHP price. Includes Small Palabok and one Regular Iced Coffee; confirm the bundle before publishing.',
      95.00::numeric, false, 14, '[]'::jsonb
    ),
    (
      'combo-deals', 'Homemade Burger & Fries Combo',
      'Sample combo idea with a suggested PHP price. Includes a Single-patty Homemade Burger and Regular Fries; confirm the bundle before publishing.',
      125.00::numeric, false, 15, '[]'::jsonb
    ),
    (
      'combo-deals', 'Chicken Rice & Milk Tea Combo',
      'Sample combo idea with a suggested PHP price. Includes Regular Classic Chicken with Rice and one Regular Classic Milk Tea; confirm the bundle before publishing.',
      160.00::numeric, false, 16, '[]'::jsonb
    )
)
update public.products as product
set category_id = category.id,
    description = item.description,
    price = item.price,
    available = true,
    image_url = '/assets/images/food-placeholder.svg',
    is_sample = true,
    is_featured = item.is_featured,
    display_order = item.display_order,
    options = item.options,
    updated_at = now()
from sample_items as item
join public.shops as shop on shop.slug = 'mochajaki'
join public.categories as category
  on category.shop_id = shop.id and category.slug = item.category_slug
where product.shop_id = shop.id
  and product.name = item.name
  and product.is_sample
  and (
    product.description like 'Sample menu idea with a suggested PHP price.%'
    or product.description like 'Sample combo idea with a suggested PHP price.%'
  );

-- Insert any sample listings that aren't already present. Existing non-sample owner entries are left untouched.
with sample_items (
  category_slug, name, description, price, is_featured, display_order, options
) as (
  values
    (
      'beverages', 'Iced Coffee',
      'Sample menu idea with a suggested PHP price. Choose Classic, Caramel, or Mocha and Regular or Large.',
      60.00::numeric, true, 5,
      '[{"id":"flavor","label":"Flavor","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"classic","label":"Classic","price_delta":0},{"id":"caramel","label":"Caramel","price_delta":10},{"id":"mocha","label":"Mocha","price_delta":10}]},{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":20}]}]'::jsonb
    ),
    (
      'beverages', 'Classic Milk Tea',
      'Sample menu idea with a suggested PHP price. Choose Classic, Wintermelon, Taro, or Brown Sugar and Regular or Large.',
      75.00::numeric, false, 6,
      '[{"id":"flavor","label":"Flavor","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"classic","label":"Classic","price_delta":0},{"id":"wintermelon","label":"Wintermelon","price_delta":0},{"id":"taro","label":"Taro","price_delta":0},{"id":"brown-sugar","label":"Brown sugar","price_delta":10}]},{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":20}]}]'::jsonb
    ),
    (
      'beverages', 'Milkshake',
      'Sample menu idea with a suggested PHP price. Choose Chocolate, Strawberry, or Mango and Regular or Large.',
      85.00::numeric, false, 7,
      '[{"id":"flavor","label":"Flavor","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"chocolate","label":"Chocolate","price_delta":0},{"id":"strawberry","label":"Strawberry","price_delta":0},{"id":"mango","label":"Mango","price_delta":0}]},{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":25}]}]'::jsonb
    ),
    (
      'snacks', 'Homemade Burger',
      'Sample menu idea with a suggested PHP price. Choose a Single or Double patty.',
      85.00::numeric, true, 8,
      '[{"id":"size","label":"Patty size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"single","label":"Single patty","price_delta":0},{"id":"double","label":"Double patty","price_delta":35}]}]'::jsonb
    ),
    (
      'snacks', 'Classic Hotdog',
      'Sample menu idea with a suggested PHP price. Choose Regular or Jumbo.',
      45.00::numeric, false, 9,
      '[{"id":"size","label":"Hotdog size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"jumbo","label":"Jumbo","price_delta":20}]}]'::jsonb
    ),
    (
      'snacks', 'French Fries',
      'Sample menu idea with a suggested PHP price. Choose Regular or Large and Original, Cheese, or Barbecue seasoning.',
      50.00::numeric, false, 10,
      '[{"id":"size","label":"Size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":20}]},{"id":"seasoning","label":"Seasoning","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"original","label":"Original","price_delta":0},{"id":"cheese","label":"Cheese","price_delta":10},{"id":"barbecue","label":"Barbecue","price_delta":10}]}]'::jsonb
    ),
    (
      'chicken-rice', 'Classic Chicken with Rice',
      'Sample menu idea with a suggested PHP price. Choose a Regular or Large meal.',
      100.00::numeric, true, 11,
      '[{"id":"size","label":"Meal size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":30}]}]'::jsonb
    ),
    (
      'chicken-rice', 'Garlic Chicken with Rice',
      'Sample menu idea with a suggested PHP price. Choose a Regular or Large meal.',
      110.00::numeric, false, 12,
      '[{"id":"size","label":"Meal size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":30}]}]'::jsonb
    ),
    (
      'chicken-rice', 'Spicy Chicken with Rice',
      'Sample menu idea with a suggested PHP price. Choose a Regular or Large meal.',
      110.00::numeric, false, 13,
      '[{"id":"size","label":"Meal size","type":"single","required":true,"min_selected":1,"max_selected":1,"values":[{"id":"regular","label":"Regular","price_delta":0},{"id":"large","label":"Large","price_delta":30}]}]'::jsonb
    ),
    (
      'combo-deals', 'Palabok & Iced Coffee Combo',
      'Sample combo idea with a suggested PHP price. Includes Small Palabok and one Regular Iced Coffee; confirm the bundle before publishing.',
      95.00::numeric, false, 14, '[]'::jsonb
    ),
    (
      'combo-deals', 'Homemade Burger & Fries Combo',
      'Sample combo idea with a suggested PHP price. Includes a Single-patty Homemade Burger and Regular Fries; confirm the bundle before publishing.',
      125.00::numeric, false, 15, '[]'::jsonb
    ),
    (
      'combo-deals', 'Chicken Rice & Milk Tea Combo',
      'Sample combo idea with a suggested PHP price. Includes Regular Classic Chicken with Rice and one Regular Classic Milk Tea; confirm the bundle before publishing.',
      160.00::numeric, false, 16, '[]'::jsonb
    )
)
insert into public.products (
  shop_id, category_id, name, description, price, available, image_url,
  is_sample, is_featured, display_order, options
)
select
  shop.id,
  category.id,
  item.name,
  item.description,
  item.price,
  true,
  '/assets/images/food-placeholder.svg',
  true,
  item.is_featured,
  item.display_order,
  item.options
from sample_items as item
join public.shops as shop on shop.slug = 'mochajaki'
join public.categories as category
  on category.shop_id = shop.id and category.slug = item.category_slug
where not exists (
  select 1
  from public.products as existing
  where existing.shop_id = shop.id
    and existing.name = item.name
);

-- No active discounts, promotions, or promo-code redemption rules are seeded.
