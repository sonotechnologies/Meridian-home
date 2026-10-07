import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ReactNode } from "react";

export const OG_SIZE = { width: 1200, height: 630 };

const dir = path.join(process.cwd(), "src/assets/fonts");
let fontsPromise: Promise<{ name: string; data: Buffer; weight: 500 | 600; style: "normal" }[]> | null = null;

/** Brand fonts for share images (the default font has no ₦). Bundled via outputFileTracingIncludes. */
export function ogFonts() {
  fontsPromise ??= Promise.all(
    (
      [
        ["Inter", "Inter-500.ttf", 500],
        ["Inter", "Inter-600.ttf", 600],
        ["Fraunces", "Fraunces-600.ttf", 600],
        ["JetBrains Mono", "JetBrainsMono-500.ttf", 500],
      ] as const
    ).map(async ([name, file, weight]) => ({ name, data: await readFile(path.join(dir, file)), weight, style: "normal" as const })),
  );
  return fontsPromise;
}

/** Shared frame for share images: paper, ink, the meridian line. */
export function OgFrame({ children, left, right }: { children: ReactNode; left?: string; right?: string }) {
  return (
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", background: "#F6F3EC", color: "#10221C", padding: 64, fontFamily: "Inter" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <div style={{ width: 44, height: 44, borderRadius: 22, border: "4px solid #10221C", display: "flex", justifyContent: "center" }}>
          <div style={{ width: 4, height: 60, marginTop: -12, background: "#1F5C4A" }} />
        </div>
        <div style={{ fontSize: 40, fontFamily: "Fraunces", fontWeight: 600 }}>meridian</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>{children}</div>
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", fontSize: 24, color: "#5A6661" }}>
        <span style={{ display: "flex" }}>{left ?? ""}</span>
        <span style={{ display: "flex", color: "#1F5C4A" }}>{right ?? ""}</span>
      </div>
    </div>
  );
}

/** JetBrains Mono has no ₦, and a missing glyph sends the whole run to the fallback font, so the sign is set in Inter. */
export function OgPrice({ amount, size }: { amount: string; size: number }) {
  return (
    <span style={{ display: "flex", fontSize: size }}>
      <span style={{ fontFamily: "Inter", fontWeight: 500 }}>₦</span>
      <span style={{ fontFamily: "JetBrains Mono", fontWeight: 500 }}>{amount.replace("₦", "")}</span>
    </span>
  );
}
