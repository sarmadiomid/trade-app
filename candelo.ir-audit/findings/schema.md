# Schema.org / Structured Data — candelo.ir

**URL audited:** https://candelo.ir/  
**Date:** 2026-10-30  
**Method:** Full HTML fetch (`curl`, ~362 KB SSR/Next marketing HTML) + Microdata/RDFa scan. Playwright render timed out (15s) but server HTML already contains the marketing page. Codebase grep confirmed no `application/ld+json` / `schema.org` emitters.  
**Category score:** **8 / 100**

---

## Executive summary

Candelo ships **zero** Schema.org markup (no JSON-LD, Microdata, or RDFa). The homepage is a Persian SaaS landing page with clear product, pricing (free / ۱۹۹٬۰۰۰ / ۳۹۹٬۰۰۰ تومان ماهانه), FAQ, and org identity — all of which should be expressed as `Organization` + `WebSite` + `SoftwareApplication` + `Offer`/`AggregateOffer`. Implementing the JSON-LD below is the highest-leverage structured-data fix.

---

## Detection results

| Format | Present? | Notes |
|--------|----------|--------|
| JSON-LD (`application/ld+json`) | **No** | 0 blocks on `/`, `/login`, `/lessons` |
| Microdata (`itemscope` / `itemtype`) | **No** | — |
| RDFa (`typeof`) | **No** | — |
| Open Graph / Twitter cards | **No** | Not schema, but related entity signals missing |
| Canonical link | **No** | — |

**Related page meta (not schema):**

- `<title>`: Candelo \| بک‌تست و بازپخش بازار  
- `<meta name="description">`: بازار را کندل‌به‌کندل بازپخش کنید…  
- `<html lang="en">` while copy is Persian — prefer `lang="fa"` and set `inLanguage: "fa-IR"` in JSON-LD  
- Logo available: `https://candelo.ir/logo.png`, `https://candelo.ir/icon.png`

**Secondary URLs:** `/login`, `/lessons` — also no structured data. `/robots.txt`, `/sitemap.xml`, `/llms.txt` return Next 404 shells (`noindex`) — out of scope for schema but blocks discovery of any future markup URLs.

---

## Validation results

| Block | Result |
|-------|--------|
| *(none detected)* | N/A — nothing to validate |

No syntax errors, deprecated types, or placeholder text — because no markup exists.

---

## Findings

### Critical

1. **No structured data on homepage** — Search engines and AI crawlers get no machine-readable entity graph for Candelo as an organization or software product.

### High

2. **Missing `SoftwareApplication`** — Core product (market replay / backtest training SaaS) is a textbook `SoftwareApplication` / `WebApplication` with `offers`.  
3. **Missing `Organization` + `WebSite`** — Brand, logo, and site identity are not linked in a `@graph`.  
4. **Visible pricing without `Offer` / `AggregateOffer`** — Plans: مبتدی رایگان؛ متوسط ۱۹۹٬۰۰۰ تومان/ماه؛ حرفه‌ای ۳۹۹٬۰۰۰ تومان/ماه (yearly = 12× monthly). Markup should mirror the pricing section (`#pricing`).

### Medium

5. **FAQ section (`#faq`, 7 questions) has no markup** — Google retired FAQ rich results for all sites (May 2026). Optional `FAQPage` still helps AI/GEO citation — **Info / optional**, do not prioritize for SERP.  
6. **`inLanguage` / `lang` mismatch** — HTML `lang="en"` vs Persian product; schema should declare `fa-IR`.  
7. **No `sameAs` profiles** — No public social/profile URLs found on the page to attach to `Organization`.

### Low

8. **No `BreadcrumbList`** — Single-page marketing homepage; breadcrumbs matter more on `/lessons` and nested app routes once public.  
9. **No `SearchAction` on `WebSite`** — Site has no public site-search UI; omit until one exists.

---

## Missing opportunities (recommended types)

| Type | Why | Priority |
|------|-----|----------|
| `Organization` | Brand entity, logo, publisher | High |
| `WebSite` | Site node linked to Organization | High |
| `WebPage` | Homepage node | Medium |
| `SoftwareApplication` (also `WebApplication`) | SaaS product definition | High |
| `AggregateOffer` + `Offer` | Free + mid + pro subscriptions | High |
| `FAQPage` | Optional GEO only (no Google FAQ rich result) | Info |
| `BreadcrumbList` | Later, on multi-level public pages | Low |

**Do not use:** `HowTo`, `SpecialAnnouncement`, retired Course/salary video types.

**Currency note:** UI prices are in **تومان**. Schema.org / Google expect ISO 4217. Use **`IRR` (Iranian Rial) = تومان × 10** (e.g. ۱۹۹٬۰۰۰ تومان → `1990000`). Do not invent `IRT` / `TOMAN` codes.

