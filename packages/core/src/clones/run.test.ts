import { describe, expect, it } from "vitest";
import type { AdapterContext } from "../adapter.js";
import { DustmapConfig } from "../config/schema.js";
import { runNormalizedClones } from "./run.js";

function ctx(files: Record<string, string>): AdapterContext {
  const paths = Object.keys(files).sort();
  const isStyle = (p: string) => /\.(css|scss)$/.test(p);
  const scripts = paths.filter((p) => !isStyle(p));
  return {
    repoRoot: "/repo",
    files: scripts,
    roles: new Map(paths.map((p) => [p, "source" as const])),
    filesWithRole: () => scripts,
    styleFilesWithRole: () => paths.filter(isStyle),
    config: DustmapConfig.parse({ clones: { minTokens: 10, minLines: 3 } }),
    mode: "full",
    readFile: async (p) => files[p]!,
  };
}

const cart = `export function totalPrice(items) {
  let sum = 0;
  for (const it of items) sum += it.price * it.qty;
  return sum;
}`;

describe("normalized adapter (DUP-01 L1)", () => {
  it("reports a renamed copy once, high, with the rename map; leaves the other job alone", async () => {
    const findings = await runNormalizedClones(
      ctx({
        "cart.ts": cart,
        "checkout.ts": `export function orderValue(lines) {
  let total = 0;
  for (const l of lines) total += l.price * l.qty;
  return total;
}`,
        "shipping.ts": `export function totalWeight(parcels) {
  let grams = 0;
  for (const p of parcels) grams += p.weightG;
  return grams;
}`,
      }),
    );
    expect(findings).toHaveLength(1);
    const [f] = findings;
    expect(f!.kind).toBe("exact-clone");
    expect(f!.confidence).toBe("high");
    expect(f!.locations.map((l) => l.path)).toEqual(["cart.ts", "checkout.ts"]);
    expect(f!.evidence.find((e) => e.label === "renamed")!.value).toContain("sum → total");
  });

  it("a helper copied with its outer function is one finding, not two", async () => {
    const outer = (name: string) => `export function ${name}(xs) {
  const pick = (x) => {
    if (x.enabled && x.visible) return x.value * 2;
    return 0;
  };
  return xs.map(pick).filter((v) => v > 0);
}`;
    const findings = await runNormalizedClones(ctx({ "a.ts": outer("a"), "b.ts": outer("b") }));
    expect(findings.filter((f) => f.kind === "exact-clone")).toHaveLength(1);
  });

  it("CSS: the same rule under another name, types I–III, and shared sets in one file", async () => {
    const findings = await runNormalizedClones(
      ctx({
        "a.css": ".btn-primary { padding: 8px 16px; background: #ff0000; border-radius: 4px }",
        "b.css": ".cta { border-radius: 4px; background: red; padding: 8px 16px 8px 16px }",
        "c.css": `.card { display: flex; gap: 8px; color: #333; margin: 0 }
.panel { display: flex; gap: 8px; color: #333; margin: 0; padding: 12px }
.box { display: flex; gap: 8px; color: #333; margin: 0; border: 0 }
.other { display: block; color: #333 }`,
      }),
    );
    const whole = findings.find((f) => f.kind === "css-duplicate" && f.confidence === "high")!;
    expect(whole.locations.map((l) => l.symbol)).toEqual([".btn-primary", ".cta"]);
    expect(whole.evidence.find((e) => e.label === "duplication-types")!.value).toBe("II");
    const shared = findings.find((f) => f.kind === "css-duplicate" && f.confidence === "medium")!;
    expect(shared.locations.map((l) => l.symbol)).toEqual([".card", ".panel", ".box"]);
  });

  it("L2: a near copy is one finding against one copy of an identical pair, with the diff as evidence", async () => {
    const base = `export function loadUser(id) {
  const row = db.users.find(id);
  if (!row) throw new Error("missing user");
  const profile = mapProfile(row.profile);
  const roles = row.roles.map((r) => r.name);
  audit.log("user.load", row.id);
  return { id: row.id, profile, roles };
}`;
    const findings = await runNormalizedClones(
      ctx({ "a.ts": base, "b.ts": base.replace(/\brow\b/g, "rec"), "c.ts": base.replace("audit.log", "audit.trace") }),
    );
    const near = findings.filter((f) => f.kind === "near-clone");
    expect(near).toHaveLength(1);
    expect(near[0]!.locations.map((l) => l.path)).toEqual(["a.ts", "c.ts"]);
    const ev = (label: string) => near[0]!.evidence.find((e) => e.label === label)!.value;
    expect(ev("relation")).toBe("near-miss");
    expect(ev("members")).toContain("(+1 identical copy, see exact-clone)");
    expect(ev("diff")).toContain('+ loadUser:6 audit.trace("user.load", row.id);');
  });

  it("no style inventory → no CSS findings, scripts still checked", async () => {
    const c = ctx({ "a.ts": cart });
    delete c.styleFilesWithRole;
    expect(await runNormalizedClones(c)).toEqual([]);
  });
});
