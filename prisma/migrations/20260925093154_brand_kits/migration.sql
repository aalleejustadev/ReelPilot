-- CreateTable
CREATE TABLE "brand_kits" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "audience" TEXT NOT NULL DEFAULT '',
    "features" TEXT[],
    "pricingSummary" TEXT,
    "bannedWords" TEXT[],
    "logoKey" TEXT,
    "colors" JSONB NOT NULL DEFAULT '{}',
    "fonts" JSONB NOT NULL DEFAULT '{}',
    "tone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_kits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "allowed_claims" (
    "id" TEXT NOT NULL,
    "brandKitId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "text" TEXT NOT NULL,
    "sourceUrl" TEXT,

    CONSTRAINT "allowed_claims_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "brand_kits_workspaceId_createdAt_idx" ON "brand_kits"("workspaceId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "allowed_claims_brandKitId_position_key" ON "allowed_claims"("brandKitId", "position");

-- AddForeignKey
ALTER TABLE "brand_kits" ADD CONSTRAINT "brand_kits_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "allowed_claims" ADD CONSTRAINT "allowed_claims_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "brand_kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
