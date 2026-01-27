/**
 * POST /api/battles/simulate-react
 * 2-step 시뮬레이션 2단계: 방어자 반응 처리 후 결과 확정
 */

const battleEngine = require('../../backend/src/services/battleEngine');

const pendingReactions = globalThis.__battle_pendingReactions || new Map();
globalThis.__battle_pendingReactions = pendingReactions;

const PENDING_TTL_MS = 30 * 60 * 1000;

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function prunePendingReactions(now = Date.now()) {
  for (const [id, entry] of pendingReactions.entries()) {
    if (!entry || !entry.createdAt || now - entry.createdAt > PENDING_TTL_MS) {
      pendingReactions.delete(id);
    }
  }
}

function gradeLabel(grade) {
  switch (grade) {
    case 'CRITICAL':
      return '대성공';
    case 'EXTREME':
      return '극단적 성공';
    case 'HARD':
      return '어려운 성공';
    case 'SUCCESS':
      return '성공';
    case 'FAIL':
    default:
      return '실패';
  }
}

function gradeValue(grade) {
  switch (grade) {
    case 'CRITICAL':
      return 4;
    case 'EXTREME':
      return 3;
    case 'HARD':
      return 2;
    case 'SUCCESS':
      return 1;
    case 'FAIL':
    default:
      return 0;
  }
}

function formatGradeComparison({ requiredGrade, actualGrade, mode }) {
  const req = gradeLabel(requiredGrade);
  const act = gradeLabel(actualGrade);
  const diff = gradeValue(actualGrade) - gradeValue(requiredGrade);
  const diffText = `${diff >= 0 ? '+' : ''}${diff}단계`;
  const requirementText = mode === 'GT' ? '초과' : '이상';
  return `요구(${requirementText})=${req} / 실제=${act} (${diffText})`;
}

function normalizeResponse(value) {
  if (value === 'DODGE' || value === 'COUNTER' || value === 'PASS' || value === 'DEFENSE_SKILL') return value;
  return 'PASS';
}

function clampStat(stat) {
  const n = Number(stat);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
}

function rollShieldBySkillStat(skillStat) {
  const stat = clampStat(skillStat);
  const table = {
    1: { min: 8, extraMax: 3 },
    2: { min: 11, extraMax: 3 },
    3: { min: 13, extraMax: 4 },
    4: { min: 16, extraMax: 4 },
    5: { min: 18, extraMax: 5 }
  };
  const profile = table[stat] || table[1];
  const bonus = Math.floor(Math.random() * profile.extraMax) + 1;
  const raw = Math.floor(profile.min + bonus);
  return { stat, min: profile.min, extraMax: profile.extraMax, bonus, raw, max: profile.min + profile.extraMax };
}

