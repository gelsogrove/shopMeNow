Ciao, questo prompt è specifico per il cliente-0.

All’interno dei PDF presenti nella cartella trovi tutti i requisiti del cliente.
Devi leggerli completamente, capirli a fondo e usarli come contesto principale.

Percorso di riferimento completo:
/Users/gelso/workspace/shopME/docs/cliente-0

Dopo aver analizzato tutto il materiale, voglio una valutazione approfondita su:

Architettura
È corretta rispetto ai requisiti del cliente?
È coerente con il tipo di use case (assistenza lavanderia, flussi guidati, troubleshooting)?
Copertura degli scenari
Gli scenari definiti qui sono coperti correttamente?
/Users/gelso/workspace/shopME/docs/cliente-0/flows/escenario.md
Copertura della demo
Il sistema copre completamente i flussi previsti nella demo?
/Users/gelso/workspace/shopME/docs/cliente-0/flows/demo.md
Validazione dei prompt
Voglio essere assolutamente sicuro che:
ogni prompt abbia una responsabilità chiara e ben definita
non ci siano sovrapposizioni tra agenti
ogni LLM faccia solo ciò che deve fare (no logica fuori posto)
Function calling
Gli LLM hanno le funzioni corrette disponibili?
Le chiamate sono coerenti con i casi d’uso reali del cliente?
Ci sono funzioni mancanti o inutili?
Allineamento prompt ↔ responsabilità
I testi dei prompt sono coerenti con il ruolo dell’agente?
I prompt rispettano i vincoli del playbook (tono, flusso, escalation, raccolta dati)?
Gap analysis
Quali casistiche presenti nei documenti NON sono coperte?
Ci sono edge case non gestiti?
Dove il sistema potrebbe fallire in produzione?
Verifica completa
Conferma esplicitamente di aver letto TUTTI i PDF
Se qualcosa non è chiaro o manca, segnalalo

Output richiesto:

Report strutturato
Criticità ordinate per priorità (HIGH / MEDIUM / LOW)
Suggerimenti concreti (non teoria)

Obiettivo:
Voglio essere 100% sicuro che il sistema sia pronto per produzione su questo cliente.

TROVA
trova discrepanze, cose non allineate spiegate male confise o in conflitto

CAMBI
sentiti libero di cambiare i prompt ma chiedi sempre il permesso fammi capire che tipo di errore stai modificaindo voglio capire se la responsabilita e' ben divisa

e rpoi convermai che usiamo sempre queta archetttura solo per chatbot FLow
/Users/gelso/workspace/shopME/docs/cliente-0/flows/LLMarchetecture.png

ORA DIMMI SIAMO ALLINEATI E ARCHITECTURE E PROMPT SONO BEN FATTI?


controllami che anche i json sono corretti populati e coprano 100% di casi del pdf del cliente-0
controlla i file json e controlla anche le matrici
devo essere sicur che analisi e' completa

1) assicurarsi ananlisi completa
2) demo che ti diro dopo nel prossimo prompt
3) imlpementare nella nostra archetttura prossimi promot