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
  const markersRef = useRef<Map<ClubId, { marker: any; count: number; clubName: string; el: HTMLDivElement }>>(new Map());
  const popupRef = useRef<any>(null);
  const [activeClubId, setActiveClubId] = useState<ClubId | null>(null);
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

  const roundsByClubId = useMemo(() => {
    const map = new Map<ClubId, { clubName: string; count: number }>();
    for (const e of roundEvents) {
      const existing = map.get(e.clubId);
      if (!existing) map.set(e.clubId, { clubName: e.clubName, count: 1 });
      else existing.count += 1;
    }
    return map;
  }, [roundEvents]);

  const legendItems = useMemo(() => {
    const items = Array.from(roundsByClubId.entries()).map(([clubId, v]) => ({
      clubId,
      clubName: v.clubName,
      count: v.count,
    }));
    items.sort((a, b) => b.count - a.count || a.clubName.localeCompare(b.clubName));
    return items;
  }, [roundsByClubId]);

  useEffect(() => {
    for (const [clubId, entry] of markersRef.current.entries()) {
      entry.el.classList.toggle("golfMarkerActive", Boolean(activeClubId && clubId === activeClubId));
    }
  }, [activeClubId]);

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
          style: "mapbox://styles/mapbox/streets-v12",
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

        const showCourse = (clubId: ClubId) => {
          setActiveClubId(clubId);
          const entry = markersRef.current.get(clubId);
          const popup = popupRef.current;
          if (!entry || !popup) return;
          popup.setLngLat(entry.marker.getLngLat()).setDOMContent(buildPopupContent(entry.clubName, entry.count)).addTo(mapRef.current);
        };

        const hideCourse = (clubId: ClubId) => {
          setActiveClubId((cur) => (cur === clubId ? null : cur));
          const popup = popupRef.current;
          if (popup) popup.remove();
        };

        // Render one marker per course, sized by total rounds at that course.
        for (const item of legendItems) {
          const ll = coords.get(item.clubId);
          if (!ll) continue;

          const el = buildMarkerElement(item.clubName, item.count);
          const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat([ll.lng, ll.lat])
            .addTo(mapRef.current);

          el.addEventListener("mouseenter", () => showCourse(item.clubId));
          el.addEventListener("mouseleave", () => hideCourse(item.clubId));

          markersRef.current.set(item.clubId, { marker, count: item.count, clubName: item.clubName, el });
        }
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
  }, [legendItems, uniqueCourseIdsInOrder]);

  const totalRounds = roundEvents.length;
  const totalCourses = legendItems.length;

  return (
    <div className="golfMap">
      <div className="golfMapHeader">
        <div className="golfMapTitle">
          Your <span className="golfMapTitleAccent">Golf Map</span>
        </div>
        <div className="golfMapSubtitle">
          {totalCourses} course{totalCourses === 1 ? "" : "s"} played · {totalRounds} total round{totalRounds === 1 ? "" : "s"}
        </div>
        <div className="golfMapHint">Hover over markers or legend items to explore your courses</div>
      </div>

      {status.kind === "resolving" && (
        <div className="muted">
          Resolving course locations… {status.done}/{status.total}
        </div>
      )}
      {status.kind === "error" && <div className="muted">Map error: {status.message}</div>}

      <div className="golfMapLayout">
        <div className="golfMapCanvasWrap">
          <div className="golfMapInLegend">
            <div className="golfMapInLegendRow">
              <svg className="golfMapInLegendIcon" viewBox="0 0 64 64" aria-hidden="true">
                <circle cx="32" cy="32" r="27" fill="#ffffff" stroke="rgba(39, 174, 96, 0.95)" strokeWidth="6" />
                <circle cx="24" cy="22" r="3.2" fill="rgba(13, 26, 38, 0.16)" />
                <circle cx="38" cy="20" r="2.8" fill="rgba(13, 26, 38, 0.14)" />
                <circle cx="46" cy="30" r="3.0" fill="rgba(13, 26, 38, 0.14)" />
              </svg>
              <div className="golfMapInLegendText">Rounds played</div>
            </div>
            <div className="golfMapInLegendSub">Larger markers = more rounds</div>
          </div>

          <div
            ref={mapContainerRef}
            className="golfMapCanvas"
            style={{
              background: "rgba(255,255,255,0.6)",
            }}
          />
        </div>

        <div className="golfMapSidebar">
          <div className="golfMapSidebarTitle">Courses Played</div>

          <div className="golfMapSidebarList">
            {legendItems.map((item) => {
              const active = activeClubId === item.clubId;
              return (
                <div
                  key={item.clubId}
                  className={`golfCourseRow${active ? " golfCourseRowActive" : ""}`}
                  onMouseEnter={() => {
                    setActiveClubId(item.clubId);
                    const entry = markersRef.current.get(item.clubId);
                    const popup = popupRef.current;
                    if (entry && popup && mapRef.current) {
                      popup
                        .setLngLat(entry.marker.getLngLat())
                        .setDOMContent(buildPopupContent(entry.clubName, entry.count))
                        .addTo(mapRef.current);
                    }
                  }}
                  onMouseLeave={() => {
                    setActiveClubId((cur) => (cur === item.clubId ? null : cur));
                    const popup = popupRef.current;
                    if (popup) popup.remove();
                  }}
                >
                  <div className="golfCourseRowMain">
                    <div className="golfCourseRowName">{item.clubName}</div>
                  </div>
                  <div className="golfCourseRowCount">
                    <div className="golfCourseRowCountBadge">{item.count}</div>
                    <div className="golfCourseRowCountLabel">round{item.count === 1 ? "" : "s"}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

