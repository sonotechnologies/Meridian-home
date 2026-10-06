"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import type { Map as MLMap, Marker } from "maplibre-gl";
import { useEffect, useRef } from "react";
import { loadMapLibre, loadStyle } from "./maplibre";

/**
 * Large map with a draggable pin for the exact location. The pin is a white
 * circle with an ink ring and a meridian line, as in the design.
 */
export function PinDropMap({
  lng,
  lat,
  zoom = 16,
  flyKey,
  onChange,
}: {
  lng: number;
  lat: number;
  zoom?: number;
  /** Change to re-centre the map and pin (e.g. a new area was picked). */
  flyKey?: string;
  onChange: (lng: number, lat: number) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const cb = useRef(onChange);
  cb.current = onChange;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [lib, style] = await Promise.all([loadMapLibre(), loadStyle()]);
      if (cancelled || !box.current) return;
      const map = new lib.Map({ container: box.current, style, center: [lng, lat], zoom, dragRotate: false, attributionControl: { compact: true } });
      map.touchZoomRotate.disableRotation();
      map.addControl(new lib.NavigationControl({ showCompass: false }), "bottom-right");
      mapRef.current = map;

      const el = document.createElement("div");
      el.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;cursor:grab">
          <div style="background:#10221C;color:#fff;font:500 12px/16px var(--font-sans);padding:6px 10px;border-radius:6px;margin-bottom:8px;white-space:nowrap">Drag to the building</div>
          <div style="position:relative;width:36px;height:36px;border-radius:50%;background:#fff;border:2px solid #10221C;box-shadow:0 6px 16px rgba(16,34,28,.25)">
            <div style="position:absolute;left:50%;top:-8px;bottom:-14px;width:2px;margin-left:-1px;background:#10221C"></div>
          </div>
        </div>`;
      el.setAttribute("role", "slider");
      el.setAttribute("aria-label", "Listing location pin. Drag it, or use the arrow keys to nudge it.");
      el.tabIndex = 0;
      const marker = new lib.Marker({ element: el, draggable: true, anchor: "bottom", offset: [0, 14] }).setLngLat([lng, lat]).addTo(map);
      marker.on("dragend", () => {
        const p = marker.getLngLat();
        cb.current(p.lng, p.lat);
      });
      // Keyboard nudging, about 5 m per press.
      el.addEventListener("keydown", (e) => {
        const step = 0.00005;
        const p = marker.getLngLat();
        const d: Record<string, [number, number]> = { ArrowUp: [0, step], ArrowDown: [0, -step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
        const m = d[e.key];
        if (!m) return;
        e.preventDefault();
        marker.setLngLat([p.lng + m[0], p.lat + m[1]]);
        cb.current(p.lng + m[0], p.lat + m[1]);
      });
      markerRef.current = marker;
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!flyKey || !mapRef.current || !markerRef.current) return;
    markerRef.current.setLngLat([lng, lat]);
    mapRef.current.flyTo({ center: [lng, lat], zoom, duration: 600 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flyKey]);

  return <div ref={box} style={{ position: "absolute", inset: 0 }} className="bg-paper" />;
}
