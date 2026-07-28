# Riattivazione progetto shopME (dopo pausa)

Promemoria creato l'11 luglio 2026. Il dyno Heroku è stato messo a **0** per bloccare i costi durante la pausa. Ecco cosa fare per rimettere tutto in piedi.

## 1. Riattivare il server su Heroku

Il dyno web è stato scalato a 0 (`heroku ps:scale web=0 -a echatbot-app`). Per riaccenderlo:

```bash
heroku ps:scale web=1 -a echatbot-app
```

Verifica che sia su:

```bash
heroku ps -a echatbot-app
```

Deve mostrare `web.1: up`. L'app sarà di nuovo raggiungibile su:
https://echatbot-app-1cba28556df2.herokuapp.com/

Codice, config vars e deploy erano rimasti intatti durante la pausa: non serve un nuovo deploy, solo riaccendere il dyno.

## 2. Verificare il database esterno

Il DB non è un addon Heroku (è esterno). Prima di riattivare il dyno, controlla che:
- il servizio/piano del DB esterno sia ancora attivo e raggiungibile
- la `DATABASE_URL` nelle config vars Heroku sia ancora valida (se il provider esterno ruota le credenziali o il DB è stato sospeso/eliminato per inattività, va aggiornata)

```bash
heroku config -a echatbot-app
```

## 3. Rigenerare la API Key ElevenLabs (TTS)

L'account ElevenLabs collegato a `gelsogrove@gmail.com` è stato cancellato, quindi la `ELEVENLABS_API_KEY` attuale su Heroku **non è più valida** e va sostituita prima o dopo la riattivazione (il TTS fallisce silenziosamente se la key non è valida — l'app continua a funzionare ma senza risposte audio, vedi `apps/backend/src/services/tts-elevenlabs.service.ts`).

Passi:
1. Crea/accedi a un account ElevenLabs (nuova email o account esistente) su https://elevenlabs.io
2. Assicurati di avere un piano con accesso API (Creator o superiore)
3. Vai su **Profile → API Keys** e genera una nuova key
4. (Opzionale) Se vuoi mantenere la stessa voce usata finora, recupera anche il `voice_id` corrispondente dalla sezione Voices, oppure lascia il default già gestito dal codice (`DEFAULT_VOICE_ID` in `tts-elevenlabs.service.ts`)
5. Aggiorna la config var su Heroku (sostituisci `<NUOVA_KEY>`):

```bash
heroku config:set ELEVENLABS_API_KEY=<NUOVA_KEY> -a echatbot-app
```

6. Se cambi anche la voce:

```bash
heroku config:set ELEVENLABS_VOICE_ID=<NUOVO_VOICE_ID> -a echatbot-app
```

Impostare una config var su Heroku riavvia automaticamente il dyno, quindi puoi farlo subito dopo lo step 1.

## Checklist riassuntiva

- [ ] `heroku ps:scale web=1 -a echatbot-app`
- [ ] Verificare che il DB esterno sia raggiungibile e la `DATABASE_URL` valida
- [ ] Generare nuova ElevenLabs API key (nuovo account, piano con API abilitata)
- [ ] `heroku config:set ELEVENLABS_API_KEY=...`
- [ ] Verificare l'app online e testare una risposta con audio
