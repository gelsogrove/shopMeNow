#!/usr/bin/env node

/**
 * Test completo del flusso: salami → 1 → si
 */

import axios from "axios"

const CONFIG = {
  backendUrl: "http://localhost:3001",
  apiEndpoint: "/api/whatsapp/webhook",
  phoneNumber: "+390212345678",
  workspaceId: "cm9hjgq9v00014qk8fsdy4ujv",
}

async function sendMessage(message, step) {
  console.log(`\n${"=".repeat(80)}`)
  console.log(`STEP ${step}: Sending "${message}"`)
  console.log("=".repeat(80))

  const payload = {
    message: message,
    phoneNumber: CONFIG.phoneNumber,
    workspaceId: CONFIG.workspaceId,
    debug: true,
    logLevel: "verbose",
    customerName: "Mario Rossi",
    language: "it",
    testMode: true,
  }

  try {
    const response = await axios.post(
      `${CONFIG.backendUrl}${CONFIG.apiEndpoint}`,
      payload,
      {
        headers: { "Content-Type": "application/json" },
        timeout: 30000,
      }
    )

    if (response.status === 200 && response.data.response) {
      console.log("\n✅ RISPOSTA:")
      console.log(response.data.response)

      // Mostra debug info se disponibile
      if (response.data.debugInfo) {
        console.log("\n🔧 DEBUG INFO:")
        console.log(`- Total tokens: ${response.data.debugInfo.totalTokens}`)
        console.log(
          `- Execution time: ${response.data.debugInfo.executionTimeMs}ms`
        )
        console.log(`- Steps: ${response.data.debugInfo.steps.length}`)

        response.data.debugInfo.steps.forEach((step, i) => {
          console.log(`\n  Step ${i + 1}: ${step.type} (${step.agent})`)
          if (step.functionCallDecision) {
            console.log(`    Function: ${step.functionCallDecision}`)
          }
          if (step.output && step.output.decision) {
            console.log(`    Decision: ${step.output.decision}`)
          }
        })
      }

      return response.data.response
    } else {
      console.error("❌ Formato risposta inaspettato:", response.data)
      return null
    }
  } catch (error) {
    console.error("❌ Errore:", error.message)
    if (error.response) {
      console.error("Response data:", error.response.data)
    }
    return null
  }
}

async function main() {
  console.log("\n🧪 TEST COMPLETO FLUSSO SALAMI\n")
  console.log('1️⃣  Step 1: Ricerca "salami"')
  console.log('2️⃣  Step 2: Selezione "1" (Salami Stagionati)')
  console.log('3️⃣  Step 3: Conferma "si"')
  console.log("\n" + "=".repeat(80))

  // Wait 2 seconds between messages
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

  // Step 1: Ricerca salami
  const response1 = await sendMessage("salami", 1)
  if (!response1) {
    console.error("\n❌ Step 1 failed - aborting test")
    process.exit(1)
  }

  await delay(2000)

  // Step 2: Selezione "1"
  const response2 = await sendMessage("1", 2)
  if (!response2) {
    console.error("\n❌ Step 2 failed - aborting test")
    process.exit(1)
  }

  await delay(2000)

  // Step 3: Conferma "si"
  const response3 = await sendMessage("si", 3)
  if (!response3) {
    console.error("\n❌ Step 3 failed - aborting test")
    process.exit(1)
  }

  console.log("\n" + "=".repeat(80))
  console.log("✅ TEST COMPLETATO")
  console.log("=".repeat(80) + "\n")

  // Analizza se il prodotto è stato aggiunto
  if (response3.includes("aggiunto") && response3.includes("carrello")) {
    console.log("✅ SUCCESS: Prodotto aggiunto al carrello")
  } else if (
    response3.includes("problema") ||
    response3.includes("non è disponibile")
  ) {
    console.log("❌ FAILED: Prodotto non aggiunto - errore rilevato")
  } else {
    console.log("⚠️  UNCLEAR: Risposta ambigua, verificare manualmente")
  }

  process.exit(0)
}

main().catch((error) => {
  console.error("❌ Fatal error:", error)
  process.exit(1)
})
