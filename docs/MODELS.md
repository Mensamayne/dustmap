# Models: embeddings and the pair judge

Dustmap finds duplicates in layers. The first two read text only and need no model: copies identical after renaming (and after changing constants), and near copies with lines changed or added. Two optional models go further:

- **The embedding model** turns every function into numbers, so functions that *mean* the same thing land close together even when their code differs (`semantic`).
- **The pair judge** reads two pieces of code side by side and says whether they do the same job (`judge`). It confirms or demotes duplicate groups of every layer that text alone cannot settle: same-meaning groups, copies that differ only in constants, near copies.

Both are chosen in `dustmap.config.json`. Either can be a local model package, an API, or nothing at all. Out of the box the embedding model is Dustmap's public package and there is no judge. The scan never fails because a model is missing: the layer is off, the report says so in a note (`scan.tools[].note`, and a `note:` line after `dustmap scan`) with how to turn it on, and every other layer runs.

## What leaves your machine

Nothing, by default. Code goes to another machine only when **both** hold:

1. the config names a URL that is not loopback (`127.0.0.1`, `localhost`, `::1`), and
2. that section sets `"allowRemote": true`.

API keys are read **only from environment variables**, never from the config file, and never written to the report or the cache.

| Section | Key variables (first set one wins) |
|---|---|
| `semantic` (`http`) | `DUSTMAP_SEMANTIC_API_KEY` |
| `judge` (`openai`, `anthropic`) | `DUSTMAP_JUDGE_API_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` |

A local server (Ollama, vLLM, llama.cpp, LM Studio) needs neither a key nor `allowRemote`.

## Embedding model (`semantic`)

### Dustmap model package (default)

Runs in-process with ONNX Runtime: offline, GPU when the card has room, CPU otherwise. Packages live in `~/.cache/dustmap/models` (or `$DUSTMAP_MODELS_DIR`); `dustmap model list` shows what is installed, `dustmap model pull <id>` installs one from Hugging Face ([Mensamayne/dustmap-models](https://huggingface.co/Mensamayne/dustmap-models)) and checks every file's SHA-256 (the only command that touches the network, and only when you run it). Pass `--from <url>` only for a mirror.

```json
{ "semantic": { "provider": "onnx", "model": "dustmap-same-meaning", "device": "auto" } }
```

`dustmap-same-meaning` (MIT, ~395 MB with both variants): `microsoft/unixcoder-base` fine-tuned for Dustmap's same-meaning task. Card: [docs/models/dustmap-same-meaning.md](models/dustmap-same-meaning.md). A package marked `private: true` in its manifest is still refused by `model pull`.

### Any OpenAI-compatible embeddings API

```json
{ "semantic": { "provider": "http", "model": "nomic-embed-text", "url": "http://127.0.0.1:11434/v1" } }
```

A hosted API (code leaves the machine):

```json
{ "semantic": { "provider": "http", "model": "text-embedding-3-small", "url": "https://api.openai.com/v1", "allowRemote": true } }
```

Without a package's calibration the report threshold is 0.82 cosine; set `semantic.threshold` for another model's scale.

### No embeddings

```json
{ "semantic": { "provider": "none" } }
```

Text layers (copies, near copies, CSS) still run.

## Pair judge (`judge`)

Every judge gets the same input — both pieces of code, comments removed — and gives the probability that they do the same job. Per group, every pair read as the same job → **high**. When the judge says no:

- a **text copy** (identical up to constants, or a near copy) keeps its confidence — the copy itself is certain, and a judge's no misses real duplicates (one in five on Dustmap's gold);
- a **same-meaning group** (embeddings only) goes to **low** with the reason, and stays in the report.

A mix leaves the confidence as it was. The verdict is in the finding's `judgement` (`real-duplicate`, `intentional-pattern` or `uncertain`, the judge's own reason, and which judge said it).

Verdicts are cached in `<outputDir>/cache/judge/`, so a re-scan reads only pairs whose code changed.

### A Dustmap judge package

