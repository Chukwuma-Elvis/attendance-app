import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2) {
    console.log("\nUsage to create a new admin/manager account:");
    console.log("  npx tsx scripts/create-account.ts <username> <password> [role] [department-name]\n");
    console.log("Parameters:");
    console.log("  username:        Your desired login username (e.g. 'admin')");
    console.log("  password:        Your desired login password");
    console.log("  role:            'OWNER' (default, Manager) or 'ASSISTANT'");
    console.log("  department-name: Team name (defaults to first department found or 'Lulu Entertainment')\n");
    return;
  }

  const [username, password, roleArg = "OWNER", deptArg] = args;
  const role = roleArg.toUpperCase() === "ASSISTANT" ? "ASSISTANT" : "OWNER";

  // Find or create department
  let department = deptArg
    ? await prisma.department.findUnique({ where: { name: deptArg } })
    : await prisma.department.findFirst();

  if (!department) {
    const deptName = deptArg || "Lulu Entertainment";
    department = await prisma.department.create({
      data: { name: deptName },
    });
    console.log(`Created department: "${department.name}"`);

    const defaultPenaltyRules = [
      { key: "LATE", label: "Lateness", amount: 10000 },
      { key: "ABSENT", label: "Absence", amount: 50000 },
      { key: "MINOR_INFRACTION", label: "Infraction", amount: 10000 },
      { key: "MAJOR_INFRACTION", label: "Major Infraction", amount: 50000 },
      { key: "MISCELLANEOUS", label: "Miscellaneous Deduction", amount: 0 },
    ];
    for (const rule of defaultPenaltyRules) {
      await prisma.penaltyRule.upsert({
        where: { departmentId_key: { departmentId: department.id, key: rule.key } },
        update: {},
        create: { ...rule, departmentId: department.id },
      });
    }
  }

  const existing = await prisma.adminAccount.findUnique({
    where: { username },
  });

  if (existing) {
    console.error(`\nAccount with username "${username}" already exists.`);
    console.log("Use `npm run accounts` to update existing account passwords.\n");
    process.exit(1);
  }

  const account = await prisma.adminAccount.create({
    data: {
      username,
      passwordHash: hashPassword(password),
      role,
      departmentId: department.id,
    },
  });

  console.log("\n✅ Admin account created successfully!");
  console.log(`- Username:   ${account.username}`);
  console.log(`- Role:       ${account.role}`);
  console.log(`- Department: ${department.name}`);
  console.log(`- ID:         ${account.id}\n`);
}

main()
  .catch((e) => {
    console.error("Error creating account:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
