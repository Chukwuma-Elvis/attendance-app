-- CreateEnum
CREATE TYPE "PendingChangeKind" AS ENUM ('ATTENDANCE', 'INFRACTION', 'PENALTY_RULE');

-- CreateEnum
CREATE TYPE "PendingChangeStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "pending_changes" (
    "id" TEXT NOT NULL,
    "kind" "PendingChangeKind" NOT NULL,
    "summary" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "PendingChangeStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,

    CONSTRAINT "pending_changes_pkey" PRIMARY KEY ("id")
);
