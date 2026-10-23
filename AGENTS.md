# Agent instructions (Dustmap)

Routing layer for humans and AI agents. Product idea: [docs/VISION.md](docs/VISION.md). Plan: [docs/briefs/DUST-00-overview.md](docs/briefs/DUST-00-overview.md). Architecture: [docs/architecture/](docs/architecture/).

Working rules were carried over from the Monorepo-A monorepo (same maintainer, same habits) and trimmed to what matters here.

## The one product invariant

**Dustmap never changes the scanned repo's source.** It writes only under `outputDir` (default `.dustmap/`: report, cache, decisions, baseline). No `--fix`, no auto-delete, no commits into the user's repo. Only explicit exceptions: `init` creates the config; `init --agent` inserts marked instruction blocks for agents. A feature that would break this is out of scope — say so and stop.

**The primary user is an AI agent.** Every surface (MCP, CLI `--json`) must let an agent onboard itself and finish the whole loop — summary → place → evidence → safety check → decision or queue task — without a human reading docs.

## Where to test on real code

**Read [docs/TEST-TARGETS.md](docs/TEST-TARGETS.md) before any brief that changes scan results.**

- **Monorepo-A** monorepo at `../monorepo-a` (env `DUSTMAP_TARGET_MONOREPO_A`): ~10k TS files, ~1.27M lines, 74 workspace packages, 2.5k commits, Next app router, action registry, MCP/CLI packages, plus Java/Dart/JSON. The main proving ground.
- **Service-B** at `../service-b` (env `DUSTMAP_TARGET_SERVICE_B`): small and clean — the report there must stay short.
- Targets are **read-only**: output goes to `.tmp/targets/<target>/`; no writes, no writing git operations, no running their scripts. Quality measurements use pinned snapshots (`git archive`).
- From DUST-16 on: `npm run verify:targets`, and closure notes carry the numbers.
- **Lab / tortures / proving ground** at `../dustmap-lab` (separate repo, uses Dustmap only via CLI and MCP): planted scenarios with known truth, torture inputs, real-repo health runs. Known bugs are tagged there by queue ID; a fix closes when its lab check turns green. See [TEST-TARGETS](docs/TEST-TARGETS.md).

Corollaries:
- **Generic, not tailored:** no knowledge of any specific project in `packages/*/src`. Project specifics live in the user's `dustmap.config.json`.
- **Signals, not prescriptions:** findings say *where it hurts and the evidence*, never *how to refactor*.
- **Local by default:** no network calls unless the user's config opts in explicitly.

## Task queue (kontynuuj rozwój)

Maintainer says **„kontynuuj rozwój”** / *continue dev* / *next task* → skill [kontynuuj-rozwoj](.claude/skills/kontynuuj-rozwoj/SKILL.md). **„zrealizuj epik”** → same skill, whole-epic loop.

```bash
npm run queue:next          # next feature task (todo, gates done) → marks in_progress
npm run queue:next-bug      # next bug by severity
npm run queue:next-epic     # whole epic plan in gate order
node tools/queue/close.mjs --id DUST-01 --note "…"   # needs Fixes DUST-01 commit (TKR)
npm run queue:validate
npm run queue:selftest      # planted defects must turn validation red
npm run verify              # queue + self-test + typecheck + tests of every package
```

On npm 11+, `npm run … -- --id` is swallowed as npm config. Prefer `node tools/queue/…` or pass an extra `--` (`npm run queue:close -- -- --id DUST-01`).

- Statuses live **only** in [docs/briefs/queue.json](docs/briefs/queue.json). New work = new brief from [_TEMPLATE.md](docs/briefs/_TEMPLATE.md) (bugs: [_BUG_TEMPLATE.md](docs/briefs/_BUG_TEMPLATE.md)) + queue row. Details: [docs/QUEUE.md](docs/QUEUE.md).
- **After green verification of a queue brief:** commit `Fixes {ID}: …` yourself, then `queue:close`, then the next task — no separate ask for that commit.
- One brief's work never goes into another brief's commit. Edit only files listed in the brief's **Pliki (scope)**.
- Dirty worktree is **not** a blocker for `queue:next`.

## Talking to the maintainer (mandatory)

Before every reply: skill [przed-kazda-odpowiedzia](.claude/skills/przed-kazda-odpowiedzia/SKILL.md).

- Polish when they write Polish. Short sentences, one idea each, everyday words.
- First paragraph = what changed for people or data, understandable without opening the repo. File names and task ids after, in parentheses, once.
- Translate every technical term on first use (e.g. „fingerprint — stały odcisk znaleziska, żeby nie dublować zadań”).
- No „GREEN / 60 passed / done” as the whole story — say what was checked and what it proves.

## How to work

Full rules: [docs/agent/RULES.md](docs/agent/RULES.md). Short version:

- **Outcome over transcript.** Infer the goal from the thread; add the obvious missing piece the goal needs; never change architecture boundaries on your own.
- **Act on the obvious safe next step** (read, search, run checks, apply a requested change). Ask only for real product choices, destructive git, publishing, or pushing.
- **Perfect or nothing.** No hotfix, glue, symptom patch or intentional tech debt. Incomplete work leaves honest `tsc` errors plus `// PERFECT_GAP: do perfekcji brakuje: …`. Never `@ts-ignore`, `as any`, empty stubs.
- **No unscalable patches.** A fix that only works by growing a hand-kept list of cases is not a fix.
- **Scope = the literal request.** Do not rebuild what exists; do not cut what was asked for.
- **Big epics are fine.** Plan the full epic up front; delete replaced code in the same epic, no `@deprecated` bridges.
- **Proportional verification.** Small reversible change → targeted check. Broaden only for a concrete risk.
- **Local disk is sacred.** Never `git checkout -- path`, `git restore`, `reset --hard`, `clean`, or overwrite from remote without explicit consent for that exact path.
- **Commits** only for queue closes (above) or when asked. **Push** only when asked.

## Subagents and weaker executors

Assume any delegated executor (cheaper model, subagent) overstates success, adds without deleting, leaves debug probes, creeps scope, and may die mid-task. Brief narrowly with exact files; then **re-run the gates yourself** and audit its `git diff` — success or failure. Its "PASS" is a hypothesis. Full list: [docs/agent/RULES.md](docs/agent/RULES.md) § Delegation.

## Stack

TypeScript, Node ≥ 20, npm workspaces (`packages/*`), Zod for contracts, Vitest for tests. Code, identifiers, commits and tracked technical docs in English; briefs and maintainer-facing docs may be Polish. New non-trivial files start with a one-paragraph header comment saying what the module owns.

**Embedding training** (`dustmap-emb`): weight updates **GPU/CUDA only** — never train on CPU. Details: [docs/experiments/emb-env.md](docs/experiments/emb-env.md), [docs/agent/RULES.md](docs/agent/RULES.md) § Embedding training.
