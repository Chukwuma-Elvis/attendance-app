import fs from "fs";
import path from "path";
import { prisma } from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);
  const backupsDir = path.join(process.cwd(), "backups");

  if (args.length === 0) {
    if (fs.existsSync(backupsDir)) {
      const files = fs
        .readdirSync(backupsDir)
        .filter((f) => f.endsWith(".json"))
        .sort()
        .reverse();

      if (files.length > 0) {
        console.log("\nAvailable backup files in backups/:");
        for (const file of files) {
          console.log(`- ${file}`);
        }
        console.log(`\nUsage to restore a backup:`);
        console.log(`  npm run db:restore -- backups/${files[0]}\n`);
        return;
      }
    }

    console.log("\nUsage:");
    console.log("  npm run db:restore -- <path-to-backup.json>\n");
    return;
  }

  const targetPath = path.resolve(process.cwd(), args[0]);

  if (!fs.existsSync(targetPath)) {
    console.error(`\nError: Backup file not found at "${targetPath}".\n`);
    process.exit(1);
  }

  const raw = fs.readFileSync(targetPath, "utf-8");
  const backup = JSON.parse(raw);

  if (!backup.data || !backup.data.departments) {
    console.error("\nError: Invalid backup file format.\n");
    process.exit(1);
  }

  console.log(`\n🔄 Restoring data from: ${path.basename(targetPath)}`);
  console.log(`📅 Backup created at: ${backup.createdAt}\n`);

  const {
    departments = [],
    penaltyRules = [],
    employees = [],
    attendance = [],
    infractions = [],
    adminAccounts = [],
    pendingChanges = [],
    biometricCredentials = [],
  } = backup.data;

  // 1. Departments
  for (const d of departments) {
    await prisma.department.upsert({
      where: { id: d.id },
      update: {
        name: d.name,
        venueName: d.venueName ?? null,
        venueLatitude: d.venueLatitude ?? null,
        venueLongitude: d.venueLongitude ?? null,
        venueRadiusMeters: d.venueRadiusMeters ?? 100,
        checkInStartTime: d.checkInStartTime,
        checkInCutoffTime: d.checkInCutoffTime,
        checkInEndTime: d.checkInEndTime,
        checkOutStartTime: d.checkOutStartTime,
        checkOutEndTime: d.checkOutEndTime,
      },
      create: {
        id: d.id,
        name: d.name,
        venueName: d.venueName ?? null,
        venueLatitude: d.venueLatitude ?? null,
        venueLongitude: d.venueLongitude ?? null,
        venueRadiusMeters: d.venueRadiusMeters ?? 100,
        checkInStartTime: d.checkInStartTime,
        checkInCutoffTime: d.checkInCutoffTime,
        checkInEndTime: d.checkInEndTime,
        checkOutStartTime: d.checkOutStartTime,
        checkOutEndTime: d.checkOutEndTime,
        createdAt: new Date(d.createdAt),
      },
    });
  }
  console.log(`✅ Restored ${departments.length} departments.`);

  // 2. Penalty Rules
  for (const r of penaltyRules) {
    await prisma.penaltyRule.upsert({
      where: { id: r.id },
      update: {
        key: r.key,
        label: r.label,
        amount: r.amount,
        departmentId: r.departmentId,
      },
      create: {
        id: r.id,
        key: r.key,
        label: r.label,
        amount: r.amount,
        departmentId: r.departmentId,
      },
    });
  }
  console.log(`✅ Restored ${penaltyRules.length} penalty rules.`);

  // 3. Employees
  for (const e of employees) {
    await prisma.employee.upsert({
      where: { id: e.id },
      update: {
        name: e.name,
        role: e.role,
        departmentId: e.departmentId,
        active: Boolean(e.active),
        workingDays: e.workingDays || [0, 1, 2, 3, 4, 5, 6],
        biometricResetRequested: Boolean(e.biometricResetRequested),
        biometricResetAllowed: Boolean(e.biometricResetAllowed),
        customCheckInStartTime: e.customCheckInStartTime ?? null,
        customCheckInCutoffTime: e.customCheckInCutoffTime ?? null,
        customCheckInEndTime: e.customCheckInEndTime ?? null,
        customCheckOutStartTime: e.customCheckOutStartTime ?? null,
        customCheckOutEndTime: e.customCheckOutEndTime ?? null,
        pinCheckInAllowed: Boolean(e.pinCheckInAllowed),
        pinHash: e.pinHash ?? null,
      },
      create: {
        id: e.id,
        name: e.name,
        role: e.role,
        departmentId: e.departmentId,
        active: Boolean(e.active),
        workingDays: e.workingDays || [0, 1, 2, 3, 4, 5, 6],
        biometricResetRequested: Boolean(e.biometricResetRequested),
        biometricResetAllowed: Boolean(e.biometricResetAllowed),
        customCheckInStartTime: e.customCheckInStartTime ?? null,
        customCheckInCutoffTime: e.customCheckInCutoffTime ?? null,
        customCheckInEndTime: e.customCheckInEndTime ?? null,
        customCheckOutStartTime: e.customCheckOutStartTime ?? null,
        customCheckOutEndTime: e.customCheckOutEndTime ?? null,
        pinCheckInAllowed: Boolean(e.pinCheckInAllowed),
        pinHash: e.pinHash ?? null,
        createdAt: new Date(e.createdAt),
      },
    });
  }
  console.log(`✅ Restored ${employees.length} employees.`);

  // 4. Biometric Credentials
  for (const b of biometricCredentials) {
    await prisma.biometricCredential.upsert({
      where: { id: b.id },
      update: {
        credentialId: b.credentialId,
        publicKey: Buffer.from(b.publicKey, "base64"),
        counter: BigInt(b.counter),
        deviceType: b.deviceType ?? null,
        deviceName: b.deviceName ?? null,
        backedUp: Boolean(b.backedUp),
        transports: b.transports || [],
        employeeId: b.employeeId,
      },
      create: {
        id: b.id,
        credentialId: b.credentialId,
        publicKey: Buffer.from(b.publicKey, "base64"),
        counter: BigInt(b.counter),
        deviceType: b.deviceType ?? null,
        deviceName: b.deviceName ?? null,
        backedUp: Boolean(b.backedUp),
        transports: b.transports || [],
        employeeId: b.employeeId,
        createdAt: new Date(b.createdAt),
      },
    });
  }
  console.log(`✅ Restored ${biometricCredentials.length} biometric credentials.`);

  // 5. Attendance
  for (const a of attendance) {
    await prisma.attendance.upsert({
      where: { id: a.id },
      update: {
        status: a.status,
        note: a.note ?? null,
        checkInTime: a.checkInTime ? new Date(a.checkInTime) : null,
        checkOutTime: a.checkOutTime ? new Date(a.checkOutTime) : null,
        checkInLat: a.checkInLat ?? null,
        checkInLng: a.checkInLng ?? null,
        checkOutLat: a.checkOutLat ?? null,
        checkOutLng: a.checkOutLng ?? null,
        checkInMethod: a.checkInMethod ?? null,
        checkOutMethod: a.checkOutMethod ?? null,
      },
      create: {
        id: a.id,
        date: new Date(a.date),
        status: a.status,
        note: a.note ?? null,
        checkInTime: a.checkInTime ? new Date(a.checkInTime) : null,
        checkOutTime: a.checkOutTime ? new Date(a.checkOutTime) : null,
        checkInLat: a.checkInLat ?? null,
        checkInLng: a.checkInLng ?? null,
        checkOutLat: a.checkOutLat ?? null,
        checkOutLng: a.checkOutLng ?? null,
        checkInMethod: a.checkInMethod ?? null,
        checkOutMethod: a.checkOutMethod ?? null,
        employeeId: a.employeeId,
        createdAt: new Date(a.createdAt),
      },
    });
  }
  console.log(`✅ Restored ${attendance.length} attendance records.`);

  // 6. Infractions
  for (const inf of infractions) {
    await prisma.infraction.upsert({
      where: { id: inf.id },
      update: {
        type: inf.type,
        description: inf.description ?? null,
        amount: Number(inf.amount),
        employeeId: inf.employeeId,
      },
      create: {
        id: inf.id,
        date: new Date(inf.date),
        type: inf.type,
        description: inf.description ?? null,
        amount: Number(inf.amount),
        employeeId: inf.employeeId,
        createdAt: new Date(inf.createdAt),
      },
    });
  }
  console.log(`✅ Restored ${infractions.length} infractions.`);

  // 7. Admin Accounts
  for (const acc of adminAccounts) {
    await prisma.adminAccount.upsert({
      where: { id: acc.id },
      update: {
        username: acc.username,
        passwordHash: acc.passwordHash,
        role: acc.role,
        departmentId: acc.departmentId,
      },
      create: {
        id: acc.id,
        username: acc.username,
        passwordHash: acc.passwordHash,
        role: acc.role,
        departmentId: acc.departmentId,
        createdAt: new Date(acc.createdAt),
      },
    });
  }
  console.log(`✅ Restored ${adminAccounts.length} admin accounts.`);

  // 8. Pending Changes
  for (const p of pendingChanges) {
    await prisma.pendingChange.upsert({
      where: { id: p.id },
      update: {
        kind: p.kind,
        status: p.status,
        requestedBy: p.requestedBy,
        summary: p.summary,
        payload: p.payload,
        resolvedBy: p.resolvedBy ?? null,
        resolvedAt: p.resolvedAt ? new Date(p.resolvedAt) : null,
        departmentId: p.departmentId,
      },
      create: {
        id: p.id,
        kind: p.kind,
        status: p.status,
        requestedBy: p.requestedBy,
        summary: p.summary,
        payload: p.payload,
        resolvedBy: p.resolvedBy ?? null,
        resolvedAt: p.resolvedAt ? new Date(p.resolvedAt) : null,
        departmentId: p.departmentId,
        createdAt: new Date(p.createdAt),
      },
    });
  }
  console.log(`✅ Restored ${pendingChanges.length} pending changes.`);

  console.log(`\n🎉 Full database restore complete! Everything is back in place.\n`);
}

main()
  .catch((e) => {
    console.error("Restore failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
