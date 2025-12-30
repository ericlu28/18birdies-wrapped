import type { Archive } from "./types.js";

const DEFAULT_START_2025_MS = Date.UTC(2025, 0, 1, 0, 0, 0, 0);
const DEFAULT_END_2025_MS = Date.UTC(2026, 0, 1, 0, 0, 0, 0) - 1;

function normalizeToMs(ts: number): number {
  // If the timestamp looks like seconds since epoch (10 digits), convert to ms.
  return ts < 1e12 ? ts * 1000 : ts;
}

export function filterArchive(
  archive: Archive,
  startTs: number = DEFAULT_START_2025_MS,
  endTs: number = DEFAULT_END_2025_MS,
): Archive {
  const startMs = normalizeToMs(startTs);
  const endMs = normalizeToMs(endTs);

  const rounds = archive.myData.activityData.rounds ?? [];
  const filtered = rounds.filter((r) => r.timestamp >= startMs && r.timestamp <= endMs);

  console.log("length of rounds:", rounds.length);
  console.log("length of filtered:", filtered.length);

  return {
    ...archive,
    myData: {
      ...archive.myData,
      activityData: {
        ...archive.myData.activityData,
        rounds: filtered,
        roundCount: filtered.length,
      },
    },
  };
}
