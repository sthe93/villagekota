# Remaining Implementation Status

Date: 2026-04-02 (UTC)

This file answers: **what is still left to implement** after current web-focused UX and deployment improvements.

## 1) Mobile store launch blockers (still open)

From the mobile preflight checklist, these are still outstanding for a full App Store / Play Store go-live:

- Native APNs/FCM push fully implemented and validated.
- Store screenshots/icons/metadata finalized.
- Signed Android/iOS release artifacts generated and tested on physical devices.
- Data safety/privacy disclosures completed in store consoles.
- Real-device smoke tests for checkout, tracking, and driver flow documented.

## 2) Sprint 1 UX work still pending

### Already implemented
- Menu intent presets and smart empty-state recovery actions.
- Checkout payment clarity panel.
- Checkout address confidence status.
- Product “Added +1” feedback + cart FAB pulse feedback.
- Checkout step microcopy (“Step X of 3”).

### Remaining from Sprint 1 plan
- Dedicated checkout sticky summary component extraction (`CheckoutStickyBar`) for cleaner structure and reuse.
- Optional cart pulse integration polish (animation refinement + reduced motion handling).
- Telemetry instrumentation for conversion funnel metrics:
  - Menu → checkout CTR
  - Checkout step progression/drop-off
  - Add-to-cart to order placement conversion
- Full QA matrix for iPhone Safari / Android Chrome edge cases.

## 3) Performance/tooling follow-ups

- Browserslist DB refresh in an environment with npm registry access:
  - `npm run browserslist:update`
- Map vendor bundle remains large and should be reduced further via deeper route/module splitting if needed.
- Consider additional image optimization pass for remaining large media assets.

## 4) Recommended next implementation order

1. Complete mobile release blockers (push + signed builds + store assets).
2. Add analytics instrumentation for conversion funnel visibility.
3. Finalize Sprint 1 QA matrix and accessibility verification pass.
4. Execute a second performance pass focused on map-related bundle size and media assets.
