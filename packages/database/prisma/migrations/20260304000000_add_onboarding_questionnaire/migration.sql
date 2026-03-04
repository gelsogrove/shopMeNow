-- CreateTable
CREATE TABLE "onboarding_questionnaires" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "company" TEXT,
    "stepChannel" TEXT NOT NULL,
    "stepTimeSaving" TEXT NOT NULL,
    "stepEcommerce" TEXT NOT NULL,
    "stepDocuments" TEXT NOT NULL,
    "stepIntegration" TEXT NOT NULL,
    "stepHandoff" TEXT NOT NULL,
    "stepMarketing" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "adminNotes" TEXT,

    CONSTRAINT "onboarding_questionnaires_pkey" PRIMARY KEY ("id")
);
