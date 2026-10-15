# Package map

npm workspaces under `packages/*`. Packages appear as briefs land (DUST-01+). Do not invent parallel packages for the same concern.

```
                    ┌─────────────────────┐
                    │  @dustmap/contract  │  Zod schemas, fingerprint, SARIF map
                    └──────────▲──────────┘
                               │ depends on
         ┌─────────────────────┼─────────────────────┐
         │                     │                     │
┌────────┴────────┐  ┌─────────┴─────────┐  ┌───────┴────────┐
│  @dustmap/core  │  │ @dustmap/adapters*│  │ @dustmap/sinks │
│ config, scan,   │  │ knip / jscpd /    │  │ queue briefs,  │
│ cache, rank,    │  │ depcruise / …     │  │ future tickets │
│ decisions       │  └───────────────────┘  └────────────────┘
└────────▲────────┘
         │
    ┌────┴────┐     ┌────────────┐
    │  cli    │     │    mcp     │
    └─────────┘     └────────────┘
```

\* Adapters may be one package with modules or thin packages; either way they only emit contract findings.

## Dependency rules

| From | May import | Must not import |
|------|------------|-----------------|
| `contract` | nothing in this monorepo | `core`, `cli`, `mcp`, adapters, sinks |
| `core` | `contract` | `cli`, `mcp`, sinks |
| adapters | `contract` (+ tool SDKs) | `cli`, `mcp`, each other for shared types |
| sinks | `contract` | `cli`, `mcp`, adapters |
| `cli` / `mcp` | `contract`, `core`, registered sinks | each other; raw tool output |

## Creation order (briefs)

| Package | Brief |
|---------|-------|
| `@dustmap/contract` | DUST-01 |
| `@dustmap/core` | DUST-02 (+ ranking DUST-09) |
| adapters | DUST-03, DUST-04, DUST-08 |
| signals in core | DUST-05 … DUST-07 |
| `@dustmap/cli` | DUST-10 |
| `@dustmap/mcp` | DUST-11 |
| sinks | DUST-13 |

## Repo tooling (not packages)

| Path | Role |
|------|------|
| `tools/queue/` | Agent task queue (next / close / validate) |
| `tools/tkr/` | Git-proof gate: close requires `Fixes {ID}` |
| `tools/verify.mjs` | Repo gate: queue + package typecheck/tests |
