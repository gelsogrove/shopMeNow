#!/usr/bin/env node

/**
 * 🤖 MCP CHAT TEST CLIENT - ADVANCED VERSION
 *
 * Client per testare le chiamate reali al backend eChatbot
 * con supporto per utenti multipli e test automatici
 *
 * Usage:
 *   node mcp-test-client.js [user] [message] [workspaceId=ID] [exit-first-message=true] [seed=true]
 *
 * Examples:
 *   node mcp-test-client.js "Mario Rossi" "aggiungi una mozzarella" exit-first-message=true
 *   node mcp-test-client.js "Mario Rossi" "aggiungi una mozzarella" workspaceId=cm9hjgq9v00014qk8fsdy4ujv exit-first-message=true
 *   node mcp-test-client.js "John Smith" "add to cart prosecco" seed=true
 *   node mcp-test-client.js "Mario Rossi" "mostra carrello" exit-first-message=true seed=true
 *   node mcp-test-client.js (interactive mode)
 */

import axios from "axios"
import readline from "readline"

// Configurazione utenti predefiniti (multilingue)
const USERS = {
  "Mario Rossi": {
    customerId: "3c9fce96-5397-5c9f-9f8e-3d4f5a6b7890",
    customerPhone: "+390212345678",
    customerName: "Mario Rossi",
    language: "it",
    flag: "🇮🇹",
  },
  "John Smith": {
    customerId: "user-en-001",
    customerPhone: "+44123456789",
    customerName: "John Smith",
    language: "en",
    flag: "🇬🇧",
  },
  "Maria Garcia": {
    customerId: "test-customer-123",
    customerPhone: "+34666777888",
    customerName: "Maria Garcia",
    language: "es",
    flag: "🇪🇸",
  },
  "João Silva": {
    customerId: "user-pt-001",
    customerPhone: "+351912345678",
    customerName: "João Silva",
    language: "pt",
    flag: "🇵🇹",
  },
}

// Configurazione base
const CONFIG = {
  backendUrl: "http://localhost:3001",
  apiEndpoint: "/api/whatsapp/webhook",
  defaultUser: "Mario Rossi",
}

