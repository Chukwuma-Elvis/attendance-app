import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

async function main() {
  const backupsDir = path.join(process.cwd(), "backups");
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `backup-${timestamp}.json`;
  const filePath = path.join(backupsDir, fileName);

  console.log("📦 Starting offline database backup...");

  const [
    departments,
    penaltyRules,
    employees,
    attendance,
    infractions,
    adminAccounts,
    pendingChanges,
    biometricCredentials,
  ] = await Promise.all([
    prisma.department.findMany(),
    prisma.penaltyRule.findMany(),
    prisma.employee.findMany(),
    prisma.attendance.findMany(),
    prisma.infraction.findMany(),
    prisma.adminAccount.findMany(),
    prisma.pendingChange.findMany(),
    prisma.biometricCredential.findMany(),
  ]);

  const serializedBiometrics = biometricCredentials.map((b) => ({
    ...b,
    publicKey: Buffer.from(b.publicKey).toString("base64"),
    counter: b.counter.toString(),
  }));

  const backupData = {
    version: "1.0",
    createdAt: new Date().toISOString(),
    stats: {
      departments: departments.length,
      penaltyRules: penaltyRules.length,
      employees: employees.length,
      attendance: attendance.length,
      infractions: infractions.length,
      adminAccounts: adminAccounts.length,
      pendingChanges: pendingChanges.length,
      biometricCredentials: biometricCredentials.length,
    },
    data: {
      departments,
      penaltyRules,
      employees,
      attendance,
      infractions,
      adminAccounts,
      pendingChanges,
      biometricCredentials: serializedBiometrics,
    },
  };

  const serializeBigInt = (_key: string, value: any) =>
    typeof value === "bigint" ? value.toString() : value;

  fs.writeFileSync(filePath, JSON.stringify(backupData, serializeBigInt, 2), "utf-8");

  console.log(`\n✅ Backup successfully created!`);
  console.log(`📁 File location: ${filePath}`);
  console.log(`📊 Backup Summary:`);
  console.log(`   - Departments:          ${departments.length}`);
  console.log(`   - Employees:            ${employees.length}`);
  console.log(`   - Attendance Records:   ${attendance.length}`);
  console.log(`   - Infractions:          ${infractions.length}`);
  console.log(`   - Penalty Rules:        ${penaltyRules.length}`);
  console.log(`   - Admin Accounts:       ${adminAccounts.length}`);
  console.log(`   - Biometric Credentials:${biometricCredentials.length}`);

  // Enforce retention policy: keep only the 3 newest backups, remove older ones
  const MAX_BACKUPS = 3;
  const backupFiles = fs
    .readdirSync(backupsDir)
    .filter((file) => file.startsWith("backup-") && file.endsWith(".json"))
    .map((file) => {
      const fullPath = path.join(backupsDir, file);
      return {
        file,
        fullPath,
        time: fs.statSync(fullPath).mtimeMs,
      };
    })
    .sort((a, b) => b.time - a.time); // Newest first

  if (backupFiles.length > MAX_BACKUPS) {
    const toRemove = backupFiles.slice(MAX_BACKUPS);
    console.log(`\n🧹 Retention policy (max ${MAX_BACKUPS} backups):`);
    for (const item of toRemove) {
      try {
        fs.unlinkSync(item.fullPath);
        console.log(`   - Deleted oldest backup: ${item.file}`);
      } catch (err) {
        console.warn(`   - Failed to delete ${item.file}:`, err);
      }
    }
  }

  console.log(`📦 Currently retained backups: ${Math.min(backupFiles.length, MAX_BACKUPS)} of ${MAX_BACKUPS}\n`);
}

main()
  .catch((e) => {
    console.error("Backup failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
