const test = require('node:test');
const assert = require('node:assert/strict');

const Engine = require('../lib/adaptiveEngine');

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-07-13T12:00:00Z');

function mul(a, b) {
  return { type: 'multiplication', a, b, answer: a * b };
}

function div(dividend, divisor) {
  return { type: 'division', dividend, divisor, answer: dividend / divisor };
}

test('mapea problemas a habilidades por tabla', () => {
  assert.deepEqual(Engine.skillsForProblem(mul(7, 8)), ['mul.t8', 'mul.t7']);
  assert.deepEqual(Engine.skillsForProblem(mul(6, 6)), ['mul.t6']);
  assert.deepEqual(Engine.skillsForProblem(div(56, 8)), ['div.t8']);
  assert.deepEqual(Engine.skillsForProblem({ skills: ['add.carry3'] }), ['add.carry3']);
  assert.deepEqual(Engine.skillsForProblem(null), []);
});

test('la dificultad crece con los operandos y baja con las anclas', () => {
  const easy = Engine.difficultyForProblem(mul(2, 3));
  const mid = Engine.difficultyForProblem(mul(6, 7));
  const hard = Engine.difficultyForProblem(mul(8, 9));
  assert.ok(easy < mid && mid < hard, 'monótona con el tamaño');
  assert.ok(
    Engine.difficultyForProblem(mul(5, 9)) < Engine.difficultyForProblem(mul(4, 9)),
    'el 5 es ancla más fácil que el 4'
  );
  assert.ok(
    Engine.difficultyForProblem(div(63, 9)) > Engine.difficultyForProblem(mul(9, 7)),
    'dividir cuesta más que multiplicar'
  );
  assert.equal(Engine.difficultyForProblem({ type: 'x', difficulty: 1234 }), 1234, 'respeta dificultad explícita');
});

test('el rating sube al acertar y baja al fallar (determinista)', () => {
  const state = Engine.createState();
  const before = Engine.RATING_START;
  Engine.recordOutcome(state, { problem: mul(7, 8), correct: true, timeMs: 2000, now: NOW });
  const afterWin = state.skills['mul.t8'].rating;
  assert.ok(afterWin > before);

  const state2 = Engine.createState();
  Engine.recordOutcome(state2, { problem: mul(7, 8), correct: false, timeMs: 2000, now: NOW });
  assert.ok(state2.skills['mul.t8'].rating < before);

  // Determinismo: misma secuencia, mismo resultado.
  const state3 = Engine.createState();
  Engine.recordOutcome(state3, { problem: mul(7, 8), correct: true, timeMs: 2000, now: NOW });
  assert.equal(state3.skills['mul.t8'].rating, afterWin);
});

test('la puntuación penaliza lentitud con suelo y anula fallos', () => {
  const base = { correct: true, skipped: false, timedOut: false, targetTimeMs: 4000 };
  assert.equal(Engine.outcomeScore(Object.assign({}, base, { timeMs: 3000 })), 1);
  const slow = Engine.outcomeScore(Object.assign({}, base, { timeMs: 12000 }));
  assert.ok(slow < 1 && slow >= 0.55);
  assert.equal(Engine.outcomeScore({ correct: false, timeMs: 1000, targetTimeMs: 4000 }), 0);
  assert.equal(Engine.outcomeScore(Object.assign({}, base, { skipped: true, timeMs: 1000 })), 0);
});

test('el factor K decrece con la evidencia y queda acotado', () => {
  assert.ok(Engine.kFactor(0) > Engine.kFactor(50));
  assert.ok(Engine.kFactor(10000) >= 10);
  assert.ok(Engine.kFactor(0) <= 36);
});

test('programa mantenimiento espaciado al consolidar y lo reinicia al fallar', () => {
  const state = Engine.createState();
  for (let i = 0; i < 6; i++) {
    Engine.recordOutcome(state, { problem: mul(6, 6), correct: true, timeMs: 1500, now: NOW + i * 1000 });
  }
  const skill = state.skills['mul.t6'];
  assert.ok(skill.due > NOW, 'repaso programado en el futuro');
  assert.ok(skill.srsStage >= 1, 'sube de etapa');

  Engine.recordOutcome(state, { problem: mul(6, 6), correct: false, now: NOW + 10000 });
  Engine.recordOutcome(state, { problem: mul(6, 6), correct: false, now: NOW + 11000 });
  assert.equal(skill.srsStage, 0, 'dos fallos seguidos reinician la etapa');
  assert.ok(skill.due <= NOW + 11000, 'y piden práctica inmediata');
});

