#!/usr/bin/env node

/**
 * Auto-start Ollama server se non è già in esecuzione
 * Viene chiamato automaticamente da npm run dev
 */

const { exec, spawn } = require("child_process")
const http = require("http")

const OLLAMA_PORT = 11434
const OLLAMA_URL = `http://localhost:${OLLAMA_PORT}`

/**
 * Verifica se Ollama è già in esecuzione
 */
function isOllamaRunning() {
  return new Promise((resolve) => {
    const req = http.get(`${OLLAMA_URL}/api/tags`, (res) => {
      resolve(res.statusCode === 200)
    })

    req.on("error", () => {
      resolve(false)
    })

    req.setTimeout(1000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

/**
 * Avvia Ollama in background
 */
function startOllama() {
  return new Promise((resolve, reject) => {
    console.log("🤖 Starting Ollama server...")

    // Verifica se ollama è installato
    exec("which ollama", (error, stdout) => {
      if (error) {
        console.log(
          "⚠️  Ollama not installed. Install from: https://ollama.com/download"
        )
        console.log(
          "💡 Local LLM will be disabled, using cloud provider instead."
        )
        resolve(false)
        return
      }

      // Avvia Ollama in background
      const ollamaProcess = spawn("ollama", ["serve"], {
        detached: true,
        stdio: "ignore",
      })

      ollamaProcess.unref() // Permette al processo padre di terminare

      // Aspetta che Ollama sia pronto
      let attempts = 0
      const maxAttempts = 10

      const checkInterval = setInterval(async () => {
        attempts++
        const running = await isOllamaRunning()

        if (running) {
          clearInterval(checkInterval)
          console.log("✅ Ollama server started successfully")
          resolve(true)
        } else if (attempts >= maxAttempts) {
          clearInterval(checkInterval)
          console.log("⚠️  Ollama server failed to start")
          console.log(
            "💡 Local LLM will be disabled, using cloud provider instead."
          )
          resolve(false)
        }
      }, 1000)
    })
  })
}

/**
 * Main function
 */
async function main() {
  console.log("🔍 Checking Ollama status...")

  const running = await isOllamaRunning()

  if (running) {
    console.log("✅ Ollama is already running")
  } else {
    await startOllama()
  }

  // Mostra modelli disponibili
  if (await isOllamaRunning()) {
    exec("curl -s http://localhost:11434/api/tags", (error, stdout) => {
      if (!error) {
        try {
          const data = JSON.parse(stdout)
          const models = data.models || []

          if (models.length === 0) {
            console.log("⚠️  No models installed. Download one with:")
            console.log("   ollama pull llama3.1:8b")
          } else {
            console.log(`📦 Available models (${models.length}):`)
            models.forEach((m) => {
              const size = (m.size / 1e9).toFixed(2)
              const isRemote = m.remote_host ? " (remote)" : " (local)"
              console.log(`   - ${m.name}${isRemote} (${size}GB)`)
            })
          }
        } catch (e) {
          // Ignora errori di parsing
        }
      }
    })
  }
}

// Esegui solo se chiamato direttamente
if (require.main === module) {
  main().catch(console.error)
}

module.exports = { isOllamaRunning, startOllama }
