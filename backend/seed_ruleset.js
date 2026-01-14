const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const ruleset = await prisma.ruleSet.create({
    data: {
      name: "기본 전투 규칙",
      damageTable: [
        {min: 1, max: 1, value: 10},
        {min: 2, max: 2, value: 20},
        {min: 3, max: 3, value: 30},
        {min: 4, max: 4, value: 40},
        {min: 5, max: 5, value: 50}
      ],
      blockTable: [
        {stat: 1, value: 5},
        {stat: 2, value: 10},
        {stat: 3, value: 15},
        {stat: 4, value: 20},
        {stat: 5, value: 25}
      ],
      healTable: [],
      supportTable: [],
      isActive: true
    }
  });

  console.log('룰셋 생성됨:', ruleset);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
