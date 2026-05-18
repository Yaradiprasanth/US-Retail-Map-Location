import Supercluster from "supercluster";
import type { AppDatabase } from "../db.js";
import { formatCount } from "../format.js";
import { toStateCode } from "../state-codes.js";
import { getZoomTier } from "../zoom.js";
import type {
  ClusterMarker,
  MapDataResponse,
  MapFeature,
  StateMarker,
  StoreMarker,
  ViewportQuery,
} from "../types.js";

type StoreRow = {
  id: string;
  brand_initial: string;
  latitude: number;
  longitude: number;
  state: string;
  city: string;
  status: string;
  type: string;
  channel: string;
};

function buildFilterClause(query: ViewportQuery): {
  sql: string;
  params: Array<string | number>;
} {
  const clauses: string[] = [
    "latitude BETWEEN ? AND ?",
    "longitude BETWEEN ? AND ?",
  ];
  const params: Array<string | number> = [
    query.swLat,
    query.neLat,
    query.swLng,
    query.neLng,
  ];

  if (query.state) {
    clauses.push("state = ?");
    params.push(query.state);
  }
  if (query.brand) {
    clauses.push("brand_initial = ?");
    params.push(query.brand);
  }
  if (query.status) {
    clauses.push("status = ?");
    params.push(query.status);
  }

  return { sql: clauses.join(" AND "), params };
}

function fetchStoresInViewport(
  db: AppDatabase,
  query: ViewportQuery,
  limit = 5000
): StoreRow[] {
  const { sql, params } = buildFilterClause(query);
  return db
    .prepare(
      `SELECT id, brand_initial, latitude, longitude, state, city, status, type, channel
       FROM stores
       WHERE ${sql}
       LIMIT ?`
    )
    .all(...params, limit) as unknown as StoreRow[];
}

function toStoreMarker(row: StoreRow): StoreMarker {
  return {
    kind: "store",
    id: row.id,
    brandInitial: row.brand_initial,
    lat: row.latitude,
    lng: row.longitude,
    state: row.state,
    city: row.city,
    status: row.status,
    type: row.type ?? "",
    channel: row.channel ?? "",
  };
}

function getTier1States(db: AppDatabase, query: ViewportQuery): StateMarker[] {
  const hasStoreFilters = Boolean(query.brand || query.status);

  let rows: Array<{
    state: string;
    count: number;
    centroid_lat: number;
    centroid_lng: number;
  }>;

  if (hasStoreFilters) {
    const { sql, params } = buildFilterClause(query);
    rows = db
      .prepare(
        `SELECT state,
                COUNT(*) AS count,
                AVG(latitude) AS centroid_lat,
                AVG(longitude) AS centroid_lng
         FROM stores
         WHERE ${sql}
         GROUP BY state
         ORDER BY count DESC`
      )
      .all(...params) as typeof rows;
  } else {
    const clauses = [
      "centroid_lat BETWEEN ? AND ?",
      "centroid_lng BETWEEN ? AND ?",
    ];
    const params: Array<string | number> = [
      query.swLat,
      query.neLat,
      query.swLng,
      query.neLng,
    ];
    if (query.state) {
      clauses.push("state = ?");
      params.push(query.state);
    }
    rows = db
      .prepare(
        `SELECT state, count, centroid_lat, centroid_lng
         FROM state_stats
         WHERE ${clauses.join(" AND ")}
         ORDER BY count DESC`
      )
      .all(...params) as typeof rows;
  }

  return rows.map((row) => {
    const stateCode = toStateCode(row.state);
    return {
      kind: "state",
      state: row.state,
      stateCode,
      label: `${stateCode} ${formatCount(row.count)}`,
      count: row.count,
      lat: row.centroid_lat,
      lng: row.centroid_lng,
    };
  });
}

function getTier2Clusters(
  db: AppDatabase,
  query: ViewportQuery
): ClusterMarker[] {
  const stores = fetchStoresInViewport(db, query, 20000);
  const index = new Supercluster({ radius: 60, maxZoom: 16 });

  index.load(
    stores.map((s) => ({
      type: "Feature" as const,
      properties: { storeId: s.id },
      geometry: {
        type: "Point" as const,
        coordinates: [s.longitude, s.latitude],
      },
    }))
  );

  const bbox: [number, number, number, number] = [
    query.swLng,
    query.swLat,
    query.neLng,
    query.neLat,
  ];

  const zoom = Math.floor(query.zoom);
  const clusters = index.getClusters(bbox, zoom);

  type ClusterFeature = {
    geometry: { coordinates: [number, number] };
    properties: {
      cluster?: boolean;
      cluster_id?: number;
      point_count?: number;
    };
  };

  return (clusters as ClusterFeature[]).map((feature) => {
    const [lng, lat] = feature.geometry.coordinates;
    const props = feature.properties;
    const isCluster = Boolean(props.cluster);
    const count = isCluster ? (props.point_count ?? 1) : 1;
    const clusterId = props.cluster_id ?? 0;
    const expansionZoom = isCluster
      ? index.getClusterExpansionZoom(clusterId)
      : zoom + 2;

    return {
      kind: "cluster",
      clusterId,
      count,
      lat,
      lng,
      expansionZoom: Math.min(expansionZoom + 1, 18),
    };
  });
}

function getTier3Stores(db: AppDatabase, query: ViewportQuery): StoreMarker[] {
  return fetchStoresInViewport(db, query, 3000).map(toStoreMarker);
}

export function getMapData(db: AppDatabase, query: ViewportQuery): MapDataResponse {
  const tier = getZoomTier(query.zoom);
  let features: MapFeature[];

  switch (tier) {
    case 1:
      features = getTier1States(db, query);
      break;
    case 2:
      features = getTier2Clusters(db, query);
      break;
    case 3:
      features = getTier3Stores(db, query);
      break;
  }

  return {
    tier,
    features,
    meta: {
      viewport: {
        neLat: query.neLat,
        neLng: query.neLng,
        swLat: query.swLat,
        swLng: query.swLng,
        zoom: query.zoom,
      },
      featureCount: features.length,
    },
  };
}
