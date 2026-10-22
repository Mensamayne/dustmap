# Dustmap CLI

Report-only map of dead code, duplicates, and refactor signals for TypeScript/JavaScript repos. Dustmap **never edits your source**. It writes only under an output directory (default `.dustmap/`: report, cache, decisions, baseline).

Primary user: an AI agent. Humans use the same commands.

## Install (from this monorepo)

```bash
npm install
npm run dustmap -- -- help
# or
node packages/cli/bin/dustmap.mjs help
```

> npm 11+ may swallow flags like `--out`. Prefer an extra `--` (`npm run dustmap -- -- scan … --out …`) or call the bin directly.

## First report

```bash
dustmap init
dustmap scan .
dustmap summary
```

Short human output by default; add `--json` for machines.

## Commands

### `dustmap init [path] [--json] [--agent claude|cursor|codex|all] [--dry]`

Creates `dustmap.config.json` when missing (detects frameworks / entry points). Never overwrites an existing config.

`--agent` wires instruction blocks from `agent/PLAYBOOK.md` (Claude skill, Cursor rule + MCP entry, `AGENTS.md` section, `.mcp.json`). Only text between `<!-- dustmap:begin/end -->` is replaced; everything else stays byte-identical. `--dry` prints the plan without writing.

### `dustmap scan [path] [--diff <ref>] [--config <file>] [--out <dir>] [--commit <sha>] [--json]`

Runs all built-in detectors and writes only under `--out` / `outputDir`. A full scan writes `report.json` — the map of the whole repo. `--diff <ref>` scans files changed since `<ref>` (plus import neighbours) into a separate `report.diff.json`; the map is never touched by a diff scan.

Every command below reads the map by default; add `--report diff` to read the diff report instead.

### `dustmap summary [--report full|diff] [--out <dir>] [--json]`

Category counts, top places, report age vs `HEAD`.

### `dustmap list [--report full|diff] [--category <c>] [--path <prefix>] [--min-confidence low|medium|high] [--offset <n>] [--limit <n>] [--out <dir>] [--json]`

Browse findings page by page, highest confidence first (same filter as the MCP tool `dustmap_list`; at most 50 per page). Safest delete candidates: `dustmap list --category dead-code --min-confidence high`.

### `dustmap show <fingerprint> [--report full|diff] [--out <dir>] [--json]`

One finding with locations and evidence.

### `dustmap decide <fingerprint> keep|fix|wontfix --reason "…" [--by <who>] [--report full|diff] [--out <dir>] [--json]`

Records a decision in `decisions.yml`. `keep` / `wontfix` mute the finding on the next scan until the code fingerprint changes.

> **Upgrade note (BUG-08):** dead-code fingerprints now hash the code of the unused file or declaration instead of its name, so editing a muted symbol brings it back for review. After upgrading, dead-code findings get new fingerprints once: re-record their decisions and run `dustmap ratchet --update-baseline`.

### `dustmap export --to markdown|sarif [--report full|diff] [--out <dir>] [--file <path>]`

Markdown for PRs/issues; SARIF 2.1.0 for GitHub code scanning. Prints to stdout unless `--file` is set.

### `dustmap ratchet [--update-baseline] [--report full|diff] [--out <dir>] [--json]`

Fails with exit **1** when there are **new** findings above the configured confidence floor. `--update-baseline` records the current set from the full map (explicit only; not allowed with `--report diff`).

### Duplicates by meaning

Duplicates by meaning (`semantic-duplicate`) come from a small model that runs on this machine, offline: on the graphics card when there is one (DirectML on Windows, CUDA on Linux), otherwise on the CPU. The model package lives in the user's model directory (`semantic.modelDir`, `$DUSTMAP_MODELS_DIR` or `~/.cache/dustmap/models`) and is checked against the SHA-256 in its manifest before use; Dustmap never downloads it on its own. Without an installed model a scan still runs, reports the missing model under the semantic tool, and skips meaning-based duplicates.

Config (`dustmap.config.json`, all optional):

```json
{ "semantic": { "provider": "onnx", "model": "dustmap-same-meaning-private", "device": "auto" } }
```

`provider`: `onnx` (default), `http` (an OpenAI-compatible embeddings URL — code leaves the machine only with `allowRemote: true`) or `none`. Until a public package is published (EMB-11), the default model id is the private one — install it under the model directory (copy from `dustmap-emb/dist/…` or `dustmap model pull` when a public URL exists). `device`: `auto` (GPU when it works, else CPU), `gpu` or `cpu`. `threshold`: unset = the model's calibrated report floor; confidence `high` / `medium` comes from the model's calibrated bands, and deliberate patterns (same registration call, same switch skeleton, same catch block…) get one level less.

## Categories

| Category | Meaning |
|----------|---------|
| `dead-code` | Unused files, exports, types, dependencies |
| `duplicate` | Token-level copy-paste clusters |
| `semantic-duplicate` | Same intent, different wording (embeddings) |
| `refactor-signal` | Complexity, hotspots, fix density, … |
| `structure` | Import cycles, hubs, layer breaks |

## Exit codes

| Code | Meaning |
|------|---------|
| 0 | OK |
| 1 | Ratchet found new findings |
| 2 | Usage or config error (including an unknown `--diff` base) |
| 3 | Internal error — a Dustmap bug; please report it |

## GitHub Action

Composite action at [`action/`](./action/): PR diff scan (`report.diff.json`) → SARIF upload → optional ratchet on that diff report. It never commits to your repo.

| Input | Default | Meaning |
|-------|---------|---------|
| `fail-on` | `new-high` | `none` (never fail), `new-high` (new high-confidence findings), `new-any` (any new finding) |
| `config` | _(empty)_ | Path to `dustmap.config.json` |
| `base` | PR base sha | Git ref for `--diff` |
| `out` | config / `.dustmap` | Output directory |

Example workflow (also linted as `action/example-workflow.yml`):

```yaml
name: Dustmap
on: pull_request
permissions:
  contents: read
  security-events: write
  pull-requests: read
jobs:
  dustmap:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
      - run: npm install -g @dustmap/cli   # or wire your workspace bin
      - uses: ./packages/cli/action
        with:
          fail-on: new-high
```

## Report-only rule

Dustmap does not delete, format, or commit your code. The only intentional write into the project tree is `dustmap init` creating `dustmap.config.json`. Everything else goes under the output directory.
