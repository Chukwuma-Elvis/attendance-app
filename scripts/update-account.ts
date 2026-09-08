import { prisma } from "../src/lib/db";
import { hashPassword } from "../src/lib/password";

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === "--list" || args[0] === "-l") {
    const accounts = await prisma.adminAccount.findMany({
      include: { department: true },
      orderBy: { username: "asc" },
    });

    console.log("\n=== Current Login Accounts ===");
    for (const acc of accounts) {
      console.log(`- Username: ${acc.username}`);
      console.log(`  Role:     ${acc.role}`);
      console.log(`  Team:     ${acc.department.name}`);
      console.log("");
    }
    console.log("Usage:");
    console.log("  Change password:");
    console.log("    npm run accounts -- <username> <new-password>");
    console.log("  Change username only (use '-' for password):");
    console.log("    npm run accounts -- <current-username> - <new-username>");
    console.log("  Change both:");
    console.log("    npm run accounts -- <current-username> <new-password> <new-username>\n");
    return;
  }

  const [currentUsername, newPassword, newUsername] = args;

  const account = await prisma.adminAccount.findUnique({
    where: { username: currentUsername },
  });

  if (!account) {
    console.error(`\nError: Account with username "${currentUsername}" not found.`);
    console.log("Run with --list to see all available accounts.\n");
    process.exit(1);
  }

  const dataToUpdate: { passwordHash?: string; username?: string } = {};

  if (newPassword && newPassword !== "-") {
    dataToUpdate.passwordHash = hashPassword(newPassword);
  }

  if (newUsername && newUsername !== currentUsername) {
    const existing = await prisma.adminAccount.findUnique({
      where: { username: newUsername },
    });
    if (existing) {
      console.error(`\nError: Username "${newUsername}" is already taken.`);
      process.exit(1);
    }
    dataToUpdate.username = newUsername;
  }

  if (Object.keys(dataToUpdate).length === 0) {
    console.log("\nNo changes made.\n");
    return;
  }

  const updated = await prisma.adminAccount.update({
    where: { username: currentUsername },
    data: dataToUpdate,
  });

  console.log("\n Account updated successfully!");
  console.log(`- Username: ${updated.username}`);
  if (dataToUpdate.passwordHash) {
    console.log("- Password: [Updated and securely hashed]");
  }
  console.log("");
}

main()
  .catch((e) => {
    console.error("Error updating account:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
