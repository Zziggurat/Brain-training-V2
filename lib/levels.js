/*
 * Progresión de cálculo mental de Brain Training V2.
 *
 * Define el itinerario de 12 etapas (metadatos para el mapa) con su
 * contenido jugable: técnicas con explicación paso a paso, generadores
 * deterministas de ejercicios y evaluación de medallas del desafío
 * (bronce/plata/oro).
 *
 * El orden respeta las dependencias reales de la aritmética mental:
 * sumas → duplicar/partir → × por un dígito → anclas → 2×2 → división
 * → fracciones → porcentajes → proporciones → estimación → potencias
 * → élite. Los porcentajes llegan DESPUÉS de división y fracciones
 * (son su aplicación), y las anclas se explican desde la distributiva
 * y las mitades, no como trucos sueltos.
 *
 * Los generadores reciben un RNG inyectable (determinista en tests) y
 * un `tier` (1 principiante · 2 intermedio · 3 avanzado) que escala sus
 * rangos. Producen problemas con el formato que entiende la pantalla de
 * entrenamiento y el motor adaptativo:
 *   { type:'custom', prompt, answer, skills, difficulty, targetTimeMs,
 *     key, hint }
 * `key` agrupa por técnica y tramo (no por instancia) para que la
 * maestría y el repaso espaciado no crezcan sin límite.
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

  /* Escalado de rangos por tramo de dificultad. */
  function byTier(tier, beginner, intermediate, advanced) {
    return tier <= 1 ? beginner : tier >= 3 ? advanced : intermediate;
  }

  /* ------------------------------------------------------------
     Etapa 1 — Sumas y restas turbo
     ------------------------------------------------------------ */

  function genComplemento(rng, tier = 2) {
    const toThousand = rng() < byTier(tier, 0, 0.5, 0.8);
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

  function genCompensacion(rng, tier = 2) {
    const resta = rng() < 0.55;
    const round = randInt(rng, byTier(tier, 1, 2, 2), byTier(tier, 3, 6, 9)) * 100;
    const delta = randInt(rng, 1, byTier(tier, 5, 9, 9));
    const b = rng() < 0.5 ? round - delta : round + delta;
    if (resta) {
      const a = randInt(rng, round + 10, round + byTier(tier, 290, 490, 690));
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
    const a = randInt(rng, 120, byTier(tier, 380, 580, 780));
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

  function genBloques(rng, tier = 2) {
    const fourDigits = rng() < byTier(tier, 0, 0.4, 0.75);
    const loTens = fourDigits ? 101 : 11;
    const hiTens = fourDigits ? byTier(tier, 399, 899, 899) : byTier(tier, 49, 89, 89);
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

  function genCadenaSuma(rng, tier = 2) {
    // Varios sumandos con al menos una pareja de unidades que suma 10.
    const count = byTier(tier, 3, 3, 4);
    const u1 = randInt(rng, 1, 9);
    const units = [u1, 10 - u1];
    while (units.length < count) units.push(randInt(rng, 1, 9));
    // Barajar las unidades para que la pareja no siempre vaya seguida
    for (let i = units.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = units[i];
      units[i] = units[j];
      units[j] = tmp;
    }
    const hiTens = byTier(tier, 4, 7, 9);
    const terms = units.map((u) => randInt(rng, 1, hiTens) * 10 + u);
    return {
      type: 'custom',
      prompt: `${terms.join(' + ')} = ?`,
      answer: terms.reduce((sum, t) => sum + t, 0),
      skills: ['add.chain'],
      difficulty: 1080 + (count - 3) * 60,
      targetTimeMs: 9000,
      key: 'c_add.chain',
      hint: 'Busca parejas de unidades que sumen 10 y avanza de izquierda a derecha.',
    };
  }

  /* ------------------------------------------------------------
     Etapa 2 — Duplicar y partir
     ------------------------------------------------------------ */

  function genDobles(rng, tier = 2) {
    const n = randInt(rng, byTier(tier, 13, 55, 155), byTier(tier, 49, 499, 4999));
    return {
      type: 'custom',
      prompt: `Doble de ${n} = ?`,
      answer: n * 2,
      skills: ['dup.double'],
      difficulty: byTier(tier, 940, 1040, 1140),
      targetTimeMs: 4000,
      key: 'c_dup.double',
      hint: 'Dobla por bloques de izquierda a derecha y suma las llevadas.',
    };
  }

  function genMitades(rng, tier = 2) {
    const half = randInt(rng, byTier(tier, 7, 51, 251), byTier(tier, 49, 499, 4999));
    const n = half * 2;
    return {
      type: 'custom',
      prompt: `Mitad de ${n} = ?`,
      answer: half,
      skills: ['dup.half'],
      difficulty: byTier(tier, 960, 1060, 1160),
      targetTimeMs: 4500,
      key: 'c_dup.half',
      hint: 'Parte por bloques; si un bloque es impar, pasa un 5 al siguiente.',
    };
  }

  function genPor4y8(rng, tier = 2) {
    const por8 = rng() < 0.35;
    const dividir = rng() < 0.4;
    const factor = por8 ? 8 : 4;
    if (dividir) {
      const q = randInt(rng, 12, byTier(tier, 40, 90, 240));
      return {
        type: 'custom',
        prompt: `${q * factor} ÷ ${factor} = ?`,
        answer: q,
        skills: ['dup.four8'],
        difficulty: byTier(tier, 1080, 1140, 1220),
        targetTimeMs: 7000,
        key: 'c_dup.four8',
        hint: factor === 4 ? 'Mitad de la mitad.' : 'Tres mitades seguidas.',
      };
    }
    const n = randInt(rng, 13, byTier(tier, 40, 90, por8 ? 140 : 240));
    return {
      type: 'custom',
      prompt: `${n} × ${factor} = ?`,
      answer: n * factor,
      skills: ['dup.four8'],
      difficulty: byTier(tier, 1060, 1130, 1210),
      targetTimeMs: 6500,
      key: 'c_dup.four8',
      hint: factor === 4 ? 'Dobla dos veces.' : 'Dobla tres veces.',
    };
  }

  function genPor5y25(rng, tier = 2) {
    const variant = pick(rng, byTier(tier, ['x5', 'div5'], ['x5', 'div5', 'x50', 'x25'], ['x5', 'div5', 'x50', 'x25']));
    if (variant === 'x5') {
      const n = randInt(rng, 13, byTier(tier, 49, 99, 499));
      return {
        type: 'custom',
        prompt: `${n} × 5 = ?`,
        answer: n * 5,
        skills: ['dup.five25'],
        difficulty: byTier(tier, 1040, 1110, 1190),
        targetTimeMs: 5000,
        key: 'c_dup.five25',
        hint: '×5 = ×10 y mitad.',
      };
    }
    if (variant === 'div5') {
      const q = randInt(rng, 13, byTier(tier, 49, 99, 499));
      return {
        type: 'custom',
        prompt: `${q * 5} ÷ 5 = ?`,
        answer: q,
        skills: ['dup.five25'],
        difficulty: byTier(tier, 1060, 1130, 1200),
        targetTimeMs: 5500,
        key: 'c_dup.five25',
        hint: '÷5 = doblar y quitar un cero.',
      };
    }
    if (variant === 'x50') {
      const n = randInt(rng, 13, byTier(tier, 49, 99, 199));
      return {
        type: 'custom',
        prompt: `${n} × 50 = ?`,
        answer: n * 50,
        skills: ['dup.five25'],
        difficulty: 1150,
        targetTimeMs: 6000,
        key: 'c_dup.five25',
        hint: '×50 = ×100 y mitad.',
      };
    }
    const n = randInt(rng, 13, byTier(tier, 40, 60, 99));
    return {
      type: 'custom',
      prompt: `${n} × 25 = ?`,
      answer: n * 25,
      skills: ['dup.five25'],
      difficulty: 1180,
      targetTimeMs: 7000,
      key: 'c_dup.five25',
      hint: '×25 = ×100 y dos mitades (÷4).',
    };
  }

  /* ------------------------------------------------------------
     Etapa 3 — Multiplicar por un dígito (la distributiva madre)
     ------------------------------------------------------------ */

  function genPorUnDigito2(rng, tier = 2) {
    const a = randInt(rng, 3, byTier(tier, 6, 9, 9));
    let b = randInt(rng, 13, byTier(tier, 49, 79, 97));
    if (b % 10 === 0) b += 3;
    const tens = Math.floor(b / 10) * 10;
    const units = b % 10;
    return {
      type: 'custom',
      prompt: `${a} × ${b} = ?`,
      answer: a * b,
      skills: ['mul1.two'],
      difficulty: byTier(tier, 1080, 1150, 1220),
      targetTimeMs: 7000,
      key: 'c_mul1.two',
      hint: `De izquierda a derecha: ${a}×${tens} = ${a * tens} y ${a}×${units} = ${a * units}; súmalos.`,
    };
  }

  function genPorUnDigito3(rng, tier = 2) {
    const a = randInt(rng, 3, byTier(tier, 6, 9, 9));
    let b = randInt(rng, 111, byTier(tier, 399, 699, 987));
    if (b % 100 === 0) b += 13;
    return {
      type: 'custom',
      prompt: `${a} × ${b} = ?`,
      answer: a * b,
      skills: ['mul1.three'],
      difficulty: byTier(tier, 1180, 1250, 1320),
      targetTimeMs: 10000,
      key: 'c_mul1.three',
      hint: 'Por bloques: centenas, decenas y unidades, sumando sobre la marcha.',
    };
  }

  function genTrucoDelNueve(rng, tier = 2) {
    let n = randInt(rng, 13, byTier(tier, 49, 97, 399));
    if (n % 10 === 0) n += 7;
    return {
      type: 'custom',
      prompt: `9 × ${n} = ?`,
      answer: 9 * n,
      skills: ['mul1.nine'],
      difficulty: byTier(tier, 1100, 1160, 1240),
      targetTimeMs: 7000,
      key: 'c_mul1.nine',
      hint: `9×n = 10n − n: ${n * 10} − ${n}.`,
    };
  }

  /* ------------------------------------------------------------
     Etapa 4 — Multiplicar con anclas
     ------------------------------------------------------------ */

  function genAncla(rng, anchors, skillId, baseDiff, hints, tier = 2) {
    const anchor = pick(rng, anchors);
    const maxN = anchor >= 99 ? 99 : anchor >= 19 ? 49 : 89;
    let n = randInt(rng, 13, Math.min(maxN, byTier(tier, 29, 59, 99)));
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

  function genAncla11_12(rng, tier = 2) {
    return genAncla(rng, [11, 12], 'anchor.easy', 1080, {
      11: '11n = 10n + n.',
      12: '12n = 10n + 2n.',
    }, tier);
  }

  function genAncla15_75(rng, tier = 2) {
    return genAncla(rng, byTier(tier, [15], [15, 75], [15, 75]), 'anchor.quarter', 1150, {
      15: '15n = 10n + la mitad de 10n.',
      75: '75n = 50n + 25n (o 100n − 25n).',
    }, tier);
  }

  function genAncla19_99(rng, tier = 2) {
    return genAncla(rng, byTier(tier, [19, 21], [19, 21, 99], [19, 21, 99]), 'anchor.near', 1200, {
      19: '19n = 20n − n.',
      21: '21n = 20n + n.',
      99: '99n = 100n − n.',
    }, tier);
  }

  /* ------------------------------------------------------------
     Etapa 5 — Multiplicación 2×2 de cabeza
     ------------------------------------------------------------ */

  function genBase100(rng, tier = 2) {
    const spread = byTier(tier, 4, 7, 9);
    const side = () => (rng() < 0.5 ? 100 - randInt(rng, 1, spread) : 100 + randInt(rng, 1, spread));
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

  function genDifSq(rng, tier = 2) {
    const center = pick(rng, byTier(tier, [20, 30, 40, 50], [20, 30, 40, 50, 60, 70], [20, 30, 40, 50, 60, 70, 80, 90]));
    const d = randInt(rng, 2, byTier(tier, 4, 6, 8));
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

  function genRound2x2(rng, tier = 2) {
    const anchors = [29, 31, 39, 41, 49, 51, 59, 61, 69, 71, 79, 81, 89, 91];
    const anchor = pick(rng, anchors.slice(0, byTier(tier, 4, 10, 14)));
    let a = randInt(rng, 13, byTier(tier, 40, 70, 97));
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
     Etapa 6 — División mental y divisibilidad
     ------------------------------------------------------------ */

  function genDivRules(rng, tier = 2) {
    const divisor = pick(rng, byTier(tier, [3, 5], [3, 4, 5, 9], [3, 4, 5, 9]));
    const n = randInt(rng, 112, byTier(tier, 499, 989, 989));
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

  function genDivTricks(rng, tier = 2) {
    const divisor = pick(rng, byTier(tier, [4, 5], [4, 5, 8, 25], [4, 5, 8, 25, 50]));
    const q = randInt(rng, 12, byTier(tier, 40, 70, 96));
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

  function genDivLong(rng, tier = 2) {
    const divisor = randInt(rng, 3, byTier(tier, 6, 9, 9));
    const q = randInt(rng, Math.ceil(100 / divisor) + 1, Math.floor(byTier(tier, 999, 4999, 9999) / divisor));
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
     Etapa 7 — Fracciones y decimales útiles
     ------------------------------------------------------------ */

  function genFraccionPct(rng, tier = 2) {
    const dens = byTier(tier, [2, 4, 5, 10], [2, 4, 5, 10, 20, 25], [2, 4, 5, 10, 20, 25, 50]);
    const den = pick(rng, dens);
    const num = randInt(rng, 1, den - 1);
    return {
      type: 'custom',
      prompt: `${num}/${den} = ?%`,
      answer: (num * 100) / den,
      skills: ['frac.topct'],
      difficulty: byTier(tier, 1020, 1090, 1160),
      targetTimeMs: 6000,
      key: 'c_frac.topct',
      hint: `Convierte el denominador en 100: multiplica arriba y abajo por ${100 / den}.`,
    };
  }

  function genMilesimas(rng, tier = 2) {
    const dens = byTier(tier, [20, 50], [8, 20, 50], [8, 20, 25, 40, 50]);
    const den = pick(rng, dens);
    const num = randInt(rng, 1, den - 1);
    return {
      type: 'custom',
      prompt: `${num}/${den} = ?/1000`,
      answer: (num * 1000) / den,
      skills: ['frac.todec'],
      difficulty: 1240,
      targetTimeMs: 9000,
      key: 'c_frac.todec',
      hint: `Convierte el denominador en 1000: multiplica arriba y abajo por ${1000 / den}.`,
    };
  }

  /* Primeros `count` decimales por división larga entera (sin flotantes). */
  function decimalDigits(numerator, denominator, count) {
    let digits = 0;
    let r = numerator % denominator;
    for (let i = 0; i < count; i++) {
      r *= 10;
      digits = digits * 10 + Math.floor(r / denominator);
      r %= denominator;
    }
    return digits;
  }

  function genPeriodicos(rng, tier = 2) {
    const den = pick(rng, byTier(tier, [9], [9, 11], [7, 9, 11]));
    const num = randInt(rng, 1, den - 1);
    const hints = {
      7: 'La familia del 7 rota la cadena 142857: localiza por dónde empieza tu fracción.',
      9: 'n/9 = 0,nnn… repite la misma cifra sin fin.',
      11: 'n/11 repite un bloque de dos cifras: los múltiplos de 9 (09, 18, 27…).',
    };
    return {
      type: 'custom',
      prompt: `${num}/${den} → 3 primeros decimales = ?`,
      answer: decimalDigits(num, den, 3),
      skills: ['frac.periodic'],
      difficulty: 1320,
      targetTimeMs: 12000,
      key: `c_frac.periodic_${den}`,
      hint: hints[den],
    };
  }

  /* ------------------------------------------------------------
     Etapa 8 — Porcentajes en la vida real
     ------------------------------------------------------------ */

  function genPctBase(rng, tier = 2) {
    const variants = [
      { p: 50, factor: 2, diff: 900 },
      { p: 25, factor: 4, diff: 1000 },
      { p: 10, factor: 10, diff: 900 },
      { p: 1, factor: 100, diff: 950 },
      { p: 5, factor: 20, diff: 1020 },
    ];
    const v = pick(rng, variants.slice(0, byTier(tier, 3, 5, 5)));
    // Números "feos": múltiplos exactos del divisor, pero no redondos.
    let n = v.factor * randInt(rng, 3, byTier(tier, 20, 40, 60));
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

  function genPctCompuesto(rng, tier = 2) {
    const variants = [
      { p: 20, mult: 5, diff: 1000, hint: '20% es dividir entre 5 (o doblar el 10%).' },
      { p: 30, mult: 10, diff: 1080, hint: '30% = 3 veces el 10%.' },
      { p: 15, mult: 20, diff: 1100, hint: '15% = 10% + 5%.' },
      { p: 75, mult: 4, diff: 1120, hint: '75% = mitad + cuarto (o resta el 25%).' },
      { p: 35, mult: 20, diff: 1180, hint: '35% = 25% + 10%.' },
    ];
    const v = pick(rng, variants.slice(0, byTier(tier, 2, 4, 5)));
    let n = v.mult * randInt(rng, 3, Math.floor(byTier(tier, 240, 400, 600) / v.mult));
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

  function genEspejo(rng, tier = 2) {
    // El espejo: X% de Y = Y% de X. Se eligen pares donde girar lo vuelve trivial.
    const variant = pick(rng, byTier(tier, ['n50', 'n25'], ['n50', 'n25', 'n20'], ['n50', 'n25', 'n20']));
    let p;
    let n;
    if (variant === 'n50') {
      p = randInt(rng, 2, 24) * 2; // par → p% de 50 = p/2
      n = 50;
    } else if (variant === 'n25') {
      p = randInt(rng, 1, 12) * 4; // múltiplo de 4 → p% de 25 = p/4
      n = 25;
    } else {
      p = pick(rng, [35, 45, 55, 65, 85, 95]); // múltiplo de 5 → p% de 20 = p/5
      n = 20;
    }
    return {
      type: 'custom',
      prompt: `${p}% de ${n} = ?`,
      answer: (p * n) / 100,
      skills: ['pct.mirror'],
      difficulty: byTier(tier, 1080, 1140, 1200),
      targetTimeMs: 6000,
      key: 'c_pct.mirror',
      hint: `Gíralo: ${p}% de ${n} = ${n}% de ${p}. Mucho más fácil.`,
    };
  }

  function genDescuento(rng, tier = 2) {
    const base = 20 * randInt(rng, 3, byTier(tier, 12, 20, 30));
    const sube = rng() < 0.35;
    const p = pick(rng, sube ? [10, 20, 25, 50] : byTier(tier, [10, 25, 50], [10, 20, 25, 50], [10, 20, 25, 50, 75]));
    const delta = (base * p) / 100;
    return {
      type: 'custom',
      prompt: sube ? `${base} + ${p}% = ?` : `${base} − ${p}% = ?`,
      answer: sube ? base + delta : base - delta,
      skills: ['pct.discount'],
      difficulty: byTier(tier, 1120, 1180, 1240),
      targetTimeMs: 8000,
      key: 'c_pct.discount',
      hint: sube
        ? `Calcula el ${p}% y súmalo al precio.`
        : `Piensa en lo que QUEDA: −${p}% es quedarte con el ${100 - p}%.`,
    };
  }

  /* ------------------------------------------------------------
     Etapa 9 — Proporciones y regla de tres
     ------------------------------------------------------------ */

  function genRegla3(rng, tier = 2) {
    const unit = randInt(rng, 2, byTier(tier, 5, 7, 9));
    const a = randInt(rng, 2, byTier(tier, 6, 9, 9));
    let b = randInt(rng, 2, byTier(tier, 8, 10, 12));
    if (b === a) b += 1;
    const variant = pick(rng, [
      { prompt: `${a} por ${unit * a} € → ${b} por ? €`, hint: 'Saca el precio de uno (divide) y escala (multiplica).' },
      { prompt: `${unit * a} km en ${a} h → ? km en ${b} h`, hint: 'Calcula el ritmo por hora y multiplica por las horas.' },
      { prompt: `${a} raciones: ${unit * a} huevos → ${b} raciones: ?`, hint: 'Divide para una ración y escala a las que pidan.' },
    ]);
    return {
      type: 'custom',
      prompt: variant.prompt,
      answer: unit * b,
      skills: ['prop.rule3'],
      difficulty: 1220,
      targetTimeMs: 10000,
      key: 'c_prop.rule3',
      hint: variant.hint,
    };
  }

  function genSimplificar(rng, tier = 2) {
    const pairs = [
      [2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [3, 7], [5, 8], [7, 9], [7, 10],
    ];
    const [p, q] = pick(rng, pairs.slice(0, byTier(tier, 5, 8, 10)));
    const m = randInt(rng, 4, byTier(tier, 6, 9, 12));
    return {
      type: 'custom',
      prompt: `${p * m} de ${q * m} = ? de ${q}`,
      answer: p,
      skills: ['prop.simplify'],
      difficulty: 1180,
      targetTimeMs: 8000,
      key: 'c_prop.simplify',
      hint: `Divide los dos números por lo mismo hasta llegar a ${q}.`,
    };
  }

  function genCadenaPct(rng, tier = 2) {
    // Solo combinaciones con resultado entero.
    for (let i = 0; i < 60; i++) {
      const start = pick(rng, byTier(tier, [100, 200], [100, 200, 300, 400], [100, 200, 300, 400, 500, 600, 800]));
      const up = pick(rng, byTier(tier, [10, 50], [10, 20, 50], [10, 20, 25, 50]));
      const down = pick(rng, byTier(tier, [10, 50], [10, 20, 50], [10, 20, 25, 50]));
      const result = (start * (100 + up) * (100 - down)) / 10000;
      if (Number.isInteger(result)) {
        return {
          type: 'custom',
          prompt: `${start} sube ${up}% y baja ${down}% → ?`,
          answer: result,
          skills: ['prop.chain'],
          difficulty: 1280,
          targetTimeMs: 11000,
          key: 'c_prop.chain',
          hint: 'Encadena: primero la subida, y el descuento se aplica al NUEVO valor (subir y bajar el mismo % no vuelve al origen).',
        };
      }
    }
    return {
      type: 'custom',
      prompt: '100 sube 20% y baja 20% → ?',
      answer: 96,
      skills: ['prop.chain'],
      difficulty: 1280,
      targetTimeMs: 11000,
      key: 'c_prop.chain',
      hint: 'Encadena: primero la subida, y el descuento se aplica al NUEVO valor.',
    };
  }

  /* ------------------------------------------------------------
     Etapa 10 — Estimación y control de errores
     ------------------------------------------------------------ */

  function roundTo10(n) {
    return Math.round(n / 10) * 10;
  }

  function genEstProducto(rng, tier = 2) {
    const hi = byTier(tier, 49, 74, 97);
    let a = randInt(rng, 23, hi);
    let b = randInt(rng, 23, hi);
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

  function genEstPorcentaje(rng, tier = 2) {
    const p = pick(rng, byTier(tier, [12, 18, 52], [12, 18, 23, 27, 52], [12, 18, 23, 27, 32, 43, 52, 65]));
    const n = randInt(rng, 80, byTier(tier, 300, 600, 950));
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

  function genEscalas(rng, tier = 2) {
    const thousands = randInt(rng, 12, byTier(tier, 500, 2000, 9800));
    const formatted = (thousands * 1000).toLocaleString('es-ES');
    return {
      type: 'custom',
      prompt: `${formatted} = ? miles`,
      answer: thousands,
      skills: ['pow.scale'],
      difficulty: 1150,
      targetTimeMs: 7000,
      key: 'c_pow.scale',
      hint: 'Mil = tres ceros: quítalos. Un millón son mil miles.',
    };
  }

  function genControl(rng, tier = 2) {
    const hi = byTier(tier, 49, 74, 98);
    const a = randInt(rng, 23, hi);
    const b = randInt(rng, 23, hi);
    if (rng() < 0.5) {
      return {
        type: 'custom',
        prompt: `Última cifra de ${a} × ${b} = ?`,
        answer: (a * b) % 10,
        skills: ['est.lastdigit'],
        difficulty: 1100,
        targetTimeMs: 6000,
        key: 'c_est.lastdigit',
        hint: `Multiplica solo las últimas cifras: ${a % 10} × ${b % 10}.`,
      };
    }
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
     Etapa 11 — Cuadrados, raíces y potencias
     ------------------------------------------------------------ */

  function genCuadrados(rng, tier = 2) {
    let n = randInt(rng, 13, byTier(tier, 20, 35, 50));
    if (n % 10 === 0) n += 1;
    const base = Math.round(n / 10) * 10;
    const d = n - base;
    const hint =
      d >= 0
        ? `(${base} + ${d})² = ${base * base} + ${2 * base * d} + ${d * d}.`
        : `(${base} − ${-d})² = ${base * base} − ${2 * base * -d} + ${d * d}.`;
    return {
      type: 'custom',
      prompt: `${n}² = ?`,
      answer: n * n,
      skills: ['sq.squares'],
      difficulty: byTier(tier, 1150, 1250, 1320),
      targetTimeMs: 8000,
      key: 'c_sq.squares',
      hint,
    };
  }

  function genRaices(rng, tier = 2) {
    const n = randInt(rng, 1100, byTier(tier, 3600, 6400, 9800));
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

  const SUPERSCRIPTS = ['⁰', '¹', '²', '³', '⁴', '⁵', '⁶', '⁷', '⁸', '⁹'];

  function superscript(n) {
    return String(n)
      .split('')
      .map((d) => SUPERSCRIPTS[Number(d)])
      .join('');
  }

  function genCubos(rng, tier = 2) {
    const n = randInt(rng, 2, byTier(tier, 6, 9, 12));
    return {
      type: 'custom',
      prompt: `${n}³ = ?`,
      answer: n * n * n,
      skills: ['pow.cubes'],
      difficulty: 1200,
      targetTimeMs: 7000,
      key: 'c_pow.cubes',
      hint: `n³ = n × n²: ${n} × ${n * n}.`,
    };
  }

  function genPotencias2(rng, tier = 2) {
    const exp = randInt(rng, 4, byTier(tier, 8, 11, 14));
    return {
      type: 'custom',
      prompt: `2${superscript(exp)} = ?`,
      answer: Math.pow(2, exp),
      skills: ['pow.two'],
      difficulty: 1220 + (exp > 10 ? 60 : 0),
      targetTimeMs: 8000,
      key: 'c_pow.two',
      hint: 'Ancla en 2¹⁰ = 1024 (≈ mil) y dobla o divide desde ahí.',
    };
  }

  /* ------------------------------------------------------------
     Etapa 12 — Élite: mezcla total
     ------------------------------------------------------------ */

  function genEst3(rng, tier = 2) {
    const hi = byTier(tier, 400, 700, 977);
    let a = randInt(rng, 123, hi);
    let b = randInt(rng, 123, hi);
    if (a % 100 === 0) a += 17;
    if (b % 100 === 0) b += 13;
    const exact = a * b;
    const tolerance = Math.max(500, Math.round(exact * 0.02));
    const ra = Math.round(a / 100) * 100;
    const rb = Math.round(b / 100) * 100;
    return {
      type: 'custom',
      prompt: `${a} × ${b} ≈ ?`,
      answer: exact,
      tolerance,
      skills: ['est3.round'],
      difficulty: 1400,
      targetTimeMs: 15000,
      key: 'c_est3.round',
      hint: `Redondea a centenas: ${ra} × ${rb} = ${(ra * rb).toLocaleString('es-ES')} y corrige con el resto mayor. Margen ±${tolerance.toLocaleString('es-ES')}.`,
    };
  }

  function genDifSq3(rng, tier = 2) {
    const center = pick(rng, byTier(tier, [200, 300, 400, 500], [200, 300, 400, 500, 600, 700], [200, 300, 400, 500, 600, 700, 800, 900]));
    const d = randInt(rng, 2, byTier(tier, 5, 7, 9));
    return {
      type: 'custom',
      prompt: `${center + d} × ${center - d} = ?`,
      answer: center * center - d * d,
      skills: ['est3.difsq'],
      difficulty: 1350,
      targetTimeMs: 12000,
      key: 'c_est3.difsq',
      hint: `Centro ${center}: es ${center}² − ${d}², y ${center}² lo sabes al instante.`,
    };
  }

  function genSqNear(rng, tier = 2) {
    const center = pick(rng, byTier(tier, [200, 300, 400, 500], [200, 300, 400, 500, 600, 700], [200, 300, 400, 500, 600, 700, 800, 900]));
    const d = randInt(rng, 1, byTier(tier, 3, 4, 6));
    const sign = rng() < 0.5 ? -1 : 1;
    const n = center + sign * d;
    return {
      type: 'custom',
      prompt: `${n}² = ?`,
      answer: n * n,
      skills: ['est3.sqnear'],
      difficulty: 1380,
      targetTimeMs: 13000,
      key: 'c_est3.sqnear',
      hint: `(${center} ${sign > 0 ? '+' : '−'} ${d})² = ${center * center} ${sign > 0 ? '+' : '−'} ${2 * center * d} + ${d * d}.`,
    };
  }

  function genCadena(rng, tier = 2) {
    const variant = randInt(rng, 0, 2);
    if (variant === 0) {
      const p = pick(rng, [10, 20, 25, 50]);
      const total = (100 / p) * randInt(rng, 3, byTier(tier, 12, 20, 30));
      const a = randInt(rng, 1, total - 1);
      return {
        type: 'custom',
        prompt: `(${a} + ${total - a}) × ${p}% = ?`,
        answer: (total * p) / 100,
        skills: ['mix.chain'],
        difficulty: 1350,
        targetTimeMs: 11000,
        key: 'c_mix.chain',
        hint: 'Resuelve el paréntesis primero: la suma sale redonda a propósito.',
      };
    }
    if (variant === 1) {
      const a = randInt(rng, 12, byTier(tier, 50, 75, 98));
      const b = randInt(rng, 3, byTier(tier, 6, 8, 9));
      const c = randInt(rng, 11, Math.min(99, a * b - 10));
      return {
        type: 'custom',
        prompt: `${a} × ${b} − ${c} = ?`,
        answer: a * b - c,
        skills: ['mix.chain'],
        difficulty: 1330,
        targetTimeMs: 11000,
        key: 'c_mix.chain',
        hint: 'Encadena: multiplica con tu mejor técnica y resta compensando.',
      };
    }
    const n = 20 * randInt(rng, 2, byTier(tier, 10, 20, 30));
    const pillars = [5, 10, 25, 50];
    const p = pick(rng, pillars);
    let q = pick(rng, pillars);
    if (q === p) q = pillars[(pillars.indexOf(p) + 1) % pillars.length];
    return {
      type: 'custom',
      prompt: `${p}% de ${n} + ${q}% de ${n} = ?`,
      answer: ((p + q) * n) / 100,
      skills: ['mix.chain'],
      difficulty: 1360,
      targetTimeMs: 12000,
      key: 'c_mix.chain',
      hint: `Junta los porcentajes: ${p}% + ${q}% = ${p + q}% de una sola vez.`,
    };
  }

  /* Blitz: muestrea cualquier técnica de las etapas 1-11 (elegir rápido
     el método es la habilidad final). Conserva skills y clave originales. */
  function genBlitz(rng, tier = 2) {
    const pool = LEVELS.filter((l) => l.id <= 11 && Array.isArray(l.techniques)).flatMap((l) =>
      l.techniques.map((t) => t.generate)
    );
    return pick(rng, pool)(rng, tier);
  }

  /* ------------------------------------------------------------
     Etiquetas de habilidades para el motor adaptativo
     ------------------------------------------------------------ */

  const SKILL_META = {
    'add.complement': { label: 'Complementos a 100/1000', group: 'sumas' },
    'add.compensation': { label: 'Compensación en sumas y restas', group: 'sumas' },
    'add.blocks': { label: 'Sumas y restas por bloques', group: 'sumas' },
    'add.chain': { label: 'Sumas en cadena', group: 'sumas' },
    'dup.double': { label: 'Dobles', group: 'duplicar y partir' },
    'dup.half': { label: 'Mitades', group: 'duplicar y partir' },
    'dup.four8': { label: 'Por 4 y por 8 con dobles', group: 'duplicar y partir' },
    'dup.five25': { label: 'Por 5, 25 y 50 con mitades', group: 'duplicar y partir' },
    'mul1.two': { label: 'Un dígito × 2 cifras', group: 'multiplicación' },
    'mul1.three': { label: 'Un dígito × 3 cifras', group: 'multiplicación' },
    'mul1.nine': { label: 'El truco del 9', group: 'multiplicación' },
    'anchor.easy': { label: 'Anclas 11 y 12', group: 'anclas' },
    'anchor.quarter': { label: 'Anclas 15 y 75', group: 'anclas' },
    'anchor.near': { label: 'Anclas 19, 21 y 99', group: 'anclas' },
    'mul2.base100': { label: 'Multiplicación base 100', group: 'multiplicación 2×2' },
    'mul2.difsq': { label: 'Diferencia de cuadrados', group: 'multiplicación 2×2' },
    'mul2.round': { label: 'Redondear y compensar (2×2)', group: 'multiplicación 2×2' },
    'div2.rules': { label: 'Reglas de divisibilidad', group: 'división' },
    'div2.tricks': { label: 'División por 4, 8, 25 y 50', group: 'división' },
    'div2.long': { label: 'División larga mental', group: 'división' },
    'frac.topct': { label: 'Fracciones a porcentaje', group: 'fracciones' },
    'frac.todec': { label: 'Fracciones a milésimas', group: 'fracciones' },
    'frac.periodic': { label: 'Decimales periódicos', group: 'fracciones' },
    'pct.base': { label: 'Porcentajes pilares', group: 'porcentajes' },
    'pct.compose': { label: 'Porcentajes compuestos', group: 'porcentajes' },
    'pct.mirror': { label: 'El espejo de porcentajes', group: 'porcentajes' },
    'pct.discount': { label: 'Descuentos y aumentos', group: 'porcentajes' },
    'prop.rule3': { label: 'Regla de tres directa', group: 'proporciones' },
    'prop.simplify': { label: 'Simplificar razones', group: 'proporciones' },
    'prop.chain': { label: 'Porcentajes encadenados', group: 'proporciones' },
    'est.round': { label: 'Estimación de productos', group: 'estimación' },
    'est.pct': { label: 'Estimación de porcentajes', group: 'estimación' },
    'est.check9': { label: 'Comprobación por 9', group: 'estimación' },
    'est.lastdigit': { label: 'Comprobación por última cifra', group: 'estimación' },
    'pow.scale': { label: 'Escalas y miles', group: 'estimación' },
    'sq.squares': { label: 'Cuadrados del 13 al 50', group: 'cuadrados y potencias' },
    'sq.roots': { label: 'Raíces cuadradas aproximadas', group: 'cuadrados y potencias' },
    'pow.cubes': { label: 'Cubos del 1 al 12', group: 'cuadrados y potencias' },
    'pow.two': { label: 'Potencias de 2', group: 'cuadrados y potencias' },
    'est3.round': { label: 'Estimación 3×3', group: 'élite' },
    'est3.difsq': { label: 'Diferencia de cuadrados (3 cifras)', group: 'élite' },
    'est3.sqnear': { label: 'Cuadrados cerca de centenas', group: 'élite' },
    'mix.chain': { label: 'Cadenas aritméticas', group: 'élite' },
  };

  /* ------------------------------------------------------------
     Definición de etapas
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
        {
          id: 'cadena',
          name: 'Sumas en cadena',
          summary: 'Varios sumandos: busca parejas al 10 y avanza sin frenar.',
          steps: [
            '38 + 25 + 12: las unidades 8 y 2 hacen 10 → 38+12 = 50 primero, y 50+25 = 75.',
            'Agrupa lo cómodo antes de sumar en orden: el orden lo eliges tú.',
            'Con 4 sumandos, suma decenas de un barrido y luego las unidades.',
          ],
          generate: genCadenaSuma,
        },
      ],
    },
    {
      id: 2,
      emoji: '✂️',
      title: 'Duplicar y partir',
      tagline: 'Dobles y mitades: la navaja suiza de todo el cálculo mental.',
      bossCount: 18,
      criteria: { bronze: { acc: 0.8 }, silver: { acc: 0.9, avgMs: 5000 }, gold: { acc: 0.95, avgMs: 3000 } },
      techniques: [
        {
          id: 'dobles',
          name: 'Dobles',
          summary: 'Doblar cualquier número por bloques, de izquierda a derecha.',
          steps: [
            'Doble de 347: 600 + 80 + 14 = 694.',
            'Dobla el bloque grande primero y ajusta con las llevadas pequeñas.',
            'Doblar es la mitad de casi todos los trucos que vienen después.',
          ],
          generate: genDobles,
        },
        {
          id: 'mitades',
          name: 'Mitades',
          summary: 'Partir por la mitad, incluso cuando un bloque es impar.',
          steps: [
            'Mitad de 764: 350 + 32 = 382.',
            'Si el bloque es impar, pasa un 5 al siguiente: mitad de 76 = 35 + 3 = 38.',
            'Mitades encadenadas = dividir entre 4 y entre 8 sin división.',
          ],
          generate: genMitades,
        },
        {
          id: 'por-4-8',
          name: 'Por 4 y por 8',
          summary: '×4 = doblar dos veces · ×8 = tres veces (y ÷ igual con mitades).',
          steps: [
            '23 × 4: doble 46, doble 92.',
            '17 × 8: 34 → 68 → 136.',
            '96 ÷ 4: mitad 48, mitad 24. Nunca "dividiste": solo partiste.',
          ],
          generate: genPor4y8,
        },
        {
          id: 'por-5-25',
          name: 'Por 5, 25 y 50',
          summary: 'Con ceros y mitades: ×5 = ×10÷2, ×25 = ×100÷4, ×50 = ×100÷2.',
          steps: [
            '36 × 5: 360 ÷ 2 = 180.',
            '44 × 25: 4400 ÷ 4 = 1100.',
            '86 ÷ 5: 86 × 2 = 172 → 17,2… con enteros: 172 y quita un cero.',
          ],
          generate: genPor5y25,
        },
      ],
    },
    {
      id: 3,
      emoji: '☝️',
      title: 'Multiplicar por un dígito',
      tagline: 'La distributiva madre: 7×34 en dos pasos, de cabeza.',
      bossCount: 16,
      criteria: { bronze: { acc: 0.75 }, silver: { acc: 0.85, avgMs: 9000 }, gold: { acc: 0.9, avgMs: 6000 } },
      techniques: [
        {
          id: 'dist-2',
          name: 'Un dígito × 2 cifras',
          summary: 'Parte en decenas y unidades, de izquierda a derecha.',
          steps: [
            '7 × 34: 7×30 = 210 y 7×4 = 28 → 238.',
            'Di el bloque grande primero: la respuesta se construye en orden.',
            'Este movimiento es el corazón de TODA la multiplicación mental.',
          ],
          generate: genPorUnDigito2,
        },
        {
          id: 'dist-3',
          name: 'Un dígito × 3 cifras',
          summary: 'Lo mismo con centenas: tres bloques, una suma corrida.',
          steps: [
            '6 × 283: 1200 + 480 + 18 = 1698.',
            'Suma sobre la marcha: 1200 → 1680 → 1698 (no guardes tres números).',
            'Si un bloque es 0, sáltalo: 4 × 706 = 2800 + 24.',
          ],
          generate: genPorUnDigito3,
        },
        {
          id: 'nueve',
          name: 'El truco del 9',
          summary: '9×n = 10n − n: multiplicar restando.',
          steps: [
            '9 × 47: 470 − 47 = 423.',
            'Funciona igual con números grandes: 9 × 260 = 2600 − 260.',
            'Es tu primer "ancla": multiplicar por el redondo vecino y compensar.',
          ],
          generate: genTrucoDelNueve,
        },
      ],
    },
    {
      id: 4,
      emoji: '⚓',
      title: 'Multiplicar con anclas',
      tagline: '11, 12, 15, 19, 21, 75 y 99: números con truco propio.',
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
            'Es la distributiva de la etapa 3 con ropa nueva: 10n primero, el resto encima.',
          ],
          generate: genAncla11_12,
        },
        {
          id: 'ancla-cuarto',
          name: 'Anclas 15 y 75',
          summary: '15n con mitades; 75n con cuartos: dobla y parte, como en la etapa 2.',
          steps: [
            '15 × 24: 10×24 = 240, su mitad 120 → 360.',
            '75 × 16: 100×16 = 1600, menos su cuarto 400 → 1200.',
            'Las anclas no se memorizan: se fabrican con dobles y mitades.',
          ],
          generate: genAncla15_75,
        },
        {
          id: 'ancla-cercana',
          name: 'Anclas 19, 21 y 99',
          summary: 'Usa la decena o centena vecina y compensa.',
          steps: [
            '19 × 23 = 20×23 − 23 = 460 − 23 = 437.',
            '21 × 34 = 20×34 + 34 = 680 + 34 = 714.',
            '99 × 47 = 4700 − 47 = 4653. El truco del 9, a lo grande.',
          ],
          generate: genAncla19_99,
        },
      ],
    },
    {
      id: 5,
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
      id: 6,
      emoji: '➗',
      title: 'División mental y divisibilidad',
      tagline: 'Restos al vuelo y división rápida por bloques.',
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
      id: 7,
      emoji: '🍕',
      title: 'Fracciones y decimales útiles',
      tagline: 'La red 1/2…1/50 ↔ decimal ↔ %: una sola tabla mental.',
      bossCount: 15,
      criteria: { bronze: { acc: 0.75 }, silver: { acc: 0.85, avgMs: 8000 }, gold: { acc: 0.9, avgMs: 6000 } },
      techniques: [
        {
          id: 'a-porcentaje',
          name: 'Fracciones a porcentaje',
          summary: 'Convierte el denominador en 100 y lee el porcentaje.',
          steps: [
            '3/4: multiplica por 25 arriba y abajo → 75/100 = 75%.',
            'Denominadores amigos de 100: 2, 4, 5, 10, 20, 25, 50.',
            'Memoriza los famosos: 1/4 = 25% · 1/5 = 20% · 3/4 = 75%.',
          ],
          generate: genFraccionPct,
        },
        {
          id: 'milesimas',
          name: 'Fracciones a milésimas',
          summary: 'Convierte el denominador en 1000 y lee el decimal.',
          steps: [
            '5/8: multiplica por 125 arriba y abajo → 625/1000 = 0,625.',
            'Denominadores amigos de 1000: 8 (×125), 20 (×50), 25 (×40), 40 (×25), 50 (×20).',
            'Leer decimales es fácil cuando el denominador es una potencia amiga de 10.',
          ],
          generate: genMilesimas,
        },
        {
          id: 'periodicos',
          name: 'Decimales periódicos',
          summary: 'El remate curioso: los patrones del 7, el 9 y el 11.',
          steps: [
            '1/7 = 0,142857 142857… y las demás son la MISMA cadena empezando en otro punto: 3/7 = 0,428571…',
            'n/9 repite la cifra n: 5/9 = 0,555…',
            'n/11 repite el bloque de dos cifras n×9: 4/11 = 0,3636… (4×9 = 36).',
          ],
          generate: genPeriodicos,
        },
      ],
    },
    {
      id: 8,
      emoji: '💯',
      title: 'Porcentajes en la vida real',
      tagline: 'Pilares, espejo y descuentos: el % como reflejo de las fracciones.',
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
            'Cada pilar es una fracción de la etapa 7 con otro nombre.',
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
        {
          id: 'espejo',
          name: 'El espejo',
          summary: 'X% de Y = Y% de X: gíralo y vuelve trivial.',
          steps: [
            '8% de 25 = 25% de 8 = 2. Girado, es un pilar.',
            '36% de 50 = 50% de 36 = 18.',
            'Cuando el número "feo" es el porcentaje, dale la vuelta.',
          ],
          generate: genEspejo,
        },
        {
          id: 'descuentos',
          name: 'Descuentos y aumentos',
          summary: 'Precios con −30% o +10%: piensa en lo que queda.',
          steps: [
            '240 − 25%: queda el 75% → 180.',
            '−50% es la mitad; −10% es quitar un décimo: 340 − 10% = 306.',
            'Para aumentos, suma el pilar: 240 + 10% = 264.',
          ],
          generate: genDescuento,
        },
      ],
    },
    {
      id: 9,
      emoji: '⚖️',
      title: 'Proporciones y regla de tres',
      tagline: 'Razones, tasas y escalado rápido con contexto real.',
      bossCount: 15,
      criteria: { bronze: { acc: 0.75 }, silver: { acc: 0.85, avgMs: 10000 }, gold: { acc: 0.9, avgMs: 7000 } },
      techniques: [
        {
          id: 'regla-3',
          name: 'Regla de tres directa',
          summary: 'Baja a la unidad y escala: precios, ritmos, recetas.',
          steps: [
            '3 por 12 €: uno vale 4 € → 7 valen 28 €.',
            'Primero divide (¿cuánto vale uno?), luego multiplica.',
            'Atajo: 7 es 3 más un tercio de 3 y pico… pero la unidad nunca falla.',
          ],
          generate: genRegla3,
        },
        {
          id: 'simplificar',
          name: 'Simplificar razones',
          summary: 'Reduce la fracción dividiendo ambos lados por lo mismo.',
          steps: [
            '24 de 36 = ? de 6: divide ambos entre 6 → 4 de 6.',
            'Busca el divisor común más evidente (2, 3, 5, 10) y repite.',
            'Una razón no cambia si multiplicas o divides los dos lados por igual.',
          ],
          generate: genSimplificar,
        },
        {
          id: 'cadena-pct',
          name: 'Porcentajes encadenados',
          summary: 'Subir 20% y bajar 20% NO devuelve al origen.',
          steps: [
            '100 sube 20% → 120; baja 20% → 96 (¡no 100!).',
            'El segundo porcentaje se aplica al valor nuevo, no al original.',
            'Encadena en orden: cada paso parte del resultado anterior.',
          ],
          generate: genCadenaPct,
        },
      ],
    },
    {
      id: 10,
      emoji: '🎯',
      title: 'Estimación y control de errores',
      tagline: 'Respuesta razonable al instante y detectores de errores.',
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
          id: 'escalas',
          name: 'Miles y millones',
          summary: 'Órdenes de magnitud: mueve bloques de tres ceros.',
          steps: [
            '3.400.000 = 3400 miles = 3,4 millones.',
            'Mil = 10³ (k) · Millón = 10⁶ (M): un millón son mil miles.',
            'El primer control de cualquier cuenta: ¿la magnitud es razonable?',
          ],
          generate: genEscalas,
        },
        {
          id: 'controles',
          name: 'Detectores de errores',
          summary: 'Última cifra y resto de 9: dos chequeos sin repetir la cuenta.',
          steps: [
            'Última cifra: 47×82 debe acabar en 7×2 → 4. Si tu resultado no, hay error.',
            'Resto de 9: suma las cifras de cada factor, multiplica los restos y compara.',
            'La última cifra es el chequeo rápido; el 9 caza los errores de bloque.',
          ],
          generate: genControl,
        },
      ],
    },
    {
      id: 11,
      emoji: '🔢',
      title: 'Cuadrados, raíces y potencias',
      tagline: 'Del 13² al 50², raíces encajadas, cubos y potencias de 2.',
      bossCount: 16,
      criteria: { bronze: { acc: 0.75 }, silver: { acc: 0.85, avgMs: 8000 }, gold: { acc: 0.9, avgMs: 6000 } },
      techniques: [
        {
          id: 'cuadrados',
          name: 'Cuadrados 13–50',
          summary: 'Apóyate en la decena vecina: (a±d)² = a² ± 2ad + d².',
          steps: [
            '17² = (20−3)² = 400 − 120 + 9 = 289.',
            '43² = (40+3)² = 1600 + 240 + 9 = 1849.',
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
        {
          id: 'cubos',
          name: 'Cubos del 1 al 12',
          summary: 'n³ = n × n²: apóyate en los cuadrados que ya dominas.',
          steps: [
            '7³ = 7 × 49 = 343. 12³ = 12 × 144 = 1728.',
            'Memoriza los famosos: 3³=27, 5³=125, 10³=1000.',
            'Truco: los cubos terminan en cifras únicas (1→1, 2→8, 3→7, 7→3, 8→2…).',
          ],
          generate: genCubos,
        },
        {
          id: 'potencias-2',
          name: 'Potencias de 2',
          summary: 'De 2⁴ a 2¹⁴ doblando desde las anclas.',
          steps: [
            'Ancla maestra: 2¹⁰ = 1024 ≈ mil.',
            '2¹¹ = 2048, 2¹² = 4096: dobla desde 1024.',
            'Hacia abajo divide: 2⁹ = 512, 2⁸ = 256.',
          ],
          generate: genPotencias2,
        },
      ],
    },
    {
      id: 12,
      emoji: '👑',
      title: 'Élite: mezcla total',
      tagline: '3×3 aproximado, cadenas y el blitz de todas las técnicas.',
      bossCount: 20,
      criteria: { bronze: { acc: 0.75 }, silver: { acc: 0.85, avgMs: 9000 }, gold: { acc: 0.9, avgMs: 6000 } },
      techniques: [
        {
          id: 'est-3x3',
          name: 'Estimar 3×3',
          summary: 'Redondea a centenas y corrige: se acepta ±2%.',
          steps: [
            '274 × 361 ≈ 300 × 360 = 108.000; redondeaste 274 muy arriba → resta ~26×360 ≈ 9.400 → ~98.600. (Exacto: 98.914.)',
            'Corrige solo el redondeo GRANDE: el pequeño queda dentro del margen.',
            'Ordena magnitudes primero: ¿decenas de mil o centenas de mil?',
          ],
          generate: genEst3,
        },
        {
          id: 'difsq-3',
          name: 'Diferencia de cuadrados XL',
          summary: 'Pares equidistantes de una centena: exactos y veloces.',
          steps: [
            '304 × 296: centro 300 → 90.000 − 16 = 89.984.',
            'Reconócelos: los dos factores suman el doble de una centena.',
            'Es la técnica de la etapa 5 con centros grandes: misma mecánica.',
          ],
          generate: genDifSq3,
        },
        {
          id: 'sq-centenas',
          name: 'Cuadrados junto a centenas',
          summary: '(c±d)² = c² ± 2cd + d² con c redondo grande.',
          steps: [
            '203² = 40.000 + 1.200 + 9 = 41.209.',
            '698² = (700−2)² = 490.000 − 2.800 + 4 = 487.204.',
            '2cd es "el doble del centro por la distancia": lo demás ya lo sabes.',
          ],
          generate: genSqNear,
        },
        {
          id: 'cadenas',
          name: 'Cadenas aritméticas',
          summary: 'Varios pasos en un enunciado: orden y método mínimo.',
          steps: [
            '(38 + 62) × 25% : primero el paréntesis (100), luego el cuarto → 25.',
            '10% de 240 + 25% de 240 = 35% de 240 = 84: junta antes de calcular.',
            'La élite decide el orden que MENOS esfuerzo mental cuesta.',
          ],
          generate: genCadena,
        },
        {
          id: 'blitz',
          name: 'Blitz total',
          summary: 'Cualquier técnica de la etapa 1 a la 11, sin avisar.',
          steps: [
            'Antes de calcular, medio segundo para elegir: ¿compensar, doblar, ancla, pilar, regla de tres…?',
            'Elegir bien la técnica vale más que calcular rápido.',
            'Este es el examen final: todo lo aprendido, mezclado.',
          ],
          generate: genBlitz,
        },
      ],
    },
  ];

  function getLevel(id) {
    return LEVELS.find((l) => l.id === id) || null;
  }

  function getTechnique(levelId, techniqueId) {
    const level = getLevel(levelId);
    if (!level || !level.techniques) return null;
    return level.techniques.find((t) => t.id === techniqueId) || null;
  }

  /* Genera una tanda evitando repetir el mismo enunciado consecutivo.
     tierFor(index) permite rampas de dificultad dentro de la tanda. */
  function generateBatch(generators, count, rng, tierFor = () => 2) {
    const problems = [];
    let lastPrompt = null;
    let guard = 0;
    while (problems.length < count && guard < count * 30) {
      guard++;
      const gen = generators[problems.length % generators.length];
      const problem = gen(rng, tierFor(problems.length));
      if (problem.prompt === lastPrompt) continue;
      problems.push(problem);
      lastPrompt = problem.prompt;
    }
    return problems;
  }

  function generatePractice(levelId, techniqueId, count = 10, rng = createRng(Date.now() >>> 0), tier = 2) {
    const technique = getTechnique(levelId, techniqueId);
    if (!technique) return [];
    // La práctica también calienta: el primer tercio baja un tramo.
    const warmup = Math.max(1, tier - 1);
    return generateBatch([technique.generate], count, rng, (i) => (i < count / 3 ? warmup : tier));
  }

  function generateBoss(levelId, rng = createRng(Date.now() >>> 0), tier = 2) {
    const level = getLevel(levelId);
    if (!level || !level.techniques) return [];
    const generators = level.techniques.map((t) => t.generate);
    const count = level.bossCount || 20;
    // Rampa del desafío: arranca un tramo por debajo y sube.
    const warmup = Math.max(1, tier - 1);
    return generateBatch(generators, count, rng, (i) => (i < count / 4 ? warmup : tier));
  }

  /*
   * Evalúa una tanda de desafío: precisión + tiempo medio por ítem
   * contra los criterios de la etapa. Devuelve la mejor medalla alcanzada.
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

  /* Una etapa se desbloquea con al menos bronce en la anterior. */
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
