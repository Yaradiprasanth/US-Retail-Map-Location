import type { FiltersResponse } from "../types";

interface Props {
  filters: FiltersResponse | null;
  state: string;
  brand: string;
  status: string;
  tier: number | null;
  featureCount: number;
  loading: boolean;
  fromCache: boolean;
  onChange: (next: { state: string; brand: string; status: string }) => void;
  onClear: () => void;
}

export function FilterSidebar({
  filters,
  state,
  brand,
  status,
  tier,
  featureCount,
  loading,
  fromCache,
  onChange,
  onClear,
}: Props) {
  const hasFilters = Boolean(state || brand || status);

  return (
    <aside className="sidebar">
      <h1>US Retail Map</h1>
      <p className="sidebar-hint">
        Filters apply on the server within the current map viewport.
      </p>

      <label htmlFor="state-filter">State</label>
      <select
        id="state-filter"
        value={state}
        onChange={(e) => onChange({ state: e.target.value, brand, status })}
      >
        <option value="">All states</option>
        {filters?.states.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      <label htmlFor="brand-filter">Brand (initial)</label>
      <input
        id="brand-filter"
        type="text"
        list="brand-options"
        placeholder="e.g. DT, W"
        value={brand}
        onChange={(e) => onChange({ state, brand: e.target.value.toUpperCase(), status })}
      />
      <datalist id="brand-options">
        {filters?.brands.map((b) => (
          <option key={b} value={b} />
        ))}
      </datalist>

      <label htmlFor="status-filter">Status</label>
      <select
        id="status-filter"
        value={status}
        onChange={(e) => onChange({ state, brand, status: e.target.value })}
      >
        <option value="">All statuses</option>
        {filters?.statuses.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>

      {hasFilters && (
        <button type="button" className="clear-filters" onClick={onClear}>
          Clear filters
        </button>
      )}

      <div className="status-bar">
        <div>Tier: {tier ?? "—"}</div>
        <div>Markers in viewport: {featureCount}</div>
        <div>
          {loading ? "Fetching viewport…" : fromCache ? "Cached (no request)" : "Fetched from API"}
        </div>
      </div>
    </aside>
  );
}
