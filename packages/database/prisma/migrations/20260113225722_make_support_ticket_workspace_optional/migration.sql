-- DropForeignKey
ALTER TABLE "support_tickets" DROP CONSTRAINT "support_tickets_workspaceId_fkey";

-- AlterTable
ALTER TABLE "support_tickets" ALTER COLUMN "workspaceId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
