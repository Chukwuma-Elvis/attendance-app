-- Now that every row has been backfilled with a departmentId, make it required.
ALTER TABLE "employees" ALTER COLUMN "departmentId" SET NOT NULL;
ALTER TABLE "penalty_rules" ALTER COLUMN "departmentId" SET NOT NULL;
ALTER TABLE "pending_changes" ALTER COLUMN "departmentId" SET NOT NULL;
