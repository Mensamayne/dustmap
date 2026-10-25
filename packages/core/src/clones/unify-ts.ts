/**
 * A common form of duplicate script units (DUP-05, layer L5): anti-unification of the reference unit
 * with each copy (Getafix / Aroma), offered only when parameterizing the differences is safe (Tsantalis,
 * Mazinanian, Krishnan, TSE 2015). Units are aligned by their normalized lines; a difference is safe only
 * when both sides have the same lines and differ, token for token, in literals or in plain names (a value
 * or a function — a callback). Added or removed steps, another property, a name in a type, an assignment
 * target or a JSX tag change what the code does or cannot be passed in: no sketch, and the reason says
 * why. The sketch is the reference's own text with parameters spliced in; it must parse. Text only —
 * Dustmap never changes the user's code.
 */
import ts from "typescript";
import { lineDiff } from "./near-miss.js";
import type { TokenDetail, UnitDetail } from "./normalize-ts.js";

export type ScriptSketch =
  | { safe: true; text: string; params: Array<{ name: string; values: string[] }> }
  // `draft`: the sketch that failed to parse, for diagnosis; never shown as a proposal.
  | { safe: false; reason: string; draft?: string };

/** Tokens of one logical line, in order. */
function byLine(d: UnitDetail): TokenDetail[][] {
  const out: TokenDetail[][] = d.unit.lines.map(() => []);
  for (const t of d.tokens) out[t.line]!.push(t);
  return out;
}

/** Token-for-token holes between the reference and one copy: ref token index → copy source text. */
function holes(ref: UnitDetail, copy: UnitDetail): { holes: Map<number, string> } | { reason: string } {
  const refLines = byLine(ref);
  const copyLines = byLine(copy);
  const ops = lineDiff(ref.unit.lines, copy.unit.lines);
  const out = new Map<number, string>();
  const refIndex = new Map(ref.tokens.map((t, k) => [t, k]));
  const renames = new Map<string, string>();
  const back = new Map<string, string>();
  const pairTokens = (ra: TokenDetail[], ca: TokenDetail[]): string | null => {
    if (ra.length !== ca.length) return "a changed line has another structure";
    for (let k = 0; k < ra.length; k++) {
      const r = ra[k]!;
      const c = ca[k]!;
      if (r.role === "local" || c.role === "local") {
        if (r.role !== c.role) return `a local name stands where the other copy has ${c.role === "local" ? r.source : c.source}`;
        // Locals must correspond one to one, or the two copies use their variables differently.
        if ((renames.get(r.source) ?? c.source) !== c.source || (back.get(c.source) ?? r.source) !== r.source) return `local names are used inconsistently (${r.source} / ${c.source})`;
        renames.set(r.source, c.source);
        back.set(c.source, r.source);
        continue;
      }
      if (r.text === c.text) continue;
      const kinds = new Set([r.role, c.role]);
      if (kinds.size !== 1) return `${r.source} and ${c.source} play different roles`;
      if (r.role === "literal" || r.role === "name") {
        out.set(refIndex.get(r)!, valueOf(copy, c));
        continue;
      }
      if (r.role === "member") return `another property (${r.source} / ${c.source}) — not a value that can be passed in`;
      if (r.role === "type") return `another type (${r.source} / ${c.source}) — needs a type parameter`;
      if (r.role === "target") return `another assignment target (${r.source} / ${c.source})`;
      if (r.role === "tag") return `another component (${r.source} / ${c.source})`;
      return `another operator or keyword (${r.source} / ${c.source}) changes what the code does`;
    }
    return null;
  };
  for (let i = 0; i < ops.length; ) {
    const o = ops[i]!;
    if (o.op === "same") {
      const why = pairTokens(refLines[ref.unit.lines.indexOf(o.a)]!, copyLines[copy.unit.lines.indexOf(o.b)]!);
      if (why) return { reason: why };
      i++;
      continue;
    }
    const dels: number[] = [];
    const ins: number[] = [];
    while (i < ops.length && ops[i]!.op !== "same") {
      const x = ops[i++]!;
      if (x.op === "del") dels.push(ref.unit.lines.indexOf(x.a));
      else if (x.op === "ins") ins.push(copy.unit.lines.indexOf(x.b));
    }
    if (dels.length !== ins.length) {
      const extra = ins.length - dels.length;
      const [more, less] = extra > 0 ? [copy.unit.name, ref.unit.name] : [ref.unit.name, copy.unit.name];
      return { reason: `${more} adds ${Math.abs(extra)} step(s) that ${less} lacks — a common form would need a flag or a callback` };
    }
    for (let k = 0; k < dels.length; k++) {
      const why = pairTokens(refLines[dels[k]!]!, copyLines[ins[k]!]!);
      if (why) return { reason: why };
    }
  }
  return { holes: out };
}

/** More differences than this make a parameter list nobody would write; the reason says how many. */
const MAX_PARAMS = 4;

/** Syntax errors of a sketch (parsing only: types are the user's business). */
function syntaxErrors(text: string, member: boolean, tsx: boolean): number {
  const wrapped = member ? `class Sketch {\n${text}\n}` : text;
  const r = ts.transpileModule(wrapped, {
    reportDiagnostics: true,
    fileName: tsx ? "sketch.tsx" : "sketch.ts",
    compilerOptions: { jsx: ts.JsxEmit.Preserve, target: ts.ScriptTarget.Latest },
  });
  return (r.diagnostics ?? []).filter((d) => d.category === ts.DiagnosticCategory.Error).length;
}

