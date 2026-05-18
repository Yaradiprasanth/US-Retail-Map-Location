import Supercluster from "supercluster";
import { formatCount } from "../format.js";
import { toStateCode } from "../state-codes.js";
import { getZoomTier } from "../zoom.js";
function buildFilterClause(query) {
    const clauses = [
        "latitude BETWEEN ? AND ?",
        "longitude BETWEEN ? AND ?",
    ];
    const params = [
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
function fetchStoresInViewport(db, query, limit = 5000) {
    const { sql, params } = buildFilterClause(query);
    return db
        .prepare(`SELECT id, brand_initial, latitude, longitude, state, city, status, type, channel
       FROM stores
       WHERE ${sql}
       LIMIT ?`)
        .all(...params, limit);
}
function toStoreMarker(row) {
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
function getTier1States(db, query) {
    const hasStoreFilters = Boolean(query.brand || query.status);
    let rows;
    if (hasStoreFilters) {
        const { sql, params } = buildFilterClause(query);
        rows = db
            .prepare(`SELECT state,
                COUNT(*) AS count,
                AVG(latitude) AS centroid_lat,
                AVG(longitude) AS centroid_lng
         FROM stores
         WHERE ${sql}
         GROUP BY state
         ORDER BY count DESC`)
            .all(...params);
    }
    else {
        const clauses = [
            "centroid_lat BETWEEN ? AND ?",
            "centroid_lng BETWEEN ? AND ?",
        ];
        const params = [
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
            .prepare(`SELECT state, count, centroid_lat, centroid_lng
         FROM state_stats
         WHERE ${clauses.join(" AND ")}
         ORDER BY count DESC`)
            .all(...params);
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
function getTier2Clusters(db, query) {
    const stores = fetchStoresInViewport(db, query, 20000);
    const index = new Supercluster({ radius: 60, maxZoom: 16 });
    index.load(stores.map((s) => ({
        type: "Feature",
        properties: { storeId: s.id },
        geometry: {
            type: "Point",
            coordinates: [s.longitude, s.latitude],
        },
    })));
    const bbox = [
        query.swLng,
        query.swLat,
        query.neLng,
        query.neLat,
    ];
    const zoom = Math.floor(query.zoom);
    const clusters = index.getClusters(bbox, zoom);
    return clusters.map((feature) => {
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
function getTier3Stores(db, query) {
    return fetchStoresInViewport(db, query, 3000).map(toStoreMarker);
}
export function getMapData(db, query) {
    const tier = getZoomTier(query.zoom);
    let features;
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
