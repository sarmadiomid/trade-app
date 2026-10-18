export const BRAND_FA = 'چارتیکس';
export const BRAND_EN = 'Chartix';

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id="lg-mark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#5aa2ff" />
          <stop offset="1" stopColor="#1640c9" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#lg-mark)" />
      <rect x="0.5" y="0.5" width="39" height="39" rx="10.5" fill="none" stroke="#fff" strokeOpacity=".22" />
      <path d="M12 12v16M20 9v22M28 15v12" stroke="#cfe2ff" strokeOpacity=".55" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="9.5" y="16" width="5" height="8" rx="1.4" fill="#fff" />
      <rect x="17.5" y="12" width="5" height="12" rx="1.4" fill="#fff" />
      <rect x="25.5" y="18" width="5" height="6" rx="1.4" fill="#fff" fillOpacity=".85" />
      <path d="M8 30L16 24l6 3 10-10" stroke="#38d3ff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <span className="text-[19px] font-extrabold tracking-tight">{BRAND_FA}</span>
        <span className="mt-1 hidden text-[10px] font-medium tracking-[0.28em] text-[var(--mk-muted)] sm:block" dir="ltr">
          {BRAND_EN.toUpperCase()}
        </span>
      </span>
    </span>
  );
}
