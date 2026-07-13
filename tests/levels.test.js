const test = require('node:test');
const assert = require('node:assert/strict');

const Levels = require('../lib/levels');

test('define los 12 niveles con metadatos y 7 jugables', () => {
  assert.equal(Levels.LEVELS.length, 12);
  const playable = Levels.LEVELS.filter((l) => Array.isArray(l.techniques) && l.techniques.length > 0);
  assert.equal(playable.length, 7);
  Levels.LEVELS.forEach((l) => {
    assert.ok(l.id >= 1 && l.id <= 12);
    assert.ok(l.title.length > 0 && l.tagline.length > 0);
  });
});

test('los generadores son deterministas con la misma semilla', () => {
  const a = Levels.generateBoss(1, Levels.createRng(42));
  const b = Levels.generateBoss(1, Levels.createRng(42));
  assert.deepEqual(a.map((p) => p.prompt), b.map((p) => p.prompt));
  const c = Levels.generateBoss(1, Levels.createRng(43));
  assert.notDeepEqual(a.map((p) => p.prompt), c.map((p) => p.prompt));
});

test('todos los problemas generados están bien formados', () => {
  for (const level of [1, 2, 3, 4, 5, 6, 7]) {
    const rng = Levels.createRng(7 + level);
    const problems = Levels.generateBoss(level, rng);
    assert.ok(problems.length >= 15, `nivel ${level} genera su tanda completa`);
    problems.forEach((p) => {
      assert.equal(p.type, 'custom');
      assert.ok(p.prompt.includes('?'), `enunciado con hueco: ${p.prompt}`);
      assert.ok(Number.isInteger(p.answer), `respuesta entera en "${p.prompt}" (${p.answer})`);
      assert.ok(p.answer >= 0 && p.answer <= 999999, `respuesta tecleable: ${p.answer}`);
      assert.ok(Array.isArray(p.skills) && p.skills.length > 0, 'declara habilidades');
      assert.ok(Number.isFinite(p.difficulty), 'declara dificultad');
      assert.ok(p.key.startsWith('c_'), 'clave agrupada por técnica');
      assert.ok(typeof p.hint === 'string' && p.hint.length > 0, 'incluye pista');
    });
  }
});

test('los complementos y compensaciones son aritméticamente correctos', () => {
  const rng = Levels.createRng(99);
  const practice = Levels.generatePractice(1, 'complemento', 30, rng);
  practice.forEach((p) => {
    const m = p.prompt.match(/(\d+) \+ \? = (\d+)/);
    assert.ok(m, p.prompt);
    assert.equal(Number(m[1]) + p.answer, Number(m[2]));
  });
  const comp = Levels.generatePractice(1, 'compensacion', 30, Levels.createRng(5));
  comp.forEach((p) => {
    const sub = p.prompt.match(/(\d+) − (\d+) = \?/);
    const add = p.prompt.match(/(\d+) \+ (\d+) = \?/);
    if (sub) assert.equal(Number(sub[1]) - Number(sub[2]), p.answer);
    else if (add) assert.equal(Number(add[1]) + Number(add[2]), p.answer);
    else assert.fail('formato inesperado: ' + p.prompt);
  });
});

test('los bloques fuerzan llevada y resultados positivos', () => {
  const problems = Levels.generatePractice(1, 'bloques', 40, Levels.createRng(11));
  problems.forEach((p) => {
    const sub = p.prompt.match(/(\d+) − (\d+) = \?/);
    const add = p.prompt.match(/(\d+) \+ (\d+) = \?/);
    if (sub) {
      const [a, b] = [Number(sub[1]), Number(sub[2])];
      assert.ok(a > b, `positivo: ${p.prompt}`);
      assert.ok(a % 10 < b % 10, `llevada en unidades: ${p.prompt}`);
    } else if (add) {
      const [a, b] = [Number(add[1]), Number(add[2])];
      assert.ok((a % 10) + (b % 10) >= 10, `llevada en unidades: ${p.prompt}`);
    }
  });
});

test('los porcentajes generan resultados enteros con números no redondos', () => {
  const problems = Levels.generateBoss(2, Levels.createRng(21));
  problems.forEach((p) => {
    const m = p.prompt.match(/(\d+)% de (\d+) = \?/);
    assert.ok(m, p.prompt);
    const [pct, n] = [Number(m[1]), Number(m[2])];
    assert.equal((n * pct) % 100, 0, `resultado entero: ${p.prompt}`);
    assert.equal(p.answer, (n * pct) / 100);
  });
});

test('las anclas multiplican correctamente', () => {
  const problems = Levels.generateBoss(3, Levels.createRng(31));
  problems.forEach((p) => {
    const m = p.prompt.match(/(\d+) × (\d+) = \?/);
    assert.ok(m, p.prompt);
    assert.equal(Number(m[1]) * Number(m[2]), p.answer);
    assert.ok([11, 12, 15, 25, 19, 21, 99].includes(Number(m[1])), `ancla válida: ${p.prompt}`);
  });
});

