# Sitemap Analysis — candelo.ir

**Date:** 2026-10-30  
**Mode:** Analysis (no live sitemap) + proposed structure  
**Sitemap readiness score: 8/100**

## Current state

| Asset | HTTP | Notes |
|-------|------|-------|
| `/robots.txt` | **404** (HTML Next.js not-found + `noindex`) | Soft 404; crawlers get HTML, not robots directives |
| `/sitemap.xml` | **404** | Same soft-404 pattern |
| `/sitemap_index.xml`, `/sitemaps.xml`, `/sitemap/sitemap.xml` | **404** | No alternates found |
| `/llms.txt` | **404** | Out of scope here; noted for GEO |

Homepage (`/`), `/login`, `/lessons` return **200**. Auth app routes (`/home`, `/backtest`, `/chart`, `/battle`, `/admin`, …) return **307 → `/login?next=…`** when logged out.

There is **no** `robots.txt` Sitemap: line and **no** XML sitemap to validate against crawl inventory.

## Issues (severity)

| Severity | Issue |
|----------|--------|
| Critical | No XML sitemap at any common location |
| Critical | `robots.txt` missing (404 HTML) — no crawl policy, no sitemap pointer |
| High | Soft 404s for robots/sitemap return HTML with `meta robots=noindex` but status 404 — wasteful and confusing for discovery |
| High | Auth/app URLs are crawlable as login redirects; risk of thin/redirect indexing without `noindex` + Disallow |
| Medium | `/lessons` is public 200 but nearly empty SSR shell (client chart) — weak sitemap candidate until contentful |
| Medium | No dedicated public URLs for pricing/about/privacy/blog (pricing is `#pricing` on `/`) |
| Low | No `<lastmod>` strategy exists (nothing to date) |

## Public vs private route policy

### Include in sitemap (indexable public)

| URL | Role | Condition |
|-----|------|-----------|
| `https://candelo.ir/` | Marketing landing (primary) | Always; only strong public URL today |
| Future: `/pricing` | If split from hash | Only when real page with unique content |
| Future: `/about`, `/privacy`, `/terms` | Trust / legal | When published |
| Future: `/blog/*`, `/learn/*` | Educational | Unique 200+ word pages only |
| Future: `/lessons` | Public chart/demo | **Only after** SSR content + unique title/desc; else omit |

### Exclude from sitemap + noindex (private / utility)

| Pattern | Reason |
|---------|--------|
| `/login` | Auth utility; avoid indexing signup UI |
| `/home`, `/home/**` | Auth-gated practice hub, settings, checkout, journal, stats, support |
| `/backtest`, `/backtest/**` | Session/app UI |
| `/chart` | Auth-gated chart |
| `/battle`, `/battle/**` | Auth-gated battles |
| `/admin`, `/admin/**` | Admin |
| `/api/**` | API |
| Query/hash-only variants | Canonical is clean `/` |

**Rule:** Sitemap URLs must be HTTPS, final 200, self-canonical, **not** noindexed, **not** login redirects.

## Proposed `robots.txt`

```txt
User-agent: *
Allow: /
Disallow: /home
Disallow: /backtest
Disallow: /chart
Disallow: /battle
Disallow: /admin
Disallow: /api
Disallow: /login

Sitemap: https://candelo.ir/sitemap.xml
```

Optionally allow AI search bots explicitly (see `geo.md`); do not Disallow them unless product policy requires it.

## Proposed `sitemap.xml` (MVP — current public set)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://candelo.ir/</loc>
    <lastmod>2026-10-30</lastmod>
  </url>
</urlset>
```

Omit `<priority>` / `<changefreq>` (ignored by Google).

### After content expansion

Use a **sitemap index** only if URL count grows large; for Candelo, a single `sitemap-pages.xml` + optional `sitemap-blog.xml` is enough:

```
/sitemap.xml          → index
/sitemap-pages.xml    → /, /pricing, /about, /privacy, /lessons (if indexable)
/sitemap-posts.xml    → /blog/* or /learn/*
```

## Implementation notes (Next.js App Router)

1. Add `src/app/robots.ts` returning Allow/Disallow + Sitemap URL (serve real `text/plain`, not the marketing 404 layout).
2. Add `src/app/sitemap.ts` emitting only public indexable routes.
3. On private layouts (`/home`, `/backtest`, `/battle`, `/admin`, `/login`): set `robots: { index: false, follow: false }` in metadata so redirected/login shells never enter the index even if discovered.
4. Submit `https://candelo.ir/sitemap.xml` in Google Search Console (and Bing) after deploy.
5. Do **not** list `#pricing` / `#faq` fragments — fragments are not sitemap URLs.

## Quality gates before shipping more URLs

- Each new sitemap URL returns 200 without auth.
- Unique title + meta description.
- Prefer SSR text (homepage already strong; `/lessons` currently fails this).
- No duplicate URLs for the same intent as `/` (e.g. thin mirror “feature” pages).

## Top issues (summary)

1. **No sitemap and no robots.txt** — discovery relies on accidental link discovery only.  
2. **Soft-404 HTML** for discovery files.  
3. **App/auth routes** need Disallow + noindex so login redirects do not dilute the index.  
4. **Only `/` is currently sitemap-worthy**; expand after real public pages exist.
