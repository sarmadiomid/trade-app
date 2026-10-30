# Technical SEO Audit — https://candelo.ir

**Date:** 2026-10-30  
**Stack:** Next.js (App Router / RSC) behind ArvanCloud  
**Product:** Candelo — Persian trading backtest/replay SaaS  

## Technical Score: 42/100

### Category Breakdown

| Category | Status | Score |
|----------|--------|------:|
| Crawlability | fail | 28/100 |
| Indexability | fail | 32/100 |
| Security | pass | 82/100 |
| URL Structure | warn | 70/100 |
| Mobile | pass | 78/100 |
| Core Web Vitals | warn | 38/100 |
| Structured Data | fail | 5/100 |
| JS Rendering | warn | 50/100 |
| IndexNow | fail | 0/100 |

---

## Critical Issues (fix immediately)

### 1. Missing `robots.txt` (404)
- **Evidence:** `GET https://candelo.ir/robots.txt` → **404** (HTML soft-404 shell ~7.7KB with `meta robots noindex`). Same for Googlebot UA.
- **Impact:** No crawl policy for public vs app routes; no sitemap discovery; no AI-crawler policy.
- **Fix:** Serve a real `text/plain` robots.txt at `/robots.txt`, e.g.:

```txt
User-agent: *
Allow: /
Allow: /lessons
Disallow: /home
Disallow: /backtest
Disallow: /battle
Disallow: /chart
Disallow: /admin
Disallow: /login
Disallow: /api/

Sitemap: https://candelo.ir/sitemap.xml
```

### 2. Missing XML sitemap (404)
- **Evidence:** `/sitemap.xml` and `/sitemap_index.xml` → **404**.
- **Impact:** Only a handful of public URLs exist; discovery still relies on links/backlinks. New marketing pages will index slowly.
- **Fix:** Add Next.js `app/sitemap.ts` (or static sitemap) listing indexable URLs only: `/`, `/lessons` (once SSR-fixed), future `/pricing`, `/blog`, etc. Reference it from robots.txt.

### 3. `/lessons` is client-side only (CSR bailout) — empty to crawlers
- **Evidence:** Raw HTML contains `<template data-dgst="BAILOUT_TO_CLIENT_SIDE_RENDERING"></template>` and body content is effectively an empty `<div class="h-full w-full bg-chart"></div>`. Stripped text ≈ `"Candelo"`. Title is bare `Candelo` (no lesson intent). Meta description exists, but body has no crawlable copy. Playwright render timed out in this environment; raw signal alone is enough to fail JS SEO.
- **Impact:** Google may index a near-empty page or defer/skip useful content. Public route wastes crawl budget.
- **Fix:** Remove the dynamic bailout; SSR/SSG lesson list + unique titles/descriptions per lesson URL. Ensure primary content appears in initial HTML (200 response).

---

## High Priority (fix within 1 week)

### 4. `html lang="en"` while content is Persian (fa)
- **Evidence:** `<html lang="en" class="h-full">` on `/`, `/login`, `/lessons`; page copy and title are Persian; `dir="rtl"` appears on descendants, not on `<html>`/`<body>`.
- **Impact:** Wrong language classification for Google/Bing; accessibility mismatch; weak fa-IR targeting.
- **Fix:** Set `<html lang="fa" dir="rtl">` (or `fa-IR`) in root layout. Keep Latin UI fragments with `lang="en"`/`dir="ltr"` locally if needed.

### 5. No self-referencing canonical on indexable pages
- **Evidence:** `parse_html` / head scan: `canonical: null` on homepage; none on `/login` or `/lessons`.
- **Impact:** Weaker duplicate consolidation for parameterized URLs (`/login?next=…`) and any future www/query variants. (www already 301s to apex — good.)
- **Fix:** Emit `<link rel="canonical" href="https://candelo.ir/">` (and per-URL canonicals) in server HTML.

### 6. No Open Graph / Twitter Card tags
- **Evidence:** Homepage head has only charset, viewport, theme-color, description — **no** `og:*` / `twitter:*`.
- **Impact:** Weak link previews on Telegram, X, LinkedIn, Slack — critical for SaaS growth in Iran/social channels.
- **Fix:** Add `og:title`, `og:description`, `og:url`, `og:locale` (`fa_IR`), `og:image` (1200×630), `twitter:card=summary_large_image`.

### 7. Auth/app entry URLs are indexable
- **Evidence:**
  - `/home`, `/backtest`, `/battle`, `/chart`, `/admin` → **HTTP 307** → `/login?next=…` (correct temporary auth redirect).
  - `/login` and `/login?next=%2Fhome` → **200**, titled «ورود / ثبت‌نام | Candelo», **no** `noindex`, **no** canonical.
  - Homepage CTAs link to `/login?next=/home/checkout?plan=…` (parameterized login URLs).
- **Impact:** Risk of thin login/parameter URLs in the index; crawl noise.
- **Fix:** `robots.txt` Disallow for `/login` and app paths; add `<meta name="robots" content="noindex, nofollow">` on `/login`; prefer 302/307 (already 307) + disallow.

