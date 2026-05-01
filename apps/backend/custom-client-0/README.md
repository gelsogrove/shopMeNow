# Cliente-0 CLI

CLI runner for the production custom-client-0 flow architecture.

## Run

Compile-only check:

```bash
cd apps/backend/custom-client-0 && node --import tsx chatbot.ts --check
```

Interactive chat:

```bash
cd apps/backend/custom-client-0 && node --import tsx chatbot.ts
```

Interactive chat with debug trace:

```bash
cd apps/backend/custom-client-0 && node --import tsx chatbot.ts --debug
```

Scripted scenarios:

```bash
cd apps/backend/custom-client-0 && node --import tsx chatbot.ts --scripted
```

Scripted scenarios with debug trace:

```bash
cd apps/backend/custom-client-0 && node --import tsx chatbot.ts --scripted --debug
```

## Notes

- Requires `OPENROUTER_API_KEY` in the environment for real LLM calls.
- Uses the production JSON flows and prompt files under this folder.
- `--scripted` runs a small set of scenario-like transcripts inspired by `docs/escenario.md`.