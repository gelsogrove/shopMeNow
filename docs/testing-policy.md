# Testing Policy (Specification Lock)

## Core rule
Tests are the specification. The code must follow the tests, not the other way around.

## What this means
- Do NOT change tests to make code pass without explicit approval from Andrea.
  - This includes edits, deletions, or weakening assertions.
- If behavior must change, ask Andrea first, then update tests and docs together.
- If a test fails, fix the implementation first. Only change the test if it is wrong and approved.
- When tests are changed with approval, document the approval in the PR description.

## Scope
This policy applies to all unit tests, especially for:
- Plans and payments
- LLM flow and routing
- Scheduler jobs
- Widget active / debug mode
- Playground behavior

## If you are unsure
Stop and ask Andrea before touching tests.