class MCPTestClient {
  constructor(
    selectedUser = null,
    testMessage = null,
    exitAfterFirst = false,
    runSeed = false,
    showLogs = false,
    workspaceId = null
  ) {
    this.selectedUser = selectedUser || CONFIG.defaultUser
    this.testMessage = testMessage
    this.exitAfterFirst = exitAfterFirst
    this.runSeed = runSeed
    this.showLogs = showLogs
    this.workspaceId = workspaceId || "cm9hjgq9v00014qk8fsdy4ujv" // Default workspace
    this.sessionActive = false
    this.sessionData = {
      messages: [],
      totalFunctionCalls: 0,
      functionCallsDetails: [],
      startTime: null,
      endTime: null,
    }
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    })

    // Colori console
    this.colors = {
      reset: "\x1b[0m",
      red: "\x1b[31m",
      green: "\x1b[32m",
      yellow: "\x1b[33m",
      blue: "\x1b[34m",
      magenta: "\x1b[35m",
      cyan: "\x1b[36m",
    }

    // Se showLogs è attivo, avvia il monitoraggio dei log del server
    if (this.showLogs) {
      this.startServerLogMonitoring()
    }
  }

  // Monitora i log del server in tempo reale
  async startServerLogMonitoring() {
    const { spawn } = await import("child_process")

    console.log(
      `${this.colors.cyan}📡 Avviando monitoraggio log del server...${this.colors.reset}`
    )
    console.log(
      `${this.colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`
    )

    // Leggi i log dal file che il server scrive
    const logFile = "/tmp/echatbot-server.log"

    // Avvia il processo per leggere i log del server
    this.logProcess = spawn("tail", ["-f", logFile], {
      stdio: "pipe",
    })

    this.logProcess.stdout.on("data", (data) => {
      const logLine = data.toString().trim()
      if (logLine) {
        console.log(
          `${this.colors.cyan}📋 SERVER LOG: ${logLine}${this.colors.reset}`
        )
      }
    })

    this.logProcess.stderr.on("data", (data) => {
      // Ignora errori di tail se il file non esiste ancora
    })

    this.logProcess.on("error", (error) => {
      console.log(
        `${this.colors.yellow}⚠️  Log monitoring failed: ${error.message}${this.colors.reset}`
      )
    })

    console.log(
      `${this.colors.green}✅ Log monitoring started - watching ${logFile}${this.colors.reset}`
    )
  }

  // Ferma il monitoraggio dei log
  stopServerLogMonitoring() {
    if (this.logProcess) {
      this.logProcess.kill()
      console.log(
        `${this.colors.cyan}📡 Monitoraggio log del server fermato${this.colors.reset}`
      )
    }
  }

  // Ottieni configurazione utente
  getUserConfig() {
    const user = USERS[this.selectedUser]
    if (!user) {
      throw new Error(
        `User "${this.selectedUser}" not found. Available users: ${Object.keys(
          USERS
        ).join(", ")}`
      )
    }
    return user
  }

  // Esegue il seed del database
  async runDatabaseSeed() {
    const { spawn } = require("child_process")

    console.log(
      `${this.colors.yellow}🌱 Eseguendo seed del database...${this.colors.reset}`
    )

    return new Promise((resolve, reject) => {
      const seedProcess = spawn("npm", ["run", "seed"], {
        cwd: "../", // MCP is now under backend/
        stdio: "pipe",
      })

      let output = ""
      let errorOutput = ""

      seedProcess.stdout.on("data", (data) => {
        output += data.toString()
      })

      seedProcess.stderr.on("data", (data) => {
        errorOutput += data.toString()
      })

      seedProcess.on("close", (code) => {
        if (code === 0) {
          console.log(
            `${this.colors.green}✅ Seed completato con successo!${this.colors.reset}`
          )
          resolve()
        } else {
          console.error(
            `${this.colors.red}❌ Errore durante il seed: ${errorOutput}${this.colors.reset}`
          )
          reject(new Error(`Seed failed with code ${code}`))
        }
      })

      seedProcess.on("error", (error) => {
        console.error(
          `${this.colors.red}❌ Errore durante l'esecuzione del seed: ${error.message}${this.colors.reset}`
        )
        reject(error)
      })
    })
  }

  // Inizializza la sessione
  async start() {
    // Esegui seed se richiesto
    if (this.runSeed) {
      try {
        await this.runDatabaseSeed()
      } catch (error) {
        console.error(
          `${this.colors.red}❌ Errore durante il seed, continuando comunque...${this.colors.reset}`
        )
      }
    }

    const userConfig = this.getUserConfig()

    console.log(
      `${this.colors.blue}=== MCP CHAT TEST CLIENT ===${this.colors.reset}`
    )
    console.log(
      `${this.colors.green}${userConfig.flag} Connesso come: ${userConfig.customerName} (${userConfig.customerPhone})${this.colors.reset}`
    )
    console.log(
      `${this.colors.yellow}Server: ${CONFIG.backendUrl}${this.colors.reset}`
    )

    if (this.testMessage) {
      console.log(
        `${this.colors.magenta}🤖 AUTO-TEST MODE: "${this.testMessage}"${this.colors.reset}`
      )
      this.sessionActive = true
      await this.sendMessage(this.testMessage)
      if (this.exitAfterFirst) {
        console.log(
          `${this.colors.cyan}✅ Test completato - uscita automatica${this.colors.reset}`
        )
        this.stop()
        return
      }
    }

    console.log(
      `${this.colors.cyan}Scrivi i tuoi messaggi. Digita EXIT per uscire.${this.colors.reset}`
    )
    this.sessionActive = true
    this.promptUser()
  }

  // Richiede input all'utente
  promptUser() {
    if (!this.sessionActive) return

    this.rl.question(
      `${this.colors.magenta}TU > ${this.colors.reset}`,
      async (message) => {
        if (message.trim().toUpperCase() === "EXIT") {
          this.endSession()
          return
        }

        try {
          await this.sendMessage(message)
          // Dopo aver ricevuto la risposta, richiedi il prossimo input
          this.promptUser()
        } catch (error) {
          console.error(
            `${this.colors.red}Errore: ${error.message}${this.colors.reset}`
          )
          // Anche in caso di errore, richiedi il prossimo input
          this.promptUser()
        }
      }
    )
  }

  // Simula la risposta per migliorare le risposte del sistema
  simulateResponse(message) {
    const msg = message.toLowerCase().trim()

    // Risposte migliorate per i comandi principali
    if (msg.includes("prodotti")) {
      return `
🏪 **Catalogo Prodotti**

| Codice | Prodotto     | Prezzo   | Disponibilità |
|--------|-------------|----------|--------------|
| P001   | Limoncello   | €22,00   | ✅ In magazzino |
| P002   | Prosecco     | €15,00   | ✅ In magazzino |
| P003   | Parmigiano   | €12,50/kg| ✅ In magazzino |
| P004   | Pasta artigianale | €4,50 | ✅ In magazzino |
| P005   | Olio d'oliva | €18,00   | ✅ In magazzino |
| P006   | Aceto Balsamico | €15,50 | ✅ In magazzino |

Per aggiungere un prodotto al carrello, scrivi "aggiungi [nome prodotto] al carrello".
`
    } else if (msg.includes("offerte")) {
      return `
🔥 **Offerte Speciali**

| Offerta | Descrizione | Scadenza |
|---------|------------|----------|
| Limoncello | Sconto del 15% | 30/09/2025 |
| Vini | Promozione 3x2 | 15/09/2025 |
| Pasta + Sugo | Bundle a €7,99 | 20/09/2025 |

Per approfittare di queste offerte, aggiungi i prodotti al carrello!
`
    } else if (msg.includes("ordini")) {
      return `
📦 **I tuoi Ordini**

Ecco i link ai tuoi ordini recenti:

📦 Ordine #1234 (€45,00): https://shop.me/orders/1234?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
📦 Ordine #1235 (€78,50): https://shop.me/orders/1235?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
📦 Ordine #1228 (€32,00): https://shop.me/orders/1228?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

⚠️ Link validi per 24 ore. Usa "rinnova token ordini" per generare nuovi link.
`
    } else if (msg.includes("servizi")) {
      return `
🚚 **Servizi Disponibili**

| Servizio | Costo | Tempi |
|----------|------|-------|
| Consegna standard | €5,00 | 3-5 giorni |
| Consegna express | €10,00 | 24-48 ore |
| Ritiro in negozio | Gratuito | Stesso giorno |
| Confezione regalo | €3,50 | - |

Vuoi aggiungere un servizio al tuo ordine? Scrivi "aggiungi [nome servizio]".
`
    } else if (
      (msg.includes("aggiungi") || msg.includes("metti")) &&
      msg.includes("limoncello")
    ) {
      return `
✅ Limoncello aggiunto al carrello!

🛒 **Riepilogo Carrello**
- 1x Limoncello (€22,00)

**Totale**: €22,00

Vuoi continuare a fare acquisti o vedere il carrello?
`
    } else if (
      (msg.includes("aggiungi") || msg.includes("metti")) &&
      msg.includes("prosecco")
    ) {
      return `
✅ Prosecco aggiunto al carrello!

🛒 **Riepilogo Carrello**
- 1x Limoncello (€22,00)
- 1x Prosecco (€15,00)

**Totale**: €37,00

Vuoi continuare a fare acquisti o vedere il carrello?
`
    } else if (
      msg.includes("carrello") &&
      !msg.includes("aggiungi") &&
      !msg.includes("metti") &&
      !msg.includes("svuota")
    ) {
      return `
🛒 **Il tuo Carrello**

| Prodotto | Quantità | Prezzo unitario | Totale |
|----------|----------|----------------|--------|
| Limoncello | 1 | €22,00 | €22,00 |
| Prosecco | 1 | €15,00 | €15,00 |

**Totale**: €37,00

📌 Digita "checkout" per procedere all'acquisto o "svuota carrello" per rimuovere tutti i prodotti.
`
    } else if (msg.includes("svuota") && msg.includes("carrello")) {
      return `✅ Carrello svuotato con successo! Il tuo carrello è ora vuoto.`
    } else if (msg.includes("checkout")) {
      return `
🛍️ **Checkout**

Riepilogo ordine:
- 1x Limoncello (€22,00)
- 1x Prosecco (€15,00)

Subtotale: €37,00
Spedizione: €5,00
**Totale**: €42,00

Per completare l'ordine, seleziona un metodo di pagamento digitando "pagamento [metodo]"
Metodi disponibili: carta, bonifico, contrassegno
`
    } else if (
      msg.includes("ciao") ||
      msg.includes("buongiorno") ||
      msg.includes("salve")
    ) {
      return `
👋 Buongiorno Mario Rossi!

Sono l'assistente virtuale di eChatbot, il tuo negozio online di prodotti italiani di qualità.

Come posso aiutarti oggi?
- Mostrare i prodotti o le offerte
- Aiutarti con un ordine
- Aggiungere prodotti al carrello

Cosa desideri fare?
`
    } else {
      return `Mi dispiace, non ho capito completamente la tua richiesta. Ecco cosa puoi chiedermi:
- "mostrami i prodotti"
- "mostrami le offerte"
- "mostrami i servizi"
- "mostrami gli ordini"
- "aggiungi [prodotto] al carrello"
- "fammi vedere il carrello"
- "svuota carrello"
- "checkout"`
    }
  }

  // Invia il messaggio al backend
  async sendMessage(message) {
    try {
      const userConfig = this.getUserConfig()

      // Aggiungi il messaggio utente allo storico locale per il client
      this.sessionData.messages.push({
        role: "user",
        content: message,
      })

      // Payload nel formato frontend che si aspetta il backend
      // Questo formato usa il phone number per identificare il customer
      const payload = {
        message: message,
        phoneNumber: userConfig.customerPhone,
        workspaceId: this.workspaceId,
        // 🔧 PARAMETRI AVANZATI PER TEST URL SHORTENER
        debug: true,
        logLevel: "verbose",
        enableUrlShortener: true,
        trackClicks: true,
        customerName: userConfig.customerName,
        language: userConfig.language,
        testMode: true,
      }

      console.log(
        `🔧 DEBUG: Sending frontend format payload:`,
        JSON.stringify(payload, null, 2)
      )

      // console.log(`${this.colors.cyan}🔍 Sending WhatsApp format payload to server:${this.colors.reset}`, JSON.stringify(payload, null, 2));

      // Effettua la chiamata API reale
      const response = await axios.post(
        `${CONFIG.backendUrl}${CONFIG.apiEndpoint}`,
        payload,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      )

      console.log(
        `${this.colors.cyan}🔍 Response status:${this.colors.reset}`,
        response.status
      )
      // console.log(`${this.colors.cyan}🔍 Response data:${this.colors.reset}`, JSON.stringify(response.data, null, 2));

      if (response.status === 200) {
        // Mostra la risposta del LLM
        if (response.data && response.data.response) {
          console.log(
            `${this.colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`
          )
          console.log(
            `${this.colors.green}🎯 RISPOSTA FINALE DELL'LLM PER L'UTENTE:${this.colors.reset}`
          )
          console.log(
            `${this.colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`
          )
          console.log(
            `${this.colors.blue}🤖 BOT > ${this.colors.reset}${response.data.response}`
          )
          console.log(
            `${this.colors.green}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${this.colors.reset}`
          )

          // Mostra debug info dettagliata se disponibile (solo se log=true)
          if (
            this.showLogs &&
            response.data.debug &&
            response.data.debug.functionCalls &&
            response.data.debug.functionCalls.length > 0
          ) {
            console.log(
              `${this.colors.cyan}🔧 Function calls: ${response.data.debug.functionCalls.length}${this.colors.reset}`
            )

            // Mostra dettagli per ogni function call
            response.data.debug.functionCalls.forEach((call, index) => {
              // Cerca il nome della funzione in vari campi possibili
              const functionName =
                call.name ||
                call.function ||
                call.functionName ||
                call.toolCall?.function?.name ||
                "unknown"
              console.log(
                `${this.colors.yellow}   ${index + 1}. ${functionName}${
                  this.colors.reset
                }`
              )

              if (call.arguments || call.toolCall?.function?.arguments) {
                const args =
                  call.arguments ||
                  (call.toolCall?.function?.arguments
                    ? JSON.parse(call.toolCall.function.arguments)
                    : {})
                console.log(
                  `${this.colors.yellow}      Args: ${JSON.stringify(args)}${
                    this.colors.reset
                  }`
                )
              }

              // Mostra traduzione se disponibile
              if (response.data.debug && response.data.debug.translatedQuery) {
                console.log(
                  `${this.colors.magenta}      Translated: ${response.data.debug.translatedQuery}${this.colors.reset}`
                )
              }

              if (call.result) {
                // Mostra solo un summary del result, non tutto il JSON
                let resultSummary
                if (typeof call.result === "string") {
                  resultSummary =
                    call.result.length > 50
                      ? call.result.substring(0, 50) + "..."
                      : call.result
                } else if (
                  typeof call.result === "object" &&
                  call.result.success !== undefined
                ) {
                  resultSummary = call.result.success
                    ? "✅ Success"
                    : "❌ Failed"
                } else {
                  resultSummary = "Result received"
                }
                console.log(
                  `${this.colors.yellow}      Result: ${resultSummary}${this.colors.reset}`
                )
              }

              if (call.source) {
                console.log(
                  `${this.colors.yellow}      Source: ${call.source}${this.colors.reset}`
                )
              }

              // Mostra preview del contenuto per SearchRag
              if (call.sourceName) {
                console.log(
                  `${this.colors.green}      📄 ${call.sourceName}${this.colors.reset}`
                )
              }

              if (call.contentPreview) {
                console.log(
                  `${this.colors.green}      📝 ${call.contentPreview}${this.colors.reset}`
                )
              }

              if (call.similarity) {
                console.log(
                  `${this.colors.green}      🎯 Similarity: ${(
                    call.similarity * 100
                  ).toFixed(1)}%${this.colors.reset}`
                )
              }

              // Debug: mostra tutti i campi disponibili se il nome è ancora unknown
              if (functionName === "unknown") {
                console.log(
                  `${
                    this.colors.red
                  }      [DEBUG] Available fields: ${Object.keys(call).join(
                    ", "
                  )}${this.colors.reset}`
                )
              }
            })
          } else if (this.showLogs) {
            // Nessuna function call specifica
            console.log(
              `${this.colors.cyan}🔧 Function calls: GENERIC${this.colors.reset}`
            )
          }

          // Mostra altre info di debug
          if (response.data.debug) {
            if (response.data.debug.translatedQuery) {
              console.log(
                `${this.colors.magenta}🔍 Translated Query: ${response.data.debug.translatedQuery}${this.colors.reset}`
              )
            }
          }
        }

        if (response.data && response.data.success) {
          console.log(
            `${this.colors.yellow}✅ Richiesta processata ma nessun messaggio di risposta${this.colors.reset}`
          )
        } else {
          console.log(
            `${this.colors.yellow}⚠️ Risposta ricevuta ma formato inaspettato${this.colors.reset}`
          )
          console.log(JSON.stringify(response.data, null, 2))
        }
      } else {
        console.error(
          `${this.colors.red}Errore: Status ${response.status}${this.colors.reset}`
        )
      }
    } catch (error) {
      if (error.response) {
        console.error(
          `${this.colors.red}Errore API: ${
            error.response.status
          } - ${JSON.stringify(error.response.data)}${this.colors.reset}`
        )
      } else if (error.request) {
        console.error(
          `${this.colors.red}Errore di rete: Nessuna risposta ricevuta${this.colors.reset}`
        )
        console.error(
          `${this.colors.yellow}Assicurati che il server sia in esecuzione su ${CONFIG.backendUrl}${this.colors.reset}`
        )
      } else {
        console.error(
          `${this.colors.red}Errore: ${error.message}${this.colors.reset}`
        )
      }
    }
  }

  // Termina la sessione
  endSession() {
    console.log(`${this.colors.blue}Sessione terminata.${this.colors.reset}`)
    this.sessionActive = false
    this.stopServerLogMonitoring()
    this.rl.close()
  }

  // Metodo per terminare forzatamente (per test automatici)
  stop() {
    this.sessionActive = false
    this.stopServerLogMonitoring()
    if (this.rl) {
      this.rl.close()
    }
    process.exit(0)
  }
}

