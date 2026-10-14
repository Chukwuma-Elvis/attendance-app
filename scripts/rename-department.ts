import { prisma } from "../src/lib/db";

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 2 || args[0] === "--list" || args[0] === "-l") {
    const departments = await prisma.department.findMany({
      select: {
        id: true,
        name: true,
        _count: { select: { employees: true, admins: true } },
      },
      orderBy: { name: "asc" },
    });

    console.log("\n=== Current Departments ===");
    for (const d of departments) {
      console.log(`- "${d.name}" (${d._count.employees} employees, ${d._count.admins} admins)`);
    }
    console.log("\nUsage to rename a department:");
    console.log('  npm run department:rename -- "<old-name>" "<new-name>"\n');
    console.log("Example:");
    console.log('  npm run department:rename -- "Zaza" "Zaza Lounge"\n');
    return;
  }

  const [oldName, newName] = args.map((s) => s.trim());

  if (!oldName || !newName) {
    console.error("\nError: Both old name and new name are required.\n");
    process.exit(1);
  }

  const department = await prisma.department.findUnique({
    where: { name: oldName },
  });

  if (!department) {
    console.error(`\nError: Department "${oldName}" was not found.`);
    console.log("Run with --list to view all available departments.\n");
    process.exit(1);
  }

  const existingNew = await prisma.department.findUnique({
    where: { name: newName },
  });

  if (existingNew) {
    console.error(`\nError: A department named "${newName}" already exists.\n`);
    process.exit(1);
  }

  const updated = await prisma.department.update({
    where: { id: department.id },
    data: { name: newName },
  });

  console.log(`\n✅ Department successfully renamed!`);
  console.log(`- Old Name: "${oldName}"`);
  console.log(`- New Name: "${updated.name}"`);
  console.log(`- ID:       ${updated.id}\n`);
}

main()
  .catch((e) => {
    console.error("Error renaming department:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
