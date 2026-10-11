# DigiCha storefront

This folder contains the standalone DigiCha storefront page, responsive black-and-pink styles, and offline catalog fallback. The page is served at `/digicha-shop/` by the shared Express app and requests catalog, account, and order services from `/api/shops/digicha`.

The category cards and product catalog include at least three editable sample listings each for stickers, mugs, keychains, tarpaulins, and certificates. The earlier personalized notebook and pen/mug set are retained as additional sample gifts. PHP prices and option deltas are suggestions for owner review, not verified final prices. Product image paths remain replaceable placeholders; no real product photos are included.

The app shares common storefront UI from `../shared/` and image slots from `../assets/`. Its catalog, customer accounts, orders, and Auth project use only DigiCha’s separate Supabase project, selected by `DIGICHA_SUPABASE_URL`, `DIGICHA_SUPABASE_ANON_KEY`, and the server-only `DIGICHA_SUPABASE_SERVICE_ROLE_KEY` in `../backend/.env`. Run `../database/seed-digicha.sql` only in DigiCha’s Supabase project. The seed keeps the shop in demo mode, so sample products cannot be used for live orders by default. See the parent README for setup and deployment notes.

For personalized text, the checkout notes field accepts written instructions. The storefront does not upload customer artwork; confirm files, final proof, and fulfillment with the shop owner before printing.
