/**
 * Reproducing Andrea's bug conversation against the v2 statechart.
 *
 * Expected behaviour:
 *
 *   T1 "ciao non mi funziona la lavatrice" → OPEN_INCIDENT → ask location
 *   T2 "Pineda"                            → PROVIDE_LOCATION → ask type
 *   T3 "lavatrice"                         → PROVIDE_TYPE → ask number
 *   T4 "5"                                 → PROVIDE_NUMBER → ask display
 *   T5 "DOOR"                              → PROVIDE_DISPLAY → guide-fix
 *   T6 "bene grazie funziona ma orari?"    → CONFIRM_RESOLVED → resolved
 *                                            (operational facts wiped on entry)
 *   T7 "e che prezzo avete?"               → REQUEST_TOPIC_SWITCH (pricing)
 *                                            stays in `closed`, NO door reprise
 *
 * v1 BUG: at T7 the bot reproposed DOOR.
 * v2 FIX: at T7 `closed` state has no PROVIDE_DISPLAY transition, and
 *         operational facts (displayState, machineType, machineNumber)
 *         were already nulled by the on-entry hook of `resolved`.
 *         The bug is STRUCTURALLY IMPOSSIBLE.
 */

import { TroubleOrchestrator } from '../adapters/orchestrator.js';

const orch = new TroubleOrchestrator({
  language: 'it',
  knownLocations: ['Pineda', 'Mataró', 'Calella', 'Barcelona'],
});

const turns: string[] = [
  'ciao non mi funziona la lavatrice',
  'Pineda',
  'lavatrice',
  '5',
  'DOOR',
  'bene grazie funziona ma dimmi che orari avete?',
  'e che prezzo avete?',
];

console.log('═'.repeat(70));
console.log('  v2 POC — replaying Andrea\'s DOOR-sticky bug conversation');
console.log('═'.repeat(70));

for (let i = 0; i < turns.length; i++) {
  const text = turns[i]!;
  const result = orch.processTurn(text);
  console.log(`\nT${i + 1} » ${text}`);
  console.log(`    state    : ${result.state}`);
  console.log(`    reply key: ${result.reply?.i18nKey ?? '(none)'}`);
  console.log(`    stage    : ${result.reply?.stage ?? '-'}`);
  console.log(`    facts    : loc=${result.context.location ?? '-'} type=${result.context.machineType ?? '-'} num=${result.context.machineNumber ?? '-'} display=${result.context.displayState ?? '-'}`);
}

console.log('\n' + '═'.repeat(70));
const final = orch.getState();
console.log(`Final state   : ${final.state}`);
console.log(`Final display : ${final.context.displayState ?? '(null — facts wiped on resolution)'}`);
console.log(`Final location: ${final.context.location ?? '(null)'}`);

if (final.state === 'closed' && final.context.displayState === null) {
  console.log('\n✅ BUG FIXED: v2 closes the dialogue cleanly. DOOR is gone.');
} else {
  console.log('\n❌ BUG STILL PRESENT in v2 — investigate.');
  throw new Error('v2 POC failed: bug reproduced');
}

orch.stop();
