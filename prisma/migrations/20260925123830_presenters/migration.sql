-- CreateTable
CREATE TABLE "presenters" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "voiceId" TEXT NOT NULL,
    "tags" TEXT[],
    "portraitKey" TEXT,
    "sampleKey" TEXT,
    "sampleDurationMs" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "presenters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "presenters_slug_key" ON "presenters"("slug");

-- CreateIndex
CREATE INDEX "presenters_isActive_sortOrder_idx" ON "presenters"("isActive", "sortOrder");
