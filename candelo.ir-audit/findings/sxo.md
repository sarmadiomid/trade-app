# SXO Analysis — https://candelo.ir/

**Date:** 2026-10-30  
**Target keyword (primary):** `بازپخش کندل بک تست` / `بک‌تست فارکس آنلاین` (commercial–investigational)  
**Secondary brand:** `Candelo` / `کندلو`  
**SXO Gap Score: 46/100** (alignment with SERP expectations; separate from technical SEO health)

Data: `render_page.py --mode auto` + `parse_html.py` on `/`; WebSearch SERP samples (not DataForSEO — reduced precision).

## 1. SERP landscape

| Signal | Finding |
|--------|---------|
| Dominant page type | **Landing / Hybrid SaaS product** (~80% consensus) |
| Typical winners | TradeAssay, FX Backtest (`/fa/`), BazTest, Faraz features, EN tools (FXAbsolute, ReplayPip, BacktestFX) |
| Content format | Hero + how-it-works steps + feature deep-dives + pricing/free CTA + long FAQ |
| Depth norm | Long marketing pages with concrete specs (markets count, history depth, order types) |
| Schema / SERP chrome | Product/software positioning; FAQ-rich answers; few classic blog posts in top set |
| Brand SERP | “Candelo بک تست” → **CandleTest / competitors**, not candelo.ir (`site:candelo.ir` empty) |

**SERP consensus:** Users searching these terms expect a **tool/product landing** (or feature page), not a blog essay or pure local service page.

## 2. Page-type alignment

| | |
|--|--|
| Your page type | **Landing Page** (hero CTA, product sections, pricing `#pricing`, FAQ, Enamad) |
| SERP expects | Landing / Hybrid SaaS |
| Verdict | **ALIGNED** (type match) |
| Impact | Type is not the blocker. Gaps are **depth, trust URLs, entity, and competitive proof** vs Persian/EN rivals |

### Residual mismatches

| Issue | Severity | Detail |
|-------|----------|--------|
| Pricing only as `#pricing` | Medium | SERP peers often expose clear pricing or “free forever” in title/URL; no `/pricing` sitelink target |
| `/lessons` public but empty SSR | High (for that URL) | Looks like a tool page in URL; delivers blank crawlable body — wrong experience vs “simulator” SERP intent |
| No comparison / alternatives page | Medium | BazTest-style matrices appear in niche; Candelo has no “vs FX Replay / vs MT5” story |
| No educational hub | Medium | Learning SaaS intent partly served by FAQ only; rivals use feature articles + how-tos |
| `html lang="en"` | Medium | Persian trader personas see English document language |

## 3. User stories (from SERP signals)

1. **As a discretionary FX/gold trader,**  
   I want to **replay history candle-by-candle with SL/TP like a real ticket,**  
   because **I’m tired of blowing accounts on untested setups,**  
   but I’m blocked by **doubt that “demo” tools leak future candles or fake fills.**  
   *Signals: TradeAssay/FX Backtest FAQ themes; “آینده پنهان”, order types.*

2. **As a Persian-speaking learner,**  
   I want a **Farsi UI, Rial pricing, and local support/payment,**  
   because **global tools are awkward to pay for and learn in English,**  
   but I’m blocked by **unknown brands with no trust pages or social proof.**  
   *Signals: BazTest Persian positioning; Candelo Enamad present but no About/Privacy.*

3. **As a prop-challenge aspirant,**  
   I want to **practice daily loss / drawdown rules before paying for a challenge,**  
   because **challenge fees hurt more than practice,**  
   but I’m blocked if the landing **buries prop/session rules or analytics proof.**  
   *Signals: BazTest prop simulator; Candelo mid/pro “جلسه پراپ و آمار”.*

4. **As a skeptic comparing free browser tools,**  
   I want to **start in seconds without install/broker,**  
   because **I will not download Soft4FX/Forex Tester yet,**  
   but I’m blocked by **mandatory signup friction vs one-click free competitors.**  
   *Signals: FXAbsolute “no sign-in”; Candelo OTP registration FAQ.*

5. **As someone searching the brand vaguely,**  
   I want **Candelo the Iranian product,**  
   because **a friend named it,**  
   but I’m blocked when **SERPs show CandleTest crypto backtester instead.**  
   *Signals: branded WebSearch confusion.*

