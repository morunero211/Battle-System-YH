let prisma = null;

function getPrisma() {
  if (prisma) return prisma;
  try {
    const { PrismaClient } = require('@prisma/client');
    prisma = new PrismaClient();
    return prisma;
  } catch (e) {
    return null;
  }
}

/**
 * 전투 판정 엔진
 * 명세서의 d100 시스템 구현
 */

// 스탯 → 임계값 매핑 (1~5 → 50/55/60/65/70)
const STAT_THRESHOLDS = {
  1: 50,
  2: 55,
  3: 60,
  4: 65,
  5: 70
};

// 판정 등급 계산
// - 대성공(CRITICAL): 주사위 1일 때만
// - 극단(EXTREME): 기준치의 20% 이하
// - 하드(HARD): 기준치의 50% 이하
function getJudgmentGrade(roll, threshold) {
  if (roll > threshold) {
    return 'FAIL';
  }
  if (roll === 1) {
    return 'CRITICAL';
  }
  if (roll <= threshold * 0.2) {
    return 'EXTREME';
  }
  if (roll <= threshold * 0.5) {
    return 'HARD';
  }
  return 'SUCCESS';
}


// d100 롤 (1~100)
function rollD100() {
  return Math.floor(Math.random() * 100) + 1;
}

function rollInt(min, max) {
  const lo = Math.ceil(Number(min));
  const hi = Math.floor(Number(max));
  if (!Number.isFinite(lo) || !Number.isFinite(hi) || hi < lo) return 0;
  return Math.floor(Math.random() * (hi - lo + 1)) + lo;
}

// ===== 전투 밸런스(정수 기반) =====
// 기본공격 rawDamage 범위(요청 반영):
// - 공격 스탯 1,2 = 3 ~ 13
// - 공격 스탯 3,4 = 4 ~ 13
// - 공격 스탯 5   = 5 ~ 13
const BASIC_RAW_DAMAGE_BY_ATK_STAT = {
  1: { min: 3, max: 13 },
  2: { min: 3, max: 13 },
  3: { min: 4, max: 13 },
  4: { min: 4, max: 13 },
  5: { min: 5, max: 13 }
};

// 공격형 스킬 데미지 테이블(이미지 기반)
// format: { max | min (+ 1~N) }
// 1: 13 | 10 (+1~3)
// 2: 16 | 13 (+1~3)
// 3: 19 | 15 (+1~4)
// 4: 22 | 18 (+1~4)
// 5: 25 | 20 (+1~5)
const ATTACK_SKILL_DAMAGE_BY_STAT = {
  1: { min: 10, extraMax: 3 },
  2: { min: 13, extraMax: 3 },
  3: { min: 15, extraMax: 4 },
  4: { min: 18, extraMax: 4 },
  5: { min: 20, extraMax: 5 }
};

// 방어 스탯(1~5) -> 방어력%(완만 버전). 필요 시 여기만 조정.
// index: defStat (1..5)
// NOTE: 기본공격 raw 범위가 작아서(3~10) 5%/10%가 floor 처리에서 동일 결과가 나기 쉬움.
//       def=3을 11%로 두면 def=2(5%)와 구분되는 구간이 생김.
const DEFENSE_REDUCTION_PCT_BY_STAT = [0, 0, 5, 11, 15, 20];

// 맞았을 때 최소 데미지(0 허용하고 싶으면 0으로)
const MIN_DAMAGE_ON_HIT = 1;

// 방어 스탯(1~5) -> 방어력%(10~50)
function getDefenseReductionPercent(defStat) {
  const stat = Math.max(1, Math.min(5, Math.round(Number(defStat) || 1)));
  return DEFENSE_REDUCTION_PCT_BY_STAT[stat] ?? 0;
}

function applyDefenseReduction(rawDamage, defensePercent) {
  const base = Math.max(0, Math.floor(Number(rawDamage) || 0));
  if (base === 0) return 0;

  const pct = Math.max(0, Math.min(80, Math.round(Number(defensePercent) || 0)));
  const reduced = Math.floor((base * (100 - pct)) / 100);
  return Math.max(MIN_DAMAGE_ON_HIT, reduced);
}

