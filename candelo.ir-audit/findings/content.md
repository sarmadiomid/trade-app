# Content Quality & E-E-A-T — candelo.ir

**Analyzed:** 2026-10-30  
**Primary URL:** https://candelo.ir/  
**Page type:** SaaS marketing homepage (Persian) + near-empty public content graph  
**Evidence:** `render_page` extracted text (~3,386 chars / ~633 Persian tokens), live HTML meta/heading scan, marketing source (`Landing.tsx`), secondary URL probes

---

## Content Quality Score: **41 / 100**

Homepage craft is above “thin landing” (clear value prop, FAQ, pricing, product mechanics), but **site-level** quality is weak: almost no crawlable supporting pages, missing legal/identity trust pages, no entity schema, and elevated expectations for a paid trading-practice product that collects phone numbers (YMYL-adjacent).

| Lens | Score | Notes |
|------|------:|-------|
| Homepage topical coverage | 58 | Meets ~500-word homepage floor; strong product specificity |
| Site content architecture | 18 | Effectively one public content URL |
| E-E-A-T (weighted) | 35 | Trust positives undercut by missing legal/identity |
| AI citation readiness | 32 | FAQ quotable; no schema / entity / topical cluster |

---

## Who / How / Why (helpful-content heuristic)

| Question | Verdict | Evidence |
|----------|---------|----------|
| **Who** created it? | **Fail** | Brand “Candelo” only. No About, team, author, company legal name, or Person/Organization schema beyond footer copyright + eNamad seal. |
| **How** was it created? | **Partial** | Product mechanics explained well (replay, spread, journal, Elo battles). Demo tables/charts labeled sample data. No methodology docs, original research, or content-process disclosure. |
| **Why** does it exist? | **Pass** | People-first pitch: practice without real capital; footer states not investment advice. |

---

## E-E-A-T Breakdown

Weights per Sept 2025 QRG-aligned audit model: Experience 20%, Expertise 25%, Authoritativeness 25%, Trustworthiness 30%.

| Factor | Score | Weighted | Key signals |
|--------|------:|---------:|-------------|
| **Experience** | **40 / 100** | 8.0 | Strong first-hand *product* description (candle-hide replay, SL/TP/spread, auto journal). **Gaps:** no trader case studies, before/after sessions, proprietary performance studies, or named operator experience. Demo PnL labeled sample. |
| **Expertise** | **40 / 100** | 10.0 | Accurate SaaS feature copy; 7 FAQ answers; symbol set named (gold, major FX, Nasdaq). **Gaps:** no expert bylines, credentials, educational depth beyond homepage, methodology / data-source whitepapers. `/lessons` is a client chart shell, not teachable content. |
| **Authoritativeness** | **20 / 100** | 5.0 | Live product + eNamad ID present. **Gaps:** no blog/guides, no external citations, no about/press, no topical cluster, no Organization entity clarity for AI/search. |
| **Trustworthiness** | **40 / 100** | 12.0 | **Positives:** HTTPS + HSTS, eNamad seal, clear “virtual account / not live market / not investment advice,” transparent pricing (free / ۱۹۹٬۰۰۰ / ۳۹۹٬۰۰۰ تومان). **Critical gaps:** `/privacy`, `/terms`, `/about`, `/contact` all **404**; OTP signup implied with no public privacy policy; no public support channel on marketing surface. |
| **Weighted E-E-A-T** | | **35 / 100** | |

### Trust page probe (live)

| Path | Status |
|------|--------|
| `/privacy`, `/terms`, `/about`, `/faq`, `/pricing`, `/blog`, `/contact` | **404** |
| `/robots.txt`, `/sitemap.xml`, `/llms.txt` | **404** |
| `/lessons` | **200**, no usable extracted main content (ChartClient SPA shell) |

Pricing + FAQ exist as homepage anchors (`#pricing`, `#faq`), not standalone indexable pages.

---

## Thin content & coverage

### Homepage
- **~633 Persian tokens** — roughly meets the 500-word homepage *coverage floor* (not a ranking target).
- Structure: 1× H1, 9× H2, 14× H3 — scannable SaaS landing.
- Sections cover: hero value prop, how-it-works, live chart demo, battles/Elo, feature bento, stats/journal, pricing tiers, FAQ (7), CTA.
- Keyword fit (natural): بک‌تست، بازپخش، کندل‌به‌کندل، حساب مجازی، ژورنال، اسپرد — present in title/description/H1/body without stuffing.
- `html lang="en"` while copy is Persian — language/entity mismatch.
- Root layout description is shorter/generic vs page-level marketing description (page metadata is stronger).

