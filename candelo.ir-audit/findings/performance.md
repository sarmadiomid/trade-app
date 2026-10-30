# Performance / Core Web Vitals — candelo.ir

**Date:** 2026-10-30  
**Primary URL:** https://candelo.ir/  
**Stack:** Next.js App Router + ArvanCloud CDN  
**Data source:** Playwright lab metrics via system Chrome (`channel=chrome`). **PageSpeed Insights / CrUX unavailable** (PSI API HTTP 403; no usable Google API key). Scores below are **lab estimates**, not Search Console field CWV.

## Performance Score: **58 / 100** (lab)

| Metric | Desktop lab | Mobile lab | Rating | Threshold (good) |
|--------|------------:|-----------:|--------|------------------|
| **LCP** | **2880 ms** | **2860 ms** | Needs improvement | ≤ 2500 ms |
| **CLS** | **0.001** | **0.003** | Good | ≤ 0.1 |
| **FCP** | **2880 ms** | **2860 ms** | Needs improvement | ≤ 1800 ms |
| **TTFB** (nav request→response) | **630 ms** | **978 ms** | Good / Needs improvement | ≤ 800 ms |
| **INP** | n/a | n/a | Not measured | ≤ 200 ms |
| Document transfer (gzip) | ~65 KB | ~65 KB | — | — |
| Document decoded | **371 KB** | **371 KB** | Heavy | — |
| JS transfer (approx.) | ~314 KB | ~314 KB | Heavy | — |
| CSS on wire (main bundle) | **162 KB** uncompressed | same | Heavy | — |
| `load` event | ~32 s | ~32 s | Poor (blocked) | — |

**LCP element:** `<h1>` (text), not an image — confirmed via Largest Contentful Paint entry (`tag: H1`, desktop size ≈ 114k).

**Limitation:** No CrUX field data and no PSI Lighthouse category scores. Treat 58 as a lab proxy for the Performance (CWV) audit bucket.

---

## Top CWV Issues

### 1. LCP / FCP stuck ~2.9 s on text H1 (High)
- Paint of the hero headline waits on CSS + webfonts. Stylesheets include Google Fonts (Poppins) and jsDelivr Vazirmatn (`9` `@font-face` rules in the remote CSS).
- FCP equals LCP → almost no earlier meaningful paint.
- **Fix:** Self-host only used Vazirmatn weights (likely 400/500/700); drop unused Poppins if Latin UI is rare; `font-display: swap` (or optional); preload the H1 woff2; inline critical CSS for hero; avoid render-blocking third-party CSS.

### 2. Oversized HTML document — 371 KB decoded / ~65 KB gzip (High)
- Homepage HTML is an unusually large Next.js/RSC payload for a marketing page.
- `Cache-Control: private, no-cache, no-store` on the document + `X-Cache: BYPASS` → ArvanCloud cannot cache the HTML shell.
- **Fix:** Reduce inline RSC/flight payload; enable CDN caching for anonymous marketing HTML (ISR/`s-maxage` or static generation); keep HTML under ~50 KB gzip where possible.

### 3. Third-party eNamad seal blocks `load` ~30 s (High)
- `https://trustseal.enamad.ir/logo.aspx?...` showed **~30,218 ms** duration with **0 bytes** transfer in lab (hang/fail).
- This forces `networkidle` / `load` into the 32 s range and can stall main-thread/network work on slow connections.
- **Fix:** Lazy-load the seal below the fold (`loading="lazy"` + defer until viewport); host a static cached badge; timeout/fallback if the third party is unreachable.

### 4. JS weight ~314 KB transfer across 11 chunks (Medium)
- Largest chunk ≈ **111 KB** (`512-*.js`). Marketing page pulls a full App Router client graph.
- **Fix:** Route-level code splitting; defer non-hero interactivity; audit unused client components on the landing route.

### 5. Main CSS bundle **162 KB** uncompressed (Medium)
- `/_next/static/css/f0740b0a4baf21dc.css` — large for first paint; second CSS is fine (~3.4 KB).
- **Fix:** Purge unused Tailwind/utilities; split marketing vs app chrome CSS.

### 6. Image / static asset caching weak for brand files (Medium)
- `/logo.png`, `/icon.png`, `/apple-icon.png` serve `Cache-Control: public, max-age=0` (must-revalidate on icons).
- Hashed `/_next/static/*` correctly uses `max-age=31536000, immutable`.
- **Fix:** Long-cache fingerprinted brand assets (or rely on `/_next/image` with stable URLs + longer TTL).

### 7. Mobile TTFB ~978 ms (Medium)
- Desktop TTFB lab 630 ms (good); mobile lab 978 ms (needs improvement). Origin/CDN path via ArvanCloud is acceptable but not fast on mobile emulation.
- **Fix:** Cache HTML at edge; shrink TTFB with static/ISR homepage; keep origin warm.

### 8. CLS is excellent (Info / keep)
- Lab CLS **0.001–0.003**. Logo has width/height; most chrome is SVG with stable layout. Preserve dimension attributes when adding real photos/OG art.

---

## Lab method notes

| Check | Result |
|-------|--------|
| PSI mobile/desktop | **403 Forbidden** — see `pagespeed.json` |
| CrUX field | **null** |
| Playwright | Works with `channel=chrome` + `--no-sandbox` from this environment; stock `capture_screenshot.py` / `networkidle` timed out until sandbox flags + enamad hang addressed |
| Artifacts | `lab-perf-visual.json`, `screenshots/candelo_ir_{desktop,mobile,laptop,tablet}.png` |

---

## Recommendations (priority)

1. Unblock LCP: subset + self-host Vazirmatn; remove unused Poppins; preload H1 font; critical CSS.
2. Isolate eNamad (lazy / static / timeout) so it cannot hold `load`.
3. Cut homepage HTML + cache anonymous shell at ArvanCloud.
4. Trim marketing-route JS/CSS; keep CLS discipline when adding media.
5. Re-run PSI/CrUX once a Google API key is available to replace lab estimates with field CWV.
