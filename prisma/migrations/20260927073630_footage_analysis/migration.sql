-- CreateEnum
CREATE TYPE "FootageAnalysisStatus" AS ENUM ('PENDING', 'RUNNING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "footage" ADD COLUMN     "analysis" JSONB,
ADD COLUMN     "analysisStatus" "FootageAnalysisStatus",
ADD COLUMN     "recording" JSONB;

-- AlterTable
ALTER TABLE "footage_markers" ADD COLUMN     "insight" JSONB;