### 8. Marketing homepage served `Cache-Control: private, no-cache, no-store` (CDN BYPASS)
- **Evidence:** Response headers: `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`; `x-cache: BYPASS`; HTML download **~371KB** with ~**210KB** inline RSC/script payload. Contrast: `/lessons` has `s-maxage=31536000` (ironically caching an empty CSR shell).
- **Impact:** Repeated full origin fetches for bots and users; hurts TTFB/LCP; ArvanCloud edge unused for the money page.
- **Fix:** For public marketing SSR: `public, s-maxage=300, stale-while-revalidate=86400` (or ISR/`revalidate`). Keep `private, no-store` only on authenticated app routes.

### 9. Zero structured data
- **Evidence:** No `application/ld+json` on homepage; schema array empty.
- **Impact:** No Organization/SoftwareApplication/FAQ rich-result eligibility; weaker entity understanding for a brand-new SaaS.
- **Fix:** Add JSON-LD in initial HTML: `Organization` + `WebSite` (+ `SoftwareApplication`); FAQPage for the FAQ section already on `/`.

---

## Medium Priority (fix within 1 month)

### 10. Thin public URL surface / expected marketing routes 404
- **Evidence:** `/pricing`, `/blog`, `/about`, `/privacy`, `/terms`, `/features` → **404** with `meta name="robots" content="noindex"` (correct for 404s). Homepage pricing is in-page `#pricing` anchors only.
- **Impact:** Few indexable entry points; legal/trust pages missing (Enamad seal present, but no privacy/terms URL).
- **Fix:** Ship dedicated indexable pages (or clearly intentional single-page IA) and include them in the sitemap. Keep 404 `noindex`.

### 11. Weak internal link graph for SEO
- **Evidence:** Indexable path hrefs from homepage ≈ `/`, `/login`, checkout-via-login query links, and hash sections (`#features`, `#pricing`, `#faq`…). **No** link to `/lessons`.
- **Impact:** `/lessons` orphaned even after SSR fix; login over-emphasized vs content hubs.
- **Fix:** Add footer/nav links to lessons, blog, about, legal once those exist.

### 12. CLS / LCP source risks (lab CrUX unavailable)
- **Evidence:**
  - Enamad seal `<img … alt=''>` **without width/height**.
  - Logo uses `loading="lazy"` (fine for small icons).
  - 4 render-blocking stylesheets in `<head>` including Google Fonts + jsDelivr Vazirmatn.
  - PSI/CrUX APIs returned **403 / not configured** in this run — no field CWV; score is source-inferred.
- **Impact:** Layout shift when seal loads; font CSS blocks rendering; large HTML delays LCP.
- **Fix:** Reserve seal dimensions; self-host Vazirmatn with `font-display: swap` (already on Google Fonts URL); reduce RSC payload on marketing page; preload LCP font/image only.

### 13. Missing Content-Security-Policy
- **Evidence:** Security headers present (HSTS, XFO, nosniff, Referrer-Policy, Permissions-Policy, XSS-Protection) via ArvanCloud; **no** `Content-Security-Policy`.
- **Impact:** XSS surface larger; secondary vs SEO but listed in technical security category.
- **Fix:** Add CSP (report-only first) allowing Next.js, Arvan, fonts, Enamad.

### 14. `llms.txt` missing (404)
- **Evidence:** `/llms.txt` → 404.
- **Impact:** No voluntary AI-agent site summary; pairs with missing robots AI policy.
- **Fix:** Optional `llms.txt` describing Candelo, public docs URLs, and contact — after robots/sitemap.

---

## Low Priority (backlog)

### 15. IndexNow not implemented
- **Evidence:** `/api/indexnow`, `/.well-known/indexnow-key.txt`, `/indexnow.txt`, `/IndexNow` → 404.
- **Impact:** Slower Bing/Yandex/Naver discovery for a low-URL-count site (lower urgency until content volume grows).
- **Fix:** Generate IndexNow key, host at `https://candelo.ir/{key}.txt`, ping on publish.

### 16. HSTS `preload` directed but verify list submission
- **Evidence:** `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`. HTTP→HTTPS **301**; www→apex **301**.
- **Note:** Confirm submission at hstspreload.org if intending preload; otherwise drop `preload` token until submitted.

### 17. Agent / a11y tree check incomplete
- **Evidence:** `agent_ux_check.py` / Playwright navigation **timed out** (15s) against candelo.ir from audit host.
- **Note:** Re-run agent-UX after network/timeouts fixed. Semantic landmarks exist in homepage SSR (`header`/`nav`/`main`/`footer`).

### 18. Homepage `<body class="… overflow-hidden">`
- **Evidence:** Body uses `overflow-hidden` (app-shell pattern on a long marketing page).
- **Impact:** Possible scroll/clip quirks for some browsers/agents; not a hard ranking factor.
- **Fix:** Prefer overflow on inner app chrome only; allow document scroll on marketing layout.

---

## What looks good

