const { z } = require('zod');

// ============================================
// 전투 관련 Zod 스키마
// ============================================

/**
 * 전투 생성 요청
 * POST /battles
 */
const zBattleCreate = z.object({
  characterIds: z.array(z.string()).min(2, "최소 2명 이상 필요"),
  teams: z.array(z.number().int().min(1)).min(2, "최소 2팀 필요"),
  ruleSetId: z.string()
});

/**
 * 기본 공격 액션
 * POST /battles/:id/actions
 */
const zBattleActionAttack = z.object({
  action: z.literal('BASIC_ATTACK'),
  participantId: z.string(),
  targetParticipantId: z.string()
});

/**
 * 스킬 사용 액션
 */
const zBattleActionSkill = z.object({
  action: z.literal('USE_SKILL'),
  participantId: z.string(),
  skillId: z.string(),
  targetParticipantIds: z.array(z.string()).min(1)
});

/**
 * 아이템 사용 액션
 */
const zBattleActionItem = z.object({
  action: z.literal('USE_ITEM'),
  participantId: z.string(),
  itemId: z.string(),
  targetParticipantId: z.string()
});

const zBattleAction = z.discriminatedUnion('action', [
  zBattleActionAttack,
  zBattleActionSkill,
  zBattleActionItem
]);

/**
 * 회피 응답
 * POST /battles/:id/responses
 */
const zBattleResponseDodge = z.object({
  response: z.literal('DODGE'),
  participantId: z.string()
});

/**
 * 반격 응답
 */
const zBattleResponseCounter = z.object({
  response: z.literal('COUNTER'),
  participantId: z.string()
});

/**
 * 방어 스킬 응답
 */
const zBattleResponseDefenseSkill = z.object({
  response: z.literal('DEFENSE_SKILL'),
  participantId: z.string(),
  skillId: z.string()
});

/**
 * 패스 응답
 */
const zBattleResponsePass = z.object({
  response: z.literal('PASS'),
  participantId: z.string()
});

const zBattleResponse = z.discriminatedUnion('response', [
  zBattleResponseDodge,
  zBattleResponseCounter,
  zBattleResponseDefenseSkill,
  zBattleResponsePass
]);

/**
 * 타임아웃 승리 요청
 * POST /battles/:id/end
 */
const zBattleEnd = z.object({
  endReason: z.literal('TIMEOUT')
});

/**
 * 전투 시뮬레이션 (프론트 단발 호출용)
 * POST /battles/simulate
 */
const zBattleSimulate = z.object({
  attacker: z.object({
    name: z.string().min(1).optional(),
    atk: z.number().int().optional(),
    def: z.number().int().optional(),
    agi: z.number().int().optional(),
    skillStat: z.number().int().optional(),
    // 프론트에서 쓰는 별칭 허용
    attack: z.number().optional(),
    defense: z.number().optional(),
    agility: z.number().optional(),
    skill: z.number().optional()
  }),
  defender: z.object({
    name: z.string().min(1).optional(),
    hp: z.number().int().min(0).optional(),
    maxHp: z.number().int().min(1).optional(),
    atk: z.number().int().optional(),
    def: z.number().int().optional(),
    agi: z.number().int().optional(),
    skillStat: z.number().int().optional(),
    // 프론트 별칭 허용
    defense: z.number().optional(),
    agility: z.number().optional()
  }),
  response: z.enum(['PASS', 'DODGE', 'COUNTER']).optional()
});

/**
 * 캐릭터 생성
 * POST /characters
 */
const zCharacterCreate = z.object({
  name: z.string().min(1).max(50),
  faction: z.enum(['HERO', 'GOVERNMENT', 'VILLAIN']),
  atk: z.number().int().min(1).max(5),
  def: z.number().int().min(1).max(5),
  agi: z.number().int().min(1).max(5),
  skillStat: z.number().int().min(1).max(5),
  maxHp: z.number().int().min(1)
});

/**
 * 캐릭터 스킬 추가
 * POST /characters/:id/skills
 */
const zCharacterSkillAdd = z.object({
  skillId: z.string(),
  maxUses: z.number().int().positive().optional()
});

/**
 * 캐릭터 아이템 추가
 * POST /characters/:id/items
 */
const zCharacterItemAdd = z.object({
  itemId: z.string(),
  quantity: z.number().int().min(1)
});

/**
 * RuleSet 생성
 * POST /rulesets
 */