module.exports = async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    prunePendingReactions();

    const body = req.body || {};
    const pendingId = typeof body.pendingId === 'string' ? body.pendingId : '';
    const response = normalizeResponse(body.response);

    let pending = null;
    if (pendingId) {
      pending = pendingReactions.get(pendingId) || null;
      if (pending) pendingReactions.delete(pendingId);
    }

    // Serverless 특성상 begin/react가 다른 인스턴스에서 실행될 수 있어 in-memory pending이 없을 수 있음.
    // 이 경우 클라이언트가 전달한 pendingState로 처리합니다.
    if (!pending) {
      const pendingState = body.pendingState;
      if (pendingState && typeof pendingState === 'object') {
        pending = pendingState;
      }
    }

    if (!pending) {
      res.status(404).json({
        error: 'PENDING_NOT_FOUND',
        message: '대기 중인 반응 단계가 없습니다(만료되었거나 이미 처리됨).'
      });
      return;
    }

    const { attackerName, defenderName, attackerChar, defenderChar, defenderHp, attackJudgment } = pending;

    if (!attackerChar || !defenderChar || !attackJudgment || !Number.isFinite(Number(defenderHp))) {
      res.status(400).json({
        error: 'INVALID_PENDING_STATE',
        message: 'pendingState가 누락되었거나 올바르지 않습니다.'
      });
      return;
    }

    const ruleSet = await battleEngine.getActiveRuleSetOrDefault();
    const battle = { ruleSet };

    const normalizedForEngine = response === 'DEFENSE_SKILL' ? 'PASS' : response;

    // DEFENSE_SKILL: 방어 스킬(쉴드)을 먼저 적용한 뒤 PASS와 동일하게 공격을 맞습니다.
    // - 쉴드는 defenderHp를 maxHp 초과로 만들 수 있는 "추가 HP" 취급
    const shieldRoll = response === 'DEFENSE_SKILL' ? rollShieldBySkillStat(defenderChar.skillStat) : null;
    const shieldAmount = shieldRoll ? Math.max(0, Math.round(Number(shieldRoll.raw) || 0)) : 0;
    const effectiveDefenderHp = shieldAmount > 0 ? (defenderHp + shieldAmount) : defenderHp;

    const result = battleEngine.resolveBasicAttack({
      battle,
      attacker: { id: 'sim_attacker' },
      defender: { id: 'sim_defender' },
      attackerChar,
      defenderChar,
      defenderHp,
      attackJudgment,
      response: normalizedForEngine
    });

    const log = [];
    log.push(`\n🧩 방어자 반응 처리: ${defenderName} 선택 = ${response}`);

    if (response === 'DEFENSE_SKILL' && shieldRoll) {
      log.push(`  🛡️ 방어 스킬(쉴드) 발동: ${shieldRoll.min} + (1~${shieldRoll.extraMax})[${shieldRoll.bonus}] = ${shieldRoll.raw} (최대 ${shieldRoll.max})`);
      log.push(`  🧱 쉴드 적용: ${defenderHp} → ${effectiveDefenderHp} (maxHP 초과분은 쉴드)`);
    }

    if (response === 'COUNTER') {
      if (result.counterJudgment) {
        log.push(`  ↩️ 반격(공격) 판정: ${result.counterJudgment.roll} / ${result.counterJudgment.threshold} (${gradeLabel(result.counterJudgment.grade)})`);
      } else if (result.defenseJudgment) {
        log.push(`  ↩️ 반격(공격) 판정: ${result.defenseJudgment.roll} / ${result.defenseJudgment.threshold} (${gradeLabel(result.defenseJudgment.grade)})`);
      }
      if (result.counterAgiJudgment) {
        log.push(`  💨 반격(민첩) 판정: ${result.counterAgiJudgment.roll} / ${result.counterAgiJudgment.threshold} (${gradeLabel(result.counterAgiJudgment.grade)})`);
      }

      // 상대(공격자)의 성공 등급 대비 요구조건 표시
      if (attackJudgment?.grade && (result.counterJudgment?.grade || result.defenseJudgment?.grade) && result.counterAgiJudgment?.grade) {
        const counterAtkGrade = (result.counterJudgment?.grade || result.defenseJudgment?.grade);
        log.push(`  📌 반격 조건(공격): ${formatGradeComparison({ requiredGrade: attackJudgment.grade, actualGrade: counterAtkGrade, mode: 'GT' })}`);
        log.push(`  📌 반격 조건(민첩): ${formatGradeComparison({ requiredGrade: attackJudgment.grade, actualGrade: result.counterAgiJudgment.grade, mode: 'GTE' })}`);
      }
    } else if (result.defenseJudgment) {
      const label = response === 'DODGE' ? '회피' : '반격';
      log.push(`  🛡️ ${label} 판정: ${result.defenseJudgment.roll} / ${result.defenseJudgment.threshold} (${gradeLabel(result.defenseJudgment.grade)})`);

      // 회피는 민첩 등급이 공격 등급 이상이어야 함
      if (response === 'DODGE' && attackJudgment?.grade && result.defenseJudgment?.grade) {
        log.push(`  📌 회피 조건(민첩): ${formatGradeComparison({ requiredGrade: attackJudgment.grade, actualGrade: result.defenseJudgment.grade, mode: 'GTE' })}`);
      }
    }

    if (result.countered) {
      const selfDmg = Number.isFinite(Number(result.defenderSelfDamage)) ? Math.max(0, Math.round(Number(result.defenderSelfDamage))) : 0;
      const counterDefenderHp = Math.max(0, effectiveDefenderHp - selfDmg);

      const pct = Number.isFinite(Number(result.counterDefensePercent)) ? Math.round(Number(result.counterDefensePercent)) : null;
      if (pct !== null && Number.isFinite(Number(result.rawCounterDamage))) {
        if (pct > 0) {
          log.push(
            `  ↩️ 반격 성공! (원데미지 ${Math.round(Number(result.rawCounterDamage))} → 방어력 ${pct}% → 실제 ${Math.round(result.counterDamage)})`
          );
        } else {
          log.push(
            `  ↩️ 반격 성공! (원데미지 ${Math.round(Number(result.rawCounterDamage))} → 실제 ${Math.round(result.counterDamage)})`
          );
        }
      } else {
        log.push(`  ↩️ 반격 성공! ${attackerName}이(가) ${Math.round(result.counterDamage)} 데미지!`);
      }

      if (selfDmg > 0) {
        log.push(`  ⚠️ 반격 성공 페널티: ${defenderName} -${selfDmg} (고정)`);
        log.push(`  💚 ${defenderName} HP: ${effectiveDefenderHp} → ${counterDefenderHp}`);
      }

      res.status(200).json({
        phase: 'RESOLVED',
        log,
        response,
        attackJudgment,
        defenseJudgment: result.defenseJudgment || null,
        counterJudgment: result.counterJudgment || null,
        counterAgiJudgment: result.counterAgiJudgment || null,
        countered: true,
        dodged: false,
        success: true,
        rawDamage: Number.isFinite(Number(result.rawDamage)) ? Math.round(Number(result.rawDamage)) : null,
        damage: Number.isFinite(Number(result.damage)) ? Math.round(Number(result.damage)) : null,
        defensePercent: Number.isFinite(Number(result.defensePercent)) ? Math.round(Number(result.defensePercent)) : null,
        counterFailedPenalty: !!result.counterFailedPenalty,
        rawCounterDamage: Number.isFinite(Number(result.rawCounterDamage)) ? Math.round(Number(result.rawCounterDamage)) : null,
        counterDamage: Number.isFinite(Number(result.counterDamage)) ? Math.round(Number(result.counterDamage)) : null,
        counterDefensePercent: Number.isFinite(Number(result.counterDefensePercent)) ? Math.round(Number(result.counterDefensePercent)) : null,
        defenderSelfDamage: Number.isFinite(Number(result.defenderSelfDamage)) ? Math.round(Number(result.defenderSelfDamage)) : null,
        shieldRoll,
        shieldAmount,
        effectiveDefenderHpBeforeDamage: Number.isFinite(Number(effectiveDefenderHp)) ? Math.round(Number(effectiveDefenderHp)) : null,
        defenderHp: counterDefenderHp,
        attackerDamage: Number.isFinite(Number(result.counterDamage)) ? Math.round(Number(result.counterDamage)) : 0
      });
      return;
    }

    if (result.dodged) {
      log.push('  💨 회피 성공! 데미지 없음');
      res.status(200).json({
        phase: 'RESOLVED',
        log,
        response,
        attackJudgment,
        defenseJudgment: result.defenseJudgment || null,
        counterJudgment: result.counterJudgment || null,
        counterAgiJudgment: result.counterAgiJudgment || null,
        countered: false,
        dodged: true,
        success: true,
        rawDamage: Number.isFinite(Number(result.rawDamage)) ? Math.round(Number(result.rawDamage)) : null,
        damage: 0,
        defensePercent: Number.isFinite(Number(result.defensePercent)) ? Math.round(Number(result.defensePercent)) : null,
        counterFailedPenalty: !!result.counterFailedPenalty,
        rawCounterDamage: Number.isFinite(Number(result.rawCounterDamage)) ? Math.round(Number(result.rawCounterDamage)) : null,
        counterDamage: Number.isFinite(Number(result.counterDamage)) ? Math.round(Number(result.counterDamage)) : null,
        counterDefensePercent: Number.isFinite(Number(result.counterDefensePercent)) ? Math.round(Number(result.counterDefensePercent)) : null,
        defenderSelfDamage: Number.isFinite(Number(result.defenderSelfDamage)) ? Math.round(Number(result.defenderSelfDamage)) : null,
        shieldRoll,
        shieldAmount,
        effectiveDefenderHpBeforeDamage: Number.isFinite(Number(effectiveDefenderHp)) ? Math.round(Number(effectiveDefenderHp)) : null,
        defenderHp
      });
      return;
    }

    if (!result.success) {
      log.push('  ❌ 공격 실패!');
      res.status(200).json({
        phase: 'RESOLVED',
        log,
        response,
        attackJudgment,
        defenseJudgment: result.defenseJudgment || null,
        counterJudgment: result.counterJudgment || null,
        counterAgiJudgment: result.counterAgiJudgment || null,
        countered: false,
        dodged: false,
        success: false,
        rawDamage: Number.isFinite(Number(result.rawDamage)) ? Math.round(Number(result.rawDamage)) : null,
        damage: Number.isFinite(Number(result.damage)) ? Math.round(Number(result.damage)) : null,
        defensePercent: Number.isFinite(Number(result.defensePercent)) ? Math.round(Number(result.defensePercent)) : null,
        counterFailedPenalty: !!result.counterFailedPenalty,
        rawCounterDamage: Number.isFinite(Number(result.rawCounterDamage)) ? Math.round(Number(result.rawCounterDamage)) : null,
        counterDamage: Number.isFinite(Number(result.counterDamage)) ? Math.round(Number(result.counterDamage)) : null,
        counterDefensePercent: Number.isFinite(Number(result.counterDefensePercent)) ? Math.round(Number(result.counterDefensePercent)) : null,
        defenderSelfDamage: Number.isFinite(Number(result.defenderSelfDamage)) ? Math.round(Number(result.defenderSelfDamage)) : null,
        shieldRoll,
        shieldAmount,
        effectiveDefenderHpBeforeDamage: Number.isFinite(Number(effectiveDefenderHp)) ? Math.round(Number(effectiveDefenderHp)) : null,
        defenderHp
      });
      return;
    }

    const nextHp = Math.max(0, effectiveDefenderHp - result.damage);
    const defensePercent = Number.isFinite(Number(result.defensePercent)) ? Math.round(Number(result.defensePercent)) : null;

    if (defensePercent !== null) {
      if (response === 'COUNTER' && result.counterFailedPenalty) {
        log.push(`  ⚠️ 반격 실패 페널티: 방어력 무시 (원데미지 ${result.rawDamage} → 실제 ${result.damage})`);
      } else {
        log.push(`  🛡️ 방어력: ${defensePercent}% (원데미지 ${result.rawDamage} → 실제 ${result.damage})`);
      }
    }

    log.push(`  💥 데미지: ${Math.round(result.damage)}`);
    log.push(`  💚 ${defenderName} HP: ${effectiveDefenderHp} → ${nextHp}`);

    res.status(200).json({
      phase: 'RESOLVED',
      log,
      response,
      attackJudgment,
      defenseJudgment: result.defenseJudgment || null,
      counterJudgment: result.counterJudgment || null,
      counterAgiJudgment: result.counterAgiJudgment || null,
      countered: false,
      dodged: false,
      success: true,
      rawDamage: Number.isFinite(Number(result.rawDamage)) ? Math.round(Number(result.rawDamage)) : null,
      damage: Number.isFinite(Number(result.damage)) ? Math.round(Number(result.damage)) : null,
      defensePercent: Number.isFinite(Number(result.defensePercent)) ? Math.round(Number(result.defensePercent)) : null,
      counterFailedPenalty: !!result.counterFailedPenalty,
      rawCounterDamage: Number.isFinite(Number(result.rawCounterDamage)) ? Math.round(Number(result.rawCounterDamage)) : null,
      counterDamage: Number.isFinite(Number(result.counterDamage)) ? Math.round(Number(result.counterDamage)) : null,
      counterDefensePercent: Number.isFinite(Number(result.counterDefensePercent)) ? Math.round(Number(result.counterDefensePercent)) : null,
      defenderSelfDamage: Number.isFinite(Number(result.defenderSelfDamage)) ? Math.round(Number(result.defenderSelfDamage)) : null,
      shieldRoll,
      shieldAmount,
      effectiveDefenderHpBeforeDamage: Number.isFinite(Number(effectiveDefenderHp)) ? Math.round(Number(effectiveDefenderHp)) : null,
      defenderHp: nextHp,
      shieldAmount
    });
  } catch (error) {
    console.error('2-step 시뮬레이션(react) 오류:', error);
    res.status(500).json({
      error: 'SIMULATE_REACT_FAILED',
      message: error?.message || String(error)
    });
  }
}
