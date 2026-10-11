# Cha’s portfolio and shop system

A readable, responsive portfolio and two independently styled storefronts. The portfolio uses semantic HTML, CSS, and vanilla JavaScript; the ordering API uses Node.js 18+, Express, two separate Supabase Auth/PostgreSQL projects, and optional Stripe-hosted Checkout.

The source is intentionally kept editable: HTML files are full documents from `<!doctype html>` through their footers, and CSS, browser JavaScript, server code, and SQL remain separate, unminified files.

## Project contents

- **Home** — Y2K-inspired glassmorphism, a portrait image slot, project previews, Mabini feature, and two shop cards.
- **About Me** — brief introduction, seven years in Mabini, education, resume/experience, technology logos, social-platform placeholders, and interests. Resume material stays here; there is no resume navigation tab or download button.
- **Projects** — scrollable System Development, Graphics (Publication Materials and Certificates), and Writing galleries. Empty image slots, hover/tap descriptions, and an accessible image-preview dialog are included.
- **Discover Mabini** — short municipality history, resorts and places to research, the requested café names, map searches, and a reminder to check current local information. The guide does not claim personal visits.
- **Shop directory** — separate “Visit” links open the corresponding storefront in a new tab.
- **DigiCha** and **Mochajaki** — distinct storefronts with catalog search/filtering, product options, carts, server quotes, recommendations, promotions, customer dashboards, and order tracking. Each storefront connects to its **own Supabase project/database and Auth users**.
- **Admin** — shop-specific staff-only catalog, order-status, promotion, and settings screens. Admin sign-ins and staff permissions are checked against the selected shop’s Supabase project.
- **Express API / SQL** — isolated per-shop database and Auth clients, per-shop HttpOnly session cookies, server-calculated PHP totals, order snapshots, optional Stripe Checkout, shared schema, and separate per-shop starter seeds.

## Folder map

```text
index.html                         portfolio home
about/                             About Me, including resume content
projects/                          project and article galleries
mabini/                            Discover Mabini
shops/                             shop directory
admin/                             protected shop admin interface
digicha/                           DigiCha storefront
digicha/digicha.js                 DigiCha catalog fallback
mochajaki/                         Mochajaki storefront
mochajaki/mochajaki.js             Mochajaki catalog fallback
shared/                            shared storefront UI and API helpers
assets/icons/                      technology and platform logo SVGs
assets/images/                     blank image slots and supplied menu reference
backend/                            Express API, per-shop auth, admin, and payment logic
database/                           schema, per-shop seeds, legacy combined seed, migration
```

## Run locally

Requirements: Node.js 18 or newer, npm, and **two separate Supabase projects**—one for DigiCha and one for Mochajaki.

1. Extract the ZIP and open the `cha-portfolio` folder in a terminal.
2. Install the server dependencies:

   ```bash
   cd backend
   npm ci
   ```

3. Copy `backend/.env.example` to `backend/.env` and fill in the separate DigiCha and Mochajaki Supabase settings below. Never put service-role keys in frontend code or commit `.env`.
4. In the **DigiCha Supabase project's** SQL Editor:
   - For a new project, run `database/schema.sql`.
   - If this is an existing project created with the older schema in this package, back up the database, run `database/migrations/001_upgrade_existing_shop_schema.sql`, then run `database/schema.sql`.
   - Run `database/seed-digicha.sql` for DigiCha’s initial shop row and product placeholders.
5. Repeat step 4 in the **Mochajaki Supabase project**, using `database/seed-mochajaki.sql` instead.
6. Start Express from the `backend` folder:

   ```bash
   npm start
   ```

7. Open `http://localhost:3000`. Check `http://localhost:3000/api/health` for the per-shop project configuration flags. A configured flag only means the URL/keys are present; it does not prove SQL, Auth, or payment setup is complete.

**Do not run `database/seed.sql` in this two-project setup.** It is retained only as a combined seed for an older single-Supabase-project installation. The per-shop seed files touch only their matching shop. If a combined seed was already applied to an existing project, back up and review its data before removing anything.

For Node watch mode, use `npm run dev`. Run `npm run check` in `backend/` to syntax-check the server, routes, and browser JavaScript; `npm test` runs local tests for per-shop Supabase configuration and session isolation.

## Supabase and authentication setup

Set these values in `backend/.env`:

```dotenv
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000
PUBLIC_APP_URL=http://localhost:3000

DIGICHA_SUPABASE_URL=https://YOUR-DIGICHA-PROJECT-REF.supabase.co
DIGICHA_SUPABASE_ANON_KEY=your_digicha_public_anon_or_publishable_key
DIGICHA_SUPABASE_SERVICE_ROLE_KEY=your_digicha_server_only_service_role_key

MOCHAJAKI_SUPABASE_URL=https://YOUR-MOCHAJAKI-PROJECT-REF.supabase.co
MOCHAJAKI_SUPABASE_ANON_KEY=your_mochajaki_public_anon_or_publishable_key
MOCHAJAKI_SUPABASE_SERVICE_ROLE_KEY=your_mochajaki_server_only_service_role_key

ALLOW_SAMPLE_ORDERS=true
```