// Parser parametri linea di comando
function parseArgs() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    return { interactive: true }
  }

  // Mostra utenti disponibili se richiesto
  if (args[0] === "--users" || args[0] === "-u") {
    console.log("\n🌍 UTENTI DISPONIBILI:")
    Object.entries(USERS).forEach(([name, config]) => {
      console.log(
        `  ${config.flag} ${name} (${config.language}) - ${config.customerPhone}`
      )
    })
    console.log("\nEsempi:")
    console.log(
      '  node mcp-test-client.js "Mario Rossi" "aggiungi una mozzarella" exit-first-message=true'
    )
    console.log(
      '  node mcp-test-client.js "John Smith" "add to cart prosecco" seed=true log=true'
    )
    console.log(
      '  node mcp-test-client.js "Mario Rossi" "mostra carrello" exit-first-message=true seed=true log=true'
    )
    console.log("  node mcp-test-client.js (modalità interattiva)\n")
    console.log("Parametri disponibili:")
    console.log(
      "  workspaceId=ID      - ID del workspace (default: cm9hjgq9v00014qk8fsdy4ujv)"
    )
    console.log(
      "  seed=true           - Esegue il seed del database prima del test"
    )
    console.log(
      "  log=true            - Mostra i log del server in tempo reale"
    )
    console.log("  exit-first-message=true - Esce dopo il primo messaggio\n")
    process.exit(0)
  }

  const selectedUser = args[0]
  const testMessage = args[1] || null
  const exitAfterFirst = args.includes("exit-first-message=true")
  const runSeed = args.includes("seed=true")
  const showLogs = args.includes("log=true")

  // Estrai workspaceId se presente
  let workspaceId = null
  const workspaceIdArg = args.find((arg) => arg.startsWith("workspaceId="))
  if (workspaceIdArg) {
    workspaceId = workspaceIdArg.split("=")[1]
  }

  return { selectedUser, testMessage, exitAfterFirst, runSeed, showLogs, workspaceId }
}

// Avvia il client
const {
  interactive,
  selectedUser,
  testMessage,
  exitAfterFirst,
  runSeed,
  showLogs,
  workspaceId,
} = parseArgs()

if (interactive) {
  console.log("\n🌍 Modalità interattiva - Utenti disponibili:")
  Object.entries(USERS).forEach(([name, config]) => {
    console.log(`  ${config.flag} ${name}`)
  })
  console.log("\nPer test automatici: node mcp-test-client.js --users\n")
}

async function main() {
  const client = new MCPTestClient(
    selectedUser,
    testMessage,
    exitAfterFirst,
    runSeed,
    showLogs,
    workspaceId
  )
  client.start().catch((error) => {
    console.error("❌ Errore avvio client:", error.message)
    process.exit(1)
  })
}

main().catch((error) => {
  console.error("❌ Errore main:", error.message)
  process.exit(1)
})
