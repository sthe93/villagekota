# Village Kota

Village Kota is a React + Vite food ordering app backed by Supabase. Customers can browse the menu, customise items, place delivery orders, and track orders, while admins and drivers can manage fulfilment workflows. The current payment flow uses PayFast for card payments and supports EFT and cash on delivery paths in the UI.

## Tech stack

- React
- TypeScript
- Vite
- Tailwind CSS
- shadcn/ui
- Supabase
- Vitest

## Getting started

### Prerequisites

- Node.js 20+
- npm
- A Supabase project with the required tables, functions, and environment variables configured

### Install dependencies

```sh
npm install
```

### Start the development server

```sh
npm run dev
```

### Other useful commands

```sh
npm run build
npm run lint
npm run test
```

## Environment and services

### Frontend

The frontend expects the standard Vite/Supabase environment configuration needed to connect to your Supabase project.

### Supabase Auth providers

Google OAuth is the active sign-in method on the auth page right now.

To make Google login work, configure **three** places:

1. **Supabase Dashboard → Authentication → Providers → Google**
   - enable the provider
   - paste your Google **Client ID**
   - paste your Google **Client Secret**
2. **Google Cloud → OAuth client**
   - add your app origins under **Authorized JavaScript origins**
   - add your Supabase callback URL under **Authorized redirect URIs**
3. **Supabase Dashboard → Authentication → URL Configuration**
   - set your app URL(s) so Supabase is allowed to redirect the browser back to your frontend after login

Use these values:

- **Authorized JavaScript origins** in Google Cloud:
  - `http://localhost:8080`
  - `https://sthe93.github.io`
- **Authorized redirect URI** in Google Cloud:
  - `https://<your-project-ref>.supabase.co/auth/v1/callback`
- **Supabase Site URL / additional redirect URLs**:
  - `http://localhost:8080/auth?provider=google`
  - `https://sthe93.github.io/villagekota/auth?provider=google`

If Supabase shows `Unsupported provider: missing OAuth secret`, the Google provider is enabled but the **Client Secret has not been saved correctly** in the Supabase dashboard yet.

### Supabase Edge Functions

This repository includes Supabase Edge Functions under `supabase/functions/`, including:

- `create-payfast-checkout` for starting PayFast card payments
- `create-checkout` for the legacy Stripe checkout flow

### PayFast configuration

The `create-payfast-checkout` function requires these environment variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `PAYFAST_MERCHANT_ID`
- `PAYFAST_MERCHANT_KEY`
- `PAYFAST_PASSPHRASE` (optional if your PayFast account uses one)
- `PAYFAST_SANDBOX` (`true` for sandbox, otherwise production)
- `APP_BASE_URL` (optional fallback if the incoming request origin is unavailable)
- `PAYFAST_MERCHANT_EMAIL` (recommended for sandbox validation so the checkout function can reject same-account test payments early)

The checkout function uses the incoming request origin first and only falls back to `APP_BASE_URL` when needed, which helps keep PayFast return and cancel URLs aligned with the actual frontend domain.

## Database

Supabase SQL migrations live in `supabase/migrations/`. The schema includes:

- catalogue tables such as `products`, `categories`, and product option tables
- customer/account tables such as `profiles` and `favorites`
- order flow tables such as `orders`, `order_items`, `order_item_options`, and `payment_logs`
- operational tables such as `drivers`, `user_roles`, and vouchers

## Testing

Vitest is configured for unit tests. Add or update tests under `src/` using the `*.test.ts` or `*.test.tsx` naming convention, then run:

```sh
npm run test
```

## Notes

- Card checkout currently uses PayFast from the checkout page.
- In PayFast sandbox mode, test with a buyer account/email that is different from the merchant account or PayFast will reject the payment as a same-account transaction.
- There is still a legacy Stripe edge function in the repo; keep documentation and deployment configuration aligned with the payment providers you actually use.
