import { useCallback, useEffect, useRef, useState } from "react";
import { FilterSidebar } from "./components/FilterSidebar";
import { MapOverlay } from "./components/MapOverlay";
import { RetailMap } from "./components/RetailMap";
import { fetchFilters } from "./lib/api";
import type { FiltersResponse, MapDataResponse, ViewportBounds } from "./types";

const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const mapId = import.meta.env.VITE_GOOGLE_MAP_ID ?? "DEMO_MAP_ID";

export default function App() {
  const [filters, setFilters] = useState<FiltersResponse | null>(null);
  const [filterState, setFilterState] = useState("");
  const [filterBrand, setFilterBrand] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [mapData, setMapData] = useState<MapDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const viewportRef = useRef<ViewportBounds | null>(null);
  const filterTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    void fetchFilters()
      .then(setFilters)
      .catch(() => setFilters({ states: [], brands: [], statuses: [] }));
  }, []);

  const refreshFiltersForViewport = useCallback((bounds: ViewportBounds) => {
    clearTimeout(filterTimerRef.current);
    filterTimerRef.current = setTimeout(() => {
      void fetchFilters(bounds)
        .then(setFilters)
        .catch(() => {});
    }, 400);
  }, []);

  const handleViewportChange = useCallback(
    (bounds: ViewportBounds) => {
      viewportRef.current = bounds;
      refreshFiltersForViewport(bounds);
    },
    [refreshFiltersForViewport]
  );

  const handleMapData = useCallback(
    (data: MapDataResponse | null, isLoading: boolean, cached = false, err?: string) => {
      setMapData(data);
      setLoading(isLoading);
      setFromCache(cached);
      setError(err ?? null);
    },
    []
  );

  const clearFilters = useCallback(() => {
    setFilterState("");
    setFilterBrand("");
    setFilterStatus("");
  }, []);

  if (!apiKey) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Missing API key</h1>
        <p>
          Copy <code>.env.example</code> to <code>.env</code> and set{" "}
          <code>VITE_GOOGLE_MAPS_API_KEY</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <FilterSidebar
        filters={filters}
        state={filterState}
        brand={filterBrand}
        status={filterStatus}
        tier={mapData?.tier ?? null}
        featureCount={mapData?.features.length ?? 0}
        loading={loading}
        fromCache={fromCache}
        onChange={({ state, brand, status }) => {
          setFilterState(state);
          setFilterBrand(brand);
          setFilterStatus(status);
        }}
        onClear={clearFilters}
      />
      <main className="map-panel">
        {loading && <div className="loading">Loading viewport…</div>}
        {!loading && error && <MapOverlay variant="error" message={error} />}
        {!loading && !error && mapData?.features.length === 0 && (
          <MapOverlay variant="empty" />
        )}
        <RetailMap
          apiKey={apiKey}
          mapId={mapId}
          filterState={filterState}
          filterBrand={filterBrand}
          filterStatus={filterStatus}
          onData={handleMapData}
          onViewportChange={handleViewportChange}
        />
      </main>
    </div>
  );
}
