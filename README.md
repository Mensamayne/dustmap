# Dustmap

[![CI](https://github.com/Mensamayne/dustmap/actions/workflows/ci.yml/badge.svg)](https://github.com/Mensamayne/dustmap/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Node ≥ 20](https://img.shields.io/badge/node-%E2%89%A520-brightgreen.svg)

Dustmap looks at a whole TypeScript / JavaScript repository and writes a **report** of what looks unused, copied, or hard to change. It does **not** edit your code. Output goes only to its own folder (default `.dustmap/`).

Licence: [MIT](LICENSE).

## The problem

Repos grow. Tools that look at one file at a time miss the shape of the whole project. Copy detectors catch identical text, but not the same job written another way. After a lot of AI-assisted edits, dead exports, near-copies, and tangled spots pile up with no single place that ranks them.

## What Dustmap does

1. Scans the repo (or only the files changed since a git ref).
2. Collects findings: dead code, copies, same-job-different-code (optional model), structure problems, history hotspots, weak tests.
3. Groups them by **place** (file / area) so you see where several problems sit together.
4. Lets you (or an AI agent) list, inspect, and mark findings keep / fix without changing source.

You decide what to do with each finding. Dustmap only reports.

## What it works on

| Works well | Does not (yet) |
|---|---|
| TypeScript, JavaScript, CSS | Python, Java, Go, … as first-class targets |
| npm / pnpm / yarn workspaces, Next.js-style apps | Repos with no JS/TS source worth scanning |
| One machine, offline after optional model download | “Install from npm” (not published yet; run from a clone) |

On an unknown repo: run `dustmap init`, then `dustmap scan`. It detects common frameworks and entry points. Large or unusual setups may need a few lines in `dustmap.config.json` (entry points, excludes). Without that, you can get false “unused” on code loaded by name or by a framework.

It is meant to run on **any** TS/JS repo you point it at. Quality is best when entry points match how the app really starts.

## What’s in this repository

| Path | Role |
|---|---|
| `packages/cli` | The `dustmap` command |
| `packages/core` | Scan, detectors, ranking |
| `packages/contract` | Report shape (findings, fingerprints, SARIF) |
| `packages/mcp` | MCP server for AI agents |
| `packages/sink-briefs` | Optional: turn findings into task briefs |
| `docs/` | Design notes, measurements, agent rules |
| `tools/` | Dev queue, gates, release helpers |

Optional models (separate download, MIT): embedding package and pair judge on [Hugging Face](https://huggingface.co/Mensamayne/dustmap-models). Text-only detectors work without them.

## Install (from source)

Needs **Node 20+**. Not on npm yet.

```bash
git clone https://github.com/Mensamayne/dustmap.git
cd dustmap
npm ci
# Windows PowerShell:
Set-Alias dustmap "node $PWD/packages/cli/bin/dustmap.mjs"
# bash:
alias dustmap="node $PWD/packages/cli/bin/dustmap.mjs"
```

Or call the bin with a full path: `node …/packages/cli/bin/dustmap.mjs`.

## Use it on a repository

From the repo you want to inspect (or pass the path as an argument):

```bash
dustmap init          # writes dustmap.config.json if missing
dustmap scan          # full map → .dustmap/report.json
dustmap summary       # counts and top places
dustmap list --category dead-code --min-confidence high
dustmap show <fingerprint>
dustmap decide <fingerprint> keep --reason "public API"
```

Useful variants:

```bash
dustmap scan --diff main              # only changes since main → report.diff.json
dustmap scan /path/to/other-repo --out /path/to/output   # never writes inside a foreign tree if --out is outside it
dustmap export --to markdown
dustmap ratchet                       # exit 1 only on *new* findings (CI)
```

Every command accepts `--json` for agents and scripts. Full command list: [packages/cli/README.md](packages/cli/README.md).

### Optional models

Without models, copies-by-text and dead-code still run. For “same meaning, different code”:

```bash
dustmap model pull dustmap-same-meaning    # ~395 MB
dustmap model pull dustmap-pair-judge      # ~725 MB, optional
```

Dustmap downloads only when you run `model pull`. Details: [docs/MODELS.md](docs/MODELS.md).

### AI agents

```bash
dustmap init --agent claude    # or: cursor, codex, all
```

Registers an MCP server and a short playbook so an agent can: summary → list → show → decide / scan. See [packages/cli/agent/PLAYBOOK.md](packages/cli/agent/PLAYBOOK.md).

## Configuration

`dustmap init` creates `dustmap.config.json`. Common fields:

```json
{
  "entryPoints": ["apps/web/app/**/page.tsx", "packages/*/src/index.ts"],
  "exclude": ["**/dist/**", "**/fixtures/**"],
  "semantic": { "provider": "onnx", "model": "dustmap-same-meaning", "device": "auto" },
  "judge": { "provider": "none" },
  "outputDir": ".dustmap"
}
```

| Field | Meaning |
|---|---|
| `entryPoints` | Files that “start” the app (routes, bins, registered actions). Wrong list → false dead code. |
| `exclude` | Paths to skip. |
| `semantic` / `judge` | Embedding and pair judge; `provider: "none"` turns a layer off. |
| `outputDir` | Where report and cache go (default `.dustmap/`). |

Code never leaves your machine unless you set a remote API and `"allowRemote": true`. API keys come from the environment only.

## What a finding looks like

Each finding has a stable **fingerprint**, a category, a confidence, locations, and evidence. Example: two functions that match after renaming locals and changing constants, plus a sketch of a shared shape (evidence only; Dustmap never applies it).

You mark `keep` / `fix` / `wontfix`; muted findings stay out of the next report until the code fingerprint changes.

## Status

Works today: CLI, MCP, measured detectors on real TS/JS repos, models on Hugging Face.

Not yet: npm package; languages beyond TS / JS / CSS.

## License

[MIT](LICENSE) © Mensamayne
