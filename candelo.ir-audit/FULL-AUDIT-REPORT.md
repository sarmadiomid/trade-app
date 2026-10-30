# Full SEO Audit — https://candelo.ir

**Date:** 2026-10-30  
**Business type:** SaaS (Persian trading practice / candle-replay / backtest platform)  
**Stack:** Next.js App Router behind ArvanCloud  
**Overall SEO Health Score: 39 / 100**

> PSI / CrUX / GSC / Moz unavailable (no API keys; PSI returned 403). Performance uses lab Playwright metrics. Backlinks: Common Crawl only — domain not present.

---

## Executive Summary

Candelo’s **homepage product story is strong** (clear Persian H1, pricing, FAQ, eNamad, replay demo). The site is still **hard for search engines and AI systems to discover, classify, and cite** because foundational crawl assets are missing, language metadata is wrong, structured data is absent, and the public URL graph is almost a single page.

### Category scores

| Category | Weight | Score | Weighted |
|----------|-------:|------:|---------:|
| Technical SEO | 22% | 42 | 9.2 |
| Content Quality | 23% | 41 | 9.4 |
| On-Page SEO | 20% | 45 | 9.0 |
| Schema / Structured Data | 10% | 8 | 0.8 |
| Performance (CWV lab) | 10% | 58 | 5.8 |
| AI Search Readiness (GEO) | 10% | 32 | 3.2 |
| Images | 5% | 38 | 1.9 |
| **Health** | 100% | | **39** |

Supporting: Sitemap **8**, SXO **46**, Visual **64**, Backlinks (CC) **not found**.

### Top 5 critical issues

1. **`/robots.txt` and `/sitemap.xml` return 404** (HTML soft-404) — no crawl policy or URL inventory.
2. **`/lessons` CSR bailout** — empty crawlable body (`BAILOUT_TO_CLIENT_SIDE_RENDERING`).
3. **Zero JSON-LD** — no Organization / SoftwareApplication / Offer markup.
4. **`html lang="en"`** on a Persian RTL product — wrong language targeting.
5. **Public surface ≈ one page** — no Privacy, Terms, About, contact, blog; trust + topical authority blocked.

### Top 5 quick wins

1. Add `app/robots.ts` + `app/sitemap.ts` (Allow marketing; Disallow app/API/login).
2. Set `<html lang="fa" dir="rtl">` in root layout.
3. Add canonical + Open Graph + Twitter tags on `/`.
4. `noindex` on `/login` (and parameterized `?next=` variants).
5. Ship Privacy + Terms pages (OTP + billing already imply legal need).

---

## Technical SEO — 42/100

**Details:** `findings/technical.md`

| Area | Status |
|------|--------|
| Crawlability | Fail — no robots/sitemap |
| Indexability | Fail — thin public graph; login indexable; lessons empty |
| Security headers | Pass — HSTS, XFO, nosniff, referrer-policy (ArvanCloud) |
| JS rendering | Warn — homepage SSR OK; `/lessons` CSR bailout |
| Homepage cache | Warn — `Cache-Control: private, no-store` + CDN BYPASS (~371KB HTML) |

**Falsifiability:** After shipping robots + sitemap, `curl -I https://candelo.ir/robots.txt` must be `200` + `text/plain`, and GSC “Sitemaps” must show success within 7 days.

---

## Content Quality — 41/100

**Details:** `findings/content.md`

- Homepage ~633 Persian tokens, clear H1→FAQ structure, virtual-only disclaimer — **meets thin-page floor**.
- E-E-A-T weighted ~**35**: weak Authority/Trust (no About/Privacy/Terms/contact entity pages).
- AI citation readiness ~**32**: quotable FAQ/prices exist but no schema, llms.txt, or topical cluster.
- `/lessons` contributes almost nothing to crawlers.

---

## On-Page SEO — 45/100

**What works**
- Distinct titles on `/` and `/login`.
- Meta description present on homepage.
- Internal in-page anchors (product, pricing, FAQ).

**Gaps**
- No self-canonical; no OG/Twitter.
- Wrong `lang`; weak brand disambiguation vs CandleTest etc. (SXO).
- `/lessons` title is bare `Candelo`.
- Almost no cross-page internal links (no footer legal/about cluster).

---

## Schema — 8/100

**Details:** `findings/schema.md`

- No JSON-LD / Microdata / RDFa on `/`, `/login`, `/lessons`.
- Ready-to-paste `@graph` recommended: Organization, WebSite, WebPage, SoftwareApplication + AggregateOffer (IRR), optional FAQPage for GEO only (Google FAQ rich results retired May 2026).

---

## Performance — 58/100 (lab)

**Details:** `findings/performance.md`  
PSI API 403 — lab Playwright Chrome only.

| Metric | Desktop | Mobile |
|--------|--------:|-------:|
| LCP | ~2880 ms (H1) | ~2860 ms |
| CLS | 0.001 | 0.003 |
| TTFB | ~630 ms | ~978 ms |

Drivers: dual webfont CSS (Vazirmatn + Poppins), large HTML, eNamad third-party hang (~30s observed), heavy JS/CSS. CLS is excellent.

---

## Images — 38/100

**Details:** `findings/images.md`

- 3 `<img>`s with **empty alt**.
- No `og:image`.
- Logo lazy-loaded in header; PNG ~74KB with `max-age=0`.
- Hero is SVG mock — fine for LCP text, but social share needs a dedicated OG asset.

---

## AI Search / GEO — 32/100

**Details:** `findings/geo.md`

- Homepage SSR text is citability-capable (FAQ/pricing).
- Missing: robots policy, sitemap, `llms.txt`, schema, brand entity pages.
- Common Crawl: **domain not found** — young/small footprint.
- Brand query “Candelo” confusable with other products (SXO).

---

## Sitemap — 8/100 · SXO — 46/100 · Visual — 64/100

- Sitemap: only `/` is currently sitemap-worthy; omit `/lessons` until SSR content exists; noindex login + app.
- SXO: page *type* matches SaaS landing SERP intent; loses on depth, trust URLs, pricing URL, brand clarity.
- Visual: strong desktop hero; mobile nav clips «سوالات متداول»; `overflow-hidden` on body hurts full-page scroll; touch targets &lt;44px in places.

Screenshots: `screenshots/candelo_ir_{desktop,mobile,tablet,laptop}.png`

---

## Backlinks

Common Crawl Web Graph: **not in crawl / not in rankings**. No Moz/Bing keys configured. Treat as near-zero measurable referring-domain equity until outreach + directory/enamad citations accumulate.

---

## Synthesis (PERCEIVE → ACT)

**PERCEIVE:** Candelo is a polished Persian SaaS landing with one strong public URL and a gated product behind login.  
**ANALYZE:** Rankings/citations are blocked less by copy quality and more by **missing crawl infrastructure + entity/trust graph + wrong language signal**.  
**VALIDATE:** If robots/sitemap/`lang`/schema/legal pages ship and GSC shows coverage of `/` + new URLs within 2–4 weeks, the diagnosis holds; if not, investigate ArvanCloud soft-404 or host config.  
**ACT:** Phase 1 unlocks crawl/index; Phase 2 unlocks rich results + social; Phase 3 builds topical authority.

---

## Limitations

- No Google API key → no field CWV, no GSC index status, no GA4.
- No Moz/Bing → backlink profile incomplete (CC only).
- Authenticated app UX not SEO-audited (correctly behind login).

Specialist write-ups live in `findings/`.
