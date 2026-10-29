import Image from 'next/image';

export const BRAND_FA = 'کندلو';
export const BRAND_EN = 'Candelo';

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <Image src="/logo.png" alt="" width={size} height={size} aria-hidden className="shrink-0" />
  );
}

export function BrandName({ className = '' }: { readonly className?: string }) {
  return (
    <span dir="ltr" className={className ? `font-candelo ${className}` : 'font-candelo'}>
      {BRAND_EN}
    </span>
  );
}

export function Logo() {
  return (
    <span className="flex items-center gap-2.5">
      <LogoMark />
      <span className="flex flex-col leading-none">
        <BrandName className="text-[19px] font-bold tracking-tight" />
        <span className="mt-1 hidden text-[11px] font-medium text-[var(--mk-muted)] sm:block">
          {BRAND_FA}
        </span>
      </span>
    </span>
  );
}