- The DigiCha variables must point to DigiCha’s project; the Mochajaki variables must point to the different Mochajaki project. The application selects the project by the storefront URL’s shop slug. It never uses one shop’s database as a fallback for the other.
- Enable the email/password provider in **both** Supabase Auth projects. Configure confirmation email delivery as needed and set the Site URL to the deployed site origin (for local development, `http://localhost:3000`) in both projects.
- The public/anon key is used by the server for that shop’s Auth calls; the matching **service-role key is server-only** for database operations. Keep both service-role keys in `.env` or your host’s secret manager, never in frontend code, GitHub, or chat.
- Each project has its own user table and accounts. A customer who registers at DigiCha is not automatically registered at Mochajaki, even if they use the same email. Sessions use separate shop-specific HttpOnly cookies so signing out of one shop does not sign out of the other.
- `FRONTEND_ORIGIN` is an optional extra allowed browser origin if the frontend and API are deployed on different origins. Same-origin requests are accepted automatically. Use the exact HTTPS origin in a real deployment.
- `ALLOW_SAMPLE_ORDERS=true` works only outside `NODE_ENV=production`. Development orders remain test/unpaid orders. GCash, Maya, and Other are manual selection labels; they do not transfer funds or verify that a customer paid.
- Production cookies require HTTPS. Use a trusted HTTPS host and set `NODE_ENV=production` before launch.

Both schemas enable Row Level Security and revoke direct table access from browser roles. Express selects the proper server-side project for each shop and mediates authenticated profile/order/admin requests. Do not weaken RLS or expose a service-role key to make a frontend request work.

### Grant shop-admin accounts

Do this separately in each Supabase project. The customer account and staff membership must exist in that same project.

1. Register the owner through that shop’s storefront and confirm the email if the project’s Auth settings require confirmation.
2. In the **matching** project’s SQL Editor, run the staff insert below. Use `digicha` in the DigiCha project or change it to `mochajaki` in the Mochajaki project; replace the email with the owner’s account email in that project:

   ```sql
   insert into public.staff_members (user_id, shop_id, role, is_active)
   select auth_user.id, shop.id, 'admin', true
   from auth.users as auth_user
   join public.shops as shop on shop.slug = 'digicha'
   where lower(auth_user.email) = lower('real-account@example.com')
   on conflict (user_id, shop_id)
   do update set role = excluded.role, is_active = true;
   ```

3. Visit `admin/admin.html?shop=digicha` or `admin/admin.html?shop=mochajaki` and sign in using that shop’s account. The customer dashboard only shows the admin link for a staff account in that shop’s project.

A staff member manages that shop’s products, order fulfillment status, promotions, and settings. Categories are selected from that shop’s own database; category creation is not included in the admin UI. Add a category through that project’s Supabase SQL Editor using the correct `shop_id`, then refresh the admin page.

## Catalog, orders, and totals

- Products, categories, promotions, settings, users, profiles, and orders are stored in separate Supabase projects. DigiCha API routes use only DigiCha’s database; Mochajaki routes use only Mochajaki’s database.
- `POST /api/shops/:slug/quote` recalculates price, product options, and promotion eligibility from the selected shop’s Supabase project. `POST /api/shops/:slug/orders` calculates again inside that project’s `create_shop_order` SQL function and saves the order plus line-item snapshots atomically. Browser-supplied totals are not accepted.
- Customer accounts use the selected project’s Supabase Auth with server-managed HttpOnly cookies named separately per shop. Order history is restricted to the signed-in customer in that project. Admin order-state changes update only that shop’s database.
- Manual GCash, Maya, and Other methods create **unpaid** orders. Add verified account instructions to each shop’s settings only when ready; the admin cannot mark manual orders paid. This project does not receive or verify manual transfers.
- The per-shop seed files have no promotions. Only configured, active, in-date offers appear; fixed discount amounts, minimums, and totals use the shop currency (seeded as PHP) and are rechecked by the server.
- Mochajaki’s seeded Pasta catalog reflects the names and Small/Big prices you provided: Lasagna ₱50/₱70, Palabok ₱40/₱60, Bake Mac ₱50/₱70, and Mac & Cheese ₱50/₱70. Size is required and the server recalculates the selected price.
- DigiCha’s four requested product names appear with “Price to be confirmed” and cannot be ordered until you enter actual prices/options and set availability. They are marked as setup samples so they cannot accidentally be sold as priced products.
- Storefront suggestions show available products, prefer shop-featured items, and avoid items already in the current cart when possible. They use catalog/cart state only, not fabricated sales history or customer profiling.
- Product image paths remain blank image-slot SVGs—not product artwork. No active discount values are seeded because no offer amounts or terms were provided.

### Optional Stripe Checkout

Stripe is not enabled unless its server secrets are configured and a shop owner selects the online payment method. The Stripe account/webhook keys are configured separately from the two Supabase projects; Stripe Checkout is optional and does not combine the stores’ database records.

