"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { saveArea } from "@/server/actions/admin";
import { PinDropMap } from "../map/pin-drop-map";
import { useToast } from "../toast";
import { Button, Card, chipClass, Field, inputClass } from "../ui";

export type AreaRow = { id: number; name: string; slug: string; lng: number; lat: number; zoom: number; isActive: boolean; count: number };

const LAGOS = { lng: 3.41, lat: 6.48 };

export function AreaEditor({ areas }: { areas: AreaRow[] }) {
  const [editing, setEditing] = useState<AreaRow | "new" | null>(null);
  return (
    <div className="flex flex-col gap-6">
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {areas.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-3 rounded-[10px] border border-line bg-surface px-4 py-3">
            <div className="flex flex-col">
              <span className="font-semibold">
                {a.name} {a.isActive ? null : <span className="text-sm font-normal text-muted">(hidden)</span>}
              </span>
              <span className="text-sm text-muted">
                <span className="font-mono">{a.count}</span> live listings · centre <span className="font-mono">{a.lat.toFixed(4)}, {a.lng.toFixed(4)}</span> · zoom <span className="font-mono">{a.zoom}</span>
              </span>
            </div>
            <Button size="sm" onClick={() => setEditing(a)}>
              Edit
            </Button>
          </li>
        ))}
      </ul>
      {editing ? (
        <AreaForm key={editing === "new" ? "new" : editing.id} area={editing === "new" ? null : editing} onDone={() => setEditing(null)} />
      ) : (
        <div>
          <Button variant="secondary" onClick={() => setEditing("new")}>
            Add an area
          </Button>
        </div>
      )}
    </div>
  );
}

function AreaForm({ area, onDone }: { area: AreaRow | null; onDone: () => void }) {
  const [name, setName] = useState(area?.name ?? "");
  const [pos, setPos] = useState({ lng: area?.lng ?? LAGOS.lng, lat: area?.lat ?? LAGOS.lat });
  const [zoom, setZoom] = useState(area?.zoom ?? 14);
  const [active, setActive] = useState(area?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const id = useId();
  return (
    <Card className="flex flex-col gap-4 p-5 sm:p-6">
      <h2 className="m-0 font-display text-2xl font-semibold">{area ? `Edit ${area.name}` : "Add an area"}</h2>
      <Field id={`${id}-n`} label="Name" error={error}>
        <input id={`${id}-n`} className={inputClass} value={name} onChange={(e) => (setName(e.target.value), setError(null))} />
      </Field>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Map centre</span>
        <div className="relative h-[320px] overflow-hidden rounded-[10px] border border-line">
          <PinDropMap lng={pos.lng} lat={pos.lat} zoom={area ? 14 : 11} onChange={(lng, lat) => setPos({ lng, lat })} />
        </div>
        <span className="font-mono text-sm text-muted">
          {pos.lat.toFixed(5)}, {pos.lng.toFixed(5)}
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">Default zoom</span>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Default zoom">
          {[12, 13, 14, 15].map((z) => (
            <button key={z} type="button" role="radio" aria-checked={zoom === z} className={chipClass(zoom === z)} onClick={() => setZoom(z)}>
              {z}
            </button>
          ))}
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-[15px]">
        <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="h-5 w-5 accent-[var(--green)]" />
        Show this area in search and on the landing page
      </label>
      <div className="flex gap-2.5">
        <Button onClick={onDone}>Cancel</Button>
        <Button
          variant="secondary"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await saveArea({ id: area?.id, name, lng: pos.lng, lat: pos.lat, defaultZoom: zoom, isActive: active });
              if (!r.ok) return setError(r.error);
              toast("Area saved.");
              onDone();
              router.refresh();
            })
          }
        >
          Save area
        </Button>
      </div>
    </Card>
  );
}
