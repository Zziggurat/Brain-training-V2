/*
 * Motor adaptativo de Brain Training V2.
 *
 * Sistema 100% determinista (sin IA ni servicios externos) que modela el
 * rendimiento del usuario por HABILIDAD, no solo por problema:
 *
 *  - Rating estilo Elo por habilidad: converge rápido al nivel real del
 *    usuario y permite comparar habilidades entre sí y con la dificultad
 *    intrínseca de cada ejercicio.
 *  - Medias móviles exponenciales (EWMA) de precisión y velocidad: dan más
 *    peso a lo reciente sin descartar el pasado (mejor que un % simple).
 *  - Repaso espaciado por habilidad: complementa al repaso por problema de
 *    la app señalando cuándo una destreza completa necesita mantenimiento.
 *  - Historial diario agregado y acotado: permite mostrar la evolución sin
 *    crecer sin límite en localStorage.
 *  - Análisis de fortalezas/debilidades relativo a la mediana del propio
 *    usuario (no umbrales absolutos), con mínimos de evidencia.
 *  - Sesgo de selección: multiplica el peso de los problemas cuyas
 *    habilidades están débiles o vencidas, buscando la zona de flujo
 *    (~80% de éxito esperado).
 *
 * El módulo es puro: no toca el DOM ni localStorage y todas las funciones
 * aceptan `now` inyectable, lo que lo hace testeable y reutilizable para
 * futuros niveles (sumas, porcentajes, anclas…): basta registrar nuevas
 * habilidades y pasar la dificultad desde su generador.
 */