For a Stripe test setup, add to `backend/.env`:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_APP_URL=https://your-public-https-host.example
```

Configure the Stripe webhook endpoint at `https://your-public-https-host.example/api/payments/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. The server verifies webhook signatures and saved order/session amounts, then routes each event to the database named by that session’s `shop_slug`. Use a test-mode secret key with sample products; live Stripe checkout rejects sample products. Test success, cancellation, delayed/failed payment, webhook delivery, and currency support before launch. Never enter a Stripe secret in the browser or admin form.

Without Stripe credentials, checkout only offers configured manual methods and reports the order as unpaid. No card data is collected by this site.

## Replace personal, project, and shop images

The supplied replacement files under `assets/images/` are intentionally blank, labelled slots. No generated product photographs, fabricated project screenshots, or search-result replacement photos are included. Replace the `src` path in the relevant HTML or the product’s `image_url` with your own file.

Suggested paths already called out in the HTML:

- Portrait: `assets/images/cha-profile.jpg` (home/about HTML)
- Mabini feature: `assets/images/mabini/coastline.jpg`
- MediTrack: `assets/images/projects/meditrack.png`
- E-Gasang: `assets/images/projects/e-gasang.png`
- Publication materials: `assets/images/graphics/publication-01.jpg` through `publication-03.jpg`
- Certificates: `assets/images/certificates/certificate-01.jpg` through `certificate-03.jpg`
- Writing images: `assets/images/writing/ripple-guild-01.jpg`, `article-02.jpg`, and `article-03.jpg`
- Store banners: `assets/images/shops/digicha-banner.jpg` and `mochajaki-banner.jpg`

For shop products, upload the image to the matching project’s public storage bucket or another HTTPS host and set `products.image_url` in that shop database. A root-relative project path such as `/assets/images/shops/your-product.jpg` also works. The admin editor stores a path/URL but does not upload image files. Add useful alternative text when replacing portfolio `<img>` elements. Preserve certificate proportions (`object-fit: contain`).

The supplied `assets/images/mochajaki-menu-reference.png` is kept from the project and shown in a collapsible section on Mochajaki. The pasta items and prices in the updated catalog come from the values you provided, not from interpreting the reference image. Confirm current availability and fulfillment details before accepting live orders.

For a résumé file, place your real PDF at `assets/documents/cha-resume.pdf` only if you want to retain it in your project records. This site intentionally has no standalone resume/download link. Resume information belongs in About Me.

## Content and source notes

- Only the navigation items **Home, About Me, Projects, Shop** appear in the portfolio navigation. “Discover Mabini” is an About Me feature and a linked informational page, not a navigation tab.
- The About Me page uses actual technology/platform logos from local SVG files. Social-profile URLs and game titles were not supplied, so those areas identify the missing information instead of inventing links, games, or artwork.
- The Mabini page includes the café names **Amaro, Xentea, Alwan, El Raffis, and But First Coffee** as requested. Search links are not a claim that a café is currently at a particular address or open.
- The history note links to the Municipality of Bauan’s history page: <https://bauan.gov.ph/history/>. Resort/operator references include <https://vivereazure.com/>, the Aiyanar PADI listing at <https://www.padi.com/dive-center/philippines/aiyanar-beach-dive-resort/>, and Camp Netanya’s public page at <https://www.facebook.com/campnetanya/>. Other “Search on Maps” links are search queries; confirm each business, current facilities, and access directly. The page does not claim personal visits.
- The referenced PDF and grading rubric were not present in the workspace. Replace or verify all education, experience, project, and biographical details before publishing.

## Current limitations and launch checklist

Before launch, provide actual profile/project/certificate/writing and shop-product images; confirm DigiCha prices, options, and availability; verify Mochajaki menu prices and current availability; and configure fulfillment, GCash/Maya instructions, privacy/terms, and any real discount rules. No Supabase or Stripe credentials, payment account details, or product photos were supplied for this revision.

The following are **not** implemented or confirmed: live payment collection, manual-payment verification, email receipts/order notifications, password recovery, shipping/tax/fee calculation, stock quantity/reservation, automatic digital-file delivery, category editing, image uploads, or a privacy/retention policy specific to a live business. The supplied PDF/rubric could not be checked. Neither Supabase project nor Stripe was connected to a user-owned account; run the setup and test both projects before using real orders.

## API route overview

- `GET /api/health` — reports whether both Supabase configurations are present, plus the per-shop flags.
- Shop-specific auth: `POST /api/shops/:slug/auth/register`, `/login`, `/logout`, `GET /me`, and `PATCH /profile`.
- Catalog/order: `GET /api/shops/:slug/products`, `/deals`, `/checkout-config`, `POST /quote`, `GET /dashboard`, and `POST /orders`.
- Shop-specific Stripe status: `GET /api/shops/:slug/payments/sessions/:sessionId`; shared signed webhook: `POST /api/payments/webhook`.
- Admin: `GET /api/admin/shops/:slug/overview`, `PATCH /api/admin/shops/:slug/settings`, and product/order/promotion management under `/api/admin/shops/:slug/...`.
