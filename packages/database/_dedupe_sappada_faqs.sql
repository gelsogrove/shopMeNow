-- FAQ / structured-content deduplication for demosappada (Andrea, 2026-09-01:
-- "abbiamo messo le strutture sportive quindi va tolto da faq, e così con
-- tutti i record: non voglio doppioni" + "devi aggiustare con sql").
--
-- Run in the Supabase SQL editor against PRODUCTION.
-- Workspace: demosappada = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'.
--
-- ALWAYS run the SELECT (dry-run) first and read the list; only then run the
-- DELETE, which uses the exact same predicate. Matching is data-driven: a FAQ
-- is a duplicate when the NAME of a record in one of the 8 structured tables
-- appears (case-insensitive) in the FAQ's question or answer. Names shorter
-- than 5 characters are skipped as too generic.

-- ============================================================
-- 1) DRY-RUN — list the FAQs that duplicate a structured record
-- ============================================================
WITH records AS (
  SELECT 'Ristoranti' AS tabella, name AS record_name
    FROM tourist_restaurants WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Alberghi', name
    FROM tourist_hotels WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Escursioni', name
    FROM tourist_excursions WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Rifugi', name
    FROM tourist_refuges WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Case e appartamenti', name
    FROM tourist_apartments WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Eventi', title
    FROM tourist_events WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Strutture sportive', name
    FROM tourist_sports_facilities WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Impianti di sci', name
    FROM tourist_ski_facilities WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
)
SELECT f.id, f.question, r.tabella, r.record_name
FROM faqs f
JOIN records r
  ON length(r.record_name) >= 5
 AND (lower(f.question) LIKE '%' || lower(r.record_name) || '%'
   OR lower(f.answer)   LIKE '%' || lower(r.record_name) || '%')
WHERE f."workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
ORDER BY r.tabella, f.question;

-- ============================================================
-- 2) DELETE — same predicate as the dry-run above.
--    Run ONLY after reviewing the dry-run output.
-- ============================================================
-- WITH records AS (
--   SELECT name AS record_name
--     FROM tourist_restaurants WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
--   UNION ALL SELECT name FROM tourist_hotels WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
--   UNION ALL SELECT name FROM tourist_excursions WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
--   UNION ALL SELECT name FROM tourist_refuges WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
--   UNION ALL SELECT name FROM tourist_apartments WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
--   UNION ALL SELECT title FROM tourist_events WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
--   UNION ALL SELECT name FROM tourist_sports_facilities WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
--   UNION ALL SELECT name FROM tourist_ski_facilities WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
-- )
-- DELETE FROM faqs f
-- WHERE f."workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
--   AND EXISTS (
--     SELECT 1 FROM records r
--     WHERE length(r.record_name) >= 5
--       AND (lower(f.question) LIKE '%' || lower(r.record_name) || '%'
--         OR lower(f.answer)   LIKE '%' || lower(r.record_name) || '%')
--   );

-- ============================================================
-- 3) CROSS-TABLE overlaps — LISTING ONLY, never auto-delete.
--    E.g. "Malga Geu da Malga Tuglia" (Escursioni) contains
--    "Malga Tuglia" (Rifugi): route vs structure — often BOTH
--    are legitimate. Review and delete by hand from the
--    backoffice only the rows that are true duplicates.
-- ============================================================
WITH records AS (
  SELECT 'Ristoranti' AS tabella, id, name AS record_name
    FROM tourist_restaurants WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Alberghi', id, name
    FROM tourist_hotels WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Escursioni', id, name
    FROM tourist_excursions WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Rifugi', id, name
    FROM tourist_refuges WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Case e appartamenti', id, name
    FROM tourist_apartments WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Eventi', id, title
    FROM tourist_events WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Strutture sportive', id, name
    FROM tourist_sports_facilities WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
  UNION ALL SELECT 'Impianti di sci', id, name
    FROM tourist_ski_facilities WHERE "workspaceId" = '7ba9d5ac-21bf-48bc-bfce-4fb0b838f55c'
)
SELECT a.tabella AS tabella_a, a.record_name AS record_a,
       b.tabella AS tabella_b, b.record_name AS record_b
FROM records a
JOIN records b
  ON a.id <> b.id
 AND length(b.record_name) >= 5
 AND lower(a.record_name) LIKE '%' || lower(b.record_name) || '%'
ORDER BY b.record_name, a.tabella;
