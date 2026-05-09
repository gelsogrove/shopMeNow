// Diagnostic trace for Andrea's "secadora + push prog" chat (NO test, just a runner).
import { autoExtractFacts } from '../../utils/agent-extract.js'
import { runGuardPipeline } from '../../utils/guards/index.js'
import { createInitialState } from '../../utils/state.js'
import type { AgentRuntime } from '../../models/index.js'
import { loadTestRuntime, getCachedTestRuntime } from './_helpers.js'

async function main() {
  await loadTestRuntime()
  const ar: AgentRuntime = {
    state: createInitialState(),
    runtime: getCachedTestRuntime(),
    pendingEscalation: null,
    resolved: false,
    photoRequested: false,
  }
  ar.state.turnCount = 0

  const turns = ['me sale push prog', 'goya', 'secadora', '5', 'no', 'PUSH PROG']
  for (const u of turns) {
    ar.state.turnCount += 1
    autoExtractFacts(ar, u)
    const out = runGuardPipeline(ar, u)
    console.log(`👤 user: ${u}`)
    const s = ar.state
    console.log(`   state: display=${JSON.stringify(s.displayState)} type=${JSON.stringify(s.machineType)} num=${JSON.stringify(s.machineNumber)} loc=${JSON.stringify(s.location)} flow=${JSON.stringify(s.pendingFlow)} activeFlow=${JSON.stringify(s.activeFlowId)} step=${JSON.stringify(s.activeStepId)}`)
    if (out) {
      const oneLine = out.reply.split('\n')[0]
      console.log(`🤖 bot:  ${oneLine}  [${out.reason}]`)
    } else {
      console.log(`🤖 bot:  <NO GUARD FIRED — would go to LLM>`)
    }
    console.log()
  }
}

main()
