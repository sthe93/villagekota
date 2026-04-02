# Sprint 1 UI Execution Plan (Checkout + Menu Conversion Lift)

Date: 2026-04-01 (UTC)
Owner: Product Design + Frontend
Source: `UX_REVIEW_CUSTOMER_JOURNEY.md` Sprint 1 priorities

## Sprint goal

Increase customer conversion from menu browsing to successful checkout by reducing decision friction and improving purchase confidence.

## Scope in this sprint

1. **Checkout sticky summary + payment clarity module**
2. **Menu quick-add feedback + intent presets**

---

## Track A — Checkout sticky summary + payment clarity

### A1) Add a sticky checkout summary bar (mobile-first)

**Primary files**
- `src/pages/CheckoutPage.tsx`
- `src/hooks/useCheckoutFlow.ts`
- `src/context/CartContext.tsx` (read-only integration verification)

**UI behavior**
- Show a sticky bottom bar on mobile (`md:hidden`) with:
  - Current payable total (`adjustedTotal` if voucher applied, else `total`)
  - Payment mode summary (e.g., “Pay now by card”, “Pay on delivery (cash)”)
  - Primary CTA text based on step (`Continue to payment`, `Place order`)
- On desktop, show a sticky side summary card while scrolling checkout content.

**Implementation tasks**
- [ ] Add `CheckoutStickyBar` local component inside `CheckoutPage.tsx` (or extract to `src/components/checkout/CheckoutStickyBar.tsx`).
- [ ] Wire to existing computed values: `currentStep`, `form.payment`, `adjustedTotal`, `voucherInfo`, `submitting`.
- [ ] Ensure CTA uses current step progression methods already in flow (`handleCheckoutStepChange`/submit handler).
- [ ] Add safe-area support classes for iOS (`pb-[env(safe-area-inset-bottom)]`).

**Acceptance criteria**
- Sticky bar is always visible while user scrolls checkout sections on mobile.
- CTA mirrors current state and is disabled only when step cannot proceed.
- Total and payment label always match selected payment method and voucher state.

---

### A2) Add “You’ll pay now / pay on delivery” payment clarity block

**Primary file**
- `src/pages/CheckoutPage.tsx`

**UI behavior**
- Place a compact info tile directly above payment method selector.
- Tile text updates instantly as user switches payment method:
  - Card: “You’ll be redirected to secure payment now.”
  - EFT: “Place order now, then complete EFT transfer using provided details.”
  - Cash: “Pay cash to your driver at delivery.”
  - Voucher: “Voucher balance applied first; remainder handled by selected payment method.”

**Implementation tasks**
- [ ] Create `getPaymentClarityCopy(payment, voucherInfo)` helper.
- [ ] Render a styled info panel with icon + short title + one line description.
- [ ] Add edge-state copy when voucher fully covers total (`voucherCoversFullOrder`).

**Acceptance criteria**
- Changing payment method updates message with no delay.
- Voucher edge cases show correct message and no contradictory payment instruction.

---

### A3) Add address confidence status chip

**Primary files**
- `src/pages/CheckoutPage.tsx`
- `src/components/AddressAutocompleteField.tsx`

**UI behavior**
- Show one of:
  - “Exact pin found” (green)
  - “Approximate match” (amber)
  - “Needs confirmation” (neutral)
- Status updates based on geocode/selection state (`selectedDestination`).

**Implementation tasks**
- [ ] Add derived `addressConfidence` state in checkout page.
- [ ] Update when autocomplete returns a selected place or manual edit occurs.
- [ ] Render status chip beneath address input.

**Acceptance criteria**
- Manual edits reset confidence to “Needs confirmation”.
- Selecting a suggestion promotes confidence state accordingly.

---

## Track B — Menu quick-add feedback + intent presets

### B1) Add intent preset chips at top of menu list

**Primary files**
- `src/pages/MenuPage.tsx`
- `src/components/ProductCard.tsx` (only if card metadata surface needed)

**Preset definitions**
- Fastest
- Best Value
- Most Ordered
- Spicy

