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
| exact-clone / high | 8 | 8 | `sha256Hex`, `clamp01` ×5, `‹private›` across packages, CLI `req` helpers, verify-gate `read` ×3 |
| exact-clone / medium | 8 | 8 | engine-client `‹private›` ×4 (only the URL differs), `‹private›` ×3 (only the prefix), `generateMetadata` ×4 layouts, FNV hash in hex vs decimal (now high after literal-by-value) |
| css-duplicate / high | 7 | 7 | focus ring ×20 selectors, `.stack` flex column ×3 |
| css-duplicate / medium | 7 | 7 | all shared sets are real |
| **Total** | **30** | **30** | precision 1.00 (target ≥ 0.95) |

Usefulness is a separate question from correctness. Of the 7 shared CSS sets, about 4 are good extraction candidates (button reset, mono uppercase label, flex toolbar row). About 3 are common layout idioms on unrelated components (`display: flex; align-items: center; flex-wrap: wrap`). That is the "pattern vs duplicate" problem; it stays `medium` until the pair judge (DUP-04) and the order check with a sketch (DUP-05).

### What the sample shows for later briefs

- Many high groups come from whole copied files or folders: design-system kits copied under `monorepo-a-web/`, `‹private›`, `‹private›`. Each copied function is its own finding. DUP-06 should fold these into one "parallel files" finding.
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

Families of near copies on Monorepo-A: 411 of 2, 58 of 3, 15 of 4, 4 of 5, 6 of 6+. Before folding identical copies into one representative there were 22 families of 6+ (largest 49: recursive directory walkers in `‹private›`); before grouping, 1524 pair findings.

### Precision — 30 random findings on Monorepo-A

A finding counts as correct when its members really are near copies (or the smaller unit really is contained), as the evidence says.

| Kind | Draws | Correct | Examples |
|---|---:|---:|---|
| near-miss | 20 (19 distinct; seeds 41, 97) | 20 | `‹private›` / `‹private›` (only the default constant name), `‹private›` / `‹private›`, `‹private›` / `‹private›`, `‹private›` / `‹private›`, `‹private›` (lab copy) / `‹private›` (+ one `if`) |
| contains | 10 (seed 43) | 10 | `parseArgs` and its extended copy with more flags, `encodeCursor` + a cap, `‹private›` inside `‹private›`, `‹private›` inside the opt-out variant |
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

**Correction to DUP-02.** Its acceptance asked for L2 precision ≥ 0.95 *on gold*; DUP-02 was closed on a Monorepo-A review that asked "is this really a near copy?" (30/30 yes). On gold, which asks "do both do the same job?", L2 is 0.79 and L1-shape 0.60. The misses are copies with one responsibility swapped: `‹private›` / `walk` (another file filter), `‹private›` / `‹private›` (another media query), `POST` / `POST` (accept vs reject action). No text rule separates them — similarity of the pattern pairs (0.71–0.87) overlaps that of the duplicates (0.74–0.98). Twelve of the 14 such labels come from the CON-03 labelling; within one family gold is not consistent (`‹private›` ↔ `‹private›` pattern, both ↔ `‹private›` same). Consequence for the epic: L1-shape and L2 report a certain *text* relation; "same job" is decided by L4 or the agent, and DUP-06 shows the two separately.

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

- **30 sketches** (seeds 5, 9, 23): 10 constant-parameter sketches, 10 near-copy sketches, 10 CSS grouping sketches. Passing the listed values to the common form gives each original: 30/30 after two fixes found in the review — a type name taken as a value (`‹private›: p1` → now "another type"), and a required parameter placed after an optional one (`‹private›(‹private›?: string, p1)` → now in front). Known limit: a parameter's type is the reference value's type (`typeof ‹private›`); it may need widening by hand.
- **5 directions** checked against the target's own history (`git log --follow -M`): 5/5 — e.g. `‹private›` is a `C100` copy of `‹private›` made 18 days later; `‹private›` was copied from `agent-forensics-mcp`.
- The first measurement also found 45 sketches that did not parse (template-string pieces and JSX attributes replaced with their delimiters, positional parameters added to components): fixed, 0 now.

### Lab

Scenario `13-szkic-i-kierunek`: an original 30 days old and its copy with other constants 5 days old (direction "25 days later", sketch with `p1…p3`), a copy with an added step (blocked: "adds 1 step"), CSS grouping without and with an overriding rule in between. 11/11; full lab 157/157.
