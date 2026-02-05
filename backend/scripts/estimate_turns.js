/*
  estimate_turns.js
  - Quick battle length estimator for HARD tuning.
  - Simulates 1v1 basic attacks using backend battleEngine.executeBasicAttack.

  Usage (from repo root):
    node backend/scripts/estimate_turns.js
    node backend/scripts/estimate_turns.js --runs 5000

  Notes:
  - Response is fixed to PASS (no dodge/counter) to measure raw TTK trends.
  - Damage reduction and damage ranges follow current backend rules.
*/

const path = require('path');
const battleEngine = require(path.join('..', 'src', 'services', 'battleEngine'));

function clampStat1to5(v) {
  const n = Math.round(Number(v) || 1);
  return Math.max(1, Math.min(5, n));
}

function makeChar({ name, hp, atk, def, agi }) {
  return {
    name: String(name || '테스트'),
    hp: Math.max(1, Math.round(Number(hp) || 100)),
    atk: clampStat1to5(atk),
    def: clampStat1to5(def),
    agi: clampStat1to5(agi)
  };
}

function percentile(sortedAsc, p) {
  if (!Array.isArray(sortedAsc) || sortedAsc.length === 0) return 0;
  const t = Math.max(0, Math.min(1, Number(p)));
  const idx = Math.floor(t * (sortedAsc.length - 1));
  return sortedAsc[idx];
}

function normalizeWeights({ passW = 1, dodgeW = 0, counterW = 0 } = {}) {
  const p = Math.max(0, Number(passW) || 0);
  const d = Math.max(0, Number(dodgeW) || 0);
  const c = Math.max(0, Number(counterW) || 0);
  const sum = p + d + c;
  if (sum <= 0) return { pass: 1, dodge: 0, counter: 0 };
  return { pass: p / sum, dodge: d / sum, counter: c / sum };
}

function pickDefenseResponse(weights) {
  const w = weights || { pass: 1, dodge: 0, counter: 0 };
  const r = Math.random();
  if (r < (w.dodge || 0)) return 'DODGE';
  if (r < (w.dodge || 0) + (w.counter || 0)) return 'COUNTER';
  return 'PASS';
}

function summarize(values) {
  const list = values.filter((n) => Number.isFinite(n)).slice().sort((a, b) => a - b);
  const n = list.length;
  if (n === 0) return null;
  const sum = list.reduce((a, b) => a + b, 0);
  const avg = sum / n;
  return {
    n,
    min: list[0],
    p10: percentile(list, 0.1),
    p50: percentile(list, 0.5),
    p90: percentile(list, 0.9),
    max: list[n - 1],
    avg: Math.round(avg * 100) / 100
  };
}

function chooseFirstActor(a, b) {
  if (a.agi > b.agi) return 0;
  if (b.agi > a.agi) return 1;
  return Math.random() < 0.5 ? 0 : 1;
}

function simulateDuelOnce(aBase, bBase, { maxTurns = 2000, defenseResponseWeights = null } = {}) {
  const A = { ...aBase };
  const B = { ...bBase };

  let first = chooseFirstActor(A, B);
  let actor = first === 0 ? A : B;
  let target = first === 0 ? B : A;

  const battle = { id: 'SIM', ruleSet: {} };
  const attacker = { id: 'att' };
  const defender = { id: 'def' };

  let turns = 0;
  let hits = 0;
  let totalDamage = 0;

  const weights = defenseResponseWeights || { pass: 1, dodge: 0, counter: 0 };

  while (turns < maxTurns && A.hp > 0 && B.hp > 0) {
    turns += 1;

    const response = pickDefenseResponse(weights);

    const result = battleEngine.executeBasicAttack({
      battle,
      attacker,
      defender,
      attackerChar: actor,
      defenderChar: target,
      response
    });

    if (result && result.success && Number.isFinite(Number(result.damage)) && result.damage > 0) {
      const dmg = Math.max(0, Math.round(Number(result.damage)));
      target.hp = Math.max(0, Math.round(Number(target.hp) - dmg));
      hits += 1;
      totalDamage += dmg;
    }

    if (target.hp <= 0) break;

    // swap
    const tmp = actor;
    actor = target;
    target = tmp;
  }

  const winner = A.hp > 0 && B.hp <= 0 ? A.name : (B.hp > 0 && A.hp <= 0 ? B.name : '미정');
  return {
    turns,
    hits,
    avgDamageOnHit: hits > 0 ? Math.round((totalDamage / hits) * 100) / 100 : 0,
    winner,
    remainingHp: {
      [A.name]: A.hp,
      [B.name]: B.hp
    }
  };
}

