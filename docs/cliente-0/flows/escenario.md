User: Ciao  
Bot: Benvenuto, lavatrice o asciugatrice?  
User: lavatrice  
Bot: numero macchina?  
User: 3  
Bot: ha già pagato?  
User: sì ho pagato  
Bot: cosa vede nel display?  
User: SEL  
Bot: seleziona macchina e premi programma  
User: risolto  
Bot: ✅



User: lavatrice numero 5  
Bot: ha già pagato?  
User: no  
Bot: vai alla centrale, seleziona macchina, premi programma, chiudi porta  
User: ok ho pagato  
Bot: cosa vede nel display?  
User: PUSH  
Bot: premi il tasto programma  
User: funziona  
Bot: ✅



User: lavatrice 4, display ALM  
Bot: che tipo di ALM?  
User: water  
Bot: premi STOP una volta  
User: ok risolto  
Bot: ✅



User: ho finito il lavaggio ma i vestiti sono ancora bagnati  
Bot: display END + bAL?  
User: no  
Bot: carico eccessivo → dividi bucato e rifai ciclo rapido  
User: ok  
Bot: ✅




User: lavatrice 3 finita ma porta non si apre  
Bot: aspetta 2–3 minuti (scarico acqua)  
User: si è aperta  
Bot: ✅  
User: ancora bloccata  
Bot: contatto operatore



User: ho visto pochissima schiuma è normale?  
Bot: sì, è normale (detersivo industriale)



User: ho premuto STOP a metà lavaggio  
Bot: era il primo ciclo?  
User: no  
Bot: STOP annulla il lavaggio → contatto operatore (no rimborso automatico)



User: ho premuto STOP prima di iniziare  
Bot: macchina pronta → seleziona programma e avvia



User: asciugatrice non parte  
Bot: numero macchina?  
User: 6  
Bot: ha inserito monete al display centrale?  
User: no  
Bot: €3=15min, €4=20min, €5=25min → premi PAUSE  
User: ok inserito  
Bot: il display mostra i minuti?  
User: sì  
Bot: premi PAUSE per avviare ✅


User: asciugatrice 7, ho pagato, display DOOR  
Bot: chiudi bene il portello (click)  
User: ora funziona  
Bot: ✅



User: asciugatrice mostra FILTRO  
Bot: pulisci filtro + sensore → chiudi → premi STOP  
User: fatto  
Bot: ✅



User: asciugatrice 2, display FALLO DE ROTACION  
Bot: guasto sensore tamburo → contatto operatore



User: FALLO DE ASPIRACION  
Bot: pulisci filtro + tubo aspirazione → premi STOP  
User: risolto  
Bot: ✅



User: ho finito ma i vestiti sono ancora umidi  
Bot: li hai messi molto bagnati?  
User: sì, fradici  
Bot: non inserirli fradici → contatto operatore




User: asciugatrice finita ma porta bloccata  
Bot: aspetta 2 minuti (raffreddamento)  
User: si è aperta  
Bot: ✅




User: dalla asciugatrice esce un odore strano  
Bot: contatto operatore (controllo tamburo/filtro)



User: lavatrice 3  
Bot: assegna lavatrice_hs60xx  
User: aspetta era asciugatrice  
Bot: resetSession()  
User: asciugatrice 3  
Bot: nuovo flow asciugatrice_ed340



User: lavatrice 2  
Bot: flow attivo  
User: quanto costa il lavaggio a 40°?  
Bot: €3.50  
→ continua flow


User: lavatrice 2  
Bot: flow attivo  
User: quanto costa il lavaggio a 40°?  
Bot: €3.50  
→ continua flow


User: lavatrice 1 non parte da 20 minuti  
Bot: contatto operatore

User: hola, la lavadora no funciona  
Bot: responde en español → inicia flow lavatrice
