"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Supercluster from "supercluster";
import { nairaShort, priceUnit } from "@/lib/format";
import type { ListingSummary } from "@/lib/types";
import { Icon } from "../icon";
import { boundsOf, LAGOS_CENTRE, LAGOS_ZOOM, loadMapLibre, loadStyle } from "./maplibre";

export type MapView = { lng: number; lat: number; zoom: number };
export type AreaLabel = { name: string; lng: number; lat: number };

type Props = {
  pins: ListingSummary[];
  areaLabels: AreaLabel[];
  initialView?: MapView;
  /** Change `key` to fly the map somewhere (e.g. after picking an area). */
  focus?: MapView & { key: string };
  hoverId: string | null;
  selectedId: string | null;
  viewedIds: Set<string>;
  loading: boolean;
  onHover: (id: string | null) => void;
  onSelect: (id: string | null) => void;
  onMove: (bbox: [number, number, number, number], view: MapView) => void;
  /** Rendered over the map for the selected pin (desktop above the pin, mobile at the bottom). */
  renderPreview: (l: ListingSummary, placement: "above" | "below" | "sheet") => ReactNode;
  isMobile: boolean;
  /** Extra bottom inset on mobile (bottom sheet peek) so controls stay visible. */
  bottomInset?: number;
};

type PinFeature = GeoJSON.Feature<GeoJSON.Point, { id: string }>;
type MarkerEntry = { marker: Marker; el: HTMLElement; inner: HTMLElement; kind: "pin" | "cluster" };

