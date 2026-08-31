// Sappada "Case e appartamenti per vacanze" import (Andrea, 2026-08-31:
// "metti questi dati dove puoi... e metti tutti i dati che puoi").
// Source: https://www.sappadadolomiti.com/wp-content/uploads/2025/11/Elenco-case-e-appartamenti-1-2.pdf
// (Infopoint Promoturismo FVG Sappada, edition 11/2025) — transcribed row by
// row, duplicated names kept exactly as the official list prints them.
//
// One-shot, idempotent (skips rows already present by name+location+beds).
// Usage:
//   WORKSPACE_ID=<id> DATABASE_URL=<url> node _seed_sappada_apartments.mjs
// WORKSPACE_ID defaults to the production demosappada workspace.
import { PrismaClient } from "./src/generated/prisma/index.js"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const WS = process.env.WORKSPACE_ID || "7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c"
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes("localhost") ? undefined : { rejectUnauthorized: false },
})
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) })

// [name, borgata, civico, telefono, cellulare, email, camere, posti letto, bagni]
const APPARTAMENTI = [
  ["Appartamenti De Betta 1", "Bach", "12", null, "393 9382010", "debetta@libero.it", 2, 5, 1],
  ["Appartamenti De Betta 2", "Bach", "12", null, null, null, 1, 3, 1],
  ["Appartamento centrale", "Palù", "79", null, "339 4596442", "sappada@acapulcolignano.it", 2, 5, 1],
  ["Appartamento Digola", "Granvilla", "92", "0435 469798", "348 7376278", "dorisph@libero.it", 1, 4, 1],
  ["Appartamento Olbe", "Granvilla", "92", null, null, null, 1, 4, 1],
  ["Appartamento Siera", "Granvilla", "92", null, null, null, 1, 4, 1],
  ["Appartamento Primula", "Bach", "31", "0435 469113", null, "info@albergocavallino.it", 1, 2, 1],
  ["Appartamento Stella Alpina", "Bach", "31", "0435 469113", null, "info@albergocavallino.it", 1, 3, 1],
  ["Benedetti Anna 1", "Granvilla", "100", null, "377 1185919", "annaveslar@gmail.com", 2, 3, 1],
  ["Benedetti Anna 2", "Granvilla", "100", null, "377 1185919", "annaveslar@gmail.com", 2, 5, 1],
  ["Benedetti Anna 3", "Granvilla", "100", null, "377 1185919", "annaveslar@gmail.com", 2, 5, 1],
  ["Benedetti Antonietta", "Hoffe", "35", null, "335 6300835", "sandra1974cf@libero.it", 2, 4, 1],
  ["Benedetti Bruno 1", "Mühlbach", "30", null, "346 5031508", "michi.benedetti@gmail.com", 1, 2, 1],
  ["Benedetti Bruno 2", "Mühlbach", "30", null, null, null, 1, 2, 1],
  ["Benedetti Cecilia", "Granvilla", "113", "0435 72417", null, "cbenedetti70@gmail.com", 2, 4, 1],
  ["Benedetti Gianpietro", "Granvilla", "98", "0435 469795", "348 3351066", "benedetti.sappada@alice.it", 2, 4, 1],
  ["Benedetti Marcella", "Cretta", "7", "0435 469182", "338 4252128", "marcella.benedetti@hotmail.it", 1, 2, 1],
  ["Benedetti Riss Aurelio", "Cima", "58", "0435 469313", "366 9742140", "edicolabenedetti@libero.it", 3, 7, 2],
  ["Benedetti Roberto", "Granvilla", "113", "0435 66160", "328 0977927", "bobbyben@libero.it", 2, 4, 1],
  ["Benedetti Sergio 1", "Granvilla", "100", null, "349 8675819", "appartamenti@veslar.it", 2, 5, 1],
  ["Benedetti Sergio 2", "Granvilla", "100", null, null, null, 3, 4, 2],
  ["Benedetti Vittorio 1", "Palù", "31", null, "339 8071279", "antoniobenedetti07@gmail.com", 2, 7, 1],
  ["Benedetti Vittorio 2", "Palù", "31", null, "339 8071279", "antoniobenedetti07@gmail.com", 2, 4, 1],
  ["Benedetto Gioconda", "Cretta", "7", "0435 469182", "338 4252128", "marcella.benedetti@hotmail.it", 3, 5, 1],
  ["Benedetto Riss Antonio", "Cima", "63", "0435 66135", null, null, null, null, null],
  ["Benedetto Tiz Luigi 1", "Cima", "88", null, "347 4515342", "bazzanaisabella@gmail.com", 2, 4, 1],
  ["Benedetto Tiz Luigi 2", "Cima", "88", null, "347 4515342", "bazzanaisabella@gmail.com", 2, 4, 1],
  ["Boccingher Daniela", "Bach", "95", "0435 469576", null, "iscrio@libero.it", 2, 5, 1],
  ["Boccingher Gianfranco 1", "Bach", "86", "0435 66170", "334 3503104", "boccingherfranco@alice.it", 3, 6, 1],
  ["Boccingher Gianfranco 2", "Bach", "86", "0435 66170", "334 3503104", "boccingherfranco@alice.it", 2, 5, 1],
  ["Boccingher Giordano", "Bach", "78", null, "348 7486113", "boccingher.giordano@libero.it", 3, 6, 1],
  ["Boccingher Maria Grazia 1", "Bach", "68", "0435 469527", "339 6978941", "fam.zilli@libero.it", 2, 4, 1],
  ["Boccingher Maria Grazia 2", "Bach", "68", "0435 469527", "339 6978941", "fam.zilli@libero.it", 2, 4, 1],
  ["Boccingher Maria Grazia 3", "Granvilla", "97", "0435 469527", "339 6978941", "fam.zilli@libero.it", 2, 6, 1],
  ["Casa Alpenplick 1", "Hoffe", "48", "0435 469325", "333 3514038", "claudia@kratter.it", 2, 5, 2],
  ["Casa Alpenplick 2", "Hoffe", "48", "0435 469325", "333 3514038", "claudia@kratter.it", 2, 5, 1],
  ["Casa Alpenplick 3", "Hoffe", "48", "0435 469325", "333 3514038", "claudia@kratter.it", 2, 4, 1],
  ["Casa Ginepri", "Lerpa", "287", null, "340 9880444", "hotel.debora@libero.it", 2, 4, 1],
  ["Casa Kratter Maurizio", "Bach", "238", "347 0397115", "349 4131556", "maukratter@libero.it", 1, 3, 1],
  ["Casa Kratter Teresa", "Soravia", "50", "0435 66112", "379 7734011", "giulianakratter@gmail.com", 2, 4, 1],
  ["Casa Nigritella", "Bach", "118/A", "0435 469780", "371 3107634", null, 2, 5, 1],
  ["Casa Pachner 1", "Cima", "53", "0435 66142", "339 6320000", "sergiopuicher@alice.it", 4, 6, 1],
  ["Casa Piller Roner Paola", "Lerpa", "189", null, "340 2704511", "paolapiller@libero.it", 1, 2, 1],
  ["Casa Quinz Gianpiero", "Bach", "47", "0435 469489", "333 2170562", "emporiosappada@gmail.com", 2, 4, 1],
  ["Casa Zambon", "Cima", "80", null, "333 6739508", "iopiz74@libero.it", 3, 8, 2],
  ["Cecon Daniela", "Ecche", "32", "0435 469351", "338 3291132", "puicher.cecon@libero.it", 3, 6, 2],
  ["Colle Tiz Giuliana", "Soravia", "17", null, "333 7224079", "colletizgiuliana@gmail.com", 1, 3, 1],
  ["Cottrer Pietro 1", "Soravia", "58", null, "348 9523751", "appartamenticottrer@tiscali.it", 2, 4, 1],
  ["Cottrer Pietro 1", "Soravia", "58", null, "348 9523751", "appartamenticottrer@tiscali.it", 2, 4, 1],
  ["Crespi Maria Luisa 1", "Granvilla", "82", "0435 469187", "366 3791585", "a.kratterthaler@gmail.com", 2, 4, 1],
  ["Crespi Maria Luisa 2", "Granvilla", "82", "0435 469187", "366 3791585", "a.kratterthaler@gmail.com", 2, 4, 1],
  ["Crespi Maria Luisa 3", "Granvilla", "82", "0435 469187", "366 3791585", "a.kratterthaler@gmail.com", 2, 4, 1],
  ["Crespi Maria Luisa 4", "Granvilla", "82", "0435 469187", "366 3791585", "a.kratterthaler@gmail.com", 2, 4, 1],
  ["Daveri Gianfranco", "Lerpa", "151", "0435 469441", "349 3793247", "giulianadallapietra@gmail.com", 2, 5, 1],
  ["De Candido Miranda 1", "Lerpa", "1", "0435 469537", "320 6945016", "pontilg@alice.it", 3, 6, 2],
  ["De Candido Miranda 2", "Lerpa", "1", null, null, null, 3, 6, 2],
  ["De Mattia Giuseppina 1", "Fontana", "48", null, "347 6936394", "guzzile@yahoo.com", 2, 4, 1],
  ["De Mattia Giuseppina 2", "Fontana", "48", null, "347 6936394", "guzzile@yahoo.com", 2, 4, 1],
  ["De Mattia Giuseppina 3", "Fontana", "48", null, "347 6936394", "guzzile@yahoo.com", 2, 4, 1],
  ["De Michiel Puicher Soravia 1", "Fontana", "8", "0435 469213", "346 3617189", "casagenziana@yahoo.it", 2, 4, 1],
  ["De Michiel Puicher Soravia 2", "Fontana", "8", "0435 469213", "346 3617189", "casagenziana@yahoo.it", 2, 4, 1],
  ["De Michiel Puicher Soravia 3", "Fontana", "8", null, null, null, 4, 7, 1],
  ["De Podestà Anita", "Hoffe", "21", null, "347 5039496", "anita.depodesta@gmail.com", 1, 2, 1],
  ["De Zordo Alessandro", "Bach", "87", null, "348 5189818", "appartamentidezordo@libero.it", 2, 4, 1],
  ["De Zordo Auroranna", "Bach", "185", null, "348 5189818", "auroranna.dezordo@gmail.com", 2, 4, 1],
  ["Famiglia Lanner Marisa", "Cretta", "3", null, "393 9777007", "valeria.kratter@libero.it", 2, 5, 1],
  ["Famiglia Lanner Silvano", "Cretta", "3", null, "393 9777007", null, 2, 5, 1],
  ["Fauner Stefano", "Bach", "179", null, "347 690 5486", "stefanofauner@hotmail.com", 1, 2, 1],
  ["Felicetti Franca", "Bach", "138", "0435 469593", "340 1896446", "pach.felicetti@email.it", 3, 6, 2],
  ["Fontana Elena", "Palù", "64", "0435 469522", "329 4737935", "elenatfn@yahoo.it", 3, 6, 2],
  ["Fontana Giovanni", "Fontana", "18", "0435 469503", "388 6374179", null, 2, 4, 1],
  ["Fontana Igino", "Palù", "46", "0435 469434", null, "fontanakratter@libero.it", 4, 8, 2],
  ["Fontana Igino", "Palù", "46", null, null, null, 4, 8, 2],
  ["Fontana Irene", "Palù", "56", "0435 469522", null, "app@lffontana.it", 2, 4, 1],
  ["Fontana Luca", "Palù", "56", null, null, null, 3, 6, 2],
  ["Fontana Marta e Serena", "Fontana", "28", null, "347 9253770", "appartamentifontana@gmail.com", 1, 4, 1],
  ["Fontana Marta e Serena", "Fontana", "28", null, null, null, 1, 3, 1],
  ["Fontana Renato", "Palù", "46", "0435 469434", "338 6619774", "zampol.stefano@gmail.com", 2, 4, 1],
  ["Fontana Vittoria 1", "Soravia", "32", "0435 66057", "327 7754978", "pkratter@tiscali.it", 1, 4, 1],
  ["Fontana Vittoria 2", "Soravia", "32", "0435 66057", "327 7754978", "pkratter@tiscali.it", 2, 4, 1],
  ["Girolamo Nicoletta", "Granvilla", "130", null, "348 3351066", "benedetti.sappada@alice.it", 2, 4, 1],
  ["Graz Maria Teresa", "Cima", "9", "0432 485157", "347 2592414", "graz5412@gmail.com", 3, 9, 2],
  ["Haus Peralba", "Cima", "23", "0435 469273", null, "ausydelor@yahoo.it", 2, 5, 3],
  ["Hoffer Manuela", "Mühlbach", "46", null, "320 0478711", "hm64@libero.it", 2, 4, 1],
  ["Hoffer Manuela", "Hoffe", "9", null, "320 0478711", null, 2, 3, 2],
  ["Hoffer Manuela", "Hoffe", "9/A", null, "320 0478711", null, 3, 6, 2],
  ["Hoffer Alessandra", "Bach", "159", null, "349 6205174", "hofferalessandra@libero.it", 2, 4, 1],
  ["Kratter Anna Maria 1", "Soravia", "23", "0435 469307", null, "ginoannak@libero.it", 2, 3, 1],
  ["Kratter Anna Maria 2", "Soravia", "23", "0435 469307", null, "ginoannak@libero.it", 2, 5, 1],
  ["Kratter Anna Maria 3", "Soravia", "23", "0435 469307", null, null, 3, 6, 1],
  ["Kratter Carolina 1", "Soravia", "47", "0435 66112", "349 7734011", "giulianakratter@gmail.com", 3, 6, 1],
  ["Kratter Carolina 2", "Soravia", "47", "0435 66112", "349 7734011", "giulianakratter@gmail.com", 2, 5, 1],
  ["Kratter Emma 1", "Bach", "70", "0435 469434", null, "fontanakratter@libero.it", 4, 8, 2],
  ["Kratter Emma 2", "Bach", "70", null, null, null, 4, 8, 2],
  ["Kratter Filippo", "Bach", null, null, "328 1516045", "filippokratter@gmail.com", 2, 4, 1],
  ["Kratter Gabriele", "Soravia", "77", "0435 469990", "338 1772100", "kratter2006@yahoo.it", 2, 3, 1],
  ["Kratter Katrin 1", "Mühlbach", "50", "0435 469002", null, "gisport@libero.it", 2, 5, 1],
  ["Kratter Katrin 2", "Mühlbach", "50", "0435 469002", null, "gisport@libero.it", 2, 5, 1],
  ["Kratter Ioannis", "Granvilla", "122", "0435 469421", "340 2990530", "info@sappada.biz", 2, 5, 1],
  ["Kratter Lanner Marisa", "Bach", "42", null, "393 9777007", "valeria.kratter@libero.it", 2, 4, 1],
  ["Kratter Lanner Marisa 2", "Cretta", "42", null, "393 9777007", "valeria.kratter@libero.it", 2, 4, 1],
  ["Kratter Lanner Marisa 3", "Cretta", "42", null, "393 9777007", "valeria.kratter@libero.it", 2, 4, 1],
  ["Kratter Maria 1", "Soravia", "46", "0435 469541", null, "giorgio.puichersoravia@gmail.com", 1, 2, 1],
  ["Kratter Maria 2", "Soravia", "46", "0435 469541", null, "giorgio.puichersoravia@gmail.com", 2, 4, 1],
  ["Kratter Maria 3", "Soravia", "46", "0435 469541", null, "giorgio.puichersoravia@gmail.com", 2, 4, 1],
  ["Kratter Pietro", "Soravia", "77", "0435 469560", null, "kratterpietro@alice.it", 2, 5, 1],
  ["Kratter Renato", "Cima", "126", null, "347 0358339", "renatokratter6@gmail.com", 2, 4, 1],
  ["Kratter Sara 1", "Soravia", "76", null, "333 2392383", "lafattoriadorsola@gmail.com", 3, 6, 1],
  ["Kratter Sara 2", "Soravia", "76", null, null, null, 2, 5, 1],
  ["Kratter Sara 3", "Soravia", "76", null, null, null, 1, 3, 1],
  ["Kratter Thaler Alberto 1", "Granvilla", "82", "0435 469187", "366 3791585", "a.kratterthaler@gmail.com", 2, 4, 1],
  ["Kratter Thaler Alberto 1", "Granvilla", "82", null, null, null, 1, 2, 1],
  ["Kratter Uggeri 1", "Bach", "145", "0435 469102", null, "info@puntosport.it", 2, 4, 1],
  ["Kratter Uggeri 2", "Bach", "145", "0435 469102", null, "info@puntosport.it", 2, 4, 1],
  ["Kratter Uggeri 3", "Bach", "145", "0435 469102", null, "info@puntosport.it", 2, 6, 1],
  ["Kratter Uggeri 4", "Bach", "145", "0435 469102", null, "info@puntosport.it", 2, 6, 1],
  ["Kratter Valerio", "Bach", "74", "0435 469598", "339 6659509", "krattervalerio@yahoo.it", 2, 4, 1],
  ["Mele Giannina", "Bach", null, null, "3471131987", "famigliaquinz@hotmail.com", 2, 4, 1],
  ["Mio Pierluigi", "Bach", "102", null, "340 2410346", "pierluigimio@libero.it", 2, 4, 1],
  ["Modesti Elena", "Lerpa", "171", "0432 50176", "339 8590605", null, 2, 4, 1],
  ["Natolino Franca", "Granvilla", "64", null, "333 3037698", null, 3, 8, 1],
  ["Oberthaler Bruna 1", "Soravia", "93", "0435 469866", null, "oberthalerbruna@libero.it", 2, 4, 1],
  ["Oberthaler Bruna 2", "Soravia", "93", "0435 469866", null, "oberthalerbruna@libero.it", 2, 4, 1],
  ["Orter Silvia", "Bach", "59", null, "338 5736029", "ortersilvia@gmail.com", 2, 6, 1],
  ["Pachner Carolina", "Bach", "140", null, "393 9427749", "monky.benedetti@gmail.com", 2, 4, 1],
  ["Pachner Corona 1", "Pill", "35", "0433 40111", null, "corso.mauri@gmail.com", 2, 4, 1],
  ["Pachner Corona 2", "Pill", "35", "0433 40111", null, "corso.mauri@gmail.com", 2, 4, 1],
  ["Pachner Maria Elisa", "Pill", "29", null, "338 8712356", "ruggero.pachner@gmail.com", 2, 5, 1],
  ["Pachner Maria Elisa", "Pill", "29", null, null, null, 3, 5, 1],
  ["Pascali Luigi", "Palù", "13", null, "348 1468220", "pascali@outlook.it", 3, 7, 2],
  ["Piller Andrea", "Bach", "127", null, "339 5402741", "claudia.bergagnin@libero.it", 2, 4, 1],
  ["Piller Annamaria", "Granvilla", "79", "0435 66084", "334 3503104", "boccingherfranco@alice.it", 2, 4, 1],
  ["Piller Caterina", "Granvilla", "107", null, "320 6618436", null, 2, 6, 2],
  ["Piller Cottrer Agostino", "Granvilla", "76", "0435 1960682", "349 6862358", "francesca.sommavilla@yahoo.it", 3, 7, 2],
  ["Piller Domenico 1", "Granvilla", "40", "0435 469841", "339 645841", "konois@alice.it", 1, 2, 1],
  ["Piller Domenico 2", "Granvilla", "40", "0435 469841", "339 645841", "konois@alice.it", 2, 4, 1],
  ["Piller Roner Giuseppina 1", "Mühlbach", "42", "0435 469146", "389 2122664", "fede.fauner@live.it", 3, 8, 2],
  ["Piller Roner Giuseppina 2", "Mühlbach", "42", "0435 469146", "389 2122664", "fede.fauner@live.it", 2, 5, 2],
  ["Piller Roner Giuseppina 3", "Mühlbach", "42", null, null, null, 3, 7, 2],
  ["Piller Roner Giuseppina 4", "Mühlbach", "42", null, null, null, 3, 8, 2],
  ["Piller Roner Luciano 1", "Fontana", "49", "0435 469617", null, "luciano.pillerroner@libero.it", 2, 5, 2],
  ["Piller Roner Luciano 2", "Fontana", "49", "0435 469617", null, "luciano.pillerroner@libero.it", 2, 5, 2],
  ["Piller Roner Luigi 1", "Soravia", "1", null, "324 0460957", "sappada.app@gmail.com", 3, 6, 1],
  ["Piller Roner Luigi 2", "Soravia", "1", null, "324 0460957", "sappada.app@gmail.com", 2, 4, 1],
  ["Piller Roner Maurizio", "Mühlbach", "8", "0435 469717", "340 8105674", "monica.petris@libero.it", 1, 3, 1],
  ["Piller Roner Pio 1", "Kratten", "19", "0435 469569", "333 2392823", "nicodecandido@libero.it", 2, 5, 1],
  ["Piller Roner Pio 2", "Kratten", "19", "0435 469569", "333 2392823", null, 2, 4, 1],
  ["Piller Roner Renato", "Fontana", "55", "0435 469931", null, "pizzeriadarenato@hotmail.it", 2, 4, 1],
  ["Piller Roner Rosa", "Granvilla", "107", null, "340 8197630", "barbara.boccingher@libero.it", 3, 6, 1],
  ["Piller Roner Tullio 1", "Bach", "133", "0437 940030", "335 5403607", "piller.tu@gmail.com", 2, 4, 1],
  ["Piller Roner Tullio 2", "Bach", "133", null, null, null, 3, 6, 2],
  ["Piller Thomas", "Bach", "56", null, "392 5613311", "pillerthomas@libero.it", 2, 4, 1],
  ["Pomarè Doriana 1", "Mühlbach", "51", "0435 469009", "338 1598284", "sergiopuicher@alice.it", 2, 4, 1],
  ["Pomarè Doriana 2", "Mühlbach", "51", null, null, null, 3, 7, 1],
  ["Pomarè Dorina 1", "Bach", "120", "0435 469529", "370 3017594", "minneci@libero.it", 2, 4, 1],
  ["Pomarè Dorina 2", "Bach", "120", "0435 469529", "370 3017594", "minneci@libero.it", 2, 6, 1],
  ["Pomarè Giuseppe 1", "Granvilla", "85", null, "338 4276750", "pomare.giuseppe@libero.it", 2, 5, 1],
  ["Pomarè Giuseppe 2", "Palù", "45", null, "338 4276750", "pomare.giuseppe@libero.it", 2, 5, 1],
  ["Pomarè Puicher Alberta", "Palù", "42", null, "340 3174675", "raffaella_puicher@yahoo.it", 4, 7, 2],
  ["Pomarè Sandro 1", "Mühlbach", "51", null, "333 2398654", "sandropomare@libero.it", 2, 5, 1],
  ["Pomarè Sandro 2", "Mühlbach", "51", null, "333 2398654", "sandropomare@libero.it", 2, 5, 1],
  ["Puicher Soravia Sergio", "Cima", "119", "0435 469009", "338 1598284", "sergiopuicher@alice.it", 2, 5, 1],
  ["Puicher Soravia Vigilio 1", "Fontana", "37", "0435 66102", "334 1598284", null, 3, 4, 1],
  ["Puicher Soravia Vigilio 2", "Fontana", "37", null, null, null, 3, 4, 1],
  ["Quinz Flora", "Granvilla", "79", "0435 469437", "347 9246847", "puntotre@libero.it", 1, 2, 1],
  ["Quinz Flora 1", "Lerpa", "187", null, "348 2454835", "floraquinz@gmail.com", 3, 4, 1],
  ["Quinz Flora 2", "Lerpa", "187", null, null, null, 3, 5, 1],
  ["Riva Beatrice", "Bach", "80", "0435 469250", "348 7486113", "boccingher.giordano@libero.it", 2, 4, 1],
  ["Rogger Monica", "Hoffe", "25", null, "338 1651897", "monikarogger@libero.it", 3, 5, 1],
  ["Romanin Margherita", "Bach", "101", "0435 469435", "339 6690169", "agnese.q@alice.it", 1, 3, 1],
  ["Romanin Stefania", "Bach", "240", null, "339 6523557", "stefania.romanin@hotmail.it", 2, 4, 1],
  ["Rustico Cretta 1", "Cretta", "25", "0435 469565", "348 7469381", "casasemenzatosappada@gmail.com", 2, 6, 1],
  ["Rustico Cretta 1", "Cretta", "25", null, null, null, 1, 3, 1],
  ["Rustico Cretta 1", "Cretta", "25", "0435 469565", "348 7469381", "casasemenzatosappada@gmail.com", 2, 5, 1],
  ["Sacco Sonador Giuliano 1", "Bach", "37", null, "347 5364149", "app.saccosonador@hotmail.com", 2, 5, 1],
  ["Sacco Sonador Giuliano 2", "Bach", "37", null, "347 5364149", "app.saccosonador@hotmail.com", 2, 5, 1],
  ["Sacco Sonador Giuliano 3", "Bach", "37", null, "347 5364149", "app.saccosonador@hotmail.com", 2, 6, 1],
  ["Sambo Laura", "Fontana", "50", "041 5237246", "335 5931690", "abernath@alice.it", 2, 6, 1],
  ["Sartor Eleonora 1", "Lerpa", "129", "0435 5420176", null, null, 2, 4, 1],
  ["Sartor Eleonora 2", "Lerpa", "129", "0435 5420176", null, null, 1, 2, 1],
  ["Sartor Eliseo", "Bach", "199", "0435 469438", null, "lenameddy95@hotmail.com", 1, 2, 1],
  ["Scaltritti Antonella", "Palù", "13", "040 54273", "333 5328386", "antsclts@gmail.com", 2, 6, 1],
  ["Scano Luciano", "Bach", "95", null, "339 1465696", "iscrio@libero.it", 2, 6, 1],
  ["Schlossar Haus", "Fontana", "16", null, "347 8308614", "martinamichelaph@tiscali.it", 2, 4, 1],
  ["Selenati Nicola", "Soravia", "73", null, "335 7756630", "marydavi73@live.it", 2, 4, 1],
  ["Sfilos Schtellile", "Granvilla", "128", null, "348 3157830", "sfilos@outlook.it", 1, 4, 1],
  ["Solero Idalia 1", "Cima", "101", "0435 33694", "339 1317113", "i.solero@libero.it", 1, 3, 1],
  ["Solero Idalia 2", "Cima", "101", "0435 33694", "339 1317113", "i.solero@libero.it", 2, 4, 1],
  ["Solero Idalia 3", "Cima", "101", "0435 33694", "339 1317113", "i.solero@libero.it", 2, 5, 1],
  ["Solero Idalia 4", "Cima", "101", null, null, null, 3, 6, 1],
  ["Solero Maria Luisa", "Lerpa", "233", "0471 260943", "333 9727468", null, 2, 3, 1],
  ["Solero Romano 1", "Cretta", "24", "0435 66133", null, null, 2, 4, 1],
  ["Solero Romano 2", "Cretta", "24", "0435 66133", null, null, 2, 7, 1],
  ["Solero Stefano", "Fontana", "30", "0435 469017", "347 9000648", "stefanosolero@libero.it", 2, 4, 1],
  ["Sonnehaus", "Soravia", "87", "0435 66025", "346 5735565", "info@sappadavacanze.com", 3, 8, 2],
  ["Stefanini Chiara", "Cima", "20", "051 6141571", "348 7608644", "gianmarco.cavallari@hotmail.it", 2, 5, 1],
  ["Tach Giorgio 1", "Lerpa", "84", "0435 469421", "335 8314174", "info@sappada.biz", 2, 4, 1],
  ["Tach Giorgio 2", "Lerpa", "84", "0435 469421", "335 8314174", "info@sappada.biz", 2, 4, 1],
  ["Tata Quinz Raffaella", "Bach", "47", "0435 469055", "338 1069920", "bobo1973@libero.it", 1, 4, 1],
  ["Vallazza Albina", "Cima", "7", null, "333 9794652", "borgatacima@gmail.com", 2, 4, 1],
  ["Villa Firmina 1", "Cima", "90", "0435 469273", null, "villafirmina@yahoo.it", 1, 3, 1],
  ["Villa Firmina 2", "Cima", "90", null, null, null, 1, 3, 1],
  ["Villa Firmina 3", "Cima", "90", null, null, null, 1, 3, 1],
  ["Villa Firmina 4", "Cima", "90", null, null, null, 1, 3, 1],
  ["Villa Firmina 5", "Cima", "90", null, null, null, 1, 3, 1],
  ["Villa Firmina 6", "Cima", "90", null, null, null, 1, 3, 1],
  ["Villani Gabriella", "Granvilla", "145", "0437 32232", "348 9175961", null, 2, 5, 1],
  ["Zilli Renzo 1", "Granvilla", "97", "0435 469527", "339 6978941", "fam.zilli@libero.it", 2, 4, 1],
  ["Zilli Renzo 2", "Granvilla", "97", "0435 469527", "339 6978941", "fam.zilli@libero.it", 2, 6, 1],
  ["Zilli Renzo 3", "Granvilla", "97", "0435 469527", "339 6978941", "fam.zilli@libero.it", 2, 6, 1],
  ["Casa alle Alpi", "Cima", null, null, "338 8472028", "sportareasappada@libero.it", 16, 34, 16],
]

