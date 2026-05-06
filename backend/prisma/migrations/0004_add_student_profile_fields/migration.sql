-- AlterTable
ALTER TABLE "User" ADD COLUMN     "studentId" TEXT,
ADD COLUMN     "batch" TEXT,
ADD COLUMN     "department" TEXT,
ADD COLUMN     "section" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_studentId_key" ON "User"("studentId");
