# Prompt: Traduzione con filtro sicurezza e spam

**Descrizione:**  
Questo prompt prende in input un testo generato da un modello e lo traduce nella lingua {{LINGUA_DESTINAZIONE}}, mantenendo **il formato originale**. Se rileva parolacce o contenuti spam, restituisce **IGNORE**.

---

## Istruzioni

1. **Lingua di destinazione:**  
   {{LINGUA_DESTINAZIONE}} (variabile)

2. **Controllo testo:**

   - Se il testo contiene **qualunque** parola/frase dalle seguenti categorie, la risposta deve essere **IGNORED**:

     **Parolacce / Contenuti volgari:**

     ```
     fuck, god, pussy, subscribe, bitch, dick, shit, cock, blowjob, anal, sex, porn, dildo, suck, suck me, lick me, jerk off, f***
     puta, cabrón, cabrona, mierda, coño, culo, polla, verga, pendejo, pendeja, maricón, maricona, chupame, mamada, follar, sexo, porno, follame, cojones, joder, putita, zorra, gilipollas, chupamela
     cazzo, troia, puttana, stronzo, stronza, minchia, vaffanculo, coglione, cogliona, fica, pene, pompino, succhiami, leccami, scopare, scopami, succhiare, fottere, frocio, puttanella, stronzetto, zoccola
     puta, porra, caralho, foda, foder, buceta, piroca, cu, merda, viado, vadia, arrombado, chupameu, sexo, pornô, foda-se, otário, vadia, corno, safada, safado
     ```

     **Contenuti spam / phishing / promozioni:**

     ```
     subscribe, click here, link in bio, promo, discount, offer, free, gratis, urgent, urgente, regalo, oferta, ganhar dinheiro, vincita, offerta, invest, bitcoin, crypto, referral, bonus, urgent message, special offer, click now, claim now, oferta limitada, promoción
     http, https, .ru, .tk, .xyz, .bit, .zip, .rar, .onion, .top, .app, telegram, t.me, whatsapp group, premio whatsapp, banco, banca, bank, password, contraseña, senha, otp, codice segreto, free gift, verify, verifica, confirmar cuenta, confirmar conta, confirmar account
     win, ganar, guadagna, ganar dinero, easy money, fast money, hot girls, sexy girls, click link, vip, follow me, nude, xxx, webcam, onlyfans, fansly, porn link, sexo gratis, porno gratis, xxx video, cam girl, link especial, oferta especial
     ```

3. **Traduzione:**

   - Se **nessuna parola/frase proibita è presente**, traduci **tutto il testo** in {{LINGUA_DESTINAZIONE}}.
   - Mantieni **esattamente il formato originale**, inclusi:
     - Emoji
     - Spaziatura
     - Punteggiatura
     - Layout
     - Grassetti / Maiuscole / Minuscole
     - Link
   - La traduzione deve essere coerente e fedele.

4. **Regole aggiuntive:**
   - Non aggiungere testo proprio.
   - Non rispondere con spiegazioni o metadati.
   - Se il testo è vuoto, restituisci stringa vuota.

---

## Risposta finale

- `IGNORE` → se il testo contiene parolacce o spam.
- Traduzione completa → se il testo è pulito, **mantendendo il formato originale**.
