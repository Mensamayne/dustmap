/**
 * Metrics for the EMB/CON meter, pure functions over scored pairs {score, label}. Positives are
 * `same` + `contains` + `concept` (CON-01); `pattern` and `different` are negatives. A missing score
 * (provider produced no link) counts as 0 — "not reported" is exactly what a user would see.
 */

const scoreOf = (p) => (typeof p.score === "number" && Number.isFinite(p.score) ? p.score : 0);
const POSITIVE_LABELS = new Set(["same", "contains", "concept"]);
const positive = (p) => POSITIVE_LABELS.has(p.label);

/** Average precision of ranking pairs by score (higher = more likely positive). Ties keep input order. */
export function averagePrecision(pairs, { positiveLabel = null } = {}) {
  const isPos = positiveLabel ? (p) => p.label === positiveLabel : positive;
  const ranked = pairs.map((p, i) => ({ s: scoreOf(p), pos: isPos(p), i })).sort((a, b) => b.s - a.s || a.i - b.i);
  const totalPos = ranked.filter((r) => r.pos).length;
  if (totalPos === 0) return 0;
  let hits = 0;
  let sum = 0;
  ranked.forEach((r, k) => {
    if (r.pos) {
      hits += 1;
      sum += hits / (k + 1);
    }
  });
  return sum / totalPos;
}

/**
 * AP of one positive label against the negatives only (`pattern`, `different`): the other positive
 * labels leave the slice. Counting them as negatives (CON-01..CON-11) pinned every label's AP near its
 * base rate whenever the model also scored the other positives high (CON-12).
 */
export function averagePrecisionByPositiveLabel(pairs) {
  const out = {};
  for (const label of ["same", "contains", "concept"]) {
    const slice = pairs.filter((p) => p.label === label || !positive(p));
    out[label] = pairs.some((p) => p.label === label) ? averagePrecision(slice, { positiveLabel: label }) : null;
  }
  return out;
}

/** Precision / recall of "report when score ≥ t", and how many `pattern` pairs stay below t. */
export function atThreshold(pairs, t) {
  let tp = 0;
  let fp = 0;
  let fn = 0;
  let patternBelow = 0;
  let patterns = 0;
  for (const p of pairs) {
    const hit = scoreOf(p) >= t;
    if (positive(p)) hit ? tp++ : fn++;
    else if (hit) fp++;
    if (p.label === "pattern") {
      patterns++;
      if (!hit) patternBelow++;
    }
  }
  return {
    threshold: t,
    precision: tp + fp === 0 ? null : tp / (tp + fp),
    recall: tp + fn === 0 ? null : tp / (tp + fn),
    patternBelow: patterns === 0 ? null : patternBelow / patterns,
    tp,
    fp,
    fn,
  };
}

/** Threshold (from the observed scores) with the best F1 for `same`. */
export function bestF1(pairs) {
  let best = { threshold: null, f1: 0, precision: null, recall: null };
  for (const t of [...new Set(pairs.map(scoreOf))].filter((s) => s > 0)) {
    const r = atThreshold(pairs, t);
    if (r.precision === null || r.recall === null) continue;
    const f1 = r.precision + r.recall === 0 ? 0 : (2 * r.precision * r.recall) / (r.precision + r.recall);
    if (f1 > best.f1) best = { threshold: t, f1, precision: r.precision, recall: r.recall };
  }
  return best;
}

/** Highest share of `same` pairs found while precision stays ≥ minPrecision, and the threshold for it. */
export function recallAtPrecision(pairs, minPrecision) {
  const ranked = pairs.map((p, i) => ({ s: scoreOf(p), pos: positive(p), i })).sort((a, b) => b.s - a.s || a.i - b.i);
  const totalPos = ranked.filter((r) => r.pos).length;
  let tp = 0;
  let fp = 0;
  let best = { recall: 0, threshold: null };
  for (const r of ranked) {
    if (r.pos) tp++;
    else fp++;
    if (totalPos > 0 && tp / (tp + fp) >= minPrecision && tp / totalPos > best.recall) best = { recall: tp / totalPos, threshold: r.s };
  }
  return best;
}

export function meanByLabel(pairs) {
  const out = {};
  for (const label of ["same", "contains", "concept", "pattern", "different"]) {
    const xs = pairs.filter((p) => p.label === label).map(scoreOf);
    out[label] = xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
  }
  return out;
}

function summarizeCore(pairs, threshold) {
  return {
    pairs: pairs.length,
    positives: pairs.filter(positive).length,
    noScore: pairs.filter((p) => typeof p.score !== "number").length,
    ap: averagePrecision(pairs),
    apByLabel: averagePrecisionByPositiveLabel(pairs),
    at: atThreshold(pairs, threshold),
    best: bestF1(pairs),
    mean: meanByLabel(pairs),
  };
}

/** AP / threshold metrics sliced by CON unit (`function` | `fragment` | `class` | `css` | `mixed`). */
export function summarizeByUnit(pairs, threshold) {
  const units = ["function", "fragment", "class", "css", "mixed"];
  const out = {};
  for (const unit of units) {
    const slice = pairs.filter((p) => (p.unit ?? "function") === unit);
    out[unit] = slice.length ? summarizeCore(slice, threshold) : null;
  }
  return out;
}

export function summarize(pairs, threshold) {
  return { ...summarizeCore(pairs, threshold), byUnit: summarizeByUnit(pairs, threshold) };
}
