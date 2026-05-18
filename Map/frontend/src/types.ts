export type ZoomTier = 1 | 2 | 3;

export interface StateMarker {
  kind: "state";
  state: string;
  stateCode: string;
  label: string;
  count: number;
  lat: number;
  lng: number;
}

export interface ClusterMarker {
  kind: "cluster";
  clusterId: number;
  count: number;
  lat: number;
  lng: number;
  expansionZoom: number;
}

export interface StoreMarker {
  kind: "store";
  id: string;
  brandInitial: string;
  lat: number;
  lng: number;
  state: string;
  city: string;
  status: string;
  type: string;
  channel: string;
}

export type MapFeature = StateMarker | ClusterMarker | StoreMarker;

export interface ViewportMeta {
  neLat: number;
  neLng: number;
  swLat: number;
  swLng: number;
  zoom: number;
}

export interface MapDataResponse {
  tier: ZoomTier;
  features: MapFeature[];
  meta: {
    viewport: ViewportMeta;
    featureCount: number;
  };
}

export interface FiltersResponse {
  states: string[];
  brands: string[];
  statuses: string[];
}

export interface ViewportBounds {
  neLat: number;
  neLng: number;
  swLat: number;
  swLng: number;
  zoom: number;
}
