"use client";

import { useEffect, useMemo, useState } from "react";

export type SlideModel = {
  title: string;
  body: React.ReactNode;
};

export function Slides({ slides, onReset }: { slides: SlideModel[]; onReset: () => void }) {
  const [idx, setIdx] = useState(0);

  const count = slides.length;
  const clampedIdx = Math.min(Math.max(idx, 0), Math.max(count - 1, 0));

  useEffect(() => {
    setIdx(0);
  }, [count]);

  const canPrev = clampedIdx > 0;
  const canNext = clampedIdx < count - 1;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && canPrev) setIdx((v) => v - 1);
      if (e.key === "ArrowRight" && canNext) setIdx((v) => v + 1);
      if (e.key === "Escape") onReset();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canNext, canPrev, onReset]);

  const dots = useMemo(() => {
    return Array.from({ length: count }, (_, i) => i);
  }, [count]);

  const s = slides[clampedIdx];
  if (!s) return null;

  return (
    <>
      <section className="slide" aria-label={s.title}>
        {s.body}
      </section>
      <footer className="footerNav">
        <div className="row">
          <button className="btn btnSecondary" onClick={onReset}>
            Upload another
          </button>
        </div>
        <div className="dots" aria-label="Slide progress">
          {dots.map((d) => (
            <span key={d} className={`dot ${d === clampedIdx ? "dotActive" : ""}`} />
          ))}
        </div>
        <div className="row">
          <button className="btn btnSecondary" onClick={() => setIdx((v) => v - 1)} disabled={!canPrev}>
            Prev
          </button>
          <button className="btn" onClick={() => setIdx((v) => v + 1)} disabled={!canNext}>
            Next
          </button>
        </div>
      </footer>
    </>
  );
}

