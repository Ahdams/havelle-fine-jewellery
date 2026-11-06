# Havelle NG

A static storefront for Havelle NG, connected to Supabase for the product catalogue, guest checkout, order tracking, secure admin controls, and product photos.

## Customer flow

1. Customers browse the collection and add pieces to their bag.
2. They enter their name, phone number, state, and home delivery address.
3. Checkout shows the current delivery fee and the Moniepoint transfer details.
4. They place the order and receive a copyable `HV-…` tracking number.
5. Havelle confirms the transfer and updates the order status from the admin panel. Customers can track using the number without creating an account.

## Admin flow

Open **Admin** from the shop and sign in with the Supabase Auth account that has been added to the private Havelle admin allowlist. Admins can update product names, descriptions, prices, stock and photos; change the standard delivery fee; view customer orders and private payment receipts; add bank transfer references; and set order statuses. Receipt files are private and are not treated as confirmed payment automatically.

The browser uses only the Supabase publishable key. The service-role key stays inside the Supabase Edge Function and must never be added to this repository or the webpage.

## Deploy free with Cloudflare Pages

The production site is configured for `https://havelle-fine-jewellery.pages.dev/`.

1. Connect the public GitHub repository `Ahdams/havelle-fine-jewellery` to Cloudflare Pages.
2. Choose the `main` branch.
3. Set the framework preset to **None**, leave the build command empty (or `exit 0`), and set the output directory to `dist`.
4. Save and wait for the first successful deployment. Cloudflare publishes the root site and the shop at `/shop/`.
5. Future commits to `main` trigger a new deployment automatically.

The GitHub Actions workflow in `.github/workflows/pages.yml` also supports GitHub Pages. Cloudflare Pages remains the primary public URL unless you intentionally set up a separate GitHub Pages deployment.

## Supabase setup already applied

The Supabase project has the product, orders, order-items, shop-settings tables, row-level security policies, the `guest-orders` Edge Function, bank transfer settings, admin allowlist, and a public product-image bucket. The SQL changes are recorded in `supabase/migrations/`.

For the Edge Function, keep `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` configured as Supabase function secrets. Do not put the service-role key in GitHub, Cloudflare environment variables, or client-side HTML.

## Before taking public orders

- Confirm the real stock quantity for each listed product; current inventory entries are setup placeholders.
- Confirm the delivery fee and which states/areas are available.
- Place a controlled test order and verify the admin can change its status and the customer can track it.
- In Supabase Auth, enable leaked-password protection for the admin account.
