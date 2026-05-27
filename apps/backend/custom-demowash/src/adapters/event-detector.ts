/**
 * Event detector — converts raw user text into a TroubleEvent.
 *
 * v1 mixed this with state mutation inside guard functions; here it's
 * a pure function. It uses:
 *
 *   - deterministic regex / token match for unambiguous inputs
 *     (display codes, numeric, location names, resolution-ack phrases)
 *   - a hook for LLM-assisted intent classification when the
 *     deterministic layer can't decide
 *
 * The detector is the ONLY place that touches raw text. The statechart
 * never sees a string — only typed events. This is the layer separation
 * v1 was missing.
 */

import type {
  TroubleEvent,
  DisplayCode,
  Language,
} from '../machines/types.js';

const DISPLAY_TOKENS: Record<string, DisplayCode> = {
  DOOR: 'DOOR',
  PUSH: 'PUSH',
  SEL: 'SEL',
  PR: 'PR',
  PRICE: 'PRICE',
  BLANK: 'BLANK',
  ALN: 'ALN',
  C001: 'C001',
  AL001: 'AL001',
  'ALM/DOOR': 'ALM/DOOR',
  'ALM/A': 'ALM/A',
  'ALM/E': 'ALM/E',
  'ALM/VAR': 'ALM/VAr',
  'END_BAL': 'END_BAL',
  '120': '120',
};

// Resolution phrases REQUIRE a positive marker (grazie/ok/bene/perfetto) +
// optional "funziona" OR an unambiguous "ora funziona" / "ha funzionato"
// form. Plain "funziona" alone is ambiguous ("non funziona" = persistence).
const RESOLUTION_PHRASES: Record<Language, RegExp[]> = {
  it: [
    /\b(ok|bene|perfetto|grazie|risolto)\b.*\bfunziona\b/i,
    /\bfunziona\b.*\b(grazie|perfetto|ok|bene)\b/i,
    /\b(risolto|ora\s+va|ora\s+funziona|ha\s+funzionato|tutto\s+ok)\b/i,
  ],
  es: [
    /\b(ok|bien|gracias|perfecto|resuelto)\b.*\bfunciona\b/i,
    /\bfunciona\b.*\b(gracias|perfecto|ok|bien)\b/i,
    /\b(resuelto|ya\s+funciona|todo\s+bien)\b/i,
  ],
  en: [
    /\b(ok|thanks|perfect|good|great)\b.*\b(works|working)\b/i,
    /\b(works|working)\b.*\b(thanks|perfect|now|great)\b/i,
    /\b(fixed|now\s+it\s+works|all\s+good)\b/i,
  ],
  ca: [
    /\b(ok|bé|gr[aà]cies|perfecte|resolt)\b.*\bfunciona\b/i,
    /\bfunciona\b.*\b(gr[aà]cies|perfecte|ok|b[eé])\b/i,
    /\b(resolt|ara\s+funciona|tot\s+b[eé])\b/i,
  ],
  pt: [
    /\b(ok|obrigado|perfeito|resolvido)\b.*\bfunciona\b/i,
    /\bfunciona\b.*\b(obrigado|perfeito|ok)\b/i,
    /\b(resolvido|agora\s+funciona|tudo\s+bem)\b/i,
  ],
  fr: [
    /\b(ok|merci|parfait|r[ée]solu)\b.*\b(fonctionne|marche)\b/i,
    /\b(fonctionne|marche)\b.*\b(merci|parfait|maintenant)\b/i,
    /\b(r[ée]solu|maintenant\s+[cç]a\s+marche|tout\s+va\s+bien)\b/i,
  ],
};

// Persistence/negation — must match BEFORE the bare PROVIDE_TYPE
// detection so that "non mi funziona la lavatrice" is heard as a
// problem opener, not as a type announcement.
const PERSISTENCE_PHRASES: Record<Language, RegExp[]> = {
  it: [/\bnon\s+\w*\s*funziona\b/i, /\bnon\s+va\b/i, /\bancora\b/i, /\bnemmeno\b/i],
  es: [/\bno\s+\w*\s*funciona\b/i, /\bsigue\b/i, /\btampoco\b/i, /\btodav[ií]a\b/i],
  en: [/\b(doesn'?t|don'?t|not)\s+\w*\s*work\b/i, /\bstill\s+(broken|not)\b/i, /\bnot\s+yet\b/i],
  ca: [/\bno\s+\w*\s*funciona\b/i, /\bencara\b/i, /\btampoc\b/i],
  pt: [/\bn[aã]o\s+\w*\s*funciona\b/i, /\bainda\b/i],
  fr: [/\bne\s+\w*\s*(marche|fonctionne)\s*pas\b/i, /\btoujours\s+pas\b/i],
};

// NOTE: trailing \b dropped because "prezz" + "o" share word boundary.
// Using prefix match instead.
const TOPIC_HOURS: RegExp = /\b(orari|hours|horario|hor[áa]rio|horaires)/i;
const TOPIC_PRICES: RegExp = /\b(prezz|price|precio|preu|pre[çc]o|prix|tariff|cost)/i;
const TOPIC_FAQ: RegExp = /\b(domanda|question|pregunta|pergunta|d[uú]vida)/i;