function rollRawDamage(range) {
  return rollInt(range?.min ?? 0, range?.max ?? 0);
}

function rollAttackSkillRawDamage(skillStat) {
  const stat = Math.max(1, Math.min(5, Math.round(Number(skillStat) || 1)));
  const profile = ATTACK_SKILL_DAMAGE_BY_STAT[stat] || ATTACK_SKILL_DAMAGE_BY_STAT[1];
  const bonus = rollInt(1, profile.extraMax);
  const raw = Math.floor(profile.min + bonus);
  return {
    stat,
    min: profile.min,
    extraMax: profile.extraMax,
    bonus,
    raw,
    max: profile.min + profile.extraMax
  };
}

// DB가 없거나 RuleSet이 비어있어도 동작하도록 기본 RuleSet 제공
const DEFAULT_RULESET = {
  id: 'default',
  name: 'Default RuleSet',
  isActive: true,
  // damageTable: atk(1~5) x def(1~5) 기본값
  damageTable: [
    // atk=1
    { min: 1, max: 1, value: 4 },
    { min: 1, max: 2, value: 3 },
    { min: 1, max: 3, value: 2 },
    { min: 1, max: 4, value: 1 },
    { min: 1, max: 5, value: 1 },
    // atk=2
    { min: 2, max: 1, value: 6 },
    { min: 2, max: 2, value: 5 },
    { min: 2, max: 3, value: 4 },
    { min: 2, max: 4, value: 3 },
    { min: 2, max: 5, value: 2 },
    // atk=3
    { min: 3, max: 1, value: 8 },
    { min: 3, max: 2, value: 7 },
    { min: 3, max: 3, value: 6 },
    { min: 3, max: 4, value: 5 },
    { min: 3, max: 5, value: 4 },
    // atk=4
    { min: 4, max: 1, value: 10 },
    { min: 4, max: 2, value: 9 },
    { min: 4, max: 3, value: 8 },
    { min: 4, max: 4, value: 7 },
    { min: 4, max: 5, value: 6 },
    // atk=5
    { min: 5, max: 1, value: 12 },
    { min: 5, max: 2, value: 11 },
    { min: 5, max: 3, value: 10 },
    { min: 5, max: 4, value: 9 },
    { min: 5, max: 5, value: 8 }
  ],
  blockTable: [
    { stat: 1, value: 0 },
    { stat: 2, value: 1 },
    { stat: 3, value: 2 },
    { stat: 4, value: 3 },
    { stat: 5, value: 4 }
  ],
  healTable: [
    { stat: 1, value: 5 },
    { stat: 2, value: 7 },
    { stat: 3, value: 9 },
    { stat: 4, value: 12 },
    { stat: 5, value: 15 }
  ],
  supportTable: []
};

async function getActiveRuleSetOrDefault() {
  try {
    const prismaClient = getPrisma();
    if (!prismaClient) return DEFAULT_RULESET;

    const ruleSet = await prismaClient.ruleSet.findFirst({
      where: { isActive: true },
      orderBy: { updatedAt: 'desc' }
    });
    return ruleSet || DEFAULT_RULESET;
  } catch (e) {
    return DEFAULT_RULESET;
  }
}

/**
 * 공격 판정
 * @param {number} atkStat - 공격자의 atk 스탯 (1~5)
 * @returns {object} { roll, threshold, grade }
 */
function judgeAttack(atkStat) {
  const threshold = STAT_THRESHOLDS[atkStat];
  const roll = rollD100();
  const grade = getJudgmentGrade(roll, threshold);
  
  return { roll, threshold, grade };
}

/**
 * 회피 판정
 * @param {number} agiStat - 방어자의 agi 스탯 (1~5)
 * @returns {object} { roll, threshold, grade }
 */
function judgeDodge(agiStat) {
  const threshold = STAT_THRESHOLDS[agiStat];
  const roll = rollD100();
  const grade = getJudgmentGrade(roll, threshold);
  
  return { roll, threshold, grade };
}

