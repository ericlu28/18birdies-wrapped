"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Archive, ClubId } from "../../src/types";
import { getPublicMapboxToken } from "../../src/envPublic";
import cacheJson from "../../data/courseCoordinates.json";

type CourseCoord = { lat: number; lng: number; name?: string; source?: string };
type CacheShape = Record<string, CourseCoord>;
type LocalCacheEntry =
  | { lat: number; lng: number; name?: string; source?: string; updatedAt?: number }
  | { missing: true; name?: string; updatedAt?: number };

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
  return clamp(22 + count * 4, 22, 44);
}

export function MapSlide({ archive }: { archive: Archive }) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markersRef = useRef<Map<ClubId, { marker: any; count: number }>>(new Map());
  const popupRef = useRef<any>(null);
  const [status, setStatus] = useState<
    | { kind: "resolving"; done: number; total: number }
    | { kind: "ready" }
    | { kind: "error"; message: string }
  >({ kind: "resolving", done: 0, total: 0 });

  function buildMarkerElement(clubName: string, count: number): HTMLDivElement {
    const el = document.createElement("div");
    el.className = "golfMarker";
    el.style.width = `${markerSize(count)}px`;
    el.style.height = `${markerSize(count)}px`;
    el.dataset.count = String(count);
    el.dataset.name = clubName;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", clubName);

    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 64 64");
    svg.setAttribute("class", "golfMarkerSvg");
    svg.innerHTML = `
      <circle cx="32" cy="32" r="27" fill="#ffffff" stroke="rgba(39, 174, 96, 0.95)" stroke-width="6" />
      <circle cx="24" cy="22" r="3.2" fill="rgba(13, 26, 38, 0.16)" />
      <circle cx="38" cy="20" r="2.8" fill="rgba(13, 26, 38, 0.14)" />
      <circle cx="46" cy="30" r="3.0" fill="rgba(13, 26, 38, 0.14)" />
      <circle cx="18" cy="34" r="3.0" fill="rgba(13, 26, 38, 0.14)" />
      <circle cx="30" cy="36" r="3.2" fill="rgba(13, 26, 38, 0.14)" />
      <circle cx="40" cy="42" r="3.0" fill="rgba(13, 26, 38, 0.12)" />
      <circle cx="24" cy="48" r="2.6" fill="rgba(13, 26, 38, 0.12)" />
    `;
    el.appendChild(svg);

    const badge = document.createElement("div");
    badge.className = "golfMarkerBadge";
    badge.textContent = count > 1 ? String(count) : "";
    badge.style.display = count > 1 ? "grid" : "none";
    el.appendChild(badge);

    return el;
  }

  function updateMarkerElement(el: HTMLDivElement, clubName: string, count: number) {
    el.style.width = `${markerSize(count)}px`;
    el.style.height = `${markerSize(count)}px`;
    el.dataset.count = String(count);
    el.dataset.name = clubName;
    el.setAttribute("aria-label", clubName);

    const badge = el.querySelector<HTMLDivElement>(".golfMarkerBadge");
    if (badge) {
      badge.textContent = count > 1 ? String(count) : "";
      badge.style.display = count > 1 ? "grid" : "none";
    }
  }

  function buildPopupContent(clubName: string, count: number): HTMLDivElement {
    const wrap = document.createElement("div");
    wrap.className = "golfPopupBanner";
    const title = document.createElement("div");
    title.className = "golfPopupTitle";
    title.textContent = clubName;
    const meta = document.createElement("div");
    meta.className = "golfPopupMeta";
    meta.textContent = `${count} round${count === 1 ? "" : "s"}`;
    wrap.appendChild(title);
    wrap.appendChild(meta);
    return wrap;
  }

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
    const LS_KEY = "golfwrapped_course_coords_v1";

    const localCache: Record<string, LocalCacheEntry> = (() => {
      try {
        const raw = window.localStorage.getItem(LS_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object") return {};
        return parsed as Record<string, LocalCacheEntry>;
      } catch {
        return {};
      }
    })();

    function persistLocalCache() {
      try {
        window.localStorage.setItem(LS_KEY, JSON.stringify(localCache));
      } catch {
        // ignore (storage may be full/blocked)
      }
    }

    async function resolveAll() {
      try {
        setStatus({ kind: "resolving", done: 0, total: uniqueCourseIdsInOrder.length });

        let done = 0;
        for (const c of uniqueCourseIdsInOrder) {
          if (cancelled) return;

          const local = localCache[c.clubId];
          if (local && "missing" in local) {
            console.warn(`[MapSlide] Previously missing geocode for ${c.clubName} (${c.clubId}); skipping.`);
            done += 1;
            setStatus({ kind: "resolving", done, total: uniqueCourseIdsInOrder.length });
            continue;
          }
          if (local && "lat" in local && typeof local.lat === "number" && typeof local.lng === "number") {
            coords.set(c.clubId, { lat: local.lat, lng: local.lng });
            done += 1;
            setStatus({ kind: "resolving", done, total: uniqueCourseIdsInOrder.length });
            continue;
          }

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
              localCache[c.clubId] = { missing: true, name: c.clubName, updatedAt: Date.now() };
              persistLocalCache();
              done += 1;
              setStatus({ kind: "resolving", done, total: uniqueCourseIdsInOrder.length });
              continue;
            }
            if (res.status === 502) {
              // Transient geocode failure for this course; don't surface to the client UI.
              const text = await res.text().catch(() => "");
              console.warn(`[MapSlide] Geocode failed for ${c.clubName} (${c.clubId}): ${res.status} ${text}; skipping.`);
              localCache[c.clubId] = { missing: true, name: c.clubName, updatedAt: Date.now() };
              persistLocalCache();
              done += 1;
              setStatus({ kind: "resolving", done, total: uniqueCourseIdsInOrder.length });
              continue;
            }
            const text = await res.text().catch(() => "");
            throw new Error(`Geocode failed for ${c.clubName} (${c.clubId}): ${res.status} ${text}`);
          }

          const data = (await res.json()) as GeocodeResponse;
          coords.set(c.clubId, { lat: data.lat, lng: data.lng });
          localCache[c.clubId] = { lat: data.lat, lng: data.lng, name: c.clubName, source: "google", updatedAt: Date.now() };
          persistLocalCache();
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

        popupRef.current = new mapboxgl.Popup({
          closeButton: false,
          closeOnClick: false,
          closeOnMove: false,
          offset: 18,
          className: "golfPopup",
        });

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
            const el = buildMarkerElement(e.clubName, 1);

            const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
              .setLngLat([ll.lng, ll.lat])
              .addTo(mapRef.current);

            const onEnter = () => {
              const popup = popupRef.current;
              if (!popup) return;
              const name = el.dataset.name ?? e.clubName;
              const count = Number(el.dataset.count ?? "1");
              popup.setLngLat(marker.getLngLat()).setDOMContent(buildPopupContent(name, count)).addTo(mapRef.current);
            };
            const onLeave = () => {
              const popup = popupRef.current;
              if (!popup) return;
              popup.remove();
            };
            el.addEventListener("mouseenter", onEnter);
            el.addEventListener("mouseleave", onLeave);

            markersRef.current.set(e.clubId, { marker, count: 1 });
          } else {
            const nextCount = existing.count + 1;
            existing.count = nextCount;
            const el = existing.marker.getElement() as HTMLDivElement;
            updateMarkerElement(el, e.clubName, nextCount);
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
        const popup = popupRef.current;
        if (popup) popup.remove();
        popupRef.current = null;

        for (const { marker } of markersRef.current.values()) {
          try {
            marker.remove();
          } catch {
            // ignore
          }
        }
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
      <div className="pill">2025 WrappedMap</div>

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

