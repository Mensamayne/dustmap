# Integrate Dustmap with a file-based agent queue

If your repo already keeps agent work as `queue.json` + one markdown brief per task (the same shape as this Dustmap monorepo), you can turn **selected** Dustmap findings into queue rows. Nothing is enqueued automatically: a human or agent must pass fingerprints to `dustmap-briefs enqueue`.

## What you need

1. A Dustmap report (`dustmap scan` → `report.json` under `outputDir`).
2. `sinks.briefs` in `dustmap.config.json` (paths + id prefix + defaults).
3. The `@dustmap/sink-briefs` CLI on your PATH (workspace bin or install).

## Config example (Next monorepo + packages)

Entry points tell Knip which files are alive even when nothing imports them (App Router pages/routes, action registries, package bins, tool scripts, name-loaded modules). Adjust globs to your tree; keep project-specific knowledge here, never in Dustmap package source.

```json
{
  "include": ["**/*.{ts,tsx,js,jsx,mjs,cjs}"],
  "exclude": [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.dustmap/**",
    "**/coverage/**"
  ],
  "entryPoints": [
    "apps/*/app/**/page.tsx",
    "apps/*/app/**/route.ts",
    "apps/*/app/**/layout.tsx",
    "apps/*/lib/actions/**/*.{ts,tsx}",
    "packages/*/bin/**/*.{js,mjs,ts}",
    "packages/*/scripts/**/*.{js,mjs,ts}",
    "tools/**/*.{js,mjs,ts}",
    "**/loaded-by-name.ts"
  ],
  "outputDir": ".dustmap",
  "sinks": {
    "briefs": {
      "queuePath": "docs/briefs/queue.json",
      "briefsDir": "docs/briefs",
      "idPrefix": "HYG",
      "defaults": {
        "segment": "hygiene",
        "kind": "feature",
        "layer": 100,
        "epic": "HYG"
      }
    }
  }
}
```

Optional `template` (path to a markdown file) may use placeholders `{{ID}}`, `{{title}}`, `{{overview}}`, `{{scope_files}}`, `{{verify_section}}`, `{{fingerprint}}`. When omitted, Dustmap uses a built-in brief shape with Overview, Pliki (scope), and Weryfikacja (includes `verifyHint`).

## Enqueue selected findings

```bash
dustmap scan .
dustmap summary
dustmap-briefs enqueue <fingerprint> [<fingerprint>…]
```

Each new fingerprint creates:

- one markdown brief under `briefsDir` (never overwrites an existing file),
- one `queue.json` task with `source: "dustmap:<fingerprint>"`, empty `gates`, status `todo`.

The same fingerprint a second time is a no-op (existing id is reported; no second brief).

## Agent loop tip

Summary → show evidence → run `verifyHint` → only then `dustmap-briefs enqueue` or `dustmap decide … keep`. Do not dump the whole report into the queue.