---

## Ready-to-paste JSON-LD (homepage)

Place once in `<head>` (or early `<body>`) of the marketing homepage so it is present in **server-rendered HTML** (prefer SSR over client-only injection for reliable parsing).

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://candelo.ir/#organization",
      "name": "Candelo",
      "url": "https://candelo.ir/",
      "logo": {
        "@type": "ImageObject",
        "url": "https://candelo.ir/logo.png"
      },
      "image": "https://candelo.ir/icon.png",
      "description": "پلتفرم بازپخش و بک‌تست بازار برای تمرین معامله بدون سرمایه واقعی",
      "areaServed": {
        "@type": "Country",
        "name": "Iran"
      }
    },
    {
      "@type": "WebSite",
      "@id": "https://candelo.ir/#website",
      "url": "https://candelo.ir/",
      "name": "Candelo",
      "description": "بازار را کندل‌به‌کندل بازپخش کنید، با حساب مجازی معامله کنید و استراتژی را قبل از ریسک واقعی بسنجید.",
      "inLanguage": "fa-IR",
      "publisher": {
        "@id": "https://candelo.ir/#organization"
      }
    },
    {
      "@type": "WebPage",
      "@id": "https://candelo.ir/#webpage",
      "url": "https://candelo.ir/",
      "name": "Candelo | بک‌تست و بازپخش بازار",
      "isPartOf": {
        "@id": "https://candelo.ir/#website"
      },
      "about": {
        "@id": "https://candelo.ir/#app"
      },
      "description": "بازار را کندل‌به‌کندل بازپخش کنید، با حساب مجازی معامله کنید و استراتژی را قبل از ریسک واقعی بسنجید.",
      "inLanguage": "fa-IR",
      "primaryImageOfPage": {
        "@type": "ImageObject",
        "url": "https://candelo.ir/icon.png"
      }
    },
    {
      "@type": ["SoftwareApplication", "WebApplication"],
      "@id": "https://candelo.ir/#app",
      "name": "Candelo",
      "url": "https://candelo.ir/",
      "applicationCategory": "FinanceApplication",
      "applicationSubCategory": "Trading education / market replay & backtesting",
      "operatingSystem": "Web",
      "browserRequirements": "Requires JavaScript. Modern evergreen browser.",
      "inLanguage": "fa-IR",
      "description": "محیط تمرین معامله به زبان فارسی: بازپخش تاریخی کندل‌به‌کندل، حساب مجازی، ژورنال خودکار، و مسابقه/نبرد روی همان کندل‌ها — بدون ریسک سرمایه واقعی.",
      "featureList": [
        "بازپخش تاریخی بازار",
        "معامله با حساب مجازی",
        "ژورنال و آمار جلسه",
        "مسابقه و نبرد با امتیاز الو",
        "نمادهای طلا، فارکس، کریپتو و شاخص‌ها (بر اساس طرح)"
      ],
      "image": "https://candelo.ir/icon.png",
      "screenshot": "https://candelo.ir/icon.png",
      "publisher": {
        "@id": "https://candelo.ir/#organization"
      },
      "offers": {
        "@type": "AggregateOffer",
        "url": "https://candelo.ir/#pricing",
        "priceCurrency": "IRR",
        "lowPrice": "0",
        "highPrice": "3990000",
        "offerCount": 3,
        "offers": [
          {
            "@type": "Offer",
            "name": "مبتدی",
            "price": "0",
            "priceCurrency": "IRR",
            "availability": "https://schema.org/InStock",
            "url": "https://candelo.ir/login",
            "description": "طرح رایگان: ۲ جلسه بک‌تست، نماد طلا، تاریخ تا یک ماه گذشته"
          },
          {
            "@type": "Offer",
            "name": "متوسط",
            "price": "1990000",
            "priceCurrency": "IRR",
            "unitText": "MONTH",
            "availability": "https://schema.org/InStock",
            "url": "https://candelo.ir/login?next=%2Fhome%2Fcheckout%3Fplan%3Dmid%26cycle%3Dmonth",
            "description": "۱۹۹٬۰۰۰ تومان در ماه (معادل ۱٬۹۹۰٬۰۰۰ ریال). پرداخت سالانه = ۱۲ × ماهانه"
          },
          {
            "@type": "Offer",
            "name": "حرفه‌ای",
            "price": "3990000",
            "priceCurrency": "IRR",
            "unitText": "MONTH",
            "availability": "https://schema.org/InStock",
            "url": "https://candelo.ir/login?next=%2Fhome%2Fcheckout%3Fplan%3Dpro%26cycle%3Dmonth",
            "description": "۳۹۹٬۰۰۰ تومان در ماه (معادل ۳٬۹۹۰٬۰۰۰ ریال). پرداخت سالانه = ۱۲ × ماهانه"
          }
        ]
      }
    }
  ]
}
</script>
```

### Optional: FAQPage (GEO / AI only — no Google FAQ rich result)

Use only if AI citation visibility is a goal. Keep answers identical to on-page FAQ copy.

```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "@id": "https://candelo.ir/#faq",
  "inLanguage": "fa-IR",
  "isPartOf": { "@id": "https://candelo.ir/#webpage" },
  "mainEntity": [
    {
      "@type": "Question",
      "name": "این پلتفرم چیست؟",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Candelo محیط تمرین معامله است: بازار را به گذشته برمی‌گردانید، کندل‌به‌کندل معامله می‌کنید و قبل از ریسک واقعی عملکرد استراتژی را می‌سنجید."
      }
    },
    {
      "@type": "Question",
      "name": "آیا با سرمایه واقعی معامله می‌شود؟",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "خیر. معامله روی حساب مجازی است و برای تمرین و بک‌تست است؛ سرمایه واقعی درگیر نمی‌شود."
      }
    },
    {
      "@type": "Question",
      "name": "هزینه اشتراک چقدر است؟",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "طرح مبتدی رایگان است. طرح متوسط ۱۹۹٬۰۰۰ تومان و طرح حرفه‌ای ۳۹۹٬۰۰۰ تومان در ماه است. پرداخت سالانه برابر همان مبلغ برای دوازده ماه است."
      }
    }
  ]
}
</script>
```

*(Trim or expand `mainEntity` to match all seven on-page FAQ items verbatim before shipping.)*

---

## Implementation notes (Next.js)

1. Prefer a server component / `metadata` + static `<script type="application/ld+json">` in `src/app/(marketing)/layout.tsx` or `page.tsx` so bots see markup without waiting on client JS.  
2. Keep `@id` IRIs stable (`#organization`, `#website`, `#app`).  
3. After launch, validate with [Google Rich Results Test](https://search.google.com/test/rich-results) and Schema.org validator. Expect limited *visual* rich results for `SoftwareApplication`; primary win is entity clarity + AI parsing.  
4. When public social profiles exist, add `sameAs: ["https://…"]` on `Organization`.  
5. Align `<html lang="fa">` with `inLanguage: "fa-IR"`.

---

## Score rationale (8/100)

| Criterion | Points (max) | Earned |
|-----------|--------------|--------|
| Any valid JSON-LD / Microdata / RDFa present | 40 | 0 |
| Organization / WebSite identity | 20 | 0 |
| Product/SoftwareApplication + offers matching visible pricing | 25 | 0 |
| Language / absolute URLs / logo readiness (partial page signals only) | 10 | 5 |
| No invalid/deprecated markup | 5 | 3 |
| **Total** | **100** | **8** |

Partial credit: clear title/description, absolute logo URLs, and accurate on-page pricing copy that make implementing schema straightforward — but **shipped markup score is effectively zero**.

---

## Audit data fragment (for `audit-data.json`)

```json
{
  "category": "Schema / Structured Data",
  "score": 8,
  "weight": 0.10,
  "url": "https://candelo.ir/",
  "detected": {
    "jsonLd": 0,
    "microdata": 0,
    "rdfa": 0
  },
  "validation": [],
  "findings": [
    {
      "severity": "critical",
      "id": "schema-missing-all",
      "title": "No Schema.org markup on homepage",
      "detail": "Zero JSON-LD, Microdata, or RDFa on https://candelo.ir/"
    },
    {
      "severity": "high",
      "id": "schema-missing-softwareapplication",
      "title": "Missing SoftwareApplication",
      "detail": "SaaS market-replay/backtest product has no SoftwareApplication/WebApplication node"
    },
    {
      "severity": "high",
      "id": "schema-missing-organization-website",
      "title": "Missing Organization and WebSite",
      "detail": "No brand/site entity graph; logo at /logo.png unused in structured data"
    },
    {
      "severity": "high",
      "id": "schema-missing-offers",
      "title": "Pricing visible without Offer markup",
      "detail": "Plans: free, 199000 toman/mo mid, 399000 toman/mo pro — recommend AggregateOffer in IRR (×10)"
    },
    {
      "severity": "info",
      "id": "schema-optional-faqpage",
      "title": "FAQ section unmarked (optional FAQPage for GEO)",
      "detail": "7 FAQ items in #faq; Google FAQ rich results retired May 2026 — FAQPage only for AI/GEO"
    }
  ],
  "recommendations": [
    "Organization",
    "WebSite",
    "WebPage",
    "SoftwareApplication",
    "AggregateOffer"
  ]
}
```
