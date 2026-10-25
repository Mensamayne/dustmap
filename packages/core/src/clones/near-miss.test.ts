import { describe, expect, it } from "vitest";
import { diffCounts, diffText, nearGroups, nearPairs, nearRenames, type NearOptions } from "./near-miss.js";
import { normalizedUnits, type NormalizedUnit } from "./normalize-ts.js";

const OPTS: NearOptions = { minLines: 3, minSimilarity: 0.7, minCoverage: 0.9 };
const units = (files: Record<string, string>): NormalizedUnit[] => Object.entries(files).flatMap(([p, src]) => normalizedUnits(p, src, 1, 1));
const pairs = (files: Record<string, string>) => {
  const us = units(files);
  return nearPairs(us, OPTS, (x, y) => x.exactKey === y.exactKey || x.shapeKey === y.shapeKey, () => true);
};

const load = `export function loadUser(id) {
  const row = db.users.find(id);
  if (!row) throw new Error("missing user");
  const profile = mapProfile(row.profile);
  const roles = row.roles.map((r) => r.name);
  audit.log("user.load", row.id);
  return { id: row.id, profile, roles };
}`;

describe("near copies and containment (DUP-02 L2)", () => {
  it("a copy with one changed line is a near copy; the diff names the line and the renames", () => {
    const found = pairs({
      "a.ts": load,
      "b.ts": `export function fetchUser(key) {
  const rec = db.users.find(key);
  if (!rec) throw new Error("missing user");
  const profile = mapProfile(rec.profile);
  const roles = rec.roles.map((r) => r.name);
  audit.trace("user.fetch", rec.id);
  return { id: rec.id, profile, roles };
}`,
    });
    expect(found).toHaveLength(1);
    const p = found[0]!;
    expect(p.relation).toBe("near-miss");
    expect(diffCounts(p.ops)).toEqual({ same: 10, changed: 1, onlyA: 0, onlyB: 0 });
    expect(nearRenames(p.ops)).toEqual(expect.arrayContaining([["loadUser", "fetchUser"], ["id", "key"], ["row", "rec"]]));
    expect(diffText(p, 10)).toBe('- loadUser:6 audit.log("user.load", row.id);\n+ fetchUser:6 audit.trace("user.fetch", rec.id);');
  });

  it("a copy with added steps contains the original", () => {
    const found = pairs({
      "a.ts": load,
      "b.ts": `export function loadUserChecked(id) {
  const row = db.users.find(id);
  if (!row) throw new Error("missing user");
  if (row.deleted) throw new Error("deleted user");
  metrics.count("user.load");
  const profile = mapProfile(row.profile);
  const roles = row.roles.map((r) => r.name);
  const teams = row.teams.map((t) => t.slug);
  const flags = features.forUser(row.id);
  audit.log("user.load", row.id);
  return { id: row.id, profile, roles, teams, flags };
}`,
    });
    expect(found).toHaveLength(1);
    expect(found[0]!.relation).toBe("contains");
    expect(found[0]!.a.name).toBe("loadUser");
    expect(found[0]!.b.name).toBe("loadUserChecked");
  });

  it("another skeleton is nothing", () => {
    const found = pairs({
      "a.ts": load,
      "b.ts": `export function sumPrices(items) {
  let total = 0;
  for (const it of items) total += it.price;
  if (total > LIMIT) warn("over limit", total);
  const rounded = Math.round(total * 100) / 100;
  return rounded;
}`,
    });
    expect(found).toEqual([]);
  });

  it("line wrapping and trailing commas are formatting: the same code wrapped is not a near copy", () => {
    const wrapped = `export function loadUser(
  id,
) {
  const row = db.users.find(
    id,
  );
  if (!row) throw new Error("missing user");
  const profile = mapProfile(row.profile);
  const roles = row.roles.map((r) => r.name);
  audit.log(
    "user.load",
    row.id,
  );
  return { id: row.id, profile, roles };
}`;
    const [a, b] = units({ "a.ts": load, "b.ts": wrapped });
    expect(b!.exactKey).toBe(a!.exactKey);
    expect(b!.lines.map((l) => l.text)).toEqual(a!.lines.map((l) => l.text));
    expect(b!.lines[0]!.spans).toEqual([1, 2, 3, 15]);
  });

  it("a method copied into another class pairs with the method, not with the whole class", () => {
    const method = `  async ensureIndexes() {
    const col = await getCollection(NAME);
    for (const spec of jobsCollection.indexes) {
      try {
        await col.createIndex(spec.key, spec.options);
      } catch (e) {
        log.warn("index failed", spec.key, e);
      }
    }
  }`;
    const found = pairs({
      "jobs.ts": `class JobsRepository {\n${method}\n}`,
      "runs.ts": `class RunsRepository {
${method.replace("jobsCollection", "runsCollection")}
  async insert(doc) {
    const col = await getCollection(NAME);
    await col.insertOne({ ...doc, at: Date.now() });
    return doc.id;
  }
}`,
    });
    expect(found.map((p) => `${p.relation} ${p.a.name} ${p.b.name}`)).not.toContain("contains JobsRepository.ensureIndexes RunsRepository");
    expect(found.some((p) => p.a.name === "JobsRepository.ensureIndexes" && p.b.name === "RunsRepository.ensureIndexes")).toBe(true);
  });

  it("a family of near copies is one group around the unit with most near copies", () => {
    const variant = (event: string, extra: string) => load.replace("loadUser", `load_${event}`).replace('"user.load"', `"${event}"`).replace("  return", `${extra}\n  return`);
    const found = pairs({
      "a.ts": variant("a", ""),
      "b.ts": variant("b", ""),
      "c.ts": variant("c", ""),
    });
    const groups = nearGroups(found);
    // The three differ only in the audit constant: one L1 shape group, so L2 has nothing to add.
    expect(found).toEqual([]);
    expect(groups).toEqual([]);
    const family = pairs({
      "a.ts": variant("a", "  metrics.count(1);"),
      "b.ts": variant("b", "  metrics.count(2, 3);"),
      "c.ts": variant("c", "  cache.drop(id);"),
    });
    const g = nearGroups(family);
    expect(g).toHaveLength(1);
    expect(g[0]!.relation).toBe("near-miss");
    expect(g[0]!.members).toHaveLength(2);
  });
});
