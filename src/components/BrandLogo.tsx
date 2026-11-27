import { BRAND } from '@/config/app';

/** RDV monogram: ink navy (same as our buttons) in light mode, gold in dark mode. */
export function BrandLogo({ className = '' }: { className?: string }) {
  return (
    <>
      <img src={BRAND.logoNavy} alt="" className={`${className} dark:hidden`} />
      <img src={BRAND.logo} alt="" className={`${className} hidden dark:block`} />
    </>
  );
}
