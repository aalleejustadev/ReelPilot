-- CreateEnum
CREATE TYPE "FootageStatus" AS ENUM ('UPLOADING', 'PROCESSING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "FootageSource" AS ENUM ('UPLOAD', 'RECORDING');

-- CreateEnum
CREATE TYPE "MarkerSource" AS ENUM ('AUTO', 'MANUAL');

-- CreateTable
CREATE TABLE "footage" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandKitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "source" "FootageSource" NOT NULL,
    "status" "FootageStatus" NOT NULL DEFAULT 'UPLOADING',
    "originalKey" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "videoKey" TEXT,
    "posterKey" TEXT,
    "thumbnailsKey" TEXT,
    "thumbnailCount" INTEGER,
    "thumbnailIntervalMs" INTEGER,
    "durationMs" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "errorMessage" TEXT,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "footage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "footage_markers" (
    "id" TEXT NOT NULL,
    "footageId" TEXT NOT NULL,
    "atMs" INTEGER NOT NULL,
    "label" TEXT,
    "source" "MarkerSource" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "footage_markers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "footage_brandKitId_createdAt_idx" ON "footage"("brandKitId", "createdAt");

-- CreateIndex
CREATE INDEX "footage_workspaceId_idx" ON "footage"("workspaceId");

-- CreateIndex
CREATE INDEX "footage_status_createdAt_idx" ON "footage"("status", "createdAt");

-- CreateIndex
CREATE INDEX "footage_markers_footageId_atMs_idx" ON "footage_markers"("footageId", "atMs");

-- AddForeignKey
ALTER TABLE "footage" ADD CONSTRAINT "footage_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "footage" ADD CONSTRAINT "footage_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "brand_kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "footage_markers" ADD CONSTRAINT "footage_markers_footageId_fkey" FOREIGN KEY ("footageId") REFERENCES "footage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
