# Mochajaki storefront

This folder contains the Mochajaki storefront page, styles, and catalog fallback. It is served at `/mochajaki-shop/` by the shared Express app and requests catalog, account, and order services from `/api/shops/mochajaki`.

The app currently shares common storefront UI from `../shared/` and images from `../assets/`. Its database and Auth project are selected by `MOCHAJAKI_SUPABASE_URL`, `MOCHAJAKI_SUPABASE_ANON_KEY`, and the server-only `MOCHAJAKI_SUPABASE_SERVICE_ROLE_KEY` in `../backend/.env`. Run `../database/seed-mochajaki.sql` only in Mochajaki’s Supabase project. See the parent README for setup and deployment notes.
