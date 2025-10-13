### ✅ Scheduler Service (October 2025)

Il servizio Scheduler gestisce automaticamente varie attività di manutenzione per mantenere il sistema pulito ed efficiente:

**Gestione Messaggi Chat:**

- Mantiene solo gli ultimi 50 messaggi per ogni sessione di chat
- Esegue la pulizia automatica ogni 12 ore
- Protegge la performance del sistema evitando l'accumulo di messaggi storici

**Gestione Offerte:**

- Controlla e disattiva automaticamente le offerte scadute
- Esegue il controllo ogni 5 minuti
- Assicura che i clienti vedano solo offerte valide e attive

**Gestione URL:**

- Rimuove URL scaduti o più vecchi di 1 ora
- Esegue la pulizia ogni ora
- Mantiene il database degli URL pulito e pertinente

**Come Utilizzare:**

```bash
# Avviare solo lo scheduler (utile per debug o test)
npm run scheduler

# Il servizio è anche integrato automaticamente quando si avvia il backend
npm run dev
```
