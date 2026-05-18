import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AdvancedMarker,
  APIProvider,
  InfoWindow,
  Map,
  useMap,
} from "@vis.gl/react-google-maps";
import { fetchMapData } from "../lib/api";
import { canReuseCache, roundBounds } from "../lib/cache";
import { getBrandLogo } from "../lib/brand-logos";
import type {
  ClusterMarker,
  MapDataResponse,
  MapFeature,
  StateMarker,
  StoreMarker,
  ViewportBounds,
  ZoomTier,
} from "../types";

const US_CENTER = { lat: 39.8283, lng: -98.5795 };
const DEBOUNCE_MS = 250;

const TIER_LABELS: Record<ZoomTier, string> = {
  1: "Country — state totals",
  2: "Regional — store clusters",
  3: "Street — individual store markers (clickable for details)",
};

type ViewportCache = {
  bounds: ViewportBounds;
  filters: { state: string; brand: string; status: string };
  data: MapDataResponse;
};

function formatCount(count: number): string {
  if (count >= 1000) {
    const k = count / 1000;
    return k >= 10 ? `${Math.round(k)}k` : `${k.toFixed(1)}k`;
  }
  return String(count);
}

function formatAddress(store: StoreMarker): string {
  const city = store.city.replace(/\b\w/g, (c) => c.toUpperCase());
  const state = store.state.replace(/\b\w/g, (c) => c.toUpperCase());
  return `${city}, ${state}`;
}

interface MapControllerProps {
  filterState: string;
  filterBrand: string;
  filterStatus: string;
  onData: (
    data: MapDataResponse | null,
    loading: boolean,
    fromCache?: boolean,
    error?: string
  ) => void;
  onViewportChange: (bounds: ViewportBounds) => void;
}