**Implementation tasks**
- [ ] Add `intentPreset` state (`"none" | "fastest" | "value" | "most_ordered" | "spicy"`).
- [ ] Map each preset to sort/filter behavior without breaking existing filters:
  - Fastest → prioritize in-stock + simple items (proxy: in-stock + lower prep proxy like popular/price).
  - Best Value → prioritize lower price and strong rating.
  - Most Ordered → existing popular/reviewCount logic.
  - Spicy → filter `Hot`/`Extra Hot` and sort by rating.
- [ ] Ensure selecting a preset updates visible active-state styling.
- [ ] Add one-tap “Clear” action returning to current default controls.

**Acceptance criteria**
- Preset chips are visible above results on mobile and desktop.
- Presets coexist with current category/search filters predictably.
- Clear action resets only preset behavior, not user search text unless explicitly requested.

---

### B2) Add inline quick-add confirmation feedback

**Primary files**
- `src/components/ProductCard.tsx`
- `src/context/CartContext.tsx` (consume existing add API)
- `src/components/CartFAB.tsx` (optional pulse integration)

**UI behavior**
- When “Add” is clicked:
  - Button transitions to “Added +1” for ~1200ms.
  - Cart FAB badge briefly pulses.
  - Optional subtle toast only for first add in session.

**Implementation tasks**
- [ ] Add transient per-product local state (`addedAt`) in ProductCard.
- [ ] Animate CTA style transition with existing utility classes.
- [ ] Trigger cart pulse through lightweight event or shared state flag.

**Acceptance criteria**
- Users receive immediate visual confirmation at point of action.
- Repeated quick taps still increment correctly without stale state.
- No duplicate noisy toasts on rapid adds.

---

### B3) Add smart empty-state fallback suggestions

**Primary file**
- `src/pages/MenuPage.tsx`

**UI behavior**
- If no products match, show:
  - “No exact matches” title
  - 3-4 suggestion chips derived from active search/filter context
  - one-click recovery actions (`Clear spice`, `Show popular`, `Under R50`)

**Implementation tasks**
- [ ] Detect empty filtered results while products exist.
- [ ] Build `suggestedRecoveryActions` list from current filters.
- [ ] Render chips/buttons that mutate state directly.

**Acceptance criteria**
- Empty states never dead-end users.
- Recovery actions visibly repopulate results in one tap.

---

## UI copy deck (ready to paste)

### Checkout sticky CTA copy
- Step 1: `Continue to payment`
- Step 2: `Review & place order`
- Submitting: `Placing order...`

### Payment clarity titles
- Card: `Secure online payment`
- EFT: `Bank transfer payment`
- Cash: `Pay on delivery`
- Voucher: `Voucher applied`

### Quick-add feedback
- Default: `Add`
- Success transient: `Added +1`

---

## Telemetry / success metrics

Track after release (7-day window):
- Menu → checkout click-through rate
- Checkout step 1 → step 2 completion rate
- Checkout abandonment rate before payment selection
- Add-to-cart to place-order conversion
- Median time from first menu interaction to order placement

Instrumentation target files:
- `src/pages/MenuPage.tsx`
- `src/pages/CheckoutPage.tsx`
- analytics helper (if present) in `src/lib/` or equivalent

---

## Delivery plan (5 working days)

### Day 1
- Implement Checkout sticky bar shell + payment clarity block

### Day 2
- Address confidence chip + edge-case QA in checkout states

### Day 3
- Intent preset chips + clear behavior in Menu

### Day 4
- Quick-add feedback in ProductCard + cart pulse integration

### Day 5
- Empty-state recovery actions + polish + cross-device QA

---

## QA checklist for sprint handoff

- [ ] iPhone Safari and Android Chrome mobile checkout sticky behaves correctly with keyboard open
- [ ] Voucher flows (partial + full coverage) show accurate totals and CTA states
- [ ] Menu presets do not conflict with search/category/spice filters
- [ ] Quick-add feedback remains responsive on low-end devices
- [ ] No accessibility regressions (focus order, aria labels, contrast)
