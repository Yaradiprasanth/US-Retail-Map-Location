import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "csv-parse";
import dotenv from "dotenv";
import { getDb, initSchema } from "../db.js";

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), "../../../.env") });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultCsv = path.join(__dirname, "../../../data/stores.csv");
const csvPath = process.argv[2] ?? process.env.CSV_PATH ?? defaultCsv;

async function importCsv(): Promise<void> {
  if (!fs.existsSync(csvPath)) {
    console.error(`CSV not found at ${csvPath}`);
    console.error("Place the dataset at data/stores.csv or pass a path: npm run import:csv -- ../path/to/file.csv");
    process.exit(1);
  }

  const db = getDb();
  initSchema(db);

  db.exec("DELETE FROM stores; DELETE FROM state_stats;");

  const insert = db.prepare(`
    INSERT INTO stores (id, brand_initial, latitude, longitude, state, city, zipcode, status, type, channel)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const stateAgg = new Map<string, { count: number; latSum: number; lngSum: number }>();
  let rowCount = 0;

  const parser = fs.createReadStream(csvPath).pipe(
    parse({
      columns: true,
      skip_empty_lines: true,
      trim: true,
    })
  );

  const brandInitial = (row: Record<string, string>) =>
    (row.brand_initial ?? row.brand_name ?? "").trim().toUpperCase();

  const insertMany = (rows: Record<string, string>[]) => {
    db.exec("BEGIN");
    try {
      for (const row of rows) {
        const latitude = Number(row.latitude);
        const longitude = Number(row.longitude);
        if (Number.isNaN(latitude) || Number.isNaN(longitude)) continue;

        const initial = brandInitial(row);
        if (!initial) continue;

        insert.run(
          row.id,
          initial,
          latitude,
          longitude,
          row.state,
          row.city,
          row.zipcode ?? null,
          row.status,
          row.type ?? null,
          row.channel ?? null
        );

        const agg = stateAgg.get(row.state) ?? { count: 0, latSum: 0, lngSum: 0 };
        agg.count += 1;
        agg.latSum += latitude;
        agg.lngSum += longitude;
        stateAgg.set(row.state, agg);
        rowCount += 1;
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  };

  let batch: Record<string, string>[] = [];
  for await (const row of parser) {
    batch.push(row as Record<string, string>);
    if (batch.length >= 2000) {
      insertMany(batch);
      batch = [];
      if (rowCount % 20000 === 0) console.log(`Imported ${rowCount} rows...`);
    }
  }
  if (batch.length) insertMany(batch);

  const insertState = db.prepare(`
    INSERT INTO state_stats (state, count, centroid_lat, centroid_lng)
    VALUES (?, ?, ?, ?)
  `);

  for (const [state, agg] of stateAgg) {
    insertState.run(state, agg.count, agg.latSum / agg.count, agg.lngSum / agg.count);
  }

  console.log(`Done. Imported ${rowCount} stores across ${stateAgg.size} states.`);
}

importCsv().catch((err) => {
  console.error(err);
  process.exit(1);
});