function MapController({
  filterState,
  filterBrand,
  filterStatus,
  onData,
  onViewportChange,
}: MapControllerProps) {
  const map = useMap();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<ViewportCache | null>(null);
  const [features, setFeatures] = useState<MapFeature[]>([]);
  const [tier, setTier] = useState<ZoomTier | null>(null);

  const [selectedStore, setSelectedStore] = useState<StoreMarker | null>(null);

  const filters = useMemo(
    () => ({
      state: filterState,
      brand: filterBrand,
      status: filterStatus,
    }),
    [filterState, filterBrand, filterStatus]
  );

  const applyData = useCallback(
    (data: MapDataResponse, fromCache = false) => {
      setTier(data.tier);
      setFeatures(data.features);
      if (data.tier !== 3) setSelectedStore(null);
      onData(data, false, fromCache, undefined);
    },
    [onData]
  );

  const zoomTo = useCallback(
    (lat: number, lng: number, zoom: number) => {
      if (!map) return;
      map.panTo({ lat, lng });
      map.setZoom(zoom);
    },
    [map]
  );

  const onStateClick = useCallback(
    (state: StateMarker) => zoomTo(state.lat, state.lng, 7),
    [zoomTo]
  );

  const onClusterClick = useCallback(
    (cluster: ClusterMarker) => zoomTo(cluster.lat, cluster.lng, cluster.expansionZoom),
    [zoomTo]
  );

  const loadViewport = useCallback(async () => {
    if (!map) return;
    const bounds = map.getBounds();
    if (!bounds) return;

    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const viewport: ViewportBounds = {
      neLat: ne.lat(),
      neLng: ne.lng(),
      swLat: sw.lat(),
      swLng: sw.lng(),
      zoom: map.getZoom() ?? 4,
    };

    onViewportChange(viewport);

    if (
      cacheRef.current &&
      canReuseCache(viewport, cacheRef.current.bounds, filters, cacheRef.current.filters)
    ) {
      applyData(cacheRef.current.data, true);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    onData(null, true);
    try {
      const data = await fetchMapData(
        viewport,
        {
          state: filterState || undefined,
          brand: filterBrand || undefined,
          status: filterStatus || undefined,
        },
        controller.signal
      );

      if (controller.signal.aborted) return;

      cacheRef.current = {
        bounds: roundBounds(viewport),
        filters: { ...filters },
        data,
      };
      applyData(data, false);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setFeatures([]);
      setTier(null);
      onData(null, false, false, "Failed to load viewport data. Is the API running?");
    }
  }, [
    map,
    filterState,
    filterBrand,
    filterStatus,
    filters,
    onData,
    applyData,
    onViewportChange,
  ]);

  useEffect(() => {
    if (!map) return;

    const scheduleLoad = () => {
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        void loadViewport();
      }, DEBOUNCE_MS);
    };

    const idleListener = map.addListener("idle", scheduleLoad);
    scheduleLoad();

    return () => {
      clearTimeout(timerRef.current);
      abortRef.current?.abort();
      google.maps.event.removeListener(idleListener);
    };
  }, [map, loadViewport]);

  useEffect(() => {
    cacheRef.current = null;
    void loadViewport();
  }, [filterState, filterBrand, filterStatus, loadViewport]);

  return (
    <>
      {tier !== null && (
        <div className="tier-badge">
          Tier {tier}: {TIER_LABELS[tier]}
        </div>
      )}

      {features.map((feature) => {
        if (feature.kind === "state") {
          return (
            <AdvancedMarker
              key={`state-${feature.state}`}
              position={{ lat: feature.lat, lng: feature.lng }}
              onClick={() => onStateClick(feature)}
              title={`${feature.label} — click to zoom in`}
            >
              <div className="marker state-marker">{feature.label}</div>
            </AdvancedMarker>
          );
        }

        if (feature.kind === "cluster") {
          return (
            <AdvancedMarker
              key={`cluster-${feature.clusterId}-${feature.lat}-${feature.lng}`}
              position={{ lat: feature.lat, lng: feature.lng }}
              onClick={() => onClusterClick(feature)}
              title={`${feature.count} stores — click to expand`}
            >
              <div className="marker cluster-marker">{formatCount(feature.count)}</div>
            </AdvancedMarker>
          );
        }

        const logo = getBrandLogo(feature.brandInitial);
        return (
          <AdvancedMarker
            key={`store-${feature.id}`}
            position={{ lat: feature.lat, lng: feature.lng }}
            onClick={() => setSelectedStore(feature)}
            title={feature.brandInitial}
          >
            <img
              src={logo}
              alt={feature.brandInitial}
              className="brand-logo"
              width={28}
              height={28}
            />
          </AdvancedMarker>
        );
      })}

      {selectedStore && (
        <InfoWindow
          position={{ lat: selectedStore.lat, lng: selectedStore.lng }}
          onCloseClick={() => setSelectedStore(null)}
        >
          <div className="info-window">
            <strong>Brand: {selectedStore.brandInitial}</strong>
            <div>{formatAddress(selectedStore)}</div>
            <div>Status: {selectedStore.status}</div>
            <div>Type: {selectedStore.type || "—"}</div>
            {selectedStore.channel ? <div>Channel: {selectedStore.channel}</div> : null}
          </div>
        </InfoWindow>
      )}
    </>
  );
}

interface RetailMapProps {
  apiKey: string;
  mapId: string;
  filterState: string;
  filterBrand: string;
  filterStatus: string;
  onData: (
    data: MapDataResponse | null,
    loading: boolean,
    fromCache?: boolean,
    error?: string
  ) => void;
  onViewportChange: (bounds: ViewportBounds) => void;
}

export function RetailMap({
  apiKey,
  mapId,
  filterState,
  filterBrand,
  filterStatus,
  onData,
  onViewportChange,
}: RetailMapProps) {
  return (
    <APIProvider apiKey={apiKey} libraries={["marker"]}>
      <Map
        defaultCenter={US_CENTER}
        defaultZoom={4}
        mapId={mapId}
        gestureHandling="greedy"
        disableDefaultUI={false}
        style={{ width: "100%", height: "100%" }}
        minZoom={3}
        maxZoom={18}
      >
        <MapController
          filterState={filterState}
          filterBrand={filterBrand}
          filterStatus={filterStatus}
          onData={onData}
          onViewportChange={onViewportChange}
        />
      </Map>
    </APIProvider>
  );
}
