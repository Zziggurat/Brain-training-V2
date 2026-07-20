const test = require('node:test');
const assert = require('node:assert/strict');

const Levels = require('../lib/levels');

test('define las 12 etapas y todas son jugables', () => {
  assert.equal(Levels.LEVELS.length, 12);
  const playable = Levels.LEVELS.filter((l) => Array.isArray(l.techniques) && l.techniques.length > 0);
  assert.equal(playable.length, 12);
  Levels.LEVELS.forEach((l) => {
    assert.ok(l.id >= 1 && l.id <= 12);
    assert.ok(l.title.length > 0 && l.tagline.length > 0);
  });
  // El nuevo esqueleto: porcentajes DESPUÉS de división y fracciones
  assert.equal(Levels.getLevel(2).title, 'Duplicar y partir');
  assert.equal(Levels.getLevel(3).title, 'Multiplicar por un dígito');
  assert.equal(Levels.getLevel(7).title, 'Fracciones y decimales útiles');
  assert.equal(Levels.getLevel(8).title, 'Porcentajes en la vida real');
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
    assert.ok(problems.length >= 12, `etapa ${level} genera su tanda completa`);
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

test('etapa 1: complementos, compensaciones y cadenas correctos', () => {
  const practice = Levels.generatePractice(1, 'complemento', 30, Levels.createRng(99));
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
  const cadenas = Levels.generatePractice(1, 'cadena', 30, Levels.createRng(14));
  cadenas.forEach((p) => {
    const terms = p.prompt.replace(' = ?', '').split(' + ').map(Number);
    assert.ok(terms.length >= 3, `varios sumandos: ${p.prompt}`);
    assert.equal(terms.reduce((s, t) => s + t, 0), p.answer, p.prompt);
    // Al menos una pareja de unidades que suma 10
    const units = terms.map((t) => t % 10);
    const hasPair = units.some((u, i) => units.some((v, j) => i !== j && u + v === 10));
    assert.ok(hasPair, `pareja al 10 en: ${p.prompt}`);
  });
});

test('etapa 2: dobles, mitades y atajos de 4/8/5/25 correctos', () => {
  Levels.generateBoss(2, Levels.createRng(22)).forEach((p) => {
    let m;
    if ((m = p.prompt.match(/^Doble de (\d+) = \?$/))) {
      assert.equal(p.answer, Number(m[1]) * 2, p.prompt);
    } else if ((m = p.prompt.match(/^Mitad de (\d+) = \?$/))) {
      assert.equal(Number(m[1]) % 2, 0, `par: ${p.prompt}`);
      assert.equal(p.answer, Number(m[1]) / 2, p.prompt);
    } else if ((m = p.prompt.match(/^(\d+) × (\d+) = \?$/))) {
      assert.ok([4, 5, 8, 25, 50].includes(Number(m[2])), `factor con truco: ${p.prompt}`);
      assert.equal(p.answer, Number(m[1]) * Number(m[2]), p.prompt);
    } else if ((m = p.prompt.match(/^(\d+) ÷ (\d+) = \?$/))) {
      assert.equal(Number(m[1]) % Number(m[2]), 0, `exacta: ${p.prompt}`);
      assert.equal(p.answer, Number(m[1]) / Number(m[2]), p.prompt);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
  });
});

test('etapa 3: la distributiva por un dígito es correcta', () => {
  Levels.generateBoss(3, Levels.createRng(33)).forEach((p) => {
    const m = p.prompt.match(/^(\d+) × (\d+) = \?$/);
    assert.ok(m, p.prompt);
    const [a, b] = [Number(m[1]), Number(m[2])];
    assert.ok(a >= 3 && a <= 9, `un dígito: ${p.prompt}`);
    assert.equal(p.answer, a * b, p.prompt);
  });
});

test('etapa 4: las anclas multiplican correctamente', () => {
  Levels.generateBoss(4, Levels.createRng(31)).forEach((p) => {
    const m = p.prompt.match(/(\d+) × (\d+) = \?/);
    assert.ok(m, p.prompt);
    assert.equal(Number(m[1]) * Number(m[2]), p.answer);
    assert.ok([11, 12, 15, 75, 19, 21, 99].includes(Number(m[1])), `ancla válida: ${p.prompt}`);
  });
});

test('etapa 5: la multiplicación 2×2 es correcta y usa las formas esperadas', () => {
  Levels.generateBoss(5, Levels.createRng(44)).forEach((p) => {
    const m = p.prompt.match(/^(\d+) × (\d+) = \?$/);
    assert.ok(m, p.prompt);
    assert.equal(Number(m[1]) * Number(m[2]), p.answer);
  });
  const base100 = Levels.generatePractice(5, 'base-100', 20, Levels.createRng(4));
  base100.forEach((p) => {
    const m = p.prompt.match(/^(\d+) × (\d+) = \?$/);
    [Number(m[1]), Number(m[2])].forEach((f) => assert.ok(f >= 91 && f <= 109 && f !== 100, p.prompt));
  });
  const difsq = Levels.generatePractice(5, 'dif-cuadrados', 20, Levels.createRng(5));
  difsq.forEach((p) => {
    const m = p.prompt.match(/^(\d+) × (\d+) = \?$/);
    assert.equal((Number(m[1]) + Number(m[2])) % 20, 0, `centro redondo: ${p.prompt}`);
  });
});

test('etapa 6: la división es exacta y los restos correctos', () => {
  Levels.generateBoss(6, Levels.createRng(55)).forEach((p) => {
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

test('etapa 7: fracciones a %, milésimas y periódicos correctos', () => {
  Levels.generateBoss(7, Levels.createRng(77)).forEach((p) => {
    let m;
    if ((m = p.prompt.match(/^(\d+)\/(\d+) = \?%$/))) {
      assert.equal(p.answer, (Number(m[1]) * 100) / Number(m[2]), p.prompt);
      assert.ok(Number.isInteger(p.answer), `porcentaje entero: ${p.prompt}`);
    } else if ((m = p.prompt.match(/^(\d+)\/(\d+) = \?\/1000$/))) {
      assert.equal(p.answer, (Number(m[1]) * 1000) / Number(m[2]), p.prompt);
    } else if ((m = p.prompt.match(/^(\d+)\/(\d+) → 3 primeros decimales = \?$/))) {
      const [num, den] = [Number(m[1]), Number(m[2])];
      let digits = 0;
      let r = num % den;
      for (let i = 0; i < 3; i++) {
        r *= 10;
        digits = digits * 10 + Math.floor(r / den);
        r %= den;
      }
      assert.equal(p.answer, digits, p.prompt);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
  });
});

test('etapa 8: pilares, espejo y descuentos con resultado entero', () => {
  Levels.generateBoss(8, Levels.createRng(88)).forEach((p) => {
    let m;
    if ((m = p.prompt.match(/^(\d+)% de (\d+) = \?$/))) {
      assert.equal((Number(m[1]) * Number(m[2])) % 100, 0, `entero: ${p.prompt}`);
      assert.equal(p.answer, (Number(m[1]) * Number(m[2])) / 100, p.prompt);
    } else if ((m = p.prompt.match(/^(\d+) − (\d+)% = \?$/))) {
      assert.equal(p.answer, Number(m[1]) - (Number(m[1]) * Number(m[2])) / 100, p.prompt);
    } else if ((m = p.prompt.match(/^(\d+) \+ (\d+)% = \?$/))) {
      assert.equal(p.answer, Number(m[1]) + (Number(m[1]) * Number(m[2])) / 100, p.prompt);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
    assert.ok(Number.isInteger(p.answer), `respuesta entera: ${p.prompt}`);
  });
});

test('etapa 9: proporciones y cadenas correctas', () => {
  Levels.generateBoss(9, Levels.createRng(99)).forEach((p) => {
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
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
  });
});

test('etapa 10: estimaciones con margen y detectores de errores', () => {
  Levels.generateBoss(10, Levels.createRng(110)).forEach((p) => {
    let m;
    if ((m = p.prompt.match(/^(\d+) × (\d+) ≈ \?$/))) {
      const exact = Number(m[1]) * Number(m[2]);
      assert.equal(p.answer, exact);
      assert.ok(p.tolerance >= Math.round(exact * 0.04), `margen ~5%: ${p.prompt}`);
    } else if ((m = p.prompt.match(/^(\d+)% de (\d+) ≈ \?$/))) {
      assert.equal(p.answer, Math.round((Number(m[1]) * Number(m[2])) / 100));
      assert.ok(p.tolerance >= 3);
    } else if ((m = p.prompt.match(/^([\d.\s ]+) = \? miles$/))) {
      assert.equal(p.answer, Number(m[1].replace(/[.\s ]/g, '')) / 1000, p.prompt);
    } else if ((m = p.prompt.match(/^Última cifra de (\d+) × (\d+) = \?$/))) {
      assert.equal(p.answer, (Number(m[1]) * Number(m[2])) % 10, p.prompt);
    } else if ((m = p.prompt.match(/^Resto de \((\d+) × (\d+)\) ÷ 9 = \?$/))) {
      assert.equal(p.answer, (Number(m[1]) * Number(m[2])) % 9, p.prompt);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
  });
});

test('etapa 11: cuadrados 13-50, raíces, cubos y potencias correctos', () => {
  const sup = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
  Levels.generateBoss(11, Levels.createRng(111)).forEach((p) => {
    let m;
    if ((m = p.prompt.match(/^(\d+)² = \?$/))) {
      const n = Number(m[1]);
      assert.ok(n >= 13 && n <= 50, `rango 13-50: ${p.prompt}`);
      assert.equal(p.answer, n * n);
    } else if ((m = p.prompt.match(/^√(\d+) ≈ \?$/))) {
      assert.equal(p.answer, Math.round(Math.sqrt(Number(m[1]))));
      assert.equal(p.tolerance, 1);
    } else if ((m = p.prompt.match(/^(\d+)³ = \?$/))) {
      assert.equal(p.answer, Math.pow(Number(m[1]), 3), p.prompt);
    } else if ((m = p.prompt.match(/^2([⁰¹²³⁴⁵⁶⁷⁸⁹]+) = \?$/))) {
      const exp = m[1].split('').reduce((acc, ch) => acc * 10 + sup[ch], 0);
      assert.equal(p.answer, Math.pow(2, exp), p.prompt);
    } else {
      assert.fail('formato inesperado: ' + p.prompt);
    }
  });
});

test('etapa 12: élite mezcla 3×3, cadenas y blitz variado', () => {
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
  });
  const est3 = Levels.generatePractice(12, 'est-3x3', 15, Levels.createRng(120));
  est3.forEach((p) => {
    const m = p.prompt.match(/^(\d+) × (\d+) ≈ \?$/);
    assert.ok(m, p.prompt);
    const exact = Number(m[1]) * Number(m[2]);
    assert.equal(p.answer, exact);
    assert.ok(p.tolerance >= Math.round(exact * 0.015), `margen ~2%: ${p.prompt}`);
    assert.ok(p.answer <= 999999, `tecleable: ${p.answer}`);
  });
  const blitz = Levels.generatePractice(12, 'blitz', 60, Levels.createRng(121));
  const skillSet = new Set(blitz.flatMap((p) => p.skills));
  assert.ok(skillSet.size >= 10, `el blitz varía técnicas (${skillSet.size} distintas)`);
  blitz.forEach((p) => {
    assert.ok(Number.isInteger(p.answer), `respuesta entera: ${p.prompt}`);
    assert.ok(p.key.startsWith('c_'), 'conserva la clave original');
  });
});

test('la progresión de dificultad por tramos es efectiva', () => {
  // Mismo generador, tramos distintos: el avanzado alcanza números mayores
  const maxOperand = (problems) =>
    Math.max(...problems.flatMap((p) => (p.prompt.match(/\d+/g) || []).map(Number)));
  const t1 = Levels.generatePractice(2, 'dobles', 30, Levels.createRng(9), 1);
  const t3 = Levels.generatePractice(2, 'dobles', 30, Levels.createRng(9), 3);
  assert.ok(maxOperand(t3) > maxOperand(t1) * 2, `t1=${maxOperand(t1)} < t3=${maxOperand(t3)}`);
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

test('el desbloqueo requiere medalla en la etapa anterior', () => {
  assert.equal(Levels.isUnlocked(1, {}), true);
  assert.equal(Levels.isUnlocked(2, {}), false);
  assert.equal(Levels.isUnlocked(2, { 1: { medal: 'bronze' } }), true);
  assert.equal(Levels.isUnlocked(3, { 1: { medal: 'gold' } }), false);
  assert.equal(Levels.betterMedal('silver', 'bronze'), 'silver');
  assert.equal(Levels.betterMedal(null, 'gold'), 'gold');
});
