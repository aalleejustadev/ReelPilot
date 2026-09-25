-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "personalOwnerId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_personalOwnerId_key" ON "workspaces"("personalOwnerId");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_personalOwnerId_fkey" FOREIGN KEY ("personalOwnerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