/**
 * 반격 판정
 * @param {number} atkStat - 방어자의 atk 스탯 (1~5)
 * @returns {object} { roll, threshold, grade }
 */
function judgeCounter(atkStat) {
  const threshold = STAT_THRESHOLDS[atkStat];
  const roll = rollD100();
  const grade = getJudgmentGrade(roll, threshold);
  
  return { roll, threshold, grade };
}

/**
 * RuleSet에서 데미지 조회
 * @param {object} ruleSet - RuleSet 객체
 * @param {number} atkStat - 공격자 atk (1~5)
 * @param {number} defStat - 방어자 def (1~5)
 * @returns {number} 데미지 값
 */
function getDamageFromRuleSet(ruleSet, atkStat, defStat) {
  const damageTable = ruleSet.damageTable;
  
  // damageTable 형식: [{ min: 1, max: 1, value: 4 }, { min: 1, max: 2, value: 6 }, ...]
  const entry = damageTable.find(
    row => row.min === atkStat && row.max === defStat
  );
  
  return entry ? entry.value : 0;
}

/**
 * 기본 공격/반격의 원데미지 계산
 * - 스탯별로 입력된 RuleSet damageTable(atk x def)을 최우선으로 사용
 * - 테이블이 없거나 값이 비정상이면 안전하게 기존 랜덤 범위로 폴백
 */
function getBasicAttackRawDamage(battle, attackerChar, defenderChar) {
  const atkStat = Math.max(1, Math.min(5, Math.round(Number(attackerChar?.atk) || 1)));
  const range = BASIC_RAW_DAMAGE_BY_ATK_STAT[atkStat] || BASIC_RAW_DAMAGE_BY_ATK_STAT[1];
  return rollRawDamage(range);
}

/**
 * RuleSet에서 방어 값 조회
 * @param {object} ruleSet - RuleSet 객체
 * @param {number} defStat - 방어자 def (1~5)
 * @returns {number} 방어 값
 */
function getBlockFromRuleSet(ruleSet, defStat) {
  const blockTable = ruleSet.blockTable;
  
  // blockTable 형식: [{ stat: 1, value: 2 }, { stat: 2, value: 4 }, ...]
  const entry = blockTable.find(row => row.stat === defStat);
  
  return entry ? entry.value : 0;
}

/**
 * 기본 공격 처리 (회피/반격 응답 포함)
 * @param {object} params
 * @param {object} params.battle - Battle 객체
 * @param {object} params.attacker - BattleParticipant 공격자
 * @param {object} params.defender - BattleParticipant 방어자
 * @param {object} params.attackerChar - Character 공격자 정보
 * @param {object} params.defenderChar - Character 방어자 정보
 * @param {string} params.response - 'DODGE' | 'COUNTER' | 'PASS'
 * @returns {object} 결과 { damage, attackJudgment, defenseJudgment, blocked }
 */
