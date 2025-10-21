# 🤖 Guida: LLM Locale con Ollama

## 📋 Vantaggi LLM Locale

✅ **Zero costi** - Nessun costo per token  
✅ **Privacy totale** - Dati restano sul tuo Mac  
✅ **Offline** - Funziona senza internet  
✅ **Stesso codice** - API compatibili OpenAI  
✅ **Veloce su M1 Pro** - Ottimizzato per Apple Silicon

## 🚀 Setup Ollama (5 minuti)

### 1️⃣ Installa Ollama

**Opzione A: Download manuale**

```bash
# Scarica da: https://ollama.com/download
# Installa il .dmg e trascina in Applications
```

**Opzione B: Homebrew**

```bash
brew install ollama
```

### 2️⃣ Scarica un modello

Con il tuo **Mac M1 Pro (32GB RAM)** puoi usare modelli potenti!

```bash
# Consigliato per iniziare (8B parametri, ~5GB RAM)
ollama pull llama3.1:8b

# Alternative:
ollama pull llama3.2:3b      # Velocissimo, ~2GB RAM
ollama pull mistral:7b        # Bilanciato, ~4GB RAM
ollama pull qwen2.5:14b       # Potente, ~8GB RAM
ollama pull llama3.1:70b-q4   # Top quality, ~40GB RAM
```

**💡 Consiglio**: Inizia con `llama3.1:8b` - ottimo rapporto qualità/velocità!

### 3️⃣ Avvia il server

```bash
ollama serve
```

Questo avvia il server su `http://localhost:11434` con **API compatibili OpenAI**! 🎉

### 4️⃣ Testa che funzioni

```bash
# Test veloce
curl http://localhost:11434/api/tags

# Test chat
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama3.1:8b",
    "messages": [{"role": "user", "content": "Ciao!"}]
  }'
```

## ⚙️ Configurazione ShopMe

### 1️⃣ Aggiorna il file `.env`

```bash
# Apri il file .env
cd backend
nano .env  # oppure code .env

# Aggiungi/modifica queste righe:
USE_LOCAL_LLM="true"
OLLAMA_BASE_URL="http://localhost:11434/v1"
OLLAMA_MODEL="llama3.1:8b"
```

### 2️⃣ Riavvia il backend

```bash
# Ctrl+C per fermare il server
npm run dev
```

## ✅ Verifica che funzioni

1. Apri il frontend: `http://localhost:3000`
2. Fai login
3. Prova a chattare con un cliente via WhatsApp
4. Controlla i log del backend - dovresti vedere:
   ```
   ✅ Using LOCAL LLM: llama3.1:8b
   ```

## 🔄 Switch tra Cloud e Locale

**Per usare OpenRouter (cloud)**:

```bash
USE_LOCAL_LLM="false"
```

**Per usare Ollama (locale)**:

```bash
USE_LOCAL_LLM="true"
```

## 📊 Confronto Performance

| Modello             | RAM   | Velocità | Qualità    | Consiglio           |
| ------------------- | ----- | -------- | ---------- | ------------------- |
| **llama3.2:3b**     | ~2GB  | ⚡⚡⚡   | ⭐⭐⭐     | Chatbot semplici    |
| **mistral:7b**      | ~4GB  | ⚡⚡     | ⭐⭐⭐⭐   | Bilanciato          |
| **llama3.1:8b**     | ~5GB  | ⚡⚡     | ⭐⭐⭐⭐   | **👈 CONSIGLIATO**  |
| **qwen2.5:14b**     | ~8GB  | ⚡       | ⭐⭐⭐⭐⭐ | E-commerce avanzato |
| **llama3.1:70b-q4** | ~40GB | ⚡       | ⭐⭐⭐⭐⭐ | Qualità top         |

## 🛠️ Comandi Utili

```bash
# Lista modelli scaricati
ollama list

# Rimuovi un modello
ollama rm llama3.1:8b

# Test interattivo
ollama run llama3.1:8b

# Info su un modello
ollama show llama3.1:8b

# Stop del server
pkill ollama
```

## 🎯 Pro Tips

1. **Velocità**: Usa modelli 7B-8B per risposte rapide
2. **Qualità**: Usa modelli 14B+ per ragionamenti complessi
3. **RAM**: Chiudi app inutili per liberare memoria
4. **Primo avvio**: Il primo caricamento è lento, poi è veloce
5. **Cache**: Ollama cacha il modello in RAM dopo il primo uso

## 🐛 Troubleshooting

**Server non parte?**

```bash
# Verifica che Ollama sia installato
which ollama

# Riavvia manualmente
killall ollama
ollama serve
```

**Errore "model not found"?**

```bash
# Verifica modelli installati
ollama list

# Scarica il modello
ollama pull llama3.1:8b
```

**Troppo lento?**

- Prova un modello più piccolo: `ollama pull llama3.2:3b`
- Chiudi altre app per liberare RAM
- Verifica che Ollama usi la GPU: `ollama run llama3.1:8b --verbose`

## 📚 Risorse

- 🌐 Sito ufficiale: https://ollama.com
- 📖 Documentazione: https://github.com/ollama/ollama
- 🤖 Modelli disponibili: https://ollama.com/library
- 💬 Community: https://discord.gg/ollama

---

## 🎉 Risultato Finale

**Stessa API, Zero Modifiche al Codice!**

Il tuo chatbot funzionerà **esattamente come prima**, ma:

- ✅ Gratis (no costi per token)
- ✅ Privato (dati locali)
- ✅ Veloce (M1 Pro è potente!)
- ✅ Offline (no internet necessario)

**Il codice rimane identico** - Ollama espone le stesse API di OpenAI! 🚀
