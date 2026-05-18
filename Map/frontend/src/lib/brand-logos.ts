/** Placeholder logos from /public/logos (see scripts/generate-brand-logos.mjs). */
const LOGO_COUNT = 12;

const logoUrls = Array.from({ length: LOGO_COUNT }, (_, i) => `/logos/brand-${i}.png`);

function hashBrand(brand: string): number {
  let h = 0;
  for (let i = 0; i < brand.length; i++) {
    h = (h * 31 + brand.charCodeAt(i)) >>> 0;
  }
  return h % LOGO_COUNT;
}

/** Map any brand initial / brand_name to one of 12 placeholder PNGs. */
export function getBrandLogo(brandInitial: string): string {
  const key = brandInitial.trim().toUpperCase();
  return logoUrls[hashBrand(key || "?")];
}

export function getBrandLabel(brandInitial: string): string {
  return brandInitial.trim().toUpperCase();
}
