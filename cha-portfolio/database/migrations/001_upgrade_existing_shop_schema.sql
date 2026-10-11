-- Upgrade guide for the previous Cha shop schema included in this project.
-- Back up the Supabase database before applying this migration.
-- Run this file first, then run database/schema.sql to create new tables/functions
-- and apply current Row Level Security and server-only grants.

begin;

alter table if exists public.shops
  add column if not exists currency text not null default 'PHP',
  add column if not exists fulfillment_options jsonb not null default '[]'::jsonb,
  add column if not exists payment_methods jsonb not null default '[]'::jsonb,
  add column if not exists is_demo boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.categories
  add column if not exists sort_order integer not null default 0;

alter table if exists public.products
  add column if not exists is_featured boolean not null default false,
  add column if not exists options jsonb not null default '[]'::jsonb,
  add column if not exists display_order integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.orders
  add column if not exists customer_id uuid references auth.users(id) on delete set null,
  add column if not exists fulfillment_method text not null default 'unconfigured',
  add column if not exists fulfillment_details text not null default '',
  add column if not exists payment_method text not null default 'unconfigured',
  add column if not exists promo_code text not null default '',
  add column if not exists discount numeric(12, 2) not null default 0,
  add column if not exists currency text not null default 'PHP',
  add column if not exists is_test_order boolean not null default false,
  add column if not exists payment_session_id text,
  add column if not exists payment_intent_id text,
  add column if not exists updated_at timestamptz not null default now();

update public.orders
set status = case status
  when 'received' then 'pending'
  when 'processing' then 'preparing'
  else status
end;

alter table public.orders
  drop constraint if exists orders_status_check;

alter table public.orders
  add constraint orders_status_check
  check (status in (
    'pending',
    'confirmed',
    'preparing',
    'ready_for_pickup',
    'out_for_delivery',
    'completed',
    'cancelled'
  ));

alter table public.orders
  drop constraint if exists orders_total_matches_subtotal_check;

alter table public.orders
  add constraint orders_total_matches_subtotal_check
  check (total = subtotal - discount);

alter table public.orders
  drop constraint if exists orders_currency_format_check;
alter table public.orders
  add constraint orders_currency_format_check
  check (currency ~ '^[A-Z]{3}$');

alter table public.products
  drop constraint if exists products_options_array_check;
alter table public.products
  add constraint products_options_array_check
  check (jsonb_typeof(options) = 'array');

alter table public.shops
  drop constraint if exists shops_fulfillment_options_array_check;
alter table public.shops
  add constraint shops_fulfillment_options_array_check
  check (jsonb_typeof(fulfillment_options) = 'array');

alter table public.shops
  drop constraint if exists shops_payment_methods_array_check;
alter table public.shops
  add constraint shops_payment_methods_array_check
  check (jsonb_typeof(payment_methods) = 'array');

alter table public.order_items
  add column if not exists base_unit_price numeric(12, 2);

alter table public.order_items
  add column if not exists selected_options jsonb not null default '{}'::jsonb;

update public.order_items
set base_unit_price = unit_price
where base_unit_price is null;

alter table public.order_items
  alter column base_unit_price set not null;

alter table public.order_items
  drop constraint if exists order_items_base_price_nonnegative_check;
alter table public.order_items
  add constraint order_items_base_price_nonnegative_check
  check (base_unit_price >= 0);

alter table public.order_items
  drop constraint if exists order_items_selected_options_object_check;
alter table public.order_items
  add constraint order_items_selected_options_object_check
  check (jsonb_typeof(selected_options) = 'object');

create unique index if not exists orders_payment_session_unique_idx
  on public.orders (payment_session_id)
  where payment_session_id is not null;

commit;
