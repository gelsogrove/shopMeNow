# Flow 3 — Asciugatrice ED-340 (Deterministico)

> **Source of truth**: [`achitecture.md`](achitecture.md)
> **flowKey**: `asciugatrice_ed340`
> **JSON config**: [`01_secadora.json`](01_secadora.json)
> **Engine**: `FlowEngineService` (0 LLM tokens)

## Machine Specs

| Program | Temp | Fabrics |
|---------|------|---------|
| Tª Alta | 80° | Towels, weekly laundry, 100% cotton |
| Tª Mitja | 65° | Duvets, blankets, mixed fabrics (50% cotton) |
| Tª Baixa | 50° | Sofa covers, work clothes, polyester/cotton blends |

- **Capacity**: 15 kg
- **Payment**: Coins at central display (€3 = 15 min, €4 = 20 min, €5 = 25 min)
- **Start**: Press PAUSE to confirm time and start
- **Cooling phase**: Last 2 min — door may stay locked briefly after cycle ends
- **STOP**: Stops cycle completely — operator evaluates compensation
- **Alarm types**: PUERTA DEL FILTRO, FALLO DE ROTACION, FALLO DE ASPIRACION

> ⚠️ NEVER put soaking wet clothes in dryer — damages filter and clothes won't dry

## Operating Rules

- One instruction/question per step
- Payment check is ALWAYS `step_0` (first step)
- If flow resumes from PAUSED: re-send `currentNode.prompt` before new input
- No automatic compensation promised by bot
- Local anomalies (Alemanya/Pineda credit issues) → always escalate

## Flows

### Flow: `no_parte` (dryer won't start)

```mermaid
flowchart TD
    S0{"Inserted coins at<br/>central display?"}
    S0 -->|No| PAY["Insert coins:<br/>€3=15min, €4=20min, €5=25min<br/>Press PAUSE to confirm"]
    PAY --> PAY_R{"Coins inserted, time displayed?"}
    PAY_R -->|Yes| DISP
    PAY_R -->|No| ESC_PAY["⚠ Escalate: payment issue"]

    S0 -->|Yes| DISP{"What does the display show?"}

    DISP -->|"1 Price €"| CREDIT["Add more coins until time appears,<br/>then press PAUSE"]
    DISP -->|"2 Minutes"| START_BTN["Press PAUSE to start"]
    DISP -->|"3 DOOR"| DOOR["Close door firmly (click)"]
    DISP -->|"4 FILTRO"| FILTER["Clean filter + sensor,<br/>close filter door, press STOP once"]
    DISP -->|"5 FALLO"| FALLO
    DISP -->|"6 Off"| NO_POWER["⚠ Escalate: power supply issue"]

    FALLO{"FALLO type?"}
    FALLO -->|"1 ROTACION"| F_ROT["⚠ Escalate: drum sensor fault"]
    FALLO -->|"2 ASPIRACION"| F_ASP["Clean filter + aspiration tube,<br/>press STOP to reset"]
    FALLO -->|"3 Other"| F_GEN["Press STOP once to reset"]

    CREDIT --> AR{"Resolved?"}
    START_BTN --> AR
    DOOR --> AR
    FILTER --> AR
    F_ASP --> AR
    F_GEN --> AR

    AR -->|Yes| OK["✅ Resolved"]
    AR -->|No| RETRY{"Display now?"}

    RETRY -->|"1 Price"| CREDIT
    RETRY -->|"2 Minutes"| START_BTN
    RETRY -->|"3 DOOR"| DOOR
    RETRY -->|"4 FILTRO"| FILTER
    RETRY -->|"5 FALLO"| FALLO
    RETRY -->|"6 Off"| NO_POWER
    RETRY -->|Other| ESC["⚠ Escalate: operator"]
```

### Flow: `post_ciclo` (after drying finished)

```mermaid
flowchart TD
    P0{"What happened after drying?"}

    P0 -->|"1 Still damp"| DAMP
    P0 -->|"2 Burnt marks"| BURNT["⚠ Escalate: damage assessment"]
    P0 -->|"3 Plastic melted"| PLASTIC["Foreign object in drum.<br/>⚠ Client responsibility,<br/>escalate for review"]
    P0 -->|"4 Stains"| STAIN["⚠ Escalate: re-wash assessment"]
    P0 -->|"5 Bad smell"| SMELL["⚠ Escalate: check drum/filter"]
    P0 -->|"6 Door locked"| LOCK["Wait 2 min (cooling phase)"]

    DAMP{"Possible cause?"}
    DAMP -->|"1 Clothes soaking wet"| DAMP_WET["⚠ Never put soaking wet clothes!<br/>Escalate: may need re-wash"]
    DAMP -->|"2 Drum too full"| DAMP_FULL["⚠ Overloaded.<br/>Escalate: re-dry assessment"]
    DAMP -->|"3 Time too short"| DAMP_TIME["⚠ Escalate: re-dry assessment"]
    DAMP -->|"4 Not sure"| DAMP_FULL

    LOCK --> LOCK_R{"Door opened?"}
    LOCK_R -->|Yes| OK["✅ Resolved"]
    LOCK_R -->|No| ESC_DOOR["⚠ Escalate: door stuck"]
```

## Playbook Coverage

| Section | Topic | Covered |
|---------|-------|---------|
| 5.2 | Dryer not working | ✅ `no_parte` flow |
| 5.4 | Paid but won't start (dryer) | ✅ `no_parte.display_check` |
| §7 | Compensation rules | ✅ No auto-promise, escalate |
| §8 | Location-specific (Alemanya/Pineda) | ✅ Credit anomaly → escalate |
| §10 | Escalation protocol | ✅ All terminal `escalate` nodes |

## Node Map (01_secadora.json)

| Flow | Nodes | Types |
|------|-------|-------|
| `no_parte` | `step_0` → `pay_help` → `pay_retry` → `display_check` → 6 branches → `check_result` → `check_retry` | CONFIRMATION, ACTION, CHOICE, INFO |
| `post_ciclo` | `step_0` → 6 branches (`damp`, `burnt`, `plastic`, `stain`, `smell`, `door_locked`) | CHOICE, CONFIRMATION, ACTION, INFO |