| Signal | Evidence |
|--------|----------|
| Homepage **200** with strong title + meta description | `Candelo \| بک‌تست و بازپخش بازار` + Persian description |
| Substantial SSR content on `/` | ~1376 words extracted; `is_spa: false`; H1 present |
| HTTPS + www consolidation | `http://` → 301 HTTPS; `www.candelo.ir` → 301 apex |
| Auth gates use HTTP **307** (not soft-200 HTML) | `/home` etc. → `/login?next=…` |
| 404s send `noindex` | `/pricing` etc. include `<meta name="robots" content="noindex"/>` |
| Security headers | HSTS (2y, includeSubDomains, preload), X-Frame-Options SAMEORIGIN, nosniff, Referrer-Policy, Permissions-Policy |
| Viewport / mobile basics | `width=device-width, initial-scale=1` |
| Favicons | `/favicon.ico`, `/icon.png`, `/apple-icon.png` 200 |
| Trailing slash on `/login/` | **308** → `/login` |

---

## Top fixes (ordered)

1. **Ship `robots.txt` + `sitemap.xml`** and disallow app/login/API paths.  
2. **SSR `/lessons`** (eliminate `BAILOUT_TO_CLIENT_SIDE_RENDERING`); unique titles.  
3. **`lang="fa" dir="rtl"`** + self-canonical + Open Graph on public pages.  
4. **`noindex` `/login`** (and robots Disallow); stop relying on parameterized login URLs for discovery.  
5. **Cache public marketing HTML** at the CDN (`s-maxage` / ISR); shrink 371KB payload.  
6. **JSON-LD** (Organization, SoftwareApplication, FAQPage).  
7. Add **privacy/terms** (and real pricing/about if in IA) as 200 pages in the sitemap.  
8. Optional: **IndexNow** + **llms.txt** + CSP report-only.

---

## Method notes

- Fetch/render: `~/.claude/skills/seo/.venv/bin/python` + `scripts/render_page.py` (`--mode auto`/`never`/`always`), `parse_html.py`, curl header/status probes (Googlebot UA).  
- CWV: PSI/CrUX unavailable (API 403 / Google auth not configured); scores for CWV are **source-inferred**, not field data.  
- Playwright timed out for full render/agent-UX against this host; CSR bailout on `/lessons` confirmed from **raw HTML**.

---

## audit-data.json fragment (Technical SEO)

```json
{
  "category": "Technical SEO",
  "score": 42,
  "status": "fail",
  "categories": {
    "crawlability": { "status": "fail", "score": 28 },
    "indexability": { "status": "fail", "score": 32 },
    "security": { "status": "pass", "score": 82 },
    "url_structure": { "status": "warn", "score": 70 },
    "mobile": { "status": "pass", "score": 78 },
    "core_web_vitals": { "status": "warn", "score": 38, "note": "No CrUX/PSI field data; source-inferred" },
    "structured_data": { "status": "fail", "score": 5 },
    "js_rendering": { "status": "warn", "score": 50 },
    "indexnow": { "status": "fail", "score": 0 }
  },
  "findings": [
    { "severity": "critical", "id": "robots-404", "title": "robots.txt returns 404" },
    { "severity": "critical", "id": "sitemap-404", "title": "sitemap.xml returns 404" },
    { "severity": "critical", "id": "lessons-csr-bailout", "title": "/lessons BAILOUT_TO_CLIENT_SIDE_RENDERING; empty crawlable body" },
    { "severity": "high", "id": "html-lang-en", "title": "html lang=en for Persian content" },
    { "severity": "high", "id": "missing-canonical", "title": "No canonical on public pages" },
    { "severity": "high", "id": "missing-og", "title": "No Open Graph/Twitter tags" },
    { "severity": "high", "id": "login-indexable", "title": "/login and ?next= variants lack noindex" },
    { "severity": "high", "id": "homepage-no-store", "title": "Homepage Cache-Control no-store; CDN BYPASS; ~371KB HTML" },
    { "severity": "high", "id": "no-jsonld", "title": "No structured data" },
    { "severity": "medium", "id": "marketing-404s", "title": "/pricing /blog /about /privacy /terms /features 404" },
    { "severity": "medium", "id": "thin-internal-links", "title": "Homepage does not link to /lessons; mostly #anchors + /login" },
    { "severity": "medium", "id": "cls-enamad", "title": "Enamad image missing width/height" },
    { "severity": "medium", "id": "no-csp", "title": "Content-Security-Policy absent" },
    { "severity": "medium", "id": "llms-404", "title": "llms.txt 404" },
    { "severity": "low", "id": "indexnow-missing", "title": "IndexNow not implemented" }
  ],
  "verified_parent_facts": {
    "homepage_200_title": true,
    "robots_sitemap_llms_404": true,
    "html_lang_en": true,
    "no_canonical_no_og": true,
    "public_routes": ["/", "/login", "/lessons"],
    "app_routes_307_to_login": true,
    "marketing_routes_404": true,
    "arvan_security_headers": true,
    "homepage_cache_no_store": true,
    "404_meta_noindex": true
  }
}
```
