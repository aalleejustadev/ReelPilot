-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('QUEUED', 'RENDERING', 'READY', 'FAILED');

-- CreateTable
CREATE TABLE "exports" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "footageId" TEXT,
    "projectId" TEXT,
    "shape" TEXT NOT NULL,
    "status" "ExportStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "name" TEXT NOT NULL,
    "fileKey" TEXT,
    "sizeBytes" INTEGER,
    "durationMs" INTEGER,
    "fingerprint" TEXT,
    "errorMessage" TEXT,
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "footageId" TEXT,
    "projectId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "exports_footageId_shape_idx" ON "exports"("footageId", "shape");

-- CreateIndex
CREATE INDEX "exports_projectId_shape_idx" ON "exports"("projectId", "shape");

-- CreateIndex
CREATE INDEX "exports_workspaceId_idx" ON "exports"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_token_key" ON "share_links"("token");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_footageId_key" ON "share_links"("footageId");

-- CreateIndex
CREATE UNIQUE INDEX "share_links_projectId_key" ON "share_links"("projectId");

-- CreateIndex
CREATE INDEX "share_links_workspaceId_idx" ON "share_links"("workspaceId");

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_footageId_fkey" FOREIGN KEY ("footageId") REFERENCES "footage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_footageId_fkey" FOREIGN KEY ("footageId") REFERENCES "footage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Each export and share link is of exactly one clip or one video.
ALTER TABLE "exports" ADD CONSTRAINT "exports_one_target" CHECK (num_nonnulls("footageId", "projectId") = 1);
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_one_target" CHECK (num_nonnulls("footageId", "projectId") = 1);
