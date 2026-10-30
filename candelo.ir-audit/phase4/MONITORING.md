# Phase 4 — Monitoring (candelo.ir)

**Baseline date:** 2026-10-30  
**Live verify:** Phase 1–3 confirmed on production (see `live-verify.json`)  
**Drift DB:** `~/.cache/claude-seo/drift/baselines.db`

---

## 14. Drift baselines (done)

Captured with CWV skipped (no Google API key yet):

| URL | Artifact |
|-----|----------|
| `/` | `baseline-home.json` |
| `/pricing` | `baseline-pricing.json` |
| `/guides` | `baseline-guides.json` |
| `/lessons` | `baseline-lessons.json` |
| `/about` | `baseline-about.json` |
| `/guides/backtest-chist` | `baseline-guides_backtest-chist.json` |

### Compare later

```bash
SEO_PY=~/.claude/skills/seo/.venv/bin/python
SCRIPTS=~/.claude/skills/seo/scripts

$SEO_PY $SCRIPTS/drift_compare.py https://candelo.ir/
$SEO_PY $SCRIPTS/drift_history.py https://candelo.ir/
```

Suggested cadence: weekly after content deploys; otherwise monthly.

---

## 15. Google APIs (needs your keys)

No credentials on this machine yet (`google_auth.py --check` → tier -1).

### Minimum (free API key) — PSI + CrUX

1. Create a project at [Google Cloud Console](https://console.cloud.google.com)
2. Enable **PageSpeed Insights API** and **Chrome UX Report API**
3. Create an **API key**, restrict to those APIs
4. Save config:

```bash
mkdir -p ~/.config/claude-seo
cp candelo.ir-audit/phase4/google-api.json.example ~/.config/claude-seo/google-api.json
# edit and paste api_key
```

5. Verify: `python ~/.claude/skills/seo/scripts/google_auth.py --check`
6. Re-baseline with CWV:  
   `python ~/.claude/skills/seo/scripts/drift_baseline.py https://candelo.ir/`

### Full (service account) — GSC + Indexing + GA4

1. Create service account JSON → `~/.config/claude-seo/service_account.json`
2. Add `client_email` to Search Console property `sc-domain:candelo.ir` (or URL prefix) as Full/Owner
3. Add same email to GA4 as Viewer; set `ga4_property_id`
4. Fill `service_account_path`, `default_property`, `ga4_property_id` in `google-api.json`
5. In GSC: submit `https://candelo.ir/sitemap.xml` if not already

Env alternatives: `GOOGLE_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `GSC_PROPERTY`, `GA4_PROPERTY_ID`.

---

## 16. Moz / Bing (optional)

```bash
cp candelo.ir-audit/phase4/backlinks-api.json.example ~/.config/claude-seo/backlinks-api.json
```

| Source | Signup | Env |
|--------|--------|-----|
| Moz Link Explorer (free tier) | https://moz.com/products/api | `MOZ_API_KEY` |
| Bing Webmaster | https://www.bing.com/webmasters | `BING_WEBMASTER_API_KEY` |

Then: `python ~/.claude/skills/seo/scripts/backlinks_auth.py --check`  
And: `/seo backlinks https://candelo.ir`

Common Crawl already runs without keys (domain may still be absent while young).

---

## 17. 30-day re-audit checklist

**Target date:** ~2026-11-29  
**Score target:** Health ≥ 60 (was 39 pre Phase 1–3)

### Pre-checks
- [ ] GSC shows sitemap success; sample URLs indexed (`/`, `/pricing`, `/guides/*`, `/lessons`)
- [ ] `/login` and `/lessons/studio` stay **excluded** / noindex
- [ ] `lang=fa`, canonical, OG, JSON-LD still present on homepage
- [ ] Drift compare on `/` shows only intentional changes

### Commands

```bash
# In Cursor chat:
/seo audit https://candelo.ir

# Or drift-only:
python ~/.claude/skills/seo/scripts/drift_compare.py https://candelo.ir/
python ~/.claude/skills/seo/scripts/drift_compare.py https://candelo.ir/pricing
```

### Watch metrics (once Google connected)
- CrUX LCP / INP / CLS for candelo.ir
- GSC clicks/impressions for brand + «بک‌تست» style queries
- Coverage: valid vs excluded for new guide URLs

### Product follow-ups (not blocking monitoring)
- [ ] Public `/llms.txt` (GEO nicety)
- [ ] More guides / real case studies with screenshots
- [ ] Interactive lessons when product-ready (SSR content, not only studio)

---

## Live verify snapshot (2026-10-30)

| Path | Status | Notes |
|------|--------|--------|
| `/robots.txt` | 200 text/plain | Allows marketing; disallows app + studio |
| `/sitemap.xml` | 200 XML | Home, pricing, lessons, guides, articles |
| `/` | 200 | `lang=fa`, index, canonical, JSON-LD, OG |
| `/pricing` `/guides` `/lessons` | 200 | Canonical + OG |
| `/login` | 200 | **noindex, nofollow** |
| `/lessons/studio` | 200 | **noindex, nofollow** |
