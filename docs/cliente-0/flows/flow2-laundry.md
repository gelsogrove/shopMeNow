# Flow 2 — Lavatrice HS-60XX (Deterministico)

> **Source of truth**: [`achitecture.md`](achitecture.md)
> **flowKey**: `lavatrice_hs60xx`
> **JSON config**: [`02_lavatrice.json`](02_lavatrice.json)
> **Engine**: `FlowEngineService` (0 LLM tokens)

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
- **Payment**: Coins, card, or loyalty card at central panel
- **Soap**: Automatic dosing (detergent + softener + active oxygen) — industrial, less foam is NORMAL
- **Duration**: ~28 min (normal cycle)

## Operating Rules

- One instruction/question per step
- Payment check is ALWAYS `step_0` (first step)
- Retry limit: loop back max before escalation
- If flow resumes from PAUSED: re-send `currentNode.prompt` before new input
- No automatic compensation promised by bot
- STOP = cancels wash → operator decides compensation

## Flows

### Flow: `no_parte` (machine won't start)

```mermaid
flowchart TD
    S0{"Paid already?"}
    S0 -->|No| PAY["Payment instructions:<br/>1. Pay at central<br/>2. Select machine #<br/>3. Press program<br/>4. Close door"]
    PAY --> PAY_R{"Paid now?"}
    PAY_R -->|Yes| DISP
    PAY_R -->|No| ESC_PAY["⚠ Escalate: payment issue"]

    S0 -->|Yes| DISP{"What does the display show?"}

    DISP -->|"1 SEL"| SEL["Select machine # / press program"]
    DISP -->|"2 Price €"| PRICE{"Change returned?"}
    DISP -->|"3 PUSH/Pr"| PUSH["Press program button"]
    DISP -->|"4 DOOR"| DOOR["Close door firmly (click)"]
    DISP -->|"5 ALM"| ALM
    DISP -->|"6 AL001"| AL001["⚠ Escalate: sequence error<br/>(program before payment)"]
    DISP -->|"7 END"| END_N["Cycle ended normally"]

    PRICE -->|Yes| PRICE_OK["Check display, insert correct amount"]
    PRICE -->|No| PRICE_NO["Wrong machine #?<br/>Check credit on central, press correct button"]

    ALM --> ALM_T{"ALM subtype?"}
    ALM_T -->|"1 Water"| ALM_W["Press STOP once"]
    ALM_T -->|"2 Drain"| ALM_DR["Press STOP once"]
    ALM_T -->|"3 Door"| ALM_D["Check door latch, close properly"]
    ALM_T -->|"4 Other"| ALM_O["Press STOP once"]

    SEL --> AR{"Resolved?"}
    PUSH --> AR
    DOOR --> AR
    PRICE_OK --> AR
    PRICE_NO --> AR
    ALM_W --> AR_ALM{"Resolved?"}
    ALM_DR --> AR_ALM
    ALM_D --> AR_ALM
    ALM_O --> AR_ALM

    AR -->|Yes| OK["✅ Resolved"]
    AR -->|No| ESC["⚠ Escalate: operator"]

    AR_ALM -->|Yes| OK_ALM["✅ Resolved"]
    AR_ALM -->|No| ESC_ALM["⚠ Escalate: alarm persists"]
```

### Flow: `post_ciclo` (after wash finished)

```mermaid
flowchart TD
    P0{"What's the problem?"}

    P0 -->|"1 Clothes wet"| WET{"Was display END+bAL?"}
    P0 -->|"2 Door locked"| LOCK["Wait 2-3 min (draining)"]
    P0 -->|"3 Damaged"| DMG["⚠ Escalate: check label/usage"]
    P0 -->|"4 No foam"| FOAM["Normal: industrial detergent,<br/>less foam is expected"]

    WET -->|Yes| BAL["⚠ Escalate: unbalanced load"]
    WET -->|No| WET_NORM["Overloaded: split load,<br/>use Quick program €2.50"]

    LOCK --> LOCK_R{"Door opened?"}
    LOCK_R -->|Yes| OK["✅ Resolved"]
    LOCK_R -->|No| ESC_DOOR["⚠ Escalate: door stuck"]

    FOAM --> RES_INFO["ℹ Info closure"]
    DMG --> RES_INFO
    RES_INFO -->|"Customer contests"| ESC_COMP["⚠ Escalate"]
```

### Flow: `stop_error` (STOP button pressed)

```mermaid
flowchart TD
    S0{"Was it before the first cycle?"}
    S0 -->|Yes| FIRST["Machine ready to restart.<br/>Select program and start again."]
    S0 -->|No| MID["⚠ STOP cancels mid-cycle wash.<br/>No automatic compensation.<br/>Escalate: operator decides."]
```

## Playbook Coverage

| Section | Topic | Covered |
|---------|-------|---------|
| 5.1 | Washer not working | ✅ `no_parte` flow |
| 5.4 | Paid but won't start | ✅ `no_parte.display_check` |
| 5.5 | Error AL001 | ✅ `no_parte.case_al001` |
| §7 | Compensation rules | ✅ No auto-promise, escalate |
| §10 | Escalation protocol | ✅ All terminal `escalate` nodes |

## Node Map (02_lavatrice.json)

| Flow | Nodes | Types |
|------|-------|-------|
| `no_parte` | `step_0` → `pay_help` → `pay_retry` → `display_check` → 7 branches → `ask_resolved` | CONFIRMATION, ACTION, CHOICE, INFO |
| `post_ciclo` | `step_0` → 5 branches (`wet_clothes`, `door_locked`, `damaged`, `foam_info`, `escalate`) | CHOICE, CONFIRMATION, INFO |
| `stop_error` | `step_0` → `stop_first_time` / `stop_mid_cycle` | CONFIRMATION, INFO |
