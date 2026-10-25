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