function executeBasicAttack({ 
  battle, 
  attacker, 
  defender, 
  attackerChar, 
  defenderChar,
  response = 'PASS'
}) {
  const ruleSet = battle.ruleSet;
  
  // 1. 공격 판정
  const attackJudgment = judgeAttack(attackerChar.atk);
  
  // 공격 실패 시
  if (attackJudgment.grade === 'FAIL') {
    return {
      success: false,
      damage: 0,
      attackJudgment,
      defenseJudgment: null,
      blocked: false,
      message: '공격이 빗나갔습니다!'
    };
  }
  
  let damage = 0;
  let defenseJudgment = null;
  let blocked = false;
  let counterDamage = 0;
  let counterJudgment = null;
  let counterAgiJudgment = null;
  let counterFailedPenalty = false;
  
  // 2. 방어 응답 처리
  if (response === 'DODGE') {
    defenseJudgment = judgeDodge(defenderChar.agi);
    
    // 회피 성공: 회피 등급 >= 공격 등급
    if (compareGrades(defenseJudgment.grade, attackJudgment.grade) >= 0) {
      return {
        success: false,
        damage: 0,
        attackJudgment,
        defenseJudgment,
        blocked: false,
        dodged: true,
        message: '공격을 회피했습니다!'
      };
    }
  } else if (response === 'COUNTER') {
    counterJudgment = judgeCounter(defenderChar.atk);
    counterAgiJudgment = judgeDodge(defenderChar.agi);
    // 기존 로그 호환: defenseJudgment는 "반격(공격)" 판정으로 유지
    defenseJudgment = counterJudgment;

    // 반격 성공: (1) 반격(공격) 등급 > 공격 등급 AND (2) 민첩(회피) 등급 >= 공격 등급
    const counterAtkOk = compareGrades(counterJudgment.grade, attackJudgment.grade) > 0;
    const counterAgiOk = compareGrades(counterAgiJudgment.grade, attackJudgment.grade) >= 0;
    if (counterAtkOk && counterAgiOk) {
      // 반격 데미지 계산: 기본공격과 동일한 원데미지 룰(공격 스탯 기반 범위)
      const rawCounterDamage = getBasicAttackRawDamage(battle, defenderChar, attackerChar);
      // 요구사항: 반격은 방어력 무시(공격자 방어력 적용하지 않음)
      const counterDefensePercent = 0;
      counterDamage = rawCounterDamage;
      
      return {
        success: false,
        damage: 0,
        attackJudgment,
        defenseJudgment,
        counterJudgment,
        counterAgiJudgment,
        blocked: false,
        countered: true,
        counterDamage,
        rawCounterDamage,
        counterDefensePercent,
        message: '반격에 성공했습니다!'
      };
    }

    // 반격 시도 실패: 패널티(방어력 %감소 무시)
    counterFailedPenalty = true;
  }
  
  // 3. 데미지 계산
  // 기본 데미지는 공격자 atk만으로 산출(방어는 %감소로만 처리)
  const rawDamage = getBasicAttackRawDamage(battle, attackerChar, defenderChar);
  const defensePercent = counterFailedPenalty ? 0 : getDefenseReductionPercent(defenderChar.def);
  damage = counterFailedPenalty ? rawDamage : applyDefenseReduction(rawDamage, defensePercent);
  blocked = defensePercent > 0;
  
  return {
    success: true,
    damage,
    attackJudgment,
    defenseJudgment,
    counterJudgment,
    counterAgiJudgment,
    counterFailedPenalty,
    blocked,
    rawDamage,
    defensePercent,
    message: counterFailedPenalty
      ? `반격 실패! 방어력 무시 페널티로 ${damage} 데미지를 입혔습니다!`
      : `${damage} 데미지를 입혔습니다!`
  };
}

/**
 * 등급 비교 (EXTREME > HARD > SUCCESS > FAIL)
 * @returns {number} -1, 0, 1
 */
function compareGrades(grade1, grade2) {
  const gradeValues = {
    'FAIL': 0,
    'SUCCESS': 1,
    'HARD': 2,
    'EXTREME': 3
  };
  
  return Math.sign(gradeValues[grade1] - gradeValues[grade2]);
}

/**
 * 기본 공격 처리 (2-step용: 공격 판정은 외부에서 주입)
 * - 1단계: judgeAttack(atkStat)으로 attackJudgment 생성
 * - 2단계: 이 함수를 호출해 DODGE/COUNTER/PASS를 처리
 */