```bash
dustmap model pull dustmap-pair-judge
```

```json
{ "judge": { "provider": "onnx", "model": "dustmap-pair-judge", "device": "auto" } }
```

MIT, ONNX (CPU fp32 / GPU fp16). Card: [docs/models/dustmap-pair-judge.md](models/dustmap-pair-judge.md). Default config still has `judge.provider: "none"` — opt in as above. Not installed → the scan says so in each group (`not judged — pair judge "…" is not installed`) and keeps similarity alone.

### GPT, or any OpenAI-compatible chat API

```json
{ "judge": { "provider": "openai", "model": "gpt-4o-mini", "allowRemote": true, "maxPairs": 400 } }
```

```bash
export OPENAI_API_KEY=sk-...
```

### Claude (Anthropic Messages API)

```json
{ "judge": { "provider": "anthropic", "model": "claude-haiku-5-5", "allowRemote": true, "maxPairs": 400 } }
```

```bash
export ANTHROPIC_API_KEY=sk-ant-...
```

### A local model (Ollama, vLLM, llama.cpp)

```json
{ "judge": { "provider": "openai", "model": "qwen2.5-coder:7b", "url": "http://127.0.0.1:11434/v1" } }
```

### No judge (default)

```json
{ "judge": { "provider": "none" } }
```

Similarity alone decides; no group carries a verdict.

### Settings

| Key | Default | Meaning |
|---|---|---|
| `provider` | `none` | `onnx` \| `openai` \| `anthropic` \| `none` |
| `model` | — | package id (`onnx`) or the API model name |
| `url` | the provider's own | API base URL; loopback needs no key |
| `allowRemote` | `false` | allow a non-loopback URL (code pairs leave the machine) |
| `device` | `auto` | `onnx` only: GPU variant when the card has ≥ 2.5 GB free, else CPU |
| `maxPairs` | `400` | API judges: new pairs read per scan (the cost cap); cached pairs are free; the rest stay unjudged and say so |
| `minBand` | `high` | lowest similarity band a judged same-meaning group is reported from as medium-and-up |

Older configs: `semantic.pairJudge` → `judge.provider` + `judge.model`; `semantic.judgedMinBand` → `judge.minBand`; `judge.enabled` → `judge.provider` (`"none"` = no judge). Dustmap rejects the old keys and names the new place.

### Cost

An API judge makes one request per new pair: two code pieces of at most 6 000 characters each, a ~150-token instruction, and a reply under 200 tokens. A first scan of a large repository reads up to `maxPairs` pairs; later scans pay only for changed code. The groups a scan may send are the same-meaning groups at the report threshold, copies that differ only in constants, and near copies — the lead place against at most 8 others per group.

## Measuring a judge before choosing it

`npm run dup:meter` scores any judge on Dustmap's gold pairs through the scan's own factory:

```bash
npm run dup:meter -- --no-l3 --judge-provider onnx --judge-model <package id>
npm run dup:meter -- --no-l3 --judge-provider anthropic --judge-model claude-haiku-5-5 --allow-remote --judge-limit 200
```

`--judge-limit` scores a fixed sample (the same pairs every run, so a re-run is free from the cache) and reports AP, precision at 0.5, the trap of same-file sibling helpers, and how many pairs were read vs taken from the cache.

## v1 results

Measured on a 1.27 M-line TypeScript monorepo and Dustmap's gold pairs ([dup-results.md](experiments/dup-results.md)):

| | |
|---|---|
| Judge package `dustmap-pair-judge-private` 0.1.0 | AP 0.736 on held-out gold (a general 7 B code LLM: 0.798); GPU 75 pairs/s, CPU 4.4 |
| Copies by constants + near copies, judged | precision 0.74 → 0.97 |
| Hand review, copy groups the judge confirmed (raised to high) | 10 / 10 real duplicates |
| Hand review, copy groups the judge read as a pattern (kept at medium) | 9 / 10 a shared skeleton with other data, 1 disputable |
