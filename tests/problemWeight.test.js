const test = require('node:test');
const assert = require('node:assert/strict');

const { calculateProblemWeightFromStats } = require('../lib/problemWeight');

test('calcula peso para problemas sin intentos previos', () => {
  const now = Date.now();
  const weight = calculateProblemWeightFromStats(
    {
      starCount: 0,
      attempts: 0,
      accuracy: 0,
      avgTime: 0,
      streak: 0,
      errorStreak: 0,
      lastSeen: 0,
    },
    { now }
  );
  assert.equal(weight, 10);
});

test('prioriza problemas con repaso vencido', () => {
  const now = Date.now();
  const weight = calculateProblemWeightFromStats(
    {
      starCount: 2,
      attempts: 10,
      accuracy: 0.8,
      avgTime: 5000,
      streak: 2,
      errorStreak: 1,
      lastSeen: now - 3 * 24 * 60 * 60 * 1000,
      due: now - 60 * 1000,
    },
    { now }
  );
  assert.equal(weight, 14);
});

test('reduce peso para alta precisión con racha larga y repaso futuro', () => {
  const now = Date.now();
  const weight = calculateProblemWeightFromStats(
    {
      starCount: 5,
      attempts: 20,
      accuracy: 0.98,
      avgTime: 2500,
      streak: 6,
      errorStreak: 0,
      lastSeen: now - 12 * 60 * 60 * 1000,
      due: now + 7 * 24 * 60 * 60 * 1000,
    },
    { now }
  );
  assert.equal(weight, 1);
});

test('aumenta peso para tiempos promedios lentos y errores consecutivos', () => {
  const now = Date.now();
  const weight = calculateProblemWeightFromStats(
    {
      starCount: 4,
      attempts: 8,
      accuracy: 0.9,
      avgTime: 9000,
      streak: 1,
      errorStreak: 3,
      lastSeen: now - 6 * 24 * 60 * 60 * 1000,
      due: 0,
    },
    { now }
  );
  assert.equal(weight, 8);
});
