# Mochajaki storefront

This folder contains the standalone Mochajaki Snack Corner Gasang storefront page, responsive styling in the existing warm cream/olive/brown palette, and offline catalog fallback. It is served at `/mochajaki-shop/` by the shared Express app and requests catalog, account, and order services from `/api/shops/mochajaki`.

The menu includes the owner-provided Pasta listings and Small/Big prices—Lasagna ₱50/₱70, Palabok ₱40/₱60, Bake Mac ₱50/₱70, and Mac & Cheese ₱50/₱70—plus three suggested sample items each for beverages (coffee, milk tea, milkshake), snacks (homemade burger, hotdog, fries), and chicken-with-rice flavors. New non-pasta prices are editable sample PHP suggestions for owner review. Product image paths remain replaceable placeholders; no food photos are included.

The app shares common storefront UI from `../shared/` and image slots from `../assets/`. Its catalog, customer accounts, orders, and Auth project use only Mochajaki’s separate Supabase project, selected by `MOCHAJAKI_SUPABASE_URL`, `MOCHAJAKI_SUPABASE_ANON_KEY`, and the server-only `MOCHAJAKI_SUPABASE_SERVICE_ROLE_KEY` in `../backend/.env`. Run `../database/seed-mochajaki.sql` only in Mochajaki’s Supabase project. The seed keeps the shop in demo mode, so sample menu products cannot be used for live orders by default. See the parent README for setup and deployment notes.
