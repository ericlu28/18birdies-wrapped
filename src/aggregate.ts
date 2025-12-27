import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Archive } from "./types.js";
import { aggregateArchive } from "./aggregateCore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const archivePath = path.join(repoRoot, "18Birdies_archive.json");
const outputPath = path.join(repoRoot, "wrappedSummary.json");

const raw = fs.readFileSync(archivePath, "utf8");
const archive = JSON.parse(raw) as Archive;
const summary = aggregateArchive(archive);

fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
process.stdout.write(`Wrote ${outputPath}\n`);

