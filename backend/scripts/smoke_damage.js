const battleEngine = require('../src/services/battleEngine');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function isInt(n) {
  return Number.isFinite(n) && Math.floor(n) === n;
}

function run() {
  // Basic attack raw range sanity (engine uses 3..10)
  const basicSamples = 5000;
  for (let i = 0; i < basicSamples; i++) {
    const raw = battleEngine.rollRawDamage({ min: 3, max: 10 });
    assert(isInt(raw), `basic raw not int: ${raw}`);
    assert(raw >= 3 && raw <= 10, `basic raw out of range: ${raw}`);

    const reduced = battleEngine.applyDefenseReduction(raw, 20);
    assert(isInt(reduced), `reduced not int: ${reduced}`);
    assert(reduced >= 1, `reduced should be >= 1 when hit: ${reduced}`);
  }

  // Attack skill table ranges
  const ranges = {
    1: { min: 11, max: 13 },
    2: { min: 14, max: 16 },
    3: { min: 16, max: 19 },
    4: { min: 19, max: 22 },
    5: { min: 21, max: 25 }
  };

  for (let stat = 1; stat <= 5; stat++) {
    const expected = ranges[stat];
    for (let i = 0; i < 5000; i++) {
      const rolled = battleEngine.rollAttackSkillRawDamage(stat);
      assert(isInt(rolled.raw), `skill raw not int: ${rolled.raw}`);
      assert(
        rolled.raw >= expected.min && rolled.raw <= expected.max,
        `skill raw out of range for stat ${stat}: ${rolled.raw} (expected ${expected.min}..${expected.max})`
      );

      const reduced = battleEngine.applyDefenseReduction(rolled.raw, 20);
      assert(isInt(reduced), `skill reduced not int: ${reduced}`);
      assert(reduced >= 1, `skill reduced should be >= 1 when hit: ${reduced}`);
    }
  }

  console.log('OK: damage smoke tests passed');
}

run();
