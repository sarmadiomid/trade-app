# Action Plan — candelo.ir

**Health score today: 39/100**  
**Target after Phase 1–2: ~60–70** (foundations + trust + schema)

Each item includes dependency, effort, and how you’d know it failed.

---

## Phase 1 — Critical fixes (Week 1)

### 1. Ship `robots.txt` + `sitemap.xml`
- **Why:** Soft-404 today; crawlers have no policy or URL list.
- **Depends on:** Nothing.
- **Do:** Next.js `app/robots.ts` + `app/sitemap.ts`.
  - Allow `/`
  - Disallow `/home`, `/backtest`, `/battle`, `/chart`, `/admin`, `/api/`, `/login`
  - Sitemap: only public marketing URLs (start with `/`)
- **Falsify:** `curl -sI https://candelo.ir/robots.txt` is not `200`/`text/plain`, or GSC sitemap stays “Couldn’t fetch”.
- **Effort:** S

### 2. Fix `/lessons` SSR (or noindex until fixed)
- **Why:** `BAILOUT_TO_CLIENT_SIDE_RENDERING` → empty body for crawlers.
- **Depends on:** Product decision (public lessons vs private).
- **Do:** Remove dynamic bailout; SSR lesson list + unique titles. Or `noindex` + remove from sitemap until ready.
- **Falsify:** View-source still shows empty chart shell / bailout template.
- **Effort:** M

### 3. Set `lang="fa"` + `dir="rtl"` on `<html>`
- **Why:** Root layout currently `lang="en"` for Persian product.
- **Depends on:** Nothing (code in `src/app/layout.tsx`).
- **Falsify:** Homepage HTML still has `lang="en"`.
- **Effort:** S

### 4. `noindex` on `/login`
- **Why:** Login (+ `?next=`) is 200 and indexable; wastes crawl / thin SERP risk.
- **Depends on:** robots Disallow can reinforce but meta/X-Robots is clearer for already-discovered URLs.
- **Falsify:** GSC still lists `/login` as indexable after recrawl.
- **Effort:** S

---

## Phase 2 — High-impact (Weeks 2–3)

### 5. Canonical + Open Graph + Twitter + OG image
- **Depends on:** Brand asset 1200×630.
- **Falsify:** Telegram/X preview still shows no image / wrong title.
- **Effort:** S–M

### 6. JSON-LD `@graph` on homepage
- Organization, WebSite, SoftwareApplication, AggregateOffer (IRR). Optional FAQPage for GEO only.
- **Depends on:** Stable pricing + org name/logo URL.
- **Falsify:** Rich Results Test / Schema Validator shows 0 entities.
- **Effort:** M  
- **Snippet:** see `findings/schema.md`

### 7. Privacy + Terms (+ About / contact in footer)
- **Why:** OTP + billing without legal pages tank Trust; required for E-E-A-T.
- **Depends on:** Legal copy.
- **Falsify:** `/privacy` `/terms` still 404 after launch.
- **Effort:** M

### 8. Cache public marketing HTML at CDN
- **Why:** Homepage `no-store` + ArvanCloud BYPASS; ~371KB HTML.
- **Depends on:** Separating session-less marketing route cache from auth HTML.
- **Falsify:** `x-cache` remains BYPASS on anonymous `/` after change.
- **Effort:** M

---

## Phase 3 — Content & authority (Month 2)

### 9. Public pricing URL (not only `#pricing`)
- Helps SXO / commercial queries; add to sitemap.
- **Effort:** S

### 10. 4–6 Persian guides + 1–2 case studies
- Topics: بک‌تست چیست، بازپخش کندل، ژورنال معامله، مدیریت ریسک، مقایسه با دمو بروکر.
- Internal-link from homepage + learn hub.
- **Effort:** L

### 11. Repair `/lessons` as crawlable education hub (if product intent)
- Unique URLs, SSR copy, schema `LearningResource` / `Course` where accurate.
- **Effort:** L

### 12. Brand disambiguation
- About page + consistent NAP/org entity; Wikipedia/social mentions later.
- **Effort:** M

### 13. Image alts + compress logo + self-host critical fonts
- Empty alts today; LCP ~2.9s tied to font CSS.
- **Effort:** S–M

---

## Phase 4 — Monitoring (ongoing)

**Status (2026-10-30):** Live Phase 1–3 verified. Drift baselines captured. Google/Moz/Bing keys still need you.

### 14. Capture drift baseline — DONE
Baselines for `/`, `/pricing`, `/guides`, `/lessons`, `/about`, `/guides/backtest-chist`  
Artifacts: `candelo.ir-audit/phase4/` · DB: `~/.cache/claude-seo/drift/baselines.db`  
Compare: `candelo.ir-audit/phase4/compare.sh`

### 15. Connect Google APIs — WAITING ON KEYS
Copy `phase4/google-api.json.example` → `~/.config/claude-seo/google-api.json`  
Then `/seo google setup` / `google_auth.py --check`. Enables PSI, CrUX, GSC, GA4.

### 16. Optional Moz / Bing — WAITING ON KEYS
Copy `phase4/backlinks-api.json.example` → `~/.config/claude-seo/backlinks-api.json`

### 17. Re-audit in 30 days — SCHEDULED ~2026-11-29
Checklist in `candelo.ir-audit/phase4/MONITORING.md`. Target Health ≥ 60.

---

## Suggested implementation order in this repo

1. `src/app/layout.tsx` — `lang="fa" dir="rtl"`
2. `src/app/robots.ts` + `src/app/sitemap.ts`
3. Login metadata `robots: { index: false }`
4. Marketing metadata — canonical, openGraph, twitter
5. JSON-LD component on `(marketing)/page.tsx`
6. `/privacy`, `/terms`, `/about` marketing routes
7. Fix or noindex `src/app/lessons/page.tsx`

Say if you want Phase 1 implemented in the codebase next.
