import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "../..");
const dbPath = process.env.DB_PATH
  ? path.resolve(projectRoot, process.env.DB_PATH)
  : path.join(projectRoot, "data/stores.db");

export type AppDatabase = DatabaseSync;

let db: AppDatabase | null = null;

export function getDb(): AppDatabase {
  if (!db) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA synchronous = NORMAL;");
  }
  return db;
}

export function initSchema(database: AppDatabase): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS stores (
      id TEXT PRIMARY KEY,
      brand_initial TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      state TEXT NOT NULL,
      city TEXT NOT NULL,
      zipcode TEXT,
      status TEXT NOT NULL,
      type TEXT,
      channel TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_stores_lat_lng
      ON stores (latitude, longitude);

    CREATE INDEX IF NOT EXISTS idx_stores_state ON stores (state);
    CREATE INDEX IF NOT EXISTS idx_stores_brand ON stores (brand_initial);
    CREATE INDEX IF NOT EXISTS idx_stores_status ON stores (status);

    CREATE TABLE IF NOT EXISTS state_stats (
      state TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      centroid_lat REAL NOT NULL,
      centroid_lng REAL NOT NULL
    );
  `);
}
