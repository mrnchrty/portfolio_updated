# Cha’s portfolio and shop system

A readable, responsive portfolio and two independently styled storefronts. The portfolio uses semantic HTML, CSS, and vanilla JavaScript; the ordering API uses Node.js 18+, Express, Supabase Auth/PostgreSQL, and optional Stripe-hosted Checkout.

The source is intentionally kept editable: HTML files are full documents from `<!doctype html>` through their footers, and CSS, browser JavaScript, server code, and SQL remain separate, unminified files.

## Project contents

- **Home** — Y2K-inspired glassmorphism, a portrait image slot, project previews, Mabini feature, and two shop cards.
- **About Me** — brief introduction, seven years in Mabini, education, resume/experience, technology logos, social-platform placeholders, and interests. Resume material stays here; there is no resume navigation tab or download button.
- **Projects** — scrollable System Development, Graphics (Publication Materials and Certificates), and Writing galleries. Empty image slots, hover/tap descriptions, and an accessible image-preview dialog are included.
- **Discover Mabini** — short municipality history, resorts and places to research, the requested café names, map searches, and a reminder to check current local information. The guide does not claim personal visits.
- **Shop directory** — separate “Visit” links open the corresponding storefront in a new tab.
- **DigiCha** and **Mochajaki** — distinct storefront designs with catalog search and filters, featured recommendations, product options, browser-persisted carts, server quotes, active promotions, checkout, Supabase customer accounts, order history/status tracking, and separate shop data.
- **Admin** — staff-only catalog, order-status, promotion, and shop-settings screens. The API checks authenticated Supabase users and active staff membership for the selected shop.
- **Express API / SQL** — cookie-based Supabase Auth, shop-scoped orders and customer dashboards, server-calculated PHP totals, database-backed order snapshots, optional verified Stripe Checkout, a Supabase schema, and an idempotent starter seed.

## Folder map

```text
index.html                         portfolio home
about/                             About Me, including resume content
projects/                          project and article galleries
mabini/                            Discover Mabini
shops/                             shop directory
admin/                             protected shop admin interface
digicha/                           DigiCha storefront
mochajaki/                         Mochajaki storefront
shared/                            shared storefront UI and API helpers
assets/icons/                      technology and platform logo SVGs
assets/images/                     blank image slots and supplied menu reference
assets/documents/                  resume file instructions
backend/                            Express API, auth, shop, admin, and payment logic
database/                           schema, demo seed, and migration
```

## Run locally

Requirements: Node.js 18 or newer, npm, and a Supabase project for accounts and database-backed ordering.

1. Extract the ZIP and open the `cha-portfolio` folder in a terminal.
2. Install the server dependencies:

   ```bash
   cd backend
   npm install
   ```

   This ZIP includes `backend/package-lock.json`; use `npm ci` for repeatable installs, or `npm install` when you intentionally want to update dependencies.

3. Copy `backend/.env.example` to `backend/.env` and fill in the Supabase settings described below. Never put a service-role key in frontend code or commit the `.env` file.
4. In the Supabase SQL Editor:
   - **New Supabase project:** run `database/schema.sql`.
   - **Existing project created with the older shop schema in this package:** back up the database, run `database/migrations/001_upgrade_existing_shop_schema.sql`, then run `database/schema.sql`.
   - Optionally run `database/seed.sql` for the supplied starter listings. It adds DigiCha product names with prices pending and unavailable; it adds the Mochajaki pasta names and Small/Big prices you supplied, displayed in PHP. The seed includes GCash, Maya, and Other as manual payment choices, but does not collect or verify payments. Re-running it replaces only the earlier named sample rows from this package; it does not overwrite custom products.
5. Start Express from the `backend` folder:

   ```bash
   npm start
   ```

6. Open `http://localhost:3000`. `http://localhost:3000/api/health` reports which environment settings are present. It does not prove that SQL, Auth, or payment setup is complete.

For Node watch mode, use `npm run dev`. Run `npm run check` in `backend/` to syntax-check the server, routes, and browser JavaScript.

## Supabase and authentication setup

Set these values in `backend/.env`:

```dotenv
PORT=3000
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:3000
PUBLIC_APP_URL=http://localhost:3000
SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
SUPABASE_ANON_KEY=your_public_anon_or_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_server_only_service_role_key
ALLOW_SAMPLE_ORDERS=true
```

- Enable the email/password provider in Supabase Auth and configure email confirmation/delivery to suit your project.
- The server uses the public/anon key for Supabase Auth calls and the **service-role key only on the server** for database operations. Store secrets in your host’s secret manager in production.
- `FRONTEND_ORIGIN` is an optional extra allowed browser origin if the frontend and API are deployed on different origins. Same-origin requests are accepted automatically. Use the exact HTTPS origin in a real deployment.
- `ALLOW_SAMPLE_ORDERS=true` works only outside `NODE_ENV=production`. Development orders remain test/unpaid orders. GCash, Maya, and Other are manual selection labels; they do not transfer funds or verify that a customer paid.
- Production cookies require HTTPS. Use a trusted HTTPS host and set `NODE_ENV=production` before launch.

