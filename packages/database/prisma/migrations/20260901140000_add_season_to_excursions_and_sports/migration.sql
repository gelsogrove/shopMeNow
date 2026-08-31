-- PRO_LOCO tourism: season field on excursions and sports facilities
-- (Andrea, 2026-09-01: "aggiungiamo anche il campo season... anche per le
-- strutture sportive"). Free text like the other qualifier fields
-- ("estiva" / "invernale" / "tutto l'anno"); the chatbot receives it as an
-- explicit fact on the card and reasons against the runtime Season line.

-- AlterTable
ALTER TABLE "tourist_excursions" ADD COLUMN "season" TEXT;
ALTER TABLE "tourist_sports_facilities" ADD COLUMN "season" TEXT;
