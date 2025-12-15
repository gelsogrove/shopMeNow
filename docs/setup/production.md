# eChatbot - Production Setup Guide

Guida completa per il deploy e la configurazione in produzione.

---

## 🛡️ PROTEZIONE PRODUZIONE

**IMPORTANTE**: Gli script distruttivi sono BLOCCATI in produzione per prevenire data loss accidentale.

### Script Bloccati in Production

| Script | Descrizione | Rischio |
|--------|-------------|---------|
| `prisma:seed` | Ricrea tutti i dati di test | 🔴 Cancella TUTTI i dati |
| `prisma:reset` | Reset completo database | 🔴 Cancella TUTTO |
| `fix-oauth-user` | Elimina utenti OAuth | 🟡 Cancella utenti |

### Come Viene Rilevata la Produzione

1. `NODE_ENV=production` o `NODE_ENV=prod`
2. `DATABASE_URL` contiene: `production`, `railway`, `supabase`, `neon.tech`, `planetscale`

### Bypass di Emergenza (USARE CON ESTREMA CAUTELA!)

Se **DEVI ASSOLUTAMENTE** eseguire uno script distruttivo in produzione:

```bash
# ⚠️ ATTENZIONE: Questo cancellerà i dati di produzione!
ALLOW_DESTRUCTIVE_OPERATIONS=true npm run prisma:seed
```

**PRIMA di usare il bypass:**
1. ✅ Fai un backup completo del database
2. ✅ Notifica il team
3. ✅ Verifica di avere accesso al backup
4. ✅ Considera le conseguenze

---

## 📋 Prerequisiti

- Node.js 18+
- PostgreSQL 14+
- PM2 installato globalmente: `npm install -g pm2`
- Server Linux (Ubuntu/Debian consigliato)

---

## 🚀 Deploy Iniziale

### 1. Clone e Setup

```bash
# Clone del repository
git clone git@github.com:echatbotnow/eChatbot.git
cd eChatbot

# Installa dipendenze
npm install

# Copia e configura environment
cp .env.example .env
nano .env  # Configura DATABASE_URL, OPENROUTER_API_KEY, etc.

# Setup database (migrazioni sono SICURE in prod)
npm run prisma:migrate:prod

# NOTA: prisma:seed è BLOCCATO in production per sicurezza
# Se serve data iniziale, usa ALLOW_DESTRUCTIVE_OPERATIONS=true
```

### 2. Build

```bash
# Build di tutti i workspace
npm run build
```

---

## ⚙️ Configurazione PM2

### Avvio Servizi

```bash
# Avvia Backend (porta 3001)
npm run prod:backend

# Avvia Scheduler (cronjobs)
npm run prod:scheduler

# Oppure avvia tutto insieme
npm run prod:all
```

### Auto-Restart al Reboot del Server

**IMPORTANTE:** Esegui questi comandi una sola volta dopo il primo deploy:

```bash
# Salva la configurazione corrente di PM2
pm2 save

# Genera script systemd per auto-start
pm2 startup

# Copia ed esegui il comando che PM2 ti mostra, esempio:
# sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Ora se il server si riavvia, PM2 rilancerà automaticamente tutti i servizi.

---

## 📝 Gestione Log con PM2-Logrotate

**CRITICO:** Senza questa configurazione i log cresceranno all'infinito!

### Installazione (una volta)

```bash
# Installa il modulo di rotazione log
pm2 install pm2-logrotate
```

### Configurazione Consigliata

```bash
# Ruota quando il file supera 10MB
pm2 set pm2-logrotate:max_size 10M

# Mantieni solo gli ultimi 7 file di log
pm2 set pm2-logrotate:retain 7

# Comprimi i vecchi log (risparmia spazio)
pm2 set pm2-logrotate:compress true

# Rotazione giornaliera a mezzanotte
pm2 set pm2-logrotate:rotateInterval '0 0 * * *'
```

### Verifica Configurazione

```bash
pm2 conf pm2-logrotate
```

---

## 🔧 Comandi Utili PM2

```bash
# Stato di tutti i processi
pm2 status

# Logs in tempo reale
pm2 logs

# Logs solo backend
pm2 logs echatbot-backend

# Logs solo scheduler
pm2 logs echatbot-scheduler

# Restart singolo servizio
pm2 restart echatbot-backend
pm2 restart echatbot-scheduler

# Restart tutti
pm2 restart all

# Stop tutto
pm2 stop all

# Rimuovi tutti i processi
pm2 delete all

# Monitoraggio risorse (CPU, RAM)
pm2 monit
```

---

## 📊 Cronjobs dello Scheduler

Lo scheduler esegue automaticamente questi job:

| Job | Schedule | Descrizione |
|-----|----------|-------------|
| WhatsApp Queue | Ogni 3 minuti | Processa messaggi WhatsApp in coda |
| Short URLs Cleanup | 23:00 ogni giorno | Rimuove URL brevi scaduti |
| Blocked Customers | Ogni 3 giorni | Pulisce chat dei clienti bloccati |
| Images Cleanup | 23:02 ogni giorno | Rimuove immagini non utilizzate |
| Monthly Billing | 1° del mese alle 12:00 | Addebita fee mensili ai workspace |

---

## 🔄 Aggiornamenti (Deploy Successivi)

```bash
# Pull nuove modifiche
git pull origin main

# Installa eventuali nuove dipendenze
npm install

# Esegui migrazioni database (se presenti)
npm run prisma:migrate:prod

# Rebuild
npm run build

# Restart servizi
pm2 restart all
```

---

## 🐛 Troubleshooting

### I servizi non partono

```bash
# Controlla i log per errori
pm2 logs --lines 100

# Verifica che il database sia raggiungibile
npm run prisma:studio
```

### I log occupano troppo spazio

```bash
# Verifica dimensione log
du -sh ~/.pm2/logs/

# Flush manuale log
pm2 flush

# Assicurati che pm2-logrotate sia installato
pm2 ls | grep pm2-logrotate
```

### Lo scheduler non esegue i job

```bash
# Verifica che sia in running
pm2 status echatbot-scheduler

# Controlla i log dello scheduler
pm2 logs echatbot-scheduler --lines 50
```

### Errori di memoria

```bash
# Monitora utilizzo RAM
pm2 monit

# Imposta limite memoria in ecosystem.config.js
# max_memory_restart: '500M'
```

---

## 📁 Struttura File PM2

I file di configurazione PM2 sono in:

- `apps/backend/ecosystem.config.js` - Config backend
- `apps/scheduler/ecosystem.config.js` - Config scheduler

I log PM2 sono salvati in: `~/.pm2/logs/`

---

## ✅ Checklist Post-Deploy

- [ ] `.env` configurato con tutte le variabili
- [ ] Database migrato (`npm run prisma:migrate:prod`)
- [ ] Build completata (`npm run build`)
- [ ] Backend avviato (`pm2 status` mostra "online")
- [ ] Scheduler avviato (`pm2 status` mostra "online")
- [ ] `pm2 save` eseguito
- [ ] `pm2 startup` configurato
- [ ] `pm2-logrotate` installato e configurato
- [ ] Test endpoint: `curl http://localhost:3001/api/health`

---

## 📞 Supporto

Per problemi o domande, contatta il team di sviluppo.
