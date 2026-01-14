const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const rulesets = await prisma.ruleSet.findMany();
  console.log(JSON.stringify(rulesets, null, 2));
}

main().finally(async () => { await prisma.$disconnect(); });