The SQL enables Row Level Security and revokes direct table access from browser roles. Express mediates authenticated profile/order/admin requests. Do not weaken RLS or expose the service-role key to make a frontend request work.

### Grant a shop-admin account

1. Create a Supabase customer account through a storefront and confirm its email if your Auth settings require confirmation.
2. As a trusted Supabase project owner, grant that account a staff row. Replace the email and shop slug below with the real values:

   ```sql
   insert into public.staff_members (user_id, shop_id, role, is_active)
   select auth_user.id, shop.id, 'admin', true
   from auth.users as auth_user
   join public.shops as shop on shop.slug = 'digicha'
   where lower(auth_user.email) = lower('real-account@example.com')
   on conflict (user_id, shop_id)
   do update set role = excluded.role, is_active = true;
   ```

3. Visit `admin/admin.html?shop=digicha` or `admin/admin.html?shop=mochajaki`. The customer dashboard also reveals the matching admin link to an authorized staff account.

A staff member can manage products, order fulfillment status, promotions, and shop configuration. Categories are selected from the database; category creation is not included in the admin UI. Add a category through the Supabase SQL Editor using that shop’s `shop_id`, then refresh the admin page.

## Catalog, orders, and totals

- Products, categories, promotions, and shop settings are scoped by shop in Supabase. Each cart is stored separately in the customer’s browser and contains product IDs, quantities, and option selections—not trusted prices.
- `POST /api/shops/:slug/quote` recalculates price, product options, and promotion eligibility from Supabase. `POST /api/shops/:slug/orders` calculates again inside the `create_shop_order` SQL function and saves the order plus line-item snapshots atomically. Browser-supplied totals are not accepted.
- Customer accounts use Supabase Auth with server-managed HttpOnly cookies. Order history is restricted to the signed-in customer and the current shop. Staff order-state changes are reflected in customer status tracking.
- Manual GCash, Maya, and Other methods create **unpaid** orders. Add verified account instructions through the shop settings only when ready; the admin cannot mark manual orders paid. This project does not receive or verify manual transfers.
- The default seed has no promotions. Only configured, active, in-date offers appear; fixed discount amounts, minimums, and totals use the shop currency (seeded as PHP) and are rechecked by the server.
- Mochajaki’s seeded Pasta catalog reflects the names and Small/Big prices you provided: Lasagna ₱50/₱70, Palabok ₱40/₱60, Bake Mac ₱50/₱70, and Mac & Cheese ₱50/₱70. Size is required and the server recalculates the selected price.
- DigiCha’s four requested product names appear with “Price to be confirmed” and cannot be ordered until you enter actual prices/options and set availability. They are marked as setup samples so they cannot accidentally be sold as priced products.
- Storefront suggestions show available products, prefer shop-featured items, and avoid items already in the current cart when possible. They use catalog/cart state only, not fabricated sales history or customer profiling.
- Product image paths remain blank image-slot SVGs—not product artwork. No active discount values are seeded because no offer amounts or terms were provided.

### Optional Stripe Checkout

No payment-provider credentials were supplied or tested. Stripe is not available to shoppers unless both server secrets are configured and a shop owner selects the online payment method.

For a Stripe test setup, add to `backend/.env`:

```dotenv
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PUBLIC_APP_URL=https://your-public-https-host.example
```

Configure the Stripe webhook endpoint at `https://your-public-https-host.example/api/payments/webhook` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, and `checkout.session.expired`. The server verifies webhook signatures and the saved order/session amount before changing payment status. Use a test-mode secret key with sample products; live Stripe checkout rejects sample products. Test success, cancellation, delayed/failed payment, webhook delivery, and currency support before launch. Never enter a Stripe secret in the browser or admin form.

Stripe credentials are optional; without them, the checkout only offers configured manual methods and reports any order as unpaid. No card data is collected by this site.

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

For shop products, upload the image to a public storage bucket or another HTTPS host and set `products.image_url` to the resulting HTTPS URL; a root-relative project path such as `/assets/images/shops/your-product.jpg` also works. The admin editor stores a path/URL but does not upload image files. Add useful alternative text when replacing portfolio `<img>` elements. Preserve certificate proportions (`object-fit: contain`).

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

The following are **not** implemented or confirmed: live payment collection, manual-payment verification, email receipts/order notifications, password recovery, shipping/tax/fee calculation, stock quantity/reservation, automatic digital-file delivery, category editing, image uploads, or a privacy/retention policy specific to a live business. The supplied PDF/rubric could not be checked. Supabase SQL, Auth, and Stripe were not connected to a user-owned account; run the setup and test on your own project before using real orders.

## API route overview

- `GET /api/health`
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `PATCH /api/auth/profile`
- `GET /api/shops/:slug/products`, `GET /api/shops/:slug/deals`, `GET /api/shops/:slug/checkout-config`, `POST /api/shops/:slug/quote`, `GET /api/shops/:slug/dashboard`, `POST /api/shops/:slug/orders`
- `GET /api/payments/sessions/:sessionId`, `POST /api/payments/webhook`
- `GET /api/admin/shops/:slug/overview`, `PATCH /api/admin/shops/:slug/settings`, product/order/promotion management under `/api/admin/shops/:slug/...`
