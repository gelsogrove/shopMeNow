## Confermato funzionante (nuova trascrizione, dopo il fix mismatch codice errore)

Cliente scrive "errore 002" (non esiste nessun flow per 002, solo per 001):
il bot NON aggancia più il flow sbagliato. Dice onestamente che l'errore non è
coperto e passa al Human operator flow (serial → acceso → wifi → cut
scheduling → batteria → nome), esattamente come da CONTRACT.md.

## Aperto — guard FAQ non strutturale

`answer_from_faq` garantisce con certezza che l'INDICE citato esista davvero
(guard di codice, non aggirabile). Non garantisce che il modello non aggiunga
testo attorno alla traduzione — oggi è solo un'istruzione rafforzata
("nothing before it, nothing after it, no recommendation of your own..."),
non un controllo che scarta la risposta se non rispettata.

Bug osservato prima del rafforzamento: dopo aver risposto con la FAQ sui
modelli STORM, al numero "2500" il bot ha aggiunto "ti consiglio STORM 5000"
e "vuoi che ti metta in contatto con un collega" — nessuna delle due frasi
esiste nella FAQ o in qualunque fonte.

Da rivedere quando riprendiamo: se il rafforzamento testuale non basta,
l'opzione discussa è un controllo POST-risposta (confronto tra la reply
finale e il testo dettato, scarto e fallback se non combaciano) — non ancora
implementato, prossimo passo se il problema si ripresenta.

## Stato generale

- Tutti i guard elencati in CONTRACT.md → sezione GUARDS sono implementati e
  verificati (typecheck + `npm run test:unit`, verde).
- Non ancora deployato su Heroku — tutto il lavoro di questa sessione è
  locale, non committato.
- Nessun test dal vivo dopo l'ultimo giro di fix (mismatch codice errore +
  rafforzamento answer_from_faq) oltre alla trascrizione sopra.
