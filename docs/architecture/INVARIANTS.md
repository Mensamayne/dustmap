# Product invariants

These are laws, not preferences. A feature that would break one is out of scope.

## 1. Report-only on the scanned repo

Dustmap never edits, deletes, or commits the user's source. Writes go only under `outputDir` (default `.dustmap/`: report, cache, decisions, baseline).

Explicit exceptions (user-invoked only):

- `init` creates `dustmap.config.json`
- `init --agent` inserts marked agent instruction blocks (DUST-17)

No `--fix`, no auto-delete, no silent patches.

## 2. One contract, many adapters

Wire types live only in `@dustmap/contract`. Adapters (Knip, jscpd, dependency-cruiser, signal extractors) map tool output into that contract. CLI, MCP, SARIF and sinks never parse raw tool JSON.

## 3. Stable fingerprint

Every finding has a fingerprint derived from normalized code content (not line numbers). Ranking, decisions, baseline ratchet and brief dedupe all key on it.

## 4. Generic, not project-tailored

No knowledge of a specific customer repo inside `packages/*/src`. Entry points, layers and exceptions live in the user's `dustmap.config.json`.

## 5. Signals, not prescriptions

Findings say where it hurts and show evidence. They never prescribe how to refactor.

## 6. Local by default

No network calls unless the user's config opts in. Optional LLM judge stays off until enabled (DUST-14).

## 7. Agent-first surfaces

Every operator surface (CLI `--json`, MCP) must let an agent finish the loop without reading human docs: summary → place → evidence → verify hint → decision or queue brief.
