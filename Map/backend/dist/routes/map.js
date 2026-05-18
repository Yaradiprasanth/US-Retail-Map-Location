import { Router } from "express";
import { getDb } from "../db.js";
import { getMapData } from "../services/map-data.js";
export const mapRouter = Router();
function parseViewportQuery(query, requireZoom = true) {
    const num = (key) => {
        const raw = query[key];
        const value = Array.isArray(raw) ? raw[0] : raw;
        if (value === undefined)
            return NaN;
        return Number(value);
    };
    const viewport = {
        neLat: num("neLat"),
        neLng: num("neLng"),
        swLat: num("swLat"),
        swLng: num("swLng"),
        zoom: requireZoom ? num("zoom") : 4,
        state: typeof query.state === "string" ? query.state : undefined,
        brand: typeof query.brand === "string" ? query.brand : undefined,
        status: typeof query.status === "string" ? query.status : undefined,
    };
    const required = requireZoom
        ? [viewport.neLat, viewport.neLng, viewport.swLat, viewport.swLng, viewport.zoom]
        : [viewport.neLat, viewport.neLng, viewport.swLat, viewport.swLng];
    if (required.some((v) => Number.isNaN(v)))
        return null;
    if (viewport.neLat < viewport.swLat)
        return null;
    return viewport;
}
function queryFiltersInViewport(viewport) {
    const db = getDb();
    const baseWhere = `latitude BETWEEN ? AND ? AND longitude BETWEEN ? AND ?`;
    const baseParams = [viewport.swLat, viewport.neLat, viewport.swLng, viewport.neLng];
    const states = db
        .prepare(`SELECT DISTINCT state FROM stores WHERE ${baseWhere} ORDER BY state`)
        .all(...baseParams);
    const brands = db
        .prepare(`SELECT DISTINCT brand_initial FROM stores WHERE ${baseWhere} ORDER BY brand_initial LIMIT 500`)
        .all(...baseParams);
    const statuses = db
        .prepare(`SELECT DISTINCT status FROM stores WHERE ${baseWhere} ORDER BY status`)
        .all(...baseParams);
    return {
        states: states.map((r) => r.state),
        brands: brands.map((r) => r.brand_initial),
        statuses: statuses.map((r) => r.status),
    };
}
mapRouter.get("/map-data", (req, res) => {
    const viewport = parseViewportQuery(req.query);
    if (!viewport) {
        res.status(400).json({
            error: "Missing or invalid viewport params (neLat, neLng, swLat, swLng, zoom)",
        });
        return;
    }
    const db = getDb();
    const started = Date.now();
    const payload = getMapData(db, viewport);
    res.setHeader("X-Response-Time-Ms", String(Date.now() - started));
    res.setHeader("X-Viewport-Tier", String(payload.tier));
    res.setHeader("X-Feature-Count", String(payload.meta.featureCount));
    res.json(payload);
});
mapRouter.get("/filters", (req, res) => {
    const q = req.query;
    const hasViewport = ["neLat", "neLng", "swLat", "swLng"].every((k) => q[k] !== undefined);
    if (hasViewport) {
        const viewport = parseViewportQuery(q, false);
        if (!viewport) {
            res.status(400).json({ error: "Invalid viewport bounds for filters" });
            return;
        }
        res.json(queryFiltersInViewport(viewport));
        return;
    }
    const db = getDb();
    const states = db.prepare("SELECT DISTINCT state FROM stores ORDER BY state").all();
    const brands = db
        .prepare("SELECT DISTINCT brand_initial FROM stores ORDER BY brand_initial LIMIT 500")
        .all();
    const statuses = db.prepare("SELECT DISTINCT status FROM stores ORDER BY status").all();
    res.json({
        states: states.map((r) => r.state),
        brands: brands.map((r) => r.brand_initial),
        statuses: statuses.map((r) => r.status),
    });
});