(function (globalScope, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    const namespace = factory();
    const target = typeof globalScope !== 'undefined' ? globalScope : {};
    target.AdaptiveEngine = namespace;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  const VERSION = 1;

  const DAY_MS = 24 * 60 * 60 * 1000;
  // Intervalos de mantenimiento por habilidad (más largos que los de
  // problema individual: una habilidad agrupa muchos problemas).
  const SKILL_INTERVALS_DAYS = [1, 3, 7, 14, 30];
  const HISTORY_MAX_DAYS = 120;
  const RATING_START = 1000;
  const EWMA_ALPHA = 0.15;
  // Evidencia mínima para emitir juicios sobre una habilidad.
  const MIN_ATTEMPTS_FOR_ANALYSIS = 6;

  /* ------------------------------------------------------------
     Registro de habilidades (extensible para futuros niveles)
     ------------------------------------------------------------ */

  const registry = {};

  function registerSkill(id, meta = {}) {
    if (typeof id !== 'string' || !id) return;
    registry[id] = Object.assign({ label: id, group: 'general' }, registry[id] || {}, meta);
  }

  for (let n = 1; n <= 12; n++) {
    registerSkill(`mul.t${n}`, { label: `Tabla del ${n}`, group: 'multiplicación', table: n });
    registerSkill(`div.t${n}`, { label: `División entre ${n}`, group: 'división', table: n });
  }

  function getSkillMeta(id) {
    return registry[id] || { label: id, group: 'general' };
  }

  function getSkillLabel(id) {
    return getSkillMeta(id).label;
  }

  /* ------------------------------------------------------------
     Mapeo problema → habilidades y dificultad intrínseca
     ------------------------------------------------------------ */

  function skillsForProblem(problem) {
    if (!problem || typeof problem !== 'object') return [];
    if (problem.type === 'multiplication') {
      const lo = Math.min(problem.a, problem.b);
      const hi = Math.max(problem.a, problem.b);
      const ids = [`mul.t${hi}`];
      if (lo !== hi) ids.push(`mul.t${lo}`);
      return ids;
    }
    if (problem.type === 'division') {
      return [`div.t${problem.divisor}`];
    }
    if (Array.isArray(problem.skills)) {
      // Problemas de futuros niveles: traen sus habilidades explícitas.
      return problem.skills.filter((s) => typeof s === 'string');
    }
    return [];
  }

  /*
   * Dificultad heurística en la escala Elo. Reglas, no magia: crece con el
   * tamaño de los operandos y baja con las "anclas" fáciles (1, 2, 5, 10)
   * y los cuadrados (se memorizan antes). Los futuros generadores pueden
   * pasar `problem.difficulty` explícita y se respeta.
   */
  function difficultyForProblem(problem) {
    if (!problem || typeof problem !== 'object') return RATING_START;
    if (Number.isFinite(problem.difficulty)) return problem.difficulty;
    if (problem.type === 'multiplication') {
      const lo = Math.min(problem.a, problem.b);
      const hi = Math.max(problem.a, problem.b);
      let d = 880 + 13 * (lo + hi) + 7 * lo;
      if (lo === 1) d -= 140;
      else if (lo === 2) d -= 70;
      if (lo === 5 || lo === 10) d -= 60;
      if (hi === 5 || hi === 10) d -= 40;
      if (lo === hi) d -= 30;
      return d;
    }
    if (problem.type === 'division') {
      const divisor = problem.divisor || 1;
      const quotient = problem.answer || (problem.dividend && divisor ? problem.dividend / divisor : 1);
      // Dividir es algo más costoso que la multiplicación equivalente.
      return difficultyForProblem({ type: 'multiplication', a: divisor, b: quotient }) + 40;
    }
    return RATING_START;
  }

  /* Tiempo objetivo (ms) para considerar una respuesta "rápida". */
  function targetTimeForProblem(problem) {
    if (problem && Number.isFinite(problem.targetTimeMs)) return problem.targetTimeMs;
    return 4000;
  }

  /* ------------------------------------------------------------
     Estado
     ------------------------------------------------------------ */

  function createSkillState() {
    return {
      rating: RATING_START,
      acc: 0, // EWMA cruda de acierto (leer con accuracyOf, que corrige el sesgo)
      speed: 0, // EWMA cruda de velocidad (leer con speedOf)
      speedSamples: 0,
      attempts: 0,
      streak: 0,
      errorStreak: 0,
      lastSeen: 0,
      srsStage: 0,
      due: 0,
    };
  }

  /*
   * Las EWMA arrancan en 0, lo que sesga las primeras lecturas hacia abajo.
   * Se corrige dividiendo por (1 − (1−α)^n): con pocas muestras equivale a
   * la media simple y converge a la EWMA pura con la evidencia.
   */
  function correctedEwma(raw, samples) {
    if (!(samples > 0)) return 0;
    const denom = 1 - Math.pow(1 - EWMA_ALPHA, samples);
    return denom > 0 ? clamp(raw / denom, 0, 1) : 0;
  }

  function accuracyOf(skill) {
    return correctedEwma(skill.acc, skill.attempts);
  }

  function speedOf(skill) {
    return correctedEwma(skill.speed, skill.speedSamples);
  }

  function createState() {
    return { v: VERSION, skills: {}, history: {} };
  }

  /* Sanea un estado cargado de localStorage (tolerante a corrupción). */
  function normalizeState(raw) {
    const state = createState();
    if (!raw || typeof raw !== 'object') return state;
    if (raw.skills && typeof raw.skills === 'object') {
      Object.keys(raw.skills).forEach((id) => {
        const entry = Object.assign(createSkillState(), raw.skills[id] || {});
        if (!Number.isFinite(entry.rating)) entry.rating = RATING_START;
        entry.acc = clamp(Number(entry.acc) || 0, 0, 1);
        entry.speed = clamp(Number(entry.speed) || 0, 0, 1);
        entry.speedSamples = entry.speedSamples | 0;
        state.skills[id] = entry;
      });
    }
    if (raw.history && typeof raw.history === 'object') {
      Object.keys(raw.history).forEach((day) => {
        const rec = raw.history[day];
        if (rec && typeof rec === 'object') {
          state.history[day] = {
            q: rec.q | 0,
            ok: rec.ok | 0,
            t: Number.isFinite(rec.t) ? rec.t : 0,
            fast: rec.fast | 0,
            slow: rec.slow | 0,
          };
        }
      });
    }
    return state;
  }

  function getSkillState(state, id) {
    if (!state.skills[id]) {
      state.skills[id] = createSkillState();
    }
    return state.skills[id];
  }

  /* ------------------------------------------------------------
     Núcleo Elo + EWMA
     ------------------------------------------------------------ */

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function expectedSuccess(rating, difficulty) {
    return 1 / (1 + Math.pow(10, (difficulty - rating) / 400));
  }

  /* Dificultad cuya probabilidad de éxito esperada es `p` (zona de flujo). */
  function targetDifficulty(rating, p = 0.8) {
    const safeP = clamp(p, 0.05, 0.95);
    return rating - 400 * Math.log10(1 / safeP - 1);
  }

  /*
   * Puntuación del intento en [0,1]: el fallo puntúa 0; el acierto puntúa 1
   * si entra en el tiempo objetivo y decae suavemente si tarda más (con
   * suelo en 0.55 para que un acierto lento nunca compute como fracaso).
   */
  function outcomeScore({ correct, skipped, timedOut, timeMs, targetTimeMs }) {
    if (!correct || skipped || timedOut) return 0;
    const target = targetTimeMs > 0 ? targetTimeMs : 4000;
    if (!(timeMs > 0) || timeMs <= target) return 1;
    const ratio = timeMs / target;
    return clamp(1 - 0.15 * (ratio - 1), 0.55, 1);
  }

  /* K decreciente: aprende rápido al principio, se estabiliza con evidencia. */
  function kFactor(attempts) {
    return clamp(36 / Math.sqrt(1 + attempts / 8), 10, 36);
  }

  function todayKey(now) {
    const d = new Date(now);
    const m = `${d.getMonth() + 1}`.padStart(2, '0');
    const day = `${d.getDate()}`.padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  function updateHistory(state, { correct, timeMs }, now) {
    const key = todayKey(now);
    const rec = state.history[key] || { q: 0, ok: 0, t: 0, fast: 0, slow: 0 };
    rec.q += 1;
    if (correct) rec.ok += 1;
    const ms = Number.isFinite(timeMs) && timeMs > 0 ? Math.min(timeMs, 30000) : 0;
    rec.t += ms;
    if (ms > 0 && ms <= 3000) rec.fast += 1;
    if (ms > 8000) rec.slow += 1;
    state.history[key] = rec;
    // Poda: conservar solo los últimos HISTORY_MAX_DAYS días.
    const days = Object.keys(state.history).sort();
    while (days.length > HISTORY_MAX_DAYS) {
      delete state.history[days.shift()];
    }
  }

  /*
   * Registra un intento y actualiza cada habilidad implicada.
   * Devuelve un resumen útil para depuración/telemetría local.
   */
  function recordOutcome(state, event) {
    const {
      problem,
      correct = false,
      skipped = false,
      timedOut = false,
      timeMs = 0,
      now = Date.now(),
    } = event || {};
    const skillIds = skillsForProblem(problem);
    if (!skillIds.length) return { skillIds: [], score: 0, expected: 0 };

    const difficulty = difficultyForProblem(problem);
    const targetTimeMs = targetTimeForProblem(problem);
    const score = outcomeScore({ correct, skipped, timedOut, timeMs, targetTimeMs });
    const treatedCorrect = !!correct && !skipped && !timedOut;
    let expectedMean = 0;

    skillIds.forEach((id) => {
      const skill = getSkillState(state, id);
      const expected = expectedSuccess(skill.rating, difficulty);
      expectedMean += expected / skillIds.length;
      skill.rating += kFactor(skill.attempts) * (score - expected);
      skill.attempts += 1;
      skill.lastSeen = now;
      skill.acc += EWMA_ALPHA * ((treatedCorrect ? 1 : 0) - skill.acc);
      if (treatedCorrect) {
        const speedSample = clamp(targetTimeMs / Math.max(timeMs || targetTimeMs, 800), 0, 1);
        skill.speed += EWMA_ALPHA * (speedSample - skill.speed);
        skill.speedSamples += 1;
        skill.streak += 1;
        skill.errorStreak = 0;
        // Mantenimiento espaciado: con dominio consolidado, programar
        // el siguiente repaso de la habilidad y subir de etapa.
        if (skill.streak >= 3 && accuracyOf(skill) >= 0.85) {
          const stage = clamp(skill.srsStage, 0, SKILL_INTERVALS_DAYS.length - 1);
          skill.due = now + SKILL_INTERVALS_DAYS[stage] * DAY_MS;
          skill.srsStage = Math.min(stage + 1, SKILL_INTERVALS_DAYS.length - 1);
        }
      } else {
        skill.streak = 0;
        skill.errorStreak += 1;
        // Dos fallos seguidos degradan el mantenimiento: practicar ya.
        if (skill.errorStreak >= 2) {
          skill.srsStage = 0;
          skill.due = now;
        }
      }
    });

    updateHistory(state, { correct: treatedCorrect, timeMs }, now);
    return { skillIds, score, expected: expectedMean, difficulty };
  }

  /* ------------------------------------------------------------
     Sesgo de selección (zona de flujo)
     ------------------------------------------------------------ */

  /*
   * Multiplicador acotado [0.6, 2] para el peso de un problema: favorece
   * habilidades por debajo de la mediana del usuario y las vencidas de
   * repaso; penaliza ligeramente las muy dominadas para no desperdiciar
   * tiempo de sesión.
   */
  function problemBias(state, problem, { now = Date.now() } = {}) {
    const skillIds = skillsForProblem(problem);
    if (!skillIds.length) return 1;
    const median = medianRating(state);
    let bias = 1;
    skillIds.forEach((id) => {
      const skill = state.skills[id];
      if (!skill || skill.attempts < 3) return; // sin evidencia, neutral
      bias += clamp((median - skill.rating) / 400, -0.2, 0.5);
      if (skill.due > 0 && skill.due <= now) bias += 0.25;
      if (skill.errorStreak >= 2) bias += 0.2;
      if (skill.attempts >= MIN_ATTEMPTS_FOR_ANALYSIS && accuracyOf(skill) < 0.6) bias += 0.2;
    });
    return clamp(bias, 0.6, 2);
  }

  function medianRating(state) {
    const ratings = Object.keys(state.skills)
      .map((id) => state.skills[id])
      .filter((s) => s.attempts >= MIN_ATTEMPTS_FOR_ANALYSIS)
      .map((s) => s.rating)
      .sort((a, b) => a - b);
    if (!ratings.length) return RATING_START;
    const mid = ratings.length >> 1;
    return ratings.length % 2 ? ratings[mid] : (ratings[mid - 1] + ratings[mid]) / 2;
  }

  /* ------------------------------------------------------------
     Análisis: fortalezas, debilidades, repaso y tendencias
     ------------------------------------------------------------ */

  function analyze(state, { now = Date.now() } = {}) {
    const skills = Object.keys(state.skills)
      .map((id) => {
        const raw = state.skills[id];
        return Object.assign({ id }, raw, {
          label: getSkillLabel(id),
          meta: getSkillMeta(id),
          accEff: accuracyOf(raw),
          speedEff: speedOf(raw),
        });
      })
      .filter((s) => s.attempts >= MIN_ATTEMPTS_FOR_ANALYSIS);

    const median = medianRating(state);

    const strengths = skills
      .filter((s) => s.rating >= median + 50 && s.accEff >= 0.85)
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 3);

    /*
     * Debilidad = por debajo de la mediana del propio usuario, o precisión
     * efectiva baja (el Elo "perdona" fallar ítems difíciles: esto lo
     * complementa), o racha de errores activa.
     */
    const weaknesses = skills
      .filter((s) => s.rating <= median - 50 || s.accEff < 0.6 || s.errorStreak >= 3)
      .sort((a, b) => a.accEff - b.accEff || a.rating - b.rating)
      .slice(0, 3);

    const review = skills
      .filter((s) => s.due > 0 && s.due <= now)
      .sort((a, b) => a.due - b.due)
      .slice(0, 3);

    return {
      median,
      totalSkills: skills.length,
      strengths,
      weaknesses,
      review,
      trend: computeTrend(state.history, now),
      recentDays: recentHistory(state.history, now, 14),
    };
  }

  /* Serie de los últimos `count` días (huecos incluidos, para graficar). */
  function recentHistory(history, now, count) {
    const days = [];
    for (let i = count - 1; i >= 0; i--) {
      const key = todayKey(now - i * DAY_MS);
      const rec = history[key] || { q: 0, ok: 0, t: 0, fast: 0, slow: 0 };
      days.push(Object.assign({ day: key }, rec));
    }
    return days;
  }

  function aggregate(days) {
    return days.reduce(
      (acc, d) => {
        acc.q += d.q;
        acc.ok += d.ok;
        acc.t += d.t;
        acc.fast += d.fast;
        return acc;
      },
      { q: 0, ok: 0, t: 0, fast: 0 }
    );
  }

  /*
   * Compara los últimos 7 días con los 7 anteriores. Devuelve deltas de
   * precisión, velocidad media y volumen (null si no hay datos que comparar).
   */
  function computeTrend(history, now) {
    const last14 = recentHistory(history, now, 14);
    const prev = aggregate(last14.slice(0, 7));
    const curr = aggregate(last14.slice(7));
    const result = {
      currAccuracy: curr.q > 0 ? curr.ok / curr.q : null,
      prevAccuracy: prev.q > 0 ? prev.ok / prev.q : null,
      currAvgTime: curr.q > 0 && curr.t > 0 ? curr.t / curr.q : null,
      prevAvgTime: prev.q > 0 && prev.t > 0 ? prev.t / prev.q : null,
      currVolume: curr.q,
      prevVolume: prev.q,
      accuracyDelta: null,
      timeDelta: null,
    };
    if (result.currAccuracy !== null && result.prevAccuracy !== null) {
      result.accuracyDelta = result.currAccuracy - result.prevAccuracy;
    }
    if (result.currAvgTime !== null && result.prevAvgTime !== null) {
      result.timeDelta = result.currAvgTime - result.prevAvgTime;
    }
    return result;
  }

  return {
    VERSION,
    RATING_START,
    MIN_ATTEMPTS_FOR_ANALYSIS,
    registerSkill,
    getSkillMeta,
    getSkillLabel,
    skillsForProblem,
    difficultyForProblem,
    targetTimeForProblem,
    expectedSuccess,
    targetDifficulty,
    outcomeScore,
    kFactor,
    accuracyOf,
    speedOf,
    createState,
    normalizeState,
    recordOutcome,
    problemBias,
    medianRating,
    analyze,
    computeTrend,
    recentHistory,
    todayKey,
  };
});
