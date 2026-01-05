-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN     "botIdentityResponse" TEXT,
ADD COLUMN     "hasHumanSupport" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "hasSalesAgents" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "humanSupportInstructions" TEXT,
ADD COLUMN     "operatorContactMethod" TEXT DEFAULT 'email',
ADD COLUMN     "operatorWhatsappNumber" TEXT,
ADD COLUMN     "sellsProducts" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "sellsServices" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "toneOfVoice" TEXT DEFAULT 'friendly';
