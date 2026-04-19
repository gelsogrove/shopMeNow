# Flow 3 — Asciugatrice ED-340 (Deterministico)

> **Source of truth**: `packages/database/prisma/seed.ts`
> **flowKey**: `asciugatrice_ed340`
> **Engine**: `FlowEngineService` (0 LLM tokens) + Sub-LLM classification for CHOICE nodes

## Machine Specs

| Program | Temp | Fabrics | Price (30 min) | Price (45 min) |
|---------|------|---------|----------------|----------------|
| Tª Alta | 80° | Towels, weekly laundry, 100% cotton | €5.00 | €6.50 |
| Tª Mitja | 65° | Duvets, blankets, mixed fabrics (50% cotton) | €4.00 | €5.50 |
| Tª Baixa | 50° | Sofa covers, work clothes, polyester/cotton blends | €3.00 | €4.50 |

- **Capacity**: 15 kg
- **Payment**: Coins or contactless at central unit
- **Start**: Press PAUSE to confirm time and start
- **Lint filter**: Must be cleaned before each use
- **Cooling phase**: Last 2 min — door may stay locked briefly after cycle ends

> ⚠️ NEVER put soaking wet clothes in dryer — damages filter and clothes won't dry

## CHOICE Node Architecture

CHOICE nodes use **open questions** (no numbered lists). Customer describes situation in free text.

- `FlowEngineService` attempts deterministic matching via `classifyInput()` (digits, yes/no)
- If input is AMBIGUOUS → signals `isAmbiguousChoice: true` to strategy
- `FlowWorkspaceStrategy` calls Sub-LLM to classify free-text against `transitionDescriptions`
- Classified key is re-fed to engine for deterministic transition

## Flows

### Flow: `non_parte` (dryer won't start)

**step_0** — CHOICE (open question):
> "What's happening with the dryer? Describe what you see on the display or what the problem is."

| Transition Key | Description | Target Node |
|---------------|-------------|-------------|
| `blank` | Display blank, dark, no lights, not turning on | `display_blank` |
| `door` | Door won't close, latch stuck | `door_issue` |
| `price` | Shows price but won't start after paying | `credit_issue` |

**display_blank** — ACTION:
> Display completely dark → dryer may need a reset.
> 👉 **Open the door**, **wait 10 seconds**, **close firmly until click**.
> If still blank → power issue, use another dryer.

**door_issue** — ACTION:
> Door latch stuck or not engaging.
> 👉 **Check no clothes caught** in seal, **close firmly** until clear click.

**credit_issue** — ACTION:
> Display shows price → insufficient credit.
> 👉 **Check exact amount**, **insert coins or tap contactless**.
> 👉 **Press the PAUSE button** firmly to confirm and start.

**ask_resolved** → **end_success** ✅ / **handle_escalate** → operator contacted.

### Flow: `errore_reset` (dryer errors)

**step_0** — CHOICE (open question):
> "What problem are you experiencing with the dryer?"

| Transition Key | Description | Target Node |
|---------------|-------------|-------------|
| `alarm` | Alarm/red light, blinking warning, error code | `allarme` |
| `no_heat` | Not heating, clothes still wet/damp after full cycle | `non_scalda` |
| `mid_stop` | Stops/shuts off mid-cycle, turns off before finishing | `mid_stop` |

**allarme** — ACTION:
> Alarm or warning light detected → step-by-step reset.
> 👉 **Press and hold STOP for 3 seconds**.
> 👉 **Open door**, **pull out lint filter**, clean it, put back.
> 👉 **Close door firmly**, try starting new cycle.

**non_scalda** — ACTION:
> Full cycle but clothes still damp → likely clogged lint filter.
> 👉 **Pull out the lint filter**, **remove all lint and debris**, put back.
> 👉 **Run a new drying cycle**.
> If still damp → heating element needs service, use another dryer.

**mid_stop** — ACTION:
> Dryer stopped mid-cycle → safety shut-off (overheating).
> 👉 **Wait 5 minutes** to cool down.
> 👉 **Pull out lint filter and clean** thoroughly.
> 👉 Start again with **smaller load**.

**ask_resolved** → **end_success** ✅ / **handle_escalate** → operator contacted.

## Playbook Coverage

| Section | Topic | Covered |
|---------|-------|---------|
| 5.2 | Dryer not working | ✅ `non_parte` flow |
| 5.2 | Dryer errors/reset | ✅ `errore_reset` flow |
| §7 | Compensation rules | ✅ No auto-promise, escalate |
| §8 | Location-specific (Alemanya/Pineda) | ✅ Credit anomaly → escalate (via Router) |
| §10 | Escalation protocol | ✅ All terminal escalate nodes |
