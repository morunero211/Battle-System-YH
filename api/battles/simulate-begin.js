/**
 * POST /api/battles/simulate-begin
 * 2-step 시뮬레이션 1단계: 공격 판정만 수행
 */

import { createRequire } from 'module';
import { randomUUID } from 'crypto';

const require = createRequire(import.meta.url);
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

function clampStat(stat) {
  const n = Number(stat);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(5, Math.round(n)));
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

export default async function handler(req, res) {
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
    const attacker = body.attacker || {};
    const defender = body.defender || {};

    const attackerName = attacker.name || '공격자';
    const defenderName = defender.name || '방어자';

    const attackerChar = {
      atk: clampStat(attacker.atk ?? attacker.attack),
      def: clampStat(attacker.def ?? attacker.defense ?? 1),
      agi: clampStat(attacker.agi ?? attacker.agility ?? 1),
      skillStat: clampStat(attacker.skillStat ?? attacker.skill ?? 1),
      name: attackerName
    };

    const defenderMaxHp = Number.isFinite(Number(defender.maxHp)) ? Math.max(1, Math.round(Number(defender.maxHp))) : 100;
    const defenderHp = Number.isFinite(Number(defender.hp)) ? Math.max(0, Math.round(Number(defender.hp))) : defenderMaxHp;
    const defenderChar = {
      atk: clampStat(defender.atk ?? 1),
      def: clampStat(defender.def ?? defender.defense ?? 1),
      agi: clampStat(defender.agi ?? defender.agility ?? 1),
      skillStat: clampStat(defender.skillStat ?? 1),
      maxHp: defenderMaxHp,
      name: defenderName
    };

    const attackJudgment = battleEngine.judgeAttack(attackerChar.atk);

    const log = [];
    log.push(`\n⚔️ ${attackerName} → ${defenderName} 공격 시도!`);
    log.push(`  🎯 공격 판정: ${attackJudgment.roll} / ${attackJudgment.threshold} (${gradeLabel(attackJudgment.grade)})`);

    if (attackJudgment.grade === 'FAIL') {
      log.push('  ❌ 공격 실패!');
      res.status(200).json({
        phase: 'RESOLVED',
        log,
        defenderHp
      });
      return;
    }

    const pendingId = randomUUID();
    pendingReactions.set(pendingId, {
      createdAt: Date.now(),
      attackerName,
      defenderName,
      attackerChar,
      defenderChar,
      defenderHp,
      attackJudgment
    });

    log.push('  ✅ 공격 성공! 방어자 반응을 선택하세요: DODGE / COUNTER / PASS');

    res.status(200).json({
      phase: 'AWAITING_DEFENDER_RESPONSE',
      pendingId,
      attackerName,
      defenderName,
      attackJudgment,
      expiresInMs: PENDING_TTL_MS,
      log,
      defenderHp
    });
  } catch (error) {
    console.error('2-step 시뮬레이션(begin) 오류:', error);
    res.status(500).json({
      error: 'SIMULATE_BEGIN_FAILED',
      message: error?.message || String(error)
    });
  }
}
