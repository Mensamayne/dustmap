# dustmap-pair-judge

Published Dustmap pair-judge package (REL-06). Install:

```bash
dustmap model pull dustmap-pair-judge
```

Source: [Mensamayne/dustmap-models](https://huggingface.co/Mensamayne/dustmap-models) (`dustmap-pair-judge/`).

| | |
|---|---|
| Role | Layer L4: two code pieces → probability they do the same job |
| Licence | MIT |
| Base | `microsoft/unixcoder-base` (Apache-2.0) |
| Variants | CPU (fp32 ONNX), GPU (fp16 ONNX) |
| Default in Dustmap | off (`judge.provider: "none"`); opt in with `judge.provider: "onnx"` |

Formerly the maintainer-local `dustmap-pair-judge-private`. Published under MIT by decision of 26.10.2026: open weights, no fee.
