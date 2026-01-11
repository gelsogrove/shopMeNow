DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'invoice_adjustments'
  ) THEN
    CREATE TABLE "invoice_adjustments" (
      "id" TEXT NOT NULL,
      "invoiceId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "amount" DECIMAL(10,2) NOT NULL,
      "reason" TEXT,
      "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdById" TEXT,
      "createdByEmail" TEXT,
      CONSTRAINT "invoice_adjustments_pkey" PRIMARY KEY ("id")
    );

    CREATE INDEX "invoice_adjustments_invoiceId_idx" ON "invoice_adjustments"("invoiceId");
    CREATE INDEX "invoice_adjustments_userId_idx" ON "invoice_adjustments"("userId");

    ALTER TABLE "invoice_adjustments"
      ADD CONSTRAINT "invoice_adjustments_invoiceId_fkey"
      FOREIGN KEY ("invoiceId") REFERENCES "monthly_invoices"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;

    ALTER TABLE "invoice_adjustments"
      ADD CONSTRAINT "invoice_adjustments_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