function resolveBasicAttack({
  battle,
  attacker,
  defender,
  attackerChar,
  defenderChar,
  attackJudgment,
  response = 'PASS'
}) {
  // 공격 실패 시
  if (!attackJudgment || attackJudgment.grade === 'FAIL') {
    return {
      success: false,
      damage: 0,
      attackJudgment: attackJudgment || null,
      defenseJudgment: null,
      blocked: false,
      message: '공격이 빗나갔습니다!'
    };
  }

  let damage = 0;
  let defenseJudgment = null;
  let blocked = false;
  let counterDamage = 0;
  let counterJudgment = null;
  let counterAgiJudgment = null;
  let counterFailedPenalty = false;
  let defenderSelfDamage = 0;

  // 2. 방어 응답 처리
  if (response === 'DODGE') {
    defenseJudgment = judgeDodge(defenderChar.agi);

    // 회피 성공: 회피 등급 >= 공격 등급
    if (compareGrades(defenseJudgment.grade, attackJudgment.grade) >= 0) {
      return {
        success: false,
        damage: 0,
        attackJudgment,
        defenseJudgment,
        blocked: false,
        dodged: true,
        message: '공격을 회피했습니다!'
      };
    }
  } else if (response === 'COUNTER') {
    counterJudgment = judgeCounter(defenderChar.atk);
    counterAgiJudgment = judgeDodge(defenderChar.agi);
    // 기존 로그 호환: defenseJudgment는 "반격(공격)" 판정으로 유지
    defenseJudgment = counterJudgment;

    // 반격 성공: (1) 반격(공격) 등급 > 공격 등급 AND (2) 민첩(회피) 등급 >= 공격 등급
    const counterAtkOk = compareGrades(counterJudgment.grade, attackJudgment.grade) > 0;
    const counterAgiOk = compareGrades(counterAgiJudgment.grade, attackJudgment.grade) >= 0;
    if (counterAtkOk && counterAgiOk) {
      // 반격 데미지 계산: 요구사항 - 반격은 방어력 무시(공격자 방어력 적용하지 않음)
      const rawCounterDamage = getBasicAttackRawDamage(battle, defenderChar, attackerChar);
      const counterDefensePercent = 0;
      counterDamage = rawCounterDamage;

      // 반격 성공 시: 방어자는 고정 -2 데미지(요구사항)
      defenderSelfDamage = 2;

      return {
        success: false,
        damage: 0,
        attackJudgment,
        defenseJudgment,
        counterJudgment,
        counterAgiJudgment,
        blocked: false,
        countered: true,
        counterDamage,
        rawCounterDamage,
        counterDefensePercent,
        defenderSelfDamage,
        message: '반격에 성공했습니다!'
      };
    }

    // 반격 시도 실패: 그대로 피격 데미지 계산으로 진행하되, 방어력은 적용되지 않음(요구사항)
    counterFailedPenalty = true;
  }

  // 3. 데미지 계산
  // 기본 데미지는 공격자 atk만으로 산출(방어는 %감소로만 처리)
  const rawDamage = getBasicAttackRawDamage(battle, attackerChar, defenderChar);
  const defensePercent = counterFailedPenalty ? 0 : getDefenseReductionPercent(defenderChar.def);
  damage = counterFailedPenalty ? rawDamage : applyDefenseReduction(rawDamage, defensePercent);
  blocked = defensePercent > 0;

  return {
    success: true,
    damage,
    attackJudgment,
    defenseJudgment,
    counterJudgment,
    counterAgiJudgment,
    counterFailedPenalty,
    blocked,
    rawDamage,
    defensePercent,
    message: counterFailedPenalty
      ? `반격 실패! 방어력 무시 페널티로 ${damage} 데미지를 입혔습니다!`
      : `${damage} 데미지를 입혔습니다!`
  };
}

/**
 * 스킬 사용 (공격/방어/힐/서포트)
 * 명세: 스킬은 항상 성공 (판정 없음)
 * @param {object} params
 * @param {object} params.skill - Skill 객체
 * @param {object} params.caster - BattleParticipant 시전자
 * @param {object[]} params.targets - BattleParticipant[] 대상들
 * @param {object} params.battle - Battle 객체
 * @returns {object[]} 각 대상별 결과 배열
 */
