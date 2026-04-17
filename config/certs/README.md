# Certificates for WhatsApp Webhook mTLS

## A cosa serve `DigiCert_High_Assurance_EV_Root_CA.pem`

Questo file e una CA root trusted usata da Nginx per validare il certificato client del webhook WhatsApp (Meta) in mTLS.

Nel progetto e referenziato qui:

- `config/nginx.conf.erb` -> `ssl_client_certificate /app/config/certs/DigiCert_High_Assurance_EV_Root_CA.pem;`

Senza una CA corretta:

- Nginx puo rifiutare la richiesta webhook (`ssl_client_verify != SUCCESS`)
- il backend riceve meno o zero eventi da Meta
- si possono avere `403` sul path `/api/whatsapp/webhook`

Data stato attuale: 2026-04-17.

## Come funziona la sicurezza (in breve)

La protezione e a 2 livelli:

1. **Nginx/TLS layer**: valida la chain del certificato client con la CA configurata in `ssl_client_certificate`.
2. **Backend layer**: controlla il CN atteso (`client.webhooks.fbclientcerts.com`) nel middleware mTLS.

## Quando dobbiamo aggiornarlo

Aggiornare quando succede almeno uno di questi casi:

- Meta annuncia rotazione CA/certificati webhook.
- In produzione aumentano errori mTLS (`403`, CN mismatch, verify failed).
- Audit periodico sicurezza (consigliato almeno trimestrale).

## Procedura di aggiornamento

1. Recupera la nuova CA ufficiale dalle comunicazioni/documentazione Meta Webhooks mTLS.
2. Salva il file PEM in questa cartella con nome esplicito (es. `Meta_Webhooks_Root_CA_YYYYMMDD.pem`).
3. Verifica il PEM localmente:

```bash
openssl x509 -in config/certs/<NUOVO_FILE>.pem -noout -subject -issuer -dates -fingerprint -sha256
```

4. Se serve trust multipla durante transizione, crea un **bundle** concatenando vecchia + nuova CA:

```bash
cat config/certs/DigiCert_High_Assurance_EV_Root_CA.pem \
    config/certs/<NUOVO_FILE>.pem \
    > config/certs/meta_webhook_client_ca_bundle.pem
```

5. Aggiorna `config/nginx.conf.erb`:

- da:
  - `ssl_client_certificate /app/config/certs/DigiCert_High_Assurance_EV_Root_CA.pem;`
- a:
  - `ssl_client_certificate /app/config/certs/meta_webhook_client_ca_bundle.pem;`

6. Deploy e verifica i log Nginx/backend sul webhook Meta.
7. Quando Meta conferma fine transizione, rimuovi la vecchia CA dal bundle.

## Checklist veloce post-update

- Nginx parte senza errori TLS.
- Nessun aumento di `403` sul webhook.
- Eventi WhatsApp inbound ricevuti regolarmente.
- Middleware backend mTLS continua a validare CN atteso.

## Rollback

Se il nuovo certificato crea regressioni:

1. Ripristina il path precedente in `ssl_client_certificate`.
2. Redeploy.
3. Apri incident ticket e riesegui validazione PEM prima del nuovo tentativo.
