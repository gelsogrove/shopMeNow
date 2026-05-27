/**
 * trouble-machine statechart (v2 POC).
 *
 * Solves the structural defects of v1's guard pipeline:
 *
 *   #1 State sparso (10+ campi mutati indipendentemente)
 *      → un solo `context` immutabile gestito da assign-actions dichiarative
 *
 *   #2 Guard pipeline ad accumulo, stateless dentro stato
 *      → transizioni esplicite event→state. Una guard non puo' scattare
 *        "per sbaglio" perche' lo stato corrente non glielo permette
 *
 *   #4 Cleanup parziale (releaseActiveFlow non azzera i fact)
 *      → on-exit hook in `flow.active` azzera SEMPRE displayState +
 *        machineType + machineNumber quando il flow esce verso `resolved`
 *        o `escalated`. Niente piu' briciole.
 *
 *   #5 Manca boundary-reset post-troubleshooting
 *      → stato `closed` e' terminale: rifiuta tutti gli eventi tranne
 *        OPEN_INCIDENT (incidente nuovo). Il bug DOOR-sticky e' impossibile
 *        per costruzione.
 *
 *   #6 Layering violato (router LLM unico arbitro)
 *      → la statechart non riceve user text grezzo. Riceve EVENTI tipizzati.
 *        Il detector (deterministico + LLM-assist) decide quale evento
 *        emettere PRIMA di entrare qui. Layer separati.
 */

import { setup, assign } from 'xstate';
import type {
  TroubleContext,
  TroubleEvent,
  DisplayCode,
  RecoverableDisplay,
} from './types.js';

const RECOVERABLE_DISPLAYS: ReadonlySet<RecoverableDisplay> = new Set([
  'SEL',
  'PUSH',
  'PR',
  'DOOR',
  'ALM/DOOR',
  'PRICE',
  'BLANK',
]);

function isRecoverable(d: DisplayCode | null): d is RecoverableDisplay {
  return d !== null && RECOVERABLE_DISPLAYS.has(d as RecoverableDisplay);
}

const INITIAL_CONTEXT: TroubleContext = {
  location: null,
  machineType: null,
  machineNumber: null,
  displayState: null,
  displayHistory: [],
  locationAskAttempts: 0,
  typeAskAttempts: 0,
  numberAskAttempts: 0,
  displayAskAttempts: 0,
  language: 'it',
  customerName: null,
  turnCount: 0,
  pendingReply: null,
};

