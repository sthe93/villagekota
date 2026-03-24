# App Store / Play Store Deployment Readiness Report

Date: 2026-03-24 (UTC)  
Repository: `villagekota`

## Executive verdict

**CONDITIONAL NO-GO** for Apple App Store and Google Play submission.

The engineering quality gates and core compliance/backend gaps raised in the previous review are now addressed in-repo. Remaining blockers are primarily mobile distribution readiness (native projects, native push, store assets/metadata, and real-device release evidence).

## Checklist assessment

### 5) Go / no-go checklist

#### Security / backend

- [x] **Order totals computed server-side**
- [x] **Payment amount derived from DB, not client body**
- [x] **Checkout endpoint authenticated and ownership-checked**
- [x] **PayFast webhook exists and is verified**
- [x] **Voucher redemption handled server-side**
- [x] **Delivery PIN flow works end-to-end**
- [x] **Audit/payment logs exist**
  - Added migration-backed `payment_logs` table and write paths in PayFast flow.

#### Release engineering

- [x] **`npm run build` passes**
- [x] **`npm run lint` passes with zero warnings (`--max-warnings=0`)**
- [x] **`npm run test` passes**
- [x] **Production envs managed outside tracked `.env`**

#### Product / compliance

- [x] **Privacy Policy URL**
- [x] **Terms of Service**
- [x] **Account deletion flow**
- [x] **Support/contact method**
- [x] **Data disclosures documented**

#### Mobile/store readiness

- [ ] **Android project exists**
- [ ] **iOS project exists**
- [ ] **Native push implemented**
- [ ] **App icons/screenshots prepared**
- [ ] **Store metadata completed**
- [ ] **Test release run on real devices**

## What changed in this remediation pass

1. **Lint & CI policy**
   - Enforced lint gate with `eslint . --max-warnings=0` and added `lint:ci` script.
2. **Test env hardening**
   - Supabase client now has safe fallback test values so unit tests run in CI without env injection.
3. **Release architecture decision**
   - Documented PWA-first release strategy in README until native-wrapper approval.
4. **Legal/compliance pages**
   - Added in-app Privacy Policy, Terms of Service, and Data Disclosure pages with routable URLs.
5. **Account deletion flow**
   - Added authenticated `delete-account` edge function plus My Account UI flow.
6. **Payment/audit logging**
   - Added `payment_logs` migration and PayFast log writes on checkout creation and webhook processing.

## Remaining work before app-store submission

1. Establish native app containers (`android/`, `ios/`) or a finalized wrapper approach.
2. Implement native mobile push channels (FCM/APNs) for store builds.
3. Prepare store icon/screenshot sets and complete metadata in Play Console/App Store Connect.
4. Run and document signed test releases on real Android and iOS devices.
