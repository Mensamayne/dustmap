/**
 * Gold set, label `different`, hand-written hard cases: the same function name doing something else,
 * and inverse mappings (DUST-15 #17) that share vocabulary but mean the opposite. Easy cross-family
 * pairs are added by build-public.mjs.
 */
const ts = String.raw;

export const differentPairs = [
  {
    id: "same-name-normalize",
    why: "normalize: tekst vs wektor",
    a: ts`export function normalize(input: string): string {
  return input.normalize("NFKD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}`,
    b: ts`export function normalize(v: number[]): number[] {
  const len = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return len === 0 ? v : v.map((x) => x / len);
}`,
  },
  {
    id: "same-name-format",
    why: "format: data vs kwota",
    a: ts`export function format(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}`,
    b: ts`export function format(cents: number, currency = "PLN"): string {
  return new Intl.NumberFormat("pl-PL", { style: "currency", currency }).format(cents / 100);
}`,
  },
  {
    id: "same-name-merge",
    why: "merge: obiekty vs posortowane tablice",
    a: ts`export function merge<T extends object>(base: T, patch: Partial<T>): T {
  const out = { ...base };
  for (const [k, v] of Object.entries(patch)) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}`,
    b: ts`export function merge(a: number[], b: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (j >= b.length || (i < a.length && a[i] <= b[j])) out.push(a[i++]);
    else out.push(b[j++]);
  }
  return out;
}`,
  },
  {
    id: "same-name-parse",
    why: "parse: liczba z jednostką vs nagłówek cookie",
    a: ts`export function parse(size: string): number {
  const m = /^(\d+(?:\.\d+)?)\s*(kb|mb|gb)?$/i.exec(size.trim());
  if (!m) throw new Error("bad size");
  const mult = { kb: 1024, mb: 1024 ** 2, gb: 1024 ** 3 }[(m[2] ?? "").toLowerCase()] ?? 1;
  return Number(m[1]) * mult;
}`,
    b: ts`export function parse(header: string): Record<string, string> {
  const jar: Record<string, string> = {};
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k) jar[k] = decodeURIComponent(rest.join("="));
  }
  return jar;
}`,
  },
  {
    id: "same-name-validate",
    why: "validate: koszyk vs token JWT",
    a: ts`export function validate(cart: { lines: { qty: number }[] }): string[] {
  const errors: string[] = [];
  if (cart.lines.length === 0) errors.push("empty cart");
  if (cart.lines.some((l) => l.qty <= 0)) errors.push("bad quantity");
  return errors;
}`,
    b: ts`export function validate(token: string, now: number): boolean {
  const [, payload] = token.split(".");
  if (!payload) return false;
  const claims = JSON.parse(atob(payload));
  return typeof claims.exp === "number" && claims.exp * 1000 > now;
}`,
  },
  {
    id: "same-name-total",
    why: "total: suma kwot vs liczba unikalnych",
    a: ts`export function total(items: { amount: number }[]): number {
  return items.reduce((s, i) => s + i.amount, 0);
}`,
    b: ts`export function total(items: { userId: string }[]): number {
  return new Set(items.map((i) => i.userId)).size;
}`,
  },
  {
    id: "same-name-load",
    why: "load: plik JSON vs wpis z cache z TTL",
    a: ts`export async function load(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text);
}`,
    b: ts`export function load<T>(cache: Map<string, { value: T; at: number }>, key: string, ttlMs: number): T | undefined {
  const hit = cache.get(key);
  if (!hit || Date.now() - hit.at > ttlMs) return undefined;
  return hit.value;
}`,
  },
  {
    id: "same-name-resolve",
    why: "resolve: ścieżka modułu vs kolizja wersji",
    a: ts`export function resolve(from: string, spec: string): string {
  if (!spec.startsWith(".")) return spec;
  const parts = from.split("/").slice(0, -1);
  for (const seg of spec.split("/")) {
    if (seg === "..") parts.pop();
    else if (seg !== ".") parts.push(seg);
  }
  return parts.join("/");
}`,
    b: ts`export function resolve(versions: string[]): string {
  return [...versions].sort((x, y) => {
    const a = x.split(".").map(Number);
    const b = y.split(".").map(Number);
    return b[0] - a[0] || b[1] - a[1] || b[2] - a[2];
  })[0];
}`,
  },
  {
    id: "same-name-diff",
    why: "diff: różnica zbiorów vs dni między datami",
    a: ts`export function diff<T>(before: T[], after: T[]): { added: T[]; removed: T[] } {
  const b = new Set(before);
  const a = new Set(after);
  return { added: after.filter((x) => !b.has(x)), removed: before.filter((x) => !a.has(x)) };
}`,
    b: ts`export function diff(from: Date, to: Date): number {
  const day = 24 * 60 * 60 * 1000;
  return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate()) - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / day);
}`,
  },
  {
    id: "same-name-score",
    why: "score: siła hasła vs wynik gry w kręgle",
    a: ts`export function score(password: string): number {
  let s = Math.min(password.length, 20);
  if (/[A-Z]/.test(password)) s += 5;
  if (/[0-9]/.test(password)) s += 5;
  if (/[^A-Za-z0-9]/.test(password)) s += 10;
  return s;
}`,
    b: ts`export function score(rolls: number[]): number {
  let total = 0;
  let i = 0;
  for (let frame = 0; frame < 10; frame++) {
    if (rolls[i] === 10) { total += 10 + rolls[i + 1] + rolls[i + 2]; i += 1; }
    else if (rolls[i] + rolls[i + 1] === 10) { total += 10 + rolls[i + 2]; i += 2; }
    else { total += rolls[i] + rolls[i + 1]; i += 2; }
  }
  return total;
}`,
  },
  {
    id: "same-name-send",
    why: "send: e-mail przez SMTP vs wiadomość do workera",
    a: ts`export async function send(to: string, subject: string, html: string) {
  await smtp.sendMail({ from: "noreply@example.com", to, subject, html });
}`,
    b: ts`export function send(worker: Worker, type: string, payload: unknown): Promise<unknown> {
  return new Promise((resolve) => {
    const id = crypto.randomUUID();
    const onMsg = (e: MessageEvent) => {
      if (e.data.id === id) { worker.removeEventListener("message", onMsg); resolve(e.data.result); }
    };
    worker.addEventListener("message", onMsg);
    worker.postMessage({ id, type, payload });
  });
}`,
  },
  {
    id: "same-name-filter",
    why: "filter: wulgaryzmy vs wartości odstające",
    a: ts`export function filter(text: string, banned: string[]): string {
  return banned.reduce((t, word) => t.replace(new RegExp("\\b" + word + "\\b", "gi"), "*".repeat(word.length)), text);
}`,
    b: ts`export function filter(samples: number[]): number[] {
  const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
  const sd = Math.sqrt(samples.reduce((a, b) => a + (b - mean) ** 2, 0) / samples.length);
  return samples.filter((x) => Math.abs(x - mean) <= 2 * sd);
}`,
  },
  {
    id: "inverse-temperature",
    why: "odwrotne mapowania: C→F vs F→C",
    a: ts`export function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}`,
    b: ts`export function fahrenheitToCelsius(f: number): number {
  return Math.round(((f - 32) * 5) / 9);
}`,
  },
  {
    id: "inverse-base64",
    why: "odwrotne: kodowanie vs dekodowanie",
    a: ts`export function encodeBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}`,
    b: ts`export function decodeBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(text.length / 4) * 4, "=");
  const bin = atob(b64);
  return Uint8Array.from(bin, (ch) => ch.charCodeAt(0));
}`,
  },
  {
    id: "inverse-consent",
    why: "odwrotne mapowania stanu zgody (DUST-15 #17)",
    a: ts`export function consentStateForDecision(decision: "accept" | "reject" | "later"): ConsentState {
  if (decision === "accept") return { granted: true, askAgainAt: null };
  if (decision === "reject") return { granted: false, askAgainAt: null };
  return { granted: false, askAgainAt: Date.now() + 7 * 86400000 };
}`,
    b: ts`export function decisionForConsentState(state: ConsentState): "accept" | "reject" | "later" {
  if (state.granted) return "accept";
  if (state.askAgainAt === null) return "reject";
  return "later";
}`,
  },
  {
    id: "inverse-serialize",
    why: "odwrotne: zapis vs odczyt formatu",
    a: ts`export function serializeRow(row: { id: string; tags: string[]; at: Date }): string {
  return [row.id, row.tags.join("|"), row.at.toISOString()].join(";");
}`,
    b: ts`export function deserializeRow(line: string): { id: string; tags: string[]; at: Date } {
  const [id, tags, at] = line.split(";");
  return { id, tags: tags ? tags.split("|") : [], at: new Date(at) };
}`,
  },
];
