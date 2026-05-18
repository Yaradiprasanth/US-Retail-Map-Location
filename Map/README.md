# US Retail Locations Map

Interactive map of US retail store locations with zoom-based aggregation, viewport-scoped API responses, server-side clustering, and filters.

## Prerequisites

- **Node.js ≥ 22.5** (uses built-in `node:sqlite`)
- **Google Maps JavaScript API** key with Maps JavaScript API enabled
- **Map ID** from [Google Cloud Console → Map Management](https://console.cloud.google.com/google/maps-apis) (required for Advanced Markers)
- Dataset CSV at `data/stores.csv` (not committed; obtain from the assignment)

## Setup

1. **Clone and configure environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` with your Google Maps key and Map ID (see [Environment variables](#environment-variables)).

2. **Place the dataset**

   Put `stores.csv` at `data/stores.csv`, or set `CSV_PATH` in `.env` to another path.

3. **Install dependencies and import data**

   ```bash
   cd backend
   npm install
   npm run import:csv
   ```

   Import reads the CSV into SQLite (`data/stores.db` by default) and rebuilds state-level aggregates. Re-run after replacing the CSV.

4. **Install frontend dependencies**

   ```bash
   cd ../frontend
   npm install
   ```

## How to run

Use **two terminals** (backend first, then frontend):

```bash
# Terminal 1 — API
cd backend
npm run dev
# → http://localhost:4000

# Terminal 2 — UI
cd frontend
npm run dev
# → http://localhost:5173
```

Open **http://localhost:5173**. Vite proxies `/api` to the backend on port 4000.

**Production-style build**

```bash
cd backend && npm run build && npm start
cd frontend && npm run build && npm run preview
```

**Health check:** `GET http://localhost:4000/health`

## Environment variables

All apps read from a **single root `.env`** (Vite uses `envDir: ".."`, backend loads `../../.env`). Do not commit `.env`.

| Variable | Required | Used by | Description |
|----------|----------|---------|-------------|
| `VITE_GOOGLE_MAPS_API_KEY` | Yes | Frontend | Google Maps JavaScript API key (exposed to browser via Vite) |
| `VITE_GOOGLE_MAP_ID` | Yes | Frontend | Map ID for Advanced Markers |
| `GOOGLE_MAPS_API_KEY` | Optional | Docs / parity | Same key as above; only `VITE_*` is used by the app |
| `PORT` | No | Backend | API port (default `4000`) |
| `DB_PATH` | No | Backend | SQLite file path (default `data/stores.db`) |
| `CSV_PATH` | No | Import script | Path to CSV (default `data/stores.csv`) |

Restrict the API key in Google Cloud (HTTP referrer for localhost, API restrictions to Maps JavaScript API).

## Tech choices

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Backend** | Node.js + Express + TypeScript | Fast to scaffold; familiar HTTP API for viewport queries |
| **Database** | SQLite (`node:sqlite`) | No extra services; single file; indexed `BETWEEN` on lat/lng is fast enough for ~134k rows within the time budget |
| **Clustering** | [Supercluster](https://github.com/mapbox/supercluster) on the **server** | Clustering runs on viewport-filtered data only; client never receives the full dataset |
| **Frontend** | React 18 + Vite + TypeScript | Quick dev loop, typed components |
| **Maps** | Google Maps JS API via [`@vis.gl/react-google-maps`](https://visgl.github.io/react-google-maps/) | Official maps, Advanced Markers, React-friendly bindings |

### Zoom tiers

| Tier | Zoom | What the API returns |
|------|------|----------------------|
| 1 | ≤ 5 | State markers with counts (`TX 11k`) from precomputed `state_stats` |
| 2 | 6–11 | Supercluster groups inside the viewport |
| 3 | ≥ 12 | Individual stores with brand logos (capped at 3000 per request) |

### API surface

| Endpoint | Purpose |
|----------|---------|
| `GET /api/map-data?neLat&neLng&swLat&swLng&zoom` | Viewport + tier-appropriate markers (optional `state`, `brand`, `status`) |
| `GET /api/filters?…` | Distinct filter options, optionally scoped to viewport |
| `GET /health` | Liveness |

Responses include `X-Response-Time-Ms`, `X-Viewport-Tier`, and `X-Feature-Count`. The server logs a warning if a request exceeds 500 ms.

### Client behavior

- Debounced fetch on map `idle` (250 ms)
- In-memory cache: skip refetch when panning inside already-loaded bounds
- `AbortController` cancels stale requests
- Loading, empty viewport, and error states in the UI

## Trade-offs (time limit)

Decisions made to ship a working map within a ~2-hour scope:

| Decision | Trade-off |
|----------|-----------|
| **SQLite + bounding box** instead of PostGIS | Simpler ops and setup; not true spatial indexing. With more time: PostgreSQL + PostGIS + `ST_MakeEnvelope`. |
| **Server-side Supercluster** instead of client MarkerClusterer | Enforces “never send full dataset” and keeps logic in one place; more CPU per Tier 2 request. Mitigated with a 20k store cap per viewport and indexes. |
| **Precomputed `state_stats`** for Tier 1 | O(states) instead of scanning stores at low zoom. State positions are mean lat/lng from data, not official centroids. |
| **Tier 3 cap (3000 stores)** | Dense metros may truncate until the user zooms further. |
| **12 placeholder brand logos** | Brands hash to a small set of PNGs under `frontend/public/logos/`; real per-brand assets would replace these. |
| **No Redis / geohash cache** | Repeated panning in the same area hits SQLite each time; acceptable for the assignment scale. |
| **Minimal test coverage** | Manual verification over E2E tests. |

### If there were more time

- PostGIS or spatialite for proper viewport queries
- Response caching (Redis or in-memory keyed by viewport + filters)
- Per-brand artwork and tooltips with full store metadata
- E2E tests (Playwright) for pan/zoom/filter flows
- Single-command dev script (`concurrently`) and Docker Compose

## Project layout

```
backend/src/          Express API, SQLite, Supercluster
frontend/src/         React map, filters, API client
data/stores.csv       Dataset (gitignored)
data/stores.db        Generated by import (gitignored)
.env                  Local secrets (gitignored)
```

## AI usage

Cursor AI assisted with scaffolding, debugging, and implementation. All code was reviewed and run locally.
