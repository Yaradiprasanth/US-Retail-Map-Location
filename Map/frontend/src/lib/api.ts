import type { FiltersResponse, MapDataResponse, ViewportBounds } from "../types";

export interface MapFetchFilters {
  state?: string;
  brand?: string;
  status?: string;
}

export async function fetchMapData(
  bounds: ViewportBounds,
  filters: MapFetchFilters,
  signal?: AbortSignal
): Promise<MapDataResponse> {
  const params = new URLSearchParams({
    neLat: String(bounds.neLat),
    neLng: String(bounds.neLng),
    swLat: String(bounds.swLat),
    swLng: String(bounds.swLng),
    zoom: String(bounds.zoom),
  });

  if (filters.state) params.set("state", filters.state);
  if (filters.brand) params.set("brand", filters.brand);
  if (filters.status) params.set("status", filters.status);

  const res = await fetch(`/api/map-data?${params}`, { signal });
  if (!res.ok) throw new Error("Failed to load map data");
  return res.json() as Promise<MapDataResponse>;
}

export async function fetchFilters(
  bounds?: ViewportBounds,
  signal?: AbortSignal
): Promise<FiltersResponse> {
  const params = new URLSearchParams();
  if (bounds) {
    params.set("neLat", String(bounds.neLat));
    params.set("neLng", String(bounds.neLng));
    params.set("swLat", String(bounds.swLat));
    params.set("swLng", String(bounds.swLng));
  }

  const qs = params.toString();
  const res = await fetch(qs ? `/api/filters?${qs}` : "/api/filters", { signal });
  if (!res.ok) throw new Error("Failed to load filters");
  return res.json() as Promise<FiltersResponse>;
}
