import type { ViewportBounds } from "../types";

export function getTierBucket(zoom: number): number {
  if (zoom <= 5) return 1;
  if (zoom <= 11) return 2;
  return 3;
}

export function filtersKey(filters: Record<string, string>): string {
  return JSON.stringify({
    state: filters.state ?? "",
    brand: filters.brand ?? "",
    status: filters.status ?? "",
  });
}

/** Round bounds so nearby requests share cache keys when storing responses. */
export function roundBounds(bounds: ViewportBounds): ViewportBounds {
  const round = (n: number, digits: number) => Number(n.toFixed(digits));
  return {
    neLat: round(bounds.neLat, 2),
    neLng: round(bounds.neLng, 2),
    swLat: round(bounds.swLat, 2),
    swLng: round(bounds.swLng, 2),
    zoom: bounds.zoom,
  };
}

/** Current viewport is fully inside a previously fetched viewport (same tier + filters). */
export function canReuseCache(
  current: ViewportBounds,
  cached: ViewportBounds,
  filters: Record<string, string>,
  cachedFilters: Record<string, string>
): boolean {
  if (filtersKey(filters) !== filtersKey(cachedFilters)) return false;
  if (getTierBucket(current.zoom) !== getTierBucket(cached.zoom)) return false;

  return (
    current.neLat <= cached.neLat &&
    current.neLng <= cached.neLng &&
    current.swLat >= cached.swLat &&
    current.swLng >= cached.swLng
  );
}
