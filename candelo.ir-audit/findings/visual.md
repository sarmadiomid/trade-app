# Visual SEO / UX — candelo.ir

**Date:** 2026-10-30  
**Primary URL:** https://candelo.ir/  
**Evidence:** Playwright Chrome screenshots (desktop 1920×1080, laptop 1366×768, tablet 768×1024, mobile 375×812 @2x) + DOM visual probes in `lab-perf-visual.json` / `visual-extra.json`.

## Visual Score: **64 / 100**

| Lens | Score | Notes |
|------|------:|-------|
| Above-the-fold clarity | 82 | Clear H1, dual CTAs, product UI preview |
| Mobile layout | 48 | Horizontal nav overflow; small touch targets; no hamburger |
| Typography / contrast | 78 | Readable ≥16px; H1 contrast ~20:1; muted subcopy ~7:1 |
| Brand / composition | 72 | Strong dark brand hero; product mockup as visual anchor |
| i18n presentation | 40 | Persian UI with `lang="en"` and computed `dir=ltr` on `<html>` |

---

## Above-the-fold (desktop + mobile)

| Check | Desktop | Mobile |
|-------|---------|--------|
| H1 visible | Yes — «معامله با اطمینان، از بک‌تست شروع می‌شود» | Yes |
| Primary CTA | Yes — «شروع کنید» / «ورود» | Yes — «شروع کنید» |
| Secondary CTA | «نمودار را امتحان کنید» | Same, stacked |
| Hero visual | Product chart UI (SVG-heavy mock), not a photo | Partial ticker/widget in first screen |
| Viewport meta | Present (`width=device-width, initial-scale=1`) | Present |
| Horizontal page scroll (`documentElement`) | No | No (scrollWidth = 375) |
| Body scroll model | `body.h-full.overflow-hidden` — scrolling is delegated to an inner container | Same |

**Verdict:** First viewport reads as one branded composition (logo, one headline, support line, CTA group, product visual). Good marketing hierarchy.

---

## Top visual issues

### 1. Mobile nav overflows / clips links (Critical)
- At 375px, header nav links stay in a horizontal row. «سوالات متداول» sits at **x ≈ −92** (off-screen). No reliable hamburger / `aria-expanded` menu detected.
- Touch samples: many header controls **32–36 px** tall (below 44×44 CSS px guideline); **20 / 28** interactive elements undersized in the mobile probe.
- **Fix:** Collapse to a proper mobile menu; enlarge CTA/hit areas to ≥44px; don’t rely on a second nav row that clips RTL labels.

### 2. `lang` / `dir` mismatch for a Persian site (High)
- `<html lang="en">`; runtime `document.documentElement` direction reported **`ltr`** while copy and layout intent are Persian RTL (`dir="rtl"` only on some descendants, count=4 in HTML).
- **Impact:** Accessibility APIs, font fallback, and SEO language targeting disagree with the visible UI (also flagged in technical SEO).
- **Fix:** `<html lang="fa" dir="rtl">` (or `fa-IR`) at the root layout.

### 3. Full-page capture / `overflow-hidden` on `body` (Medium)
- `body` classes include `overflow-hidden`. `documentElement.scrollHeight` matched the viewport (1080 / 812) even though footer/nav nodes exist far below (~13k px in layout coordinates). Playwright `full_page` screenshots therefore matched the viewport crop.
- **Impact:** Some crawlers/tools and accessibility scroll expectations can be confused; not necessarily a ranking factor, but hurts tooling and possibly in-page find/scroll UX depending on the inner scroller.
- **Fix:** Prefer document scrolling for the marketing page, or ensure the inner scroller is the clear, focusable main region with accessible name.

### 4. Decorative chrome vs content images (Medium / Info)
- **69 SVGs** on the homepage (product mock / icons); **68** marked `aria-hidden`; only **1** titled/labelled. Good for decorative SVGs, but the large chart mock should expose an accessible name if it conveys product meaning.
- Real `<img>` count is only **3** (logos + eNamad) — the “hero image” users see is mostly SVG/CSS, not an indexable image asset (see `images.md`).

### 5. Contrast & type (Pass with notes)
- H1 white on near-black ≈ **20:1**; supporting paragraph blue-gray ≈ **7:1** (AA for normal text).
- Body font-size **16px**; H1 ~66px desktop / ~38px mobile. H1 family **Vazirmatn**; body stack falls back to system UI until webfonts resolve.
- Poppins is linked but largely unused for Persian H1 — visual noise + performance cost.

### 6. Brand consistency (Pass)
- Dark navy/grid hero, blue primary CTAs, Persian product framing, «جدید» badge — cohesive and distinctive. Logo lockup readable in header on desktop and mobile.

---

## Screenshot inventory

| File | Viewport |
|------|----------|
| `screenshots/candelo_ir_desktop.png` | 1920×1080 |
| `screenshots/candelo_ir_laptop.png` | 1366×768 |
| `screenshots/candelo_ir_tablet.png` | 768×1024 @2x |
| `screenshots/candelo_ir_mobile.png` | 375×812 @2x |
| `*_full.png` | Same as viewport (see overflow-hidden note) |

Stock `analyze_visual.py` / `capture_screenshot.py` timed out against ArvanCloud until Chrome was launched with `--no-sandbox`; metrics above come from the audited lab runner.

---

## Recommendations (priority)

1. Ship a mobile nav (hamburger) and 44px touch targets; stop clipping FAQ.
2. Set `lang="fa"` + `dir="rtl"` on `<html>`.
3. Name the hero product mock for accessibility; keep decorative SVGs `aria-hidden`.
4. Relax `body { overflow: hidden }` on the marketing route or document the inner scroller as `<main>`.
5. Drop unused Poppins to simplify the visual/font system.
