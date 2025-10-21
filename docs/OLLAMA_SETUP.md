# 🤖 Local LLM Setup with Ollama

## ✅ Auto-Start (Automatico)

Ollama si avvia automaticamente quando lanci il backend:

```bash
npm run dev
```

Il backend:

1. ✅ Controlla se Ollama è già in esecuzione
2. ✅ Lo avvia automaticamente se necessario
3. ✅ Mostra i modelli disponibili
4. ✅ Continua anche se Ollama non è disponibile (usa cloud)

## 📋 Comandi Disponibili

### Avvia backend (con Ollama auto-start)

```bash
npm run dev
```

### Avvia backend SENZA Ollama

```bash
npm run dev:no-ollama
```

### Controlla status Ollama

```bash
npm run ollama:check
```

### Avvia solo Ollama (senza backend)

```bash
npm run ollama:start
```

## 🔧 Configurazione

### Opzione 1: Dalla UI (Raccomandato)

1. Vai su **Agent Configuration**
2. Nel dropdown **Model** scegli:
   - `🏠 LOCAL: llama3.1:8b` (locale, gratis)
   - `🏠 LOCAL: Qwen3 Coder 480B` (locale, gratis)
   - `🌍 anthropic/claude-3.5-haiku` (cloud, a pagamento)
3. Salva

### Opzione 2: Da .env

```bash
# In backend/.env
USE_LOCAL_LLM=true
OLLAMA_MODEL=llama3.1:8b
```

## 📥 Installare Modelli

### Modelli Raccomandati (Mac M1 Pro 32GB)

```bash
# Veloce e leggero (~2GB)
ollama pull llama3.2:3b

# Bilanciato (~4GB)
ollama pull mistral:7b

# Intelligente - RACCOMANDATO (~5GB)
ollama pull llama3.1:8b

# Molto potente (~8GB)
ollama pull qwen2.5:14b

# Qualità massima (~40GB)
ollama pull llama3.1:70b-q4
```

### Verifica modelli installati

```bash
ollama list
```

## 🚀 Come Funziona

### Priorità di Selezione:

1. **Model dalla UI** con prefisso `LOCAL:` → Ollama locale
2. **USE_LOCAL_LLM=true** in `.env` → Ollama locale
3. **Altrimenti** → OpenRouter (cloud)

### Vantaggi Local:

✅ **ZERO costi** (nessuna API key necessaria)  
✅ **Privacy totale** (dati non escono dal tuo Mac)  
✅ **Velocità** (nessuna latenza di rete)  
✅ **Offline** (funziona senza internet)

### Vantaggi Cloud:

✅ **Modelli più potenti** (GPT-4, Claude Opus)  
✅ **Nessuna RAM richiesta** sul tuo Mac  
✅ **Sempre aggiornato** con nuovi modelli

## 🐛 Troubleshooting

### Ollama non si avvia automaticamente?

```bash
# Avvialo manualmente
ollama serve
```

### Modello non trovato?

```bash
# Scaricalo
ollama pull llama3.1:8b

# Verifica
ollama list
```

### Backend non usa Ollama?

Verifica nei log del backend:

```
🤖 Using LOCAL LLM: llama3.1:8b at http://localhost:11434/v1
```

Se vedi `CLOUD` invece di `LOCAL`:

1. Controlla che nel dropdown sia selezionato `LOCAL: ...`
2. Oppure verifica che `USE_LOCAL_LLM=true` in `.env`
3. Riavvia il backend

## 📊 Performance

| Modello         | RAM  | Velocità | Qualità    | Uso Consigliato   |
| --------------- | ---- | -------- | ---------- | ----------------- |
| llama3.2:3b     | 2GB  | ⚡⚡⚡   | ⭐⭐       | Chat semplici     |
| mistral:7b      | 4GB  | ⚡⚡     | ⭐⭐⭐     | Generale          |
| llama3.1:8b     | 5GB  | ⚡⚡     | ⭐⭐⭐⭐   | **Raccomandato**  |
| qwen2.5:14b     | 8GB  | ⚡       | ⭐⭐⭐⭐   | Compiti complessi |
| llama3.1:70b-q4 | 40GB | ⚡       | ⭐⭐⭐⭐⭐ | Massima qualità   |

## 🔗 Link Utili

- [Ollama Download](https://ollama.com/download)
- [Ollama Models Library](https://ollama.com/library)
- [GitHub Copilot Instructions](../.github/copilot-instructions.md)