### Site-level thinness (primary issue)
- Public marketing corpus ≈ **one URL**.
- No blog, guides, comparison pages, glossary, or help center.
- Auth-gated app (`/home`, `/backtest`, …) cannot substitute for crawlable expertise content.
- `/lessons` returns 200 but contributes **0 extractable educational words** — thin/empty for SEO purposes; risks confusing crawlers if linked without useful SSR text.

### AI / QRG content patterns
- `content_quality.py` on extracted Persian: **0 filler / 0 English AI-pattern hits**; flagged **thin-content** only (script tokenizes Persian poorly — treat density heuristically).
- Copy is product-specific, not generic “digital age” filler. **Not** scored as low-effort scaled AI spam.
- Risk if future blog posts are generated without Experience/Expertise signals.

### Freshness
- `htmldate` detected **2025-03-18**; no visible “last updated” for users.
- Pricing and feature claims can go stale without an update signal.

---

## AI citation readiness: **32 / 100**

| Signal | Status |
|--------|--------|
| Quotable product definitions in FAQ | Present (good extract candidates) |
| Concrete facts (prices, symbols, virtual-only) | Present |
| Heading hierarchy | Good on homepage |
| Answer-first FAQ (`<details>`) | Good UX; weaker without `FAQPage` JSON-LD |
| Organization / SoftwareApplication schema | **Absent** |
| Author / About entity pages | **Absent** |
| `llms.txt` / sitemap / robots | **404** |
| OG / canonical / social previews | **Absent** |
| Topical cluster beyond homepage | **Absent** |
| First-party original research | **Absent** |

Best current citation snippets (if an AI sees the homepage): virtual-only trading practice; candle-by-candle historical replay; mid/pro monthly prices; gold/FX/Nasdaq symbols; Elo battle on shared historical range.

---

## Issues (severity-ordered)

1. **Critical — Missing Privacy / Terms** while collecting mobile OTP and selling subscriptions (Trust + legal).
2. **Critical — No About / contact / company identity** for Who-created-this and Iran e-commerce trust norms (eNamad helps but does not replace About + contact).
3. **High — Single-page public content graph** blocks topical authority and long-tail SEO.
4. **High — No structured data** (Organization, SoftwareApplication, FAQPage).
5. **High — `/lessons` empty of crawlable teaching content** despite educational URL naming.
6. **Medium — `lang="en"` vs Persian content**; no canonical/OG.
7. **Medium — Discovery files missing** (`robots.txt`, `sitemap.xml`, `llms.txt`).
8. **Medium — No Experience artifacts** (real anonymized session stats, methodology, case studies).
9. **Low — No visible last-updated / content changelog** on marketing claims.

---

## Prioritized recommendations

### P0 — Trust foundation (1–2 weeks)
1. Ship **حریم خصوصی** + **قوانین استفاده** (SMS OTP, billing, virtual trading disclaimer, data retention).
2. Ship **درباره ما** with legal entity name, what Candelo is/isn’t, and **تماس / پشتیبانی** (email, ticket, or Telegram).
3. Link all three from the footer next to eNamad; keep the investment-advice disclaimer.

### P1 — Entity + extractability (same sprint)
4. Set `<html lang="fa">` (or `fa-IR`) on marketing layout.
5. Add JSON-LD: `Organization` + `SoftwareApplication` (and `FAQPage` mirroring the 7 FAQs).
6. Add canonical + Open Graph/Twitter for `/`.
7. Publish `robots.txt`, `sitemap.xml` (at least `/`), and a short `llms.txt` pointing to product definition + FAQ.

### P2 — Content depth / Experience (30–60 days)
8. Convert FAQ into a dedicated `/faq` **and** keep homepage accordion (standalone URL for citations).
9. Publish 4–6 Persian guides that only an operator can write well, e.g. «بازپخش کندلی چیست»، «بک‌تست با اسپرد واقعی»، «ژورنال معامله تمرینی»، «نبرد Elo روی تاریخ».
10. Add 1–2 **case studies** with real (permissioned/anonymized) session metrics — biggest Experience lift.
11. Either SSR meaningful lesson intros on `/lessons` or **noindex** it and host education under crawlable URLs.

### P3 — Authority compounding
12. Author bios on any educational URL; consistent Organization NAP/entity.
13. External mentions (fintech/education directories, podcasts) once legal pages exist.
14. Show “به‌روزرسانی: …” on pricing/FAQ when plans change.

---

## Score rationale (summary)

Homepage copy is **competent SaaS marketing** with specific Persian product language, FAQ, and pricing — enough to avoid a pure “doorway thin page” verdict. The **41** overall reflects: weighted E-E-A-T **35**, citation readiness **32**, and a severe **site architecture / trust-page** penalty for a paid, phone-auth, trading-adjacent product with almost no public content beyond `/`.

---

## Machine-readable summary

See `findings/content.json` for merge into `audit-data.json` under category **Content Quality**.
