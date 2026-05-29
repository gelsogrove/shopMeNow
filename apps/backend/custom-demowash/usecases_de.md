## Inhaltsverzeichnis

DemoWash ist ein Franchise-Netzwerk aus Selbstbedienungs-Waschsalons mit 6 Standorten in Katalonien: **Eixample**, **Gràcia**, **Mataró**, **Rubí**, **Sant Cugat** und **Terrassa**.

Jeder Standort hat seine eigenen Öffnungszeiten, Maschinen, Programme, Preise und Zahlungsmethoden. Bevor der Chatbot betriebliche Daten herausgibt, identifiziert er stets den Standort des Kunden. Bei technischen Problemen fragt er die 4 Angaben einzeln ab: **Standort → Typ → Nummer → Anzeige**.

### Die Maschine hat ein Problem
- [OPEN-Meldung im Display (Tür nicht richtig geschlossen)](#open-meldung)
- [ERR-01-Meldung im Display (Programm vor der Bezahlung gewählt)](#err-01-meldung)
- [ALERT- oder BLOCK-Meldung (technischer Defekt)](#alert-oder-block-meldung)
- [Die Waschmaschine startet nicht nach der Bezahlung (Display aus)](#startet-nicht-nach-bezahlung)
- [Die Tür entriegelt sich am Ende des Zyklus nicht](#tür-entriegelt-sich-nicht)
- [Der Trockner heizt nicht](#trockner-heizt-nicht)

### Zahlungen und Erstattungen
- [Doppelte Kartenabbuchung](#doppelte-abbuchung)
- [Ich habe bezahlt, aber die Maschine ist nicht angelaufen](#bezahlt-ohne-aktivierung)
- [Münzen am Trockner werden nicht gezählt](#trockner-münzen-zählen-nicht)
- [Wäsche schlecht gewaschen (schmutzig, noch nass, schlechter Geruch)](#schlecht-gewaschene-wäsche)
- [Ich möchte eine Rechnung](#rechnung)

### Waschtipps (universelle FAQ)
- [Bei welcher Temperatur wasche ich ein fleckiges weißes Hemd?](#fleckiges-weißes-hemd)
- [Bei welcher Temperatur wasche ich Buntwäsche?](#temperatur-buntwäsche)
- [Ich habe einen Fettfleck, wie bekomme ich ihn raus?](#fettfleck)
- [Muss ich Waschmittel mitbringen?](#waschmittel-inklusive)
- [Kann ich Bettdecken und Decken waschen?](#bettdecken-und-decken)
- [Wie lange dauert ein Waschgang?](#dauer-eines-waschgangs)

### Standortdaten (Franchising)
- [Wie sind die Öffnungszeiten?](#öffnungszeiten)
- [Was kostet ein Waschgang?](#preise)
- [Kann man mit Karte zahlen?](#zahlungsmethoden)
- [Welche Programme hat die Waschmaschine?](#programme)
- [Wie funktioniert die Treuekarte?](#treuekarte)
- [Wie viel spare ich mit der Treuekarte?](#ersparnis-mit-der-treuekarte)
- [Wo ist der nächste Waschsalon?](#nächster-waschsalon)

---

## OPEN-Meldung

> Technisches Problem — Ablauf Standort → Typ → Nummer → Display (1 Angabe pro Runde).

**Kunde:** Meine Waschmaschine startet nicht.
**Bot:** Hallo! 👋 Ich bin der virtuelle Assistent von **Demowash**. In welchem Waschsalon bist du?

**Kunde:** Eixample.
**Bot:** Waschmaschine oder Trockner?

**Kunde:** Waschmaschine.
**Bot:** Welche Nummer hat die Maschine?

**Kunde:** Die 3.
**Bot:** Was siehst du im Display?

**Kunde:** OPEN.
**Bot:** Öffne die Tür vorsichtig, prüfe, ob Kleidung in der Gummidichtung klemmt, und schließe sie fest, bis du das Klick hörst. Ist die Meldung weg?

**Kunde:** Ja, weg.
**Bot:** Super. Wähle das Programm erneut aus. Viel Erfolg beim Waschen! 👋

---

## ERR-01-Meldung

**Kunde:** Ich bin in Mataró, Waschmaschine 6 mit ERR-01.
**Bot:** Du hast das Programm vor der Bezahlung gedrückt. Wir starten neu:

1. Lade die Wäsche und schließe die Tür richtig.
2. Geh zum Zahlterminal, bezahle und wähle deine Maschinennummer.
3. Geh zurück zur Maschine und drücke das Programm.

Sag mir, ob sie startet.

**Kunde:** Jetzt startet sie.
**Bot:** Perfekt! Viel Erfolg beim Waschen 👋

---

## ALERT- oder BLOCK-Meldung

**Kunde:** Sant Cugat, Waschmaschine 4, zeigt ALERT.
**Bot:** Die Maschine hat eine Störung erkannt und muss überprüft werden. Verlade deine Wäsche bitte in eine freie Maschine und sag mir, welche du gewählt hast. Wir aktivieren sie aus der Ferne, damit du ohne Aufpreis waschen kannst.

**Kunde:** Ich bin jetzt an Maschine 2.
**Bot:** Danke. Wie heißt du? Ich gebe den Fall an einen Mitarbeiter weiter, um Maschine 2 zu aktivieren und die Störung an der 4 zu melden.

**Kunde:** Andrea.
**Bot:** Ich habe deinen Fall aufgenommen, Andrea. Ein Mitarbeiter wird dich in wenigen Minuten kontaktieren.

---

## Startet nicht nach Bezahlung

> Sonderfall: Das Display ist aus oder zeigt keinen Code — der Bot leitet direkt weiter, da ohne Code keine dokumentierte Prozedur existiert.

**Kunde:** Ich habe bezahlt, aber die Maschine startet nicht.
**Bot:** In welchem Waschsalon bist du?

**Kunde:** Rubí.
**Bot:** Waschmaschine oder Trockner?

**Kunde:** Waschmaschine.
**Bot:** Welche Nummer hat die Maschine?

**Kunde:** Die 3.
**Bot:** Was siehst du im Display?

**Kunde:** Nichts, es ist aus.
**Bot:** Verstanden. Wie heißt du? Ich gebe den Fall an einen Mitarbeiter weiter, der die Maschine aus der Ferne aktiviert.

**Kunde:** Marta.
**Bot:** Ich habe deinen Fall aufgenommen, Marta. Ein Mitarbeiter wird dich in wenigen Minuten kontaktieren.

---

## Tür entriegelt sich nicht

**Kunde:** Die Tür geht nicht auf, der Waschgang ist schon fertig.
**Bot:** Kein Grund zur Sorge. Wenn der Zyklus endet, dauert es ein paar Minuten, bis die Tür entriegelt. Wie lange ist der Waschgang her?

**Kunde:** Über 5 Minuten.
**Bot:** In welchem Waschsalon bist du?

**Kunde:** Gràcia.
**Bot:** Welche Nummer hat die Waschmaschine?

**Kunde:** Die 2.
**Bot:** Wie heißt du? Ich gebe den Fall an einen Mitarbeiter weiter, der die Tür aus der Ferne entriegelt.

**Kunde:** Luis.
**Bot:** Ich habe deinen Fall aufgenommen, Luis. Ein Mitarbeiter wird dich in wenigen Minuten kontaktieren.

---

## Trockner heizt nicht

**Kunde:** Der Trockner heizt nicht, die Minuten laufen, aber die Wäsche bleibt nass.
**Bot:** Tut mir leid. In welchem Waschsalon bist du?

**Kunde:** Terrassa.
**Bot:** Welche Nummer hat der Trockner?

**Kunde:** Die 5.
**Bot:** Wie heißt du? Ich gebe den Fall an einen Mitarbeiter weiter, um den Zyklus zu erstatten und die Maschine zu prüfen.

**Kunde:** Anna.
**Bot:** Ich habe deinen Fall aufgenommen, Anna. Ein Mitarbeiter wird dich in wenigen Minuten kontaktieren.

---

## Doppelte Abbuchung

**Kunde:** Mir wurde zweimal von der Karte abgebucht.
**Bot:** Tut mir leid. In welchem Waschsalon bist du?

**Kunde:** Eixample.
**Bot:** Welche Nummer hat die Maschine?

**Kunde:** Die 1.
**Bot:** Kannst du mir die letzten 4 Ziffern der Karte und deinen Namen geben? Ich gebe den Fall an einen Mitarbeiter weiter, um die doppelte Abbuchung zu prüfen.

**Kunde:** Karte 8821, ich bin Jordi.
**Bot:** Ich habe deinen Fall aufgenommen, Jordi. Ein Mitarbeiter wird dich in wenigen Minuten kontaktieren.

---

## Bezahlt ohne Aktivierung

**Kunde:** Ich habe bezahlt, aber die Maschine ist nicht angelaufen, und ich möchte eine Erstattung.
**Bot:** Tut mir leid. In welchem Waschsalon bist du?

**Kunde:** Mataró.
**Bot:** Waschmaschine oder Trockner?

**Kunde:** Waschmaschine, die 6.
**Bot:** Wie hast du bezahlt: bar, mit Treuekarte oder Bankkarte?

**Kunde:** Bankkarte, endet auf 4412.
**Bot:** Wie heißt du?

**Kunde:** Carla.
**Bot:** Ich habe deinen Fall aufgenommen, Carla. Ein Mitarbeiter wird dich in wenigen Minuten kontaktieren, um die Erstattung zu bearbeiten.

---

## Trockner-Münzen zählen nicht

**Kunde:** Ich habe Münzen in den Trockner gesteckt, aber die Minuten erhöhen sich nicht.
**Bot:** Tut mir leid. In welchem Waschsalon bist du?

**Kunde:** Rubí.
**Bot:** Welche Nummer hat der Trockner?

**Kunde:** Die 3.
**Bot:** Wie heißt du? Ich gebe den Fall an einen Mitarbeiter weiter, um das Geld zu erstatten und die Maschine zu prüfen.

**Kunde:** Mireia.
**Bot:** Ich habe deinen Fall aufgenommen, Mireia. Ein Mitarbeiter wird dich in wenigen Minuten kontaktieren.

---

## Schlecht gewaschene Wäsche

> Der Kunde meldet ein fehlerhaftes Service-Ergebnis (Wäsche nach dem Zyklus noch schmutzig, nach vollem Trocknungslauf noch nass, schlechter Geruch). Der Bot behandelt den Fall als Qualitätsbeschwerde, erfasst Standort + Maschinentyp + Nummer + Name und leitet den Fall an einen Mitarbeiter zur Erstattungsprüfung weiter. Der Bot **entscheidet nicht** über die Erstattung — das übernimmt der Mitarbeiter.

**Kunde:** Die Wäsche kam schmutzig raus und riecht schlecht — ich möchte eine Erstattung.
**Bot:** Tut mir leid. In welchem Waschsalon bist du?

**Kunde:** Eixample.
**Bot:** Waschmaschine oder Trockner?

**Kunde:** Waschmaschine, Nummer 3.
**Bot:** Wie heißt du?

**Kunde:** Marta.
**Bot:** Ich habe deinen Fall aufgenommen, Marta. Ein Mitarbeiter wird dich in wenigen Minuten kontaktieren, um den Fall und die Erstattung zu prüfen.

---

## Rechnung

> Der Bot fragt die Daten einzeln ab (Regel „eine Frage pro Runde"): Firmenname → Betrag → Datum der Nutzung → E-Mail → optionale Notiz.
>
> 🔒 **Sensible Daten außerhalb des LLM-Flows**: Firmenname, USt-ID/Steuernummer, Adresse, E-Mail und andere personenbezogene Daten werden NICHT an das KI-Modell (OpenAI/OpenRouter) gesendet. Der Bot erfasst jedes Feld und unser Code verarbeitet es deterministisch — die Antworten in diesen Runden sind **fest im Code verdrahtet**, nicht vom LLM generiert. So bleiben PII-Daten vom Standard-Flow zur KI ausgeschlossen.

**Kunde:** Ich möchte eine Rechnung für den Waschgang.
**Bot:** Super! Ich bereite die Rechnung vor. Wie lautet der Firmenname oder die Geschäftsbezeichnung?

**Kunde:** Marta Ribas GmbH.
**Bot:** Danke. Welchen Betrag hast du bezahlt? (in Euro)

**Kunde:** 8 €.
**Bot:** Perfekt. Wann hast du den Service genutzt? (z. B. heute, gestern, 29.05.2026)

**Kunde:** Heute.
**Bot:** Verstanden. An welche E-Mail soll ich die Rechnung senden?

**Kunde:** marta@example.com
**Bot:** Danke. Möchtest du eine Notiz hinzufügen? (z. B. USt-ID, Kundennummer, Referenz) Wenn nicht, schreib „nein".

**Kunde:** USt-ID B12345678.
**Bot:** Perfekt. Ich habe die Rechnung mit folgenden Daten erfasst: Marta Ribas GmbH, 8 €, heute, USt-ID B12345678. Sie kommt in wenigen Minuten an marta@example.com.

---

## Fleckiges weißes Hemd

> Universelle FAQ — hängt nicht vom Standort ab.

**Kunde:** Ich habe ein fleckiges weißes Hemd — bei welcher Temperatur wasche ich es, ohne es zu ruinieren?
**Bot:** Für ein fleckiges weißes Hemd:
- **Robuste Baumwolle**: **40°C** (bis 60°C bei hartnäckigen Flecken)
- **Empfindliche Stoffe** (Seide, Wolle, feine Mischungen): **30°C**

Über 40°C bei empfindlichen Stoffen riskierst du, den Fleck zu fixieren. Wähle das passende Programm am Display der Maschine — Waschmittel wird automatisch dosiert.

---

## Temperatur Buntwäsche

**Kunde:** Bei welcher Temperatur wasche ich Buntwäsche?
**Bot:** Faustregel für Buntwäsche:
- **Dunkle Farben / Schwarz**: **30°C** (verhindert Farbverlust)
- **Helle Farben**: **30-40°C**
- **Robuste Farben mit Flecken**: bis **40°C**

Wasche Buntwäsche nie über 40°C beim ersten Mal: Farben bluten am stärksten, wenn der Stoff neu ist.

---

## Fettfleck

**Kunde:** Ich habe einen Fettfleck auf einem Hemd, wie bekomme ich ihn raus?
**Bot:** Tupfe zuerst den Überschuss mit Küchenpapier ab, ohne zu reiben (Reiben verteilt den Fleck). Wähle dann:
- **Baumwolle**: **60°C**
- **Synthetik oder Feines**: **40°C**

Das Demowash-Waschmittel enthält einen Fettlöser, der automatisch dosiert wird.

---

## Waschmittel inklusive

**Kunde:** Muss ich Waschmittel mitbringen?
**Bot:** Nein, du musst nichts mitbringen! Demowash-Waschmaschinen **dosieren automatisch** zertifiziertes Bio-Waschmittel und Weichspüler aus 100% natürlichen Inhaltsstoffen. Bring nur deine Wäsche mit. 😊

---

## Bettdecken und Decken

**Kunde:** Kann ich Bettdecken und Decken waschen?
**Bot:** Ja, kannst du! Hier die Tipps:

**Bettdecken und Decken aus Baumwolle oder robustem Polyester:**
- **Temperatur**: **40°C**
- **Kapazität**: nimm eine **20-kg-Maschine** für große Bettdecken
- **Nach dem Waschen**: Trockner auf **hoher oder mittlerer Temperatur**, um die Feuchtigkeit gut zu entfernen

**Empfindliche Bettdecken oder mit synthetischer Füllung:**
- **Temperatur**: **30°C**

**Tipps**:
- Überlade die Maschine nicht — die Bettdecke braucht Platz, um sich gut zu bewegen
- Nach dem Waschen kommt die Bettdecke sehr nass raus: trockne sie im **Trockner** fertig

Wenn du wissen möchtest, welche großen Maschinen verfügbar sind und die genauen Preise, sag mir, in welchem Waschsalon du bist. 😊

---

## Dauer eines Waschgangs

**Kunde:** Wie lange dauert ein Waschgang?
**Bot:** Die Dauer hängt vom **Programm** ab, das du wählst:

- **60°C** (sehr heiß): **50-55 Minuten**
- **40°C** (heiß): **45-50 Minuten**
- **30°C** (lauwarm): **40-45 Minuten**
- **Kalt** (*): **35-40 Minuten**

Das sind ungefähre Zeiten. Während des Zyklus siehst du im Display den Countdown der verbleibenden Zeit (z. B. `T-28` heißt 28 Minuten). 😊

---

## Öffnungszeiten

> Standortspezifische FAQ — der Bot fragt nur nach dem Standort.

**Kunde:** Wie sind die Öffnungszeiten?
**Bot:** In welchem Waschsalon bist du?

**Kunde:** Gràcia.
**Bot:** In **Gràcia** sind wir von **7:00 bis 23:00 Uhr** geöffnet, täglich.

---

## Preise

**Kunde:** Was kostet ein Waschgang?
**Bot:** In welchem Waschsalon bist du?

**Kunde:** Eixample.
**Bot:** In **Eixample** sind das die Waschmaschinen-Preise:

| Nr. | Gewicht | Treuekarte | Bargeld |
|-----|---------|------------|---------|
| 1   | 20 kg   | 7 €        | 8 €     |
| 2   | 20 kg   | 7 €        | 8 €     |
| 3   | 10 kg   | 4 €        | 4,50 €  |
| 4   | 10 kg   | 4 €        | 4,50 €  |

Möchtest du auch die Trockner-Preise?

---

## Zahlungsmethoden

**Kunde:** Kann man mit Karte zahlen?
**Bot:** In welchem Waschsalon bist du?

**Kunde:** Gràcia.
**Bot:** In **Gràcia** wird nur **Kredit-/Debitkarte** akzeptiert. Kein Bargeld und keine Treuekarte an diesem Standort.

---

## Programme

**Kunde:** Welche Programme hat die Waschmaschine?
**Bot:** In welchem Waschsalon bist du?

**Kunde:** Eixample.
**Bot:** In **Eixample** hat die Waschmaschine 4 Programme:

| Taste | Programm    | Temperatur |
|-------|-------------|------------|
| 1     | Sehr heiß   | 60°        |
| 2     | Heiß        | 40°        |
| 3     | Lauwarm     | 30°        |
| 4     | Kalt        | *          |

Der Trockner hat 3: hohe, mittlere und niedrige Temperatur.

---

## Treuekarte

> Der Bot bestätigt, ob der Standort des Kunden die Karte akzeptiert, und zeigt die reduzierten Preise. Für Aktivierung, Aufladung oder Guthabenabfrage verweist er ans Waschsalon-Team — sie kümmern sich vor Ort um die Karte. Der Bot stellt das als Service des Standorts dar, nicht als eigene Einschränkung.

**Kunde:** Wie funktioniert die Treuekarte?
**Bot:** Mit der Treuekarte zahlst du **weniger** als mit Bargeld oder Bankkarte — der Rabatt wird bei jedem Wasch- und Trockengang automatisch abgezogen.

In welchem Waschsalon bist du? Ich bestätige dir, ob wir sie akzeptieren, und nenne dir die Preise.

**Kunde:** Eixample.
**Bot:** In **Eixample** ja, wir akzeptieren die Treuekarte. Das sind die Preise:

| Maschine           | Kapazität | Treuekarte |
|--------------------|-----------|------------|
| Waschmaschine 1-2  | 20 kg     | 7 €        |
| Waschmaschine 3-4  | 10 kg     | 4 €        |
| Trockner 5-6       | 20 kg     | 2,50 €     |

---

## Ersparnis mit der Treuekarte

> Der Bot braucht den Standort, um die genaue Ersparnis zu zeigen — jeder Standort hat unterschiedliche Preise.

**Kunde:** Wie viel spare ich mit der Treuekarte?
**Bot:** Um dir die genaue Ersparnis zu sagen: in welchem Waschsalon bist du?

**Kunde:** Rubí.
**Bot:** In **Rubí** ist die Ersparnis mit der Treuekarte:

**Waschmaschinen**:
- Maschine 1 (10 kg): **0,50 € Ersparnis** (4,50 € mit Karte vs 5 € bar)
- Maschine 2 (15 kg): **1 € Ersparnis** (6 € mit Karte vs 7 € bar)
- Maschine 3 (20 kg): **1 € Ersparnis** (7 € mit Karte vs 8 € bar)

**Trockner** (Maschinen 4 und 5, 20 kg): **gleicher Preis** mit Karte oder bar (2 € / 15 min).

💡 Wenn du die große Waschmaschine (Maschine 3) regelmäßig nutzt, rechnet sich die Karte schon nach wenigen Waschgängen. 😊

---

## Nächster Waschsalon

**Kunde:** Wo ist der nächste Waschsalon?
**Bot:** In welcher Gegend bist du? Ich gebe dir die Daten zum bequemsten Standort.

**Kunde:** Ich bin in Barcelona.
**Bot:** In Barcelona haben wir zwei Demowash-Standorte:

1. **Eixample** — C/ Aragó 286, in der Nähe von Passeig de Gràcia. Öffnungszeiten: 8:00 — 22:00
2. **Gràcia** — C/ Verdi 47, in der Nähe von Plaça del Sol. Öffnungszeiten: 7:00 — 23:00

In welchem der beiden bist du, oder welcher interessiert dich? 😊

---
