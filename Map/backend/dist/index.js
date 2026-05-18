import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getDb, initSchema } from "./db.js";
import { mapRouter } from "./routes/map.js";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../../.env") });
const app = express();
const port = Number(process.env.PORT ?? 4000);
app.use(cors());
app.use(express.json());
const db = getDb();
initSchema(db);
app.get("/health", (_req, res) => {
    res.json({ ok: true });
});
app.use("/api", mapRouter);
const server = app.listen(port, () => {
    console.log(`API listening on http://localhost:${port}`);
});
server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Stop the other backend (Ctrl+C) or run:\n` +
            `  netstat -ano | findstr :${port}\n` +
            `  taskkill /PID <pid> /F`);
        process.exit(1);
    }
    throw err;
});
