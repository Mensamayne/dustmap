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

### `dustmap init [path] [--json]`

Creates `dustmap.config.json` when missing (detects frameworks / entry points). Never overwrites an existing config.

### `dustmap scan [path] [--diff <ref>] [--config <file>] [--out <dir>] [--commit <sha>] [--json]`

Runs all built-in detectors. Writes `report.json` under `--out` / `outputDir` only.

### `dustmap summary [--out <dir>] [--json]`

Category counts, top places, report age vs `HEAD`.

### `dustmap show <fingerprint> [--out <dir>] [--json]`

One finding with locations and evidence.

### `dustmap decide <fingerprint> keep|fix|wontfix --reason "…" [--by <who>] [--out <dir>] [--json]`

Records a decision in `decisions.yml`. `keep` / `wontfix` mute the finding on the next scan until the code fingerprint changes.

### `dustmap export --to markdown|sarif [--out <dir>] [--file <path>]`

Markdown for PRs/issues; SARIF 2.1.0 for GitHub code scanning. Prints to stdout unless `--file` is set.

### `dustmap ratchet [--update-baseline] [--out <dir>] [--json]`

Fails with exit **1** when there are **new** findings above the configured confidence floor. `--update-baseline` records the current set (explicit only).

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
| 2 | Usage or config error |

## GitHub Action

Composite action at [`action/`](./action/): PR diff scan → SARIF upload → optional ratchet. It never commits to your repo.

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
