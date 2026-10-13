import './marketing.css';

const VAZIRMATN = 'https://cdn.jsdelivr.net/gh/rastikerdar/vazirmatn@v33.003/Vazirmatn-font-face.css';

export default function MarketingLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div lang="fa" dir="rtl" className="mk-root h-full overflow-y-auto overflow-x-hidden scroll-smooth">
      <link rel="stylesheet" href={VAZIRMATN} precedence="default" />
      {children}
    </div>
  );
}
