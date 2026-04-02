# Customer Journey UX Review (End-to-End)

Date: 2026-04-01 (UTC)
Scope: Public customer flow from landing → menu browse → checkout → order tracking → post-order/account

## Executive summary

The customer experience is functionally strong, but there are opportunities to improve conversion confidence, reduce checkout friction, and make delivery-state communication clearer under edge cases (driver reassignment, payment mismatch, delayed ETA).

**Top 5 improvements to implement next (highest impact first):**
1. Add a persistent mini order summary and delivery ETA promise strip during checkout.
2. Improve menu discovery with stronger sort defaults and explicit “quick add” feedback loops.
3. Introduce trust signals with real operational proof (delivery SLA, support hours, cancellation/refund clarity).
4. Add proactive issue-handling microcopy in order tracking for failed/pending payment and delayed traffic conditions.
5. Tighten mobile ergonomics for filters/search and reduce decision fatigue in first-time ordering.

---

## 1) Landing page (awareness → intent)

### What is working
- Strong visual hero and direct primary CTA.
- Early value propositions (delivery, rating, quality) visible above fold.
- Top picks and category quick-jumps support rapid exploration.

### UX gaps
- Hero value proposition is broad; first-time users may still wonder “how fast, where, and what does it cost me now?”.
- Promotional chip (`KOTA20`) is dismissible but not recoverable in-session after close.
- “View Menu” anchor and “Order Now” route are close in meaning; this can dilute primary intent.

### Recommended improvements
- Add a **location-aware promise row** in hero: delivery area + typical ETA range + minimum order.
- Replace one CTA with a clearer secondary action such as **“How delivery works”**.
- Make offer chip restorable via small “Deals” affordance in navbar/mobile bottom nav.

---

## 2) Menu page (discovery → selection)

### What is working
- Search + category + spice + quick filters cover diverse browse intents.
- Helpful quality-of-life features: recent searches, inventory-aware ordering, refresh action.
- Multiple sort modes and active filter counting improve control.

### UX gaps
- “Best Rated” default can hide budget-first intent for price-sensitive users.
- Filter sheet density on mobile can feel high before first add-to-cart action.
- No explicit “why this is recommended” explainer in list cards for “popular/best rated”.

### Recommended improvements
- Add **intent presets** at the top: “Fastest”, “Best Value”, “Most Ordered”, “Spicy”.
- Add **inline quick add confirmation** (“Added +1”) anchored near product card CTA.
- Add **empty-state smart fallback** (“No exact results — showing similar items”) with suggested chips.

---

## 3) Checkout flow (commitment → payment)

### What is working
- Validation is thorough (identity, phone format, address, payment prerequisites).
- Saved addresses and voucher support materially reduce repeat-order friction.
- Sign-in gating and first-invalid-field focus behavior are strong UX fundamentals.

### UX gaps
- The page handles many concerns at once (profile, delivery, payment, vouchers, geocoding), increasing cognitive load for new users.
- Payment method confidence can drop when users don’t see a consistent summary of what will be charged and when.
- Address confidence is high for known users, but first-time users need stronger confirmation that destination geocode resolved correctly.

### Recommended improvements
- Add a sticky **“You’ll pay now / pay on delivery”** payment clarity module.
- Add map/address verification badge states: “Exact pin found”, “Approximate”, “Needs confirmation”.
- Add checkout progress labels with reassuring copy (“Step 2 of 3 · almost done”).

---

## 4) Order tracking page (post-purchase trust)

### What is working
- Robust state model with delivery milestones and context-aware summaries.
- Supports exceptions (driver reassignment, payment mismatch) and retry payment path.
- Live map and ETA confidence handling are valuable differentiators.

### UX gaps
- In abnormal states, users can still feel uncertain about what to do next.
- ETA confidence exists, but corrective expectation framing could be stronger.
- Retry payment action could be clearer when payment is pending vs failed.

### Recommended improvements
- Add a **single primary next action card** per exception state.
- Add clearer **ETA confidence language** (“high/medium/low confidence”).
- Add an escalation path button (“Need help with this order?”) directly in the tracking status area.

---

## 5) Account and retention loop (repeat orders)

### What is working
- Role-aware navigation and order history access are present.
- Saved addresses and reorder primitives support repeat usage.

### UX gaps
- Limited explicit loyalty loop after successful delivery.
- Reorder momentum could be improved with contextual nudges.

### Recommended improvements
- Add post-delivery prompt stack: “Rate order”, “Reorder in 1 tap”, “Save as weekly favorite”.
- Surface voucher eligibility and delivery-threshold progress in account dashboard.

---

## 6) Mobile-first UX priorities (next sprint)

1. **Checkout stickies**: persistent total + payment clarity + place-order CTA.
2. **Menu ergonomics**: simplified top-level quick filters with one-tap reset.
3. **Tracking confidence**: clearer exception-specific guidance and support entrypoint.
4. **Trust system**: transparent fees/ETA windows before cart commitment.
5. **Retention hooks**: reorder and favorites immediately after successful delivery.

---

## Suggested implementation order

### Sprint 1 (conversion lift)
- Checkout sticky summary + payment clarity module.
- Menu quick-add feedback and intent presets.

### Sprint 2 (trust + recovery)
- Tracking exception action cards and support escalation CTA.
- ETA confidence labels + delivery communication refinement.

### Sprint 3 (retention)
- Post-delivery nudge sequence (rate/reorder/favorite).
- Account-level offer/personalization widgets.
