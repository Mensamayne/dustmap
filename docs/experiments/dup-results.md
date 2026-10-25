# DUP results — duplicates and unification (L1..L5)

Measurements of the DUP epic ([duplicates-paradigm](../architecture/duplicates-paradigm.md)). One section per brief; numbers come from pinned target snapshots (`.tmp/targets/<target>@<sha>`), never from the live repos.

## DUP-01 — L1: duplicates by normalization (2026-10-25)

What L1 reports, with no model:

- `exact-clone` / high — functions or classes identical once their local names are renamed (`sum` → `total`); literals compare by value (`0x811c9dc5` = `2166136261`, `'a'` = `"a"`).
- `exact-clone` / medium — the same code with other constants: a parameterization candidate; the evidence lists which constants differ.
- `css-duplicate` / high — CSS rules whose whole declaration sets are equivalent, duplication types I–III of Mazinanian, Tsantalis, Mesbah (FSE 2014): same text, same values in another spelling (`red` = `#ff0000`), shorthand = longhands.
- `css-duplicate` / medium — a declaration set shared by rules of one stylesheet, ranked as FSE 2014 ranks grouping opportunities: saving = property families × (rules − 1), taken greedily, each (rule, declaration) counted once, saving ≥ 8, at most 3 per stylesheet. Medium, because grouping needs the cascade-order check of DUP-05.

### Counts

| Target (snapshot) | exact high | exact medium | CSS high | CSS medium | L1 time |
|---|---:|---:|---:|---:|---:|
| Monorepo-A `dbe35aa00cd6` | 540 | 144 | 2021 | 265 | 18.3 s |
| Service-B `0c0aa958e6b3` | 0 | 3 | 0 | 0 | 0.3 s |

Shared CSS sets before ranking: 6604 findings (every rule pair in a large stylesheet shares a few declarations). Counting the saving in declarations instead of property families let `border: none` (twelve longhands) outrank real sets; families fixed that (378 → 265).

### Precision — 30 random groups on Monorepo-A (seed 21)

A group counts as correct when its members really are what the finding says (same code after renaming / same code but constants / equivalent rules / a truly shared declaration set).

| Kind | Sampled | Correct | Notes |
|---|---:|---:|---|
| exact-clone / high | 8 | 8 | `sha256Hex`, `clamp01` ×5, a retry-header parser across packages, CLI `req` helpers, verify-gate `read` ×3 |
| exact-clone / medium | 8 | 8 | an engine-client getter ×4 (only the URL differs), a request-id parser ×3 (only the prefix), `generateMetadata` ×4 layouts, FNV hash in hex vs decimal (now high after literal-by-value) |
| css-duplicate / high | 7 | 7 | focus ring ×20 selectors, `.stack` flex column ×3 |
| css-duplicate / medium | 7 | 7 | all shared sets are real |
| **Total** | **30** | **30** | precision 1.00 (target ≥ 0.95) |

Usefulness is a separate question from correctness. Of the 7 shared CSS sets, about 4 are good extraction candidates (button reset, mono uppercase label, flex toolbar row). About 3 are common layout idioms on unrelated components (`display: flex; align-items: center; flex-wrap: wrap`). That is the "pattern vs duplicate" problem; it stays `medium` until the pair judge (DUP-04) and the order check with a sketch (DUP-05).

### What the sample shows for later briefs

- Many high groups come from whole copied files or folders: design-system kits copied into the web app, an archived app version, copied landing pages. Each copied function is its own finding. DUP-06 should fold these into one "parallel files" finding.
- `exact-clone / medium` are the most actionable findings: same code, other constants, often in one file. DUP-05 should turn them into a parameter sketch.

### Lab

Scenario `11-kopie-i-css` in `../dustmap-lab`: copies with other names, other constants, a helper copied with its outer function (one finding), CSS types I/II/III including the Gmail examples from FSE 2014, a three-rule shared set. Traps: another property (`weightG`), another call (`Math.ceil` vs `Math.floor`), another value, another `@media` context, `@keyframes`. Result: 15/15; full lab 134/134.

### Full scan

`npm run verify:targets`: OK. (Correction, DUP-02: the 20817 findings / 11183 `duplicate` first written here came from a stale adapter cache holding the unranked 6604 CSS sets; the adapter version was not bumped during development. The fresh number is below.)

## DUP-02 — L2: near copies and "contains" (2026-10-25)

What L2 reports (`near-clone`, medium), no model:

