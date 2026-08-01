# DemoRobot — bozza FAQ e Flow

Bozza per revisione di Andrea. **Non ancora caricata a DB.**
Contenuti ancorati a quanto verificato su am-robots.com il 2026-08-01.

---

## Fonte dei dati — leggere prima

Il sito **non ha una sezione FAQ né guide di troubleshooting**: è un e-commerce B2B di
ricambi (cavi, lame, batterie, casette) più la linea robot STORM. Quindi:

- ✅ Quello che segue usa **solo fatti verificati** dalle pagine reali
- ⚠️ I passi diagnostici sono **plausibili ma da confermare col cliente** — non sono
  documentati da AM Robots

### Fatti verificati

| Dato | Valore |
|---|---|
| Modelli STORM | **2000** (2000 m²), **5000** (5000 m²), **6500** (6500 m²) |
| Camera | Triple vision camera **solo su 6500** |
| Tecnologia | **LDI** (Laser + Direct AI processor + Imaging) |
| Niente cavo | Funziona **senza filo perimetrale, senza RTK/GPS, senza 4G** |
| Taglio | Larghezza 28 cm, altezza 3–8,5 cm |
| Peso / misure | 17 kg · 48 × 38 × 26 cm |
| Pendenza | Fino al 45% |
| Ostacoli | Rileva da 1 cm |
| Supporto tecnico | storm@am-robots.com · (+45) 81 40 12 21 · info@am-robots.com |
| Garanzia cavo | 10 anni su Premium Safety Cable 3,8 mm contro morsi animali |
| Risposta | Account manager dedicato, 2 ore nei giorni lavorativi |

⚠️ **Attenzione**: STORM funziona **senza cavo perimetrale**. Le FAQ classiche da robot
tagliaerba ("filo interrotto", "cerca il punto di rottura") **non si applicano** allo STORM —
riguardano i ricambi cavo venduti per robot di *altre* marche. Non mescolare i due mondi.

---

## 3 FAQ (risposta diretta, nessun albero)

### FAQ 1 — Quale modello STORM copre il mio giardino?

> STORM esiste in tre versioni, in base alla dimensione del prato:
> • **STORM 2000** — fino a 2.000 m²
> • **STORM 5000** — fino a 5.000 m²
> • **STORM 6500** — fino a 6.500 m², con tripla telecamera frontale
>
> Tutti tagliano su 28 cm di larghezza, ad altezza regolabile da 3 a 8,5 cm, e affrontano
> pendenze fino al 45%.

### FAQ 2 — Serve il filo perimetrale?

> No. STORM usa la tecnologia **LDI** (laser, processore AI e imaging) e si orienta da solo:
> niente filo perimetrale da interrare, niente RTK/GPS, niente connessione 4G.
>
> I cavi che vendiamo servono per robot di altre marche che il filo lo richiedono.

### FAQ 3 — Come contatto l'assistenza tecnica?

> Per lo STORM: **storm@am-robots.com**
> Assistenza generale: **info@am-robots.com** · **(+45) 81 40 12 21**
>
> Ogni cliente ha un account manager dedicato che risponde entro 2 ore nei giorni lavorativi.

---

## 2 Flow (albero diagnostico)

I flow servono quando la risposta **dipende da cosa risponde l'utente**. Entrambi finiscono
o in una soluzione o in `ESCALATE`.

### Flow A — «Il robot non parte»

```
Q1. Quando premi start, il robot dà segni di vita?
    (display acceso, suono, LED)
    │
    ├─ No, completamente spento
    │   └─ Q2. È rimasto in carica nella casetta?
    │       ├─ Sì  → ESCALATE  (possibile guasto batteria o contatti)
    │       └─ No  → Rimettilo in carica per almeno 2 ore e riprova.
    │                Se dopo la ricarica resta spento → ESCALATE
    │
    ├─ Sì, ma non si muove
    │   └─ Q3. Le ruote girano a vuoto o sono bloccate?
    │       ├─ Girano a vuoto → Verifica che non sia insabbiato o su
    │       │                    pendenza oltre il 45%. Spostalo su
    │       │                    terreno piano e riprova.
    │       └─ Bloccate       → Controlla erba o detriti nelle ruote e
    │                            sotto la scocca. Spegni prima di
    │                            intervenire. Se resta bloccato → ESCALATE
    │
    └─ Sì, mostra un messaggio di errore
        └─ Chiedi il testo esatto del messaggio → ESCALATE con il testo
           riportato nel briefing
```

### Flow B — «Taglia male o si ferma a metà»

```
Q1. Il problema è la qualità del taglio o il robot si ferma?
    │
    ├─ Taglia male / lascia ciuffi
    │   └─ Q2. Da quanto non sostituisci le lame?
    │       ├─ Meno di 2 mesi → Q3. L'erba è molto alta o bagnata?
    │       │                   ├─ Sì → Alza l'altezza di taglio e passa
    │       │                   │        più spesso; a erba bagnata il
    │       │                   │        taglio è sempre peggiore.
    │       │                   └─ No → ESCALATE
    │       └─ Più di 2 mesi  → Le lame sono probabilmente consumate.
    │                            Sostituiscile e riprova.
    │
    └─ Si ferma prima di finire
        └─ Q2. Si ferma sempre nello stesso punto?
            ├─ Sì → Q3. In quel punto c'è un ostacolo, un dislivello
            │        o una zona d'ombra fitta?
            │        ├─ Sì → Libera la zona; STORM rileva ostacoli da
            │        │        1 cm e si ferma per sicurezza.
            │        └─ No → ESCALATE (possibile problema sensori LDI)
            └─ No → Q3. Quanto dura prima di fermarsi?
                     └─ Se molto meno del solito → ESCALATE
                        (autonomia batteria in calo)
```

---

## Da confermare col cliente

1. I passi diagnostici sopra sono **ragionevoli ma non ufficiali**. Servono le procedure
   reali di AM Robots per non dare istruzioni sbagliate su un prodotto che non conosciamo.
2. Esiste una **lista di codici errore** dello STORM? Cambierebbe molto il Flow A.
3. Ogni quanto vanno sostituite le lame secondo il costruttore? Ho usato "2 mesi" come
   soglia di comodo, non è un dato verificato.
4. C'è un'app companion? Il sito non la menziona, ma quasi tutti i robot moderni ne hanno una.
5. Autonomia batteria dichiarata per modello — non pubblicata sul sito.