const AFFITTACAMERE = [
  ["Zimmer in Kratten", "Kratten", "20", null, "339 2250104", "saveri.mario@gmail.com", 1, 3, 1],
]

const RESIDENCE = [
  ["Housemuhlbach Acqua SPA", "Bach", "222", null, "338 3407853", "housemuhlbach@gmail.com", 6, 16, 6],
  ["Residence Cavanis", "Kratten", "1", "0435 469868", "392 3840918", "info@residencecavanis.it", 20, 58, 17],
  ["Maison Boutique Fior d'Alpe", "Soravia", "25", null, "324 806 1492", "info@fiordalpesappada.it", null, null, null],
]

const AGENZIE = [
  ["Agenzia Dorf", "Palù", "8", "0435 469493", "348 3351066", "info@dorf.it", null, null, null],
  ["Agenzia Cori", "Palù", "7", "0435 469780", "371 3107634", "agenziacorisappada@gmail.com", null, null, null],
  ["Immobiliare Lungo Piave", "Palù", "39", "0422 855770", null, "lungopiave@gmail.com", null, null, null],
]

const CONSORZI = [
  ["Consorzio Sappada Dolomiti", "Bach", "41", null, "375 5330302", "info@sappadadolomiti.com", null, null, null],
]

const groups = [
  ["Appartamento", APPARTAMENTI],
  ["Affittacamere", AFFITTACAMERE],
  ["Residence", RESIDENCE],
  ["Agenzia", AGENZIE],
  ["Consorzio", CONSORZI],
]

const ws = await prisma.workspace.findUnique({ where: { id: WS }, select: { name: true } })
if (!ws) {
  console.error(`Workspace ${WS} not found on this database — aborting, nothing written.`)
  process.exit(1)
}
console.log(`Importing into workspace "${ws.name}" (${WS})`)

let order = 1
let created = 0
let skipped = 0
for (const [category, rows] of groups) {
  for (const [name, location, streetNumber, phone, mobile, email, rooms, beds, bathrooms] of rows) {
    // The official list prints the same name once per unit (e.g. "Rustico
    // Cretta 1" three times) — dedup on the full identifying tuple, not name
    // alone, so a re-run skips exactly what it already wrote.
    const existing = await prisma.touristApartment.findFirst({
      where: { workspaceId: WS, name, location, rooms, beds, bathrooms },
    })
    if (existing) {
      skipped++
      order++
      continue
    }
    await prisma.touristApartment.create({
      data: {
        workspaceId: WS,
        name,
        category,
        location,
        streetNumber,
        phone,
        mobile,
        email,
        rooms,
        beds,
        bathrooms,
        order: order++,
        isActive: true,
      },
    })
    created++
  }
}
console.log(`Done: ${created} created, ${skipped} already present.`)
await prisma.$disconnect()
