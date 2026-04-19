# Flow 2 — Lavatrice HS-60XX (Deterministico)

> **Source of truth**: `packages/database/prisma/seed.ts`
> **flowKey**: `lavatrice_hs60xx`
> **Engine**: `FlowEngineService` (0 LLM tokens) + Sub-LLM classification for CHOICE nodes

## Machine Specs

| Program | Temp | Fabrics | Price |
|---------|------|---------|-------|
| Molt Calent | 60° | White, work clothes, very dirty (resistant) | €4.00 |
| Calent | 40° | Cotton, coloured, nylon, other fibres | €3.50 |
| Temperat | 30° | Cotton blends, coloured, synthetics | €3.00 |
| Fred (*) | Cold | Delicates, wool, silk, curtains, down | €3.00 |

- **Capacity**: 8 kg
- **Spin**: 800 / 1000 / 1200 RPM (selectable)
- **Extras**: Extra rinse (+€0.50), Pre-wash (+€1.00)
- **Payment**: Coins or contactless at central unit
- **Duration**: ~28 min (normal cycle)

## CHOICE Node Architecture

CHOICE nodes use **open questions** (no numbered lists). Customer describes situation in free text.

- `FlowEngineService` attempts deterministic matching via `classifyInput()` (digits, yes/no)
- If input is AMBIGUOUS → signals `isAmbiguousChoice: true` to strategy
- `FlowWorkspaceStrategy` calls Sub-LLM to classify free-text against `transitionDescriptions`
- Classified key is re-fed to engine for deterministic transition

## Flows

### Flow: `non_parte` (machine won't start)

**step_0** — CHOICE (open question):
> "What exactly do you see on the washer display right now?"

| Transition Key | Description | Target Node |
|---------------|-------------|-------------|
| `sel` | SEL — standby/selection mode | `caso_sel` |
| `push` | PUSH or Pr + number — program not confirmed | `caso_push` |
| `door` | DOOR — door-related message | `caso_door` |
| `price` | Price/amount in euros — insufficient credit | `caso_importo` |
| `extra` | EXTRA — extra option indicator lit | `caso_extra` |
| `alm_door` | ALM DOOR — door alarm | `caso_alm_door` |
| `001` | 001, AL001, error 001 — numeric error code | `caso_001` |
| `alm` | ALM, ALN, other alarm codes | `caso_alm_gen` |

**caso_sel** — ACTION:
> Display shows *SEL* → machine ready, waiting for program selection.
> 👉 **Press the button for the program you want** (60°, 40°, 30° or Cold).

**caso_push** — ACTION:
> Display shows *PUSH* + number → credit inserted, program not confirmed.
> 👉 **Press the button for the program you want** firmly.

**caso_door** — ACTION:
> Display shows *DOOR* → door not closed properly.
> 👉 **Open the door completely**, check rubber seal, **close firmly until click**.

**caso_importo** — CHOICE (open question):
> "The display is showing a price... did the central unit return your coins or change?"
> → YES: `cambio_si` / NO: `cambio_no`

**cambio_si** — ACTION:
> Central unit returned change → need to re-insert full amount.
> 👉 **Check the exact amount** and **insert that amount** at central unit.

**cambio_no** — ACTION:
> Change not returned → possibly wrong machine number selected.
> 👉 **Go to the central unit** and check credit for another machine number.

**caso_extra** — INFO (terminal):
> *EXTRA* option activated, requires additional credit.
> 👉 **Press the lit EXTRA button** to deactivate, or **insert remaining credit**.

**caso_alm_door** — ACTION:
> *ALM DOOR* → something stuck in door seal.
> 👉 **Carefully open the door**, remove obstructions, **close firmly until click**.

**caso_001** — INFO (terminal, escalate):
> *Error 001* / *AL001* → program selected before payment, state didn't reset.
> 👉 **Do not insert more money** — operator contacted automatically.

**caso_alm_gen** — INFO (terminal, escalate):
> Generic alarm → requires technical review.
> 👉 **Do not continue operating** this machine. Use another one.

**ask_resolved** → **end_success** ✅ / **handle_escalate** → operator contacted.

### Flow: `errore_alm` (alarm codes)

**step_0** — CHOICE (open question):
> "What alarm code do you see after ALM on the display?"

| Transition Key | Description | Target Node |
|---------------|-------------|-------------|
| `alm_a` | ALM/A — water intake alarm | `alm_acqua` |
| `alm_e` | ALM/E — drainage alarm | `alm_scarico` |
| `alm_door` | ALM/door — door-related alarm | `alm_door` |
| `alm_var` | ALM/VAr — variable/technical alarm | `alm_var` |

**alm_acqua** — ACTION (terminal):
> Water intake problem → **Press the STOP button once** to reset.
> If persists → use another machine, maintenance notified.

**alm_scarico** — ACTION (terminal):
> Drainage problem → **Press the STOP button once**.
> ⚠️ Door may stay **locked for up to 30 minutes** (safety feature).

**alm_door** — ACTION (terminal):
> Door latch problem → **Press STOP once**, check seal, **close firmly**.

**alm_var** — INFO (terminal, escalate):
> Technical fault → **Do not continue using** this machine.
> Compensation provided 👍. Maintenance notified.

### Flow: `lavaggio_problema` (wash problems)

**step_0** — CHOICE (open question):
> "What problem did you notice during or after the wash?"

| Transition Key | Description | Target Node |
|---------------|-------------|-------------|
| `no_spin` | Didn't spin / clothes still very wet | `no_centrifuga` |
| `end_bal` | Display shows END + bAL | `end_bal` |

**no_centrifuga** — INFO (terminal):
> Overloaded/unbalanced load → **Open door**, **split load**, **run Quick spin cycle** (€2.50).

**end_bal** — INFO (terminal):
> *END + bAL* = wash OK but spin skipped due to unbalanced load.
> 👉 **Redistribute clothes** or **split load**, **run Quick spin cycle** (€2.50).

## Playbook Coverage

| Section | Topic | Covered |
|---------|-------|---------|
| 5.1 | Washer not working | ✅ `non_parte` flow |
| 5.4 | Paid but won't start | ✅ `non_parte.caso_importo` |
| 5.5 | Error AL001 | ✅ `non_parte.caso_001` |
| §7 | Compensation rules | ✅ No auto-promise, escalate |
| §10 | Escalation protocol | ✅ All terminal escalate nodes |
