- debug = true
  non vare vedere l'icona di whatsapp
  non ricaricare nussun recharge economico

NELLA PAGINA DI WRKSPACE-SELECTION ABBUIAMO BISONGO DEL LOGOUT L'UTENTE SI CONNETTE
E NON SI PU' FARE IL LOGOUT

- testPRIAM DI MAX

FASE 2

- SWAGGER
- heroku
- whatsapp
- 2AUTH

ora dobbiamo fare due api per whatasapp
uno e' il webhook dove rivedremo il post da media
automaticamete dovremmo passarlo all LLM service che risponde e salva dentro lo storico guysti?
e l'alto sare per inviare il messaggio a whatsapp

sicurezza
per inviare un messaggio
dobbiamo inviare il sessionID worksapceID cusomerID numero di telefno del cliente
e messaggio

invece il webhook che riceve il messagigo
dovremmo essere sicuri che arriva da Whagtsapp number dobbiamo avere il numero di telefono
nel DB e da li prendiamo cusomerUID e WorkspaceID
cosi poi chiamiamo LLM con tutti i parametri necesario
e qui dentro in questo punto facciamo una conversione da mark down a whataspp messagge API con giuste icone

quindi vogio 2 api
vogli ole variabili dentro env.local
voglio le conversioni qui e voglio che qui venga chiamato llm service con tutti i parametri nececssari. per far entrare il messaggio da whataspp dentro il nostro sistema

fai un file whatasapp dentro memory bank
