# Mochajaki storefront

This folder contains the standalone Mochajaki Snack Corner Gasang storefront page, responsive styling in the existing warm cream/olive/brown palette, and an offline sample catalog. It is served at `/mochajaki-shop/` by the shared Express app and requests catalog, account, and order services from `/api/shops/mochajaki`.

## Account-first flow

The visitor sees the account registration/sign-in forms before any Top Offers, menu items, combo deals, or cart. The member catalog is not fetched until the Mochajaki account session is confirmed; after sign-in, the page takes the customer to Top Offers, followed by the menu grouped into categories and then food-combo Deals. Signing out hides the member content again. Real registration/sign-in requires the Express server and Mochajaki's own Supabase project credentials; there is no fake-auth mode. Supabase is not configured in this preview, so accounts and checkout cannot yet work.

## Catalog samples

The menu preserves the owner-provided pasta names and Small/Big prices: Lasagna ₱50/₱70, Palabok ₱40/₱60, Bake Mac ₱50/₱70, and Mac & Cheese ₱50/₱70. It adds three sample ideas each for beverages (Iced Coffee, Classic Milk Tea, Milkshake), snacks (Homemade Burger, Classic Hotdog, French Fries), and chicken-with-rice meals (Classic, Garlic, Spicy). These additional PHP prices and flavors/sizes are suggestions for review, not confirmed offerings.

The Deals section contains sample food bundles: Palabok & Iced Coffee, Homemade Burger & Fries, and Chicken Rice & Milk Tea. Their suggested bundle prices and included items need the owner's approval. The storefront intentionally has no promo-code entry UI. Product image paths remain replaceable placeholders; no food photos are included.

The app shares common storefront UI from `../shared/` and image slots from `../assets/`. Its catalog, customer accounts, orders, and Auth project use only Mochajaki's separate Supabase project, selected by `MOCHAJAKI_SUPABASE_URL`, `MOCHAJAKI_SUPABASE_ANON_KEY`, and the server-only `MOCHAJAKI_SUPABASE_SERVICE_ROLE_KEY` in `../backend/.env`. Run `../database/seed-mochajaki.sql` only in Mochajaki's Supabase project. The seed keeps the shop in demo mode, so sample menu products cannot be used for live orders by default. See the parent README for setup and deployment notes.
