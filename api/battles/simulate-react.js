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
    case 'EXTREME':
      return '익스트림';
    case 'HARD':
      return '하드';
    case 'SUCCESS':
      return '성공';
    case 'FAIL':
    default:
      return '실패';
  }
}

function normalizeResponse(value) {
  if (value === 'DODGE' || value === 'COUNTER' || value === 'PASS') return value;
  return 'PASS';
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

    if (!pendingId) {
      res.status(400).json({
        error: 'INVALID_REQUEST',
        message: 'pendingId가 필요합니다.'
      });
      return;
    }

    const pending = pendingReactions.get(pendingId);
    if (!pending) {
      res.status(404).json({
        error: 'PENDING_NOT_FOUND',
        message: '대기 중인 반응 단계가 없습니다(만료되었거나 이미 처리됨).'
      });
      return;
    }

    pendingReactions.delete(pendingId);

    const { attackerName, defenderName, attackerChar, defenderChar, defenderHp, attackJudgment } = pending;

    const ruleSet = await battleEngine.getActiveRuleSetOrDefault();
    const battle = { ruleSet };

    const result = battleEngine.resolveBasicAttack({
      battle,
      attacker: { id: 'sim_attacker' },
      defender: { id: 'sim_defender' },
      attackerChar,
      defenderChar,
      defenderHp,
      attackJudgment,
      response
    });

    const log = [];
    log.push(`\n🧩 방어자 반응 처리: ${defenderName} 선택 = ${response}`);

    if (response === 'COUNTER') {
      if (result.counterJudgment) {
        log.push(`  ↩️ 반격(공격) 판정: ${result.counterJudgment.roll} / ${result.counterJudgment.threshold} (${gradeLabel(result.counterJudgment.grade)})`);
      } else if (result.defenseJudgment) {
        log.push(`  ↩️ 반격(공격) 판정: ${result.defenseJudgment.roll} / ${result.defenseJudgment.threshold} (${gradeLabel(result.defenseJudgment.grade)})`);
      }
      if (result.counterAgiJudgment) {
        log.push(`  💨 반격(민첩) 판정: ${result.counterAgiJudgment.roll} / ${result.counterAgiJudgment.threshold} (${gradeLabel(result.counterAgiJudgment.grade)})`);
      }
    } else if (result.defenseJudgment) {
      const label = response === 'DODGE' ? '회피' : '반격';
      log.push(`  🛡️ ${label} 판정: ${result.defenseJudgment.roll} / ${result.defenseJudgment.threshold} (${gradeLabel(result.defenseJudgment.grade)})`);
    }

    if (result.countered) {
      const pct = Number.isFinite(Number(result.counterDefensePercent)) ? Math.round(Number(result.counterDefensePercent)) : null;
      if (pct !== null && Number.isFinite(Number(result.rawCounterDamage))) {
        log.push(
          `  ↩️ 반격 성공! (원데미지 ${Math.round(Number(result.rawCounterDamage))} → 방어력 ${pct}% → 실제 ${Math.round(result.counterDamage)})`
        );
      } else {
        log.push(`  ↩️ 반격 성공! ${attackerName}이(가) ${Math.round(result.counterDamage)} 데미지!`);
      }

      res.status(200).json({
        phase: 'RESOLVED',
        log,
        defenderHp,
        attackerDamage: Number.isFinite(Number(result.counterDamage)) ? Math.round(Number(result.counterDamage)) : 0
      });
      return;
    }

    if (result.dodged) {
      log.push('  💨 회피 성공! 데미지 없음');
      res.status(200).json({
        phase: 'RESOLVED',
        log,
        defenderHp
      });
      return;
    }

    if (!result.success) {
      log.push('  ❌ 공격 실패!');
      res.status(200).json({
        phase: 'RESOLVED',
        log,
        defenderHp
      });
      return;
    }

    const nextHp = Math.max(0, defenderHp - result.damage);
    const defensePercent = Number.isFinite(Number(result.defensePercent)) ? Math.round(Number(result.defensePercent)) : null;

    if (defensePercent !== null) {
      if (response === 'COUNTER' && result.counterFailedPenalty) {
        log.push(`  ⚠️ 반격 실패 페널티: 방어력 무시 (원데미지 ${result.rawDamage} → 실제 ${result.damage})`);
      } else {
        log.push(`  🛡️ 방어력: ${defensePercent}% (원데미지 ${result.rawDamage} → 실제 ${result.damage})`);
      }
    }

    log.push(`  💥 데미지: ${Math.round(result.damage)}`);
    log.push(`  💚 ${defenderName} HP: ${defenderHp} → ${nextHp}`);

    res.status(200).json({
      phase: 'RESOLVED',
      log,
      defenderHp: nextHp
    });
  } catch (error) {
    console.error('2-step 시뮬레이션(react) 오류:', error);
    res.status(500).json({
      error: 'SIMULATE_REACT_FAILED',
      message: error?.message || String(error)
    });
  }
}
