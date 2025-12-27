import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Archive, ClubId, RoundRef, WrappedSummaryV1 } from "./types.js";

function toIso(ts: number): string {
  return new Date(ts).toISOString();
}

function toYearMonthUtc(ts: number): string {
  const d = new Date(ts);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function isPlaceholderRound(r: Archive["myData"]["activityData"]["rounds"][number]): boolean {
  const strokes = r.strokes ?? 0;
  const score = r.score ?? 0;
  if (strokes !== 0 || score !== 0) return false;
  const hs = r.holeStrokes ?? [];
  return hs.length > 0 ? hs.every((n) => n === 0) : true;
}

function roundRef(
  r: Archive["myData"]["activityData"]["rounds"][number],
  clubNameById: Map<ClubId, string>,
): RoundRef {
  const clubId = r.clubId?.id ?? null;
  return {
    id: r.id,
    timestamp: r.timestamp,
    timestampIso: toIso(r.timestamp),
    clubId,
    clubName: clubId ? clubNameById.get(clubId) ?? null : null,
    strokes: typeof r.strokes === "number" && r.strokes > 0 ? r.strokes : null,
    score: typeof r.score === "number" && r.score > 0 ? r.score : null,
  };
}

function avg(sum: number, count: number): number | null {
  if (count <= 0) return null;
  return sum / count;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

const archivePath = path.join(repoRoot, "18Birdies_archive.json");
const outputPath = path.join(repoRoot, "wrappedSummary.json");

const raw = fs.readFileSync(archivePath, "utf8");
const archive = JSON.parse(raw) as Archive;

const playedClubs = archive.myData.clubData?.playedClubs ?? [];
const clubNameById = new Map<ClubId, string>();
for (const c of playedClubs) {
  if (c?.clubId) clubNameById.set(c.clubId, c.name);
}

const roundsAll = archive.myData.activityData.rounds ?? [];
const rounds = roundsAll.filter((r) => !isPlaceholderRound(r));

const byMonthUtc: Record<string, number> = {};
let minTs: number | null = null;
let maxTs: number | null = null;

let strokesSum = 0;
let strokesCount = 0;
let bestStrokes: { v: number; r: RoundRef } | null = null;
let worstStrokes: { v: number; r: RoundRef } | null = null;

let scoreSum = 0;
let scoreCount = 0;
let bestScore: { v: number; r: RoundRef } | null = null;
let worstScore: { v: number; r: RoundRef } | null = null;

let birdies = 0;
let pars = 0;
let bogeys = 0;
let doubleBogeyOrWorse = 0;
let putts = 0;
let puttsRounds = 0;

let fairwayMiddlesSum = 0;
let fairwayHoleCountSum = 0;
let girSum = 0;
let girHoleCountSum = 0;

type CourseAgg = {
  clubId: ClubId;
  name: string | null;
  roundsPlayed: number;
  strokesSum: number;
  strokesCount: number;
  scoreSum: number;
  scoreCount: number;
};
const courseAggs = new Map<ClubId, CourseAgg>();

for (const r of rounds) {
  const ref = roundRef(r, clubNameById);
  const ts = r.timestamp;
  minTs = minTs === null ? ts : Math.min(minTs, ts);
  maxTs = maxTs === null ? ts : Math.max(maxTs, ts);

  const ym = toYearMonthUtc(ts);
  byMonthUtc[ym] = (byMonthUtc[ym] ?? 0) + 1;

  if (typeof r.strokes === "number" && r.strokes > 0) {
    strokesSum += r.strokes;
    strokesCount += 1;
    if (!bestStrokes || r.strokes < bestStrokes.v) bestStrokes = { v: r.strokes, r: ref };
    if (!worstStrokes || r.strokes > worstStrokes.v) worstStrokes = { v: r.strokes, r: ref };
  }

  if (typeof r.score === "number" && r.score > 0) {
    scoreSum += r.score;
    scoreCount += 1;
    if (!bestScore || r.score < bestScore.v) bestScore = { v: r.score, r: ref };
    if (!worstScore || r.score > worstScore.v) worstScore = { v: r.score, r: ref };
  }

  const s = r.stats ?? {};
  birdies += s.birdies ?? 0;
  pars += s.pars ?? 0;
  bogeys += s.bogeys ?? 0;
  doubleBogeyOrWorse += s.doubleBogeyOrWorse ?? 0;

  if (typeof s.putts === "number" && s.putts > 0) {
    putts += s.putts;
    puttsRounds += 1;
  }

  if (typeof s.fairwayMiddles === "number") fairwayMiddlesSum += s.fairwayMiddles;
  if (typeof s.fairwayHoleCount === "number") fairwayHoleCountSum += s.fairwayHoleCount;
  if (typeof s.gir === "number") girSum += s.gir;
  if (typeof s.girHoleCount === "number") girHoleCountSum += s.girHoleCount;

  if (ref.clubId) {
    const clubId = ref.clubId;
    const agg =
      courseAggs.get(clubId) ??
      ({
        clubId,
        name: ref.clubName,
        roundsPlayed: 0,
        strokesSum: 0,
        strokesCount: 0,
        scoreSum: 0,
        scoreCount: 0,
      } satisfies CourseAgg);

    agg.roundsPlayed += 1;
    agg.name = agg.name ?? ref.clubName;

    if (typeof r.strokes === "number" && r.strokes > 0) {
      agg.strokesSum += r.strokes;
      agg.strokesCount += 1;
    }
    if (typeof r.score === "number" && r.score > 0) {
      agg.scoreSum += r.score;
      agg.scoreCount += 1;
    }
    courseAggs.set(clubId, agg);
  }
}

const courses = Array.from(courseAggs.values())
  .map((c) => ({
    clubId: c.clubId,
    name: c.name,
    roundsPlayed: c.roundsPlayed,
    avgStrokes: avg(c.strokesSum, c.strokesCount),
    avgScore: avg(c.scoreSum, c.scoreCount),
  }))
  .sort((a, b) => b.roundsPlayed - a.roundsPlayed);

const mostPlayed = courses.length
  ? { clubId: courses[0]!.clubId, name: courses[0]!.name, roundsPlayed: courses[0]!.roundsPlayed }
  : null;

const summary: WrappedSummaryV1 = {
  schemaVersion: "1",
  generatedAt: new Date().toISOString(),
  profile: {
    userId: archive.myData.accountData?.userId ?? null,
    userName: archive.myData.accountData?.userName ?? null,
  },
  rounds: {
    totalFromArchive: archive.myData.activityData.roundCount ?? null,
    totalIncluded: rounds.length,
    byMonthUtc,
    firstRoundAt: minTs ? toIso(minTs) : null,
    lastRoundAt: maxTs ? toIso(maxTs) : null,
  },
  strokes: {
    average: avg(strokesSum, strokesCount),
    bestRound: bestStrokes?.r ?? null,
    worstRound: worstStrokes?.r ?? null,
  },
  score: {
    average: avg(scoreSum, scoreCount),
    bestRound: bestScore?.r ?? null,
    worstRound: worstScore?.r ?? null,
  },
  statsTotals: {
    birdies,
    pars,
    bogeys,
    doubleBogeyOrWorse,
    putts,
    puttsAvgPerRoundWithPutts: avg(putts, puttsRounds),
    fairwayHitRate: fairwayHoleCountSum > 0 ? fairwayMiddlesSum / fairwayHoleCountSum : null,
    girRate: girHoleCountSum > 0 ? girSum / girHoleCountSum : null,
  },
  courses: {
    mostPlayed,
    items: courses,
  },
};

fs.writeFileSync(outputPath, JSON.stringify(summary, null, 2) + "\n", "utf8");
process.stdout.write(`Wrote ${outputPath}\n`);

