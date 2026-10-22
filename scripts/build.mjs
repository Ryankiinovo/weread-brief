import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { parseNotesDir, parseStats, formatMinutes } from "./lib.mjs";
import { renderSite } from "./render.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const notesDir = process.env.WEREAD_DIR || path.join(os.homedir(), "Documents/Obsidian/Ryankiinovo/微信读书/10 Sources/WeRead");
const statsPath = process.env.WEREAD_STATS || path.join(os.homedir(), "Documents/Obsidian/Ryankiinovo/微信读书阅读统计.md");
const dataDir = path.join(root, "data");
const siteDir = path.join(root, "site");
const buildSite = !process.argv.includes("--no-site");

if (!fs.existsSync(notesDir)) {
  console.error("notes directory not found: " + notesDir);
  process.exit(1);
}

const { books, thoughts } = parseNotesDir(notesDir);
const statsText = fs.existsSync(statsPath) ? fs.readFileSync(statsPath, "utf8") : "";
const stats = statsText ? parseStats(statsText) : { updated: "", lifetime: {}, years: [], monthly: [] };

let curation = null;
const curationPath = path.join(root, "config/curation.json");
if (fs.existsSync(curationPath)) {
  curation = new Set(JSON.parse(fs.readFileSync(curationPath, "utf8")).ids || []);
}

const published = curation ? thoughts.filter((t) => curation.has(t.id)) : thoughts;
const sortedThoughts = [...published].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
const totalMinutes = books.reduce((sum, b) => sum + b.readingMinutes, 0);
const totalHighlights = books.reduce((sum, b) => sum + b.highlights, 0);

const payload = {
  meta: {
    generatedAt: new Date().toISOString(),
    source: "微信读书 → Obsidian（obsidian-weread-plugin 同步）",
    statsAsOf: stats.updated,
    books: books.length,
    highlights: totalHighlights,
    thoughtsLocal: thoughts.length,
    thoughtsPublished: published.length,
    readingMinutesLocal: totalMinutes,
    curated: Boolean(curation),
  },
  books,
  thoughts: sortedThoughts,
  stats: {
    lifetime: stats.lifetime,
    years: stats.years,
    monthly: stats.monthly,
  },
};

fs.mkdirSync(dataDir, { recursive: true });
for (const [file, value] of Object.entries({
  "meta.json": payload.meta,
  "books.json": payload.books,
  "thoughts.json": payload.thoughts,
  "stats.json": payload.stats,
})) {
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(value, null, 2) + "\n");
}

if (buildSite) {
  fs.mkdirSync(path.join(siteDir, "assets"), { recursive: true });
  fs.writeFileSync(path.join(siteDir, "index.html"), renderSite(payload));
  console.log("site → site/index.html");
}

console.log(
  [
    "books " + books.length,
    "highlights " + totalHighlights,
    "thoughts " + thoughts.length + " → published " + published.length,
    "local reading " + formatMinutes(totalMinutes),
    "lifetime " + (stats.lifetime.minutes || 0) + " min",
  ].join(" | "),
);
