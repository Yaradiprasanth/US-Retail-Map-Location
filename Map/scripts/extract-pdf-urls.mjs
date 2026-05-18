import fs from "node:fs";

const pdfPath = process.argv[2];
const data = fs.readFileSync(pdfPath);
const text = data.toString("latin1");

const httpUrls = [...text.matchAll(/https?:\/\/[^\s\)\>\]<"']+/g)].map((m) => m[0]);
const uriAnnots = [...text.matchAll(/\/URI\s*\(([^)]+)\)/g)].map((m) => m[1]);

console.log("HTTP URLs:");
for (const u of [...new Set(httpUrls)]) console.log(u);

console.log("\nURI annotations:");
for (const u of [...new Set(uriAnnots)]) console.log(u);