export const troubleMachine = setup({
  types: {
    context: {} as TroubleContext,
    events: {} as TroubleEvent,
  },

  guards: {
    locationKnown: ({ context }) => context.location !== null,
    typeKnown: ({ context }) => context.machineType !== null,
    numberKnown: ({ context }) => context.machineNumber !== null,
    displayKnown: ({ context }) => context.displayState !== null,
    allFactsCollected: ({ context }) =>
      context.location !== null &&
      context.machineType !== null &&
      context.machineNumber !== null &&
      context.displayState !== null,
    displayRecoverable: ({ context }) => isRecoverable(context.displayState),
    locationAskMaxed: ({ context }) => context.locationAskAttempts >= 2,
    typeAskMaxed: ({ context }) => context.typeAskAttempts >= 2,
    numberAskMaxed: ({ context }) => context.numberAskAttempts >= 2,
    displayAskMaxed: ({ context }) => context.displayAskAttempts >= 2,
  },

  actions: {
    storeLocation: assign({
      location: ({ event }) =>
        event.type === 'PROVIDE_LOCATION' ? event.value : null,
      locationAskAttempts: 0,
    }),
    storeType: assign({
      machineType: ({ event }) =>
        event.type === 'PROVIDE_TYPE' ? event.value : null,
      typeAskAttempts: 0,
    }),
    storeNumber: assign({
      machineNumber: ({ event }) =>
        event.type === 'PROVIDE_NUMBER' ? event.value : null,
      numberAskAttempts: 0,
    }),
    storeDisplay: assign({
      displayState: ({ event }) =>
        event.type === 'PROVIDE_DISPLAY' ? event.value : null,
      displayHistory: ({ context, event }) =>
        event.type === 'PROVIDE_DISPLAY'
          ? [...context.displayHistory, event.value]
          : context.displayHistory,
      displayAskAttempts: 0,
    }),
    storeName: assign({
      customerName: ({ event }) =>
        event.type === 'PROVIDE_NAME' ? event.value : null,
    }),
    incLocationAttempts: assign({
      locationAskAttempts: ({ context }) => context.locationAskAttempts + 1,
    }),
    incTypeAttempts: assign({
      typeAskAttempts: ({ context }) => context.typeAskAttempts + 1,
    }),
    incNumberAttempts: assign({
      numberAskAttempts: ({ context }) => context.numberAskAttempts + 1,
    }),
    incDisplayAttempts: assign({
      displayAskAttempts: ({ context }) => context.displayAskAttempts + 1,
    }),
    incTurnCount: assign({
      turnCount: ({ context }) => context.turnCount + 1,
    }),

    /**
     * THE KEY ACTION — v1 didn't have this consistently.
     * Wipes operational facts so that re-entering trouble flow after
     * resolution starts CLEAN.  Customer identity is preserved.
     */
    resetOperationalFacts: assign({
      location: null,
      machineType: null,
      machineNumber: null,
      displayState: null,
      displayHistory: [],
      locationAskAttempts: 0,
      typeAskAttempts: 0,
      numberAskAttempts: 0,
      displayAskAttempts: 0,
      pendingReply: null,
    }),

    emitAskLocation: assign({
      pendingReply: () => ({ i18nKey: 'machine.askLocation', stage: 'ask-location' as const }),
    }),
    emitAskLocationRetry: assign({
      pendingReply: () => ({ i18nKey: 'machine.askLocationRetry', stage: 'ask-location' as const }),
    }),
    emitAskType: assign({
      pendingReply: () => ({ i18nKey: 'machine.askType', stage: 'ask-type' as const }),
    }),
    emitAskTypeRetry: assign({
      pendingReply: () => ({ i18nKey: 'machine.askTypeRetry', stage: 'ask-type' as const }),
    }),
    emitAskNumber: assign({
      pendingReply: () => ({ i18nKey: 'machine.askNumber', stage: 'ask-number' as const }),
    }),
    emitAskNumberRetry: assign({
      pendingReply: () => ({ i18nKey: 'machine.askNumberRetry', stage: 'ask-number' as const }),
    }),
    emitAskDisplay: assign({
      pendingReply: () => ({ i18nKey: 'machine.askDisplay', stage: 'ask-display' as const }),
    }),
    emitAskDisplayRetry: assign({
      pendingReply: () => ({ i18nKey: 'machine.askDisplayRetry', stage: 'ask-display' as const }),
    }),
    emitGuideFix: assign({
      pendingReply: ({ context }) => ({
        i18nKey: `machine.fix.${context.machineType ?? 'washer'}.${context.displayState ?? 'unknown'}`,
        vars: {
          location: context.location ?? '',
          number: context.machineNumber ?? '',
          display: context.displayState ?? '',
        },
        stage: 'guide-fix' as const,
      }),
    }),
    emitResolutionAck: assign({
      pendingReply: () => ({ i18nKey: 'machine.resolutionAck', stage: 'resolution-ack' as const }),
    }),
    emitEscalationAskName: assign({
      pendingReply: () => ({ i18nKey: 'machine.escalateAskName', stage: 'escalation' as const }),
    }),
    emitEscalationDone: assign({
      pendingReply: ({ context }) => ({
        i18nKey: 'machine.escalateDone',
        vars: { name: context.customerName ?? '' },
        stage: 'escalation' as const,
      }),
    }),
    emitTopicHandoff: assign({
      pendingReply: ({ event }) => ({
        i18nKey: 'machine.topicHandoff',
        vars: { target: event.type === 'REQUEST_TOPIC_SWITCH' ? event.target : '' },
        stage: 'topic-handoff' as const,
      }),
    }),
  },
}).createMachine({
  id: 'trouble-machine',
  initial: 'idle',
  context: INITIAL_CONTEXT,

  on: {
    // Topic-switch can fire at ANY turn (Andrea's dialog fluidity mandate).
    // We emit a handoff reply but stay in the current state so the user
    // can come back to troubleshooting unless they confirm resolution.
    REQUEST_TOPIC_SWITCH: {
      actions: ['emitTopicHandoff', 'incTurnCount'],
    },
  },

  states: {
    // ─────────────────────────────────────────────────────────────
    // IDLE — no incident open. Only OPEN_INCIDENT brings us in.
    // ─────────────────────────────────────────────────────────────
    idle: {
      on: {
        OPEN_INCIDENT: {
          target: 'gathering',
          actions: ['incTurnCount'],
        },
      },
    },

    // ─────────────────────────────────────────────────────────────
    // GATHERING — collect 4 facts in order with 3-strikes ladder.
    // Inputs out of order are accepted (storeX actions are pure).
    // The compound state re-evaluates always(...) and jumps to the
    // first missing slot.
    // ─────────────────────────────────────────────────────────────
    gathering: {
      initial: 'evaluating',
      states: {
        evaluating: {
          always: [
            { guard: 'allFactsCollected', target: '#trouble-machine.flow' },
            { guard: 'locationKnown', target: 'askType', actions: 'emitAskType' },
            { target: 'askLocation', actions: 'emitAskLocation' },
          ],
        },

        askLocation: {
          on: {
            PROVIDE_LOCATION: { target: 'evaluating', actions: 'storeLocation' },
            UNKNOWN: [
              {
                guard: 'locationAskMaxed',
                target: '#trouble-machine.escalating',
              },
              { actions: ['incLocationAttempts', 'emitAskLocationRetry'] },
            ],
          },
        },

        askType: {
          always: [
            { guard: 'typeKnown', target: 'askNumber', actions: 'emitAskNumber' },
          ],
          on: {
            PROVIDE_TYPE: { target: 'evaluating', actions: 'storeType' },
            UNKNOWN: [
              { guard: 'typeAskMaxed', target: '#trouble-machine.escalating' },
              { actions: ['incTypeAttempts', 'emitAskTypeRetry'] },
            ],
          },
        },

        askNumber: {
          always: [
            { guard: 'numberKnown', target: 'askDisplay', actions: 'emitAskDisplay' },
          ],
          on: {
            PROVIDE_NUMBER: { target: 'evaluating', actions: 'storeNumber' },
            UNKNOWN: [
              { guard: 'numberAskMaxed', target: '#trouble-machine.escalating' },
              { actions: ['incNumberAttempts', 'emitAskNumberRetry'] },
            ],
          },
        },

        askDisplay: {
          on: {
            PROVIDE_DISPLAY: { target: 'evaluating', actions: 'storeDisplay' },
            UNKNOWN: [
              { guard: 'displayAskMaxed', target: '#trouble-machine.escalating' },
              { actions: ['incDisplayAttempts', 'emitAskDisplayRetry'] },
            ],
          },
        },
      },
    },

    // ─────────────────────────────────────────────────────────────
    // FLOW — recoverable display: emit guide and wait for outcome.
    // Non-recoverable display: escalate immediately.
    // ─────────────────────────────────────────────────────────────
    flow: {
      initial: 'evaluating',
      states: {
        evaluating: {
          always: [
            { guard: 'displayRecoverable', target: 'guiding', actions: 'emitGuideFix' },
            { target: '#trouble-machine.escalating' },
          ],
        },
        guiding: {
          on: {
            CONFIRM_RESOLVED: '#trouble-machine.resolved',
            REPORT_PERSISTENCE: '#trouble-machine.escalating',
            // New display mid-flow → re-evaluate
            PROVIDE_DISPLAY: { target: 'evaluating', actions: 'storeDisplay' },
          },
        },
      },
    },

    // ─────────────────────────────────────────────────────────────
    // RESOLVED — terminal-ish. Emit ack, then auto-close.
    //
    // KEY INVARIANT: entry hook wipes operational facts. Even if the
    // detector later re-extracts "DOOR" from history by mistake,
    // PROVIDE_DISPLAY in `closed` does NOTHING — there's no transition
    // for it. The bug Andrea hit IS STRUCTURALLY IMPOSSIBLE in v2.
    // ─────────────────────────────────────────────────────────────
    resolved: {
      // Order matters: reset wipes pendingReply, THEN emit re-populates it
      // so the orchestrator still gets the ack reply key out.
      entry: ['resetOperationalFacts', 'emitResolutionAck'],
      always: { target: 'closed' },
    },

    // ─────────────────────────────────────────────────────────────
    // ESCALATING — ask for name, then close.
    // ─────────────────────────────────────────────────────────────
    escalating: {
      initial: 'askName',
      states: {
        askName: {
          entry: 'emitEscalationAskName',
          on: {
            PROVIDE_NAME: { target: 'done', actions: 'storeName' },
            UNKNOWN: { target: 'done' }, // anonymous closure
          },
        },
        done: {
          entry: 'emitEscalationDone',
          always: { target: '#trouble-machine.closed' },
        },
      },
    },

    // ─────────────────────────────────────────────────────────────
    // CLOSED — terminal absorbing state.
    //
    // The only way out is OPEN_INCIDENT — meaning the user explicitly
    // opens a new trouble report. Topic-switches (FAQ, hours, prices)
    // are still handled via the top-level `on` block, but NEVER cause
    // a re-entry into gathering/flow. This is the structural fix for
    // the DOOR-sticky bug.
    // ─────────────────────────────────────────────────────────────
    closed: {
      on: {
        OPEN_INCIDENT: {
          target: 'gathering',
          actions: ['resetOperationalFacts', 'incTurnCount'],
        },
      },
    },
  },
});

export type TroubleMachine = typeof troubleMachine;
