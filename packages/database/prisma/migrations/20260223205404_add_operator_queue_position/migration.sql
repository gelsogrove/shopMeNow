-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "operatorQueueEnteredAt" TIMESTAMP(3),
ADD COLUMN     "operatorQueuePosition" INTEGER;