test('detecta debilidades y fortalezas frente a la mediana del usuario', () => {
  const state = Engine.createState();
  // Tabla del 3 dominada, tabla del 8 con fallos, resto intermedio.
  for (let i = 0; i < 12; i++) {
    Engine.recordOutcome(state, { problem: mul(3, 3), correct: true, timeMs: 1500, now: NOW + i });
    Engine.recordOutcome(state, { problem: mul(8, 8), correct: i % 3 === 0, timeMs: 9000, now: NOW + i });
    Engine.recordOutcome(state, { problem: mul(6, 6), correct: i % 2 === 0, timeMs: 4000, now: NOW + i });
  }
  const analysis = Engine.analyze(state, { now: NOW + 1000 });
  assert.ok(analysis.strengths.some((s) => s.id === 'mul.t3'), 'tabla del 3 es fortaleza');
  assert.ok(analysis.weaknesses.some((s) => s.id === 'mul.t8'), 'tabla del 8 es debilidad');
  assert.ok(analysis.totalSkills >= 3);
});

test('ignora habilidades sin evidencia suficiente en el análisis', () => {
  const state = Engine.createState();
  Engine.recordOutcome(state, { problem: mul(9, 9), correct: false, now: NOW });
  const analysis = Engine.analyze(state, { now: NOW });
  assert.equal(analysis.totalSkills, 0);
  assert.deepEqual(analysis.weaknesses, []);
});

test('el sesgo de selección favorece lo débil y lo vencido, acotado', () => {
  const state = Engine.createState();
  for (let i = 0; i < 12; i++) {
    Engine.recordOutcome(state, { problem: mul(3, 3), correct: true, timeMs: 1500, now: NOW + i });
    Engine.recordOutcome(state, { problem: mul(8, 8), correct: false, now: NOW + i });
    Engine.recordOutcome(state, { problem: mul(6, 6), correct: i % 2 === 0, timeMs: 4000, now: NOW + i });
  }
  const weakBias = Engine.problemBias(state, mul(8, 8), { now: NOW + 1000 });
  const strongBias = Engine.problemBias(state, mul(3, 3), { now: NOW + 1000 });
  assert.ok(weakBias > strongBias, 'lo débil pesa más que lo fuerte');
  assert.ok(weakBias <= 2 && strongBias >= 0.6, 'sesgo acotado');
  assert.equal(Engine.problemBias(Engine.createState(), mul(4, 4), { now: NOW }), 1, 'sin datos, neutral');
});

test('acumula historial diario y lo poda a 120 días', () => {
  const state = Engine.createState();
  for (let i = 0; i < 130; i++) {
    Engine.recordOutcome(state, { problem: mul(4, 4), correct: true, timeMs: 2000, now: NOW + i * DAY_MS });
  }
  const days = Object.keys(state.history);
  assert.ok(days.length <= 120, `historial acotado (${days.length})`);
  const today = Engine.todayKey(NOW + 129 * DAY_MS);
  assert.equal(state.history[today].q, 1);
  assert.equal(state.history[today].ok, 1);
});

test('computeTrend compara la última semana con la anterior', () => {
  const state = Engine.createState();
  // Semana anterior: 50% de acierto y lento; última semana: 100% y rápido.
  for (let i = 13; i >= 7; i--) {
    Engine.recordOutcome(state, { problem: mul(4, 4), correct: i % 2 === 0, timeMs: 9000, now: NOW - i * DAY_MS });
  }
  for (let i = 6; i >= 0; i--) {
    Engine.recordOutcome(state, { problem: mul(4, 4), correct: true, timeMs: 2000, now: NOW - i * DAY_MS });
  }
  const trend = Engine.computeTrend(state.history, NOW);
  assert.ok(trend.accuracyDelta > 0, 'mejora de precisión detectada');
  assert.ok(trend.timeDelta < 0, 'mejora de velocidad detectada');
  assert.equal(trend.currVolume, 7);
});

test('normalizeState tolera datos corruptos y conserva los válidos', () => {
  const dirty = {
    skills: {
      'mul.t7': { rating: 'x', acc: 7, attempts: 4 },
      'mul.t2': { rating: 1100, acc: 0.9, speed: 0.8, attempts: 20 },
    },
    history: { '2026-07-01': { q: 5, ok: 4, t: 9000 }, bad: null },
  };
  const state = Engine.normalizeState(dirty);
  assert.equal(state.skills['mul.t7'].rating, Engine.RATING_START, 'rating corrupto → valor inicial');
  assert.ok(state.skills['mul.t7'].acc <= 1, 'acc acotada');
  assert.equal(state.skills['mul.t2'].rating, 1100, 'datos válidos intactos');
  assert.equal(state.history['2026-07-01'].ok, 4);
  assert.equal(Engine.normalizeState(null).v, Engine.VERSION);
});

test('las habilidades registradas exponen etiquetas legibles', () => {
  assert.equal(Engine.getSkillLabel('mul.t7'), 'Tabla del 7');
  assert.equal(Engine.getSkillLabel('div.t3'), 'División entre 3');
  Engine.registerSkill('add.carry3', { label: 'Sumas con acarreo (3 cifras)', group: 'suma' });
  assert.equal(Engine.getSkillLabel('add.carry3'), 'Sumas con acarreo (3 cifras)');
  assert.equal(Engine.getSkillLabel('desconocida'), 'desconocida', 'fallback al id');
});
