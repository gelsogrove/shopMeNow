1. IL CONTRATTO DEVE ESSERE SEMPRE RISPETTATO
2. Non devi mai inventare.
3. Metti guard molto rigidi per evitare che il modello inventi.
4. Usa i design pattern, non gli if e gli accrocchi hardcoded messi lì solo per risolvere un problema specifico.
5. Regola di routing: se è un problema cerca nei FLOW, altrimenti cerca nelle FAQ.
6. Se l'utente cerca una FAQ rispondiamo con la risposta della FAQ, senza inventare.
7. Se l'utente ha un problema e rileviamo che ha un problema: prima chiediamo e validiamo il serial number, poi cerchiamo nei flow il flow giusto; se il problema non è ben spiegato chiediamo più dettagli.
8. Se non trova una FAQ passiamo il controllo all'operatore senza chiedere il service number e senza passare dallo human flow: chiediamo il nome e passiamo la palla all'operatore.
9. Se non trova nessun flow facciamo partire lo human flow.
10. Se un utente vuole parlare con un operatore lo fa, punto e basta: senza chiedere il service number, senza passare dal flusso di handle support message; chiediamo solo il nome.
11. Prima di passare al supporto chiediamo sempre il nome, perché poi ci serve per rispondere con il nome: "Ciao [nomeutente], disabilitiamo la chat e ti mettiamo in comunicazione con ...".
12. Il flow devi seguirlo sempre.
13. Lo human operator flow è un flow vero nel flow builder (non un oggetto di domande nel codice), protetto e non cancellabile: ogni percorso tecnico verso l'operatore ci passa.
14. Il service number deve essere sempre validato: deve essere di 19 caratteri; dopo 3 tentativi falliti si contatta l'operatore.
15. Se l'utente è registrato gli diamo il welcome.
16. Se l'utente è già presente gli diciamo "welcome back [nomeutente]".
17. Quando arrivano info come nome o società, abbiamo delle calling function.
18. Rispondi sempre con l'handing-off message presente nel settings.json.
19. Ricordati che il settings.json arriva dal salvataggio delle informazioni: non serve modificarlo qui in locale e mandare su i cambi.
20. Ricordati di gestire bene le lingue: prima rileviamo la lingua e poi rispondiamo.
21. Ricordati che la lingua di default ce l'hai nel settings, insieme alle lingue disponibili; se la lingua non è disponibile si passa all'inglese.
22. Ricordati che FAQ e FLOW possono essere active o disactive.
23. Dobbiamo gestire uno state per evitare che i "sì", "bene", "grazie", "ok" possano far partire qualcosa di indesiderato.
24. Ovviamente i messaggi vengono salvati nella history.
25. Se l'utente è bloccato (isBlacklisted) non deve succedere NULLA: nessuna risposta, nessun messaggio salvato in chat history, nessuna chiamata LLM — silenzio totale, il messaggio viene scartato prima di qualsiasi elaborazione.
26. Se il channel non è attivo non manda nulla.
27. Se il channel non ha soldi mandiamo il messaggio di WIP.
28. Le parti hardcoded devono essere portate al minimo: parliamo con l'utente per ogni scelta di hard-code. Non dico di non usarle, dico di condividerle.
29. Non toccare mai questo file!
30. Nel mezzzo di un flow posso far domande fuori contesto magari una faq e il chabot deve rispondere in modo naturale
31. il chabot deveavere uno storico
32. dopo 2 ore siamo nel welcome back message
