/*
 * Nueva versión de la aplicación de tablas para multiplicar y dividir.
 * Maneja la navegación, configuración global, aprendizaje, entrenamiento y visualización de tablas.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Referencias a las diferentes pantallas
  const screens = {
    home: document.getElementById('home-screen'),
    config: document.getElementById('config-screen'),
    learning: document.getElementById('learning-screen'),
    training: document.getElementById('training-screen'),
    tables: document.getElementById('tables-screen'),
    progress: document.getElementById('progress-screen'),
  };

  // Botones en la pantalla de inicio
  const homeSettingsBtn = document.getElementById('home-settings-btn');
  const homeLearnBtn = document.getElementById('home-learn-btn');
  const homeTrainBtn = document.getElementById('home-train-btn');
  // Botón para entrenar los errores del día
  const homeErrorsBtn = document.getElementById('home-errors-btn');
  const homeTablesBtn = document.getElementById('home-tables-btn');
  // Botón para la pantalla de progreso
  const homeProgressBtn = document.getElementById('home-progress-btn');
  const homeProgressShortcut = document.getElementById('home-progress-shortcut');
  const homeOpMulBtn = document.getElementById('home-op-mul');
  const homeOpDivBtn = document.getElementById('home-op-div');

  // Elementos de progreso global
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  // Configuración: inputs y botones
  const configBackBtn = document.getElementById('config-back-btn');
  const configSaveBtn = document.getElementById('config-save-btn');
  const operationRadios = document.querySelectorAll('input[name="operation"]');
  const configMinInput = document.getElementById('config-min');
  const configMaxInput = document.getElementById('config-max');
  const configMultipleChoice = document.getElementById('config-multiple-choice');
  const configNumQuestionsSelect = document.getElementById('config-num-questions');
  const configSecondsInput = document.getElementById('config-seconds');

  // Botón para restablecer progreso
  const resetProgressBtn = document.getElementById('reset-progress-btn');

  // Pantalla de aprendizaje
  const learnBackBtn = document.getElementById('learn-back-btn');
  const learnProgressSpan = document.getElementById('learn-progress');
  const learnProblemDiv = document.getElementById('learn-problem');
  const learnAnswerArea = document.getElementById('learn-answer-area');
  const learnFeedbackDiv = document.getElementById('learn-feedback');
  const learnNextBtn = document.getElementById('learn-next-btn');

  // Contenedor para las estrellas en modo aprendizaje (solo aprendizaje muestra estrellas)
  const learnStarsDiv = document.getElementById('learn-stars');

  // Botón para saltar o revelar respuesta en problemas escritos
  const learnSkipBtn = document.getElementById('learn-skip-btn');
  const LEARN_SKIP_TEXT = 'Mostrar respuesta';
  const LEARN_SKIP_ARIA = 'Mostrar la respuesta correcta y pasar a la siguiente pregunta';
  if (learnSkipBtn) {
    learnSkipBtn.textContent = LEARN_SKIP_TEXT;
    learnSkipBtn.setAttribute('aria-label', LEARN_SKIP_ARIA);
  }

  // Pantalla de entrenamiento
  const trainBackBtn = document.getElementById('train-back-btn');
  const trainProgressSpan = document.getElementById('train-progress');
  const trainTimerBar = document.getElementById('train-timer-bar');
  const trainTimerFill = document.getElementById('train-timer-fill');
  const trainProblemDiv = document.getElementById('train-problem');
  const trainAnswerArea = document.getElementById('train-answer-area');
  const trainFeedbackDiv = document.getElementById('train-feedback');
  const trainScoreDiv = document.getElementById('train-score');
  const trainRestartBtn = document.getElementById('train-restart-btn');
  const trainSkipBtn = document.getElementById('train-skip-btn');
  const TRAIN_SKIP_ARIA =
    'Mostrar la respuesta correcta y avanzar al siguiente problema de entrenamiento';
  if (trainSkipBtn) {
    trainSkipBtn.textContent = LEARN_SKIP_TEXT;
    trainSkipBtn.setAttribute('aria-label', TRAIN_SKIP_ARIA);
    trainSkipBtn.classList.add('hidden');
  }

  const TRAINING_CONTEXT = Object.freeze({
    GENERAL: 'general',
    SPECIFIC: 'specific',
  });
  let trainingSessionContext = TRAINING_CONTEXT.GENERAL;
  let trainingHasMistake = false;

  // Elementos de la pantalla de progreso
  const progressBackBtn = document.getElementById('progress-back-btn');
  const heatmapContainer = document.getElementById('heatmap-container');
  const metricsCard = document.getElementById('metrics-card');
  const goalCard = document.getElementById('goal-card');

  // Tarjeta que muestra el resultado de la celda seleccionada en la pantalla de progreso
  const resultCard = document.getElementById('result-card');

  // Panel de asistente en la pantalla de inicio
  const assistantPanel = document.getElementById('assistant-panel');

  // Variable para registrar si hubo un intento incorrecto en el problema actual (modo aprendizaje)
  let learningHasWrongAttempt = false;

  // Pantalla de tablas
  const tablesBackBtn = document.getElementById('tables-back-btn');
  const tablesContainer = document.getElementById('tables-container');

  // Entrenamiento específico: elementos
  const specificToggle = document.getElementById('specific-toggle');
  const startSpecificBtn = document.getElementById('start-specific-btn');

  // Almacena la lista de problemas del entrenamiento específico actual (si existe)
  let currentSpecificSelection = null;
  let tablesRenderHandle = null;
  let tableCardObserver = null;
  const rowResetQueue = [];
  let rowResetHandle = null;
  let assistantRefreshHandle = null;

  function scheduleRowResetProcessing() {
    if (rowResetHandle !== null) {
      return;
    }
    const win = typeof window !== 'undefined' ? window : null;
    if (win && typeof win.requestIdleCallback === 'function') {
      rowResetHandle = win.requestIdleCallback((deadline) => {
        rowResetHandle = null;
        processRowResetQueue(deadline);
      });
      return;
    }
    if (win && typeof win.requestAnimationFrame === 'function') {
      rowResetHandle = win.requestAnimationFrame(() => {
        rowResetHandle = null;
        processRowResetQueue();
      });
      return;
    }
    rowResetHandle = setTimeout(() => {
      rowResetHandle = null;
      processRowResetQueue();
    }, 16);
  }

  function processRowResetQueue(deadline) {
    const useIdle = deadline && typeof deadline.timeRemaining === 'function';
    const batchSize = 2;
    let processed = 0;

    while (rowResetQueue.length > 0) {
      if (useIdle && deadline.timeRemaining() <= 0) {
        break;
      }
      if (!useIdle && processed >= batchSize) {
        break;
      }

      const card = rowResetQueue.shift();
      if (!card || card.dataset.rendered !== 'true') {
        processed += 1;
        continue;
      }

      const rowsContainer = card.querySelector('.table-rows');
      if (!rowsContainer) {
        processed += 1;
        continue;
      }

      const checkboxes = rowsContainer.querySelectorAll('.row-checkbox');
      if (!checkboxes.length) {
        processed += 1;
        continue;
      }

      checkboxes.forEach((rowCb) => {
        if (!rowCb.disabled) {
          rowCb.disabled = true;
        }
        if (rowCb.checked) {
          rowCb.checked = false;
        }
      });

      processed += 1;
    }

    if (rowResetQueue.length > 0) {
      scheduleRowResetProcessing();
    }
  }

  function enqueueRowReset(card) {
    if (!card || card.dataset.rendered !== 'true') {
      return;
    }
    if (rowResetQueue.includes(card)) {
      return;
    }
    const rowsContainer = card.querySelector('.table-rows');
    if (!rowsContainer) {
      return;
    }
    if (
      !rowsContainer.querySelector('.row-checkbox:not(:disabled), .row-checkbox:checked')
    ) {
      return;
    }
    rowResetQueue.push(card);
    scheduleRowResetProcessing();
  }

  function scheduleAssistantPanelRefresh() {
    if (!assistantPanel) return;
    if (assistantRefreshHandle !== null) {
      return;
    }
    const win = typeof window !== 'undefined' ? window : null;
    const runner = () => {
      assistantRefreshHandle = null;
      try {
        renderAssistantPanel();
      } catch (err) {
        console.error('Error al actualizar el asistente', err);
      }
    };
    if (win && typeof win.requestAnimationFrame === 'function') {
      assistantRefreshHandle = win.requestAnimationFrame(runner);
      return;
    }
    assistantRefreshHandle = setTimeout(runner, 0);
  }

  // Configuración por defecto y estadísticas
  const defaultModeSettings = Object.freeze({
    min: 1,
    max: 10,
    multipleChoice: false,
    numQuestions: 10,
    seconds: 30,
  });

  function cloneModeSettings(source = defaultModeSettings) {
    return {
      min: Number.isFinite(source.min) ? source.min : defaultModeSettings.min,
      max: Number.isFinite(source.max) ? source.max : defaultModeSettings.max,
      multipleChoice:
        typeof source.multipleChoice === 'boolean'
          ? source.multipleChoice
          : defaultModeSettings.multipleChoice,
      numQuestions: Number.isFinite(source.numQuestions)
        ? source.numQuestions
        : defaultModeSettings.numQuestions,
      seconds: Number.isFinite(source.seconds) ? source.seconds : defaultModeSettings.seconds,
    };
  }

  const defaultConfig = {
    activeOperation: 'multiplication',
    modes: {
      multiplication: cloneModeSettings(),
      division: cloneModeSettings(),
    },
  };

  function cloneDefaultConfig() {
    return {
      activeOperation: defaultConfig.activeOperation,
      modes: {
        multiplication: cloneModeSettings(defaultConfig.modes.multiplication),
        division: cloneModeSettings(defaultConfig.modes.division),
      },
    };
  }

  function normalizeModeSettings(raw, fallback) {
    const base = cloneModeSettings(fallback);
    if (!raw || typeof raw !== 'object') {
      return base;
    }
    const normalized = cloneModeSettings(raw);
    normalized.min = Math.max(1, Math.floor(normalized.min));
    normalized.max = Math.max(normalized.min, Math.floor(normalized.max));
    normalized.numQuestions = Math.max(1, Math.floor(normalized.numQuestions));
    normalized.seconds = Math.max(1, Math.floor(normalized.seconds));
    return normalized;
  }

  function normalizeConfigShape(raw) {
    const base = cloneDefaultConfig();
    if (!raw || typeof raw !== 'object') {
      return base;
    }

    if (raw.modes && typeof raw.modes === 'object') {
      const active = raw.activeOperation === 'division' ? 'division' : 'multiplication';
      return {
        activeOperation: active,
        modes: {
          multiplication: normalizeModeSettings(
            raw.modes.multiplication,
            base.modes.multiplication,
          ),
          division: normalizeModeSettings(raw.modes.division, base.modes.division),
        },
      };
    }

    // Compatibilidad con configuraciones antiguas (un solo conjunto de valores)
    const legacyOperation = raw.operation === 'division' ? 'division' : 'multiplication';
    const legacySettings = normalizeModeSettings(raw, base.modes[legacyOperation]);
    const otherOperation = legacyOperation === 'multiplication' ? 'division' : 'multiplication';
    return {
      activeOperation: legacyOperation,
      modes: {
        [legacyOperation]: legacySettings,
        [otherOperation]: base.modes[otherOperation],
      },
    };
  }

  function getModeConfig(operation) {
    if (!config || typeof config !== 'object') {
      config = cloneDefaultConfig();
    }
    if (!config.modes) {
      config.modes = cloneDefaultConfig().modes;
    }
    const op = operation === 'division' ? 'division' : 'multiplication';
    if (!config.modes[op]) {
      config.modes[op] = cloneModeSettings();
    }
    return config.modes[op];
  }

  function getActiveOperation() {
    return config && config.activeOperation === 'division' ? 'division' : 'multiplication';
  }

  function setActiveOperation(operation) {
    const op = operation === 'division' ? 'division' : 'multiplication';
    if (!config) {
      config = cloneDefaultConfig();
    }
    config.activeOperation = op;
    // Asegurar que exista configuración para el modo seleccionado
    getModeConfig(op);
  }

  function getActiveModeConfig() {
    return getModeConfig(getActiveOperation());
  }

  let config = cloneDefaultConfig();

  const defaultStats = {
    totalCorrect: 0,
    totalQuestions: 0,
  };
  let stats = {};

  // Sistema de estrellas por problema para el aprendizaje
  let stars = {};

  // ----- NUEVAS ESTRUCTURAS PARA PRÁCTICA ADAPTATIVA Y REPASO -----
  // Intervalos de repaso espaciado (en milisegundos):
  // 10 minutos, 1 día, 3 días, 7 días. Cuando se llega al máximo
  // intervalo, se reutiliza el último valor.
  const spacedIntervals = [10 * 60 * 1000, 24 * 60 * 60 * 1000, 3 * 24 * 60 * 60 * 1000, 7 * 24 * 60 * 60 * 1000];
  // Almacena los tiempos futuros en los que una combinación estará "lista" para repasar.
  let dueTimes = {};
  // Almacena en qué etapa de repaso se encuentra cada combinación (0 = primera, 1 = segunda, etc.).
  let intervalStages = {};
  // Almacena las combinaciones falladas por fecha (YYYY-MM-DD) para entrenar los "errores del día".
  let errorsToday = {};

  // ----- REGISTRO DE MAESTRÍA POR PROBLEMA -----
  const MASTERY_STORAGE_KEY = 'masteryMap';
  let masteryMap = {};

  const DEFAULT_MASTERY_ENTRY = Object.freeze({
    attempts: 0,
    correct: 0,
    streak: 0,
    bestStreak: 0,
    timedAttempts: 0,
    avgTime: 0,
    lastSeen: 0,
    lastOutcome: 'none',
    skipped: 0,
    modeCounts: {},
    recent: [],
    lastMode: 'learning',
    lastSource: 'unknown',
    errorStreak: 0,
    lastTimeTaken: 0,
  });

  /**
   * Iniciar una sesión con los errores cometidos el día de hoy.
   * Construye una lista de problemas a partir de las claves almacenadas
   * y utiliza el generador de problemas específicos para crear una sesión.
   */
  function startErrorsSession() {
    const today = getTodayDate();
    const keys = errorsToday[today] || [];
    if (keys.length === 0) {
      alert('No hay errores registrados hoy. ¡Felicidades!');
      return;
    }
    const problems = [];
    keys.forEach((key) => {
      const parts = key.split('_');
      if (parts[0] === 'm') {
        const a = parseInt(parts[1], 10);
        const b = parseInt(parts[2], 10);
        problems.push({ type: 'multiplication', a, b, answer: a * b });
      } else if (parts[0] === 'd') {
        const dividend = parseInt(parts[1], 10);
        const divisor = parseInt(parts[2], 10);
        const quotient = dividend / divisor;
        problems.push({ type: 'division', dividend, divisor, answer: quotient });
      }
    });
    const probs = generateSpecificProblems(problems);
    if (probs.length === 0) {
      alert('No hay suficientes errores para entrenar.');
      return;
    }
    startSpecificTrainingSession(probs);
  }

  /**
   * Cargar tabla de estrellas desde localStorage.
   */
  function loadStars() {
    const saved = localStorage.getItem('stars');
    if (saved) {
      try {
        stars = JSON.parse(saved);
      } catch (e) {
        stars = {};
      }
    } else {
      stars = {};
    }
  }

  /**
   * Guardar tabla de estrellas en localStorage.
   */
  function saveStars() {
    localStorage.setItem('stars', JSON.stringify(stars));
  }

  /**
   * Crear una clave única para cada problema en función de su tipo y valores.
   * Para multiplicación se ordenan los factores para tratar 3×4 y 4×3 como el mismo problema.
   * Para división se usa dividendo y divisor.
   * @param {Object} problem
   */
  function createProblemKey(problem) {
    if (problem.type === 'multiplication') {
      const x = Math.min(problem.a, problem.b);
      const y = Math.max(problem.a, problem.b);
      return `m_${x}_${y}`;
    } else {
      return `d_${problem.dividend}_${problem.divisor}`;
    }
  }

  /**
   * Renderizar la fila de estrellas para un problema dado.
   * Se muestra un máximo de 5 estrellas. Las estrellas rellenas (★)
   * corresponden al número de aciertos acumulados en ese problema y las vacías (☆) al restante.
   * @param {HTMLElement} container - Contenedor donde se dibujan las estrellas
   * @param {number} count - Número de estrellas llenas (0 a 5)
   */
  function renderStarRating(container, count) {
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 5; i++) {
      const span = document.createElement('span');
      if (i < count) {
        span.className = 'star';
        span.textContent = '★';
      } else {
        span.className = 'star empty';
        span.textContent = '☆';
      }
      container.appendChild(span);
    }
  }

  /**
   * Obtener la fecha de hoy en formato AAAA-MM-DD.
   * Esto se usa para agrupar los errores por día.
   * @returns {string}
   */
  function getTodayDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * Cargar estructura de tiempos de repaso desde localStorage.
   */
  function loadDueTimes() {
    const saved = localStorage.getItem('dueTimes');
    if (saved) {
      try {
        dueTimes = JSON.parse(saved);
      } catch (e) {
        dueTimes = {};
      }
    } else {
      dueTimes = {};
    }
  }

  /**
   * Guardar los tiempos de repaso en localStorage.
   */
  function saveDueTimes() {
    localStorage.setItem('dueTimes', JSON.stringify(dueTimes));
  }

  /**
   * Cargar las etapas de repaso para cada combinación.
   */
  function loadIntervalStages() {
    const saved = localStorage.getItem('intervalStages');
    if (saved) {
      try {
        intervalStages = JSON.parse(saved);
      } catch (e) {
        intervalStages = {};
      }
    } else {
      intervalStages = {};
    }
  }

  /**
   * Guardar las etapas de repaso en localStorage.
   */
  function saveIntervalStages() {
    localStorage.setItem('intervalStages', JSON.stringify(intervalStages));
  }

  /**
   * Cargar los errores del día desde localStorage y eliminar fechas antiguas.
   */
  function loadErrors() {
    const saved = localStorage.getItem('errorsToday');
    if (saved) {
      try {
        errorsToday = JSON.parse(saved);
      } catch (e) {
        errorsToday = {};
      }
    } else {
      errorsToday = {};
    }
    // Eliminar registros de fechas que no sean hoy
    const today = getTodayDate();
    Object.keys(errorsToday).forEach((date) => {
      if (date !== today) {
        delete errorsToday[date];
      }
    });
  }

  /**
   * Guardar los errores del día en localStorage.
   */
  function saveErrors() {
    localStorage.setItem('errorsToday', JSON.stringify(errorsToday));
  }

  function createEmptyMastery() {
    return {
      attempts: 0,
      correct: 0,
      streak: 0,
      bestStreak: 0,
      timedAttempts: 0,
      avgTime: 0,
      lastSeen: 0,
      lastOutcome: 'none',
      skipped: 0,
      modeCounts: {},
      recent: [],
      lastMode: 'learning',
      lastSource: 'unknown',
      errorStreak: 0,
      lastTimeTaken: 0,
    };
  }

  function loadMastery() {
    const saved = localStorage.getItem(MASTERY_STORAGE_KEY);
    if (!saved) {
      masteryMap = {};
      return;
    }
    try {
      const parsed = JSON.parse(saved);
      if (parsed && typeof parsed === 'object') {
        masteryMap = {};
        Object.keys(parsed).forEach((key) => {
          const entry = Object.assign(createEmptyMastery(), parsed[key] || {});
          if (!entry.modeCounts || typeof entry.modeCounts !== 'object') {
            entry.modeCounts = {};
          }
          if (!Array.isArray(entry.recent)) {
            entry.recent = [];
          }
          masteryMap[key] = entry;
        });
      } else {
        masteryMap = {};
      }
    } catch (err) {
      console.error('No se pudo cargar masteryMap', err);
      masteryMap = {};
    }
  }

  function saveMastery() {
    try {
      localStorage.setItem(MASTERY_STORAGE_KEY, JSON.stringify(masteryMap));
    } catch (err) {
      console.error('No se pudo guardar masteryMap', err);
    }
  }

  function getMasteryEntry(key) {
    if (!masteryMap[key]) {
      masteryMap[key] = createEmptyMastery();
    }
    return masteryMap[key];
  }

  const MAX_MASTERY_HISTORY = 20;

  function recordProblemAttempt(problem, { correct, timeTaken = 0, skipped = false, mode = 'learning', source = 'unknown', timedOut = false } = {}) {
    if (!problem) return;
    const key = createProblemKey(problem);
    const entry = getMasteryEntry(key);
    entry.attempts += 1;
    if (correct) {
      entry.correct += 1;
      entry.streak += 1;
      entry.errorStreak = 0;
    } else {
      entry.streak = 0;
      entry.errorStreak = (entry.errorStreak || 0) + 1;
    }
    entry.bestStreak = Math.max(entry.bestStreak || 0, entry.streak);
    entry.lastSeen = Date.now();
    entry.lastOutcome = skipped ? 'skipped' : correct ? 'correct' : timedOut ? 'timeout' : 'incorrect';
    entry.lastMode = mode;
    entry.lastSource = source;
    if (skipped) {
      entry.skipped = (entry.skipped || 0) + 1;
    }
    const ms = Number.isFinite(timeTaken) && timeTaken >= 0 ? timeTaken : 0;
    entry.lastTimeTaken = ms;
    if (ms > 0) {
      entry.timedAttempts = (entry.timedAttempts || 0) + 1;
      if (!entry.avgTime || entry.timedAttempts === 1) {
        entry.avgTime = ms;
      } else {
        entry.avgTime += (ms - entry.avgTime) / entry.timedAttempts;
      }
    }
    entry.modeCounts = entry.modeCounts || {};
    entry.modeCounts[mode] = (entry.modeCounts[mode] || 0) + 1;
    entry.recent = Array.isArray(entry.recent) ? entry.recent : [];
    entry.recent.push({
      ts: entry.lastSeen,
      correct: !!correct,
      skipped: !!skipped,
      mode,
      time: ms,
      outcome: entry.lastOutcome,
    });
    if (entry.recent.length > MAX_MASTERY_HISTORY) {
      entry.recent.splice(0, entry.recent.length - MAX_MASTERY_HISTORY);
    }
    masteryMap[key] = entry;
    if (mode !== 'learning') {
      applyAdaptiveScheduling(problem, entry, { correct, skipped, mode });
    }
    saveMastery();
    scheduleAssistantPanelRefresh();
  }

  function parseProblemKey(key) {
    if (typeof key !== 'string') return null;
    const parts = key.split('_');
    if (!parts.length) return null;
    if (parts[0] === 'm' && parts.length === 3) {
      const a = parseInt(parts[1], 10);
      const b = parseInt(parts[2], 10);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        return { type: 'multiplication', a, b, answer: a * b };
      }
    }
    if (parts[0] === 'd' && parts.length === 3) {
      const dividend = parseInt(parts[1], 10);
      const divisor = parseInt(parts[2], 10);
      if (Number.isFinite(dividend) && Number.isFinite(divisor) && divisor !== 0) {
        return { type: 'division', dividend, divisor, answer: dividend / divisor };
      }
    }
    return null;
  }

  function getMasteryStats(key) {
    const entry = masteryMap[key];
    if (!entry) {
      return {
        entry: null,
        accuracy: 0,
        attempts: 0,
        avgTime: 0,
        streak: 0,
        errorStreak: 0,
        lastSeen: 0,
      };
    }
    const attempts = entry.attempts || 0;
    const accuracy = attempts > 0 ? entry.correct / attempts : 0;
    return {
      entry,
      accuracy,
      attempts,
      avgTime: entry.avgTime || 0,
      streak: entry.streak || 0,
      errorStreak: entry.errorStreak || 0,
      lastSeen: entry.lastSeen || 0,
    };
  }

  function calculateProblemWeightFromStatsFallback(
    { starCount = 0, due = 0, accuracy = 0, attempts = 0, avgTime = 0, streak = 0, errorStreak = 0, lastSeen = 0 } = {},
    { now = Date.now() } = {}
  ) {
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

  const fallbackGlobalScope =
    typeof globalThis !== 'undefined'
      ? globalThis
      : typeof window !== 'undefined'
      ? window
      : typeof self !== 'undefined'
      ? self
      : null;

  if (fallbackGlobalScope) {
    const existingProblemWeight = fallbackGlobalScope.ProblemWeight;
    if (!existingProblemWeight || typeof existingProblemWeight.calculateProblemWeightFromStats !== 'function') {
      fallbackGlobalScope.ProblemWeight = {
        ...(existingProblemWeight || {}),
        calculateProblemWeightFromStats: calculateProblemWeightFromStatsFallback,
      };
    }
  }

  function calculateProblemWeight(problem, { now = Date.now() } = {}) {
    const key = createProblemKey(problem);
    const starCount = stars[key] || 0;
    const due = dueTimes[key] || 0;
    const { accuracy, attempts, avgTime, streak, errorStreak, lastSeen } = getMasteryStats(key);
    const calculator =
      typeof ProblemWeight !== 'undefined' &&
      ProblemWeight &&
      typeof ProblemWeight.calculateProblemWeightFromStats === 'function'
        ? ProblemWeight.calculateProblemWeightFromStats
        : calculateProblemWeightFromStatsFallback;

    return calculator(
      { starCount, due, accuracy, attempts, avgTime, streak, errorStreak, lastSeen },
      { now }
    );
  }

  function applyAdaptiveScheduling(problem, entry, { correct, skipped, mode }) {
    if (!problem) return;
    const key = createProblemKey(problem);
    const now = Date.now();
    const treatedCorrect = !!correct && !skipped;
    if (treatedCorrect) {
      let stage = intervalStages[key] || 0;
      const accuracy = entry.attempts > 0 ? entry.correct / entry.attempts : 0;
      if (entry.streak >= 4 || accuracy > 0.9) {
        stage = Math.min(stage + 1, spacedIntervals.length - 1);
      }
      const interval = spacedIntervals[Math.max(0, stage)] || spacedIntervals[spacedIntervals.length - 1] || 24 * 60 * 60 * 1000;
      intervalStages[key] = stage;
      dueTimes[key] = now + interval;
    } else {
      intervalStages[key] = 0;
      const baseInterval = spacedIntervals[0] || 10 * 60 * 1000;
      const penalty = Math.max(60 * 1000, Math.floor(baseInterval / 2));
      dueTimes[key] = now + penalty;
      if (mode !== 'learning') {
        const today = getTodayDate();
        if (!errorsToday[today]) {
          errorsToday[today] = [];
        }
        if (!errorsToday[today].includes(key)) {
          errorsToday[today].push(key);
        }
        saveErrors();
      }
    }
    saveDueTimes();
    saveIntervalStages();
  }

  /**
   * Actualizar las estrellas para un problema dado.
   * Incrementa en 1 cuando es correcto (máximo 5) o decrementa en 1 cuando es incorrecto (mínimo 0).
   * Solo se usa en modo Aprendizaje.
   * @param {Object} problem
   * @param {boolean} isCorrect
   */
  function updateStarsForProblem(problem, isCorrect) {
    const key = createProblemKey(problem);
    const prevCount = stars[key] || 0;
    let newCount;
    if (isCorrect) {
      newCount = Math.min(5, prevCount + 1);
    } else {
      newCount = Math.max(0, prevCount - 1);
    }
    stars[key] = newCount;
    // Gestionar repaso espaciado y errores
    if (isCorrect) {
      // Si se alcanza 5 estrellas por primera vez o si la estrella final se mantiene, programar repaso
      if (newCount === 5 && prevCount < 5) {
        // Obtener la etapa actual y el intervalo correspondiente
        const stage = intervalStages[key] || 0;
        const interval = spacedIntervals[Math.min(stage, spacedIntervals.length - 1)] || 0;
        const now = Date.now();
        dueTimes[key] = now + interval;
        // Incrementar la etapa para la próxima vez, si no hemos llegado al máximo
        if (stage < spacedIntervals.length - 1) {
          intervalStages[key] = stage + 1;
        }
      }
    } else {
      // Al fallar, reiniciar la etapa y programar para repasar inmediatamente (dueTime 0)
      intervalStages[key] = 0;
      dueTimes[key] = 0;
      // Registrar este error en la lista de errores del día
      const today = getTodayDate();
      if (!errorsToday[today]) {
        errorsToday[today] = [];
      }
      if (!errorsToday[today].includes(key)) {
        errorsToday[today].push(key);
      }
      saveErrors();
    }
    saveStars();
    saveDueTimes();
    saveIntervalStages();
  }

  /**
   * Calcular el progreso global basado en las estrellas obtenidas.
   * Se considera el número total de combinaciones en el intervalo y se asignan 5 estrellas máximas por combinación.
   * El progreso sólo se basa en el modo de operación actual.
   */
  function calculateProgress() {
    const { min, max } = getActiveModeConfig();
    const operation = getActiveOperation();
    const totalCombos = (max - min + 1) * (max - min + 1);
    const totalPossibleStars = totalCombos * 5;
    let earnedStars = 0;
    for (let a = min; a <= max; a++) {
      for (let b = min; b <= max; b++) {
        if (operation === 'multiplication') {
          const key = createProblemKey({ type: 'multiplication', a, b });
          earnedStars += stars[key] || 0;
        } else {
          const dividend = a * b;
          const divisor = a;
          const key = createProblemKey({ type: 'division', dividend, divisor });
          earnedStars += stars[key] || 0;
        }
      }
    }
    const percent = totalPossibleStars > 0 ? (earnedStars / totalPossibleStars) * 100 : 0;
    return Math.min(100, percent);
  }

  // Variables de estado para aprendizaje
  let learnProblems = [];
  let learnIndex = 0;
  let learnCorrectCount = 0;
  let learnTypedAnswer = '';

  // Marca el momento en que comenzó el problema actual en aprendizaje (para métricas)
  let learnQuestionStartTime = 0;

  // ----- MÉTRICAS DIARIAS Y MAPA DE CALOR -----
  // Definir objetivo mínimo de ejercicios por día
  const DAILY_GOAL = 15;
  // Estructura para estadísticas diarias
  let dailyStats = {
    date: '',
    totalQuestions: 0,
    totalCorrect: 0,
    totalTime: 0,
    streakCurrent: 0,
    streakMax: 0,
  };

  /**
   * Cargar estadísticas diarias desde localStorage.
   * Si la fecha almacenada es distinta de hoy, reiniciamos las métricas.
   */
  function loadDailyStats() {
    const saved = localStorage.getItem('dailyStats');
    const today = getTodayDate();
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.date === today) {
          dailyStats = Object.assign({}, dailyStats, parsed);
        } else {
          // Nueva fecha, reiniciar métricas
          dailyStats = {
            date: today,
            totalQuestions: 0,
            totalCorrect: 0,
            totalTime: 0,
            streakCurrent: 0,
            streakMax: 0,
          };
        }
      } catch (e) {
        dailyStats = {
          date: today,
          totalQuestions: 0,
          totalCorrect: 0,
          totalTime: 0,
          streakCurrent: 0,
          streakMax: 0,
        };
      }
    } else {
      dailyStats = {
        date: today,
        totalQuestions: 0,
        totalCorrect: 0,
        totalTime: 0,
        streakCurrent: 0,
        streakMax: 0,
      };
    }
  }

  /**
   * Guardar las estadísticas diarias en localStorage.
   */
  function saveDailyStats() {
    localStorage.setItem('dailyStats', JSON.stringify(dailyStats));
  }

  /**
   * Actualizar estadísticas diarias con un nuevo resultado.
   * @param {boolean} isCorrect - Indica si la respuesta fue correcta.
   * @param {number} timeTaken - Tiempo (ms) utilizado para responder.
   */
  function updateDailyStats(isCorrect, timeTaken) {
    dailyStats.totalQuestions++;
    if (isCorrect) {
      dailyStats.totalCorrect++;
      dailyStats.streakCurrent++;
      if (dailyStats.streakCurrent > dailyStats.streakMax) {
        dailyStats.streakMax = dailyStats.streakCurrent;
      }
    } else {
      dailyStats.streakCurrent = 0;
    }
    dailyStats.totalTime += timeTaken;
    saveDailyStats();
  }

  /**
   * Formatear milisegundos a cadena legible (s).
   * @param {number} ms
   */
  function formatDuration(ms) {
    const seconds = Math.round(ms / 1000);
    return `${seconds}s`;
  }

  function formatRelativeDelay(ms) {
    const abs = Math.abs(ms);
    const sign = ms >= 0 ? 'hace' : 'en';
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    if (abs >= day) {
      return `${sign} ${Math.round(abs / day)}d`;
    }
    if (abs >= hour) {
      return `${sign} ${Math.round(abs / hour)}h`;
    }
    if (abs >= minute) {
      return `${sign} ${Math.max(1, Math.round(abs / minute))}m`;
    }
    return `${sign} ${Math.max(1, Math.round(abs / 1000))}s`;
  }

  /**
   * Construir el mapa de calor para el progreso.
   * Muestra una cuadrícula de (max-min+1)×(max-min+1) donde cada celda
   * se colorea según las estrellas acumuladas (blanco, naranja, verde).
   */
  function buildHeatmap() {
    if (!heatmapContainer) return;
    heatmapContainer.innerHTML = '';
    const { min, max } = getActiveModeConfig();
    const operation = getActiveOperation();
    const size = max - min + 1;
    const grid = document.createElement('div');
    grid.className = 'heatmap-grid';
    // Definir ancho y alto constantes para todas las celdas, incluidas las cabeceras.
    grid.style.gridTemplateColumns = `repeat(${size + 1}, var(--heatmap-cell-size))`;
    grid.style.gridAutoRows = 'var(--heatmap-cell-size)';
    // Primera celda vacía en la esquina superior izquierda
    const corner = document.createElement('div');
    corner.className = 'heatmap-header corner-header';
    corner.textContent = '';
    grid.appendChild(corner);
    // Encabezados de columnas (fila superior)
    for (let b = min; b <= max; b++) {
      const header = document.createElement('div');
      header.className = 'heatmap-header column-header';
      header.textContent = b;
      header.dataset.col = b;
      header.addEventListener('click', () => {
        // Iniciar entrenamiento de columna específica
        startSpecificColumnTraining(b);
      });
      grid.appendChild(header);
    }
    // Crear filas con encabezado de fila y celdas
    for (let a = min; a <= max; a++) {
      // Encabezado de fila (columna izquierda)
      const rowHeader = document.createElement('div');
      rowHeader.className = 'heatmap-header row-header';
      rowHeader.textContent = a;
      rowHeader.dataset.row = a;
      rowHeader.addEventListener('click', () => {
        startSpecificRowTraining(a);
      });
      grid.appendChild(rowHeader);
      for (let b = min; b <= max; b++) {
        const key = createProblemKey(
          operation === 'multiplication'
            ? { type: 'multiplication', a, b }
            : { type: 'division', dividend: a * b, divisor: a }
        );
        const count = stars[key] || 0;
        const cell = document.createElement('div');
        cell.className = 'heatmap-cell';
        // Asignar color según estrellas: 0–1 blanco, 2–3 naranja, 4–5 verde
        if (count <= 1) {
          cell.classList.add('heatmap-grey');
        } else if (count <= 3) {
          cell.classList.add('heatmap-orange');
        } else {
          cell.classList.add('heatmap-green');
        }
        cell.dataset.a = a;
        cell.dataset.b = b;
        // Al hacer clic sobre una celda, mostrar la operación y su resultado en la tarjeta de resultado
        cell.addEventListener('click', () => {
          let resultText;
          if (operation === 'multiplication') {
            resultText = `${a} × ${b} = ${a * b}`;
          } else {
            const dividend = a * b;
            resultText = `${dividend} ÷ ${a} = ${b}`;
          }
          if (resultCard) {
            resultCard.textContent = resultText;
          }
        });
        grid.appendChild(cell);
      }
    }
    // Limpiar cualquier retroalimentación anterior
    if (resultCard) {
      resultCard.textContent = '';
    }
    heatmapContainer.appendChild(grid);
  }

  /**
   * Calcular recomendaciones para el panel de asistente.
   * Devuelve un array de objetos con título, razón y callback de acción.
   * Las recomendaciones se basan en combinaciones con pocas estrellas o errores recientes.
   */
  function problemLabel(problem) {
    if (!problem) return '';
    if (problem.type === 'multiplication') {
      return `${problem.a}×${problem.b}`;
    }
    return `${problem.dividend}÷${problem.divisor}`;
  }

  function buildProblemAction(problem) {
    if (!problem) {
      return () => {};
    }
    if (problem.type === 'multiplication') {
      return () => startSpecificProblemTraining(problem.a, problem.b);
    }
    return () => startSpecificProblemTraining(problem.divisor, problem.answer);
  }

  function formatAccuracyDetail(accuracy, attempts) {
    if (!Number.isFinite(accuracy) || attempts === 0) {
      return 'sin datos previos';
    }
    const percent = Math.round(accuracy * 100);
    return `precisión ${percent}% en ${attempts} intentos`;
  }

  function computeRecommendations() {
    const { min, max } = getActiveModeConfig();
    const operation = getActiveOperation();
    const now = Date.now();
    const today = getTodayDate();

    const dueCandidates = [];
    const struggling = [];
    const slow = [];
    const rowStats = new Map();

    for (let a = min; a <= max; a++) {
      for (let b = min; b <= max; b++) {
        const problem =
          operation === 'multiplication'
            ? { type: 'multiplication', a, b, answer: a * b }
            : { type: 'division', dividend: a * b, divisor: a, answer: b };
        const key = createProblemKey(problem);
        const { accuracy, attempts, avgTime } = getMasteryStats(key);
        const entry = masteryMap[key];
        const due = dueTimes[key] || 0;
        const star = stars[key] || 0;
        const timedAttempts = entry ? entry.timedAttempts || 0 : 0;

        if (due > 0 && (due <= now || due - now <= 45 * 60 * 1000)) {
          dueCandidates.push({
            key,
            problem,
            due,
            accuracy,
            attempts,
          });
        }

        if (attempts >= 3 && accuracy < 0.75) {
          struggling.push({ key, problem, accuracy, attempts });
        }

        if (timedAttempts >= 3 && avgTime > 6500) {
          slow.push({ key, problem, avgTime, timedAttempts });
        }

        const rowKey = `row_${a}`;
        let rowData = rowStats.get(rowKey);
        if (!rowData) {
          rowData = { a, low: 0, total: 0 };
          rowStats.set(rowKey, rowData);
        }
        rowData.total += 1;
        if (star <= 3) {
          rowData.low += 1;
        }
      }
    }

    const unique = [];
    const seen = new Set();
    const pushRec = (rec) => {
      if (!rec || !rec.id || seen.has(rec.id)) return;
      seen.add(rec.id);
      unique.push(rec);
    };

    const errorsList = Array.isArray(errorsToday[today]) ? errorsToday[today] : [];
    errorsList.forEach((key) => {
      const problem = parseProblemKey(key);
      if (!problem) return;
      const { accuracy, attempts } = getMasteryStats(key);
      pushRec({
        id: `err_${key}`,
        title: `Refuerza ${problemLabel(problem)}`,
        reason: `Fallaste esta combinación hoy (${formatAccuracyDetail(accuracy, attempts)})`,
        action: buildProblemAction(problem),
      });
    });

    dueCandidates
      .sort((a, b) => a.due - b.due)
      .slice(0, 3)
      .forEach((item) => {
        const diff = now - item.due;
        const overdue = diff >= 0;
        pushRec({
          id: `due_${item.key}`,
          title: `Repasa ${problemLabel(item.problem)}`,
          reason: `${overdue ? 'Revisión vencida' : 'Revisión próxima'} ${formatRelativeDelay(overdue ? diff : -diff)} (${formatAccuracyDetail(item.accuracy, item.attempts)})`,
          action: buildProblemAction(item.problem),
        });
      });

    struggling
      .sort((a, b) => a.accuracy - b.accuracy || b.attempts - a.attempts)
      .slice(0, 2)
      .forEach((item) => {
        pushRec({
          id: `weak_${item.key}`,
          title: `Refuerza ${problemLabel(item.problem)}`,
          reason: `Solo ${formatAccuracyDetail(item.accuracy, item.attempts)}`,
          action: buildProblemAction(item.problem),
        });
      });

    slow
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 1)
      .forEach((item) => {
        pushRec({
          id: `slow_${item.key}`,
          title: `Acelera ${problemLabel(item.problem)}`,
          reason: `Tiempo medio ${formatDuration(item.avgTime)} en ${item.timedAttempts} intentos cronometrados`,
          action: buildProblemAction(item.problem),
        });
      });

    const rowCandidates = Array.from(rowStats.values()).filter((row) => row.low > 0);
    rowCandidates.sort((a, b) => b.low - a.low);
    if (rowCandidates.length > 0) {
      const row = rowCandidates[0];
      pushRec({
        id: `row_${row.a}`,
        title: operation === 'multiplication' ? `Entrena tabla del ${row.a}` : `Entrena divisiones del ${row.a}`,
        reason: `${row.low} combinaciones con menos de 4 estrellas`,
        action: () => startSpecificRowTraining(row.a),
      });
    }

    return unique.slice(0, 3);
  }

  /**
   * Renderizar el panel de asistente en la pantalla de inicio.
   */
  function renderAssistantPanel() {
    if (!assistantPanel) return;
    assistantPanel.innerHTML = '';
    const recs = computeRecommendations();
    if (recs.length === 0) {
      // No hay recomendaciones; no mostrar panel
      assistantPanel.style.display = 'none';
      return;
    }
    assistantPanel.style.display = 'flex';
    recs.forEach((rec) => {
      const card = document.createElement('div');
      card.className = 'assistant-card';
      const title = document.createElement('h4');
      title.textContent = rec.title;
      const reason = document.createElement('p');
      reason.textContent = rec.reason;
      const btn = document.createElement('button');
      btn.textContent = 'Practicar';
      btn.addEventListener('click', () => {
        // Al pulsar, iniciar el entrenamiento específico
        rec.action();
        // Ocultar la tarjeta correspondiente
        card.remove();
        // Si no quedan recomendaciones, ocultar todo el panel
        if (!assistantPanel.querySelector('.assistant-card')) {
          assistantPanel.style.display = 'none';
        }
      });
      card.appendChild(title);
      card.appendChild(reason);
      card.appendChild(btn);
      assistantPanel.appendChild(card);
    });
  }

  /**
   * Renderizar métricas diarias dentro de la tarjeta.
   */
  function renderDailyMetrics() {
    if (!metricsCard) return;
    const acc = dailyStats.totalQuestions > 0 ? Math.round((dailyStats.totalCorrect / dailyStats.totalQuestions) * 100) : 0;
    const avgTime = dailyStats.totalQuestions > 0 ? dailyStats.totalTime / dailyStats.totalQuestions : 0;
    metricsCard.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = 'Métricas del día';
    metricsCard.appendChild(title);
    const list = document.createElement('div');
    list.style.fontSize = '16px';
    list.style.lineHeight = '1.4';
    list.innerHTML =
      `<p>% de acierto del día: ${acc}%</p>` +
      `<p>Tiempo medio por respuesta: ${avgTime > 0 ? formatDuration(avgTime) : '—'}</p>` +
      `<p>Racha más larga del día: ${dailyStats.streakMax}</p>`;
    metricsCard.appendChild(list);
  }

  /**
   * Renderizar la meta diaria (círculos) dentro de la tarjeta.
   */
  function renderDailyGoal() {
    if (!goalCard) return;
    goalCard.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = 'Meta diaria';
    goalCard.appendChild(title);
    const container = document.createElement('div');
    container.className = 'goal-circles';
    // Número de ejercicios completados se basa en totalQuestions
    const done = Math.min(dailyStats.totalQuestions, DAILY_GOAL);
    for (let i = 0; i < DAILY_GOAL; i++) {
      const circle = document.createElement('div');
      circle.className = 'goal-circle';
      if (i < done) {
        circle.classList.add('completed');
      }
      container.appendChild(circle);
    }
    goalCard.appendChild(container);
  }

  /**
   * Mostrar la pantalla de progreso, construyendo el mapa de calor y métricas.
   */
  function showProgressScreen() {
    // Asegurarnos de que la configuración esté cargada antes de generar el mapa de calor
    try {
      loadConfig();
    } catch (e) {
      // Si hay un error al cargar la configuración, usar el valor actual de config
    }
    // Construimos las métricas y el mapa de calor dentro de un bloque try/catch
    try {
      loadDailyStats();
      buildHeatmap();
      // Se eliminan métricas diarias y meta diaria para que la tabla ocupe todo el espacio.
    } catch (e) {
      // En caso de error (por ejemplo, combinación inválida), imprimimos en la consola
      console.error('Error al construir la pantalla de progreso', e);
    }
    // Siempre mostramos la pantalla de progreso aunque haya fallos de construcción
    showScreen('progress');
  }

  /**
   * Iniciar entrenamiento de una columna específica (misma b), recorriendo a desde min hasta max.
   * @param {number} b
   */
  function startSpecificColumnTraining(b) {
    const problems = [];
    const { min, max } = getActiveModeConfig();
    const operation = getActiveOperation();
    for (let a = min; a <= max; a++) {
      if (operation === 'multiplication') {
        problems.push({ type: 'multiplication', a, b, answer: a * b });
      } else {
        const dividend = a * b;
        problems.push({ type: 'division', dividend, divisor: a, answer: b });
      }
    }
    const list = generateSpecificProblems(problems);
    startSpecificTrainingSession(list);
  }

  /**
   * Iniciar entrenamiento de una fila específica (misma a), recorriendo b desde min hasta max.
   * @param {number} a
   */
  function startSpecificRowTraining(a) {
    const problems = [];
    const { min, max } = getActiveModeConfig();
    const operation = getActiveOperation();
    for (let b = min; b <= max; b++) {
      if (operation === 'multiplication') {
        problems.push({ type: 'multiplication', a, b, answer: a * b });
      } else {
        const dividend = a * b;
        problems.push({ type: 'division', dividend, divisor: a, answer: b });
      }
    }
    const list = generateSpecificProblems(problems);
    startSpecificTrainingSession(list);
  }

  /**
   * Iniciar entrenamiento de un problema específico (a, b).
   * @param {number} a
   * @param {number} b
   */
  function startSpecificProblemTraining(a, b) {
    let problem;
    if (getActiveOperation() === 'multiplication') {
      problem = { type: 'multiplication', a, b, answer: a * b };
    } else {
      const dividend = a * b;
      problem = { type: 'division', dividend, divisor: a, answer: b };
    }
    // Crear una sesión con un único problema repetido para practicarlo hasta dominar
    const list = generateSpecificProblems([problem]);
    startSpecificTrainingSession(list);
  }

  /**
   * Animar la tarjeta del problema actual dando un giro de 180°.
   * Se aplica a la tarjeta de la pantalla activa.
   */
  function animateProblemCard() {
    // Selecciona la tarjeta visible en cualquier pantalla
    const card = document.querySelector('.screen.active .problem-card');
    if (!card) return;
    card.classList.add('flip');
    // Eliminar la clase después de la animación para poder reutilizarla
    setTimeout(() => {
      card.classList.remove('flip');
    }, 600);
  }

  // Variables de estado para entrenamiento
  let trainProblems = [];
  let trainIndex = 0;
  let trainCorrectCount = 0;
  let trainTimer = null;
  let trainTimeRemaining = 0;
  let trainTotalSeconds = 0;
  let trainTypedAnswer = '';
  let trainQuestionStartTime = 0;

  function showTrainSkipButton() {
    if (!trainSkipBtn) return;
    trainSkipBtn.classList.remove('hidden');
    trainSkipBtn.disabled = false;
  }

  function disableTrainSkipButton() {
    if (!trainSkipBtn) return;
    trainSkipBtn.disabled = true;
  }

  function hideTrainSkipButton() {
    if (!trainSkipBtn) return;
    trainSkipBtn.classList.add('hidden');
    trainSkipBtn.disabled = true;
  }

  function applyTrainingSkipPolicy() {
    if (!trainSkipBtn) return;
    if (trainingSessionContext === TRAINING_CONTEXT.SPECIFIC && trainingHasMistake) {
      showTrainSkipButton();
    } else {
      hideTrainSkipButton();
    }
  }

  function configureTrainingSession(context) {
    trainingSessionContext = context;
    trainingHasMistake = false;
    applyTrainingSkipPolicy();
  }

  function scheduleNextTrainingQuestion(delay = 800) {
    const advance = () => {
      if (trainIndex < trainProblems.length - 1) {
        trainIndex++;
        renderTrainingProblem();
      } else {
        handleTrainFinish();
      }
    };
    setTimeout(advance, delay);
  }

  /**
   * Actualizar la interfaz de entrenamiento específico.
   * Muestra u oculta las casillas de selección y el botón de inicio según el estado del interruptor.
   */
  function updateSpecificUI() {
    if (!specificToggle || !tablesContainer || !startSpecificBtn) return;
    const enabled = specificToggle.checked;
    startSpecificBtn.classList.toggle('hidden', !enabled);
    tablesContainer.classList.toggle('specific-mode', enabled);

    if (!tablesContainer.childElementCount) {
      return;
    }

    const masters = tablesContainer.querySelectorAll('.master-checkbox');
    masters.forEach((master) => {
      master.disabled = !enabled;
      const card = master.closest('.table-card');
      if (!enabled && master.checked) {
        master.checked = false;
      }
      if (!enabled && card && card.dataset.rendered === 'true') {
        enqueueRowReset(card);
      }
    });
  }

  /**
   * Cargar configuración desde localStorage o usar por defecto.
   */
  function loadConfig() {
    const saved = localStorage.getItem('config');
    if (saved) {
      try {
        config = normalizeConfigShape(JSON.parse(saved));
      } catch (e) {
        config = cloneDefaultConfig();
      }
    } else {
      config = cloneDefaultConfig();
    }
    // Actualizar UI
    const activeOperation = getActiveOperation();
    syncOperationRadios(activeOperation);
    fillConfigInputs(activeOperation);

    // Actualizar botones de operación en inicio
    updateHomeOperationToggle();
  }

  function syncOperationRadios(operation) {
    operationRadios.forEach((radio) => {
      radio.checked = radio.value === operation;
    });
  }

  function fillConfigInputs(operation) {
    const modeConfig = getModeConfig(operation);
    configMinInput.value = modeConfig.min;
    configMaxInput.value = modeConfig.max;
    configMultipleChoice.checked = modeConfig.multipleChoice;
    configNumQuestionsSelect.value = modeConfig.numQuestions;
    configSecondsInput.value = modeConfig.seconds;
  }

  /**
   * Guardar configuración leída del formulario y volver a inicio.
   */
  function saveConfig() {
    // Leer valores
    let selectedOperation = 'multiplication';
    operationRadios.forEach((radio) => {
      if (radio.checked) selectedOperation = radio.value;
    });
    const minVal = parseInt(configMinInput.value, 10);
    const maxVal = parseInt(configMaxInput.value, 10);
    const mcVal = configMultipleChoice.checked;
    const numQVal = parseInt(configNumQuestionsSelect.value, 10);
    const secondsVal = parseInt(configSecondsInput.value, 10);

    if (isNaN(minVal) || isNaN(maxVal) || minVal <= 0 || maxVal < minVal) {
      alert('Ingresa un intervalo de cifras válido.');
      return;
    }
    if (isNaN(secondsVal) || secondsVal <= 0) {
      alert('Ingresa un valor de segundos válido.');
      return;
    }

    setActiveOperation(selectedOperation);
    const modeConfig = getModeConfig(selectedOperation);
    modeConfig.min = minVal;
    modeConfig.max = maxVal;
    modeConfig.multipleChoice = mcVal;
    modeConfig.numQuestions = numQVal;
    modeConfig.seconds = secondsVal;
    config.activeOperation = selectedOperation;
    localStorage.setItem('config', JSON.stringify(config));
    fillConfigInputs(selectedOperation);
    // Actualizar botones de operación en inicio
    updateHomeOperationToggle();
    showScreen('home');
  }

  /**
   * Actualizar el estado visual de los botones de operación en la pantalla de inicio
   */
  function updateHomeOperationToggle() {
    if (getActiveOperation() === 'multiplication') {
      homeOpMulBtn.classList.add('active');
      homeOpDivBtn.classList.remove('active');
    } else {
      homeOpMulBtn.classList.remove('active');
      homeOpDivBtn.classList.add('active');
    }
  }

  /**
   * Cargar estadísticas globales almacenadas.
   */
  function loadStats() {
    const saved = localStorage.getItem('stats');
    if (saved) {
      try {
        stats = Object.assign({}, defaultStats, JSON.parse(saved));
      } catch (e) {
        stats = Object.assign({}, defaultStats);
      }
    } else {
      stats = Object.assign({}, defaultStats);
    }
  }

  /**
   * Guardar estadísticas en localStorage.
   */
  function saveStats() {
    localStorage.setItem('stats', JSON.stringify(stats));
  }

  /**
   * Actualizar la barra de progreso global.
   */
  function updateProgressBar() {
    // El progreso se basa únicamente en el sistema de estrellas del modo aprendizaje.
    const percent = calculateProgress();
    progressFill.style.width = `${percent}%`;
    // Mostrar el porcentaje sin decimales y sin decimales extra (ejemplo 2%, 10%, 88%).
    const rounded = Math.round(percent);
    progressText.textContent = `${rounded}%`;
  }

  /**
   * Mostrar una pantalla específica y ocultar las demás.
   * @param {string} screenName - Clave de la pantalla a mostrar.
   */
  function showScreen(screenName) {
    Object.keys(screens).forEach((name) => {
      screens[name].classList.remove('active');
    });
    const scr = screens[screenName];
    if (scr) {
      scr.classList.add('active');
    }
    if (screenName === 'home') {
      updateProgressBar();
      // Construir panel de asistente cuando se muestra la pantalla de inicio
      try {
        renderAssistantPanel();
      } catch (e) {
        console.error('Error al renderizar asistente', e);
      }
    }
  }

  /**
   * Obtener un número entero aleatorio en [min, max].
   * @param {number} min - Valor mínimo.
   * @param {number} max - Valor máximo.
   */
  function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Generar lista de problemas según la configuración actual.
   * @returns {Array}
   */
  function generateProblems() {
    /*
     * Genera una lista de problemas con aleatoriedad mejorada y evita que un mismo
     * problema se repita de forma inmediata. En lugar de seleccionar índices al azar
     * directamente de la piscina, se baraja la lista completa de combinaciones
     * posibles y se recorre secuencialmente. Cuando se agota la piscina se vuelve
     * a barajar; si el primer problema de la nueva piscina coincide con el
     * último problema añadido a la lista se realiza un nuevo barajado (hasta un
     * máximo de 10 intentos) o se acepta si no existe alternativa. Esto produce
     * una distribución más uniforme y evita repeticiones consecutivas.
     */
    // Construir lista de problemas ponderada en función del número de estrellas y los tiempos de repaso.
    const activeSettings = getActiveModeConfig();
    const operation = getActiveOperation();
    const { min, max, numQuestions } = activeSettings;
    const base = [];
    if (operation === 'multiplication') {
      for (let a = min; a <= max; a++) {
        for (let b = min; b <= max; b++) {
          base.push({ type: 'multiplication', a, b, answer: a * b });
        }
      }
    } else {
      for (let divisor = min; divisor <= max; divisor++) {
        for (let quotient = min; quotient <= max; quotient++) {
          const dividend = divisor * quotient;
          base.push({ type: 'division', dividend, divisor, answer: quotient });
        }
      }
    }
    // Crear piscina ponderada utilizando maestría, estrellas y repaso espaciado.
    let weighted = [];
    const now = Date.now();
    for (const prob of base) {
      const weight = calculateProblemWeight(prob, { now });
      for (let w = 0; w < weight; w++) {
        weighted.push(prob);
      }
    }
    // Si la piscina está vacía (datos insuficientes), usar la base una vez
    if (weighted.length === 0) {
      weighted = [...base];
    }
    // Barajar la piscina ponderada
    let pool = shuffleArray([...weighted]);
    let poolIndex = 0;
    const list = [];
    let last = null;
    for (let i = 0; i < numQuestions; i++) {
      // Si agotamos la piscina, barajar de nuevo y evitar iniciar con el mismo problema que el último
      if (poolIndex >= pool.length) {
        let attempts = 0;
        let newPool;
        do {
          newPool = shuffleArray([...weighted]);
          attempts++;
        } while (attempts < 10 && weighted.length > 1 && isSameProblem(newPool[0], last));
        pool = newPool;
        poolIndex = 0;
      }
      let problem = pool[poolIndex];
      // Evitar que se repita el mismo problema o la misma tabla consecutivamente
      if (
        weighted.length > 1 &&
        last !== null &&
        (isSameProblem(problem, last) || hasSameFactor(problem, last))
      ) {
        for (let j = 1; j < pool.length; j++) {
          const candidate = pool[(poolIndex + j) % pool.length];
          if (!isSameProblem(candidate, last) && !hasSameFactor(candidate, last)) {
            // Intercambiar el problema para usar el candidato
            pool[(poolIndex + j) % pool.length] = problem;
            problem = candidate;
            break;
          }
        }
      }
      list.push(Object.assign({}, problem));
      last = problem;
      poolIndex++;
    }
    return list;
  }

  /**
   * Comprobar si dos problemas son idénticos (para evitar repeticiones consecutivas).
   * @param {Object} a - Primer problema
   * @param {Object} b - Segundo problema
   * @returns {boolean} - true si son el mismo problema
   */
  function isSameProblem(a, b) {
    if (!a || !b) return false;
    if (a.type !== b.type) return false;
    if (a.type === 'multiplication') {
      return a.a === b.a && a.b === b.b;
    } else {
      return a.dividend === b.dividend && a.divisor === b.divisor;
    }
  }

  /**
   * Comprobar si dos problemas comparten el mismo "primer factor" (tabla) para evitar
   * que se repita la misma tabla consecutivamente. Para multiplicación se utiliza
   * el primer operando (a), y para división se utiliza el divisor.
   * @param {Object} a
   * @param {Object} b
   * @returns {boolean}
   */
  function hasSameFactor(a, b) {
    if (!a || !b) return false;
    if (a.type !== b.type) return false;
    if (a.type === 'multiplication') {
      return a.a === b.a;
    } else {
      return a.divisor === b.divisor;
    }
  }

  /**
   * Generar problemas para un entrenamiento específico evitando repeticiones consecutivas.
   * Se utiliza una piscina de problemas seleccionados que se baraja y se repone cuando se vacía.
   * @param {Array} selected - Lista de problemas base seleccionados por el usuario.
   * @returns {Array} lista de problemas generados
   */
  function generateSpecificProblems(selected) {
    /*
     * Construye una lista de problemas para entrenamientos específicos a partir
     * de una lista de problemas seleccionados. Se baraja la lista inicial y se
     * recorre secuencialmente para crear la lista final. Cuando se llega al
     * final se vuelve a barajar; se evitan repeticiones consecutivas aplicando
     * la misma lógica que en generateProblems.
     */
    const list = [];
    if (!selected || selected.length === 0) return list;
    // Construir una piscina ponderada tomando en cuenta maestría y repaso.
    let weightedSel = [];
    const now = Date.now();
    for (const prob of selected) {
      const weight = calculateProblemWeight(prob, { now });
      for (let w = 0; w < weight; w++) {
        weightedSel.push(prob);
      }
    }
    if (weightedSel.length === 0) {
      weightedSel = [...selected];
    }
    let pool = shuffleArray([...weightedSel]);
    let poolIndex = 0;
    let last = null;
    const { numQuestions } = getActiveModeConfig();
    for (let i = 0; i < numQuestions; i++) {
      if (poolIndex >= pool.length) {
        let attempts = 0;
        let newPool;
        do {
          newPool = shuffleArray([...weightedSel]);
          attempts++;
        } while (
          attempts < 10 && weightedSel.length > 1 && isSameProblem(newPool[0], last)
        );
        pool = newPool;
        poolIndex = 0;
      }
      let problem = pool[poolIndex];
      if (
        weightedSel.length > 1 &&
        last !== null &&
        (isSameProblem(problem, last) || hasSameFactor(problem, last))
      ) {
        for (let j = 1; j < pool.length; j++) {
          const candidate = pool[(poolIndex + j) % pool.length];
          if (!isSameProblem(candidate, last) && !hasSameFactor(candidate, last)) {
            pool[(poolIndex + j) % pool.length] = problem;
            problem = candidate;
            break;
          }
        }
      }
      list.push(Object.assign({}, problem));
      last = problem;
      poolIndex++;
    }
    return list;
  }

  /**
   * Barajar un array utilizando Fisher-Yates.
   * @param {Array} array - Array a barajar.
   * @returns {Array}
   */
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  /**
   * Determine the length of the suffix that should be matched for a multiplication
   * problem based on whether either factor is a multiple of 5 or 25. Multiples
   * of 25 produce a two‑digit pattern (00, 25, 50, 75); multiples of 5 (but not
   * 25) produce a one‑digit pattern (0 or 5); otherwise no pattern.
   *
   * @param {number} a - First operand
   * @param {number} b - Second operand
   * @returns {number} 2, 1 or 0 indicating digits to match
   */
  function suffixRuleLen(a, b) {
    // If either operand is a multiple of 25, restrict to two digits
    if (a % 25 === 0 || b % 25 === 0) return 2;
    // If either operand is a multiple of 5 (but not 25), restrict to one digit
    if (a % 5 === 0 || b % 5 === 0) return 1;
    return 0;
  }

  /**
   * Given a problem and its correct answer, compute the required suffix string
   * that distractor options must share. If a suffix length of 2 is required
   * (for multiples of 25), the last two digits of the correct answer (padded
   * with zeros) are returned. If a suffix length of 1 is required, the last
   * digit of the correct answer is returned. Otherwise null.
   *
   * @param {Object} problem - The problem object containing operands
   * @param {number} correct - The correct answer
   * @returns {string|null}
   */
  function requiredSuffix(problem, correct) {
    if (problem.type === 'multiplication') {
      const len = suffixRuleLen(problem.a, problem.b);
      if (len === 2) {
        return String(correct % 100).padStart(2, '0');
      }
      if (len === 1) {
        return String(correct % 10);
      }
    }
    // For division or no pattern required
    return null;
  }

  /**
   * Adjust a candidate number so that it ends with the same suffix as the
   * correct answer. If no suffix is specified, the number is returned
   * unchanged. The adjustment chooses the nearest number to the candidate
   * that shares the suffix.
   *
   * @param {number} n - Candidate number
   * @param {string|null} suffix - Required suffix (e.g. '5', '25')
   * @returns {number}
   */
  function adjustToSuffix(n, suffix) {
    if (!suffix) return n;
    const mod = Math.pow(10, suffix.length);
    const suffixNum = parseInt(suffix, 10);
    // Base candidate with correct suffix
    let base = n - (n % mod) + suffixNum;
    // Consider neighbours one mod below and above to find closest
    const candidates = [base - mod, base, base + mod].filter(x => x > 0);
    candidates.sort((x, y) => Math.abs(x - n) - Math.abs(y - n));
    return candidates[0];
  }

  /**
   * Generate three distractor answers for a given problem. The distractors
   * respect suffix patterns for multiplication involving factors of 5 or 25.
   * Distractors are generated near the correct value to appear plausible.
   *
   * @param {Object} problem - Problem containing operands and answer
   * @param {number} correct - Correct answer
   * @returns {number[]} Array of 3 unique distractors
   */
  function makeSmartDistractors(problem, correct) {
    const suffix = requiredSuffix(problem, correct);
    const distractors = [];
    const used = new Set([correct]);
    // Generate neighbours by adjusting factors for multiplication problems
    if (problem.type === 'multiplication') {
      const a = problem.a;
      const b = problem.b;
      const neighbours = [];
      // Only generate neighbour values if a and b are greater than 1 to avoid zero or duplicate
      neighbours.push(a * Math.max(1, b - 1));
      neighbours.push(a * (b + 1));
      neighbours.push(Math.max(1, a - 1) * b);
      neighbours.push((a + 1) * b);
      for (const val of neighbours) {
        let candidate = adjustToSuffix(val, suffix);
        if (!used.has(candidate) && candidate > 0) {
          used.add(candidate);
          distractors.push(candidate);
          if (distractors.length >= 3) break;
        }
      }
    }
    // If insufficient distractors, fill with random values around correct
    const baseStep = suffix ? Math.pow(10, suffix.length) : 1;
    // Predefine some deltas scaled by baseStep to control distance
    const deltaList = [1, 2, 3, 4, 5].map(k => k * baseStep);
    while (distractors.length < 3) {
      const delta = deltaList[Math.floor(Math.random() * deltaList.length)];
      const sign = Math.random() < 0.5 ? -1 : 1;
      let candidate = correct + sign * delta;
      candidate = adjustToSuffix(candidate, suffix);
      if (candidate > 0 && !used.has(candidate)) {
        used.add(candidate);
        distractors.push(candidate);
      }
    }
    return distractors;
  }

  /**
   * Generate four answer options for a given problem. For multiplication
   * problems involving factors of 5 or 25, the distractor answers share the
   * same ending pattern (0/5 or 00/25/50/75) as the correct answer. For all
   * other cases, distractors are random numbers near the correct answer.
   *
   * @param {Object} problem - Problem containing operands and answer
   * @returns {number[]} Shuffled array of 4 answer options
   */
  function generateOptions(problem) {
    const correct = problem.answer;
    const options = new Set([correct]);
    // Use smart distractors for multiplication problems
    if (problem.type === 'multiplication') {
      const distractors = makeSmartDistractors(problem, correct);
      distractors.forEach(d => options.add(d));
    } else {
      // For division and other cases, fall back to random neighbours around correct
      const range = Math.max(3, Math.floor(correct / 3));
      while (options.size < 4) {
        const candidate = randomInt(Math.max(1, correct - range), correct + range);
        options.add(candidate);
      }
    }
    return shuffleArray(Array.from(options));
  }

  /**
   * Crear un botón de borrado que evita saltos de diseño por doble toque en móviles.
   * @param {Function} onDelete - Acción a ejecutar cuando se borra un dígito.
   * @returns {HTMLButtonElement} Botón configurado.
   */
  function createDeleteKey(onDelete) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '⌫';
    button.className = 'num-btn delete-btn';

    let skipNextClick = false;
    let skipResetHandle = null;

    const clearSkip = () => {
      skipNextClick = false;
      if (skipResetHandle) {
        clearTimeout(skipResetHandle);
        skipResetHandle = null;
      }
    };

    button.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        skipNextClick = true;
        event.preventDefault();
      }
    });

    button.addEventListener('pointerup', (event) => {
      if (event.pointerType === 'touch' || event.pointerType === 'pen') {
        event.preventDefault();
        onDelete();
        if (skipResetHandle) {
          clearTimeout(skipResetHandle);
        }
        skipResetHandle = setTimeout(() => {
          clearSkip();
        }, 350);
      }
    });

    button.addEventListener('pointercancel', () => {
      clearSkip();
    });

    button.addEventListener('click', (event) => {
      if (skipNextClick) {
        event.preventDefault();
        clearSkip();
        return;
      }
      onDelete();
    });

    return button;
  }

  /**
   * Iniciar una sesión de aprendizaje.
   */
  function startLearningSession() {
    learnProblems = generateProblems();
    learnIndex = 0;
    learnCorrectCount = 0;
    learnTypedAnswer = '';
    showScreen('learning');
    renderLearningProblem();
  }

  /**
   * Renderizar el problema actual de aprendizaje.
   */
  function renderLearningProblem() {
    const problem = learnProblems[learnIndex];
    // Reiniciar bandera de intento incorrecto para este problema
    learningHasWrongAttempt = false;
    const { numQuestions, multipleChoice } = getActiveModeConfig();
    learnProgressSpan.textContent = `${learnIndex + 1}/${numQuestions}`;
    if (problem.type === 'multiplication') {
      learnProblemDiv.textContent = `${problem.a} × ${problem.b} = ?`;
    } else {
      learnProblemDiv.textContent = `${problem.dividend} ÷ ${problem.divisor} = ?`;
    }
    // Mostrar las estrellas actuales del problema
    const starCount = stars[createProblemKey(problem)] || 0;
    renderStarRating(learnStarsDiv, starCount);
    learnFeedbackDiv.textContent = '';
    learnFeedbackDiv.style.color = '#2c3e50';
    learnAnswerArea.innerHTML = '';
    learnTypedAnswer = '';
    // Ocultar botones de siguiente y salto
    learnNextBtn.classList.add('hidden');
    if (learnSkipBtn) {
      learnSkipBtn.style.display = 'none';
    }
    // Registrar momento de inicio de la pregunta para métricas
    learnQuestionStartTime = Date.now();

    if (multipleChoice) {
      // Generar y mostrar opciones
      const options = generateOptions(problem);
      options.forEach((value) => {
        const btn = document.createElement('button');
        btn.textContent = value;
        btn.className = 'answer-option';
        btn.addEventListener('click', () => {
          handleLearnSelection(btn, value, problem.answer);
        });
        learnAnswerArea.appendChild(btn);
      });
    } else {
      // Crear display para respuesta escrita
      const display = document.createElement('div');
      display.id = 'learn-display';
      display.className = 'numeric-display';
      display.textContent = '';
      learnAnswerArea.appendChild(display);
      // Crear teclado numérico
      const grid = document.createElement('div');
      grid.className = 'num-keypad';
      [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((num) => {
        const b = document.createElement('button');
        b.textContent = num;
        b.className = 'num-btn';
        b.addEventListener('click', () => {
          if (learnTypedAnswer.length < 6) {
            learnTypedAnswer += num.toString();
            display.textContent = learnTypedAnswer;
          }
        });
        grid.appendChild(b);
      });
      // Botón borrar
      const delBtn = createDeleteKey(() => {
        learnTypedAnswer = learnTypedAnswer.slice(0, -1);
        display.textContent = learnTypedAnswer;
      });
      grid.appendChild(delBtn);
      // Botón 0
      const zeroBtn = document.createElement('button');
      zeroBtn.textContent = '0';
      zeroBtn.className = 'num-btn';
      zeroBtn.addEventListener('click', () => {
        if (learnTypedAnswer.length < 6) {
          learnTypedAnswer += '0';
          display.textContent = learnTypedAnswer;
        }
      });
      grid.appendChild(zeroBtn);
      // Botón enviar
      const submitBtn = document.createElement('button');
      submitBtn.textContent = '✓';
      submitBtn.className = 'num-btn submit-btn';
      submitBtn.addEventListener('click', () => {
        handleLearnSubmit(problem.answer, display);
      });
      grid.appendChild(submitBtn);
      learnAnswerArea.appendChild(grid);

      // Mover el botón de salto dentro del área de respuesta y ocultarlo
      if (learnSkipBtn) {
        learnSkipBtn.style.display = 'none';
        learnSkipBtn.textContent = LEARN_SKIP_TEXT;
        learnSkipBtn.setAttribute('aria-label', LEARN_SKIP_ARIA);
        learnAnswerArea.appendChild(learnSkipBtn);
      }
    }
  }

  /**
   * Gestionar selección en modo aprendizaje múltiple.
   * @param {HTMLElement} btn - Botón presionado.
   * @param {number} value - Valor del botón.
   * @param {number} correct - Respuesta correcta.
   */
  function handleLearnSelection(btn, value, correct) {
    // Procesar selección en modo de aprendizaje adaptado:
    // No deshabilitar todas las opciones; sólo la seleccionada si es incorrecta.
    const currentProblem = learnProblems[learnIndex];
    const isCorrect = value === correct;
    // Incrementar métricas globales
    stats.totalQuestions++;
    const now = Date.now();
    const timeTaken = now - learnQuestionStartTime;
    recordProblemAttempt(currentProblem, {
      correct: isCorrect,
      timeTaken,
      skipped: false,
      mode: 'learning',
      source: 'multiple-choice',
    });
    if (isCorrect) {
      // Correcto: marcar la opción y actualizar métricas
      btn.classList.add('correct');
      learnCorrectCount++;
      stats.totalCorrect++;
      learnFeedbackDiv.textContent = '¡Correcto!';
      learnFeedbackDiv.style.color = '#27ae60';
      // Actualizar estrellas solo si no hubo fallos previos
      if (!learningHasWrongAttempt) {
        updateStarsForProblem(currentProblem, true);
        // Actualizar inmediatamente la visualización de estrellas para reflejar el incremento
        const updatedCount = stars[createProblemKey(currentProblem)] || 0;
        renderStarRating(learnStarsDiv, updatedCount);
      }
      updateDailyStats(true, timeTaken);
      // Animar tarjeta
      animateProblemCard();
      // Deshabilitar todas las opciones restantes
      learnAnswerArea.querySelectorAll('button').forEach((b) => {
        b.disabled = true;
      });
      saveStats();
      updateProgressBar();
      // Avanzar después de un breve retraso
      setTimeout(() => {
        nextLearningStep();
      }, 500);
    } else {
      // Incorrecto: marcar la opción, deshabilitar sólo esta
      btn.classList.add('incorrect');
      btn.disabled = true;
      learnFeedbackDiv.textContent = '¡Respuesta incorrecta!';
      learnFeedbackDiv.style.color = '#c0392b';
      // Decrementar estrellas solo la primera vez que se falla
      if (!learningHasWrongAttempt) {
        updateStarsForProblem(currentProblem, false);
        learningHasWrongAttempt = true;
        // Actualizar inmediatamente la visualización de estrellas para reflejar la penalización
        const updatedCount = stars[createProblemKey(currentProblem)] || 0;
        renderStarRating(learnStarsDiv, updatedCount);
      }
      updateDailyStats(false, timeTaken);
      saveStats();
      updateProgressBar();
      // Reiniciar cronómetro para medir el siguiente intento
      learnQuestionStartTime = Date.now();
    }
  }

  /**
   * Gestionar envío de respuesta escrita en aprendizaje.
   * @param {number} correct - Respuesta correcta.
   * @param {HTMLElement} display - Display de la respuesta.
   */
  function handleLearnSubmit(correct, display) {
    if (learnTypedAnswer.length === 0) return;
    const currentProblem = learnProblems[learnIndex];
    const value = parseInt(learnTypedAnswer, 10);
    const now = Date.now();
    const timeTaken = now - learnQuestionStartTime;
    const isCorrect = value === correct;
    recordProblemAttempt(currentProblem, {
      correct: isCorrect,
      timeTaken,
      skipped: false,
      mode: 'learning',
      source: 'written',
    });
    // Reiniciar variable para un nuevo intento o siguiente pregunta
    learnTypedAnswer = '';
    // Evaluar respuesta
    if (isCorrect) {
      // Correcto: marcar en verde y avanzar
      display.classList.remove('incorrect');
      display.classList.add('correct');
      learnCorrectCount++;
      stats.totalCorrect++;
      learnFeedbackDiv.textContent = '¡Correcto!';
      learnFeedbackDiv.style.color = '#27ae60';
      // Actualizar estrellas solo si no hubo intentos fallidos previos
      if (!learningHasWrongAttempt) {
        updateStarsForProblem(currentProblem, true);
        // Actualizar visualización de estrellas inmediatamente en modo escrito
        const updatedCount = stars[createProblemKey(currentProblem)] || 0;
        renderStarRating(learnStarsDiv, updatedCount);
      }
      updateDailyStats(true, timeTaken);
      // Animar tarjeta
      animateProblemCard();
      saveStats();
      updateProgressBar();
      // Deshabilitar teclado
      learnAnswerArea.querySelectorAll('button').forEach((btn) => {
        btn.disabled = true;
      });
      // Ocultar botón de salto
      if (learnSkipBtn) learnSkipBtn.style.display = 'none';
      // Avanzar a la siguiente pregunta después de un breve retraso
      setTimeout(() => {
        nextLearningStep();
      }, 500);
    } else {
      // Incorrecto: marcar en rojo y permitir nuevo intento
      display.classList.remove('correct');
      display.classList.add('incorrect');
      learnFeedbackDiv.textContent = '¡Respuesta incorrecta!';
      learnFeedbackDiv.style.color = '#c0392b';
      // Decrementar estrellas sólo la primera vez que se falla
      if (!learningHasWrongAttempt) {
        updateStarsForProblem(currentProblem, false);
        learningHasWrongAttempt = true;
        // Actualizar visualización de estrellas inmediatamente para reflejar decremento
        const updatedCount = stars[createProblemKey(currentProblem)] || 0;
        renderStarRating(learnStarsDiv, updatedCount);
      }
      updateDailyStats(false, timeTaken);
      saveStats();
      updateProgressBar();
      // Restablecer display para un nuevo intento
      setTimeout(() => {
        display.classList.remove('incorrect');
        display.textContent = '';
      }, 300);
      // Habilitar teclas nuevamente
      learnAnswerArea.querySelectorAll('button').forEach((btn) => {
        // Mantener habilitado para nuevos intentos (incluido submit)
        btn.disabled = false;
      });
      // Reiniciar cronómetro para calcular el siguiente intento
      learnQuestionStartTime = Date.now();
      // Mostrar botón de salto para permitir revelar la respuesta
      if (learnSkipBtn) {
        learnSkipBtn.style.display = 'block';
        learnSkipBtn.textContent = LEARN_SKIP_TEXT;
        learnSkipBtn.setAttribute('aria-label', LEARN_SKIP_ARIA);
      }
    }
  }

  /**
   * Pasar al siguiente problema de aprendizaje o finalizar.
   */
  function nextLearningStep() {
    // Ocultar botón de salto para la nueva pregunta o finalización
    if (learnSkipBtn) {
      learnSkipBtn.style.display = 'none';
    }
    const { numQuestions } = getActiveModeConfig();
    if (learnIndex < numQuestions - 1) {
      learnIndex++;
      renderLearningProblem();
    } else {
      // Mostrar resumen y volver a inicio tras una pausa
      learnFeedbackDiv.textContent = `Respuestas correctas: ${learnCorrectCount} de ${numQuestions}`;
      learnFeedbackDiv.style.color = '#2c3e50';
      learnNextBtn.classList.add('hidden');
      setTimeout(() => {
        showScreen('home');
      }, 2000);
    }
  }

  /**
   * Iniciar sesión de entrenamiento.
   */
  function startTrainingSession() {
    configureTrainingSession(TRAINING_CONTEXT.GENERAL);
    trainProblems = generateProblems();
    trainIndex = 0;
    trainCorrectCount = 0;
    trainTypedAnswer = '';
    trainScoreDiv.textContent = '';
    trainRestartBtn.classList.add('hidden');
    currentSpecificSelection = null;
    showScreen('training');
    renderTrainingProblem();
  }

  /**
   * Renderizar problema actual en entrenamiento.
   */
  function renderTrainingProblem() {
    const problem = trainProblems[trainIndex];
    const { multipleChoice } = getActiveModeConfig();
    // Mostrar progreso basado en la longitud actual de la lista de problemas
    trainProgressSpan.textContent = `${trainIndex + 1}/${trainProblems.length}`;
    if (problem.type === 'multiplication') {
      trainProblemDiv.textContent = `${problem.a} × ${problem.b} = ?`;
    } else {
      trainProblemDiv.textContent = `${problem.dividend} ÷ ${problem.divisor} = ?`;
    }

    trainQuestionStartTime = Date.now();
    applyTrainingSkipPolicy();

    trainFeedbackDiv.textContent = '';
    trainFeedbackDiv.style.color = '#2c3e50';
    trainAnswerArea.innerHTML = '';
    trainTypedAnswer = '';

    // Iniciar o ocultar el temporizador según el tipo de entrenamiento
    if (isSpecificTrainingActive()) {
      // Entrenamiento específico: sin cronómetro
      if (trainTimer) {
        clearInterval(trainTimer);
      }
      trainTimerBar.style.display = 'none';
    } else {
      trainTimerBar.style.display = 'block';
      startTrainTimer();
    }

    if (multipleChoice) {
      const options = generateOptions(problem);
      options.forEach((value) => {
        const btn = document.createElement('button');
        btn.textContent = value;
        btn.className = 'answer-option';
        btn.addEventListener('click', () => {
          handleTrainSelection(btn, value, problem.answer);
        });
        trainAnswerArea.appendChild(btn);
      });
    } else {
      // Display
      const display = document.createElement('div');
      display.id = 'train-display';
      display.className = 'numeric-display';
      display.textContent = '';
      trainAnswerArea.appendChild(display);
      // Teclado
      const grid = document.createElement('div');
      grid.className = 'num-keypad';
      [1, 2, 3, 4, 5, 6, 7, 8, 9].forEach((num) => {
        const b = document.createElement('button');
        b.textContent = num;
        b.className = 'num-btn';
        b.addEventListener('click', () => {
          if (trainTypedAnswer.length < 6) {
            trainTypedAnswer += num.toString();
            display.textContent = trainTypedAnswer;
          }
        });
        grid.appendChild(b);
      });
      const delBtn = createDeleteKey(() => {
        trainTypedAnswer = trainTypedAnswer.slice(0, -1);
        display.textContent = trainTypedAnswer;
      });
      grid.appendChild(delBtn);
      const zeroBtn = document.createElement('button');
      zeroBtn.textContent = '0';
      zeroBtn.className = 'num-btn';
      zeroBtn.addEventListener('click', () => {
        if (trainTypedAnswer.length < 6) {
          trainTypedAnswer += '0';
          display.textContent = trainTypedAnswer;
        }
      });
      grid.appendChild(zeroBtn);
      const submitBtn = document.createElement('button');
      submitBtn.textContent = '✓';
      submitBtn.className = 'num-btn submit-btn';
      submitBtn.addEventListener('click', () => {
        handleTrainSubmit(problem.answer, display);
      });
      grid.appendChild(submitBtn);
      trainAnswerArea.appendChild(grid);
    }
  }

  /**
   * Iniciar el temporizador en la pantalla de entrenamiento.
   */
  function startTrainTimer() {
    if (trainTimer) {
      clearInterval(trainTimer);
    }
    const { seconds } = getActiveModeConfig();
    trainTimeRemaining = seconds;
    trainTotalSeconds = seconds;
    trainTimerFill.style.width = '100%';
    trainTimer = setInterval(() => {
      trainTimeRemaining -= 0.1;
      const percent = (trainTimeRemaining / trainTotalSeconds) * 100;
      trainTimerFill.style.width = `${Math.max(0, percent)}%`;
      if (trainTimeRemaining <= 0) {
        clearInterval(trainTimer);
        handleTrainFail('time');
      }
    }, 100);
  }

  /**
   * Gestionar selección en entrenamiento.
   * @param {HTMLElement} btn - Botón seleccionado.
   * @param {number} value - Valor seleccionado.
   * @param {number} correct - Respuesta correcta.
   */
  function handleTrainSelection(btn, value, correct) {
    // Si hay un temporizador activo, detenerlo
    if (trainTimer) {
      clearInterval(trainTimer);
    }
    // Deshabilitar todos los botones de respuesta para evitar múltiples clics
    const buttons = trainAnswerArea.querySelectorAll('button');
    buttons.forEach((b) => {
      b.disabled = true;
    });
    disableTrainSkipButton();
    // Registrar la pregunta respondida
    stats.totalQuestions++;
    const currentProblem = trainProblems[trainIndex];
    const now = Date.now();
    const timeTaken = now - trainQuestionStartTime;
    const isCorrect = value === correct;
    recordProblemAttempt(currentProblem, {
      correct: isCorrect,
      timeTaken,
      skipped: false,
      mode: isSpecificTrainingActive() ? 'specific' : 'training',
      source: 'multiple-choice',
    });
    if (isCorrect) {
      // Correcto: marcar en verde y continuar al siguiente problema
      trainCorrectCount++;
      stats.totalCorrect++;
      btn.classList.add('correct');
      trainFeedbackDiv.textContent = '¡Correcto!';
      trainFeedbackDiv.style.color = '#27ae60';
      // Guardar estadísticas
      saveStats();
      // Esperar brevemente y avanzar al siguiente problema
      scheduleNextTrainingQuestion(500);
    } else {
      buttons.forEach((b) => {
        const val = parseInt(b.textContent, 10);
        if (val === correct) {
          b.classList.add('correct');
        } else {
          b.classList.add('incorrect');
        }
      });
      trainingHasMistake = true;
      if (trainingSessionContext === TRAINING_CONTEXT.GENERAL) {
        trainFeedbackDiv.textContent = '¡Respuesta incorrecta!';
        trainFeedbackDiv.style.color = '#c0392b';
        saveStats();
        handleTrainFail('wrong');
      } else {
        trainFeedbackDiv.textContent = `Respuesta incorrecta. La respuesta correcta era ${correct}.`;
        trainFeedbackDiv.style.color = '#c0392b';
        saveStats();
        if (trainSkipBtn) {
          trainSkipBtn.classList.remove('hidden');
          trainSkipBtn.disabled = true;
        }
        scheduleNextTrainingQuestion(1000);
      }
    }
  }

  /**
   * Gestionar envío en entrenamiento con respuesta escrita.
   * @param {number} correct - Respuesta correcta.
   * @param {HTMLElement} display - Display de la respuesta.
   */
  function handleTrainSubmit(correct, display) {
    if (trainTypedAnswer.length === 0) return;
    if (trainTimer) {
      clearInterval(trainTimer);
    }
    // Deshabilitar teclado para evitar más entradas
    trainAnswerArea.querySelectorAll('button').forEach((btn) => {
      btn.disabled = true;
    });
    disableTrainSkipButton();
    stats.totalQuestions++;
    const currentProblem = trainProblems[trainIndex];
    const now = Date.now();
    const timeTaken = now - trainQuestionStartTime;
    const value = parseInt(trainTypedAnswer, 10);
    const isCorrect = value === correct;
    recordProblemAttempt(currentProblem, {
      correct: isCorrect,
      timeTaken,
      skipped: false,
      mode: isSpecificTrainingActive() ? 'specific' : 'training',
      source: 'written',
    });
    if (isCorrect) {
      // Correcto: sumar puntaje y continuar
      trainCorrectCount++;
      stats.totalCorrect++;
      display.classList.add('correct');
      trainFeedbackDiv.textContent = '¡Correcto!';
      trainFeedbackDiv.style.color = '#27ae60';
      saveStats();
      scheduleNextTrainingQuestion(500);
    } else {
      trainingHasMistake = true;
      const correctText = String(correct);
      display.classList.add('incorrect');
      display.textContent = correctText;
      if (trainingSessionContext === TRAINING_CONTEXT.GENERAL) {
        trainFeedbackDiv.textContent = '¡Respuesta incorrecta!';
        trainFeedbackDiv.style.color = '#c0392b';
        saveStats();
        handleTrainFail('wrong');
      } else {
        trainFeedbackDiv.textContent = `Respuesta incorrecta. La respuesta correcta era ${correctText}.`;
        trainFeedbackDiv.style.color = '#c0392b';
        saveStats();
        if (trainSkipBtn) {
          trainSkipBtn.classList.remove('hidden');
          trainSkipBtn.disabled = true;
        }
        scheduleNextTrainingQuestion(1000);
      }
    }
  }

  /**
   * Finalizar entrenamiento tras completarlo sin errores.
   */
  function handleTrainFinish() {
    if (trainTimer) {
      clearInterval(trainTimer);
    }
    hideTrainSkipButton();
    trainScoreDiv.textContent = `Respuestas correctas: ${trainCorrectCount} de ${trainProblems.length}`;
    trainFeedbackDiv.textContent = '¡Sesión completada!';
    trainFeedbackDiv.style.color = '#27ae60';
    trainRestartBtn.classList.remove('hidden');
  }

  /**
   * Finalizar la sesión de entrenamiento debido a un fallo (respuesta incorrecta
   * o tiempo agotado). Muestra el número de respuestas correctas alcanzadas y
   * habilita el botón para reiniciar la sesión.
   */
  function endTrainingDueToError() {
    if (trainTimer) {
      clearInterval(trainTimer);
    }
    hideTrainSkipButton();
    // Mostrar puntuación alcanzada antes del fallo
    trainScoreDiv.textContent = `Respuestas correctas: ${trainCorrectCount} de ${trainProblems.length}`;
    // El mensaje ya se ha establecido antes de llamar a esta función
    // Aseguramos que el botón de reinicio sea visible
    trainRestartBtn.classList.remove('hidden');
  }

  /**
   * Manejar finalización del entrenamiento por error o tiempo.
   * @param {string} reason - 'time' o 'wrong'.
   */
  function handleTrainFail(reason) {
    // Manejo de fallo durante el entrenamiento: ya sea por tiempo o respuesta incorrecta.
    if (trainTimer) {
      clearInterval(trainTimer);
    }
    disableTrainSkipButton();
    applyTrainingSkipPolicy();
    const currentProblem = trainProblems[trainIndex];
    if (currentProblem) {
      const now = Date.now();
      const timeTaken = now - trainQuestionStartTime;
      recordProblemAttempt(currentProblem, {
        correct: false,
        timeTaken,
        skipped: false,
        mode: isSpecificTrainingActive() ? 'specific' : 'training',
        source: reason === 'time' ? 'timeout' : 'system',
        timedOut: reason === 'time',
      });
    }
    // Deshabilitar botones restantes
    trainAnswerArea.querySelectorAll('button').forEach((btn) => {
      btn.disabled = true;
    });
    // Mostrar mensaje según el tipo de fallo
    if (reason === 'time') {
      trainFeedbackDiv.textContent = '¡Tiempo agotado! Sesión terminada.';
    } else {
      trainFeedbackDiv.textContent = '¡Respuesta incorrecta! Sesión terminada.';
    }
    trainFeedbackDiv.style.color = '#c0392b';
    // Finalizar entrenamiento completamente tras una breve pausa
    setTimeout(() => {
      endTrainingDueToError();
    }, 800);
  }

  /**
   * Iniciar una sesión de entrenamiento específica con una lista de problemas predefinidos.
   * @param {Array} problemList - Lista de problemas a entrenar.
   */
  function startSpecificTrainingSession(problemList) {
    if (Array.isArray(problemList) && problemList.length > 0) {
      currentSpecificSelection = problemList.map((prob) => ({ ...prob }));
    }
    if (!isSpecificTrainingActive()) {
      return;
    }
    configureTrainingSession(TRAINING_CONTEXT.SPECIFIC);
    trainProblems = generateSpecificProblems(currentSpecificSelection);
    trainIndex = 0;
    trainCorrectCount = 0;
    trainTypedAnswer = '';
    trainScoreDiv.textContent = '';
    trainRestartBtn.classList.add('hidden');
    showScreen('training');
    renderTrainingProblem();
  }

  function isSpecificTrainingActive() {
    return Array.isArray(currentSpecificSelection) && currentSpecificSelection.length > 0;
  }

  function resetTableCardObserver() {
    if (tableCardObserver) {
      tableCardObserver.disconnect();
      tableCardObserver = null;
    }
  }

  function getTableCardObserver() {
    if (!screens.tables) return null;
    if (!tableCardObserver) {
      tableCardObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            const card = entry.target;
            ensureTableCardRows(card);
            const master = card.querySelector('.master-checkbox');
            if (master) {
              syncRowsForMaster(master, card);
            }
            tableCardObserver.unobserve(card);
          });
        },
        {
          root: screens.tables,
          rootMargin: '160px 0px',
          threshold: 0.1,
        }
      );
    }
    return tableCardObserver;
  }

  function ensureTableCardRows(card) {
    if (!card) return null;
    if (card.dataset.rendered === 'true') {
      return card.querySelector('.table-rows');
    }
    const rowsContainer = card.querySelector('.table-rows');
    if (!rowsContainer) return null;

    const tableValue = parseInt(card.dataset.table, 10);
    const factorLimit = parseInt(card.dataset.factorLimit, 10);
    if (!Number.isFinite(tableValue) || !Number.isFinite(factorLimit)) {
      card.dataset.rendered = 'true';
      return rowsContainer;
    }

    const operation = card.dataset.operation || getActiveOperation() || 'multiplication';
    const fragment = document.createDocumentFragment();
    for (let factor = 1; factor <= factorLimit; factor++) {
      const row = document.createElement('div');
      row.className = 'table-row';
      row.dataset.factor = String(factor);

      const span = document.createElement('span');
      if (operation === 'multiplication') {
        span.textContent = `${tableValue} × ${factor} = ${tableValue * factor}`;
      } else {
        const dividend = tableValue * factor;
        span.textContent = `${dividend} ÷ ${tableValue} = ${factor}`;
      }

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.className = 'row-checkbox';
      checkbox.dataset.table = String(tableValue);
      checkbox.dataset.factor = String(factor);
      checkbox.disabled = true;

      row.appendChild(span);
      row.appendChild(checkbox);
      fragment.appendChild(row);
    }

    rowsContainer.appendChild(fragment);
    card.dataset.rendered = 'true';
    return rowsContainer;
  }

  function syncRowsForMaster(masterCheckbox, card, shouldRender = false) {
    if (!masterCheckbox || !card) return;
    const rowsContainer = shouldRender ? ensureTableCardRows(card) : card.querySelector('.table-rows');
    if (!rowsContainer || (!rowsContainer.childElementCount && !shouldRender)) {
      return;
    }

    const shouldEnable =
      specificToggle && specificToggle.checked && masterCheckbox.checked && !masterCheckbox.disabled;
    const rows = rowsContainer.querySelectorAll('.row-checkbox');
    if (!rows.length) {
      return;
    }

    if (shouldEnable) {
      const alreadyEnabled = Array.from(rows).every(
        (rowCb) => !rowCb.disabled && rowCb.checked
      );
      if (alreadyEnabled) {
        return;
      }
    } else {
      const activeRow =
        rowsContainer.querySelector('.row-checkbox:not(:disabled)') ||
        rowsContainer.querySelector('.row-checkbox:checked');
      if (!activeRow) {
        return;
      }
    }

    rows.forEach((rowCb) => {
      const targetDisabled = !shouldEnable;
      if (rowCb.disabled !== targetDisabled) {
        rowCb.disabled = targetDisabled;
      }
      if (rowCb.checked !== shouldEnable) {
        rowCb.checked = shouldEnable;
      }
    });
  }

  function createTableCard(tableValue, factorLimit) {
    const card = document.createElement('div');
    card.className = 'table-card';
    card.dataset.table = String(tableValue);
    card.dataset.factorLimit = String(factorLimit);
    const operation = getActiveOperation();
    card.dataset.operation = operation;
    card.dataset.rendered = 'false';

    const header = document.createElement('div');
    header.className = 'table-header';

    const title = document.createElement('h3');
    title.textContent =
      operation === 'multiplication' ? `Tabla del ${tableValue}` : `Dividir por ${tableValue}`;
    header.appendChild(title);

    const master = document.createElement('input');
    master.type = 'checkbox';
    master.className = 'master-checkbox';
    master.dataset.table = String(tableValue);
    master.disabled = !(specificToggle && specificToggle.checked);
    header.appendChild(master);

    header.addEventListener('click', (event) => {
      if (event.target === master) {
        return;
      }
      event.preventDefault();
      master.checked = !master.checked;
      syncRowsForMaster(master, card, true);
    });

    master.addEventListener('change', () => {
      syncRowsForMaster(master, card, true);
    });

    const rowsContainer = document.createElement('div');
    rowsContainer.className = 'table-rows';
    rowsContainer.dataset.table = String(tableValue);

    rowsContainer.addEventListener('click', (event) => {
      const row = event.target.closest('.table-row');
      if (!row) return;
      const checkbox = row.querySelector('.row-checkbox');
      if (!checkbox || checkbox.disabled || event.target === checkbox) {
        return;
      }
      checkbox.checked = !checkbox.checked;
    });

    card.appendChild(header);
    card.appendChild(rowsContainer);

    return card;
  }

  /**
   * Construir y mostrar tablas según la configuración.
   */
  function showTablesScreen() {
    if (!tablesContainer) return;
    if (tablesRenderHandle) {
      cancelAnimationFrame(tablesRenderHandle);
      tablesRenderHandle = null;
    }

    resetTableCardObserver();
    tablesContainer.innerHTML = '';
    tablesContainer.scrollTop = 0;

    const { min, max } = getActiveModeConfig();
    const minValue = Math.max(1, Math.min(min, max));
    const maxValue = Math.max(1, Math.max(min, max));
    const factorLimit = Math.max(1, maxValue);
    const tableValues = [];
    for (let value = minValue; value <= maxValue; value++) {
      tableValues.push(value);
    }

    const totalTables = tableValues.length;
    const chunkSize = totalTables > 36 ? 4 : totalTables > 18 ? 6 : 10;
    let index = 0;

    if (specificToggle && startSpecificBtn) {
      startSpecificBtn.classList.toggle('hidden', !specificToggle.checked);
      tablesContainer.classList.toggle('specific-mode', specificToggle.checked);
    }

    if (tableValues.length === 0) {
      updateSpecificUI();
      showScreen('tables');
      return;
    }

    function renderChunk() {
      const fragment = document.createDocumentFragment();
      const addedCards = [];
      const limit = Math.min(index + chunkSize, tableValues.length);
      for (; index < limit; index++) {
        const card = createTableCard(tableValues[index], factorLimit);
        fragment.appendChild(card);
        addedCards.push(card);
      }
      tablesContainer.appendChild(fragment);

      const observer = getTableCardObserver();
      if (observer) {
        addedCards.forEach((card) => observer.observe(card));
      } else {
        addedCards.forEach((card) => {
          ensureTableCardRows(card);
          const master = card.querySelector('.master-checkbox');
          if (master) {
            syncRowsForMaster(master, card);
          }
        });
      }

      if (tablesContainer.childElementCount === addedCards.length) {
        const initialCards = addedCards.slice(0, 3);
        initialCards.forEach((card) => {
          ensureTableCardRows(card);
          const master = card.querySelector('.master-checkbox');
          if (master) {
            syncRowsForMaster(master, card);
          }
        });
      }

      if (index < tableValues.length) {
        tablesRenderHandle = requestAnimationFrame(renderChunk);
      } else {
        tablesRenderHandle = null;
        updateSpecificUI();
      }
    }

    renderChunk();
    showScreen('tables');
  }

  /**
   * Inicializar la aplicación y enlazar eventos.
   */
  function init() {
    loadConfig();
    loadStats();
    loadMastery();
    loadStars();
    loadDueTimes();
    loadIntervalStages();
    loadErrors();
    // Cargar estadísticas diarias
    loadDailyStats();
    updateProgressBar();
    // Navegación desde la pantalla de inicio
    homeSettingsBtn.addEventListener('click', () => {
      loadConfig();
      showScreen('config');
    });
    homeLearnBtn.addEventListener('click', () => {
      startLearningSession();
    });
    homeTrainBtn.addEventListener('click', () => {
      startTrainingSession();
    });
    if (homeErrorsBtn) {
      homeErrorsBtn.addEventListener('click', () => {
        startErrorsSession();
      });
    }
    homeTablesBtn.addEventListener('click', () => {
      showTablesScreen();
    });

    // Botón para mostrar pantalla de progreso
    if (homeProgressBtn) {
      homeProgressBtn.addEventListener('click', () => {
        showProgressScreen();
      });
    }
    if (homeProgressShortcut) {
      homeProgressShortcut.addEventListener('click', () => {
        showProgressScreen();
      });
    }

    operationRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          fillConfigInputs(radio.value);
        }
      });
    });

    // Botones de operación en la pantalla de inicio
    homeOpMulBtn.addEventListener('click', () => {
      setActiveOperation('multiplication');
      localStorage.setItem('config', JSON.stringify(config));
      updateHomeOperationToggle();
      updateProgressBar();
    });
    homeOpDivBtn.addEventListener('click', () => {
      setActiveOperation('division');
      localStorage.setItem('config', JSON.stringify(config));
      updateHomeOperationToggle();
      updateProgressBar();
    });
    // Botones de configuración
    configBackBtn.addEventListener('click', () => {
      showScreen('home');
    });
    configSaveBtn.addEventListener('click', () => {
      saveConfig();
    });

    // Reiniciar progreso
    resetProgressBtn.addEventListener('click', () => {
      // Mostrar confirmación antes de eliminar todo el progreso
      const confirmed = window.confirm('¿Estás seguro de que deseas eliminar todo tu progreso?');
      if (!confirmed) return;
      // Restablecer estadísticas, estrellas, repaso y errores
      stats = Object.assign({}, defaultStats);
      stars = {};
      dueTimes = {};
      intervalStages = {};
      errorsToday = {};
      masteryMap = {};
      saveStats();
      saveStars();
      saveDueTimes();
      saveIntervalStages();
      saveErrors();
      saveMastery();
      updateProgressBar();
      scheduleAssistantPanelRefresh();
      alert('Progreso eliminado');
    });
    // Botones de regreso en aprendizaje, entrenamiento y tablas
    learnBackBtn.addEventListener('click', () => {
      if (trainTimer) {
        clearInterval(trainTimer);
      }
      showScreen('home');
    });
    trainBackBtn.addEventListener('click', () => {
      if (trainTimer) {
        clearInterval(trainTimer);
      }
      showScreen('home');
    });
    tablesBackBtn.addEventListener('click', () => {
      showScreen('home');
    });
    // Botón de regreso en la pantalla de progreso
    if (progressBackBtn) {
      progressBackBtn.addEventListener('click', () => {
        showScreen('home');
      });
    }
    // Botón siguiente en aprendizaje
    learnNextBtn.addEventListener('click', () => {
      nextLearningStep();
    });

    // Botón para saltar problemas escritos (mostrar respuesta y avanzar)
    if (learnSkipBtn) {
      learnSkipBtn.addEventListener('click', () => {
        // En modo escrito, permitir saltar: mostrar la respuesta correcta en el
        // display y en el mensaje, actualizar estadísticas como incorrecto y
        // avanzar tras un breve retraso. No se usa en entrenamiento.
        const problem = learnProblems[learnIndex];
        if (!problem) return;
        // Determinar respuesta correcta
        let correct;
        if (problem.type === 'multiplication') {
          correct = problem.a * problem.b;
        } else {
          correct = problem.answer;
        }
        // Colocar la respuesta correcta en el display de la respuesta escrita
        const displayEl = learnAnswerArea.querySelector('#learn-display');
        if (displayEl) {
          displayEl.textContent = String(correct);
          displayEl.classList.remove('incorrect');
          displayEl.classList.add('correct');
        }
        // Mostrar la respuesta en el mensaje
        learnFeedbackDiv.textContent = `La respuesta era ${correct}`;
        learnFeedbackDiv.style.color = '#c0392b';
        // Actualizar estrellas como fallo sólo si no se había fallado antes
        if (!learningHasWrongAttempt) {
          updateStarsForProblem(problem, false);
          learningHasWrongAttempt = true;
          // Actualizar visualización de estrellas inmediatamente al saltar
          const updatedCount = stars[createProblemKey(problem)] || 0;
          renderStarRating(learnStarsDiv, updatedCount);
        }
        updateDailyStats(false, 0);
        const skipNow = Date.now();
        const skipTimeTaken = skipNow - learnQuestionStartTime;
        recordProblemAttempt(problem, {
          correct: false,
          timeTaken: skipTimeTaken,
          skipped: true,
          mode: 'learning',
          source: 'skip',
        });
        // Ocultar el botón de salto para evitar múltiples clics
        learnSkipBtn.style.display = 'none';
        // Avanzar después de un breve retraso para dar tiempo a leer la respuesta
        setTimeout(() => {
          nextLearningStep();
        }, 1000);
      });
    }
    if (trainSkipBtn) {
      trainSkipBtn.addEventListener('click', () => {
        if (trainSkipBtn.disabled) {
          return;
        }
        const problem = trainProblems[trainIndex];
        if (!problem) {
          return;
        }
        if (trainTimer) {
          clearInterval(trainTimer);
        }
        disableTrainSkipButton();
        const answerButtons = trainAnswerArea.querySelectorAll('button');
        answerButtons.forEach((btn) => {
          btn.disabled = true;
        });
        const correct = problem.answer;
        const now = Date.now();
        const timeTaken = now - trainQuestionStartTime;
        const { multipleChoice } = getActiveModeConfig();
        if (multipleChoice) {
          answerButtons.forEach((btn) => {
            const val = parseInt(btn.textContent, 10);
            if (val === correct) {
              btn.classList.add('correct');
            } else {
              btn.classList.remove('incorrect');
            }
          });
        } else {
          const display = trainAnswerArea.querySelector('#train-display');
          if (display) {
            display.textContent = String(correct);
            display.classList.remove('incorrect');
            display.classList.add('correct');
          }
        }
        stats.totalQuestions++;
        recordProblemAttempt(problem, {
          correct: false,
          timeTaken,
          skipped: true,
          mode: isSpecificTrainingActive() ? 'specific' : 'training',
          source: 'skip',
        });
        trainFeedbackDiv.textContent = `La respuesta era ${correct}.`;
        trainFeedbackDiv.style.color = '#c0392b';
        saveStats();
        scheduleNextTrainingQuestion(1000);
      });
    }
    // Reiniciar entrenamiento
    trainRestartBtn.addEventListener('click', () => {
      // Si hay una lista de problemas específicos, reiniciar esa sesión; de lo contrario, sesión aleatoria
      if (isSpecificTrainingActive()) {
        startSpecificTrainingSession();
      } else {
        startTrainingSession();
      }
    });

    // Renderizar el panel de asistente en el primer renderizado de la página
    try {
      renderAssistantPanel();
    } catch (e) {
      console.error('Error al renderizar asistente en la carga inicial', e);
    }

    // Manejo del entrenamiento específico en la pantalla de tablas
    if (specificToggle) {
      specificToggle.addEventListener('change', () => {
        updateSpecificUI();
      });
    }
    if (startSpecificBtn) {
      startSpecificBtn.addEventListener('click', () => {
        // Construir lista de problemas específicos seleccionados
        const checkedMasters = tablesContainer.querySelectorAll('.master-checkbox:checked');
        checkedMasters.forEach((master) => {
          const card = master.closest('.table-card');
          if (card) {
            syncRowsForMaster(master, card, true);
          }
        });

        const selectedProblems = [];
        const selectedRows = tablesContainer.querySelectorAll(
          '.row-checkbox:not(:disabled):checked'
        );
        const operation = getActiveOperation();
        selectedRows.forEach((rowCb) => {
          const table = parseInt(rowCb.dataset.table, 10);
          const factor = parseInt(rowCb.dataset.factor, 10);
          if (Number.isNaN(table) || Number.isNaN(factor)) {
            return;
          }
          if (operation === 'multiplication') {
            selectedProblems.push({
              type: 'multiplication',
              a: table,
              b: factor,
              answer: table * factor,
            });
          } else {
            const dividend = table * factor;
            selectedProblems.push({
              type: 'division',
              dividend: dividend,
              divisor: table,
              answer: factor,
            });
          }
        });
        if (selectedProblems.length === 0) {
          alert('Selecciona al menos una tabla y un número para entrenar.');
          return;
        }
        startSpecificTrainingSession(selectedProblems);
      });
    }
    // Mostrar pantalla de inicio
    showScreen('home');
  }

  init();
});