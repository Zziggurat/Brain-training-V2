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
     Nivel 4 — Multiplicación 2×2 de cabeza
     ------------------------------------------------------------ */

  function genBase100(rng) {
    const side = () => (rng() < 0.5 ? randInt(rng, 91, 99) : randInt(rng, 101, 109));
    const a = side();
    const b = side();
    const da = a - 100;
    const db = b - 100;
    const hint =
      da > 0 && db > 0
        ? 'Cruza y suma: 104×107 → 104+7 = 111 → 11100; añade 4×7 → 11128.'
        : da < 0 && db < 0
          ? 'Cruza y resta: 96×93 → 96−7 = 89 → 8900; añade 4×7 → 8928.'
          : 'Signos mixtos: 103×97 → 103−3 = 100 → 10000; resta 3×3 → 9991.';
    return {
      type: 'custom',
      prompt: `${a} × ${b} = ?`,
      answer: a * b,
      skills: ['mul2.base100'],
      difficulty: 1250,
      targetTimeMs: 9000,
      key: 'c_mul2.base100',
      hint,
    };
  }

  function genDifSq(rng) {
    const center = pick(rng, [20, 30, 40, 50, 60, 70, 80, 90]);
    const d = randInt(rng, 2, 8);
    return {
      type: 'custom',
      prompt: `${center + d} × ${center - d} = ?`,
      answer: center * center - d * d,
      skills: ['mul2.difsq'],
      difficulty: 1220,
      targetTimeMs: 8000,
      key: 'c_mul2.difsq',
      hint: `Mismo centro ${center}: es ${center}² − ${d}².`,
    };
  }

  function genRound2x2(rng) {
    const anchor = pick(rng, [29, 31, 39, 41, 49, 51, 59, 61, 69, 71, 79, 81, 89, 91]);
    let a = randInt(rng, 13, 97);
    if (a % 10 === 0) a += 3;
    const base = Math.round(anchor / 10) * 10;
    return {
      type: 'custom',
      prompt: `${a} × ${anchor} = ?`,
      answer: a * anchor,
      skills: ['mul2.round'],
      difficulty: 1280 + (a > 50 ? 40 : 0),
      targetTimeMs: 9000,
      key: 'c_mul2.round',
      hint: `${anchor} está al lado de ${base}: ${base}×${a} ${anchor < base ? '−' : '+'} ${a}.`,
    };
  }

  /* ------------------------------------------------------------
     Nivel 5 — División mental y divisibilidad
     ------------------------------------------------------------ */

  function genDivRules(rng) {
    const divisor = pick(rng, [3, 4, 5, 9]);
    const n = randInt(rng, 112, 989);
    const hints = {
      3: 'Suma las cifras: el resto de esa suma entre 3 es el mismo.',
      9: 'Suma las cifras: el resto de esa suma entre 9 es el mismo.',
      4: 'Solo cuentan las dos últimas cifras.',
      5: 'Solo cuenta la última cifra.',
    };
    return {
      type: 'custom',
      prompt: `Resto de ${n} ÷ ${divisor} = ?`,
      answer: n % divisor,
      skills: ['div2.rules'],
      difficulty: 1150,
      targetTimeMs: 6000,
      key: `c_div2.rules_${divisor}`,
      hint: hints[divisor],
    };
  }

  function genDivTricks(rng) {
    const divisor = pick(rng, [4, 5, 8, 25, 50]);
    const q = randInt(rng, 12, 96);
    const hints = {
      4: 'Dividir entre 4 = mitad de la mitad.',
      5: 'Dividir entre 5 = doblar y quitar un cero.',
      8: 'Dividir entre 8 = tres mitades seguidas.',
      25: 'Dividir entre 25 = multiplicar por 4 y quitar dos ceros.',
      50: 'Dividir entre 50 = doblar y quitar dos ceros.',
    };
    return {
      type: 'custom',
      prompt: `${divisor * q} ÷ ${divisor} = ?`,
      answer: q,
      skills: ['div2.tricks'],
      difficulty: 1200,
      targetTimeMs: 7000,
      key: `c_div2.tricks_${divisor}`,
      hint: hints[divisor],
    };
  }

  function genDivLong(rng) {
    const divisor = randInt(rng, 3, 9);
    const q = randInt(rng, Math.ceil(100 / divisor) + 1, Math.floor(9999 / divisor));
    return {
      type: 'custom',
      prompt: `${divisor * q} ÷ ${divisor} = ?`,
      answer: q,
      skills: ['div2.long'],
      difficulty: 1260 + (q >= 100 ? 40 : 0),
      targetTimeMs: 10000,
      key: 'c_div2.long',
      hint: 'Divide por bloques desde la izquierda y arrastra el resto al siguiente bloque.',
    };
  }

  /* ------------------------------------------------------------
     Nivel 6 — Estimación y control de errores
     ------------------------------------------------------------ */

  function roundTo10(n) {
    return Math.round(n / 10) * 10;
  }

  function genEstProducto(rng) {
    let a = randInt(rng, 23, 97);
    let b = randInt(rng, 23, 97);
    if (a % 10 === 0) a += randInt(rng, 1, 4);
    if (b % 10 === 0) b += randInt(rng, 1, 4);
    const exact = a * b;
    const tolerance = Math.max(20, Math.round(exact * 0.05));
    return {
      type: 'custom',
      prompt: `${a} × ${b} ≈ ?`,
      answer: exact,
      tolerance,
      skills: ['est.round'],
      difficulty: 1200,
      targetTimeMs: 8000,
      key: 'c_est.round',
      hint: `Redondea: ${roundTo10(a)} × ${roundTo10(b)} = ${roundTo10(a) * roundTo10(b)} y corrige un poco. Margen ±${tolerance}.`,
    };
  }

  function genEstPorcentaje(rng) {
    const p = pick(rng, [12, 18, 23, 27, 32, 43, 52, 65]);
    const n = randInt(rng, 80, 950);
    const exact = (p * n) / 100;
    const answer = Math.round(exact);
    const tolerance = Math.max(3, Math.round(exact * 0.08));
    return {
      type: 'custom',
      prompt: `${p}% de ${n} ≈ ?`,
      answer,
      tolerance,
      skills: ['est.pct'],
      difficulty: 1230,
      targetTimeMs: 9000,
      key: 'c_est.pct',
      hint: `Apoya en el pilar más cercano (10%, 25%, 50%) y corrige. Margen ±${tolerance}.`,
    };
  }

  function genComprobacion9(rng) {
    const a = randInt(rng, 23, 98);
    const b = randInt(rng, 23, 98);
    return {
      type: 'custom',
      prompt: `Resto de (${a} × ${b}) ÷ 9 = ?`,
      answer: (a * b) % 9,
      skills: ['est.check9'],
      difficulty: 1180,
      targetTimeMs: 8000,
      key: 'c_est.check9',
      hint: 'Sin multiplicar: suma las cifras de cada factor, multiplica esos restos y toma otra vez el resto de 9.',
    };
  }

  /* ------------------------------------------------------------
     Nivel 7 — Cuadrados y raíces
     ------------------------------------------------------------ */

  function genCuadrados(rng) {
    const n = randInt(rng, 31, 50);
    const base = n >= 45 ? 50 : n >= 35 ? 40 : 30;
    const d = Math.abs(n - base);
    const hint =
      base === 50
        ? `(50 − ${d})² = 2500 − ${100 * d} + ${d * d}.`
        : `(${base} + ${d})² = ${base * base} + ${2 * base * d} + ${d * d}.`;
    return {
      type: 'custom',
      prompt: `${n}² = ?`,
      answer: n * n,
      skills: ['sq.squares'],
      difficulty: 1250,
      targetTimeMs: 8000,
      key: 'c_sq.squares',
      hint,
    };
  }

  function genRaices(rng) {
    const n = randInt(rng, 1100, 9800);
    return {
      type: 'custom',
      prompt: `√${n} ≈ ?`,
      answer: Math.round(Math.sqrt(n)),
      tolerance: 1,
      skills: ['sq.roots'],
      difficulty: 1300,
      targetTimeMs: 10000,
      key: 'c_sq.roots',
      hint: 'Enciérralo entre cuadrados: 30²=900 · 40²=1600 · 50²=2500 · 60²=3600 · 70²=4900 · 80²=6400 · 90²=8100. Margen ±1.',
    };
  }

  /* ------------------------------------------------------------
     Etiquetas de habilidades para el motor adaptativo
     ------------------------------------------------------------ */

  const SKILL_META = {
    'add.complement': { label: 'Complementos a 100/1000', group: 'sumas' },
    'add.compensation': { label: 'Compensación en sumas y restas', group: 'sumas' },
    'add.blocks': { label: 'Sumas y restas por bloques', group: 'sumas' },
    'pct.base': { label: 'Porcentajes pilares', group: 'porcentajes' },
    'pct.compose': { label: 'Porcentajes compuestos', group: 'porcentajes' },
    'anchor.easy': { label: 'Anclas 11 y 12', group: 'anclas' },
    'anchor.quarter': { label: 'Anclas 15 y 25', group: 'anclas' },
    'anchor.near': { label: 'Anclas 19, 21 y 99', group: 'anclas' },
    'mul2.base100': { label: 'Multiplicación base 100', group: 'multiplicación 2×2' },
    'mul2.difsq': { label: 'Diferencia de cuadrados', group: 'multiplicación 2×2' },
    'mul2.round': { label: 'Redondear y compensar (2×2)', group: 'multiplicación 2×2' },
    'div2.rules': { label: 'Reglas de divisibilidad', group: 'división' },
    'div2.tricks': { label: 'División por 4, 8, 25 y 50', group: 'división' },
    'div2.long': { label: 'División larga mental', group: 'división' },
    'est.round': { label: 'Estimación de productos', group: 'estimación' },
    'est.pct': { label: 'Estimación de porcentajes', group: 'estimación' },
    'est.check9': { label: 'Comprobación por 9', group: 'estimación' },
    'sq.squares': { label: 'Cuadrados del 31 al 50', group: 'cuadrados y raíces' },
    'sq.roots': { label: 'Raíces cuadradas aproximadas', group: 'cuadrados y raíces' },
  };

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
    {
      id: 4,
      emoji: '✖️',
      title: 'Multiplicación 2×2 de cabeza',
      tagline: 'Base 100, diferencia de cuadrados y redondeo compensado.',
      bossCount: 18,
      criteria: { bronze: { acc: 0.75 }, silver: { acc: 0.85, avgMs: 8000 }, gold: { acc: 0.9, avgMs: 5500 } },
      techniques: [
        {
          id: 'base-100',
          name: 'Cerca de 100',
          summary: '(100±a)(100±b): cruza, añade dos ceros y ajusta con a×b.',
          steps: [
            '104 × 107: cruza 104+7 = 111 → 11100; añade 4×7 = 28 → 11128.',
            '96 × 93: cruza 96−7 = 89 → 8900; añade (−4)×(−7) = 28 → 8928.',
            '103 × 97: cruza 103−3 = 100 → 10000; ajusta 3×(−3) = −9 → 9991.',
            'La cruz vale con cualquiera de los dos números: siempre da lo mismo.',
          ],
          generate: genBase100,
        },
        {
          id: 'dif-cuadrados',
          name: 'Diferencia de cuadrados',
          summary: 'Si equidistan de un centro redondo: (a+d)(a−d) = a² − d².',
          steps: [
            '43 × 37: centro 40, distancia 3 → 1600 − 9 = 1591.',
            '68 × 72: centro 70, distancia 2 → 4900 − 4 = 4896.',
            'Detecta el patrón: los dos números suman el doble de un número redondo.',
          ],
          generate: genDifSq,
        },
        {
          id: 'redondeo-2x2',
          name: 'Redondear y compensar',
          summary: 'Multiplica por la decena vecina y devuelve la diferencia.',
          steps: [
            '84 × 19 = 84×20 − 84 = 1680 − 84 = 1596.',
            '47 × 31 = 47×30 + 47 = 1410 + 47 = 1457.',
            'Funciona con cualquier número acabado en 9 o en 1.',
          ],
          generate: genRound2x2,
        },
      ],
    },
    {
      id: 5,
      emoji: '➗',
      title: 'División mental y divisibilidad',
      tagline: 'Restos al vuelo y división rápida por 4, 8, 25 y 50.',
      bossCount: 18,
      criteria: { bronze: { acc: 0.75 }, silver: { acc: 0.85, avgMs: 8000 }, gold: { acc: 0.9, avgMs: 6000 } },
      techniques: [
        {
          id: 'divisibilidad',
          name: 'Restos y divisibilidad',
          summary: 'Calcula el resto sin dividir: reglas del 3, 4, 5 y 9.',
          steps: [
            'Entre 3 o 9: suma las cifras. 347 → 3+4+7 = 14 → resto de 14: entre 3 es 2, entre 9 es 5.',
            'Entre 4: solo las dos últimas cifras. 736 → 36 ÷ 4 → resto 0.',
            'Entre 5: solo la última cifra. Acaba en 0 o 5 → resto 0.',
            'Resto 0 significa división exacta.',
          ],
          generate: genDivRules,
        },
        {
          id: 'trucos-division',
          name: 'Dividir moviendo ceros',
          summary: '÷4, ÷8, ÷5, ÷25 y ÷50 sin división real.',
          steps: [
            '÷5 = ×2 y quita un cero. 435 ÷ 5 → 870 → 87.',
            '÷25 = ×4 y quita dos ceros. 1400 ÷ 25 → 5600 → 56.',
            '÷4 = mitad de la mitad · ÷8 = tres mitades · ÷50 = ×2 y quita dos ceros.',
          ],
          generate: genDivTricks,
        },
        {
          id: 'division-larga',
          name: 'División por bloques',
          summary: 'Divide 3-4 cifras entre un dígito, bloque a bloque.',
          steps: [
            '852 ÷ 6: 8÷6 = 1 y sobran 2 → 25÷6 = 4 y sobran 1 → 12÷6 = 2 → 142.',
            'Ve diciendo el cociente cifra a cifra y arrastra siempre el resto.',
            'Comprueba al final: cociente × divisor debe devolver el número.',
          ],
          generate: genDivLong,
        },
      ],
    },
    {
      id: 6,
      emoji: '🎯',
      title: 'Estimación y control de errores',
      tagline: 'Respuesta razonable al instante: se acepta un margen de error.',
      bossCount: 15,
      criteria: { bronze: { acc: 0.75 }, silver: { acc: 0.85, avgMs: 9000 }, gold: { acc: 0.9, avgMs: 6000 } },
      techniques: [
        {
          id: 'est-producto',
          name: 'Estimar productos',
          summary: 'Redondeo inteligente con corrección: se acepta ±5%.',
          steps: [
            '46 × 29 ≈ 50 × 30 = 1500; redondeaste 46 hacia arriba → baja un poco: ~1330. (Exacto: 1334.)',
            'Redondea un factor hacia arriba y otro hacia abajo cuando puedas: los errores se compensan.',
            'Aquí no se busca el valor exacto: cualquier respuesta dentro del margen cuenta.',
          ],
          generate: genEstProducto,
        },
        {
          id: 'est-porcentaje',
          name: 'Estimar porcentajes',
          summary: 'Usa el pilar más cercano y corrige: se acepta ±8%.',
          steps: [
            '23% de 187 ≈ 25% de 187 = 46,75 → baja un poco: ~43.',
            '52% ≈ mitad · 18% ≈ 20% (÷5) · 32% ≈ un tercio.',
            'Piensa "¿qué pilar tengo al lado?" y ajusta en la dirección correcta.',
          ],
          generate: genEstPorcentaje,
        },
        {
          id: 'comprobacion-9',
          name: 'Comprobación por 9',
          summary: 'Detecta errores sin repetir la cuenta: restos de 9.',
          steps: [
            'El resto de 9 de un número = resto de 9 de la suma de sus cifras. 47 → 4+7 = 11 → 2.',
            'El resto de un producto = producto de los restos (y otra vez el resto). 47×82 → 2×1 = 2.',
            'Si tu resultado no da el mismo resto, hay un error seguro en la cuenta.',
          ],
          generate: genComprobacion9,
        },
      ],
    },
    {
      id: 7,
      emoji: '🔢',
      title: 'Cuadrados y raíces',
      tagline: 'Cuadrados 31²–50² exactos y raíces encajadas entre cuadrados.',
      bossCount: 15,
      criteria: { bronze: { acc: 0.75 }, silver: { acc: 0.85, avgMs: 8000 }, gold: { acc: 0.9, avgMs: 6000 } },
      techniques: [
        {
          id: 'cuadrados',
          name: 'Cuadrados 31–50',
          summary: 'Apóyate en 30, 40 o 50: (a±d)² = a² ± 2ad + d².',
          steps: [
            '43² = (40+3)² = 1600 + 240 + 9 = 1849.',
            '48² = (50−2)² = 2500 − 200 + 4 = 2304.',
            'El truco: 2ad es solo "doble de a por d", y a² ya lo sabes.',
          ],
          generate: genCuadrados,
        },
        {
          id: 'raices',
          name: 'Raíces aproximadas',
          summary: 'Encaja el número entre dos cuadrados y afina: se acepta ±1.',
          steps: [
            '√1700: está entre 40² = 1600 y 41² = 1681 y 42² = 1764 → ~41.',
            'Memoriza las decenas: 30²=900, 40²=1600, 50²=2500, 60²=3600, 70²=4900, 80²=6400, 90²=8100.',
            'Afina mirando a cuál de los dos cuadrados está más cerca.',
          ],
          generate: genRaices,
        },
      ],
    },
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
    SKILL_META,
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
