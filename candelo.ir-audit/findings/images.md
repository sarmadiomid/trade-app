# Image SEO — candelo.ir

**Date:** 2026-10-30  
**Primary URL:** https://candelo.ir/  
**Evidence:** `parse_html.py` on homepage HTML, live byte fetches, Playwright DOM image inventory. DataForSEO Image SERP not run (not required for this pass).

## Image SEO Score: **38 / 100**

Homepage is **SVG/CSS-first** (product UI mock), not image-heavy. The few raster images fail basic SEO hygiene, and social preview imagery is missing entirely.

### Image Audit Summary

| Metric | Status | Count |
|--------|--------|------:|
| Total `<img>` | — | **3** |
| Missing / empty alt | Fail | **3** |
| Oversized (>200 KB) content imgs | Pass | **0** |
| Source logo still PNG (not WebP/AVIF) | Warn | **1** (+ icons) |
| No width/height | Warn | **1** (eNamad) |
| Above-fold logo with `loading="lazy"` | Fail | **2** (header + duplicate) |
| `<picture>` / AVIF|WebP sources | Fail | **0** |
| Open Graph / Twitter image | Fail | **0** |
| Inline / DOM SVGs | Info | **69** (68 `aria-hidden`) |

---

## Inventory

| Image | Transfer / file | Format | Alt | Dimensions | Loading | Issues |
|-------|----------------:|--------|-----|------------|---------|--------|
| Header logo via `/_next/image?...logo.png&w=48\|96` | ~1–1.5 KB optimized | PNG (via Image Optimization) | `""` | 34×34 display; width/height set | **`lazy`** + `decoding=async` | Empty alt; lazy on LCP-adjacent chrome; no `fetchpriority` |
| Footer logo (same asset) | same | PNG | `""` | 34×34 | `lazy` | Empty alt (OK to lazy below fold) |
| eNamad trust seal | **0 B / ~30 s hang** in lab | remote ASPX | `""` | none | none | Empty alt; no dimensions; third-party reliability; blocks load |
| `/logo.png` (source) | **74.2 KB** | PNG | — | — | — | `max-age=0`; not modern format; same bytes as `/icon.png` |
| `/icon.png` | **74.2 KB** | PNG | — | — | — | Oversized for favicon use; identical to logo.png |
| `/apple-icon.png` | **13.7 KB** | PNG | — | — | — | `max-age=0` |
| `/favicon.ico` | **4.5 KB** | ICO | — | — | — | `max-age=0` |

**Hero “screenshot” users see is not an `<img>`** — it is composed from many SVGs/CSS. That helps LCP (LCP is the H1 text) but **yields no Google Images asset** and no crawlable product screenshot with alt/filename.

---

## Top image issues

### 1. All `<img>` alts empty (Critical)
- Logo and eNamad use `alt=""`. Logos that convey the brand name should have descriptive alt (e.g. «لوگوی کندلو») unless adjacent visible text fully duplicates and the image is marked decorative consistently.
- **Fix:** Meaningful Persian alt on brand marks; keep true decoration empty + `alt=""` with intent documented.

### 2. No `og:image` / Twitter card image (Critical)
- Head has description but **zero** `og:image` / `twitter:image` (confirmed in HTML + technical findings).
- **Fix:** Add a **1200×630** WebP/JPEG product hero (chart UI), set `og:image`, `og:image:width/height`, `og:locale=fa_IR`, `twitter:card=summary_large_image`. This is the highest-leverage “image SEO” gap for sharing/Telegram growth.

### 3. Above-fold logo uses `loading="lazy"` (High)
- Header logo is in the first screen yet marked lazy (Next/Image default without `priority`).
- LCP is currently H1 text, so impact is limited — still a footgun if the logo or a future hero `<img>` becomes LCP.
- **Fix:** `priority` / `fetchPriority="high"` on header logo; never lazy LCP media.

### 4. Brand assets not in modern formats + weak cache (High)
- Source `logo.png` / `icon.png` are **74 KB PNG**; `/_next/image` still responds `Content-Type: image/png` for the optimized URLs in this environment (no AVIF/WebP negotiation observed on sampled requests).
- Cache `max-age=0` on logo/icon/apple-icon.
- **Fix:** Prefer SVG logo (already SVG-heavy UI) or WebP/AVIF; fingerprint + long-cache; ensure Image Optimization negotiates modern formats.

### 5. eNamad seal — empty alt, no dimensions, unreliable (High)
- Lab: ~30 s duration, 0 transfer — seal fails open and stalls load.
- **Fix:** Static cached badge with width/height + alt «نماد اعتماد الکترونیکی»; lazy below fold.

### 6. No indexable product/hero raster for Image SERP (Medium)
- 69 SVGs do not substitute for a discoverable product image with filename + alt + surrounding copy.
- **Fix:** Publish at least one compressed WebP “Candelo backtest UI” image in content (or OG), descriptive filename `candelo-backtest-chart-ui.webp`, alt describing Persian backtest/replay UI.

### 7. Favicon / app icon hygiene (Low)
- `/icon.png` duplicates the 74 KB logo — oversized for tab icons.
- **Fix:** Dedicated 32/48 PNG or SVG favicon; keep apple-touch at ~180² optimized.

---

## Prioritized optimization list

| Priority | Action | Est. impact |
|----------|--------|-------------|
| P0 | Create & wire **OG/Twitter 1200×630** image | Social + brand SERP previews |
| P0 | Fill **alt** on logo (and seal) | Image a11y + Images ranking basics |
| P1 | `priority` on header logo; lazy only below fold | LCP safety |
| P1 | Replace/repair eNamad with static lazy badge | Performance + CLS safety |
| P2 | SVG or WebP logo; long-cache fingerprinted assets | Bytes + repeat views |
| P2 | Add one crawlable product screenshot with descriptive filename | Google Images eligibility |
| P3 | Confirm Next `/_next/image` serves AVIF/WebP by Accept | Format modernization |

---

## Recommendations (summary)

1. Add social preview art — largest missing image SEO surface.  
2. Fix alt text and stop lazy-loading the header logo.  
3. Modernize + cache brand files; isolate the eNamad third party.  
4. Optionally export the SVG hero mock to a real optimized WebP for Images/social.
