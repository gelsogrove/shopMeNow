-- AlterTable
ALTER TABLE "monthly_invoices" ADD COLUMN     "creditNotesTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "subtotalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxRate" DECIMAL(5,4) NOT NULL DEFAULT 0.22;

-- CreateTable
CREATE TABLE "invoice_credit_notes" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,
    "createdByEmail" TEXT,

    CONSTRAINT "invoice_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_credit_notes_invoiceId_idx" ON "invoice_credit_notes"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_credit_notes_userId_idx" ON "invoice_credit_notes"("userId");

-- AddForeignKey
ALTER TABLE "invoice_credit_notes" ADD CONSTRAINT "invoice_credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "monthly_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_credit_notes" ADD CONSTRAINT "invoice_credit_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