## 4. Gap analysis (SXO Score: 46/100)

| Dimension | Pts | Score | Notes |
|-----------|-----|-------|-------|
| Page type | 0–15 | **12** | Landing matches SERP; missing hybrid educational depth |
| Content depth | 0–15 | **8** | ~1.3k words, 7 FAQs, 3 pricing tiers; thinner market/data specs than TradeAssay/FX Backtest |
| UX signals | 0–15 | **10** | Strong CTAs (“شروع کنید”); pricing on-page; `/lessons` undermines tool expectation |
| Schema markup | 0–15 | **2** | None detected |
| Media richness | 0–15 | **6** | Interactive hero chart; weak alt text; no demo video |
| Authority signals | 0–15 | **4** | Enamad seal; no testimonials, case studies, About, Privacy, press |
| Freshness | 0–10 | **4** | No visible updated date; static marketing |

## 5. Persona scores (trader-learning SaaS landing)

Each persona: Relevance / Clarity / Trust / Action (25 each) → total /100.

### P1 — Persian discretionary backtester
**62/100** (R22 C20 T8 A12)  
Landing speaks replay + virtual account clearly; trust thin (no data-source page, no user proof).  
*Fix:* Add “data & fill rules” section + 1 short case/journal screenshot strip.

### P2 — Absolute beginner learner
**55/100** (R18 C15 T10 A12)  
FAQ helps; no lessons curriculum on marketing surface; `/lessons` empty.  
*Fix:* Public “مسیر یادگیری” with 3 lessons SSR + CTA into app.

### P3 — Prop-firm candidate
**48/100** (R14 C12 T8 A14)  
Prop mentioned in Mid plan bullets; not explained like BazTest prop simulator.  
*Fix:* Dedicated `#prop` or `/prop-practice` with rule examples.

### P4 — Free-tool shopper
**44/100** (R16 C14 T6 A8)  
Free tier exists but OTP gate vs no-login rivals; pricing clarity OK once scrolled.  
*Fix:* Guest demo path or clearer “شروع رایگان بدون کارت” above fold.

### P5 — Brand-referred visitor
**35/100** (R10 C12 T5 A8)  
Brand name in title, but discovery/entity weak; easily confused with CandleTest.  
*Fix:* Title/H1 include «کندلو» + «بدون سرمایه واقعی»; OG image with wordmark; GSC indexing.

### P6 — Mobile-only trader
**58/100** (R18 C16 T10 A14)  
Responsive landing; chart-heavy hero may be dense; OTP fits mobile.  
*Fix:* Compact proof strip + sticky CTA; demo video under 60s.

**Weakest personas first:** P5 brand-referred → P4 free shopper → P3 prop → P2 beginner.

## 6. Priority actions

1. **Keep landing type;** deepen specs (markets, timeframes, order model, fill/gap rules) to match SERP winners.  
2. **Index hygiene:** robots + sitemap for `/`; **noindex** `/login` and auth apps; fix or noindex `/lessons`.  
3. **Trust pack:** `/privacy`, `/terms`, short `/about`, testimonials; keep Enamad.  
4. **Persona gaps:** guest/free demo clarity; prop rules section; SSR learning path.  
5. **Brand disambiguation:** «کندلو (Candelo)» + Persian SaaS phrasing; YouTube demo naming the product.  
6. **Optional later:** comparison page only with real matrices (quality gate — no thin affiliate spam).

## 7. Limitations

- SERP from WebSearch snippets, not full Google IR with ads/PAA/AI Overview capture.  
- Persian Google results may differ by location/login; sample skewed to global + `.com/fa` competitors.  
- No heatmaps/session UX data — UX scores are SERP-relative judgments.  
- SXO score ≠ technical SEO health (crawl 404s covered in `sitemap.md` / technical).

## Cross-skill handoffs

| Finding | Hand off |
|---------|----------|
| Missing robots/sitemap | `sitemap.md` / technical |
| No schema / lang | schema + on-page |
| Thin `/lessons` | page / technical SSR |
| E-E-A-T / trust URLs | content |
| AI citability of FAQ | `geo.md` |
