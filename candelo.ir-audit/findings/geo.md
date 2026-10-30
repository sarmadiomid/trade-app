# GEO / AI Search Readiness — candelo.ir

**Date:** 2026-10-30  
**Primary URL:** https://candelo.ir/  
**GEO readiness score: 32/100**

Frame: Google treats generative AI optimization as **SEO fundamentals** applied to AI surfaces. `llms.txt` is reported for optionality only — **no citation-ranking weight** (Mueller / Illyes / SE Ranking evidence).

## Score breakdown

| Pillar | Weight | Score | Notes |
|--------|--------|-------|-------|
| Citability | 25% | 8/25 | FAQ + pricing facts exist; marketing tone, few sourced stats, weak “X is…” definition block |
| Structural readability | 20% | 12/20 | Clear H1→H2→H3, steps, FAQ `<details>`; no tables; `lang="en"` on Persian page |
| Multi-modal | 15% | 5/15 | Hero chart UI; logo/Enamad only as images; no video / OG media / charts as assets |
| Authority & brand signals | 20% | 2/20 | No author/org schema; `site:candelo.ir` empty; branded search confuses with CandleTest |
| Technical accessibility | 20% | 5/20 | Homepage SSR text OK; robots/sitemap/llms all 404; no JSON-LD |

**Platform snapshot (qualitative):**

| Surface | Est. | Why |
|---------|------|-----|
| Google AI Overviews | Low | Needs classic ranking first; thin entity + no sitemap |
| Google AI Mode | Low–mid | Some FAQ passages citable if discovered; entity weak |
| ChatGPT / Perplexity | Very low | No Wikipedia/Reddit/YouTube brand footprint; competitors dominate Persian/EN answers |

## 1. AI crawler access

| Check | Status |
|-------|--------|
| `robots.txt` | **404** — no explicit Allow/Disallow for GPTBot, OAI-SearchBot, ClaudeBot, PerplexityBot, etc. |
| Default crawl | Missing robots usually means **allow all**, but soft-404 HTML is not a valid robots file |
| Homepage to Googlebot UA | 200; body includes H1/H2/FAQ (SSR-friendly) |
| `/llms.txt` | **404** |
| RSL 1.0 | Not present |

**Recommendation:** Ship a real `robots.txt` that allows search + AI *search* bots; optionally block pure training bots (CCBot, Bytespider) if desired. Point `Sitemap:` at `/sitemap.xml`. Do not rely on `llms.txt` for rankings.

## 2. llms.txt status

**Missing.** Low-cost optionality only — not a citation lever for major AI search as of 2026 evidence.

Suggested draft (optionality):

```txt
# Candelo
> Persian SaaS for candle-by-candle market replay and virtual-account backtesting (practice trading, not live brokerage).

## Primary
- [Home](https://candelo.ir/): Product overview, features, pricing, FAQ

## Key facts
- Practice-only virtual account; no real capital trading
- Plans: free beginner; Mid 199,000 تومان/mo; Pro 399,000 تومان/mo
- Markets: gold, major FX, Nasdaq-style index (per on-site FAQ)
- Auth: mobile OTP login
```

## 3. Passage-level citability

**Present citable-ish blocks (homepage FAQ):**

| Topic | Quality | Gap |
|-------|---------|-----|
| What is Candelo? | Good short definition | Front-load as first 40–60 words of H1 section, not only FAQ |
| Real money? | Clear “no / virtual” | Add explicit risk disclaimer attribution |
| How replay works | Quotable process | Add numbered list length ~134–167 words for AI extract |
| Symbols | Thin list | Expand with counts/timeframes/data source |
| Pricing | Specific Toman figures | Add last-updated date; separate `/pricing` for freshness |

**Weaknesses:** Hero is slogan-led (“معامله با اطمینان…”) not a definition; no unique stats, studies, or third-party sources; no `datePublished` / `dateModified`; zero JSON-LD (`SoftwareApplication`, `Organization`, `FAQPage` — FAQPage optional for commercial caution).

**Target rewrite (example citability block):** open hero with ~150 words: “Candelo is a Persian-language trading practice platform that replays historical candles bar-by-bar on a virtual account so traders can backtest discretionary strategies before risking live capital…” + 2–3 concrete facts (markets, plan prices, OTP auth).

## 4. SSR / JS dependency

| Page | SSR text | AI-crawl note |
|------|----------|----------------|
| `/` | Strong (~1.3k words in raw HTML) | Good |
| `/login` | Thin form copy | Utility; should be noindex |
| `/lessons` | Essentially empty shell | Client chart — **AI crawlers see almost nothing** |

Publication date signal observed in render tooling: ~2025-03-18 — refresh program needed for AI Mode freshness.

## 5. Brand mentions approach

| Channel | Observed | Action |
|---------|----------|--------|
| Google `site:candelo.ir` | No results in this audit’s search | Fix crawl/index basics first (robots + sitemap + GSC) |
| Branded “Candelo بک تست” | Surfaces **CandleTest** / TradeAssay, not candelo.ir | Strengthen brand string “کندلو / Candelo” + `.ir` in titles; avoid generic “candle test” English alone |
| Wikipedia / Wikidata | None expected | Premature until notable coverage |
| YouTube | None found in branded SERP | Highest-correlation AI mention channel — Persian demo: replay, journal, battle |
| Reddit / forums / Telegram trading communities | Not evidenced | Seed honest demos/comparisons (BazTest, TradeAssay, FX Backtest) without spam |
| LinkedIn / Aparat | Unknown | Org page + founder/expert explainers |

**Priority order for AI visibility:** (1) indexable SSR pages that rank, (2) YouTube demos naming Candelo, (3) community Q&A mentions, (4) optional `llms.txt`, (5) Wikipedia only if earned.

## 6. Schema for AI discoverability

Implement when content is stable:

- `Organization` + `WebSite` (name Candelo / کندلو, `url`, `logo`, `sameAs` when profiles exist)
- `SoftwareApplication` (applicationCategory Educational/Finance, offers for Mid/Pro, `inLanguage`: `fa`)
- FAQ answers already on-page — prefer visible FAQ; add FAQ schema only if policy allows for commercial pages
- Fix root `html lang` from `en` → `fa` (entity/language signal)

## Top 5 highest-impact changes

1. Real **`robots.txt` + `sitemap.xml`** so AI/search systems can discover `/`.  
2. **Front-load a 134–167 word definition + facts** above the fold; keep FAQ.  
3. **`SoftwareApplication` / `Organization` JSON-LD** + `lang="fa"`.  
4. **Brand mention program** (YouTube + Persian trader communities); disambiguate from CandleTest.  
5. Either **SSR `/lessons`** as a public demo explainer or **noindex** it — empty shells hurt citability if crawled.

## Limitations

- No DataForSEO AI-mention scrape in this pass.  
- Brand/social presence inferred from WebSearch, not full mention databases.  
- `llms.txt` scored as presence/optionality only, not ranking.
