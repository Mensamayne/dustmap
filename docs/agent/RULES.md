# Agent rules (full)

Carried over from the Monorepo-A monorepo `.cursor/rules/` and generalized. [AGENTS.md](../../AGENTS.md) has the short version.

## 1. Plain language with the maintainer

The maintainer does not live inside repo jargon. Treat every turn as zero prior knowledge.

Required order of every report:
1. **What** changed for the product, users or data.
2. **Which part** owns it — plain name first.
3. **How** it works, one line.
4. Only then paths, task ids, commands — if still needed.

Bad: „DUST-05 done, cluster.ts green, 41 passed.”
Good: „Raport pokazuje teraz grupy funkcji, które robią to samo, nawet jeśli są napisane inaczej. Sprawdziłem na przykładzie z trzema wersjami tej samej funkcji — wszystkie trafiły do jednej grupy. *(DUST-05)*”

Code, commits and tracked docs keep canonical names; only conversation is plain-first.

## 2. Proactive, outcome-level execution

Before implementing, answer: who benefits, what „done” looks like in the real world, what is the smallest correct change on the intended path.

- Do the obvious safe next step instead of ending with „mogę to zrobić”.
- Add pieces the plan forgot but the outcome clearly needs; mention them.
- Ask first for: real product trade-offs, deletes beyond the brief, destructive git, publishing, pushing.
- If a plan conflicts with architecture: stop and explain; do not silently take a shortcut.

## 3. Perfect production or nothing

Forbidden: hotfixes, glue layers, symptom patches (clamps, `?? fallback` hiding a real bug), incomplete repairs sold as done, `@deprecated` dual stacks, silencing TypeScript (`@ts-ignore`, `@ts-expect-error`, `as any`, `as never`, empty stubs).

Allowed: a complete path on the canonical owner, **or** stop and report the blocker. Incomplete work leaves real `tsc` errors and:

```ts
// PERFECT_GAP: do perfekcji brakuje:
// - …concrete list…
```

## 4. No unscalable patches

If a fix only works by growing a hand-maintained list (synonyms, per-repo exceptions, golden tables), it is not a fix. Name the broken invariant, trace upstream, fix there — or ship nothing and say so. For Dustmap specifically: false positives are fixed by better **generic** detection or by the user's config, never by hardcoding a project's paths into `packages/*/src`.

## 5. Root cause over symptom

Fix at the source of the broken invariant. A test that is flaky "because of parallelism" needs a deterministic reproduction before anyone believes it.

## 6. Waterfall epics

Plan the whole epic up front: `{EPIC}-00-overview.md` with a brief table, binding decisions and an explicit delete list. Large coherent diffs are fine. Replaced code is deleted inside the same epic. No „faza 1 / w kolejnej turze”.

## 7. Architecture first

- Extend the existing abstraction for a concept; never a parallel handler, second mapper or „simple version” API.
- Third branch on the same concern, or the same logic twice → refactor first.
- No empty folders, placeholder classes or speculative `utils/`.
- Contracts live in one package (`@dustmap/contract`); nobody redefines wire types.

## 8. Tests and gates

- Anti-masking: no `.skip`, `.only`, `it.todo`, `--exclude` in tests or gates.
- A new gate script ships with a negative self-test (it must go red on a planted defect).
- A harness measures itself first: before calling a red result a product defect, check the check (negation-blind asserts, budgets tighter than production, stubs kinder than the real thing).
- Proportional verification: targeted checks for small changes; full `npm run verify` before closing a brief.

## 9. Git

- Local disk is the only sacred truth. Never restore from HEAD/remote (`checkout -- path`, `restore`, `reset --hard`, `clean`, sync from origin) without explicit consent for that exact path. Recover from editor history or transcripts instead.
- Commits: queue closes (`Fixes {ID}`) or when asked. Push: only when asked.
- Never cite another brief's id in a commit message — the git-proof gate matches ids in messages.

## 10. Delegation

Delegated executors (cheaper models, subagents) are assumed to: break adjacent behavior, overstate results, add without deleting, leave debug probes, creep scope, die mid-task.

1. One concern per executor, exact files and lines, hard rules in the prompt (no workarounds, don't weaken assertions, delete obsolete code, remove probes, report instead of forcing green).
2. Parent re-runs typecheck + the touched tests + `npm run verify` itself.
3. Parent audits `git diff` every time — success or failure.
4. Parent alone says „done”.
