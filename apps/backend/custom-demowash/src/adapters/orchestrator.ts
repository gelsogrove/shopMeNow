/**
 * Orchestrator — the public API of v2.
 *
 * Wraps an XState actor for the trouble-machine and exposes a single
 * `processTurn(text)` function. This is what an integrator (or the
 * v1 agent.ts entrypoint, eventually) would call.
 *
 * Responsibilities:
 *   - persist actor state across turns (snapshot in memory; in prod
 *     would be in DB or session store)
 *   - detect the event from raw text
 *   - send it to the machine
 *   - read the resulting `pendingReply` and return it
 *
 * What it deliberately does NOT do:
 *   - mutate the context directly (only the machine does)
 *   - decide flow logic (the machine does)
 *   - translate i18n (the integrator does)
 */

import { createActor, type Actor } from 'xstate';
import { troubleMachine } from '../machines/trouble-machine.machine.js';
import type { Language, PendingReply, TroubleContext } from '../machines/types.js';
import { detectEvent } from './event-detector.js';

export interface OrchestratorOptions {
  language: Language;
  knownLocations: string[];
}

export interface TurnResult {
  reply: PendingReply | null;
  state: string;
  context: TroubleContext;
  /** True if the dialogue closed this turn (resolved or escalated). */
  closed: boolean;
}

export class TroubleOrchestrator {
  private actor: Actor<typeof troubleMachine>;
  private options: OrchestratorOptions;

  constructor(options: OrchestratorOptions) {
    this.options = options;
    this.actor = createActor(troubleMachine);
    this.actor.start();
  }

  processTurn(text: string): TurnResult {
    const snapshot = this.actor.getSnapshot();
    const currentState = this.stateString(snapshot.value);

    const event = detectEvent({
      text,
      language: this.options.language,
      knownLocations: this.options.knownLocations,
      knownTypes: ['washer', 'dryer'] as const,
      currentState,
    });

    this.actor.send(event);

    const next = this.actor.getSnapshot();
    return {
      reply: next.context.pendingReply,
      state: this.stateString(next.value),
      context: next.context,
      closed: this.stateString(next.value) === 'closed',
    };
  }

  /** For tests / debugging. */
  getState(): { state: string; context: TroubleContext } {
    const s = this.actor.getSnapshot();
    return { state: this.stateString(s.value), context: s.context };
  }

  stop(): void {
    this.actor.stop();
  }

  private stateString(value: unknown): string {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const keys = Object.keys(value);
      if (keys.length === 0) return 'unknown';
      const k = keys[0]!;
      const inner = (value as Record<string, unknown>)[k];
      return `${k}.${this.stateString(inner)}`;
    }
    return 'unknown';
  }
}
