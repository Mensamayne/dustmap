/**
 * Gold set, label `same`: one task, three implementations that really differ in shape (loop vs
 * reduce vs recursion, API vs manual, class vs closure). Hand-written on purpose — never produced by
 * the EMB-04 rewrite generator, so the meter does not reward a model for learning our own tricks.
 * Snippets avoid template literals so they can be stored as plain strings.
 */
const ts = String.raw;

export const sameFamilies = [
  {
    id: "sum-positive",
    variants: [
      ts`export function totalPositive(values: number[]): number {
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    if (values[i] > 0) {
      sum += values[i];
    }
  }
  return sum;
}`,
      ts`export const addUpPositives = (numbers: readonly number[]): number =>
  numbers.filter((n) => n > 0).reduce((acc, n) => acc + n, 0);`,
      ts`export function positiveSumRec(xs: number[], at = 0): number {
  if (at >= xs.length) {
    return 0;
  }
  const head = xs[at] > 0 ? xs[at] : 0;
  return head + positiveSumRec(xs, at + 1);
}`,
    ],
  },
  {
    id: "last-user-message",
    variants: [
      ts`export function lastUserText(messages: { role: string; content: string }[]): string | undefined {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user") {
      return messages[i].content.trim();
    }
  }
  return undefined;
}`,
      ts`export const userTextFromHistory = (history: Array<{ role: string; content: string }>) => {
  const turn = [...history].reverse().find((entry) => entry.role === "user");
  return turn ? turn.content.trim() : undefined;
};`,
      ts`export function latestPromptOf(log: { role: string; content: string }[]): string | undefined {
  const found = log.reduce<{ role: string; content: string } | undefined>(
    (latest, item) => (item.role === "user" ? item : latest),
    undefined,
  );
  return found?.content.trim();
}`,
    ],
  },
  {
    id: "group-by",
    variants: [
      ts`export function groupByKey<T>(items: T[], key: (item: T) => string): Record<string, T[]> {
  const out: Record<string, T[]> = {};
  for (const item of items) {
    const k = key(item);
    if (!out[k]) out[k] = [];
    out[k].push(item);
  }
  return out;
}`,
      ts`export const bucketize = <T>(rows: readonly T[], pick: (row: T) => string): Map<string, T[]> =>
  rows.reduce((map, row) => {
    const k = pick(row);
    map.set(k, [...(map.get(k) ?? []), row]);
    return map;
  }, new Map<string, T[]>());`,
      ts`export function partitionBy<T>(list: T[], classify: (x: T) => string) {
  const groups = new Map<string, T[]>();
  list.forEach((x) => {
    const bucket = groups.get(classify(x));
    if (bucket) bucket.push(x);
    else groups.set(classify(x), [x]);
  });
  return Object.fromEntries(groups);
}`,
    ],
  },
  {
    id: "debounce",
    variants: [
      ts`export function debounce<A extends unknown[]>(fn: (...args: A) => void, waitMs: number) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return (...args: A) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}`,
      ts`export class Debouncer<A extends unknown[]> {
  private handle: ReturnType<typeof setTimeout> | null = null;
  constructor(private readonly action: (...args: A) => void, private readonly delay: number) {}
  call(...args: A): void {
    if (this.handle !== null) clearTimeout(this.handle);
    this.handle = setTimeout(() => {
      this.handle = null;
      this.action(...args);
    }, this.delay);
  }
}`,
      ts`export const quiet = <A extends unknown[]>(callback: (...a: A) => void, ms: number) => {
  const state = { pending: undefined as ReturnType<typeof setTimeout> | undefined };
  return function trigger(...a: A) {
    clearTimeout(state.pending);
    state.pending = setTimeout(callback, ms, ...a);
  };
};`,
    ],
  },
  {
    id: "parse-query",
    variants: [
      ts`export function parseQuery(qs: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const part of qs.replace(/^\?/, "").split("&")) {
    if (!part) continue;
    const [k, v = ""] = part.split("=");
    result[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, " "));
  }
  return result;
}`,
      ts`export const queryToObject = (search: string): Record<string, string> =>
  Object.fromEntries(new URLSearchParams(search).entries());`,
      ts`export function readParams(input: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /[?&]?([^=&]+)=?([^&]*)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(input)) !== null) {
    out[decodeURIComponent(m[1])] = decodeURIComponent(m[2].split("+").join(" "));
  }
  return out;
}`,
    ],
  },
  {
    id: "chunk",
    variants: [
      ts`export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}`,
      ts`export const inBatches = <T>(items: readonly T[], n: number): T[][] =>
  items.reduce<T[][]>((batches, item, i) => {
    if (i % n === 0) batches.push([]);
    batches[batches.length - 1].push(item);
    return batches;
  }, []);`,
      ts`export function splitEvery<T>(list: T[], width: number): T[][] {
  return Array.from({ length: Math.ceil(list.length / width) }, (_, row) =>
    list.slice(row * width, row * width + width),
  );
}`,
    ],
  },
  {
    id: "deep-equal",
    variants: [
      ts`export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}`,
      ts`export function sameShape(x: unknown, y: unknown): boolean {
  const stack: Array<[unknown, unknown]> = [[x, y]];
  while (stack.length) {
    const [p, q] = stack.pop()!;
    if (p === q) continue;
    if (!p || !q || typeof p !== "object" || typeof q !== "object") return false;
    const pk = Object.keys(p);
    if (pk.length !== Object.keys(q).length) return false;
    for (const k of pk) stack.push([(p as any)[k], (q as any)[k]]);
  }
  return true;
}`,
      ts`export const structurallyEqual = (l: any, r: any): boolean =>
  l === r ||
  (l !== null &&
    r !== null &&
    typeof l === "object" &&
    typeof r === "object" &&
    Object.keys(l).length === Object.keys(r).length &&
    Object.keys(l).every((k) => structurallyEqual(l[k], r[k])));`,
    ],
  },
  {
    id: "retry",
    variants: [
      ts`export async function withRetry<T>(op: () => Promise<T>, attempts: number): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await op();
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError;
}`,
      ts`export async function tryTimes<T>(task: () => Promise<T>, left: number): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (left <= 1) throw error;
    return tryTimes(task, left - 1);
  }
}`,
      ts`export function retryPromise<T>(make: () => Promise<T>, max: number): Promise<T> {
  let attempt = 0;
  const run = (): Promise<T> =>
    make().catch((e) => {
      attempt += 1;
      return attempt < max ? run() : Promise.reject(e);
    });
  return run();
}`,
    ],
  },
  {
    id: "title-case",
    variants: [
      ts`export function titleCase(text: string): string {
  return text
    .split(" ")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}`,
      ts`export const capitalizeWords = (s: string): string =>
  s.toLowerCase().replace(/(^|\s)(\p{L})/gu, (_, space, ch) => space + ch.toUpperCase());`,
      ts`export function headline(input: string): string {
  let out = "";
  let startOfWord = true;
  for (const ch of input) {
    out += startOfWord ? ch.toUpperCase() : ch.toLowerCase();
    startOfWord = ch === " ";
  }
  return out;
}`,
    ],
  },
  {
    id: "unique-by-id",
    variants: [
      ts`export function uniqueById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}`,
      ts`export const dedupeRecords = <R extends { id: string }>(rows: R[]): R[] => [
  ...rows.reduce((first, r) => (first.has(r.id) ? first : first.set(r.id, r)), new Map<string, R>()).values(),
];`,
      ts`export function distinctEntities<E extends { id: string }>(list: E[]): E[] {
  const byId: Record<string, E> = {};
  const order: string[] = [];
  for (const e of list) {
    if (!(e.id in byId)) {
      byId[e.id] = e;
      order.push(e.id);
    }
  }
  return order.map((id) => byId[id]);
}`,
    ],
  },
  {
    id: "leap-year",
    variants: [
      ts`export function isLeapYear(year: number): boolean {
  if (year % 400 === 0) return true;
  if (year % 100 === 0) return false;
  return year % 4 === 0;
}`,
      ts`export const hasFeb29 = (y: number): boolean => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;`,
      ts`export function leap(yearNumber: number): boolean {
  return new Date(Date.UTC(yearNumber, 1, 29)).getUTCMonth() === 1;
}`,
    ],
  },
  {
    id: "flatten",
    variants: [
      ts`export function flattenDeep(input: unknown[]): unknown[] {
  return input.reduce<unknown[]>(
    (acc, x) => (Array.isArray(x) ? acc.concat(flattenDeep(x)) : acc.concat([x])),
    [],
  );
}`,
      ts`export function flatAll(nested: unknown[]): unknown[] {
  const out: unknown[] = [];
  const stack = [...nested].reverse();
  while (stack.length) {
    const next = stack.pop();
    if (Array.isArray(next)) stack.push(...[...next].reverse());
    else out.push(next);
  }
  return out;
}`,
      ts`export function* walkLeaves(tree: unknown[]): Generator<unknown> {
  for (const node of tree) {
    if (Array.isArray(node)) yield* walkLeaves(node);
    else yield node;
  }
}
export const leaves = (tree: unknown[]): unknown[] => [...walkLeaves(tree)];`,
    ],
  },
  {
    id: "word-frequency",
    variants: [
      ts`export function wordCounts(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of text.toLowerCase().split(/\W+/)) {
    if (!word) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return counts;
}`,
      ts`export const tally = (body: string): Record<string, number> =>
  (body.toLowerCase().match(/\w+/g) ?? []).reduce<Record<string, number>>((acc, w) => {
    acc[w] = (acc[w] || 0) + 1;
    return acc;
  }, {});`,
      ts`export function frequencies(doc: string) {
  const result: { [term: string]: number } = {};
  for (const match of doc.matchAll(/[A-Za-z0-9_]+/g)) {
    const term = match[0].toLowerCase();
    result[term] = term in result ? result[term] + 1 : 1;
  }
  return result;
}`,
    ],
  },
  {
    id: "pick-keys",
    variants: [
      ts`export function pick<T extends object, K extends keyof T>(obj: T, keys: K[]): Pick<T, K> {
  const out = {} as Pick<T, K>;
  for (const k of keys) {
    if (k in obj) out[k] = obj[k];
  }
  return out;
}`,
      ts`export const onlyFields = (source: Record<string, unknown>, fields: string[]) =>
  Object.fromEntries(Object.entries(source).filter(([key]) => fields.includes(key)));`,
      ts`export function subset(record: Record<string, unknown>, wanted: readonly string[]) {
  return wanted.reduce<Record<string, unknown>>((acc, name) => {
    if (Object.prototype.hasOwnProperty.call(record, name)) acc[name] = record[name];
    return acc;
  }, {});
}`,
    ],
  },
  {
    id: "binary-search",
    variants: [
      ts`export function binarySearch(sorted: number[], target: number): number {
  let lo = 0;
  let hi = sorted.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (sorted[mid] === target) return mid;
    if (sorted[mid] < target) lo = mid + 1;
    else hi = mid - 1;
  }
  return -1;
}`,
      ts`export function findIndexSorted(xs: number[], x: number, from = 0, to = xs.length - 1): number {
  if (from > to) return -1;
  const middle = (from + to) >> 1;
  if (xs[middle] === x) return middle;
  return xs[middle] < x ? findIndexSorted(xs, x, middle + 1, to) : findIndexSorted(xs, x, from, middle - 1);
}`,
      ts`export const locate = (values: readonly number[], wanted: number): number => {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const m = (left + right) >>> 1;
    if (values[m] < wanted) left = m + 1;
    else right = m;
  }
  return values[left] === wanted ? left : -1;
};`,
    ],
  },
  {
    id: "ensure-local-user",
    variants: [
      ts`export async function ensureLocalUser(repo: UserRepo, email: string, role: string) {
  const existing = await repo.findByEmail(email);
  if (existing) {
    return existing;
  }
  return repo.create({ email, role, createdAt: new Date() });
}`,
      ts`export function getOrCreateUser(users: UserRepo, address: string, kind: string) {
  return users
    .findByEmail(address)
    .then((found) => found ?? users.create({ email: address, role: kind, createdAt: new Date() }));
}`,
      ts`export async function upsertDevUser(store: UserRepo, mail: string, roleName: string) {
  const user = (await store.findByEmail(mail)) ?? null;
  if (user !== null) return user;
  const fresh = { email: mail, role: roleName, createdAt: new Date() };
  return await store.create(fresh);
}`,
    ],
  },
  {
    id: "camel-case",
    variants: [
      ts`export function toCamelCase(s: string): string {
  return s.replace(/[-_\s]+(.)?/g, (_, c: string | undefined) => (c ? c.toUpperCase() : ""));
}`,
      ts`export function camelize(name: string): string {
  const parts = name.split(/[-_ ]+/).filter(Boolean);
  let out = parts[0]?.toLowerCase() ?? "";
  for (const p of parts.slice(1)) {
    out += p[0].toUpperCase() + p.slice(1).toLowerCase();
  }
  return out;
}`,
      ts`export const lowerCamel = (key: string): string =>
  key
    .split(/[^A-Za-z0-9]/)
    .filter((w) => w.length > 0)
    .reduce((acc, w, i) => acc + (i === 0 ? w.toLowerCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()), "");`,
    ],
  },
  {
    id: "cart-total",
    variants: [
      ts`export function cartTotal(lines: { price: number; qty: number; vat: number }[]): number {
  let total = 0;
  for (const line of lines) {
    const net = line.price * line.qty;
    total += net + net * line.vat;
  }
  return Math.round(total * 100) / 100;
}`,
      ts`export const grossOf = (items: Array<{ price: number; qty: number; vat: number }>): number =>
  Math.round(items.reduce((sum, { price, qty, vat }) => sum + price * qty * (1 + vat), 0) * 100) / 100;`,
      ts`export function orderGross(rows: { price: number; qty: number; vat: number }[]) {
  const amounts = rows.map((r) => r.price * r.qty * (1 + r.vat));
  const sum = amounts.reduce((a, b) => a + b, 0);
  return Number(sum.toFixed(2));
}`,
    ],
  },
];
