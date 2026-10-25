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

`npm run verify:targets`: OK. Monorepo-A full scan with L1 on: 20817 findings, 11183 of them `duplicate` (jscpd + L1 together; deduplication between jscpd and L1 is DUP-06's job).
