(function (globalScope, factory) {
  if (typeof module === 'object' && typeof module.exports === 'object') {
    module.exports = factory();
  } else {
    const namespace = factory();
    const target = typeof globalScope !== 'undefined' ? globalScope : {};
    target.ProblemWeight = namespace;
  }
})(typeof globalThis !== 'undefined' ? globalThis : typeof self !== 'undefined' ? self : this, function () {
  function calculateProblemWeightFromStats(stats = {}, { now = Date.now() } = {}) {
    const {
      starCount = 0,
      due = 0,
      accuracy = 0,
      attempts = 0,
      avgTime = 0,
      streak = 0,
      errorStreak = 0,
      lastSeen = 0,
    } = stats;

    let weight = 1;

    if (starCount < 5) {
      weight += (5 - starCount) * 1.2;
    } else {
      weight += 0.5;
    }

    if (due > 0) {
      if (due <= now) {
        weight += 6;
      } else {
        const diff = due - now;
        if (diff < 60 * 60 * 1000) {
          weight += 4;
        } else if (diff < 6 * 60 * 60 * 1000) {
          weight += 2.5;
        } else {
          weight += 0.6;
        }
      }
    }

    if (attempts === 0) {
      weight += 2.5;
    } else if (accuracy < 0.5) {
      weight += 5;
    } else if (accuracy < 0.7) {
      weight += 3;
    } else if (accuracy < 0.85) {
      weight += 1.5;
    } else if (accuracy > 0.95 && streak >= 5 && due > now) {
      weight *= 0.6;
    }

    if (avgTime > 8000) {
      weight += 2;
    } else if (avgTime > 6000) {
      weight += 1;
    }

    if (errorStreak >= 2) {
      weight += 1.5;
    }

    if (lastSeen > 0) {
      const since = now - lastSeen;
      if (since > 5 * 24 * 60 * 60 * 1000) {
        weight += 2.5;
      } else if (since > 2 * 24 * 60 * 60 * 1000) {
        weight += 1.5;
      } else if (since > 24 * 60 * 60 * 1000) {
        weight += 0.8;
      }
    } else {
      weight += 0.8;
    }

    if (weight < 1) {
      return 1;
    }
    return Math.max(1, Math.round(weight));
  }

  return {
    calculateProblemWeightFromStats,
  };
});
