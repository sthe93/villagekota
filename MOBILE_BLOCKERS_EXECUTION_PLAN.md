# Mobile Blockers Execution Plan (Android + iOS)

Date: 2026-04-02 (UTC)
Scope: Convert remaining mobile release blockers into implementation-ready tasks with owner lanes and effort estimates.

## Objective

Unblock App Store / Play Store launch readiness by completing native push, signing, store assets/metadata, and real-device validation.

---

## Workstream A — Native push notifications (APNs + FCM)

### A1. Android FCM integration hardening
- **Owner lane:** Mobile engineer (Android-capable)
- **Estimate:** 1.5 days
- **Tasks:**
  - Wire Firebase project + app credentials for production package ID.
  - Confirm token registration lifecycle (first launch, reinstall, logout/login).
  - Validate foreground/background/terminated delivery behavior.
  - Add diagnostics for token refresh and failed registration.
- **Definition of done:** Production Android build receives push in all app states.

### A2. iOS APNs integration hardening
- **Owner lane:** Mobile engineer (iOS-capable)
- **Estimate:** 2 days
- **Tasks:**
  - Configure APNs key/cert and app capabilities in Xcode project.
  - Verify permission flow and notification categories.
  - Validate token registration and backend mapping.
  - Test foreground/background/terminated behavior on physical iPhone.
- **Definition of done:** Production-signed iOS build receives push in all app states.

### A3. Push reliability test matrix
- **Owner lane:** QA + mobile engineer
- **Estimate:** 1 day
- **Tasks:**
  - Execute matrix by platform/state/network condition.
  - Verify actionable deep links from push payloads.
  - Log delivery gaps and retry/fallback behavior.
- **Definition of done:** Signed-off matrix with no P0/P1 defects.

---

## Workstream B — Signing + release artifacts

### B1. Android release artifact pipeline
- **Owner lane:** Release engineer / Android engineer
- **Estimate:** 0.5 day
- **Tasks:**
  - Configure keystore + signing config for release.
  - Produce `AAB` for internal test track.
  - Archive artifact checksum and release notes.
- **Definition of done:** Uploadable signed Android AAB generated.

### B2. iOS release artifact pipeline
- **Owner lane:** Release engineer / iOS engineer
- **Estimate:** 1 day
- **Tasks:**
  - Configure signing certificates/profiles and bundle metadata.
  - Produce release archive and validate in App Store Connect.
  - Resolve export/signing warnings before handoff.
- **Definition of done:** Uploadable signed iOS archive generated.

---

## Workstream C — Store metadata, assets, policy

### C1. Creative assets pack
- **Owner lane:** Designer + product marketing
- **Estimate:** 1.5 days
- **Tasks:**
  - Produce required icon variants and screenshots for supported form factors.
  - Validate legibility and policy-safe claims in captions.
  - Version assets for future release reuse.
- **Definition of done:** Complete approved asset set for both stores.

### C2. Listing metadata + compliance forms
- **Owner lane:** Product manager + compliance owner
- **Estimate:** 1 day
- **Tasks:**
  - Finalize descriptions, categories, age ratings, and release notes.
  - Complete Data Safety / Privacy Nutrition forms with engineering validation.
  - Link legal pages and support contact points.
- **Definition of done:** All store listing forms completed and review-ready.

---

## Workstream D — Real-device validation + go/no-go

### D1. End-to-end smoke validation (customer + driver)
- **Owner lane:** QA lead
- **Estimate:** 1.5 days
- **Tasks:**
  - Validate customer flows: browse, add, checkout, tracking, payment states.
  - Validate driver flows: accept/start/arrive/complete + confirmation pin.
  - Verify edge states: payment mismatch, delayed ETA, reconnect behavior.
- **Definition of done:** Regression report with pass/fail evidence and videos/screenshots.

### D2. Launch gate review
- **Owner lane:** Engineering manager + product owner
- **Estimate:** 0.5 day
- **Tasks:**
  - Confirm no open P0/P1 issues.
  - Confirm rollback/support plan and launch staffing.
  - Approve go/no-go decision with dated sign-off.
- **Definition of done:** Signed launch decision and deployment window.

---

## Suggested sequence and total effort

1. Push integration hardening (A1+A2) — parallelizable.
2. Artifact signing pipelines (B1+B2).
3. Store assets/metadata (C1+C2) in parallel.
4. Real-device QA + launch gate (D1+D2).

**Estimated calendar time:** ~6–8 working days with parallel owners.

---

## Immediate next 3 commands/checks

1. `npm run build:mobile`
2. `npm run cap:sync`
3. Produce signed test artifacts in Android Studio / Xcode and begin D1 smoke matrix.
