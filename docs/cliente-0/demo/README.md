# Cliente-0 Demo CLI

Standalone terminal demo for the cliente-0 FLOW architecture.

## Run

Compile-only check:

```bash
npx tsx docs/cliente-0/demo/demo.ts --check
```

Interactive chat:

```bash
npx tsx docs/cliente-0/demo/demo.ts
```

Interactive chat with debug trace:

```bash
npx tsx docs/cliente-0/demo/demo.ts --debug
```

Scripted scenarios:

```bash
npx tsx docs/cliente-0/demo/demo.ts --scripted
```

Scripted scenarios with debug trace:

```bash
npx tsx docs/cliente-0/demo/demo.ts --scripted --debug
```

## Notes

- Requires `OPENROUTER_API_KEY` in the environment for real LLM calls.
- Uses the cliente-0 JSON flows already defined under `docs/cliente-0/flows/json/`.
- Uses local prompt files under this folder so prompt iteration stays isolated from the app.
- `--scripted` runs a small set of scenario-like transcripts inspired by `flows/escenario.md`.