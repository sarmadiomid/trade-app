import { MID_TOMAN, PRO_TOMAN } from '@/components/billing/plans';
import { SITE_DESCRIPTION, SITE_TITLE, SITE_URL, absoluteUrl } from '@/lib/seo/site';

/** تومان → IRR (ریال) for Schema.org ISO 4217. */
const tomanToIrr = (toman: number) => String(toman * 10);

/** Homepage JSON-LD graph: Organization, WebSite, WebPage, SoftwareApplication. */
export function HomeJsonLd() {
  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${SITE_URL}/#organization`,
        name: 'Candelo',
        alternateName: 'کندلو',
        url: absoluteUrl('/'),
        logo: {
          '@type': 'ImageObject',
          url: absoluteUrl('/logo.png'),
        },
        image: absoluteUrl('/og.png'),
        description: 'پلتفرم بازپخش و بک‌تست بازار برای تمرین معامله بدون سرمایه واقعی',
        email: 'support@candelo.ir',
        areaServed: { '@type': 'Country', name: 'Iran' },
      },
      {
        '@type': 'WebSite',
        '@id': `${SITE_URL}/#website`,
        url: absoluteUrl('/'),
        name: 'Candelo',
        description: SITE_DESCRIPTION,
        inLanguage: 'fa-IR',
        publisher: { '@id': `${SITE_URL}/#organization` },
      },
      {
        '@type': 'WebPage',
        '@id': `${SITE_URL}/#webpage`,
        url: absoluteUrl('/'),
        name: SITE_TITLE,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        about: { '@id': `${SITE_URL}/#app` },
        description: SITE_DESCRIPTION,
        inLanguage: 'fa-IR',
        primaryImageOfPage: {
          '@type': 'ImageObject',
          url: absoluteUrl('/og.png'),
        },
      },
      {
        '@type': ['SoftwareApplication', 'WebApplication'],
        '@id': `${SITE_URL}/#app`,
        name: 'Candelo',
        url: absoluteUrl('/'),
        applicationCategory: 'FinanceApplication',
        applicationSubCategory: 'Trading education / market replay & backtesting',
        operatingSystem: 'Web',
        browserRequirements: 'Requires JavaScript. Modern evergreen browser.',
        inLanguage: 'fa-IR',
        description:
          'محیط تمرین معامله به زبان فارسی: بازپخش تاریخی کندل‌به‌کندل، حساب مجازی، ژورنال خودکار، و مسابقه/نبرد — بدون ریسک سرمایه واقعی.',
        featureList: [
          'بازپخش تاریخی بازار',
          'معامله با حساب مجازی',
          'ژورنال و آمار جلسه',
          'مسابقه و نبرد با امتیاز الو',
          'نمادهای طلا، فارکس، کریپتو و شاخص‌ها (بر اساس طرح)',
        ],
        image: absoluteUrl('/og.png'),
        screenshot: absoluteUrl('/og.png'),
        publisher: { '@id': `${SITE_URL}/#organization` },
        offers: {
          '@type': 'AggregateOffer',
          url: absoluteUrl('/pricing'),
          priceCurrency: 'IRR',
          lowPrice: '0',
          highPrice: tomanToIrr(PRO_TOMAN),
          offerCount: 3,
          offers: [
            {
              '@type': 'Offer',
              name: 'مبتدی',
              price: '0',
              priceCurrency: 'IRR',
              availability: 'https://schema.org/InStock',
              url: absoluteUrl('/login'),
              description: 'طرح رایگان: ۲ جلسه بک‌تست، نماد طلا، تاریخ تا یک ماه گذشته',
            },
            {
              '@type': 'Offer',
              name: 'متوسط',
              price: tomanToIrr(MID_TOMAN),
              priceCurrency: 'IRR',
              unitText: 'MONTH',
              availability: 'https://schema.org/InStock',
              url: absoluteUrl('/login?next=%2Fhome%2Fcheckout%3Fplan%3Dmid%26cycle%3Dmonth'),
              description: `${MID_TOMAN.toLocaleString('fa-IR')} تومان در ماه`,
            },
            {
              '@type': 'Offer',
              name: 'حرفه‌ای',
              price: tomanToIrr(PRO_TOMAN),
              priceCurrency: 'IRR',
              unitText: 'MONTH',
              availability: 'https://schema.org/InStock',
              url: absoluteUrl('/login?next=%2Fhome%2Fcheckout%3Fplan%3Dpro%26cycle%3Dmonth'),
              description: `${PRO_TOMAN.toLocaleString('fa-IR')} تومان در ماه`,
            },
          ],
        },
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }}
    />
  );
}
