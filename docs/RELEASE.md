# Public release

How the public repository is produced from the maintainer's working repo (REL epic). The working repo keeps its own history untouched; the public one is a separate, rewritten clone.

## What stays private

The maintainer measures Dustmap on private repositories. Everything that points into them lives in `private/` (git-ignored; `$DUSTMAP_PRIVATE_DIR` overrides):

| File | What |
|---|---|
| `private/gold/*.jsonl`, `private-spec.json` | gold-set references into pinned private snapshots (paths, line ranges, hashes — never code) |
| `private/targets/` | private test targets, their Dustmap configs and ground truths |
| `private/isolation-denylist.json` | real project names the isolation gate also forbids in `packages/*/src` |
| `private/release-aliases.json` | real project name → public alias (`monorepo-a`, `service-b`, `project-c…f`) |
| `private/release-history-terms.json` | identifiers and path fragments of private code seen in old versions of public files |

Every tool works without `private/`: the gold set is its public part, `verify:targets` has nothing to measure, the isolation gate checks the public aliases.

## Steps

1. **Tree.** `node tools/release/apply-aliases.mjs --check` must report 0 files naming private projects (it rewrites them without `--check`).
2. **History.** On a new, empty directory:

   ```bash
   node tools/release/public-history.mjs --out ../dustmap-public --filter-repo <path to git-filter-repo>
   ```

   It clones this repo, drops the private data files from every commit, runs every blob and every commit message through the alias rules, the pair-table rule of old research notes and the term list (each term → `‹private›`), then audits every blob and message of the result and checks that the final tree is byte-identical to this repo's HEAD tree. Exit 0 = clean. `--audit <dir>` re-checks a produced clone. Measured 26.10.2026 (after REL-05 close): 141 → 140 commits (one touched only dropped files), 1 058 blobs clean, final tree identical, `npm ci` + `verify` green with no private data, models or git identity.
3. **Check the clone like CI.** In the output directory: `npm ci` and `npm run verify` with no `private/`, no installed models and no global git identity.
4. **Push** — only by the maintainer, or by an agent after the maintainer's explicit yes:

   ```bash
   cd ../dustmap-public
   git remote add origin https://github.com/Mensamayne/dustmap.git
   git push -u origin main
   ```

Commit hashes of the public history differ from the working repo's; `Fixes {ID}` messages and the queue's `gitProofSha` refer to the working repo.

## Tools used

- [`git-filter-repo`](https://github.com/newren/git-filter-repo) 2.47.0 (MIT), installed 25.10.2026 into a scratch virtual environment with `uv pip install git-filter-repo==2.47.0` — not a dependency of Dustmap.
