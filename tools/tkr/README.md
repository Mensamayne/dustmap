# TKR CLI

Portable git-proof gate for agent task queues. See [docs/TKR.md](../../docs/TKR.md).

```powershell
node tools/tkr/tkr-verify.mjs --id U20-02
node tools/tkr/tkr-status.mjs
node tools/tkr/tkr-check-ready.mjs --task-id U20-02
node tools/tkr/install.mjs --target C:\other\repo
```

npm (note `--` before flags):

```powershell
npm run tkr:verify -- --id U20-02
```

Config: `tkr-config.json` in this folder.
