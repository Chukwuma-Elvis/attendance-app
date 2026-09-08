-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ASSISTANT');

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "departments_name_key" ON "departments"("name");

-- CreateTable
CREATE TABLE "admin_accounts" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL,
    "departmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_accounts_username_key" ON "admin_accounts"("username");

-- AddForeignKey
ALTER TABLE "admin_accounts" ADD CONSTRAINT "admin_accounts_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable employees: add nullable departmentId + FK
ALTER TABLE "employees" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "employees" ADD CONSTRAINT "employees_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable penalty_rules: add nullable departmentId + FK, replace unique(key) with unique(departmentId, key)
DROP INDEX "penalty_rules_key_key";
ALTER TABLE "penalty_rules" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "penalty_rules" ADD CONSTRAINT "penalty_rules_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE UNIQUE INDEX "penalty_rules_departmentId_key_key" ON "penalty_rules"("departmentId", "key");

-- AlterTable pending_changes: add nullable departmentId + FK
ALTER TABLE "pending_changes" ADD COLUMN "departmentId" TEXT;
ALTER TABLE "pending_changes" ADD CONSTRAINT "pending_changes_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
