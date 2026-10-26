# Dustmap

[![CI](https://github.com/Mensamayne/dustmap/actions/workflows/ci.yml/badge.svg)](https://github.com/Mensamayne/dustmap/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node ≥ 20](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)

**A map of the dust in your repo — built for AI agents.** Dustmap scans a TypeScript / JavaScript repository (the whole thing, or just a pull request) and writes one report: dead code, copy-paste, functions that do the same job written differently, and places that are asking for a refactor. Every finding says *where it hurts and why*, with the evidence.

Dustmap **never changes your code**. It writes only under its own output folder (`.dustmap/`). You — or your agent — decide what to sweep.

## Why it exists

Codebases written with AI agents grow fast and rarely shrink: agents add, they seldom delete, and they re-implement what already exists under another name. Linters see one file at a time; clone detectors see copied text. Dustmap looks at the whole repository and ranks **places**, where several kinds of dust overlap, so an agent can onboard itself and finish the whole loop without a human reading docs:

```
summary → pick a place → evidence → safety check (verifyHint) → decide (keep / fix) or queue a task
```

## What it looks like

Dustmap scanning its own repository:

```console
$ dustmap scan .
Scanned 300 files · 478 findings · dead-code:178 duplicate:28 semantic-duplicate:126 refactor-signal:132 structure:14
Top places:
  1. packages/cli/src/args.ts  score=23.2  signals=5
  2. packages/mcp/src/tools.ts  score=23.2  signals=6
  3. packages/core/src/adapters/knip/normalize.ts  score=13.2  signals=4
  …
next: dustmap summary
```

One of those findings — a function copied between two packages, with the constants changed:

```text
exact-clone · medium · L1 normalized copy
  packages/core/src/semantic/extract.ts:23            scriptKindOf   (oldest — the original)
  packages/core/src/adapters/knip/declaration-text.ts:8  scriptKind  (copied 5 days later)
  renamed    scriptKindOf: scriptKind → scriptKindOf, fileName → file
  constants  /\.tsx$/ → /\.tsx$/i, /\.jsx$/ → /\.jsx$/i, /\.[cm]?js$/ → /\.[cm]?js$/i
  sketch     function scriptKind(fileName: string, p1: RegExp, p2: RegExp, p3: RegExp): ts.ScriptKind { … }
```

The sketch is evidence, not a fix: Dustmap shows the unified form only when it is safe and never applies it.

## What it finds

| Category | Examples | Built on |
|---|---|---|
| Dead code | unused files, exports, types, dependencies | [Knip](https://github.com/webpro-nl/knip), framework-aware entry points |
| Copies | the same function under other names or with other constants; near copies with lines changed; CSS rules repeated | TypeScript AST normalization, [jscpd](https://github.com/kucherenko/jscpd) |
| Same job, different code | "these five functions all sum a cart" | a code-embedding model + a pair judge (optional, local or API) |
| Refactor signals | tangled functions, long parameter lists, the same condition in twelve files | TypeScript AST |
| History signals | hotspots, files that always change together, fix-heavy areas | `git log` |
| Structure | import cycles, god modules, layer violations | [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) |
| False-green tests | tests that cannot fail | test AST |

Duplicates are found in layers, each answering its own question, and merged into one finding per duplicated concept:

| Layer | Question | How |
|---|---|---|
| L1 | identical after renaming locals (and constants)? | normalized AST keys; CSS duplication types I–III |
| L2 | a near copy, or one inside another? | line-level diff of normalized units |
| L3 | the same meaning? | embeddings of every function, calibrated similarity bands |
| L4 | really the same job, or one skeleton with other data? | a pair judge reads both pieces |
| L5 | what would the unified form look like, and which copy is the original? | sketch + `git blame` direction |

## Quick start

Dustmap is not on npm yet; run it from a clone (Node ≥ 20):

```bash
git clone https://github.com/Mensamayne/dustmap.git
cd dustmap
npm ci
alias dustmap="node $PWD/packages/cli/bin/dustmap.mjs"
```

Then, in the repository you want to map:

```bash
dustmap init        # detects frameworks and entry points, writes dustmap.config.json
dustmap scan        # the whole repo → .dustmap/report.json
dustmap summary     # counts and top places
dustmap list --category dead-code --min-confidence high   # safest deletes first
dustmap show <fingerprint>                                # one finding with its evidence
dustmap decide <fingerprint> keep --reason "public API, used by plugins"
```

For a pull request: `dustmap scan --diff main` writes `report.diff.json` and leaves the map alone. All commands take `--json`. Full reference: [packages/cli/README.md](packages/cli/README.md).

### For AI agents (MCP)

```bash
dustmap init --agent claude     # or cursor, codex, all
```

This adds a marked instruction block for the agent and registers the MCP server (`summary`, `list`, `show`, `decide`, `scan`, `guide`). Every reply stays under 32 KiB and ends with the next suggested calls, so an agent never has to read a wall of JSON. Instructions: [packages/cli/agent/PLAYBOOK.md](packages/cli/agent/PLAYBOOK.md).

### In CI

A composite GitHub Action scans the pull-request diff, uploads SARIF to code scanning, and can fail only on **new** findings (a ratchet: old dust never blocks a merge). See [packages/cli/README.md#github-action](packages/cli/README.md#github-action).

## Models — optional, local by default

The text layers need no model. Two optional models sharpen the duplicate layers: an **embedding model** (same meaning, different code) and a **pair judge** (same job, or only the same skeleton?). Each can be Dustmap's ONNX package (offline, GPU or CPU), any OpenAI-compatible API (OpenAI, or Ollama / vLLM on your machine), the Anthropic API, or nothing.

```bash
dustmap model pull dustmap-same-meaning   # default embedding (~395 MB)
dustmap model pull dustmap-pair-judge     # optional pair judge (~725 MB)
```

Packages come from [Hugging Face](https://huggingface.co/Mensamayne/dustmap-models) (MIT), with SHA-256 checked on every file. Dustmap never downloads on its own — only when you run `model pull`.

- Code leaves your machine only with `"allowRemote": true` in the config; API keys are read from the environment only, never from the config or into the report.
- No model installed → that layer is off, the report says so in one line with how to turn it on, and everything else runs.

Ready-made configs, privacy and cost: [docs/MODELS.md](docs/MODELS.md).

## How well it works

Measured, not guessed — every number has a write-up in [docs/experiments/](docs/experiments/):

| | |
|---|---|
| Copies by constants + near copies, confirmed by the pair judge | precision **0.74 → 0.97** on the gold set |
| Pair judge, random review of 20 groups on a 1.27 M-line monorepo | confirmed 10/10 real; "same skeleton" 9/10 right |
| Embedding model (fine-tuned `unixcoder-base`, MIT on HF) | AP **0.741** on held-out gold (published default `dustmap-same-meaning`) |
| Full scan of a 1.27 M-line TypeScript monorepo | ~5 min first scan, ~12 s with a warm cache |
| A small, clean service | 145 findings — a clean repo gets a short report |

The gold set has 1,532 labelled pairs (`same` / `contains` / `concept` / `pattern` / `different`), 193 of them a trap: sibling helpers of one file that look alike but do different jobs.

## How it is built

Dustmap is developed agent-first, with gates that keep an agent honest:

- **A task queue of briefs** ([docs/briefs/](docs/briefs/), [queue.json](docs/briefs/queue.json)): every change starts as a brief with its scope, constraints, verification and acceptance. A task is done only with a `Fixes {ID}` commit (git-proof gate, [docs/TKR.md](docs/TKR.md)). Briefs are written in Polish — the maintainer's working language; code, commits and technical docs are in English.
- **`npm run verify`**: queue validation with a planted-defect self-test, an isolation gate (no project-specific knowledge in `packages/*/src`, permissive licences only), the gold-set validator, typecheck and ~250 tests across the packages.
- **A lab with known truth** (a separate repo that uses Dustmap only through the CLI and MCP, like a stranger would): 14 scenarios of planted dust and traps, 174 checks, plus torture inputs. Every call also proves the scanned repo was not touched.
- **Real-repo measurements** on pinned snapshots of private repositories (referred to as `monorepo-a` and `service-b`), with hand-reviewed samples behind every claim.
- **Own models**: embedding fine-tuning and a cross-encoder pair judge trained on GPU, exported to ONNX (fp32 for CPU, fp16 for GPU), shipped as SHA-256-checked packages.

Architecture: [docs/architecture/](docs/architecture/). Working rules for agents: [AGENTS.md](AGENTS.md).

## Repository layout

| Path | What |
|---|---|
| `packages/contract` | the report schema (Zod): findings, fingerprints, decisions, SARIF |
| `packages/core` | config, inventory, adapters, duplicate layers, ranking, scan orchestration |
| `packages/cli` | the `dustmap` command, agent playbook, GitHub Action |
| `packages/mcp` | the MCP server for agents |
| `packages/sink-briefs` | turns chosen findings into briefs in a file-based task queue |
| `docs/` | briefs, architecture, experiments and measurements |
| `tools/` | queue, gates, meters, release tooling |

## Status

v1: every layer above works and is measured; the CLI and the MCP server are used on real repositories; embedding and pair-judge packages are on Hugging Face (`dustmap model pull`). Not yet: an npm release; languages other than TypeScript / JavaScript / CSS.

## License

[MIT](LICENSE) © Mensamayne
