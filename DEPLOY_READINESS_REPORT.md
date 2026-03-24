# App Store / Play Store Deployment Readiness Report

Date: 2026-03-24 (UTC)
Repository: `villagekota`

## Executive verdict

**NO-GO** for Apple App Store and Google Play submission right now.

Primary blockers:
- Quality gates fail (`npm run lint`, `npm run test`).
- No native Android/iOS projects found.
- Product/compliance items incomplete (privacy/terms URLs are placeholders; no account deletion flow evidence; no data disclosure documentation).
- No clear evidence of store metadata/assets/device-release testing.

## Checklist assessment

### 5) Go / no-go checklist

#### Security / backend

- [x] **Order totals computed server-side**  
  `create-order` rebuilds prices from DB products/options and computes `subtotal`, `delivery_fee`, `discount_amount`, `total` on the server.
- [x] **Payment amount derived from DB, not client body**  
  `create-payfast-checkout` fetches the order by `orderId` and uses `order.total` from DB for PayFast amount.
- [x] **Checkout endpoint authenticated and ownership-checked**  
  Endpoint requires auth, then verifies caller is order owner or admin.
- [x] **PayFast webhook exists and is verified**  
  `payfast-notify` verifies merchant id, signature, server-to-server validation (`VALID`), and amount match before updating payment state.
- [x] **Voucher redemption handled server-side**  
  Voucher validation/redemption happens in `create-order` server function and writes redemption records / voucher balance updates.
- [x] **Delivery PIN flow works end-to-end (code-level evidence)**  
  Driver UI collects PIN, invokes server function; server verifies assignment + status + cash rules, then RPC confirms code and finalizes delivery.
- [ ] **Audit/payment logs exist**  
  README references a `payment_logs` table, but no migration creating it was found in this repo snapshot. Treat as not proven.

#### Release engineering

- [x] **`npm run build` passes**
- [ ] **`npm run lint` passes or only approved warnings remain**  
  Fails with multiple errors.
- [ ] **`npm run test` passes**  
  Fails due to missing Supabase URL in one suite.
- [x] **Production envs managed outside tracked `.env`**  
  `.gitignore` excludes `.env` and `.env.*` while keeping `.env.example`.

#### Product / compliance

- [ ] **Privacy Policy URL**  
  Footer link is `href="#"` (placeholder).
- [ ] **Terms of Service**  
  Footer link is `href="#"` (placeholder).
- [ ] **Account deletion flow**  
  No account deletion UI/flow found in inspected files.
- [x] **Support/contact method**  
  Footer includes physical address, phone, and email.
- [ ] **Data disclosures documented**  
  No explicit privacy/data-disclosure document found in repo.

#### Mobile/store readiness

- [ ] **Android project exists**  
  No `android/` folder found.
- [ ] **iOS project exists**  
  No `ios/` folder found.
- [ ] **Native push implemented**  
  Existing implementation is browser/service-worker web notifications, not native mobile push.
- [ ] **App icons/screenshots prepared**  
  No store asset set/workflow found for Apple/Google listing requirements.
- [ ] **Store metadata completed**  
  No Play/App Store metadata/config content found.
- [ ] **Test release run on real devices**  
  No evidence in repository.

## Recommended next steps before store submission

1. Fix lint errors and establish a zero-error policy for CI.
2. Fix tests to run in CI without missing env dependencies (mock Supabase client/env for unit tests).
3. Decide release architecture:
   - either convert this web app into native wrappers (Capacitor/React Native/etc.),
   - or ship as PWA only (not equivalent to App Store/Play requirements).
4. Add legal/compliance pages and wire real URLs for Privacy Policy and Terms.
5. Implement and document account deletion flow (including backend data deletion/deactivation policy).
6. Add explicit data-disclosure documentation aligned with Play Data safety / App Privacy labels.
7. Confirm payment/audit logging schema in migrations (or add missing migration for `payment_logs`).
8. Produce store assets (icons, screenshots), metadata, and real-device test evidence.
