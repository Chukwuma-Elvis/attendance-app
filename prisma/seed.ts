import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Pulled from LULU_ENTERTAINMENT_ATTENDANCE__25_AUGUST_-_30TH_SEPTEMBER.xlsx
// Edit, remove, or add to this list freely before running `npm run seed`.
const employees = [
  { name: "SALEM CHIMENMA NWACHUKWU", role: "Model" },
  { name: "HELEN ORAGUI", role: "Model" },
  { name: "KEMI KAYODE ANGELA", role: "Model" },
  { name: "PRECIOUS BASSEY", role: "Model" },
  { name: "PROMISE INIUNAM", role: "Model" },
  { name: "JULIET NWAFOR", role: "Model" },
  { name: "VICTORIA BEN", role: "Model" },
  { name: "JULIANA AGBOOLA", role: "Model" },
  { name: "MINDY SMITH", role: "Model" },
  { name: "ELLA OFFOR CHRISTY", role: "Model" },
  { name: "JULIET EZEANI", role: "Model" },
  { name: "AYOMIDE FREDRICK", role: "Model" },
  { name: "EYAMBA FREDRICK EFFIOM", role: "Model" },
  { name: "SOTOYINBO ALEXANDER", role: "Model" },
  { name: "VICTOR CHIBUIKE OGBONNAYA", role: "Model" },
  { name: "ENIOLA OGUNMEFUN", role: "Dancer" },
  { name: "DEBORAH KELECHI", role: "Dancer" },
  { name: "PAULINE EZEIKPE", role: "Dancer" },
  { name: "PRINCESS OKECHUKWU", role: "Dancer" },
  { name: "BLOSSOM OKECHUKWU", role: "Dancer" },
  { name: "BOLUWATIFE ONIYA", role: "Dancer" },
  { name: "MYRA JUSTIN", role: "Dancer" },
  { name: "AYOOLA SIMBIAT", role: "Dancer" },
  { name: "ELIZABETH OYEDELE", role: "Dancer" },
  { name: "CHISOM EZE", role: "Dancer" },
  { name: "ELIJAH OGUNSANYA", role: "Drummer" },
  { name: "OLAIWOLA MAYOWA", role: "Drummer" },
  { name: "PIUS CHINONSO", role: "Sax" },
  { name: "OYINDAMOLA MARY", role: "DJ Model" },
];

// Default cash penalties, matching the amounts found in the original
// spreadsheet's DEDUCTION sheet (LATE = 10,000, ABSENT = 50,000, and the
// same tiers reused for minor/major infractions). Adjust anytime from
// /admin/settings after deployment.
const penaltyRules = [
  { key: "LATE", label: "Lateness", amount: 10000 },
  { key: "ABSENT", label: "Absence", amount: 50000 },
  { key: "MINOR_INFRACTION", label: "Infraction", amount: 10000 },
  { key: "MAJOR_INFRACTION", label: "Major Infraction", amount: 50000 },
  { key: "MISCELLANEOUS", label: "Miscellaneous Deduction", amount: 0 },
];

async function main() {
  for (const rule of penaltyRules) {
    await prisma.penaltyRule.upsert({
      where: { key: rule.key },
      update: {},
      create: rule,
    });
  }

  for (const emp of employees) {
    const existing = await prisma.employee.findFirst({ where: { name: emp.name } });
    if (!existing) {
      await prisma.employee.create({ data: emp });
    }
  }

  console.log(`Seeded ${penaltyRules.length} penalty rules and ${employees.length} employees.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
