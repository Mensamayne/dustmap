# Dustmap

**A map of the dust in your repo.** Dustmap scans a whole repository (or just a pull request) and writes one report: dead code, copy-paste, functions that do the same thing written differently, and places that are signalling for a refactor. It **never changes your code** — it shows where the dust is; you, or your AI agent, decide what to sweep.

> Status: repo skeleton ready (queue, agent rules, architecture map). Product packages start at DUST-01. Plan: [docs/briefs/DUST-00-overview.md](docs/briefs/DUST-00-overview.md). Architecture: [docs/architecture/](docs/architecture/).

## What it finds

| Category | Examples | Built on |
|----------|----------|----------|
| Dead code | unused files, exports, dependencies | [Knip](https://github.com/webpro-nl/knip) |
| Copy-paste | the same block in 4 places | [jscpd](https://github.com/kucherenko/jscpd) |
| Same logic, different code | "these 5 functions do practically the same" | code embeddings (local model) |
| Refactor signals | tangled functions, the same condition spread over 12 files | TypeScript AST |
| History signals | hotspots, files always changed together, fix-heavy areas | `git log` |
| Structure | import cycles, god modules, layer violations | [dependency-cruiser](https://github.com/sverweij/dependency-cruiser) |

Signals are **ranked by place**: where several kinds of signal overlap, that place goes to the top.

## How it is meant to be used

```bash
npx dustmap init          # detects your framework and entry points
npx dustmap scan          # whole repo → the map (report.json)
npx dustmap summary       # short overview for humans and agents
npx dustmap scan --diff main            # a pull request → report.diff.json; the map stays as is
npx dustmap list --report diff          # what the pull request added
```

- **AI agents** read the report through an MCP server: summary first, details on demand.
- **Humans** get markdown or SARIF (GitHub code scanning).
- **Decisions** ("keep this, because…") are stored in the repo, so dismissed findings never come back.
- **Ratchet** in CI blocks only *new* dust, never the old backlog.
- **Plugins** turn chosen findings into tickets or agent-queue briefs. Nothing is enqueued automatically.

Everything runs locally by default. Two optional models sharpen the duplicate layers — an embedding model (same meaning, different code) and a pair judge (same job, or only the same skeleton?). Each can be Dustmap's local model package, any OpenAI-compatible API (GPT, or Ollama / vLLM on your machine), the Anthropic API (Claude), or nothing; code leaves the machine only with `allowRemote: true`, and keys come only from the environment. Ready configs, privacy and cost: [docs/MODELS.md](docs/MODELS.md).

## Repository layout

| Path | Role |
|------|------|
| `packages/*` | contract, core, cli, mcp, sinks (created from DUST-01 onward) |
| `docs/architecture/` | package map and product invariants |
| `docs/briefs/` | the agent task queue (`queue.json`) and briefs |
| `tools/queue/` | queue tooling: next task, epic plan, close, validate (+ self-test) |
| `tools/tkr/` | git-proof gate: a task is done only with a `Fixes {ID}` commit |

Working with agents on this repo: [AGENTS.md](AGENTS.md).

```bash
npm run queue:validate   # queue shape, gates, cycles
npm run queue:selftest   # planted defects must fail validation
npm run verify           # queue + self-test + every package's typecheck/tests
```
