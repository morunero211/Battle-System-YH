const battleEngine = require('../src/services/battleEngine');

function fmt(n, digits = 2) {
  return Number.isFinite(n) ? n.toFixed(digits) : String(n);
}

function summarizeDistribution(rawValues, defensePct) {
  let sumRaw = 0;
  let sumFinal = 0;
  let maxReduction = -Infinity;
  let maxReductionAtRaw = null;

  for (const raw of rawValues) {
    const final = battleEngine.applyDefenseReduction(raw, defensePct);
    const reduction = raw - final;
    sumRaw += raw;
    sumFinal += final;
    if (reduction > maxReduction) {
      maxReduction = reduction;
      maxReductionAtRaw = raw;
    }
  }

  const n = rawValues.length;
  const avgRaw = sumRaw / n;
  const avgFinal = sumFinal / n;
  const avgReduction = avgRaw - avgFinal;

  return { avgRaw, avgFinal, avgReduction, maxReduction, maxReductionAtRaw };
}

function printRow(defStat, pct, s) {
  const row = [
    String(defStat).padEnd(6),
    String(pct).padStart(4),
    fmt(s.avgRaw).padStart(7),
    fmt(s.avgFinal).padStart(8),
    fmt(s.avgReduction).padStart(10),
    String(s.maxReduction).padStart(10) + ` (raw=${s.maxReductionAtRaw})`
  ];
  console.log(row.join(' '));
}

// ===== Basic attack: raw 3~10 (현재 엔진 상수 기준) =====
const BASIC_RAW_MIN = 3;
const BASIC_RAW_MAX = 10;
const basicRaw = Array.from({ length: BASIC_RAW_MAX - BASIC_RAW_MIN + 1 }, (_, i) => BASIC_RAW_MIN + i);

console.log('=== 방어력%별 평균 데미지(기본공격 raw 3~10) ===');
console.log('defStat | def% | avgRaw | avgFinal | avgReduced | maxReduced(at raw)');
for (let defStat = 1; defStat <= 5; defStat++) {
  const pct = battleEngine.getDefenseReductionPercent(defStat);
  const s = summarizeDistribution(basicRaw, pct);
  printRow(defStat, pct, s);
}

console.log('');

// ===== Attack skill: exact distribution via profile(min, extraMax) =====
console.log('=== 방어력%별 평균 데미지(공격형 스킬) ===');

for (let skillStat = 1; skillStat <= 5; skillStat++) {
  // rollAttackSkillRawDamage는 랜덤 bonus를 포함하지만,
  // min/extraMax는 스탯별로 고정이므로 1회 샘플링해서 분포를 재구성.
  const profileSample = battleEngine.rollAttackSkillRawDamage(skillStat);
  const min = profileSample.min;
  const extraMax = profileSample.extraMax;

  const rawValues = Array.from({ length: extraMax }, (_, i) => min + (i + 1));

  console.log(`\n-- skillStat=${skillStat} (raw 범위: ${min + 1}..${min + extraMax}) --`);
  console.log('defStat | def% | avgRaw | avgFinal | avgReduced | maxReduced(at raw)');

  for (let defStat = 1; defStat <= 5; defStat++) {
    const pct = battleEngine.getDefenseReductionPercent(defStat);
    const s = summarizeDistribution(rawValues, pct);
    printRow(defStat, pct, s);
  }
}
