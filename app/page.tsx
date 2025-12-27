"use client";

import { useMemo, useState } from "react";
import type { Archive, WrappedSummaryV1 } from "../src/types";
import { aggregateArchive } from "../src/aggregateCore";
import { Slides } from "./ui/Slides";

type UiState =
  | { kind: "upload" }
  | { kind: "loading"; fileName: string }
  | { kind: "ready"; summary: WrappedSummaryV1; fileName: string }
  | { kind: "error"; message: string };

function monthName(ym: string): string {
  const [y, m] = ym.split("-");
  return `${y}-${m}`;
}

function pickBusiestMonth(byMonthUtc: Record<string, number>): { ym: string; count: number } | null {
  const entries = Object.entries(byMonthUtc);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { ym: entries[0]![0], count: entries[0]![1] };
}

export default function HomePage() {
  const [ui, setUi] = useState<UiState>({ kind: "upload" });

  const slides = useMemo(() => {
    if (ui.kind !== "ready") return [];

    const { summary } = ui;
    const busy = pickBusiestMonth(summary.rounds.byMonthUtc);
    const first = summary.rounds.firstRoundAt ? summary.rounds.firstRoundAt.slice(0, 4) : null;
    const last = summary.rounds.lastRoundAt ? summary.rounds.lastRoundAt.slice(0, 4) : null;
    const years = first && last ? (first === last ? first : `${first}–${last}`) : null;

    return [
      {
        title: "18Birdies Wrapped",
        body: (
          <>
            <p className="pill">Local-only • Your data stays in your browser</p>
            <h1 className="headline">{summary.profile.userName ?? "Your"} season recap</h1>
            <p className="muted">
              {years ? `Highlights from ${years}.` : "Highlights from your rounds."} (source: {ui.fileName})
            </p>
          </>
        ),
      },
      {
        title: "Rounds played",
        body: (
          <>
            <p className="pill">Total</p>
            <p className="bigNumber">{summary.rounds.totalIncluded}</p>
            <p className="muted">
              {busy ? `Busiest month: ${monthName(busy.ym)} (${busy.count}).` : "No month breakdown available."}
            </p>
          </>
        ),
      },
      {
        title: "Average strokes",
        body: (
          <>
            <p className="pill">Average</p>
            <p className="bigNumber">
              {summary.strokes.average === null ? "—" : summary.strokes.average.toFixed(1)}
            </p>
            <p className="muted">
              Best:{" "}
              {summary.strokes.bestRound
                ? `${summary.strokes.bestRound.strokes ?? "—"} at ${summary.strokes.bestRound.clubName ?? "Unknown"}`
                : "—"}
            </p>
            <p className="muted">
              Toughest:{" "}
              {summary.strokes.worstRound
                ? `${summary.strokes.worstRound.strokes ?? "—"} at ${summary.strokes.worstRound.clubName ?? "Unknown"}`
                : "—"}
            </p>
          </>
        ),
      },
      {
        title: "Scoring mix",
        body: (
          <>
            <p className="pill">Totals</p>
            <div className="row">
              <span className="pill">Birdies: {summary.statsTotals.birdies}</span>
              <span className="pill">Pars: {summary.statsTotals.pars}</span>
              <span className="pill">Bogeys: {summary.statsTotals.bogeys}</span>
              <span className="pill">Double+: {summary.statsTotals.doubleBogeyOrWorse}</span>
            </div>
            <p className="muted">
              Fairways:{" "}
              {summary.statsTotals.fairwayHitRate === null ? "—" : `${(summary.statsTotals.fairwayHitRate * 100).toFixed(1)}%`}
              {" • "}
              GIR: {summary.statsTotals.girRate === null ? "—" : `${(summary.statsTotals.girRate * 100).toFixed(1)}%`}
            </p>
          </>
        ),
      },
      {
        title: "Your home course",
        body: (
          <>
            <p className="pill">Most played</p>
            <h2 className="headline">{summary.courses.mostPlayed?.name ?? "Unknown"}</h2>
            <p className="muted">{summary.courses.mostPlayed ? `${summary.courses.mostPlayed.roundsPlayed} rounds.` : "—"}</p>
          </>
        ),
      },
    ];
  }, [ui]);

  async function onFile(file: File) {
    setUi({ kind: "loading", fileName: file.name });

    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Archive;
      const summary = aggregateArchive(parsed);
      setUi({ kind: "ready", summary, fileName: file.name });
    } catch {
      setUi({ kind: "error", message: "Could not read that file. Please upload the raw 18Birdies_archive.json export." });
    }
  }

  return (
    <main className="app">
      <div className="card">
        {ui.kind === "upload" && (
          <div className="cardInner">
            <p className="pill">Step 1</p>
            <h1 className="headline">Upload your 18Birdies archive</h1>
            <p className="muted">Choose your exported `18Birdies_archive.json` file to generate your Wrapped.</p>
            <div className="row" style={{ marginTop: 16 }}>
              <input
                type="file"
                accept="application/json,.json"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void onFile(f);
                }}
              />
            </div>
          </div>
        )}

        {ui.kind === "loading" && (
          <div className="cardInner">
            <p className="pill">Step 2</p>
            <h1 className="headline">Building your Wrapped…</h1>
            <p className="muted">Parsing and aggregating {ui.fileName}.</p>
            <div style={{ marginTop: 18 }} className="row">
              <button className="btn btnSecondary" onClick={() => setUi({ kind: "upload" })}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {ui.kind === "error" && (
          <div className="cardInner">
            <p className="pill">Error</p>
            <h1 className="headline">Upload failed</h1>
            <p className="muted">{ui.message}</p>
            <div className="row" style={{ marginTop: 16 }}>
              <button className="btn" onClick={() => setUi({ kind: "upload" })}>
                Try again
              </button>
            </div>
          </div>
        )}

        {ui.kind === "ready" && (
          <div className="slidesShell">
            <div className="slideViewport">
              <Slides slides={slides} onReset={() => setUi({ kind: "upload" })} />
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

