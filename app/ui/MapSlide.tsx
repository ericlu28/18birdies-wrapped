"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Archive, ClubId } from "../../src/types";
import { getPublicMapboxToken } from "../../src/envPublic";
import cacheJson from "../../data/courseCoordinates.json";

type CourseCoord = { lat: number; lng: number; name?: string; source?: string };
type CacheShape = Record<string, CourseCoord>;

type GeocodeResponse = {
  clubId: string | null;
  name: string;
  lat: number;
  lng: number;
  formattedAddress: string | null;
  placeId: string | null;
};

type CourseEvent = {
  clubId: ClubId;
  clubName: string;
  timestamp: number;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function markerSize(count: number): number {
  return clamp(10 + count * 3, 10, 28);
}

export function MapSlide({ archive }: { archive: Archive }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<ClubId, { marker: any; count: number }>>(new Map());
  const [status, setStatus] = useState<
    | { kind: "resolving"; done: number; total: number }
    | { kind: "ready" }
    | { kind: "error"; message: string }
  >({ kind: "resolving", done: 0, total: 0 });

  const clubNameById = useMemo(() => {
    const map = new Map<ClubId, string>();
    const played = archive.myData.clubData?.playedClubs ?? [];
    for (const c of played) map.set(c.clubId, c.name);
    return map;
  }, [archive]);

  const roundEvents = useMemo<CourseEvent[]>(() => {
    const rounds = archive.myData.activityData.rounds ?? [];
    const events: CourseEvent[] = [];
    for (const r of rounds) {
      const clubId = r.clubId?.id;
      if (!clubId) continue;
      const name = clubNameById.get(clubId) ?? "Unknown";
      events.push({ clubId, clubName: name, timestamp: r.timestamp });
    }
    events.sort((a, b) => a.timestamp - b.timestamp);
    return events;
  }, [archive, clubNameById]);

  const uniqueCourseIdsInOrder = useMemo(() => {
    const seen = new Set<ClubId>();
    const out: Array<{ clubId: ClubId; clubName: string }> = [];
    for (const e of roundEvents) {
      if (seen.has(e.clubId)) continue;
      seen.add(e.clubId);
      out.push({ clubId: e.clubId, clubName: e.clubName });
    }
    return out;
  }, [roundEvents]);

  useEffect(() => {
    let cancelled = false;
    const coords = new Map<ClubId, { lat: number; lng: number }>();
    const cache = cacheJson as CacheShape;

    async function resolveAll() {
      try {
        setStatus({ kind: "resolving", done: 0, total: uniqueCourseIdsInOrder.length });

        let done = 0;
        for (const c of uniqueCourseIdsInOrder) {
          if (cancelled) return;

          const cached = cache[c.clubId];
          if (cached && typeof cached.lat === "number" && typeof cached.lng === "number") {
            coords.set(c.clubId, { lat: cached.lat, lng: cached.lng });
            done += 1;
            setStatus({ kind: "resolving", done, total: uniqueCourseIdsInOrder.length });
            continue;
          }

          const res = await fetch("/api/geocode", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ clubId: c.clubId, name: c.clubName }),
          });

          if (!res.ok) {
            if (res.status === 404) {
              // No geocode results for this course name; skip it.
              console.warn(`[MapSlide] No geocode results for ${c.clubName} (${c.clubId}); skipping.`);
              done += 1;
              setStatus({ kind: "resolving", done, total: uniqueCourseIdsInOrder.length });
              continue;
            }
            const text = await res.text().catch(() => "");
            throw new Error(`Geocode failed for ${c.clubName} (${c.clubId}): ${res.status} ${text}`);
          }

          const data = (await res.json()) as GeocodeResponse;
          coords.set(c.clubId, { lat: data.lat, lng: data.lng });
          done += 1;
          setStatus({ kind: "resolving", done, total: uniqueCourseIdsInOrder.length });
        }

        if (cancelled) return;

        const mapboxgl = (await import("mapbox-gl")).default;
        mapboxgl.accessToken = getPublicMapboxToken();

        if (!mapContainerRef.current) return;

        mapRef.current = new mapboxgl.Map({
          container: mapContainerRef.current,
          style: "mapbox://styles/mapbox/light-v11",
          center: [-98.5795, 39.8283], // USA
          zoom: 3.1,
        });

        mapRef.current.addControl(new mapboxgl.NavigationControl({ visualizePitch: true }), "top-right");

        setStatus({ kind: "ready" });

        // Animation: iterate through rounds in timestamp order.
        let i = 0;
        const tickMs = 220;
        const timer = window.setInterval(() => {
          if (cancelled) return;
          if (i >= roundEvents.length) {
            window.clearInterval(timer);
            return;
          }

          const e = roundEvents[i++]!;
          const ll = coords.get(e.clubId);
          if (!ll) return;

          const existing = markersRef.current.get(e.clubId);
          if (!existing) {
            const el = document.createElement("div");
            el.style.width = `${markerSize(1)}px`;
            el.style.height = `${markerSize(1)}px`;
            el.style.borderRadius = "999px";
            el.style.background = "rgba(39, 174, 96, 0.95)";
            el.style.boxShadow = "0 10px 28px rgba(39, 174, 96, 0.28)";
            el.style.border = "2px solid rgba(255,255,255,0.9)";
            el.title = e.clubName;

            const marker = new mapboxgl.Marker({ element: el })
              .setLngLat([ll.lng, ll.lat])
              .addTo(mapRef.current);

            markersRef.current.set(e.clubId, { marker, count: 1 });
          } else {
            const nextCount = existing.count + 1;
            existing.count = nextCount;
            const el = existing.marker.getElement() as HTMLDivElement;
            const size = markerSize(nextCount);
            el.style.width = `${size}px`;
            el.style.height = `${size}px`;
          }
        }, tickMs);

        // Cleanup interval on unmount
        return () => window.clearInterval(timer);
      } catch (e) {
        if (cancelled) return;
        setStatus({ kind: "error", message: e instanceof Error ? e.message : "Map failed to load" });
      }
    }

    void resolveAll();
    return () => {
      cancelled = true;
      try {
        markersRef.current.clear();
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
      } catch {
        // ignore
      }
    };
  }, [roundEvents, uniqueCourseIdsInOrder]);

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div className="pill">2025 course map</div>

      {status.kind === "resolving" && (
        <div className="muted">
          Resolving course locations… {status.done}/{status.total}
        </div>
      )}
      {status.kind === "error" && <div className="muted">Map error: {status.message}</div>}

      <div
        ref={mapContainerRef}
        style={{
          height: 420,
          width: "100%",
          borderRadius: 18,
          overflow: "hidden",
          border: "1px solid rgba(0,0,0,0.06)",
          background: "rgba(255,255,255,0.6)",
        }}
      />
    </div>
  );
}

