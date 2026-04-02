# Village Kota

Village Kota is a React + Vite food-ordering platform backed by Supabase.

It supports three core user experiences in one app:
- **Customers** place and track food-delivery orders.
- **Admins** manage incoming orders and operational status updates.
- **Drivers** accept/fulfil deliveries with a secure handoff flow.

Card checkout is powered by **PayFast** (with webhook verification), and the platform also supports EFT, cash, and voucher-based order flows.

---

## Core functionality

### Customer app
- Browse menu and product catalog.
- Customize products with option groups/items.
- Build cart and place delivery orders.
- Use voucher discounts (local vouchers and provider flow for 1Voucher).
- Pay by card (PayFast), EFT, cash, or voucher.
- Track order status in real time.
- View order/payment updates via in-browser notifications (when enabled).
- Manage profile and saved delivery addresses.
- Delete account from My Account.

### Admin app
- Access protected admin routes.
- View and manage order queue and status transitions.
- Receive order notifications (browser notifications when enabled).

### Driver app
- Access protected driver routes.
- Receive dispatch notifications for ready deliveries.
- Complete delivery using a **customer confirmation PIN**.
- Enforce cash-collected guardrails for cash orders.

### Payments and auditability
- PayFast checkout URL is created server-side from DB-backed order totals.
- PayFast webhook (`payfast-notify`) verifies signature, merchant, and server confirmation.
- Webhook validates paid amount against DB order total.
- Payment audit records are written to `payment_logs`.

---

## Tech stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **State/data:** TanStack Query, Supabase JS client
- **Backend:** Supabase (Postgres, Auth, Edge Functions, Realtime)
- **Testing:** Vitest
- **Mobile wrapper readiness:** Capacitor dependencies + config scaffold

---

## Project structure (high level)

- `src/` — frontend pages/components/hooks/lib
- `supabase/functions/` — edge functions (order creation, payments, status updates, account deletion, etc.)
- `supabase/migrations/` — database schema migrations
- `android/` and `ios/` — placeholders for generated Capacitor native projects

---

## Getting started

### Prerequisites
- Node.js 20+
- npm
- A Supabase project with required tables/functions/migrations applied

### Install

```sh
npm install
```

### Run locally

```sh
npm run dev
```

### Quality checks

```sh
npm run build
npm run lint
npm run test
npm run browserslist:update
```

---

## NPM scripts

- `npm run dev` — run Vite dev server
- `npm run build` — production web build
- `npm run build:dev` — development-mode build
- `npm run lint` — ESLint with `--max-warnings=0`
- `npm run test` — run Vitest once
- `npm run test:watch` — run Vitest watch mode
- `npm run lint:ci` — CI lint entrypoint
- `npm run browserslist:update` — refresh local Browserslist/caniuse-lite DB
- `npm run build:mobile` — build with `VITE_ROUTER_BASENAME=/` for native shell
- `npm run cap:add:android` / `npm run cap:add:ios` — generate native Capacitor projects
- `npm run cap:sync` — sync web assets/plugins into native projects
- `npm run cap:open:android` / `npm run cap:open:ios` — open native IDE projects
- `npm run cap:copy` — copy web assets into native projects

---

## Environment configuration

### Frontend `.env`
Use `.env.example` as a template.

Expected values:
- `VITE_SUPABASE_PROJECT_ID`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_URL`
- `VITE_MAPTILER_KEY`

Do **not** commit production `.env` secrets.

### Supabase Auth
Google OAuth is currently active in the auth UI. Configure provider values in:
1. Supabase Dashboard (Auth Provider settings)
2. Google Cloud OAuth client
3. Supabase URL Configuration (site/redirect URLs)

---

## Edge functions included

Located under `supabase/functions/`:

- `create-order`
  - Authenticates user
  - Validates cart items/options against DB
  - Calculates subtotal/delivery/discount/total server-side
  - Applies voucher logic and writes order records
- `create-payfast-checkout`
  - Authenticates user
  - Ownership/admin check for order access
  - Generates PayFast payment URL from DB order total
  - Writes pending payment metadata + payment log
- `payfast-notify`
  - Validates ITN/webhook signature/merchant
  - Confirms payload with PayFast endpoint
  - Checks amount against DB order total
  - Updates payment status + writes payment log
- `update-order-status`
  - Handles controlled order lifecycle status updates
- `complete-driver-delivery`
  - Authenticates driver
  - Validates driver assignment + PIN confirmation
  - Completes delivery and triggers receipt flow
- `send-order-receipt`
  - Sends receipt email after completion
- `delete-account`
  - Authenticates user
  - Performs account cleanup + auth user deletion
- `onevoucher-voucher`
  - Integrates 1Voucher validation/redeem operations used by order flow
- `create-checkout`
  - Legacy Stripe flow retained in repo

---

## Realtime and notifications

The app includes **browser notification** support:
- Service worker registration (`public/notifications-sw.js`)
- Role-aware order/payment notifications via Supabase Realtime
- User opt-in controls under **My Account**

> Note: This is browser-based notification behavior and is not yet full APNs/FCM vendor push delivery for offline mobile app states.

---

## Legal/compliance pages

The app exposes:
- `/privacy-policy`
- `/terms-of-service`
- `/data-disclosure`

Support details are also available in the app footer and terms page.

---

## Mobile/store readiness status

The repository is **Capacitor-ready**, but native store submission work is still required:
- Generate actual native projects (`cap:add:android`, `cap:add:ios`)
- Implement production native push (APNs + FCM) for store builds
- Prepare store assets (icons/screenshots)
- Complete App Store Connect / Play Console metadata
- Execute signed test releases on real devices

See `CAPACITOR_DEPLOYMENT.md` for step-by-step guidance.
Use `MOBILE_STORE_PREFLIGHT_CHECKLIST.md` as the final submission gate checklist.

---

## Notes

- Card payments currently run through PayFast.
- In PayFast sandbox mode, customer email must differ from merchant email.
- A legacy Stripe function remains in the repository; keep deployment/docs aligned with active provider usage.
