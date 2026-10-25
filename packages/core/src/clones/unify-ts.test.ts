import { describe, expect, it } from "vitest";
import { unitDetail } from "./normalize-ts.js";
import { sketchScript, sketchText } from "./unify-ts.js";

const detail = (path: string, source: string, name: string, line?: number) =>
  unitDetail(path, source, line ?? source.split("\n").findIndex((l) => l.includes(name)) + 1, name)!;

const load = `export function loadUser(id: string) {
  const row = db.users.find(id);
  if (!row) throw new Error("missing user");
  audit.log("user.load", row.id);
  return row;
}`;

describe("unification sketch for scripts (DUP-05 L5)", () => {
  it("other constants and another called function become parameters; the sketch parses", () => {
    const fetch = `export function fetchUser(key: string) {
  const rec = db.users.find(key);
  if (!rec) throw new Error("no such user");
  audit.log("user.load", rec.id);
  return rec;
}`;
    const s = sketchScript(detail("a.ts", load, "loadUser"), [detail("b.ts", fetch, "fetchUser")]);
    expect(s.safe).toBe(true);
    if (!s.safe) return;
    expect(s.text).toBe(`export function loadUser(id: string, p1: string) {
  const row = db.users.find(id);
  if (!row) throw new Error(p1);
  audit.log("user.load", row.id);
  return row;
}`);
    expect(s.params).toEqual([{ name: "p1", values: ['"missing user"', '"no such user"'] }]);
  });

  it("a callee that differs becomes a callback parameter", () => {
    const a = `export async function approve(id: string) {
  const r = await acceptMediaAction({ id });
  if (!r.ok) return jsonError(r.error);
  return json({ ok: true });
}`;
    const b = `export async function decline(id: string) {
  const r = await rejectMediaAction({ id });
  if (!r.ok) return jsonError(r.error);
  return json({ ok: true });
}`;
    const s = sketchScript(detail("a.ts", a, "approve"), [detail("b.ts", b, "decline")]);
    expect(s.safe).toBe(true);
    if (!s.safe) return;
    expect(s.text).toContain("async function approve(id: string, p1: typeof acceptMediaAction)");
    expect(s.text).toContain("await p1({ id })");
    expect(sketchText(s, ["approve", "decline"])).toContain("decline: p1 = rejectMediaAction");
  });

  it("an added step, another property and another type give no sketch, with the reason", () => {
    const added = load.replace("loadUser", "loadUserChecked").replace("  return row;", '  metrics.count("user.load");\n  return row;');
    const prop = load.replace("loadUser", "loadUserMail").replace("row.id", "row.mail");
    const typed = load.replace("loadUser", "loadUserNum").replace("id: string", "id: number");
    const ref = detail("a.ts", load, "loadUser");
    const r1 = sketchScript(ref, [detail("b.ts", added, "loadUserChecked")]);
    const r2 = sketchScript(ref, [detail("c.ts", prop, "loadUserMail")]);
    const r3 = sketchScript(ref, [detail("d.ts", typed, "loadUserNum")]);
    expect(r1).toEqual({ safe: false, reason: "loadUserChecked adds 1 step(s) that loadUser lacks — a common form would need a flag or a callback" });
    expect(r2.safe ? "" : r2.reason).toContain("another property (id / mail)");
    expect(r3.safe ? "" : r3.reason).toContain("another type (string / number)");
    const named = load.replace("loadUser", "loadUserRef").replace("id: string", "id: UserId");
    const named2 = load.replace("loadUser", "loadUserKey").replace("id: string", "id: UserKey");
    const r4 = sketchScript(detail("e.ts", named, "loadUserRef"), [detail("f.ts", named2, "loadUserKey")]);
    expect(r4.safe ? "" : r4.reason).toContain("another type (UserId / UserKey)");
    const keyed = (k: string) => `export function headers${k.length}(token: string) {\n  const h = { "${k}": token, accept: "json" };\n  return fetchWith(h);\n}`;
    const r5 = sketchScript(detail("g.ts", keyed("x-auth"), "headers6"), [detail("h.ts", keyed("x-token"), "headers7")]);
    expect(r5.safe ? "" : r5.reason).toContain('another property ("x-auth" / "x-token")');
  });

  it("an arrow function with one bare parameter gets parentheses; JS gets no types", () => {
    const a = `const half = x => {\n  const y = x / 2;\n  return Math.round(y * 10) / 10;\n};`;
    const b = `const third = x => {\n  const y = x / 3;\n  return Math.round(y * 10) / 10;\n};`;
    const s = sketchScript(detail("a.js", a, "half"), [detail("b.js", b, "third")]);
    expect(s.safe).toBe(true);
    if (!s.safe) return;
    expect(s.text).toBe("const half = (x, p1) => {\n  const y = x / p1;\n  return Math.round(y * 10) / 10;\n};");
  });

  it("a template-string piece becomes ${p} between its delimiters", () => {
    const a = "export function ice(id: string) {\n  const url = `/v1/ice/${id}/patch`;\n  return http.post(url, { id });\n}";
    const b = "export function sweet(id: string) {\n  const url = `/v1/sweet/${id}/patch`;\n  return http.post(url, { id });\n}";
    const s = sketchScript(detail("a.ts", a, "ice"), [detail("b.ts", b, "sweet")]);
    expect(s.safe).toBe(true);
    if (!s.safe) return;
    expect(s.text).toContain("const url = `${p1}${id}/patch`;");
    expect(s.params).toEqual([{ name: "p1", values: ['"/v1/ice/"', '"/v1/sweet/"'] }]);
  });

  it("a component gets the differences as props, written as JSX expressions", () => {
    const a = `export function Hero({ title }) {\n  return (\n    <header className="hero-a">\n      <h1>{title}</h1>\n      <p>Ice cream</p>\n    </header>\n  );\n}`;
    const b = `export function Banner({ title }) {\n  return (\n    <header className="hero-b">\n      <h1>{title}</h1>\n      <p>Bakery</p>\n    </header>\n  );\n}`;
    const s = sketchScript(detail("a.jsx", a, "Hero"), [detail("b.jsx", b, "Banner")]);
    expect(s.safe).toBe(true);
    if (!s.safe) return;
    expect(s.text).toContain("function Hero({ title, p1, p2 })");
    expect(s.text).toContain("<header className={p1}>");
    expect(s.text).toContain("<p>{p2}</p>");
    expect(s.params[1]).toEqual({ name: "p2", values: ['"Ice cream"', '"Bakery"'] });
  });

  it("more differing values than a readable parameter list gives no sketch", () => {
    const mk = (n: string, v: number) => `export function ${n}(x: number) {\n  return [x + ${v}, x * ${v + 1}, x - ${v + 2}, x / ${v + 3}, x % ${v + 4}];\n}`;
    const s = sketchScript(detail("a.ts", mk("f", 10), "f"), [detail("b.ts", mk("g", 20), "g")]);
    expect(s.safe ? "" : s.reason).toContain("5 differing values");
  });

  it("new parameters go in front of an optional one (a required parameter cannot follow it)", () => {
    const mk = (n: string, p: string) => `export async function ${n}(base?: string) {\n  const out = await engineFetch(resolve(base), "${p}");\n  return out.body;\n}`;
    const s = sketchScript(detail("a.ts", mk("live", "/live"), "live"), [detail("b.ts", mk("outbox", "/v1/outbox"), "outbox")]);
    expect(s.safe ? s.text : s.reason).toContain("async function live(p1: string, base?: string)");
  });

  it("a method sketch parses inside its class", () => {
    const a = `class A {\n  count(xs: number[]) {\n    let n = 0;\n    for (const x of xs) if (x > 10) n++;\n    return n;\n  }\n}`;
    const b = `class B {\n  count(xs: number[]) {\n    let n = 0;\n    for (const x of xs) if (x > 20) n++;\n    return n;\n  }\n}`;
    const s = sketchScript(detail("a.ts", a, "A.count", 2), [detail("b.ts", b, "B.count", 2)]);
    expect(s.safe).toBe(true);
    if (!s.safe) return;
    expect(s.text).toContain("count(xs: number[], p1: number)");
  });
});
