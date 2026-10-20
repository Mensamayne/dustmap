/**
 * Gold set, label `pattern`: code that looks alike by design — the same skeleton (handler preamble,
 * defineAction config, route try/catch, reducer case) around different logic. DUST-15 found these to
 * be the most common false alarm. Four variants per family; the builder pairs neighbours.
 */
const ts = String.raw;

export const patternFamilies = [
  {
    id: "action-handler-preamble",
    variants: [
      ts`export async function listInvoices(req: Req) {
  const session = await requireSession(req);
  if (!session.roles.includes("billing")) throw new Forbidden();
  const rows = await db.invoice.findMany({ where: { tenantId: session.tenantId } });
  return rows.map((r) => ({ id: r.id, total: r.total, due: r.dueAt.toISOString() }));
}`,
      ts`export async function archiveProject(req: Req) {
  const session = await requireSession(req);
  if (!session.roles.includes("owner")) throw new Forbidden();
  const id = String(req.params.id);
  await db.project.update({ where: { id }, data: { archivedAt: new Date() } });
  await audit.log(session.userId, "project.archive", id);
}`,
      ts`export async function updatePreferences(req: Req) {
  const session = await requireSession(req);
  if (!session.roles.includes("member")) throw new Forbidden();
  const prefs = PrefsSchema.parse(req.body);
  return db.preferences.upsert({ where: { userId: session.userId }, create: prefs, update: prefs });
}`,
      ts`export async function exportReport(req: Req) {
  const session = await requireSession(req);
  if (!session.roles.includes("analyst")) throw new Forbidden();
  const csv = toCsv(await metrics.dailyTotals(session.tenantId, 30));
  return new Response(csv, { headers: { "content-type": "text/csv" } });
}`,
    ],
  },
  {
    id: "define-action",
    variants: [
      ts`export const mixRead = defineAction({
  name: "mix.read",
  input: z.object({ mixId: z.string() }),
  handler: async ({ mixId }, ctx) => ctx.db.mix.findUniqueOrThrow({ where: { id: mixId } }),
});`,
      ts`export const mixDecide = defineAction({
  name: "mix.decide",
  input: z.object({ mixId: z.string(), accept: z.boolean() }),
  handler: async ({ mixId, accept }, ctx) =>
    ctx.db.mix.update({ where: { id: mixId }, data: { status: accept ? "accepted" : "rejected" } }),
});`,
      ts`export const quotaUsage = defineAction({
  name: "quota.usage",
  input: z.object({ days: z.number().int().min(1).max(90) }),
  handler: async ({ days }, ctx) => ctx.usage.sumSince(ctx.tenantId, daysAgo(days)),
});`,
      ts`export const consentAccept = defineAction({
  name: "consent.accept",
  input: z.object({ version: z.string() }),
  handler: async ({ version }, ctx) => ctx.db.consent.create({ data: { userId: ctx.userId, version } }),
});`,
    ],
  },
  {
    id: "route-try-catch",
    variants: [
      ts`router.get("/orders/:id", async (req, res) => {
  try {
    const order = await orders.byId(req.params.id);
    if (!order) return res.status(404).json({ error: "not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});`,
      ts`router.post("/orders/:id/refund", async (req, res) => {
  try {
    const refund = await payments.refund(req.params.id, Number(req.body.amount));
    res.status(201).json(refund);
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});`,
      ts`router.delete("/sessions/:id", async (req, res) => {
  try {
    await sessions.revoke(req.params.id);
    res.status(204).end();
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});`,
      ts`router.get("/health", async (_req, res) => {
  try {
    const dbOk = await db.ping();
    res.json({ ok: dbOk, uptime: process.uptime() });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});`,
    ],
  },
  {
    id: "reducer-case",
    variants: [
      ts`function cartReducer(state: Cart, action: CartAction): Cart {
  switch (action.type) {
    case "add":
      return { ...state, lines: [...state.lines, action.line] };
    default:
      return state;
  }
}`,
      ts`function authReducer(state: Auth, action: AuthAction): Auth {
  switch (action.type) {
    case "logout":
      return { user: null, token: null, expiresAt: 0 };
    default:
      return state;
  }
}`,
      ts`function filterReducer(state: Filters, action: FilterAction): Filters {
  switch (action.type) {
    case "toggle":
      return { ...state, active: state.active.includes(action.tag) ? state.active.filter((t) => t !== action.tag) : [...state.active, action.tag] };
    default:
      return state;
  }
}`,
      ts`function pagingReducer(state: Paging, action: PagingAction): Paging {
  switch (action.type) {
    case "next":
      return { ...state, page: Math.min(state.page + 1, state.pages) };
    default:
      return state;
  }
}`,
    ],
  },
  {
    id: "fetch-wrapper",
    variants: [
      ts`export async function fetchUser(id: string): Promise<User> {
  const res = await fetch("/api/users/" + id);
  if (!res.ok) throw new Error("users " + res.status);
  const body = await res.json();
  return { ...body, createdAt: new Date(body.createdAt) };
}`,
      ts`export async function fetchPrices(currency: string): Promise<number[]> {
  const res = await fetch("/api/prices?c=" + currency);
  if (!res.ok) throw new Error("prices " + res.status);
  const body = await res.json();
  return body.items.map((i: { amount: number }) => i.amount / 100);
}`,
      ts`export async function fetchFlags(): Promise<Set<string>> {
  const res = await fetch("/api/flags");
  if (!res.ok) throw new Error("flags " + res.status);
  const body = await res.json();
  return new Set(Object.keys(body).filter((k) => body[k] === true));
}`,
      ts`export async function fetchInbox(page: number): Promise<Message[]> {
  const res = await fetch("/api/inbox?page=" + page);
  if (!res.ok) throw new Error("inbox " + res.status);
  const body = await res.json();
  return body.messages.sort((a: Message, b: Message) => b.sentAt - a.sentAt);
}`,
    ],
  },
  {
    id: "store-factory",
    variants: [
      ts`export const createCartStore = () =>
  createStore({
    name: "cart",
    persist: true,
    initial: { lines: [] as CartLine[] },
  });`,
      ts`export const createThemeStore = () =>
  createStore({
    name: "theme",
    persist: true,
    initial: { mode: "system" as "light" | "dark" | "system" },
  });`,
      ts`export const createDraftStore = () =>
  createStore({
    name: "draft",
    persist: false,
    initial: { text: "", savedAt: null as Date | null },
  });`,
      ts`export const createSearchStore = () =>
  createStore({
    name: "search",
    persist: false,
    initial: { query: "", results: [] as Hit[], loading: false },
  });`,
    ],
  },
  {
    id: "validator",
    variants: [
      ts`export function validateEmail(value: string): string | null {
  if (!value) return "required";
  if (value.length > 254) return "too long";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return "invalid email";
  return null;
}`,
      ts`export function validatePassword(value: string): string | null {
  if (!value) return "required";
  if (value.length < 12) return "too short";
  if (!/[0-9]/.test(value) || !/[A-Z]/.test(value)) return "needs a digit and a capital";
  return null;
}`,
      ts`export function validatePostcode(value: string): string | null {
  if (!value) return "required";
  if (value.length !== 6) return "wrong length";
  if (!/^\d{2}-\d{3}$/.test(value)) return "use NN-NNN";
  return null;
}`,
      ts`export function validateNip(value: string): string | null {
  if (!value) return "required";
  if (value.replace(/-/g, "").length !== 10) return "wrong length";
  const d = value.replace(/-/g, "").split("").map(Number);
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7];
  return w.reduce((s, x, i) => s + x * d[i], 0) % 11 === d[9] ? null : "bad checksum";
}`,
    ],
  },
  {
    id: "event-listener",
    variants: [
      ts`bus.on("order.paid", async (event: OrderPaid) => {
  logger.info("order paid", { id: event.orderId });
  await mailer.send(event.email, "receipt", { orderId: event.orderId });
});`,
      ts`bus.on("user.deleted", async (event: UserDeleted) => {
  logger.info("user deleted", { id: event.userId });
  await storage.removePrefix("avatars/" + event.userId);
});`,
      ts`bus.on("stock.low", async (event: StockLow) => {
  logger.info("stock low", { sku: event.sku });
  await purchasing.createDraftOrder(event.sku, event.reorderQty);
});`,
      ts`bus.on("plan.changed", async (event: PlanChanged) => {
  logger.info("plan changed", { tenant: event.tenantId });
  await quotas.recompute(event.tenantId, event.plan);
});`,
    ],
  },
  {
    id: "cli-command",
    variants: [
      ts`program
  .command("init")
  .option("--force", "overwrite")
  .action(async (opts) => {
    await writeConfig(process.cwd(), { overwrite: Boolean(opts.force) });
    console.log("config written");
  });`,
      ts`program
  .command("clean")
  .option("--dry", "only print")
  .action(async (opts) => {
    const files = await listBuildOutput(process.cwd());
    if (!opts.dry) await Promise.all(files.map((f) => rm(f)));
    console.log(files.length + " files");
  });`,
      ts`program
  .command("login")
  .option("--token <t>", "api token")
  .action(async (opts) => {
    const token = opts.token ?? (await prompt("token: "));
    await keychain.set("api", token);
    console.log("logged in");
  });`,
      ts`program
  .command("stats")
  .option("--json", "machine output")
  .action(async (opts) => {
    const s = await collectStats(process.cwd());
    console.log(opts.json ? JSON.stringify(s) : formatTable(s));
  });`,
    ],
  },
  {
    id: "migration",
    variants: [
      ts`export async function up(db: Knex) {
  await db.schema.createTable("invoices", (t) => {
    t.uuid("id").primary();
    t.integer("total_cents").notNullable();
    t.timestamp("due_at");
  });
}`,
      ts`export async function up(db: Knex) {
  await db.schema.createTable("audit_log", (t) => {
    t.bigIncrements("id");
    t.string("actor").notNullable();
    t.jsonb("payload");
  });
}`,
      ts`export async function up(db: Knex) {
  await db.schema.alterTable("users", (t) => {
    t.string("locale", 8).defaultTo("pl");
    t.dropColumn("legacy_flags");
  });
}`,
      ts`export async function up(db: Knex) {
  await db.schema.createTable("feature_flags", (t) => {
    t.string("key").primary();
    t.boolean("enabled").defaultTo(false);
  });
}`,
    ],
  },
  {
    id: "in-memory-port",
    variants: [
      ts`export function createInMemoryOrgPolicyPort(): OrgPolicyPort {
  const policies = new Map<string, OrgPolicy>();
  return {
    get: async (orgId) => policies.get(orgId) ?? DEFAULT_POLICY,
    set: async (orgId, policy) => void policies.set(orgId, policy),
  };
}`,
      ts`export function createInMemoryRateLimiter(): RateLimiterPort {
  const hits = new Map<string, number[]>();
  return {
    allow: async (key, now) => {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
      hits.set(key, [...recent, now]);
      return recent.length < 30;
    },
  };
}`,
      ts`export function createInMemoryClock(start: number): ClockPort {
  let now = start;
  return {
    now: () => now,
    advance: (ms) => {
      now += ms;
    },
  };
}`,
      ts`export function createInMemoryOutbox(): OutboxPort {
  const queue: Envelope[] = [];
  return {
    push: async (env) => void queue.push(env),
    drain: async () => queue.splice(0, queue.length),
  };
}`,
    ],
  },
  {
    id: "react-fetch-hook",
    variants: [
      ts`export function useProfile(id: string) {
  const [data, setData] = useState<Profile | null>(null);
  useEffect(() => {
    let alive = true;
    api.profile(id).then((p) => alive && setData({ ...p, name: p.name.trim() }));
    return () => { alive = false; };
  }, [id]);
  return data;
}`,
      ts`export function useNotifications() {
  const [data, setData] = useState<Notice[]>([]);
  useEffect(() => {
    let alive = true;
    api.notices().then((list) => alive && setData(list.filter((n) => !n.read)));
    return () => { alive = false; };
  }, []);
  return data;
}`,
      ts`export function useExchangeRate(from: string, to: string) {
  const [data, setData] = useState<number | null>(null);
  useEffect(() => {
    let alive = true;
    api.rate(from, to).then((r) => alive && setData(Math.round(r.value * 10_000) / 10_000));
    return () => { alive = false; };
  }, [from, to]);
  return data;
}`,
      ts`export function useTeamSize(teamId: string) {
  const [data, setData] = useState(0);
  useEffect(() => {
    let alive = true;
    api.members(teamId).then((m) => alive && setData(m.filter((x) => x.active).length));
    return () => { alive = false; };
  }, [teamId]);
  return data;
}`,
    ],
  },
];