const ESCALATE_PHRASES: RegExp =
  /\b(operatore|operador|human|persona|agent|atendente)\b/i;

const NEW_INCIDENT_PHRASES: Record<Language, RegExp[]> = {
  it: [/\b(non\s+funziona|ho\s+un\s+problema|problema\s+con|aiuto)\b/i],
  es: [/\b(no\s+funciona|tengo\s+un\s+problema|problema\s+con|ayuda)\b/i],
  en: [/\b(doesn'?t\s+work|i\s+have\s+a\s+problem|problem\s+with|help)\b/i],
  ca: [/\b(no\s+funciona|tinc\s+un\s+problema|problema\s+amb|ajuda)\b/i],
  pt: [/\b(n[aã]o\s+funciona|tenho\s+um\s+problema|problema\s+com|ajuda)\b/i],
  fr: [/\b(ne\s+marche\s+pas|j'ai\s+un\s+probl[èe]me|aide)\b/i],
};

export interface DetectorInput {
  text: string;
  language: Language;
  knownLocations: string[];
  knownTypes: readonly ['washer', 'dryer'];
  /**
   * Current statechart node — lets the detector emit context-aware events
   * (e.g. a bare "5" is a NUMBER while gathering, but a NEW_INCIDENT
   * signal in `closed`).
   */
  currentState: string;
}

export function detectEvent(input: DetectorInput): TroubleEvent {
  const t = input.text.trim();
  const upper = t.toUpperCase();

  const isPersistence = PERSISTENCE_PHRASES[input.language].some(r => r.test(t));
  const isResolution = RESOLUTION_PHRASES[input.language].some(r => r.test(t));
  const isTopicHours = TOPIC_HOURS.test(t);
  const isTopicPrices = TOPIC_PRICES.test(t);
  const isTopicFaq = TOPIC_FAQ.test(t);

  // 1. Persistence FIRST (it contains "non funziona" which would otherwise
  //    be misread). In `closed`/`idle` it means a new incident opener.
  if (isPersistence && !isResolution) {
    if (input.currentState === 'closed' || input.currentState === 'idle') {
      return { type: 'OPEN_INCIDENT' };
    }
    return { type: 'REPORT_PERSISTENCE' };
  }

  // 2. Composite resolution + topic-switch ("bene grazie funziona ma orari")
  //    → CONFIRM_RESOLVED wins (closes the flow). The user has to repeat
  //    the topic on the next turn; the alternative (handling both atomically)
  //    is doable but would require event batching — not worth the complexity.
  if (isResolution) {
    return { type: 'CONFIRM_RESOLVED' };
  }

  // 3. Topic-switch (FAQ pivots)
  if (isTopicHours) return { type: 'REQUEST_TOPIC_SWITCH', target: 'hours' };
  if (isTopicPrices) return { type: 'REQUEST_TOPIC_SWITCH', target: 'pricing' };
  if (isTopicFaq) return { type: 'REQUEST_TOPIC_SWITCH', target: 'faq' };

  // 4. Explicit operator request
  if (ESCALATE_PHRASES.test(t)) return { type: 'ESCALATE_REQUEST' };

  // 5. Display code token match (WORD-boundary, not substring,
  //    otherwise "PREzzo" matches "PR")
  for (const token of Object.keys(DISPLAY_TOKENS)) {
    const escaped = token.replace(/[/.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`(?:^|[^A-Z0-9])${escaped}(?:$|[^A-Z0-9])`);
    if (re.test(upper)) {
      return { type: 'PROVIDE_DISPLAY', value: DISPLAY_TOKENS[token]! };
    }
  }

  // 6. Location match
  for (const loc of input.knownLocations) {
    if (t.toLowerCase().includes(loc.toLowerCase())) {
      return { type: 'PROVIDE_LOCATION', value: loc };
    }
  }

  // 7. Type (washer/dryer)
  if (/\b(lavatrice|washer|lavadora|rentadora|m[áa]quina\s+lava)\b/i.test(t)) {
    return { type: 'PROVIDE_TYPE', value: 'washer' };
  }
  if (/\b(asciugatrice|dryer|secadora|assecadora|secador)\b/i.test(t)) {
    return { type: 'PROVIDE_TYPE', value: 'dryer' };
  }

  // 8. Bare number (machine number)
  if (/^\s*\d{1,3}\s*$/.test(t)) {
    return { type: 'PROVIDE_NUMBER', value: t.trim() };
  }

  // 9. New incident opener (text-based) — only effective in closed/idle
  if (
    (input.currentState === 'closed' || input.currentState === 'idle') &&
    NEW_INCIDENT_PHRASES[input.language].some(r => r.test(t))
  ) {
    return { type: 'OPEN_INCIDENT' };
  }

  // 10. Fallback — let the statechart decide what UNKNOWN means in the
  //     current state (usually = retry the same ask)
  return { type: 'UNKNOWN' };
}
