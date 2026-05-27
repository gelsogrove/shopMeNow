/**
 * Type contracts for the trouble-machine statechart.
 *
 * Context = the subset of dialogue state owned by the machine.
 * The full AgentRuntime state remains in v1; the adapter projects in/out.
 */

export type Language = 'es' | 'it' | 'en' | 'ca' | 'pt' | 'fr';

export type MachineType = 'washer' | 'dryer' | null;

export type DisplayCode =
  | 'SEL'
  | 'PUSH'
  | 'PR'
  | 'DOOR'
  | 'ALM/DOOR'
  | 'ALM/A'
  | 'ALM/E'
  | 'ALM/VAr'
  | 'ALN'
  | 'AL001'
  | 'C001'
  | 'PRICE'
  | 'BLANK'
  | 'END_BAL'
  | '120';

export type RecoverableDisplay = Extract<
  DisplayCode,
  'SEL' | 'PUSH' | 'PR' | 'DOOR' | 'ALM/DOOR' | 'PRICE' | 'BLANK'
>;

export interface TroubleContext {
  // ─── Operational facts (cleared on RESOLVED/ESCALATED via on-exit hook) ───
  location: string | null;
  machineType: MachineType;
  machineNumber: string | null;
  displayState: DisplayCode | null;
  displayHistory: DisplayCode[];

  // ─── Retry counters (3-strikes ladder) ───
  locationAskAttempts: number;
  typeAskAttempts: number;
  numberAskAttempts: number;
  displayAskAttempts: number;

  // ─── Conversation meta ───
  language: Language;
  customerName: string | null;
  turnCount: number;

  // ─── Outbound payload to the orchestrator ───
  pendingReply: PendingReply | null;
}

export interface PendingReply {
  i18nKey: string;
  vars?: Record<string, string>;
  /** Tells the orchestrator the dialogue stage so the LLM tone matches. */
  stage:
    | 'ask-location'
    | 'ask-type'
    | 'ask-number'
    | 'ask-display'
    | 'guide-fix'
    | 'resolution-ack'
    | 'escalation'
    | 'topic-handoff';
}

// ─── EVENTS = the universe of dialogue inputs the machine recognises ───
export type TroubleEvent =
  | { type: 'OPEN_INCIDENT' }
  | { type: 'PROVIDE_LOCATION'; value: string }
  | { type: 'PROVIDE_TYPE'; value: 'washer' | 'dryer' }
  | { type: 'PROVIDE_NUMBER'; value: string }
  | { type: 'PROVIDE_DISPLAY'; value: DisplayCode }
  | { type: 'CONFIRM_RESOLVED' }
  | { type: 'REPORT_PERSISTENCE' }
  | { type: 'REQUEST_TOPIC_SWITCH'; target: 'faq' | 'pricing' | 'hours' }
  | { type: 'PROVIDE_NAME'; value: string }
  | { type: 'ESCALATE_REQUEST' }
  | { type: 'UNKNOWN' };
