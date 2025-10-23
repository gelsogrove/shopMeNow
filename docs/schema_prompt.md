📄 prompt_agent.md (NUOVO - 39,762 caratteri)
├── 1. Introduzione (Chi Siamo, Società, Privacy)
├── 2. User Information (dati cliente)
├── 3. Lingua e Tono
├── 4. 🔧 CALLING FUNCTIONS (ordine corretto!)
│ ├── PRIORITÀ 0: Token Diretti (Visualizza Carrello, Tutti Ordini)
│ ├── PRIORITÀ 1: ContactOperator
│ ├── PRIORITÀ 2: GetLinkOrderByCode
│ ├── PRIORITÀ 3: repeatOrder
│ ├── PRIORITÀ 4: addProduct
│ └── PRIORITÀ 5: searchProduct (ULTIMA! ✅)
├── 5. Dati Dinamici (Offerte, Categorie, Prodotti, FAQ, Servizi)
└── 6. Regole Finali (Formatter, Conversazione, Checkout)

- ricntrolla e' importante il prompt non possiamo perdere nulla ma neanche confondere nulla, cancella solo se ha senso cancellare

- ricordai che non tutti i testi sono nel prompt_agent ci sono risposte che arrivano dalle CF
- occhio alla contradddizioni
- occhio all'ordine di priorita
- metti solo italiano
- dobbiamo risparmiare caratteri non ti allungare troppo
