/**
 * 전투 시스템 초기 데이터 시드
 * 실행: node src/seeds/seed.js
 */

require('dotenv').config({ path: __dirname + '/../../.env' });
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  __internal: {
    configOverride: {
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      }
    }
  }
});

async function main() {
  console.log('🌱 데이터 시드 시작...\n');

  // 1. RuleSet 생성 (기본 규칙)
  console.log('📋 RuleSet 생성 중...');
  const defaultRuleSet = await prisma.ruleSet.create({
    data: {
      name: 'Default Rules (1.0)',
      isActive: true,
      damageTable: [
        // atk vs def: 데미지
        { min: 1, max: 1, value: 4 },
        { min: 1, max: 2, value: 3 },
        { min: 1, max: 3, value: 2 },
        { min: 1, max: 4, value: 1 },
        { min: 1, max: 5, value: 0 },

        { min: 2, max: 1, value: 6 },
        { min: 2, max: 2, value: 5 },
        { min: 2, max: 3, value: 4 },
        { min: 2, max: 4, value: 3 },
        { min: 2, max: 5, value: 2 },

        { min: 3, max: 1, value: 8 },
        { min: 3, max: 2, value: 7 },
        { min: 3, max: 3, value: 6 },
        { min: 3, max: 4, value: 5 },
        { min: 3, max: 5, value: 4 },

        { min: 4, max: 1, value: 10 },
        { min: 4, max: 2, value: 9 },
        { min: 4, max: 3, value: 8 },
        { min: 4, max: 4, value: 7 },
        { min: 4, max: 5, value: 6 },

        { min: 5, max: 1, value: 12 },
        { min: 5, max: 2, value: 11 },
        { min: 5, max: 3, value: 10 },
        { min: 5, max: 4, value: 9 },
        { min: 5, max: 5, value: 8 }
      ],
      blockTable: [
        { stat: 1, value: 1 },
        { stat: 2, value: 2 },
        { stat: 3, value: 3 },
        { stat: 4, value: 4 },
        { stat: 5, value: 5 }
      ],
      healTable: [
        { stat: 1, value: 5 },
        { stat: 2, value: 10 },
        { stat: 3, value: 15 },
        { stat: 4, value: 20 },
        { stat: 5, value: 25 }
      ],
      supportTable: []
    }
  });
  console.log('✅ RuleSet 생성됨:', defaultRuleSet.id, '\n');

  // 2. 스킬 생성
  console.log('🗡️ 스킬 생성 중...');

  const skillAttack = await prisma.skill.create({
    data: {
      name: '강력한 베기',
      category: 'ATTACK',
      targetScope: 'SINGLE_ENEMY',
      effects: { amount: 20, type: 'DAMAGE' }
    }
  });

  const skillDefense = await prisma.skill.create({
    data: {
      name: '방어 태세',
      category: 'DEFENSE',
      targetScope: 'SELF',
      effects: { block: 10, type: 'BLOCK' }
    }
  });

  const skillHeal = await prisma.skill.create({
    data: {
      name: '회복 마법',
      category: 'HEAL',
      targetScope: 'SINGLE_ALLY',
      effects: { amount: 15, type: 'HEAL' }
    }
  });

  console.log('✅ 스킬 생성됨: ', skillAttack.id, skillDefense.id, skillHeal.id, '\n');

  // 3. 아이템 생성
  console.log('🎁 아이템 생성 중...');

  const itemHeal = await prisma.item.create({
    data: {
      name: '회복 포션',
      description: 'HP를 20 회복한다',
      type: 'HEAL_HP'
    }
  });

  const itemBoost = await prisma.item.create({
    data: {
      name: '힘의 물약',
      description: '공격력을 일시적으로 상승',
      type: 'STAT_BOOST'
    }
  });

  console.log('✅ 아이템 생성됨:', itemHeal.id, itemBoost.id, '\n');

  // 4. 캐릭터 생성 (테스트용)
  console.log('👥 테스트 캐릭터 생성 중...');

  const charHero = await prisma.character.create({
    data: {
      name: '용사 아서',
      faction: 'HERO',
      atk: 5,
      def: 3,
      agi: 2,
      skillStat: 2,
      maxHp: 50,
      currentHp: 50
    }
  });

  const charVillain = await prisma.character.create({
    data: {
      name: '악의 마왕',
      faction: 'VILLAIN',
      atk: 4,
      def: 4,
      agi: 3,
      skillStat: 4,
      maxHp: 45,
      currentHp: 45
    }
  });

  const charAlly = await prisma.character.create({
    data: {
      name: '치유자 엘리',
      faction: 'HERO',
      atk: 2,
      def: 2,
      agi: 4,
      skillStat: 5,
      maxHp: 30,
      currentHp: 30
    }
  });

  console.log('✅ 캐릭터 생성됨:', charHero.id, charVillain.id, charAlly.id, '\n');

  // 5. 캐릭터에 스킬 추가
  console.log('⚔️ 캐릭터에 스킬 추가 중...');

  await prisma.characterSkill.create({
    data: {
      characterId: charHero.id,
      skillId: skillAttack.id,
      maxUses: 10,
      remainingUses: 10
    }
  });

  await prisma.characterSkill.create({
    data: {
      characterId: charHero.id,
      skillId: skillDefense.id,
      maxUses: 5,
      remainingUses: 5
    }
  });

  await prisma.characterSkill.create({
    data: {
      characterId: charVillain.id,
      skillId: skillAttack.id,
      maxUses: 12,
      remainingUses: 12
    }
  });

  await prisma.characterSkill.create({
    data: {
      characterId: charAlly.id,
      skillId: skillHeal.id,
      maxUses: 15,
      remainingUses: 15
    }
  });

  console.log('✅ 캐릭터 스킬 추가 완료\n');

  // 6. 캐릭터에 아이템 추가
  console.log('🎁 캐릭터에 아이템 추가 중...');

  await prisma.characterItem.create({
    data: {
      characterId: charHero.id,
      itemId: itemHeal.id,
      quantity: 3
    }
  });

  await prisma.characterItem.create({
    data: {
      characterId: charAlly.id,
      itemId: itemHeal.id,
      quantity: 5
    }
  });

  console.log('✅ 캐릭터 아이템 추가 완료\n');

  console.log('✅ 🌱 데이터 시드 완료!\n');
  console.log('📊 생성된 데이터:');
  console.log('  - RuleSet 1개');
  console.log('  - 스킬 3개');
  console.log('  - 아이템 2개');
  console.log('  - 캐릭터 3개');
  console.log(`\n테스트 전투 생성:`);
  console.log(`POST /api/battles`);
  console.log(`{
  "characterIds": ["${charHero.id}", "${charVillain.id}"],
  "teams": [1, 2],
  "ruleSetId": "${defaultRuleSet.id}"
}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
