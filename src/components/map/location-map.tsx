"use client";

import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { loadMapLibre, loadStyle } from "./maplibre";

/** A polygon approximating a circle of `radius` metres, so it scales with zoom. */
function circle(lng: number, lat: number, radius: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    const dx = (radius * Math.cos(t)) / (111_320 * Math.cos((lat * Math.PI) / 180));
    const dy = (radius * Math.sin(t)) / 111_320;
    coords.push([lng + dx, lat + dy]);
  }
  return { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates: [coords] } };
}

/** Static-looking map with a shaded green circle about 300 m wide, not a pin. */
export function LocationMap({ lng, lat, label }: { lng: number; lat: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let map: import("maplibre-gl").Map | null = null;
    let cancelled = false;
    (async () => {
      const [lib, style] = await Promise.all([loadMapLibre(), loadStyle()]);
      if (cancelled || !box.current) return;
      map = new lib.Map({
        container: box.current,
        style,
        center: [lng, lat],
        zoom: 15,
        interactive: false,
        attributionControl: { compact: true },
      });
      map.on("load", () => {
        map!.addSource("area", { type: "geojson", data: circle(lng, lat, 150) });
        map!.addLayer({ id: "area-fill", type: "fill", source: "area", paint: { "fill-color": "#1F5C4A", "fill-opacity": 0.16 } });
        map!.addLayer({ id: "area-line", type: "line", source: "area", paint: { "line-color": "#1F5C4A", "line-width": 1.5 } });
      });
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lng, lat]);
  return <div ref={box} role="img" aria-label={`Map showing the approximate location in ${label}`} style={{ position: "absolute", inset: 0 }} className="bg-paper" />;
}
