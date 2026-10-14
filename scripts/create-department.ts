import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

const defaultPenaltyRules = [
  { key: "LATE", label: "Lateness", amount: 10000 },
  { key: "ABSENT", label: "Absence", amount: 50000 },
  { key: "MINOR_INFRACTION", label: "Infraction", amount: 10000 },
  { key: "MAJOR_INFRACTION", label: "Major Infraction", amount: 50000 },
  { key: "MISCELLANEOUS", label: "Miscellaneous Deduction", amount: 0 },
];

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("\nUsage to create a new department:");
    console.log("  npm run department:create -- <department-name> [admin-username] [admin-password]\n");
    console.log("Examples:");
    console.log('  npm run department:create -- "Zaza"');
    console.log('  npm run department:create -- "Zaza" zaza-admin "Password123!"\n');
    return;
  }

  const deptName = args[0].trim();
  const adminUsername = args[1]?.trim();
  const adminPassword = args[2]?.trim();

  // 1. Create or find department
  let department = await prisma.department.findUnique({
    where: { name: deptName },
  });

  if (department) {
    console.log(`\nDepartment "${deptName}" already exists (ID: ${department.id}).`);
  } else {
    department = await prisma.department.create({
      data: { name: deptName },
    });
    console.log(`\n✅ Department "${department.name}" created successfully (ID: ${department.id})!`);
  }

  // 2. Ensure default penalty rules exist
  for (const rule of defaultPenaltyRules) {
    await prisma.penaltyRule.upsert({
      where: {
        departmentId_key: { departmentId: department.id, key: rule.key },
      },
      update: {},
      create: { ...rule, departmentId: department.id },
    });
  }
  console.log(`✅ Default penalty rules initialized for "${department.name}".`);

  // 3. Optional admin account creation
  if (adminUsername && adminPassword) {
    const existingAdmin = await prisma.adminAccount.findUnique({
      where: { username: adminUsername },
    });

    if (existingAdmin) {
      console.log(`⚠️ Admin username "${adminUsername}" already exists, skipped admin account creation.`);
    } else {
      const admin = await prisma.adminAccount.create({
        data: {
          username: adminUsername,
          passwordHash: hashPassword(adminPassword),
          role: "OWNER",
          departmentId: department.id,
        },
      });
      console.log(`✅ Admin account "${admin.username}" created for "${department.name}".`);
    }
  }

  console.log(`\n🎉 All set! "${department.name}" is now active in the system and will appear on the Check-in portal.\n`);
}

main()
  .catch((e) => {
    console.error("Error creating department:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
