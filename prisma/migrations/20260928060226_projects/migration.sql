-- AlterTable
ALTER TABLE "footage" ADD COLUMN     "presentationVersion" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "projects" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "brandKitId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_clips" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "footageId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "transition" JSONB NOT NULL,

    CONSTRAINT "project_clips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "projects_workspaceId_updatedAt_idx" ON "projects"("workspaceId", "updatedAt");

-- CreateIndex
CREATE INDEX "projects_brandKitId_idx" ON "projects"("brandKitId");

-- CreateIndex
CREATE INDEX "project_clips_projectId_position_idx" ON "project_clips"("projectId", "position");

-- CreateIndex
CREATE INDEX "project_clips_footageId_idx" ON "project_clips"("footageId");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_brandKitId_fkey" FOREIGN KEY ("brandKitId") REFERENCES "brand_kits"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_clips" ADD CONSTRAINT "project_clips_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_clips" ADD CONSTRAINT "project_clips_footageId_fkey" FOREIGN KEY ("footageId") REFERENCES "footage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
