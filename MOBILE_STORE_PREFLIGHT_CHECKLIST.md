# Mobile Store Preflight Checklist

Date: 2026-04-01 (UTC)

Use this checklist before submitting Village Kota to **Google Play** and **Apple App Store**.

## 1) Build + release prerequisites

- [ ] `npm run lint` passes with zero warnings.
- [ ] `npm run test` passes.
- [ ] `npm run build:mobile` passes.
- [ ] `npm run cap:sync` completes without plugin errors.
- [ ] Android release build (`.aab`) generated and signed.
- [ ] iOS release archive generated and signed.

## 2) Environment + runtime configuration

- [ ] Production `VITE_SUPABASE_URL` configured.
- [ ] Production `VITE_SUPABASE_PUBLISHABLE_KEY` configured.
- [ ] Production `VITE_MAPTILER_KEY` configured.
- [ ] Supabase Auth redirect URLs include mobile callback URLs.
- [ ] `capacitor.config.ts` app id/app name verified for store branding.

## 3) Push notifications (native)

- [ ] Android: Firebase project created and linked.
- [ ] Android: FCM credentials configured.
- [ ] iOS: APNs key/cert uploaded and validated.
- [ ] Notification permission prompt UX verified on first run.
- [ ] Foreground/background/terminated delivery tested on physical devices.

## 4) Store policy + legal

- [ ] Privacy policy URL is public and accessible.
- [ ] Terms of service URL is public and accessible.
- [ ] Data safety / privacy nutrition labels completed accurately.
- [ ] Account deletion flow tested end-to-end from the mobile app.
- [ ] Support email/phone/contact URL validated.

## 5) Assets + listing metadata

- [ ] App icon sets exported per Play/App Store specs.
- [ ] Required screenshot sets prepared for supported device classes.
- [ ] Short and long descriptions reviewed for policy-safe claims.
- [ ] Category, age rating, and content declarations completed.
- [ ] Release notes drafted for v1.0.

## 6) Production verification on real devices

- [ ] Android smoke test on at least one mid-range physical device.
- [ ] iOS smoke test on at least one physical iPhone.
- [ ] Checkout flows validated (card/EFT/cash/voucher paths as applicable).
- [ ] Driver flow validated (accept/start/arrive/complete + PIN verification).
- [ ] Order tracking validated (status updates + map rendering + edge cases).

## 7) Go/no-go gate

- [ ] No P0/P1 defects open.
- [ ] Crash-free test session for release candidate build.
- [ ] Rollback plan documented.
- [ ] On-call/support owner assigned for launch window.

---

## Suggested command runbook

```bash
npm run lint
npm run test
npm run build:mobile
npm run cap:sync
```

Then generate signed release artifacts in Android Studio / Xcode and run the real-device checklist above.
