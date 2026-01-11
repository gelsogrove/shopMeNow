CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 1 INCREMENT BY 1;

WITH ordered AS (
  SELECT
    id,
    TO_CHAR(COALESCE("paidAt", "createdAt")::date, 'YYYYMMDD') AS date_str,
    ROW_NUMBER() OVER (ORDER BY COALESCE("paidAt", "createdAt"), id) AS rn
  FROM "monthly_invoices"
  WHERE status = 'PAID'
)
UPDATE "monthly_invoices" mi
SET "invoiceNumber" = ordered.date_str || '-' || LPAD(ordered.rn::text, 4, '0')
FROM ordered
WHERE mi.id = ordered.id;

SELECT setval(
  'invoice_number_seq',
  COALESCE(
    (
      SELECT MAX(rn)
      FROM (
        SELECT ROW_NUMBER() OVER (ORDER BY COALESCE("paidAt", "createdAt"), id) AS rn
        FROM "monthly_invoices"
        WHERE status = 'PAID'
      ) AS seq
    ),
    0
  ),
  true
);
