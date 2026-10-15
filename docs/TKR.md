# TKR — Token Reducer (git proof for agent tasks)

Closing a queue task is allowed only when git history contains a commit that references the task id. Status in `docs/briefs/queue.json` alone is not proof.

## Rule

1. **Before close:** commit with the task id, e.g. `Fixes DUST-00: …`
2. **Before next pick (optional):** config may require a clean worktree; Dustmap leaves this off (`requireCleanWorktreeOnNext: false`)
3. **Order:** commit → verification → `queue:close`. Not the reverse.

## Commit message

```
Fixes {TASK_ID}: short description
```

Accepted patterns are listed in `tools/tkr/tkr-config.json` (`Fixes`, `Closes`, `Fix`, `Resolves`, `TKR-`).

## Commands

```bash
npm run tkr:verify -- --id DUST-00
npm run tkr:status
npm run queue:close -- --id DUST-00 --note "…"
```

Maintainer escapes only: `--force`, `TKR_SKIP=1`, or `exemptTaskIds` in config.
