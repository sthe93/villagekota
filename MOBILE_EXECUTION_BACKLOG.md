# Mobile Execution Backlog (Jira-Style)

Date: 2026-04-02 (UTC)
Source plans:
- `MOBILE_BLOCKERS_EXECUTION_PLAN.md`
- `MOBILE_STORE_PREFLIGHT_CHECKLIST.md`
- `REMAINING_IMPLEMENTATION_STATUS.md`

## How to use

- Create one ticket per item below.
- Keep ticket IDs stable for release tracking and launch go/no-go review.
- Suggested status flow: `Todo → In Progress → In Review → Done`.

---

## Epic MB-100: Native push readiness

### MB-101 — Android FCM production wiring
- **Owner:** Mobile Eng (Android)
- **Estimate:** 1.5d
- **Dependencies:** none
- **Acceptance criteria:**
  - FCM project is linked to production package ID.
  - Push token registration persists across reinstall/login cycles.
  - Notifications arrive in foreground/background/terminated states.
  - Failure logs visible for token/permission errors.

### MB-102 — iOS APNs production wiring
- **Owner:** Mobile Eng (iOS)
- **Estimate:** 2d
- **Dependencies:** none
- **Acceptance criteria:**
  - APNs key/cert configured and capability enabled in Xcode project.
  - Permission prompt + token registration verified on physical iPhone.
  - Notifications received in foreground/background/terminated states.
  - Token refresh and invalid-token handling validated.

### MB-103 — Push E2E matrix signoff
- **Owner:** QA + Mobile Eng
- **Estimate:** 1d
- **Dependencies:** MB-101, MB-102
- **Acceptance criteria:**
  - Platform/state matrix completed with evidence.
  - Deep-link/open behavior verified from push payload.
  - No open P0/P1 push defects.

---

## Epic MB-200: Signed release artifacts

### MB-201 — Android release signing + AAB artifact
- **Owner:** Release Eng / Android Eng
- **Estimate:** 0.5d
- **Dependencies:** MB-101
- **Acceptance criteria:**
  - Signed `.aab` generated for internal track.
  - Keystore and signing config documented in secure runbook.
  - Artifact checksum + release notes archived.

### MB-202 — iOS archive signing + ASC upload validation
- **Owner:** Release Eng / iOS Eng
- **Estimate:** 1d
- **Dependencies:** MB-102
- **Acceptance criteria:**
  - Signed iOS archive created and accepted in App Store Connect.
  - Provisioning/certificate warnings resolved.
  - Build metadata is release-ready.

---

## Epic MB-300: Store listing and compliance

### MB-301 — Creative asset pack (icons + screenshots)
- **Owner:** Design
- **Estimate:** 1.5d
- **Dependencies:** none
- **Acceptance criteria:**
  - Required icon/screenshot set produced for both stores.
  - Assets pass platform dimension/format checks.
  - Captions and overlays are policy-safe.

### MB-302 — Listing metadata + rating + disclosures
- **Owner:** Product + Compliance
- **Estimate:** 1d
- **Dependencies:** MB-301
- **Acceptance criteria:**
  - Description, category, age rating, and release notes complete.
  - Data Safety/Privacy Nutrition forms completed and reviewed.
  - Legal/support links verified live.

---

## Epic MB-400: Real-device validation + launch gate

### MB-401 — Customer flow smoke suite (real devices)
- **Owner:** QA
- **Estimate:** 1d
- **Dependencies:** MB-201, MB-202
- **Acceptance criteria:**
  - Browse → cart → checkout → tracking flows pass on Android+iOS physical devices.
  - Payment states (card/EFT/cash/voucher) validated.
  - Screenshots/videos captured for evidence.

### MB-402 — Driver flow smoke suite (real devices)
- **Owner:** QA
- **Estimate:** 0.5d
- **Dependencies:** MB-201, MB-202
- **Acceptance criteria:**
  - Accept/start/arrive/complete flow passes.
  - Confirmation PIN flow validated.
  - Edge cases (reassignments, reconnects) exercised.

### MB-403 — Launch go/no-go review
- **Owner:** Eng Manager + Product Owner
- **Estimate:** 0.5d
- **Dependencies:** MB-103, MB-302, MB-401, MB-402
- **Acceptance criteria:**
  - No open P0/P1 defects.
  - Rollback + on-call plans approved.
  - Signed launch decision with target release window.

---

## Priority order (recommended)

1. MB-101 + MB-102 (parallel)
2. MB-201 + MB-202
3. MB-301 + MB-302
4. MB-401 + MB-402
5. MB-403

**Delivery window estimate:** 6–8 working days with parallel owners.