function executeSkill({ skill, caster, targets, battle }) {
  const results = [];
  const ruleSet = battle.ruleSet;
  
  targets.forEach(target => {
    let result = {
      targetId: target.id,
      success: true
    };
    
    // effects DSL 처리 (명세서의 간단한 버전)
    if (skill.category === 'ATTACK') {
      // 공격 스킬은 방어 스킬로만 막을 수 있음 (회피/반격 불가)
      // 여기서는 일단 직접 데미지 적용
      const damage = skill.effects.amount || 20;
      result.damage = damage;
      result.message = `${skill.name}으로 ${damage} 데미지!`;
      
    } else if (skill.category === 'DEFENSE') {
      // 방어 스킬 (패시브 방어량 증가 등)
      result.block = skill.effects.block || 10;
      result.message = `${skill.name}으로 ${result.block} 방어!`;
      
    } else if (skill.category === 'HEAL') {
      // 힐 스킬
      const healAmount = skill.effects.amount || 15;
      result.heal = healAmount;
      result.message = `${skill.name}으로 ${healAmount} 회복!`;
      
    } else if (skill.category === 'SUPPORT') {
      // 서포트 스킬 (버프/디버프)
      result.support = skill.effects;
      result.message = `${skill.name} 효과 적용!`;
    }
    
    results.push(result);
  });
  
  return results;
}

/**
 * 아이템 사용
 * @param {object} params
 * @param {object} params.item - Item 객체
 * @param {object} params.target - BattleParticipant 대상
 * @returns {object} 결과
 */
function executeItem({ item, target }) {
  const result = {
    success: true,
    targetId: target.id
  };
  
  if (item.type === 'HEAL_HP') {
    // 고정 회복량 (향후 확장 가능)
    const healAmount = 20;
    result.heal = healAmount;
    result.message = `${item.name}을(를) 사용해 ${healAmount} HP 회복!`;
  }
  
  return result;
}

/**
 * 턴 순서 계산 (initiative order)
 * 명세: agi 높은 순 → 같으면 랜덤
 * @param {object[]} participants - BattleParticipant[] (with character data)
 * @returns {number[]} initiativeOrder 배열
 */
function calculateInitiativeOrder(participants) {
  // agi 순으로 정렬 (내림차순)
  const sorted = [...participants].sort((a, b) => {
    const agiDiff = b.character.agi - a.character.agi;
    if (agiDiff !== 0) return agiDiff;
    
    // agi 같으면 랜덤
    return Math.random() - 0.5;
  });
  
  // 1-indexed 순서 할당
  return sorted.map((p, idx) => ({
    participantId: p.id,
    order: idx + 1
  }));
}

/**
 * 타임아웃 승리 판정
 * 명세: 팀별 평균 HP 비율 비교
 * @param {object} battle - Battle 객체 (with participants)
 * @returns {object} { winner: teamIndex, scores: { 1: 0.8, 2: 0.3 } }
 */
function judgeTimeoutVictory(battle) {
  const teams = {};
  
  battle.participants.forEach(p => {
    if (!teams[p.teamIndex]) {
      teams[p.teamIndex] = {
        totalHpRatio: 0,
        count: 0
      };
    }
    
    const hpRatio = p.hp / p.startHp;
    teams[p.teamIndex].totalHpRatio += hpRatio;
    teams[p.teamIndex].count += 1;
  });
  
  const scores = {};
  let winnerTeam = null;
  let maxAvgRatio = -1;
  
  Object.keys(teams).forEach(teamIdx => {
    const team = teams[teamIdx];
    const avgRatio = team.totalHpRatio / team.count;
    scores[teamIdx] = avgRatio;
    
    if (avgRatio > maxAvgRatio) {
      maxAvgRatio = avgRatio;
      winnerTeam = parseInt(teamIdx);
    }
  });
  
  return {
    winner: winnerTeam,
    scores
  };
}

module.exports = {
  judgeAttack,
  judgeDodge,
  judgeCounter,
  compareGrades,
  executeBasicAttack,
  resolveBasicAttack,
  executeSkill,
  executeItem,
  calculateInitiativeOrder,
  judgeTimeoutVictory,
  getDamageFromRuleSet,
  getBlockFromRuleSet,
  getDefenseReductionPercent,
  applyDefenseReduction,
  rollRawDamage,
  rollAttackSkillRawDamage,
  getActiveRuleSetOrDefault
};