function simulateMany(a, b, runs, opts = {}) {
  const turns = [];
  const hits = [];
  const avgOnHit = [];
  const winners = new Map();

  for (let i = 0; i < runs; i++) {
    const r = simulateDuelOnce(a, b, opts);
    turns.push(r.turns);
    hits.push(r.hits);
    avgOnHit.push(r.avgDamageOnHit);
    winners.set(r.winner, (winners.get(r.winner) || 0) + 1);
  }

  const winObj = {};
  for (const [k, v] of winners.entries()) winObj[k] = v;

  return {
    turns: summarize(turns),
    hits: summarize(hits),
    avgDamageOnHit: summarize(avgOnHit),
    winners: winObj
  };
}

function parseArgs(argv) {
  const args = { runs: 2000, pass: 1, dodge: 0, counter: 0 };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--runs' && argv[i + 1]) {
      args.runs = Math.max(10, Math.min(200000, Math.floor(Number(argv[i + 1]))));
      i++;
    } else if (a === '--pass' && argv[i + 1]) {
      args.pass = Math.max(0, Number(argv[i + 1]) || 0);
      i++;
    } else if (a === '--dodge' && argv[i + 1]) {
      args.dodge = Math.max(0, Number(argv[i + 1]) || 0);
      i++;
    } else if (a === '--counter' && argv[i + 1]) {
      args.counter = Math.max(0, Number(argv[i + 1]) || 0);
      i++;
    }
  }
  return args;
}

function main() {
  const { runs, pass, dodge, counter } = parseArgs(process.argv);
  const weights = normalizeWeights({ passW: pass, dodgeW: dodge, counterW: counter });

  // 임시 캐릭터(예시): 실제 데이터 감각에 맞춰 HP 100 전후 + 스탯 2~5
  const temp = makeChar({ name: '임시(테스트)', hp: 100, atk: 4, def: 3, agi: 3 });
  const dummy = makeChar({ name: '더미(상대)', hp: 100, atk: 4, def: 4, agi: 2 });

  console.log('=== HARD 전투 턴수 추정 (1v1, 기본공격, PASS 고정) ===');
  console.log(`Runs: ${runs}`);
  console.log(`Defense response mix: PASS ${(weights.pass * 100).toFixed(1)}% | DODGE ${(weights.dodge * 100).toFixed(1)}% | COUNTER ${(weights.counter * 100).toFixed(1)}%`);
  console.log(`A: ${temp.name} | HP ${temp.hp} | ATK ${temp.atk} DEF ${temp.def} AGI ${temp.agi}`);
  console.log(`B: ${dummy.name} | HP ${dummy.hp} | ATK ${dummy.atk} DEF ${dummy.def} AGI ${dummy.agi}`);
  console.log('');

  const res = simulateMany(temp, dummy, runs, { defenseResponseWeights: weights });

  console.log('--- 결과(턴 수) ---');
  console.log(res.turns);
  console.log('--- 결과(명중 횟수) ---');
  console.log(res.hits);
  console.log('--- 결과(명중 시 평균 데미지) ---');
  console.log(res.avgDamageOnHit);
  console.log('--- 승리 횟수 ---');
  console.log(res.winners);
}

main();