/** A value as one would pass it: a template or JSX text piece as a string, anything else as written. */
function valueOf(d: UnitDetail, t: TokenDetail): string {
  if (t.slot?.write === "template") return JSON.stringify(d.source.slice(t.slot.start, t.slot.end));
  // JSX text (an attribute string starts with its quote and stays as written).
  if (t.slot?.write === "jsx" && !/^["']/.test(t.source)) return JSON.stringify(t.text);
  return t.source;
}

const typeHint = (t: TokenDetail): string => {
  if (t.role === "name") return `typeof ${t.source}`;
  if (/^["'`]/.test(t.source)) return "string";
  if (t.source.startsWith("/")) return "RegExp";
  return /n$/.test(t.source) ? "bigint" : "number";
};

/**
 * Common form of a reference unit and its copies, or the reason there is none. Parameters are named
 * after their order (`p1`, `p2`, …); one parameter per reference token that differs in any copy.
 */
export function sketchScript(ref: UnitDetail, copies: readonly UnitDetail[]): ScriptSketch {
  if (ref.unit.kind === "class") return { safe: false, reason: "a class: compare its methods, a common form of a whole class is not sketched" };
  if (!ref.paramInsert) return { safe: false, reason: ref.paramBlock ?? "no parameter list to extend" };
  const perCopy: Array<Map<number, string>> = [];
  for (const c of copies) {
    const h = holes(ref, c);
    // Step reasons name both units; token-level reasons get the pair in front.
    if ("reason" in h) return { safe: false, reason: h.reason.includes(c.unit.name) ? h.reason : `${ref.unit.name} ↔ ${c.unit.name}: ${h.reason}` };
    perCopy.push(h.holes);
  }
  const positions = [...new Set(perCopy.flatMap((m) => [...m.keys()]))].sort((a, b) => a - b);
  if (positions.length === 0) return { safe: false, reason: "no difference to parameterize — the copies are the same code" };
  // One parameter per distinct column of values (the same difference repeated is one parameter).
  const columns = new Map<string, { name: string; positions: number[]; values: string[] }>();
  for (const pos of positions) {
    const refValue = valueOf(ref, ref.tokens[pos]!);
    const values = [refValue, ...perCopy.map((m) => m.get(pos) ?? refValue)];
    const k = values.join("\u0001");
    const col = columns.get(k);
    if (col) col.positions.push(pos);
    else columns.set(k, { name: `p${columns.size + 1}`, positions: [pos], values });
  }
  if (columns.size > MAX_PARAMS) return { safe: false, reason: `${columns.size} differing values — more parameters than a readable common form takes (${MAX_PARAMS})` };
  const ins = ref.paramInsert;
  const props = ins.mode !== "positional";
  const typed = !props && !/\.(?:[cm]?js|jsx)$/i.test(ref.unit.path);
  const edits: Array<{ start: number; end: number; text: string }> = [];
  for (const col of columns.values()) {
    for (const pos of col.positions) {
      const t = ref.tokens[pos]!;
      if (t.slot?.write === "template") edits.push({ start: t.slot.start, end: t.slot.end, text: `${"$"}{${col.name}}` });
      else if (t.slot?.write === "jsx") edits.push({ start: t.slot.start, end: t.slot.end, text: `{${col.name}}` });
      else edits.push({ start: t.start, end: t.end, text: col.name });
    }
  }
  const added = [...columns.values()].map((c) => (typed ? `${c.name}: ${typeHint(ref.tokens[c.positions[0]!]!)}` : c.name)).join(", ");
  if (ins.mode === "props-new") edits.push({ start: ins.at, end: ins.at, text: `{ ${added} }` });
  else if (ins.wrap) edits.push({ start: ins.wrap.start, end: ins.wrap.end, text: `(${ref.source.slice(ins.wrap.start, ins.wrap.end)}, ${added})` });
  else edits.push({ start: ins.at, end: ins.at, text: ins.comma === "before" ? `${added}, ` : ins.comma ? `, ${added}` : added });
  const base = ref.offset;
  let text = ref.unit.body;
  for (const e of edits.sort((a, b) => b.start - a.start)) text = text.slice(0, e.start - base) + e.text + text.slice(e.end - base);
  if (syntaxErrors(text, ref.member, /x$/i.test(ref.unit.path)) > 0) return { safe: false, reason: "the common form would not parse", draft: text };
  return { safe: true, text, params: [...columns.values()].map((c) => ({ name: c.name, values: c.values })) };
}

/** Evidence text: the sketch and, per unit, the values it would pass. */
export function sketchText(sketch: Extract<ScriptSketch, { safe: true }>, names: readonly string[], maxChars = 2400): string {
  const calls = names.map((n, k) => `${n}: ${sketch.params.map((p) => `${p.name} = ${p.values[k]}`).join(", ")}`);
  const body = sketch.text.length > maxChars ? `${sketch.text.slice(0, maxChars)}\n… (+${sketch.text.length - maxChars} chars)` : sketch.text;
  return `${body}\n— values: ${calls.join(" | ")}`;
}