const zRuleSetCreate = z.object({
  name: z.string().min(1).max(100),
  damageTable: z.array(
    z.object({
      min: z.number().int().min(1).max(5),
      max: z.number().int().min(1).max(5),
      value: z.number().int().min(1)
    })
  ),
  blockTable: z.array(
    z.object({
      stat: z.number().int().min(1).max(5),
      value: z.number().int().min(0)
    })
  ),
  healTable: z.array(
    z.object({
      stat: z.number().int().min(1).max(5),
      value: z.number().int().min(1)
    })
  ),
  // supportTable은 현재 엔진에서 미사용이지만, 테이블 형식은 block/heal과 동일하게 유지
  supportTable: z
    .array(
      z.object({
        stat: z.number().int().min(1).max(5),
        value: z.number().int().min(0)
      })
    )
    .default([]),
  isActive: z.boolean().optional()
});

/**
 * 스킬 생성
 * POST /skills
 */
const zSupportBasicStat = z.enum(['attack', 'agility', 'defense', 'skill', 'RANDOM_ADA']);

const zSupportBasicStats = z
  .array(zSupportBasicStat)
  .nonempty()
  .superRefine((stats, ctx) => {
    const values = stats.map(String);
    const unique = new Set(values);
    if (unique.size !== values.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'basicStats에는 중복 값이 올 수 없습니다.'
      });
    }

    const hasRandom = values.includes('RANDOM_ADA');
    if (hasRandom && values.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'basicStats에 RANDOM_ADA가 포함되면 단독으로만 사용할 수 있습니다.'
      });
    }
  });

const zSupportEffects = z.discriminatedUnion('template', [
  z
    .object({
      type: z.literal('SUPPORT'),
      template: z.literal('BASIC'),
      basicMode: z.enum(['BUFF', 'DEBUFF']).default('BUFF'),
      basicStats: zSupportBasicStats.default(['attack', 'agility', 'defense', 'skill']),
      durationRounds: z.number().int().min(1).default(1)
    })
    .strict(),
  z
    .object({
      type: z.literal('SUPPORT'),
      template: z.literal('TURN_SKIP'),
      durationRounds: z.number().int().min(1).default(1)
    })
    .strict(),
  z
    .object({
      type: z.literal('SUPPORT'),
      template: z.literal('CANCEL'),
      cancelKind: z.enum(['BUFF', 'DEBUFF']).default('BUFF'),
      basicStats: zSupportBasicStats.default(['attack', 'agility', 'defense', 'skill']),
      durationRounds: z.number().int().min(1).default(1)
    })
    .strict()
]);

const zSkillCreate = z
  .object({
    name: z.string().min(1).max(100),
    category: z.enum(['ATTACK', 'DEFENSE', 'HEAL', 'SUPPORT']),
    targetScope: z.enum([
      'SINGLE_ENEMY',
      'ALL_ALLIES',
      'ALL_ENEMIES',
      'ALL_ALLIES_EXCEPT_SELF',
      'SELF'
    ]),
    // effects는 Prisma Json 컬럼으로 저장되며, 현재 구현된 타입만 우선 검증
    effects: z.union([
      z
        .object({
          type: z.literal('DAMAGE'),
          amount: z.number().int().min(1)
        })
        .strict(),
      z
        .object({
          type: z.literal('BLOCK'),
          block: z.number().int().min(0)
        })
        .strict(),
      z
        .object({
          type: z.literal('HEAL'),
          amount: z.number().int().min(1)
        })
        .strict(),
      zSupportEffects
    ])
  })
  .superRefine((val, ctx) => {
    const expected = {
      ATTACK: 'DAMAGE',
      DEFENSE: 'BLOCK',
      HEAL: 'HEAL',
      SUPPORT: 'SUPPORT'
    };

    const expectedType = expected[val.category];
    if (expectedType && val.effects?.type !== expectedType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['effects', 'type'],
        message: `category=${val.category}인 스킬은 effects.type=${expectedType} 이어야 합니다.`
      });
    }
  });

/**
 * 아이템 생성
 * POST /items
 */
const zItemCreate = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  type: z.string()
});

module.exports = {
  zBattleCreate,
  zBattleAction,
  zBattleResponse,
  zBattleEnd,
  zBattleSimulate,
  zCharacterCreate,
  zCharacterSkillAdd,
  zCharacterItemAdd,
  zRuleSetCreate,
  zSkillCreate,
  zItemCreate
};