test('la multiplicación 2×2 es correcta y usa las formas esperadas', () => {
  const problems = Levels.generateBoss(4, Levels.createRng(44));
  problems.forEach((p) => {
    const m = p.prompt.match(/^(\d+) × (\d+) = \?$/);
    assert.ok(m, p.prompt);
    assert.equal(Number(m[1]) * Number(m[2]), p.answer);
  });
  // La técnica base 100 mantiene ambos factores cerca de 100
  const base100 = Levels.generatePractice(4, 'base-100', 20, Levels.createRng(4));
  base100.forEach((p) => {
    const m = p.prompt.match(/^(\d+) × (\d+) = \?$/);
    [Number(m[1]), Number(m[2])].forEach((f) => assert.ok(f >= 91 && f <= 109 && f !== 100, p.prompt));
  });
  // La diferencia de cuadrados equidista de un centro redondo
  const difsq = Levels.generatePractice(4, 'dif-cuadrados', 20, Levels.createRng(5));
  difsq.forEach((p) => {
    const m = p.prompt.match(/^(\d+) × (\d+) = \?$/);
    assert.equal((Number(m[1]) + Number(m[2])) % 20, 0, `centro redondo: ${p.prompt}`);
  });
});

test('la división del nivel 5 es exacta y los restos correctos', () => {
  const problems = Levels.generateBoss(5, Levels.createRng(55));
  problems.forEach((p) => {
    const rem = p.prompt.match(/^Resto de (\d+) ÷ (\d+) = \?$/);
    const div = p.prompt.match(/^(\d+) ÷ (\d+) = \?$/);
    if (rem) {
      assert.equal(Number(rem[1]) % Number(rem[2]), p.answer, p.prompt);
      assert.ok(p.answer >= 0 && p.answer < Number(rem[2]));
    } else if (div) {
      assert.equal(Number(div[1]) % Number(div[2]), 0, `división exacta: ${p.prompt}`);
      assert.equal(Number(div[1]) / Number(div[2]), p.answer);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
  });
});

test('la estimación declara tolerancia coherente y el nivel 7 es correcto', () => {
  const est = Levels.generateBoss(6, Levels.createRng(66));
  est.forEach((p) => {
    const prod = p.prompt.match(/^(\d+) × (\d+) ≈ \?$/);
    const pct = p.prompt.match(/^(\d+)% de (\d+) ≈ \?$/);
    const rem9 = p.prompt.match(/^Resto de \((\d+) × (\d+)\) ÷ 9 = \?$/);
    if (prod) {
      const exact = Number(prod[1]) * Number(prod[2]);
      assert.equal(p.answer, exact);
      assert.ok(p.tolerance >= Math.round(exact * 0.04), `margen ~5%: ${p.prompt}`);
    } else if (pct) {
      const exact = (Number(pct[1]) * Number(pct[2])) / 100;
      assert.equal(p.answer, Math.round(exact));
      assert.ok(p.tolerance >= 3);
    } else if (rem9) {
      assert.equal(p.answer, (Number(rem9[1]) * Number(rem9[2])) % 9);
      assert.ok(!p.tolerance, 'la comprobación por 9 es exacta');
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
  });

  const sq = Levels.generateBoss(7, Levels.createRng(77));
  sq.forEach((p) => {
    const square = p.prompt.match(/^(\d+)² = \?$/);
    const root = p.prompt.match(/^√(\d+) ≈ \?$/);
    if (square) {
      const n = Number(square[1]);
      assert.ok(n >= 31 && n <= 50);
      assert.equal(p.answer, n * n);
    } else if (root) {
      const n = Number(root[1]);
      assert.equal(p.answer, Math.round(Math.sqrt(n)));
      assert.equal(p.tolerance, 1);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
  });
});

test('SKILL_META cubre todas las habilidades que emiten los generadores', () => {
  for (const level of [1, 2, 3, 4, 5, 6, 7]) {
    const problems = Levels.generateBoss(level, Levels.createRng(100 + level));
    problems.forEach((p) => {
      p.skills.forEach((skill) => {
        assert.ok(Levels.SKILL_META[skill], `habilidad etiquetada: ${skill}`);
      });
    });
  }
});

test('evaluateBoss otorga medallas según precisión y tiempo medio', () => {
  const mk = (n, okShare, ms) =>
    Array.from({ length: n }, (_, i) => ({ correct: i < n * okShare, timeMs: ms }));
  const criteria = { bronze: { acc: 0.8 }, silver: { acc: 0.9, avgMs: 6000 }, gold: { acc: 0.95, avgMs: 3500 } };
  assert.equal(Levels.evaluateBoss(mk(20, 1, 3000), criteria).medal, 'gold');
  assert.equal(Levels.evaluateBoss(mk(20, 0.9, 5000), criteria).medal, 'silver');
  assert.equal(Levels.evaluateBoss(mk(20, 1, 8000), criteria).medal, 'bronze', 'preciso pero lento → bronce');
  assert.equal(Levels.evaluateBoss(mk(20, 0.5, 2000), criteria).medal, null);
  assert.equal(Levels.evaluateBoss([], criteria).medal, null);
});

test('el desbloqueo requiere medalla en el nivel anterior', () => {
  assert.equal(Levels.isUnlocked(1, {}), true);
  assert.equal(Levels.isUnlocked(2, {}), false);
  assert.equal(Levels.isUnlocked(2, { 1: { medal: 'bronze' } }), true);
  assert.equal(Levels.isUnlocked(3, { 1: { medal: 'gold' } }), false);
  assert.equal(Levels.betterMedal('silver', 'bronze'), 'silver');
  assert.equal(Levels.betterMedal(null, 'gold'), 'gold');
});