- **near-miss** — the shared part of two units is ≥ 70% of the larger one (NiCad's 0.3 difference threshold): someone changed or added lines. Near copies form one finding per family, around the unit with most near copies.
- **contains** — ≥ 90% of the smaller unit appears, in order, inside the larger one, which adds more: an extended copy ("could call it instead"). One finding per contained unit, listing every unit that contains it.

How:

- **Logical lines, not the author's line breaks** (NiCad pretty-printing): one line per statement, class or type member, object property, switch clause, JSX element part; locals blindly renamed to `$`; literals by value; trailing commas dropped (also from the L1 keys).
- **Candidates** from an inverted index of distinct lines with prefix filtering (SourcererCC): lines ordered rare first; only the first |lines| − ⌈0.5·|lines|⌉ + 1 lines of the smaller unit are looked up.
- **Verification**: longest common subsequence of lines, weighted by tokens; the diff of that subsequence is the evidence (shared / changed / only-in counts, rename map, `-`/`+` lines with file line numbers and original text).
- **No double reporting**: one unit per L1 group takes part ("+N identical copies, see exact-clone"); a pair inside an already reported pair or L1 group is dropped; a pair where one side matches a piece of the other directly (a method vs the class that holds its copy) gives way to that inner pair.

### Counts and time

| Target (snapshot) | near-miss | contains | L1 + L2 time | L2 cost |
|---|---:|---:|---:|---:|
| Monorepo-A `dbe35aa00cd6` | 494 | 52 | 59 s | +41 s (budget 60 s) |
| Service-B `0c0aa958e6b3` | 4 | 1 | 0.3 s | — |

Families of near copies on Monorepo-A: 411 of 2, 58 of 3, 15 of 4, 4 of 5, 6 of 6+. Before folding identical copies into one representative there were 22 families of 6+ (largest 49: recursive directory walkers in one folder of gate scripts); before grouping, 1524 pair findings.

### Precision — 30 random findings on Monorepo-A

A finding counts as correct when its members really are near copies (or the smaller unit really is contained), as the evidence says.

| Kind | Draws | Correct | Examples |
|---|---:|---:|---|
| near-miss | 20 (19 distinct; seeds 41, 97) | 20 | two day-range clamps (only the default constant name), two id readers, two daily-lane helpers, two recipe-section components, two row pushers (+ one `if`) |
| contains | 10 (seed 43) | 10 | `parseArgs` and its extended copy with more flags, `encodeCursor` + a cap, a date-start parser inside the end-exclusive one, an opt-in action inside its opt-out variant |
| **Total** | **30** | **30** | precision 1.00 (target ≥ 0.95) |

Defects found by the review and fixed before the count: the same function wrapped differently (and with a trailing comma) was a near copy → logical lines; a method was "contained" in a whole class because that class held its near copy → inner pairs win; families of copy-pasted script helpers flooded as pairs → grouping; identical members of a family repeated L1 → one representative; the diff printed one file line several times (JSX) and only the first line of a wrapped statement → printed once, up to three file lines.

### Lab

Scenario `12-prawie-kopie`: a near copy (one changed call, other names), a copy with four added steps (contains), a method copied into another class. Traps: the same function wrapped by a formatter (must be an L1 copy, not a near copy), another skeleton of the same size. Result: 12/12; full lab 146/146.

### Full scan

`npm run verify:targets`: OK. Monorepo-A full scan with L1 + L2 (adapter version 2, fresh cache): 62.3 s, 15002 findings, 5368 of them `duplicate` (jscpd + L1 + L2; deduplication between jscpd and L1/L2 is DUP-06's job). Service-B: 146 findings.

## DUP-03 — one meter per layer (2026-10-25)

`npm run dup:meter -- [--model <onnx package>] [--judge <scores.jsonl>] [--no-l3]` — every layer on the same gold set (`tools/emb/gold`, 1532 pairs: 1339 + 193 trap pairs), each through Dustmap's own code. Positives: same + contains + concept.

### L1/L2 on gold (product thresholds)

| Verdict | Reports | Duplicates | pattern | Precision |
|---|---:|---:|---:|---:|
| exact (L1) | 9 | 9 | 0 | 1.00 |
| css-equal (L1) | 8 | 8 | 0 | 1.00 |
| shape — other constants (L1) | 15 | 9 | 6 | 0.60 |
| near-miss (L2) | 38 | 30 | 8 | 0.79 |
| contains (L2) | 1 | 1 | 0 | 1.00 |
| **L1 + L2** | **71** | **57** | **14** | **0.80** |

Recall of L1+L2 on gold: same 0.15, contains 0.11, concept 0.00 — most gold duplicates are type 3–4, which is L3/L4's job. Trap: 11/193 reported.

**Correction to DUP-02.** Its acceptance asked for L2 precision ≥ 0.95 *on gold*; DUP-02 was closed on a Monorepo-A review that asked "is this really a near copy?" (30/30 yes). On gold, which asks "do both do the same job?", L2 is 0.79 and L1-shape 0.60. The misses are copies with one responsibility swapped: two file walkers (another file filter), two media-query subscriptions (another query), `POST` / `POST` (accept vs reject action). No text rule separates them — similarity of the pattern pairs (0.71–0.87) overlaps that of the duplicates (0.74–0.98). Twelve of the 14 such labels come from the CON-03 labelling; within one family gold is not consistent (two loaders labelled pattern, both labelled same against a third). Consequence for the epic: L1-shape and L2 report a certain *text* relation; "same job" is decided by L4 or the agent, and DUP-06 shows the two separately.

### L3 — partner in the top k (product path)

Every positive gold pair with both sides in one snapshot: side A is the query, the scan's own units of the whole repository are the pool (`extractUnits`, the `onnx` package `dustmap-same-meaning-private` on GPU), the partner or any piece of it counts as found; the query's own pieces are not candidates.

| Snapshot | Pool | Pairs | recall@10 | recall@20 | recall@50 |
|---|---:|---:|---:|---:|---:|
| Monorepo-A `dbe35aa00cd6` | 69 600 | 398 | 0.80 | 0.88 | 0.96 |
| — same | | 284 | 0.83 | 0.91 | 0.96 |
| — contains | | 57 | 0.79 | 0.88 | 0.96 |
| — concept | | 57 | 0.67 | 0.75 | 0.95 |
| Service-B `0c0aa958e6b3` | 360 | 5 | 1.00 | 1.00 | 1.00 |

(The earlier 92 % at top-20 came from the training repo's pool and side texts; this is the scan's own cut: 0.88.) First run embeds the pool (625 s on GPU); vectors are cached in `.tmp/emb/dup-meter-vectors`.

### L4 — the Qwen 7B judge (`gold-judged.jsonl`, CON-14)

| Set | AP | same | contains | concept | Precision @0.5 | Recall @0.5 | pattern below 0.5 |
|---|---:|---:|---:|---:|---:|---:|---:|
| test (741) | 0.798 | 0.806 | 0.427 | 0.085 | 0.49 | 0.95 | 0.27 |
| all (1339) | 0.796 | 0.790 | 0.460 | 0.104 | 0.52 | 0.95 | 0.25 |

Trap: 187/193 at ≥ 0.5. L1-shape + L2 confirmed by the judge: 52 of 54 kept, precision 0.75 (0.74 without the judge) — the Qwen judge does not separate pattern from duplicate on near copies. This is the input DUP-04 has to beat, not copy.

## DUP-05 — L5: copy direction and unification sketch (2026-10-25)

Every L1/L2 finding gets two more pieces of evidence:

- **`direction`** — which member is the original: one read-only `git log -M --name-status` pass dates every file by its first commit (renames and moves followed). Members created the same day, or sharing a file, get no direction unless `clones.maxBlames` > 0 allows line-level dating (`git blame -L`, median author time). No history → no direction, never a guess.
- **`sketch`** / **`sketch-blocked`** — the common form, or why there is none.
  - Script units (anti-unification, Getafix/Aroma; safety per Tsantalis et al., TSE 2015): reference and copies aligned by logical lines; differences allowed only token for token in literals or plain names (a value or a callback). The sketch is the reference's own text with `p1…p4` spliced in — in a template string as `${p}`, in JSX as `{p}`, in a component as new props; new parameters go in front of optional ones. It must parse. Blocked with a reason: added/removed steps, another property or quoted key, a type, an assignment target, a JSX tag, more than 4 differing values, a component taking a props object, a whole class.
  - CSS (Mazinanian et al., FSE 2014): a grouping rule `.a, .b { … }`, tried at the first and the last member's place; offered only if no rule in between sets a moved property to another value with the same specificity. Rules in different stylesheets or contexts are never grouped (their order depends on page loading).
- L1 also gained one type-II equivalence found on the way: `font-weight: bold` = `700`, `normal` = `400`.

### Monorepo-A (`dbe35aa00cd6`)

| Kind | Findings | Sketch | Blocked | Direction |
|---|---:|---:|---:|---:|
| exact-clone / high | 542 | — (identical) | — | 264 |
| exact-clone / medium (other constants) | 146 | 125 | 21 | 35 |
| near-clone / near-miss | 494 | 40 | 454 | 198 |
| near-clone / contains | 52 | — | — | 11 |
| css-duplicate / high | 2021 | 65 | 1956 | 704 |
| css-duplicate / medium | 265 | 32 | 233 | 0 |

Why near copies are mostly blocked: another line structure 198, another property 60, more than 4 values 19, a type 24 — near copies usually differ in steps, which is exactly what a parameter cannot carry. CSS whole-rule groups: 1860 of the blocked ones span several stylesheets (copied design-system folders).

Time: L1+L2+L5 47 s (L5 sketches ~0 s extra after caching unit details); direction 2.7 s (file dates). Line-level dating with 2000 blames took 248 s and added 5 directions of 269 — hence off by default.

### Review

- **30 sketches** (seeds 5, 9, 23): 10 constant-parameter sketches, 10 near-copy sketches, 10 CSS grouping sketches. Passing the listed values to the common form gives each original: 30/30 after two fixes found in the review — a type name taken as a value (`x: p1` → now "another type"), and a required parameter placed after an optional one (`fetchRaw(base?: string, p1)` → now in front). Known limit: a parameter's type is the reference value's type (`typeof LABELS`); it may need widening by hand.
- **5 directions** checked against the target's own history (`git log --follow -M`): 5/5 — e.g. a page script is a `C100` copy of another page's script made 18 days later; one MCP server's entry file was copied from another's.
- The first measurement also found 45 sketches that did not parse (template-string pieces and JSX attributes replaced with their delimiters, positional parameters added to components): fixed, 0 now.

### Lab

Scenario `13-szkic-i-kierunek`: an original 30 days old and its copy with other constants 5 days old (direction "25 days later", sketch with `p1…p3`), a copy with an added step (blocked: "adds 1 step"), CSS grouping without and with an overriding rule in between. 11/11; full lab 157/157.

## DUP-04 — L4: the pair judge (2026-10-25)

A cross-encoder that reads both pieces at once (`microsoft/unixcoder-base`, the approved W4 base) and gives the probability of the same job. Package `dustmap-pair-judge-private` (`dustmap-pair-judge/1`: `model.onnx` fp32 for the CPU, `model.fp16.onnx` for the GPU, SHA-256 checked). In the scan: `semantic.pairJudge` (default this package; `none` = off; not installed = similarity only, said in the group's evidence). Semantic pairs at or above the report floor go through the judge; a group whose every judged pair is below 0.5 is **demoted to low** with the evidence "reads as a shared pattern or different work" — never dropped (see the lab below).

### Why not distillation from Qwen (the brief's plan)

The 7 424 real candidate pairs Qwen 7B had judged were labelled `same` 5 650 times and `pattern` 2 times, median side 111 characters; on gold Qwen put 187 of 193 trap pairs at ≥ 0.5 and only 27 % of patterns below it. A student of that teacher inherits exactly the blindness L4 exists to fix — the 20 000 further Qwen judgements were not run. The judge learns instead from the labelled training pairs of the embedding work (158 544: rewrites, grows, merges vs signature / same-name / sibling / skeleton negatives, already through the leakage gate) plus half of the gold validation split; the other half selects the checkpoint; test and trap are never trained on.

### Training series (GPU capped at ≤ 8 GB and ≤ free − 0.5 GB per nvidia-smi; peak 2.95 GB)

| Run | Train pairs | lr | gold-val-A ×w | Test AP | pattern < 0.5 | Trap ≥ 0.5 | L1-shape + L2 kept by judge: precision (dups kept) |
|---|---:|---:|---:|---:|---:|---:|---|
| first | 60 000 | 2e-5 | ×3 | 0.638 | 0.86 | 74/193 | 0.91 (32/40) |
| A | 60 000 | 1e-5 | ×10 | 0.699 | 0.80 | 114/193 | 0.84 (37/40) |
| B | 20 000 | 1e-5 | ×10 | 0.716 | 0.74 | 82/193 | 0.88 (37/40) |
| **C** | **150 000** | 1e-5 | ×10 | **0.736** | **0.86** | **51/193** | **0.97 (32/40)** |
| Qwen 7B (CON-14) | — | — | — | 0.798 | 0.27 | 187/193 | 0.75 (39/40) |
| embedding EMB-15 (cosine) | — | — | — | 0.705 | — | — | — |

Judge score + cosine in one logistic model (fit on validation): test AP 0.710 but trap 193/193 — the cosine brings back exactly the pairs the judge rejects; not used.

### Package and the scan's path

- Export checks: fp32 vs PyTorch max |Δ| 7·10⁻⁶; fp16 max |Δ| 0.0035. Weight-only int8 was rejected: aggregate AP unchanged but one score moved by 0.30.
- Through the scan's own code (`npm run dup:meter -- --judge-package dustmap-pair-judge-private`): CPU fp32 test AP **0.735** = PyTorch 0.735 (the Node pair encoding — RoBERTa pair template, longest-first truncation, checked on 72 length pairs against the Python tokenizer — is exact); GPU fp16 0.729 with every decision at 0.5 unchanged.
- Speed: **CPU 4.4 pairs/s**, **GPU 75 pairs/s**. The GPU variant runs only when `nvidia-smi` shows ≥ 2.5 GB free (DirectML cannot be capped); otherwise the CPU.

### Semantic layer on Monorepo-A, with and without the judge

| | Pairs | Groups | high | medium | low | Time |
|---|---:|---:|---:|---:|---:|---:|
| similarity only | 8 143 | 1 485 | 918 | 531 | 36 | 257 s (incl. re-embedding 22 342 functions) |
| judge deleting rejected pairs (first version) | 3 443 | 592 | 492 | 98 | 2 | 125 s |
| **judge demoting (shipped)** | 8 143 | 1 485 | 472 | 110 | 903 | 119 s |

On gold, pairs at or above the medium band: precision 0.72 → 0.87, duplicates kept 75 of 99, trap 173 → 49; high band 0.81 → 0.89.

Review on Monorepo-A:
- **20 random high groups kept by the judge: 20/20 duplicates** (one borderline: two unit converters one condition apart — a parameter candidate; an icon component in a compiled bundle is the Babel output of its JSX source).
- **10 random groups the judge removed: 5 correct removals** (caller/callee, build vs strip of one link, string vs number variant, different translation logic, server vs local variant), **5 real or borderline duplicates lost**: two CLI JSON parsers, a chart-path builder ×3 (only a type name differs), a gate rule-id reader ×8 (only a constant differs), a device lister ×2, two prune helpers. Lowering the threshold does not help (test: recall 0.76 at 0.5, 0.84 at 0.05 while the trap doubles); the judge is confidently wrong on copies that differ in an identifier — its negatives (same signature, same name) taught it that other names mean other work. L1/L2 still report several of these as text copies (DUP-06 merges the layers).

### Lab: why the judge demotes instead of deleting

The first version dropped rejected pairs. Lab scenario `03-ten-sam-sens` (planted same-meaning pairs) went red: 4 planted duplicates disappeared — sum by loop / `reduce` / recursion, a renamed `cache-dir` twin, two parsers of the last user message. That is type 4, where the judge is weakest (concept AP 0.12). Demoting keeps them (low, with the judge's reading as evidence); the default report from medium keeps the precision gain. Scenario 03: 16/16 again; full lab green.

### Acceptance — not met, follow-up queued

- AP ≥ 0.80 on test: **0.736** (Qwen 0.798, embedding 0.705).
- ≥ 50 pairs/s on CPU: **4.4** (GPU 75).
- Met: the judge in the scan with a threshold; L2 precision on gold 0.74 → 0.97; semantic precision 0.72 → 0.87; trap false alarms −70 %.
- DUP-08 (queued): positives for "copies that differ only in names or constants" (L1-shape / L2 pairs) and a smaller or shorter-input judge for the CPU.

## DUP-06 — one finding per concept; MCP and the playbook (2026-10-25)

`scan/merge-duplicates.ts` replaces `semantic/dedupe-vs-clones.ts` (which only dropped semantic groups wholly inside a token clone):

- **Same set of places → one finding.** Duplicate findings whose places correspond both ways (same file, overlap ≥ half the smaller range, sizes within ×2) merge; the strongest leads (confidence, then L1 > L2 > L3 > token) and keeps its fingerprint; the others add the evidence it lacks (judge, sketch, direction, diff); `found-by` lists every layer that agreed. Every duplicate finding gets `layer`.
- **A set inside a larger set stays a finding of its own.** The first version merged on one-way containment; lab scenario 03 caught it: three identical loops (L1) were merged into a group of seven loops alike in meaning (L3) and the result claimed "identical after renaming" for the recursive and `reduce` versions. Two true statements stay two findings.
- **Parts.** A strictly smaller fragment inside a larger place (a token fragment in a near-copied function, a copied function in a copied file) becomes a line in the larger finding's `parts`; its sketch and diff are not carried up and it does not change the larger finding's confidence.

Monorepo-A (saved full report): duplicate findings 6 402 → **5 695**; **324** findings carry two or more agreeing layers. 708 still share some lines with another finding — deliberately: sets inside larger sets, and token blocks that cross function boundaries. Full scan with every layer, the judge and the merge: 139 s, 14 394 findings (4 645 duplicate, 1 149 semantic-duplicate).

MCP: `dustmap_list` gives duplicates `places`, `layer`, `hasSketch`; `dustmap_show` adds `group` {layer, foundBy, judge, original, sketch, sketchBlocked, parts, places}. The playbook (and the embedded guide) has a Duplicates section (guide 3.7 KB of 4 KB). E2E test: an agent goes guide → scan → list → show → decide on a repo with an original and a copy made 20 days later, and reads the original, the age gap and a sketch with `p1` from the group.

Lab: 02 now expects the three copied files as one group led by L1 with jscpd in `found-by` (two new checks); 03 green with the honest split; full lab 159/159.

## DUP-07 — measured on Monorepo-A and in the lab; defaults (2026-10-25)

Full Monorepo-A scan with every layer (jscpd, L1, L2, L5, semantic + pair judge, merge): 5 794 duplicate findings. Hand review of random groups (verdict per group: real duplicate / pattern / noise).

### Review, before the default change (`.tmp/dup07-review.mjs`, seeds 101 / 202 / 303)

| Band | Reviewed | Real | Pattern | Noise | Precision |
|---|---:|---:|---:|---:|---:|
| high | 20 | 18 | 1 | 1 | **0.90** |
| medium | 20 | 17 | 3 | 0 | **0.85** |
| high + medium | 40 | 35 | 4 | 1 | **0.875** |
| low | 20 | 5 | 11 | 4 | 0.25 |

- 3 of the 5 high/medium misses were token copies (jscpd) no other layer confirmed: `try/catch` + trace boilerplate, a fragment spanning a function and a zod schema, a response-parsing fragment.
- low is almost all semantic groups the judge rejected: 15 of 20 rightly hidden from the default report (icons, ice/sweet form fields, API vs SMTP tests …); the 5 real ones are the judge's known gap (DUP-08): a type or a language apart — a topological sort `.js` / `.ts` twin, a name counter, two HTML strippers, a copied `fetcher`, a dose-band check.

### Token copies alone

10 more random high token copies no other layer confirmed (seed 404): 6–7 real, 1 pattern (handler prologues), 2 noise (import lists). With the first round: ≈ 0.6 over 13 groups, against 17/17 for high findings a unit-level layer confirmed. Token runs ignore function boundaries; certainty belongs to the layers that read whole units.

### Defaults (decision)

| Setting | Default | Why |
|---|---|---|
| L1 / L2 / L5 (`normalized` adapter) | on | L1 17/17 on gold; L2 + judge 0.97; review above |
| `clones.copyDirection` / `maxBlames` | on / 0 | file dates 2.7 s cover 264 of 269 directions |
| `semantic.pairJudge` | `dustmap-pair-judge-private` (when installed; CPU, GPU only with ≥ 2.5 GB free) | medium-up precision 0.72 → 0.87 on gold; demotes, never deletes |
| `clones.tokenCopyAloneMax` (new) | `medium` | token copy alone ≈ 0.6 precision vs 17/17 confirmed |
| report floor | medium (unchanged) | low is 0.25 precision — visible on request only |
| target configs | unchanged | they set only the embedding model; the defaults apply |

After the change (same scan): high 3 107 → **2 659** (448 lone token copies to medium; 16 confirmed token copies stay high), medium 2 356, low 779. 10 more random high groups (seed 505): **10/10** real; with the 17 high groups of the first round that stay high: **27/27**. Medium is estimated at ≈ 0.80 (the reviewed 0.85 pool plus the capped token copies at ≈ 0.6); high + medium ≈ 0.91.

Service-B: 145 findings, 25 duplicate (short report kept).

### Lab

All duplicate scenarios green: 02 (copies, one group led by L1), 03 (same meaning, honest split), 11 (L1 + CSS I–III), 12 (near copies), 13 (sketch and direction) — full lab 159/159, no known DUP bugs.

### What the epic leaves open

- DUP-08: the judge's gap on copies a name, type or language apart, AP 0.736 < 0.80, CPU 4.4 pairs/s.
- jscpd blocks that cross function boundaries still overlap unit-level findings (708 partial overlaps on Monorepo-A) — different statements, kept apart on purpose.
- BUG-13: CLI tests block the vitest worker (flaky timeout in `npm run verify`).

## DUP-08 — the judge v2 attempt, and what it found instead (2026-10-25)

### Correction to DUP-04 and DUP-07: most of the judge's "misses" were line endings (BUG-14)

The scan cut unit bodies with the file's line endings: 10 883 of the 10 886 script files of the Monorepo-A snapshot are CRLF (`git archive` converts like a Windows checkout). The judge and the embedding model were trained on LF text, and the meter fed them LF text, so the meter never showed it. One pair, a topological sort as `.js` and `.ts`: **0.998 from LF, 0.022 from the scan's cut**. BUG-14 made every unit body LF (`stripComments`).

So the DUP-04 statement "the judge is confidently wrong on copies that differ in an identifier" and the DUP-07 "5 real duplicates in low are the judge's gap" were mostly this bug. Through the fixed path the same judge (v0.1, run C) accepts 7 of the 8 reviewed real duplicates (the topological sort 0.999, the HTML stripper 0.998, the chart-path builder 0.77, the CLI JSON parser 0.71, the name counter 0.60, the device lister, a dose-band check); its own errors on the 14 hand-reviewed pairs: the gate rule-id reader (another constant, a split case in gold too), and two wrongly accepted pairs — `tryLoad…` / `load…` (one calls the other) and build vs strip of a link.

The embedding model was robust to it: L3 recall@20 on Monorepo-A 0.88 before and after (the meter's L3 runs the scan's cut).

### The planned fix: variants a type or a language apart — negative result

`data/judge/type_variants.mjs`: 16 000 positives that provably keep behaviour (8 000 TypeScript sides with types erased by the compiler, 8 000 with type names consistently renamed), through the same leak gate. Trained on top of run C's data:

| Run | Test AP | pattern < 0.5 | Trap ≥ 0.5 | L1-shape + L2 kept: precision (dups) |
|---|---:|---:|---:|---|
| C (shipped) | **0.736** | **0.86** | **51** | **0.97 (32/40)** |
| D (+ variants, 512 tokens) | 0.701 | 0.73 | 91 | 0.90 (37/40) |
| E (+ variants, 256 tokens) | 0.689 | 0.66 | 82 | 0.82 (37/40) |

The variants only made the judge say "same" more readily. C stays (`dustmap-pair-judge-private` 0.1.0).

### CPU speed — boundary

| Judge | CPU (fp32, all cores) | GPU (fp16) |
|---|---:|---:|
| C, 512 tokens | 4.4 pairs/s | 75 pairs/s |
| E, 256 tokens | 7.6 pairs/s | — |

A 126 M-parameter cross-encoder does not reach 50 pairs/s on this CPU even at half the input, and the shorter input costs quality (above). 50/s on the CPU needs a different, much smaller model — new work with its own quality risk; the scan uses the GPU variant when the card has room (≥ 2.5 GB free per nvidia-smi) and the CPU otherwise.

### New default from the fixed path: judged groups from the high band

With LF input the judge confirmed many more semantic groups (Monorepo-A: high 730, medium 343, low 411; before the fix 472 / 110 / 903). Hand review of the confirmed ones (seeds 611, 733, 919): **high band 16/17 real**; **medium band ~1 in 4** (15 groups: mostly sibling helpers of one file — a flush and a write helper of one draft store, two dialog hooks, primary / secondary button, caller and callee — the trap's kind of pair, where the judge says yes 26 % of the time). New `semantic.judgedMinBand` (default `high`): a judged group below the high similarity band stays low with that reason. Semantic now: high 730, medium 142 (high-band groups one step down for a shared pattern or parallel files), low 612.

### Final full scan (every layer, judge, merge, BUG-14)

Monorepo-A: 14 395 findings, 5 795 duplicate: high **2 901** (CSS 2 017, semantic 573, L1 299, confirmed token copies 12), medium 2 333, low 561; 312 s (first scan after the body change re-embeds every function). Service-B: 145 findings.

### Acceptance

- AP ≥ 0.80 on test: **not met** — 0.736 (C); the planned data (variants) made it worse; Qwen 0.798 remains the reference.
- ≥ 50 pairs/s on CPU: **boundary documented** — 4.4 (512) / 7.6 (256); GPU 75.
- On the way: BUG-14 (fixed), and `judgedMinBand` from a review through the fixed path.

## V1-02 — the judge on L1-shape and L2

After the layers merge, every `exact-clone` medium (identical up to constants) and every `near-clone` group goes to the scan's judge: the lead place against each other place (at most 8), the units cut as the semantic layer cuts them (parsed unit, comments out, LF), so a pair both layers read is judged once. Every pair the same job → **high**. A no **never lowers** a text copy: the copy itself is certain, and on gold the judge's no drops one real duplicate in five here (32 of 40 kept, DUP-08); the lab showed it on planted copies (a method copied into another class with another collection, two labels differing only in strings). The group carries the verdict (`intentional-pattern`, with the reason) and stays medium. The semantic layer, whose relation is only a similarity, keeps demoting on a no. Verdicts are cached under `outputDir/cache/judge` for every judge (package or API), so a re-scan reads only changed pairs.

Monorepo-A `dbe35aa00cd6` (judge `dustmap-pair-judge-private` 0.1.0 on GPU), duplicates before → after: high 2 901 → **3 202**, medium 2 333 → **2 032**, low 561 → 561. Of the groups this stage read: confirmed 301 (near 262, L1-shape 39), read as a pattern 251 (near 183, L1-shape 68), split 16; every unit was found in its file. First scan 114 s, a re-scan with the verdict cache 17 s. Service-B: 145 findings, its copy groups judged the same way.

Hand review, 20 groups drawn at random (seed 11):

- **Confirmed, 10/10 real duplicates:** `.ts` / compiled `.js` twins (an ops planner, a report mapper, a link checker), helpers copied between packages (two emptiness checks, a dose helper, two backend resolvers), copied file walkers and gram formatters, the finalize step of two product-line services.
- **Read as a pattern, 9/10 a shared skeleton with other data** by the label definitions: two argv flag parsers of one file, two analytics event builders, two `onClick` handlers, two rule-store handlers, two language stem helpers, two test scenarios, two `clearPending…` wrappers, two rule-id readers of other files. **1/10 disputable:** two snapshot-calculator factories of two product lines, ~50-line variants a maintainer could call one job. Several of the nine are still parameter candidates — the reason they stay medium with the verdict rather than drop to low.

Gold (DUP-08, same judge): L1-shape + L2 confirmed by the judge — precision 0.97, against 0.74 for the layer without it.

On the way: a judge that cannot open (a remote API without a key) made the scan's final release rethrow, so the CLI exited as an internal error after writing the report — now released quietly, the error stays in `scan.tools` (`pair-judge`); and the CLI sets its exit code instead of calling `process.exit()`, which aborted Node on Windows while the API judge's sockets were closing.

## V1-03 — the meter for any judge

`npm run dup:meter -- --judge-provider onnx|openai|anthropic [--judge-model …] [--judge-url …] [--judge-limit n] [--allow-remote]` scores the gold pairs through the scan's own factory (`openJudge`): the same judge, input cut and verdict cache as a scan (`.tmp/emb/judge-meter`). `--judge-limit n` takes a fixed sample of n test + trap pairs (ordered by a hash of the pair id, so a re-run is free) and computes every number over the scored pairs only. The L4 line names the judge and counts pairs read, cached and skipped.

- Package through the factory (`--judge-provider onnx`, GPU fp16): test AP 0.729, trap 51/193, L1-shape + L2 precision 0.97 (32/40 duplicates kept), 71.8 pairs/s — the same numbers as the DUP-08 GPU run (CPU fp32: 0.735).
- OpenAI-compatible path on a recorded loopback server, `--judge-limit 60`: 60 pairs read; the re-run read 0 and took 60 from the cache, numbers unchanged. The Anthropic path is covered by the core tests and lab scenario 14 (recorded server, no network).
