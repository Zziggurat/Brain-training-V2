const test = require('node:test');
const assert = require('node:assert/strict');

const Levels = require('../lib/levels');

test('define los 12 niveles y todos son jugables', () => {
  assert.equal(Levels.LEVELS.length, 12);
  const playable = Levels.LEVELS.filter((l) => Array.isArray(l.techniques) && l.techniques.length > 0);
  assert.equal(playable.length, 12);
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
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
    const rng = Levels.createRng(7 + level);
    const problems = Levels.generateBoss(level, rng);
    assert.ok(problems.length >= 12, `nivel ${level} genera su tanda completa`);
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

test('los niveles 8-10 producen respuestas aritméticamente correctas', () => {
  // Nivel 8: regla de tres, simplificación y cadenas de porcentajes
  Levels.generateBoss(8, Levels.createRng(88)).forEach((p) => {
    let m;
    if ((m = p.prompt.match(/^(\d+) por (\d+) € → (\d+) por \? €$/))) {
      assert.equal(p.answer, (Number(m[2]) / Number(m[1])) * Number(m[3]), p.prompt);
    } else if ((m = p.prompt.match(/^(\d+) km en (\d+) h → \? km en (\d+) h$/))) {
      assert.equal(p.answer, (Number(m[1]) / Number(m[2])) * Number(m[3]), p.prompt);
    } else if ((m = p.prompt.match(/^(\d+) raciones: (\d+) huevos → (\d+) raciones: \?$/))) {
      assert.equal(p.answer, (Number(m[2]) / Number(m[1])) * Number(m[3]), p.prompt);
    } else if ((m = p.prompt.match(/^(\d+) de (\d+) = \? de (\d+)$/))) {
      assert.equal(Number(m[1]) / Number(m[2]), p.answer / Number(m[3]), p.prompt);
    } else if ((m = p.prompt.match(/^(\d+) sube (\d+)% y baja (\d+)% → \?$/))) {
      const expected = (Number(m[1]) * (100 + Number(m[2])) * (100 - Number(m[3]))) / 10000;
      assert.equal(p.answer, expected, p.prompt);
      assert.ok(Number.isInteger(expected), `cadena entera: ${p.prompt}`);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
    assert.ok(Number.isInteger(p.answer), `respuesta entera: ${p.prompt}`);
  });

  // Nivel 9: periódicos por división larga y milésimas exactas
  Levels.generateBoss(9, Levels.createRng(99)).forEach((p) => {
    let m;
    if ((m = p.prompt.match(/^(\d+)\/(\d+) → 3 primeros decimales = \?$/))) {
      const [num, den] = [Number(m[1]), Number(m[2])];
      let digits = 0;
      let r = num % den;
      for (let i = 0; i < 3; i++) {
        r *= 10;
        digits = digits * 10 + Math.floor(r / den);
        r %= den;
      }
      assert.equal(p.answer, digits, p.prompt);
    } else if ((m = p.prompt.match(/^(\d+)\/(\d+) = \?\/1000$/))) {
      assert.equal(p.answer, (Number(m[1]) * 1000) / Number(m[2]), p.prompt);
      assert.ok(Number.isInteger(p.answer), `milésimas exactas: ${p.prompt}`);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
  });

  // Nivel 10: cubos, potencias de 2 y escalas
  Levels.generateBoss(10, Levels.createRng(110)).forEach((p) => {
    let m;
    if ((m = p.prompt.match(/^(\d+)³ = \?$/))) {
      assert.equal(p.answer, Math.pow(Number(m[1]), 3), p.prompt);
    } else if ((m = p.prompt.match(/^2([⁰¹²³⁴⁵⁶⁷⁸⁹]+) = \?$/))) {
      const sup = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
      const exp = m[1].split('').reduce((acc, ch) => acc * 10 + sup[ch], 0);
      assert.equal(p.answer, Math.pow(2, exp), p.prompt);
    } else if ((m = p.prompt.match(/^([\d.  ]+) = \? miles$/))) {
      const n = Number(m[1].replace(/[.  ]/g, ''));
      assert.equal(p.answer, n / 1000, p.prompt);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
  });
});

test('el nivel 11 estima con ±2% y sus productos especiales son exactos', () => {
  Levels.generateBoss(11, Levels.createRng(111)).forEach((p) => {
    const m = p.prompt.match(/^(\d+)(?: × (\d+))?(²)? [=≈] \?$/) || p.prompt.match(/^(\d+) × (\d+) ≈ \?$/);
    if (p.prompt.includes('≈')) {
      const mm = p.prompt.match(/^(\d+) × (\d+) ≈ \?$/);
      assert.ok(mm, p.prompt);
      const exact = Number(mm[1]) * Number(mm[2]);
      assert.equal(p.answer, exact);
      assert.ok(p.tolerance >= Math.round(exact * 0.015), `margen ~2%: ${p.prompt}`);
    } else if (p.prompt.includes('²')) {
      const mm = p.prompt.match(/^(\d+)² = \?$/);
      assert.equal(p.answer, Number(mm[1]) * Number(mm[1]), p.prompt);
      assert.ok(!p.tolerance);
    } else {
      const mm = p.prompt.match(/^(\d+) × (\d+) = \?$/);
      assert.ok(mm, p.prompt);
      assert.equal(p.answer, Number(mm[1]) * Number(mm[2]), p.prompt);
      assert.equal((Number(mm[1]) + Number(mm[2])) % 200, 0, `centro en centena: ${p.prompt}`);
    }
    assert.ok(p.answer <= 999999, `tecleable: ${p.prompt} (${p.answer})`);
  });
});

test('las cadenas del nivel 12 son enteras y el blitz reutiliza técnicas', () => {
  const chains = Levels.generatePractice(12, 'cadenas', 40, Levels.createRng(12));
  chains.forEach((p) => {
    let m;
    if ((m = p.prompt.match(/^\((\d+) \+ (\d+)\) × (\d+)% = \?$/))) {
      assert.equal(p.answer, ((Number(m[1]) + Number(m[2])) * Number(m[3])) / 100, p.prompt);
    } else if ((m = p.prompt.match(/^(\d+) × (\d+) − (\d+) = \?$/))) {
      assert.equal(p.answer, Number(m[1]) * Number(m[2]) - Number(m[3]), p.prompt);
      assert.ok(p.answer > 0, `positivo: ${p.prompt}`);
    } else if ((m = p.prompt.match(/^(\d+)% de (\d+) \+ (\d+)% de (\d+) = \?$/))) {
      assert.equal(m[2], m[4], 'mismo número base');
      assert.equal(p.answer, ((Number(m[1]) + Number(m[3])) * Number(m[2])) / 100, p.prompt);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
    assert.ok(Number.isInteger(p.answer), `entera: ${p.prompt}`);
  });

  const blitz = Levels.generatePractice(12, 'blitz', 60, Levels.createRng(120));
  const skillSet = new Set(blitz.flatMap((p) => p.skills));
  assert.ok(skillSet.size >= 8, `el blitz varía técnicas (${skillSet.size} distintas)`);
  blitz.forEach((p) => {
    assert.ok(Number.isInteger(p.answer), `respuesta entera: ${p.prompt}`);
    assert.ok(p.key.startsWith('c_'), 'conserva la clave original');
  });
});

test('SKILL_META cubre todas las habilidades que emiten los generadores', () => {
  for (const level of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]) {
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
