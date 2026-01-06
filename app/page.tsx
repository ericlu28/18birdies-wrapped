"use client";

import { useMemo, useState } from "react";
import type { Archive, WrappedSummaryV1 } from "../src/types";
import { aggregateArchive } from "../src/aggregateCore";
import { filterArchive } from "../src/filterCore";
import { Slides } from "./ui/Slides";
import { MapSlide } from "./ui/MapSlide";

type UiState =
  | { kind: "upload" }
  | { kind: "loading"; fileName: string }
  | { kind: "ready"; summary: WrappedSummaryV1; fileName: string; archive: Archive }
  | { kind: "error"; message: string };

function monthName(ym: string): string {
  const [y, m] = ym.split("-");
  const year = Number(y);
  const month = Number(m);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return ym;
  const d = new Date(Date.UTC(year, month - 1, 1));
  return new Intl.DateTimeFormat(undefined, { month: "short", year: "numeric", timeZone: "UTC" }).format(d);
}

function pickBusiestMonth(byMonthUtc: Record<string, number>): { ym: string; count: number } | null {
  const entries = Object.entries(byMonthUtc);
  if (entries.length === 0) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { ym: entries[0]![0], count: entries[0]![1] };
}

const brand = {
  primary: "#27ae60",
  navy: "#0d1a26",
  bg: "#f8faf9",
};

export default function HomePage() {
  const [ui, setUi] = useState<UiState>({ kind: "upload" });
  const [dragActive, setDragActive] = useState(false);

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
      {
        title: "Course map",
        body: <MapSlide archive={ui.archive} />,
      },
    ];
  }, [ui]);

  async function onFile(file: File) {
    setUi({ kind: "loading", fileName: file.name });

    await new Promise<void>((r) => requestAnimationFrame(() => r()));

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Archive;
      const filtered = filterArchive(parsed);
      const summary = aggregateArchive(filtered);
      setUi({ kind: "ready", summary, fileName: file.name, archive: filtered });
    } catch {
      setUi({ kind: "error", message: "Could not read that file. Please upload the raw 18Birdies_archive.json export." });
    }
  }

  if (ui.kind !== "ready") {
    return (
      <div className="landing" style={{ backgroundColor: brand.bg }}>
        <header className="landingNav">
          <div className="brand">
            <div className="brandMark" style={{ backgroundColor: brand.primary }}>
              <span className="brandMarkIcon" aria-hidden="true">
                ⛳
              </span>
            </div>
            <span className="brandName" style={{ color: brand.navy }}>
              GolfWrapped
            </span>
          </div>
        </header>

        <main className="landingMain">
          <section className="hero">
            <h1 className="heroTitle" style={{ color: brand.navy }}>
              Your Year in <span style={{ color: brand.primary }}>Golf.</span>
            </h1>
            <p className="heroSubtitle">
              Discover your best rounds, top courses, and key stats using your 18Birdies data. Everything runs locally in
              your browser.
            </p>
            <div className="heroCtas">
              <a className="heroPrimaryBtn" href="#uploader" style={{ backgroundColor: brand.primary }}>
                Upload My Stats <span aria-hidden="true">→</span>
              </a>
              <a className="heroSecondaryBtn" href="#how-it-works">
                Learn More
              </a>
            </div>
          </section>

          <section className="howItWorks" id="how-it-works">
            <h2 className="sectionTitle" style={{ color: brand.navy }}>
              How it works
            </h2>
            <div className="steps">
              <div className="stepCard">
                <div className="stepNum" style={{ color: brand.primary }}>
                  1
                </div>
                <div className="stepBody">
                  <div className="stepTitle">Download Data</div>
                  <div className="stepDesc">
                    Go to the 18Birdies data portal to export your full history.
                    <div style={{ marginTop: 8 }}>
                      <a
                        className="stepLink"
                        href="https://18birdies.com/download-account-data/"
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: brand.primary }}
                      >
                        Open portal →
                      </a>
                    </div>
                  </div>
                </div>
              </div>

              <div className="stepCard">
                <div className="stepNum" style={{ color: brand.primary }}>
                  2
                </div>
                <div className="stepBody">
                  <div className="stepTitle">Upload JSON</div>
                  <div className="stepDesc">
                    Drag and drop your downloaded JSON file into the uploader below.
                    <div style={{ marginTop: 6 }}>
                      File should be called:{" "}
                      <span
                        style={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                          fontSize: 13,
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "rgba(0,0,0,0.06)",
                          color: brand.navy,
                          border: "1px solid rgba(0,0,0,0.08)",
                          display: "inline-block",
                        }}
                      >
                        18Birdies_archive.json
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="stepCard">
                <div className="stepNum" style={{ color: brand.primary }}>
                  3
                </div>
                <div className="stepBody">
                  <div className="stepTitle">See Your Year</div>
                  <div className="stepDesc">Instantly see your GolfWrapped stats, top courses, best rounds, and your WrappedMap.</div>
                </div>
              </div>
            </div>
          </section>

          <section className="uploaderSection" id="uploader">
            <h2 className="sectionTitle" style={{ color: brand.navy }}>
              Upload JSON
            </h2>
            <p className="sectionSubtitle">Drag and drop your downloaded JSON file into the uploader below.</p>

            <div
              className={`uploader ${dragActive ? "uploaderActive" : ""}`}
              onDragEnter={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActive(true);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActive(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActive(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragActive(false);
                const f = e.dataTransfer.files?.[0];
                if (!f) return;
                if (f.type !== "application/json" && !f.name.toLowerCase().endsWith(".json")) {
                  setUi({ kind: "error", message: "Please upload a valid JSON file." });
                  return;
                }
                void onFile(f);
              }}
            >
              <div className="uploaderInner">
                <div className="uploaderIcon" style={{ color: brand.primary }}>
                  ⬆︎
                </div>
                <div className="uploaderTitle">Drag and drop your JSON file here</div>
                <div className="uploaderHint">or choose a file from your computer</div>

                <label className="uploaderBtn" style={{ backgroundColor: brand.primary }}>
                  Choose file
                  <input
                    type="file"
                    accept="application/json,.json"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onFile(f);
                    }}
                    style={{ display: "none" }}
                  />
                </label>

                {ui.kind === "loading" && <p className="uploaderStatus">Analyzing {ui.fileName}…</p>}

                {ui.kind === "error" && (
                  <div className="uploaderError">
                    <div className="uploaderErrorTitle">Upload failed</div>
                    <div className="uploaderErrorMsg">{ui.message}</div>
                    <div style={{ marginTop: 10 }}>
                      <button className="btn btnSecondary" onClick={() => setUi({ kind: "upload" })}>
                        Try again
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <main className="app">
      <div className="card">
        <div className="slidesShell">
          <div className="slideViewport">
            <Slides slides={slides} onReset={() => setUi({ kind: "upload" })} />
          </div>
        </div>
      </div>
    </main>
  );
}

