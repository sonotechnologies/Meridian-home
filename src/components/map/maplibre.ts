"use client";

import type { Map as MLMap, StyleSpecification, LayerSpecification } from "maplibre-gl";
import { publicEnv } from "@/lib/public-env";

export type MapLib = typeof import("maplibre-gl");

let libPromise: Promise<MapLib> | null = null;

/** MapLibre is loaded only on pages that show a map. */
export function loadMapLibre(): Promise<MapLib> {
  if (!libPromise) {
    libPromise = import("maplibre-gl").then((m) => {
      m.setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
      return m;
    });
  }
  return libPromise;
}

const C = {
  paper: "#F6F3EC",
  land: "#F1EDE4",
  water: "#D3DFD9",
  park: "#E3EDE7",
  building: "#EAE5DA",
  road: "#FFFFFF",
  casing: "#DDD8CC",
  rail: "#D2CCBE",
  boundary: "#C9C3B5",
  label: "#5A6661",
};

/** Symbol layers we keep: major road names and water names. Area names are drawn by us, in Inter. */
const KEEP_SYMBOLS = new Set(["transportation_name", "water_name"]);

/**
 * Recolour an OpenMapTiles style (OpenFreeMap Positron/Liberty) to the Meridian
 * palette: land in paper, water pale grey-green, roads white with line edges,
 * parks green-tint, shop and business icons hidden.
 */
export function recolourStyle(style: StyleSpecification): StyleSpecification {
  const layers: LayerSpecification[] = [];
  for (const layer of style.layers) {
    const l = { ...layer } as LayerSpecification & { "source-layer"?: string; paint?: Record<string, unknown>; layout?: Record<string, unknown> };
    const src = l["source-layer"] ?? "";
    const id = l.id.toLowerCase();
    if (l.type === "background") {
      l.paint = { "background-color": C.paper };
    } else if (l.type === "symbol") {
      if (!KEEP_SYMBOLS.has(src)) continue;
      l.paint = { "text-color": C.label, "text-halo-color": C.paper, "text-halo-width": 1.2 };
      if (src === "transportation_name") {
        // Major roads only.
        l.minzoom = Math.max(l.minzoom ?? 0, 13);
      }
    } else if (src === "water" && l.type === "fill") {
      l.paint = { "fill-color": C.water };
    } else if (src === "waterway" && l.type === "line") {
      l.paint = { "line-color": C.water, "line-width": (l.paint?.["line-width"] as number) ?? 1 };
    } else if (src === "park" || (src === "landcover" && /wood|grass|park/.test(id))) {
      if (l.type === "fill") l.paint = { "fill-color": C.park, "fill-opacity": 0.9 };
      else if (l.type === "line") continue;
    } else if (src === "landcover" || src === "landuse") {
      if (l.type === "fill") l.paint = { "fill-color": C.land, "fill-opacity": 0.6 };
    } else if (src === "building") {
      if (l.type === "fill") l.paint = { "fill-color": C.building, "fill-outline-color": C.casing };
      else if (l.type === "fill-extrusion") continue;
    } else if (src === "transportation" && l.type === "line") {
      const width = l.paint?.["line-width"];
      const isRail = /rail|transit/.test(id);
      const isCasing = /casing|outline/.test(id);
      l.paint = {
        "line-color": isRail ? C.rail : isCasing ? C.casing : C.road,
        ...(width !== undefined ? { "line-width": width } : {}),
        ...(isRail ? { "line-dasharray": [2, 2] } : {}),
      };
    } else if (src === "boundary" && l.type === "line") {
      l.paint = { "line-color": C.boundary, "line-width": 0.8, "line-dasharray": [3, 2] };
    } else if (src === "aeroway") {
      if (l.type === "fill") l.paint = { "fill-color": C.land };
      else if (l.type === "line") l.paint = { "line-color": C.road };
    }
    layers.push(l);
  }
  return { ...style, layers };
}

let stylePromise: Promise<StyleSpecification> | null = null;

/** Fetch and recolour the tile provider's style once; fall back to plain paper if it fails. */
export function loadStyle(): Promise<StyleSpecification> {
  if (!stylePromise) {
    stylePromise = fetch(publicEnv.tileStyleUrl)
      .then((r) => {
        if (!r.ok) throw new Error(`style ${r.status}`);
        return r.json() as Promise<StyleSpecification>;
      })
      .then(recolourStyle)
      .catch(() => {
        stylePromise = null;
        return {
          version: 8,
          sources: {},
          layers: [{ id: "background", type: "background", paint: { "background-color": C.paper } }],
        } satisfies StyleSpecification;
      });
  }
  return stylePromise;
}

export const LAGOS_CENTRE: [number, number] = [3.41, 6.48];
export const LAGOS_ZOOM = 11.3;

export function boundsOf(map: MLMap): [number, number, number, number] {
  const b = map.getBounds();
  const r = (n: number) => Math.round(n * 1e5) / 1e5;
  return [r(b.getWest()), r(b.getSouth()), r(b.getEast()), r(b.getNorth())];
}