export function SearchMap(props: Props) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const libRef = useRef<Awaited<ReturnType<typeof loadMapLibre>> | null>(null);
  const markers = useRef(new Map<string, MarkerEntry>());
  const index = useRef<Supercluster<{ id: string }> | null>(null);
  const byId = useRef(new Map<string, ListingSummary>());
  const latest = useRef(props);
  latest.current = props;
  const [ready, setReady] = useState(false);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    let map: MLMap | null = null;
    const live = markers.current;
    (async () => {
      const [lib, style] = await Promise.all([loadMapLibre(), loadStyle()]);
      if (cancelled || !box.current) return;
      libRef.current = lib;
      const v = latest.current.initialView;
      map = new lib.Map({
        container: box.current,
        style,
        center: v ? [v.lng, v.lat] : LAGOS_CENTRE,
        zoom: v?.zoom ?? LAGOS_ZOOM,
        minZoom: 9,
        maxZoom: 18,
        dragRotate: false,
        pitchWithRotate: false,
        touchPitch: false,
        attributionControl: { compact: true },
      });
      map.touchZoomRotate.disableRotation();
      mapRef.current = map;
      // With no position in the URL, show all five areas.
      const labels = latest.current.areaLabels;
      if (!v && labels.length > 1) {
        const lngs = labels.map((a) => a.lng);
        const lats = labels.map((a) => a.lat);
        map.fitBounds(
          [
            [Math.min(...lngs), Math.min(...lats)],
            [Math.max(...lngs), Math.max(...lats)],
          ],
          { padding: 60, duration: 0 },
        );
      }

      // Area names in Inter, uppercase label style.
      for (const a of latest.current.areaLabels) {
        const el = document.createElement("div");
        el.className = "area-label";
        el.textContent = a.name;
        // Lifted above the area centre so clusters there don't cover the name.
        new lib.Marker({ element: el, anchor: "bottom", offset: [0, -30] }).setLngLat([a.lng, a.lat]).addTo(map);
        el.parentElement?.style.setProperty("z-index", "0");
      }

      const emitMove = () => {
        const c = map!.getCenter();
        latest.current.onMove(boundsOf(map!), { lng: c.lng, lat: c.lat, zoom: map!.getZoom() });
      };
      map.on("load", () => {
        setReady(true);
        emitMove();
      });
      map.on("moveend", emitMove);
      let frame = 0;
      map.on("move", () => {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(() => {
          renderMarkers();
          placePreview();
        });
      });
      map.on("click", (e) => {
        const t = e.originalEvent.target as HTMLElement;
        if (!t.closest(".pin, .cluster")) latest.current.onSelect(null);
      });
    })();
    return () => {
      cancelled = true;
      live.clear();
      map?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuild the cluster index when results change.
  useEffect(() => {
    byId.current = new Map(props.pins.map((p) => [p.id, p]));
    const idx = new Supercluster<{ id: string }>({ radius: 56, maxZoom: 16 });
    idx.load(
      props.pins.map<PinFeature>((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        properties: { id: p.id },
      })),
    );
    index.current = idx;
    if (ready) renderMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.pins, ready]);

  // Restyle pins when hover, selection or viewed set change.
  useEffect(() => {
    for (const [key, m] of markers.current) {
      if (m.kind !== "pin") continue;
      styleMarker(key.slice(2), m);
    }
    placePreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.hoverId, props.selectedId, props.viewedIds]);

  // Fly somewhere on request.
  useEffect(() => {
    const f = props.focus;
    if (!f || !mapRef.current) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    mapRef.current.flyTo({ center: [f.lng, f.lat], zoom: f.zoom, duration: reduce ? 0 : 900 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.focus?.key]);

  useEffect(() => {
    mapRef.current?.resize();
  }, [props.isMobile]);

  function stateOf(id: string): "selected" | "hover" | "viewed" | "default" {
    const p = latest.current;
    return p.selectedId === id ? "selected" : p.hoverId === id ? "hover" : p.viewedIds.has(id) ? "viewed" : "default";
  }

  function styleMarker(id: string, m: MarkerEntry) {
    const s = stateOf(id);
    m.inner.dataset.state = s;
    m.el.style.zIndex = s === "selected" ? "12" : s === "hover" ? "6" : s === "viewed" ? "1" : "2";
  }

  function renderMarkers() {
    const map = mapRef.current;
    const lib = libRef.current;
    const idx = index.current;
    if (!map || !lib || !idx) return;
    const [w, s, e, n] = boundsOf(map);
    const pad = 0.01;
    const zoom = Math.floor(map.getZoom());
    const features = idx.getClusters([w - pad, s - pad, e + pad, n + pad], zoom);
    const next = new Set<string>();

    for (const f of features) {
      const [lng, lat] = f.geometry.coordinates as [number, number];
      const props = f.properties as { cluster?: boolean; cluster_id?: number; point_count?: number; id?: string };
      const key = props.cluster ? `c:${props.cluster_id}` : `p:${props.id}`;
      next.add(key);
      if (markers.current.has(key)) continue;

      const el = document.createElement("div");
      el.className = "marker-enter";
      let inner: HTMLElement;
      if (props.cluster) {
        const count = props.point_count!;
        const d = count >= 50 ? 52 : count >= 10 ? 44 : 36;
        inner = document.createElement("button");
        inner.className = "cluster";
        inner.style.width = inner.style.height = `${d}px`;
        inner.textContent = String(count);
        inner.setAttribute("aria-label", `${count} homes here. Zoom in`);
        inner.addEventListener("click", (ev) => {
          ev.stopPropagation();
          const z = idx.getClusterExpansionZoom(props.cluster_id!);
          map.easeTo({ center: [lng, lat], zoom: Math.min(z, 17), duration: 200 });
        });
      } else {
        const l = byId.current.get(props.id!)!;
        inner = document.createElement("button");
        inner.className = "pin";
        const unit = priceUnit(l.type);
        inner.setAttribute(
          "aria-label",
          `${l.title}, ${l.area}, ${nairaShort(l.price)}${unit ? " per " + unit.replace("/ ", "") : ""}`,
        );
        inner.innerHTML = `<span class="pin-label"></span><span class="pin-tail"></span>`;
        inner.firstElementChild!.textContent = nairaShort(l.price);
        inner.addEventListener("click", (ev) => {
          ev.stopPropagation();
          latest.current.onSelect(l.id);
        });
        inner.addEventListener("mouseenter", () => latest.current.onHover(l.id));
        inner.addEventListener("mouseleave", () => latest.current.onHover(null));
        inner.addEventListener("focus", () => latest.current.onHover(l.id));
        inner.addEventListener("blur", () => latest.current.onHover(null));
      }
      el.appendChild(inner);
      const marker = new lib.Marker({ element: el, anchor: props.cluster ? "center" : "bottom" }).setLngLat([lng, lat]).addTo(map);
      const entry: MarkerEntry = { marker, el, inner, kind: props.cluster ? "cluster" : "pin" };
      markers.current.set(key, entry);
      if (!props.cluster) styleMarker(props.id!, entry);
      setTimeout(() => el.classList.remove("marker-enter"), 200);
    }

    // Leaving markers fade and shrink, then go.
    for (const [key, m] of markers.current) {
      if (next.has(key)) continue;
      markers.current.delete(key);
      m.el.classList.add("marker-leave");
      m.el.style.pointerEvents = "none";
      setTimeout(() => m.marker.remove(), 180);
    }
  }

  function placePreview() {
    const map = mapRef.current;
    const id = latest.current.selectedId;
    const l = id ? byId.current.get(id) : null;
    if (!map || !l) return setPreviewPos(null);
    const p = map.project([l.lng, l.lat]);
    setPreviewPos({ x: p.x, y: p.y });
  }

  const selected = props.selectedId ? props.pins.find((p) => p.id === props.selectedId) : undefined;
  const h = box.current?.clientHeight ?? 600;

  return (
    <div className="relative h-full w-full overflow-hidden bg-paper">
      <div ref={box} style={{ position: "absolute", inset: 0 }} aria-label="Map of search results. Every home is also in the list." role="region" />

      {props.loading || !ready ? (
        <div className="absolute inset-x-0 top-0 z-30 h-[3px] overflow-hidden bg-green-tint" role="progressbar" aria-label="Loading homes">
          <div className="animate-progress h-full w-[42%] bg-green" />
        </div>
      ) : null}

      {selected && previewPos ? (
        props.isMobile ? (
          <div className="absolute inset-x-3 z-40" style={{ bottom: (props.bottomInset ?? 0) + 12 }}>
            {props.renderPreview(selected, "sheet")}
          </div>
        ) : (
          <div
            className="absolute z-40 w-[290px]"
            style={{
              left: previewPos.x,
              top: previewPos.y,
              transform: previewPos.y < h / 2 ? "translate(-50%, 18px)" : "translate(-50%, calc(-100% - 46px))",
            }}
          >
            {props.renderPreview(selected, previewPos.y < h / 2 ? "below" : "above")}
          </div>
        )
      ) : null}

      {props.isMobile && selected ? null : <MapControls map={mapRef} bottom={(props.isMobile ? props.bottomInset ?? 0 : 0) + 16} />}
    </div>
  );
}

/** Zoom and "locate me": surface squares with a line border, bottom right. */
function MapControls({ map, bottom }: { map: React.RefObject<MLMap | null>; bottom: number }) {
  const [locating, setLocating] = useState(false);
  const btn = "flex h-11 w-11 items-center justify-center border-0 bg-surface text-ink hover:bg-green-tint";
  return (
    <div className="absolute right-4 z-30 flex flex-col gap-2" style={{ bottom }}>
      <div className="flex flex-col overflow-hidden rounded-[6px] border border-line">
        <button type="button" aria-label="Zoom in" className={btn + " border-b border-line"} onClick={() => map.current?.zoomIn()}>
          <Icon n="plus" />
        </button>
        <button type="button" aria-label="Zoom out" className={btn} onClick={() => map.current?.zoomOut()}>
          <Icon n="minus" />
        </button>
      </div>
      <button
        type="button"
        aria-label="Locate me"
        aria-busy={locating}
        className={btn + " rounded-[6px] border border-line"}
        onClick={() => {
          if (!navigator.geolocation) return;
          setLocating(true);
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setLocating(false);
              map.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 });
            },
            () => setLocating(false),
            { timeout: 10000 },
          );
        }}
      >
        <Icon n="locate" />
      </button>
    </div>
  );
}

