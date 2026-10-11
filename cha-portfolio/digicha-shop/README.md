# DigiCha storefront

This folder contains the DigiCha storefront page, styles, and catalog fallback. It is served at `/digicha-shop/` by the shared Express app and requests catalog, account, and order services from `/api/shops/digicha`.

The app currently shares common storefront UI from `../shared/` and images from `../assets/`. Its database and Auth project are selected by `DIGICHA_SUPABASE_URL`, `DIGICHA_SUPABASE_ANON_KEY`, and the server-only `DIGICHA_SUPABASE_SERVICE_ROLE_KEY` in `../backend/.env`. Run `../database/seed-digicha.sql` only in DigiCha’s Supabase project. See the parent README for setup and deployment notes.
