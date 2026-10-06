// MapLibre 6 runs its worker as an ES module that webpack can't resolve, so we
// serve the worker and its shared chunk from /maplibre (see components/map/maplibre.ts).
import { cpSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  cpSync(`node_modules/maplibre-gl/dist/${f}`, `public/maplibre/${f}`);
}
