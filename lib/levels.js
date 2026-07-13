/*
 * Niveles de cálculo mental de Brain Training V2.
 *
 * Define el itinerario de 12 niveles (metadatos para el mapa) y el
 * contenido jugable de los primeros niveles: técnicas con explicación
 * paso a paso, generadores deterministas de ejercicios y evaluación de
 * medallas del "jefe de nivel" (bronce/plata/oro).
 *
 * Los generadores reciben un RNG inyectable (determinista en tests) y
 * producen problemas con el formato que entiende la pantalla de
 * entrenamiento y el motor adaptativo:
 *   { type:'custom', prompt, answer, skills, difficulty, targetTimeMs,
 *     key, hint }
 * `key` agrupa por técnica y tramo de dificultad (no por instancia) para
 * que la maestría y el repaso espaciado no crezcan sin límite.
 */
(function (globalScope, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    const namespace = factory();
    const target = typeof globalScope !== 'undefined' ? globalScope : {};
    target.Levels = namespace;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  /* RNG determinista (mulberry32): misma semilla → misma secuencia. */
  function createRng(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function randInt(rng, min, max) {
    return Math.floor(rng() * (max - min + 1)) + min;
  }

  function pick(rng, list) {
    return list[Math.floor(rng() * list.length)];
  }

  /* ------------------------------------------------------------
     Nivel 1 — Sumas y restas turbo
     ------------------------------------------------------------ */

  function genComplemento(rng) {
    const toThousand = rng() < 0.5;
    if (toThousand) {
      const n = randInt(rng, 105, 995);
      return {
        type: 'custom',
        prompt: `${n} + ? = 1000`,
        answer: 1000 - n,
        skills: ['add.complement'],
        difficulty: 1000,
        targetTimeMs: 4000,
        key: 'c_add.complement_1000',
        hint: 'Completa primero a la centena siguiente y luego suma de cien en cien.',
      };
    }
    const n = randInt(rng, 11, 95);
    return {
      type: 'custom',
      prompt: `${n} + ? = 100`,
      answer: 100 - n,
      skills: ['add.complement'],
      difficulty: 900,
      targetTimeMs: 3000,
      key: 'c_add.complement_100',
      hint: 'Unidades hasta la decena siguiente, decenas hasta 100.',
    };
  }

  function genCompensacion(rng) {
    const resta = rng() < 0.55;
    const round = randInt(rng, 2, 9) * 100;
    const delta = randInt(rng, 1, 9);
    const b = rng() < 0.5 ? round - delta : round + delta;
    if (resta) {
      const a = randInt(rng, round + 10, round + 690);
      return {
        type: 'custom',
        prompt: `${a} − ${b} = ?`,
        answer: a - b,
        skills: ['add.compensation'],
        difficulty: 1100,
        targetTimeMs: 5000,
        key: 'c_add.compensation_sub',
        hint: `Resta ${round} y compensa: ${a} − ${round} ${b < round ? '+' : '−'} ${Math.abs(round - b)}.`,
      };
    }
    const a = randInt(rng, 120, 780);
    return {
      type: 'custom',
      prompt: `${a} + ${b} = ?`,
      answer: a + b,
      skills: ['add.compensation'],
      difficulty: 1060,
      targetTimeMs: 5000,
      key: 'c_add.compensation_add',
      hint: `Suma ${round} y compensa: ${a} + ${round} ${b < round ? '−' : '+'} ${Math.abs(round - b)}.`,
    };
  }

  function genBloques(rng) {
    const fourDigits = rng() < 0.4;
    const loTens = fourDigits ? 101 : 11;
    const hiTens = fourDigits ? 899 : 89;
    const resta = rng() < 0.5;
    // Se componen las cifras garantizando llevada en las unidades para
    // que el ejercicio nunca sea trivial.
    let tensA = randInt(rng, loTens, hiTens);
    let tensB = randInt(rng, loTens, hiTens);
    let unitsA;
    let unitsB;
    if (resta) {
      unitsA = randInt(rng, 0, 8);
      unitsB = randInt(rng, unitsA + 1, 9); // unidades de a < unidades de b
      if (tensA <= tensB) tensA = tensB + randInt(rng, 1, Math.max(1, hiTens - tensB));
    } else {
      unitsA = randInt(rng, 2, 9);
      unitsB = randInt(rng, 11 - unitsA, 9); // suma de unidades ≥ 11
    }
    const a = tensA * 10 + unitsA;
    const b = tensB * 10 + unitsB;
    return {
      type: 'custom',
      prompt: resta ? `${a} − ${b} = ?` : `${a} + ${b} = ?`,
      answer: resta ? a - b : a + b,
      skills: ['add.blocks'],
      difficulty: fourDigits ? 1160 : 1020,
      targetTimeMs: fourDigits ? 8000 : 6000,
      key: `c_add.blocks_${fourDigits ? '4d' : '3d'}`,
      hint: 'Ve por bloques: primero centenas, luego decenas y al final unidades.',
    };
  }

  /* ------------------------------------------------------------
     Nivel 2 — Porcentajes y fracciones clave
     ------------------------------------------------------------ */

  function genPctBase(rng) {
    const variants = [
      { p: 50, factor: 2, diff: 900 },
      { p: 25, factor: 4, diff: 1000 },
      { p: 10, factor: 10, diff: 900 },
      { p: 1, factor: 100, diff: 950 },
      { p: 5, factor: 20, diff: 1020 },
    ];
    const v = pick(rng, variants);
    // Números "feos": múltiplos exactos del divisor, pero no redondos.
    let n = v.factor * randInt(rng, 3, 60);
    if (n % 100 === 0) n += v.factor;
    return {
      type: 'custom',
      prompt: `${v.p}% de ${n} = ?`,
      answer: Math.round((n * v.p) / 100),
      skills: ['pct.base'],
      difficulty: v.diff,
      targetTimeMs: 5000,
      key: `c_pct.base_${v.p}`,
      hint:
        v.p === 25
          ? 'El 25% es dividir entre 4 (la mitad de la mitad).'
          : v.p === 5
            ? 'El 5% es la mitad del 10%.'
            : 'Mueve la coma: 10% quita un cero, 1% quita dos.',
    };
  }

  function genPctCompuesto(rng) {
    const variants = [
      { p: 15, mult: 20, diff: 1100, hint: '15% = 10% + 5%.' },
      { p: 20, mult: 5, diff: 1000, hint: '20% es dividir entre 5 (o doblar el 10%).' },
      { p: 30, mult: 10, diff: 1080, hint: '30% = 3 veces el 10%.' },
      { p: 75, mult: 4, diff: 1120, hint: '75% = mitad + cuarto (o resta el 25%).' },
      { p: 35, mult: 20, diff: 1180, hint: '35% = 25% + 10%.' },
    ];
    const v = pick(rng, variants);
    let n = v.mult * randInt(rng, 3, Math.floor(600 / v.mult));
    if (n % 100 === 0) n += v.mult;
    return {
      type: 'custom',
      prompt: `${v.p}% de ${n} = ?`,
      answer: Math.round((n * v.p) / 100),
      skills: ['pct.compose'],
      difficulty: v.diff,
      targetTimeMs: 6000,
      key: `c_pct.compose_${v.p}`,
      hint: v.hint,
    };
  }

  /* ------------------------------------------------------------
     Nivel 3 — Multiplicar con anclas
     ------------------------------------------------------------ */

  function genAncla(rng, anchors, skillId, baseDiff, hints) {
    const anchor = pick(rng, anchors);
    const maxN = anchor >= 99 ? 99 : anchor >= 19 ? 49 : 89;
    let n = randInt(rng, 13, maxN);
    if (n % 10 === 0) n += 1;
    return {
      type: 'custom',
      prompt: `${anchor} × ${n} = ?`,
      answer: anchor * n,
      skills: [skillId],
      difficulty: baseDiff + (n > 40 ? 60 : 0),
      targetTimeMs: 7000,
      key: `c_${skillId}_${anchor}`,
      hint: hints[anchor],
    };
  }

  function genAncla11_12(rng) {
    return genAncla(rng, [11, 12], 'anchor.easy', 1080, {
      11: '11n = 10n + n.',
      12: '12n = 10n + 2n.',
    });
  }

  function genAncla15_25(rng) {
    return genAncla(rng, [15, 25], 'anchor.quarter', 1150, {
      15: '15n = 10n + la mitad de 10n.',
      25: '25n = (n × 100) ÷ 4.',
    });
  }

  function genAncla19_99(rng) {
    return genAncla(rng, [19, 21, 99], 'anchor.near', 1200, {
      19: '19n = 20n − n.',
      21: '21n = 20n + n.',
      99: '99n = 100n − n.',
    });
  }

  /* ------------------------------------------------------------
     Definición de niveles
     ------------------------------------------------------------ */

  const DEFAULT_CRITERIA = {
    bronze: { acc: 0.8 },
    silver: { acc: 0.9, avgMs: 6000 },
    gold: { acc: 0.95, avgMs: 3500 },
  };

  const LEVELS = [
    {
      id: 1,
      emoji: '⚡',
      title: 'Sumas y restas turbo',
      tagline: 'Fluidez con números de 3 y 4 cifras, sin papel.',
      bossCount: 20,
      criteria: DEFAULT_CRITERIA,
      techniques: [
        {
          id: 'complemento',
          name: 'Hacer 100 / 1000',
          summary: 'Complementos: cuánto falta para llegar al número redondo.',
          steps: [
            'Para llegar a 100: unidades hasta la decena siguiente y decenas hasta 100. Ej.: 63 → 7 lleva a 70, 30 lleva a 100 → 37.',
            'Para llegar a 1000: primero a la centena siguiente, luego de cien en cien. Ej.: 740 → 60 lleva a 800, 200 lleva a 1000 → 260.',
            'Truco de control: las cifras suman 9 salvo la última, que suma 10.',
          ],
          generate: genComplemento,
        },
        {
          id: 'compensacion',
          name: 'Compensar',
          summary: 'Opera con el número redondo y devuelve la diferencia.',
          steps: [
            '304 − 197: resta 200 (fácil) → 104, y devuelve 3 → 107.',
            '456 + 298: suma 300 → 756, y quita 2 → 754.',
            'Regla: si restas de más, devuelve sumando; si sumas de más, devuelve restando.',
          ],
          generate: genCompensacion,
        },
        {
          id: 'bloques',
          name: 'Bloques C-D-U',
          summary: 'Suma o resta por bloques de centenas, decenas y unidades.',
          steps: [
            '347 + 285: 300+200=500, 40+80=120, 7+5=12 → 500+120+12 = 632.',
            'Empieza siempre por el bloque grande: así la primera cifra que dices ya es casi la respuesta.',
            'En restas, si un bloque no alcanza, pide 10 al bloque superior antes de restar.',
          ],
          generate: genBloques,
        },
      ],
    },
    {
      id: 2,
      emoji: '💯',
      title: 'Porcentajes clave',
      tagline: '1%, 5%, 10%, 25%, 50% al vuelo, también con números feos.',
      bossCount: 16,
      criteria: DEFAULT_CRITERIA,
      techniques: [
        {
          id: 'pct-base',
          name: 'Porcentajes pilares',
          summary: '50%, 25%, 10%, 5% y 1%: los cinco pilares.',
          steps: [
            '50% = mitad · 25% = mitad de la mitad · 10% = quitar un cero.',
            '5% = mitad del 10% · 1% = quitar dos ceros.',
            'Truco espejo: X% de Y = Y% de X. 8% de 25 = 25% de 8 = 2.',
          ],
          generate: genPctBase,
        },
        {
          id: 'pct-compuesto',
          name: 'Componer porcentajes',
          summary: 'Construye 15%, 20%, 30%, 35%, 75% sumando pilares.',
          steps: [
            '15% = 10% + 5%. Ej.: 15% de 240 = 24 + 12 = 36.',
            '75% = 50% + 25% (o el total menos su cuarto).',
            '35% = 25% + 10%. Piensa siempre en qué pilares lo componen.',
          ],
          generate: genPctCompuesto,
        },
      ],
    },
    {
      id: 3,
      emoji: '⚓',
      title: 'Multiplicar con anclas',
      tagline: '11, 12, 15, 19, 21, 25 y 99 por cualquier número, de cabeza.',
      bossCount: 18,
      criteria: { bronze: { acc: 0.8 }, silver: { acc: 0.9, avgMs: 7000 }, gold: { acc: 0.95, avgMs: 5000 } },
      techniques: [
        {
          id: 'ancla-facil',
          name: 'Anclas 11 y 12',
          summary: 'Multiplica por la decena y ajusta con 1 o 2 veces el número.',
          steps: [
            '11 × 34 = 340 + 34 = 374.',
            '12 × 26 = 260 + 52 = 312.',
            'Siempre igual: 10n primero (fácil) y el resto encima.',
          ],
          generate: genAncla11_12,
        },
        {
          id: 'ancla-cuarto',
          name: 'Anclas 15 y 25',
          summary: '15n con mitades; 25n con el truco del ÷4.',
          steps: [
            '15 × 24: 10×24 = 240, su mitad 120 → 360.',
            '25 × 32: 32 × 100 = 3200, ÷4 → 800.',
            'Para ÷4: divide dos veces entre 2.',
          ],
          generate: genAncla15_25,
        },
        {
          id: 'ancla-cercana',
          name: 'Anclas 19, 21 y 99',
          summary: 'Usa la decena o centena vecina y compensa.',
          steps: [
            '19 × 23 = 20×23 − 23 = 460 − 23 = 437.',
            '21 × 34 = 20×34 + 34 = 680 + 34 = 714.',
            '99 × 47 = 4700 − 47 = 4653.',
          ],
          generate: genAncla19_99,
        },
      ],
    },
    { id: 4, emoji: '✖️', title: 'Multiplicación 2×2 de cabeza', tagline: 'Base 100, diferencia de cuadrados y distributiva.', comingSoon: true },
    { id: 5, emoji: '➗', title: 'División mental y divisibilidad', tagline: 'Reglas de 2 a 11 y división por 4, 8, 25 y 50.', comingSoon: true },
    { id: 6, emoji: '🎯', title: 'Estimación y control de errores', tagline: 'Respuesta razonable al instante y ajuste fino.', comingSoon: true },
    { id: 7, emoji: '√', title: 'Cuadrados y raíces', tagline: 'Cuadrados 31²–50² y raíces con un decimal.', comingSoon: true },
    { id: 8, emoji: '⚖️', title: 'Proporciones y regla de tres', tagline: 'Razones, tasas y escalado rápido con contexto.', comingSoon: true },
    { id: 9, emoji: '🔁', title: 'Decimales y fracciones difíciles', tagline: '1/7, 1/11, 1/13 y patrones periódicos.', comingSoon: true },
    { id: 10, emoji: '🧊', title: 'Potencias útiles y cubos', tagline: 'Cubos 1–12, potencias de 2 y prefijos k/M.', comingSoon: true },
    { id: 11, emoji: '🏗️', title: '3×3 aproximado', tagline: 'Productos de 3 cifras con error menor del 2%.', comingSoon: true },
    { id: 12, emoji: '👑', title: 'Mezcla de élite', tagline: 'Problemas encadenados de la vida real.', comingSoon: true },
  ];

  function getLevel(id) {
    return LEVELS.find((l) => l.id === id) || null;
  }

  function getTechnique(levelId, techniqueId) {
    const level = getLevel(levelId);
    if (!level || !level.techniques) return null;
    return level.techniques.find((t) => t.id === techniqueId) || null;
  }

  /* Genera una tanda evitando repetir el mismo enunciado consecutivo. */
  function generateBatch(generators, count, rng) {
    const problems = [];
    let lastPrompt = null;
    let guard = 0;
    while (problems.length < count && guard < count * 30) {
      guard++;
      const gen = generators[problems.length % generators.length];
      const problem = gen(rng);
      if (problem.prompt === lastPrompt) continue;
      problems.push(problem);
      lastPrompt = problem.prompt;
    }
    return problems;
  }

  function generatePractice(levelId, techniqueId, count = 10, rng = createRng(Date.now() >>> 0)) {
    const technique = getTechnique(levelId, techniqueId);
    if (!technique) return [];
    return generateBatch([technique.generate], count, rng);
  }

  function generateBoss(levelId, rng = createRng(Date.now() >>> 0)) {
    const level = getLevel(levelId);
    if (!level || !level.techniques) return [];
    const generators = level.techniques.map((t) => t.generate);
    return generateBatch(generators, level.bossCount || 20, rng);
  }

  /*
   * Evalúa una tanda de jefe de nivel: precisión + tiempo medio por ítem
   * contra los criterios del nivel. Devuelve la mejor medalla alcanzada.
   */
  function evaluateBoss(results, criteria = DEFAULT_CRITERIA) {
    const total = Array.isArray(results) ? results.length : 0;
    if (!total) return { medal: null, accuracy: 0, avgMs: 0, total: 0 };
    const correct = results.filter((r) => r && r.correct).length;
    const accuracy = correct / total;
    const timed = results.filter((r) => r && Number.isFinite(r.timeMs) && r.timeMs > 0);
    const avgMs = timed.length ? timed.reduce((sum, r) => sum + r.timeMs, 0) / timed.length : 0;
    const meets = (c) => accuracy >= c.acc && (!c.avgMs || (avgMs > 0 && avgMs <= c.avgMs));
    let medal = null;
    if (meets(criteria.bronze)) medal = 'bronze';
    if (meets(criteria.silver)) medal = 'silver';
    if (meets(criteria.gold)) medal = 'gold';
    return { medal, accuracy, avgMs, total, correct };
  }

  const MEDAL_ORDER = { bronze: 1, silver: 2, gold: 3 };

  function betterMedal(a, b) {
    const va = MEDAL_ORDER[a] || 0;
    const vb = MEDAL_ORDER[b] || 0;
    return va >= vb ? a : b;
  }

  /* Un nivel se desbloquea con al menos bronce en el anterior. */
  function isUnlocked(levelId, progress) {
    if (levelId <= 1) return true;
    const prev = progress && progress[levelId - 1];
    return !!(prev && MEDAL_ORDER[prev.medal]);
  }

  return {
    LEVELS,
    MEDAL_ORDER,
    createRng,
    getLevel,
    getTechnique,
    generatePractice,
    generateBoss,
    evaluateBoss,
    betterMedal,
    isUnlocked,
  };
});
