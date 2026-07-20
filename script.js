/*
 * Nueva versión de la aplicación de tablas para multiplicar y dividir.
 * Maneja la navegación, configuración global, aprendizaje, entrenamiento y visualización de tablas.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Referencias a las diferentes pantallas
  const screens = {
    // Pestañas principales
    home: document.getElementById('home-screen'),
    train: document.getElementById('train-screen'),
    learn: document.getElementById('learn-screen'),
    analysis: document.getElementById('progress-screen'),
    profile: document.getElementById('profile-screen'),
    // Subpantallas y modo enfoque
    learning: document.getElementById('learning-screen'),
    training: document.getElementById('training-screen'),
    tables: document.getElementById('tables-screen'),
  };

  // Pestañas de la barra de navegación y pestaña "madre" de cada subpantalla
  const TAB_SCREENS = ['home', 'train', 'learn', 'analysis', 'profile'];
  const SUBSCREEN_TAB = { tables: 'learn' };
  let currentTab = 'home';

  // Botones en la pantalla de inicio
  const homeLearnBtn = document.getElementById('home-learn-btn');
  // Botón para entrenar los errores del día
  const homeErrorsBtn = document.getElementById('home-errors-btn');
  const homeTablesBtn = document.getElementById('home-tables-btn');
  // Botón para la pantalla de progreso
  const homeOpMulBtn = document.getElementById('home-op-mul');
  const homeOpDivBtn = document.getElementById('home-op-div');

  // Elementos de progreso global
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  // Configuración: inputs y botones
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
    LEVEL: 'level',
  });
  let trainingSessionContext = TRAINING_CONTEXT.GENERAL;
  let trainingHasMistake = false;
  // Sesión de nivel en curso (práctica de técnica o jefe de nivel)
  let levelSession = null;
  // Modo racha 🔥: solo si el usuario lo activa, un fallo termina la sesión
  let strictTrainingSession = false;

  // Elementos de la pantalla de progreso
  const heatmapContainer = document.getElementById('heatmap-container');
  const metricsCard = document.getElementById('metrics-card');
  const goalCard = document.getElementById('goal-card');

  // Tarjeta que muestra el resultado de la celda seleccionada en la pantalla de progreso
  const resultCard = document.getElementById('result-card');

  // Panel de asistente en la pantalla de inicio
  const assistantPanel = document.getElementById('assistant-panel');

  const blockGesture = (event) => {
    if (event.touches && event.touches.length > 1) {
      event.preventDefault();
    }
  };

  // Nota: el zoom por doble toque ya lo evita `touch-action: manipulation`
  // en el body. El antiguo preventDefault global sobre touchend rompía la
  // escritura rápida en el teclado numérico (perdía pulsaciones a <350 ms).
  const preventGesture = (event) => {
    event.preventDefault();
  };

  document.addEventListener('touchstart', blockGesture, { passive: false });
  document.addEventListener('touchmove', blockGesture, { passive: false });
  document.addEventListener('gesturestart', preventGesture, { passive: false });
  document.addEventListener('gesturechange', preventGesture, { passive: false });
  document.addEventListener('gestureend', preventGesture, { passive: false });

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

  // ----- GESTIÓN CENTRALIZADA DE TIMEOUTS DE SESIÓN -----
  // Todos los avances diferidos (siguiente pregunta, retorno al inicio, etc.)
  // pasan por aquí para poder cancelarlos al cambiar de pantalla. Antes, un
  // setTimeout huérfano podía reiniciar el cronómetro o navegar al home
  // mientras el usuario estaba en otra pantalla.
  const pendingUITimeouts = new Set();

  function scheduleUITimeout(fn, delay) {
    const handle = setTimeout(() => {
      pendingUITimeouts.delete(handle);
      fn();
    }, delay);
    pendingUITimeouts.add(handle);
    return handle;
  }

  function clearPendingUITimeouts() {
    pendingUITimeouts.forEach((handle) => clearTimeout(handle));
    pendingUITimeouts.clear();
  }

  function isScreenActive(name) {
    return !!(screens[name] && screens[name].classList.contains('active'));
  }

  // ----- FEEDBACK VISUAL -----
  // Colores vía clases CSS (antes se usaban colores oscuros en línea que
  // resultaban ilegibles sobre el fondo oscuro).
  function setFeedback(element, message, type = 'neutral') {
    if (!element) return;
    element.textContent = message;
    element.classList.remove('success', 'error');
    if (type === 'success') {
      element.classList.add('success');
    } else if (type === 'error') {
      element.classList.add('error');
    }
  }

  // ----- NOTIFICACIONES TOAST (sustituyen a alert()) -----
  const toastContainer = document.getElementById('toast-container');

  function showToast(message, type = 'info') {
    if (!toastContainer) {
      alert(message);
      return;
    }
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'info' ? '' : type}`.trim();
    toast.textContent = message;
    toastContainer.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3400);
  }

  // ----- VENTANA MODAL (Ayuda / Consejos) -----
  const appModal = document.getElementById('app-modal');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  let modalLastFocus = null;

  // Acción opcional del modal (p. ej. "▶ Practicar" en las técnicas)
  let modalAction = null;

  function openModal(title, items, options = {}) {
    if (!appModal || !modalTitle || !modalBody) return;
    modalLastFocus = document.activeElement;
    modalTitle.textContent = title;
    modalBody.innerHTML = '';
    items.forEach((item) => {
      const li = document.createElement('li');
      if (Array.isArray(item)) {
        const [strongText, restText] = item;
        if (strongText) {
          const strong = document.createElement('strong');
          strong.textContent = strongText;
          li.appendChild(strong);
        }
        li.appendChild(document.createTextNode(restText));
      } else {
        li.textContent = String(item);
      }
      modalBody.appendChild(li);
    });
    modalAction = typeof options.onAction === 'function' ? options.onAction : null;
    const actionBtn = document.getElementById('modal-action-btn');
    if (actionBtn) {
      actionBtn.classList.toggle('hidden', !modalAction);
      actionBtn.textContent = options.actionLabel || '▶ Practicar';
    }
    appModal.classList.remove('hidden');
    // Llevar el foco a la acción principal del modal
    if (modalAction && actionBtn) {
      actionBtn.focus();
    } else if (modalCloseBtn) {
      modalCloseBtn.focus();
    }
  }

  function closeModal() {
    if (!appModal) return;
    appModal.classList.add('hidden');
    if (modalLastFocus && typeof modalLastFocus.focus === 'function') {
      modalLastFocus.focus();
    }
    modalLastFocus = null;
  }

  function isModalOpen() {
    return !!(appModal && !appModal.classList.contains('hidden'));
  }

  const HELP_ITEMS = [
    ['Aprendizaje: ', 'practica sin límite de tiempo y gana hasta 5 estrellas por operación.'],
    ['Entrenamiento: ', 'responde contrarreloj; un fallo termina la sesión.'],
    ['Errores de hoy: ', 'repasa las operaciones que fallaste durante el día.'],
    ['Tablas: ', 'consulta las tablas y crea entrenamientos específicos a tu medida.'],
    ['Progreso: ', 'el mapa de calor muestra tu dominio de cada combinación; toca una celda para ver el resultado.'],
  ];

  const TIPS_ITEMS = [
    ['Constancia: ', 'practica un poco cada día; vale más que una sesión larga a la semana.'],
    ['Repasos: ', 'las recomendaciones del inicio aparecen justo cuando estás a punto de olvidar una operación.'],
    ['Errores: ', 'si fallas una operación, vuelve a practicarla el mismo día para fijarla.'],
    ['Patrones: ', 'busca trucos: ×9 es ×10 menos el número; ×5 es la mitad de ×10.'],
    ['Velocidad: ', 'cuando domines una tabla, usa el entrenamiento contrarreloj para automatizarla.'],
  ];

  // ----- CONTADOR DE ERRORES DEL DÍA EN EL BOTÓN DEL HOME -----
  const errorsBadge = document.getElementById('errors-badge');

  function updateErrorsBadge() {
    if (!errorsBadge) return;
    const today = getTodayDate();
    const count = Array.isArray(errorsToday[today]) ? errorsToday[today].length : 0;
    if (count > 0) {
      errorsBadge.textContent = String(count);
      errorsBadge.classList.remove('hidden');
    } else {
      errorsBadge.textContent = '';
      errorsBadge.classList.add('hidden');
    }
  }

  // Configuración por defecto y estadísticas
  const defaultModeSettings = Object.freeze({
    min: 1,
    max: 10,
    multipleChoice: false,
    numQuestions: 10,
    seconds: 30,
    strict: false,
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
      strict: typeof source.strict === 'boolean' ? source.strict : defaultModeSettings.strict,
    };
  }

  // Límites de personalización: tablas hasta el 30 como máximo y meta
  // diaria libre entre 5 y 1000 ejercicios.
  const TABLE_MAX_LIMIT = 30;
  const DEFAULT_DAILY_GOAL = 15;
  const DAILY_GOAL_MIN = 5;
  const DAILY_GOAL_MAX = 1000;

  const defaultConfig = {
    activeOperation: 'multiplication',
    dailyGoal: DEFAULT_DAILY_GOAL,
    modes: {
      multiplication: cloneModeSettings(),
      division: cloneModeSettings(),
    },
  };

  function cloneDefaultConfig() {
    return {
      activeOperation: defaultConfig.activeOperation,
      dailyGoal: defaultConfig.dailyGoal,
      modes: {
        multiplication: cloneModeSettings(defaultConfig.modes.multiplication),
        division: cloneModeSettings(defaultConfig.modes.division),
      },
    };
  }

  function normalizeDailyGoal(value) {
    const parsed = Math.floor(Number(value));
    if (!Number.isFinite(parsed)) return DEFAULT_DAILY_GOAL;
    return Math.min(DAILY_GOAL_MAX, Math.max(DAILY_GOAL_MIN, parsed));
  }

  function getDailyGoal() {
    return normalizeDailyGoal(config && config.dailyGoal);
  }

  function normalizeModeSettings(raw, fallback) {
    const base = cloneModeSettings(fallback);
    if (!raw || typeof raw !== 'object') {
      return base;
    }
    const normalized = cloneModeSettings(raw);
    // Acotar a límites seguros: valores desmesurados congelan el mapa de calor
    normalized.min = Math.min(TABLE_MAX_LIMIT, Math.max(1, Math.floor(normalized.min)));
    normalized.max = Math.min(TABLE_MAX_LIMIT, Math.max(normalized.min, Math.floor(normalized.max)));
    normalized.numQuestions = Math.min(200, Math.max(1, Math.floor(normalized.numQuestions)));
    normalized.seconds = Math.min(600, Math.max(1, Math.floor(normalized.seconds)));
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
        dailyGoal: normalizeDailyGoal(raw.dailyGoal),
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
      showToast('No hay errores registrados hoy. ¡Felicidades!', 'success');
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
      showToast('No hay suficientes errores para entrenar.');
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
    if (problem.key) {
      // Problemas de niveles: clave agrupada por técnica y tramo, para que
      // la maestría y el repaso no crezcan con cada instancia aleatoria.
      return problem.key;
    }
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
    // Fecha LOCAL, no UTC: con toISOString() los "errores de hoy" y las
    // métricas diarias se reiniciaban a medianoche UTC (media tarde o
    // madrugada según la zona horaria del usuario).
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
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
    recordAdaptiveOutcome(problem, { correct, skipped, timedOut, timeTaken: ms });
    // Capturar el resultado para la evaluación de la sesión de nivel en curso
    if (mode === 'level' && levelSession) {
      levelSession.results.push({ correct: !!correct && !skipped && !timedOut, timeMs: ms });
    }
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

  // ----- MOTOR ADAPTATIVO (lib/adaptiveEngine.js) -----
  // Puente con el motor determinista de habilidades: registra cada intento,
  // sesga la selección de problemas hacia las habilidades débiles/vencidas
  // y alimenta el análisis de evolución de la pantalla de progreso.
  // Si el módulo no está disponible, todos los enganches se desactivan solos.
  const ADAPTIVE_STORAGE_KEY = 'adaptiveState';
  let adaptiveState = null;

  function getAdaptiveEngine() {
    return typeof AdaptiveEngine !== 'undefined' && AdaptiveEngine ? AdaptiveEngine : null;
  }

  function loadAdaptiveState() {
    const engine = getAdaptiveEngine();
    if (!engine) return;
    let raw = null;
    try {
      raw = JSON.parse(localStorage.getItem(ADAPTIVE_STORAGE_KEY) || 'null');
    } catch (err) {
      console.error('No se pudo cargar adaptiveState', err);
    }
    adaptiveState = engine.normalizeState(raw);
  }

  function saveAdaptiveState() {
    if (!adaptiveState) return;
    try {
      localStorage.setItem(ADAPTIVE_STORAGE_KEY, JSON.stringify(adaptiveState));
    } catch (err) {
      console.error('No se pudo guardar adaptiveState', err);
    }
  }

  function recordAdaptiveOutcome(problem, { correct, skipped, timedOut, timeTaken }) {
    const engine = getAdaptiveEngine();
    if (!engine) return;
    if (!adaptiveState) loadAdaptiveState();
    if (!adaptiveState) return;
    engine.recordOutcome(adaptiveState, {
      problem,
      correct,
      skipped,
      timedOut,
      timeMs: timeTaken,
      now: Date.now(),
    });
    saveAdaptiveState();
  }

  function adaptiveProblemBias(problem, now) {
    const engine = getAdaptiveEngine();
    if (!engine || !adaptiveState) return 1;
    return engine.problemBias(adaptiveState, problem, { now });
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
      // Solo las combinaciones de tablas entran en "Errores de hoy" (los
      // ejercicios de nivel usan claves c_* que esa sesión no puede recrear).
      if (mode !== 'learning' && parseProblemKey(key)) {
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
  function calculateProgress(operationOverride) {
    const operation = operationOverride === 'division' || operationOverride === 'multiplication'
      ? operationOverride
      : getActiveOperation();
    const { min, max } = getModeConfig(operation);
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
    const goalBefore = dailyStats.totalQuestions;
    dailyStats.totalQuestions++;
    // Celebrar el cierre del anillo justo cuando se alcanza la meta
    const dailyGoalValue = getDailyGoal();
    if (goalBefore < dailyGoalValue && dailyStats.totalQuestions >= dailyGoalValue) {
      showToast(`🎉 ¡Meta diaria cumplida! ${dailyGoalValue} ejercicios`, 'success');
    }
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
  // Operación que se está VIENDO en Análisis (independiente del modo
  // global de práctica): permite consultar × y ÷ sin cambiar nada.
  let analysisViewOperation = null;

  function getAnalysisOperation() {
    return analysisViewOperation || getActiveOperation();
  }

  /** Reflejar en los botones ×/÷ de Análisis la operación que se muestra. */
  function updateAnalysisOpToggle() {
    const op = getAnalysisOperation();
    const mulBtn = document.getElementById('analysis-op-mul');
    const divBtn = document.getElementById('analysis-op-div');
    if (mulBtn) {
      mulBtn.classList.toggle('active', op === 'multiplication');
      mulBtn.setAttribute('aria-pressed', String(op === 'multiplication'));
    }
    if (divBtn) {
      divBtn.classList.toggle('active', op === 'division');
      divBtn.setAttribute('aria-pressed', String(op === 'division'));
    }
  }

  /** Al entrenar desde el mapa de calor, alinear el modo global con la vista. */
  function syncOperationWithAnalysisView() {
    const viewOp = getAnalysisOperation();
    if (viewOp !== getActiveOperation()) {
      setActiveOperation(viewOp);
      localStorage.setItem('config', JSON.stringify(config));
      updateHomeOperationToggle();
    }
  }

  function buildHeatmap() {
    if (!heatmapContainer) return;
    heatmapContainer.innerHTML = '';
    heatmapContainer.scrollTop = 0;
    heatmapContainer.scrollLeft = 0;
    const operation = getAnalysisOperation();
    const { min, max } = getModeConfig(operation);
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
    // Encabezados de columnas (fila superior) — botones accesibles por teclado
    for (let b = min; b <= max; b++) {
      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'heatmap-header column-header';
      header.textContent = b;
      header.dataset.col = b;
      header.setAttribute(
        'aria-label',
        operation === 'multiplication'
          ? `Entrenar la columna del ${b}`
          : `Entrenar divisiones con cociente ${b}`
      );
      grid.appendChild(header);
    }
    // Crear filas con encabezado de fila y celdas
    for (let a = min; a <= max; a++) {
      const rowHeader = document.createElement('button');
      rowHeader.type = 'button';
      rowHeader.className = 'heatmap-header row-header';
      rowHeader.textContent = a;
      rowHeader.dataset.row = a;
      rowHeader.setAttribute(
        'aria-label',
        operation === 'multiplication' ? `Entrenar la tabla del ${a}` : `Entrenar divisiones entre ${a}`
      );
      grid.appendChild(rowHeader);
      for (let b = min; b <= max; b++) {
        const key = createProblemKey(
          operation === 'multiplication'
            ? { type: 'multiplication', a, b }
            : { type: 'division', dividend: a * b, divisor: a }
        );
        const count = stars[key] || 0;
        const cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'heatmap-cell';
        // Asignar color según estrellas: 0–1 gris, 2–3 naranja, 4–5 verde
        if (count <= 1) {
          cell.classList.add('heatmap-grey');
        } else if (count <= 3) {
          cell.classList.add('heatmap-orange');
        } else {
          cell.classList.add('heatmap-green');
        }
        cell.dataset.a = a;
        cell.dataset.b = b;
        const label =
          operation === 'multiplication' ? `${a} por ${b}` : `${a * b} entre ${a}`;
        cell.setAttribute('aria-label', `Ver resultado de ${label} (${count} de 5 estrellas)`);
        grid.appendChild(cell);
      }
    }
    // Un único listener delegado para todo el mapa (antes: un listener por celda)
    grid.addEventListener('click', (event) => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.classList.contains('column-header')) {
        const b = parseInt(target.dataset.col, 10);
        if (Number.isFinite(b)) {
          syncOperationWithAnalysisView();
          startSpecificColumnTraining(b);
        }
        return;
      }
      if (target.classList.contains('row-header')) {
        const a = parseInt(target.dataset.row, 10);
        if (Number.isFinite(a)) {
          syncOperationWithAnalysisView();
          startSpecificRowTraining(a);
        }
        return;
      }
      if (target.classList.contains('heatmap-cell')) {
        const a = parseInt(target.dataset.a, 10);
        const b = parseInt(target.dataset.b, 10);
        if (!Number.isFinite(a) || !Number.isFinite(b)) return;
        let resultText;
        if (operation === 'multiplication') {
          resultText = `${a} × ${b} = ${a * b}`;
        } else {
          resultText = `${a * b} ÷ ${a} = ${b}`;
        }
        if (resultCard) {
          resultCard.textContent = resultText;
          resultCard.classList.remove('placeholder');
        }
      }
    });
    // Mostrar una pista de uso hasta que se seleccione una celda
    if (resultCard) {
      resultCard.textContent = 'Toca una celda para ver el resultado';
      resultCard.classList.add('placeholder');
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
      return () => { };
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
    // Bienvenida con dirección: al usuario recién llegado se le señala
    // el camino, no una estadística de combinaciones.
    if (
      Object.keys(masteryMap).length === 0 &&
      (!adaptiveState || Object.keys(adaptiveState.skills).length === 0)
    ) {
      const action = nextPathAction();
      return [
        {
          id: 'welcome',
          title: '👋 Bienvenido a tu progresión',
          reason: 'Empieza por los Cimientos: domina las tablas y las etapas se abrirán una a una.',
          action: action ? action.run : () => showScreen('learn'),
        },
      ];
    }
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

    // Recomendación a nivel de habilidad del motor adaptativo: detecta la
    // tabla más débil comparada con la mediana del propio usuario.
    const engine = getAdaptiveEngine();
    if (engine && adaptiveState) {
      const analysis = engine.analyze(adaptiveState, { now });
      const wantedGroup = operation === 'multiplication' ? 'multiplicación' : 'división';
      const weak = analysis.weaknesses.find(
        (s) => s.meta && s.meta.table && s.meta.group === wantedGroup && s.meta.table >= min && s.meta.table <= max
      );
      if (weak) {
        pushRec({
          id: `skill_${weak.id}`,
          title: `Refuerza ${weak.label.toLowerCase()}`,
          reason: `Por debajo de tu media: ${Math.round(weak.accEff * 100)}% de acierto reciente`,
          action: () => startSpecificRowTraining(weak.meta.table),
        });
      }
    }

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

    // Título
    const title = document.createElement('h3');
    title.textContent = 'Métricas del día';
    metricsCard.appendChild(title);

    // Contenedor de lista
    const list = document.createElement('div');
    list.style.fontSize = '16px';
    list.style.lineHeight = '1.4';

    // Párrafo 1: Acierto
    const p1 = document.createElement('p');
    p1.textContent = `% de acierto del día: ${acc}%`;
    list.appendChild(p1);

    // Párrafo 2: Tiempo medio
    const p2 = document.createElement('p');
    const timeText = avgTime > 0 ? formatDuration(avgTime) : '—';
    p2.textContent = `Tiempo medio por respuesta: ${timeText}`;
    list.appendChild(p2);

    // Párrafo 3: Racha
    const p3 = document.createElement('p');
    p3.textContent = `Racha más larga del día: ${dailyStats.streakMax}`;
    list.appendChild(p3);

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
    const goal = getDailyGoal();
    // Número de ejercicios completados se basa en totalQuestions
    const done = Math.min(dailyStats.totalQuestions, goal);
    if (goal <= 30) {
      // Metas pequeñas: círculos individuales, uno por ejercicio
      const container = document.createElement('div');
      container.className = 'goal-circles';
      for (let i = 0; i < goal; i++) {
        const circle = document.createElement('div');
        circle.className = 'goal-circle';
        if (i < done) {
          circle.classList.add('completed');
        }
        container.appendChild(circle);
      }
      goalCard.appendChild(container);
    } else {
      // Metas ambiciosas: barra de progreso continua
      const bar = document.createElement('div');
      bar.className = 'mini-bar';
      const fill = document.createElement('div');
      fill.className = 'mini-bar-fill';
      fill.style.width = `${Math.min(100, Math.round((done / goal) * 100))}%`;
      bar.appendChild(fill);
      goalCard.appendChild(bar);
    }
    const summary = document.createElement('p');
    summary.textContent =
      done >= goal
        ? '¡Meta diaria cumplida! 🎉'
        : `${done} de ${goal} ejercicios hoy · ajústala en Perfil`;
    goalCard.appendChild(summary);
  }

  /**
   * Mostrar la pantalla de progreso, construyendo el mapa de calor y métricas.
   */
  /**
   * Renderizar la tarjeta "Análisis de tu evolución" con los datos del
   * motor adaptativo: tendencia semanal, fortalezas, puntos a reforzar,
   * repasos de habilidad pendientes e historial de los últimos 14 días.
   */
  function renderPerformanceAnalysis() {
    const container = document.getElementById('analysis-card');
    if (!container) return;
    container.innerHTML = '';
    const title = document.createElement('h3');
    title.textContent = 'Análisis de tu evolución';
    container.appendChild(title);
    const engine = getAdaptiveEngine();
    if (engine && !adaptiveState) loadAdaptiveState();
    const analysis = engine && adaptiveState ? engine.analyze(adaptiveState, { now: Date.now() }) : null;
    if (!analysis || analysis.totalSkills === 0) {
      const placeholder = document.createElement('p');
      placeholder.className = 'analysis-placeholder';
      placeholder.textContent =
        'Completa algunas sesiones de práctica y aquí verás tus fortalezas, tus puntos débiles y tu evolución semana a semana.';
      container.appendChild(placeholder);
      return;
    }
    renderTrendSummary(container, analysis.trend);
    renderSkillChips(container, '💪 Fortalezas', analysis.strengths, 'strength', (s) => `${Math.round(s.accEff * 100)}% de acierto`);
    renderSkillChips(container, '🎯 A reforzar', analysis.weaknesses, 'weak', (s) => `${Math.round(s.accEff * 100)}% de acierto`);
    renderSkillChips(container, '⏰ Toca repasar', analysis.review, 'review', () => 'repaso vencido');
    renderHistoryBars(container, analysis.recentDays);
  }

  /** Resumen de tendencia: última semana frente a la anterior. */
  function renderTrendSummary(container, trend) {
    const wrap = document.createElement('div');
    wrap.className = 'analysis-trend';
    const lines = [];
    if (trend.currAccuracy !== null) {
      let text = `Precisión de los últimos 7 días: ${Math.round(trend.currAccuracy * 100)}%`;
      let cls = '';
      if (trend.accuracyDelta !== null) {
        const pts = Math.round(trend.accuracyDelta * 100);
        if (pts >= 2) {
          text += ` (▲ +${pts} pts frente a la semana anterior)`;
          cls = 'up';
        } else if (pts <= -2) {
          text += ` (▼ ${pts} pts frente a la semana anterior)`;
          cls = 'down';
        } else {
          text += ' (estable frente a la semana anterior)';
        }
      }
      lines.push({ text, cls });
    }
    if (trend.currAvgTime !== null) {
      let text = `Tiempo medio por respuesta: ${(trend.currAvgTime / 1000).toFixed(1)} s`;
      let cls = '';
      if (trend.timeDelta !== null) {
        const secs = trend.timeDelta / 1000;
        if (secs <= -0.3) {
          text += ` (▲ ${Math.abs(secs).toFixed(1)} s más rápido que la semana anterior)`;
          cls = 'up';
        } else if (secs >= 0.3) {
          text += ` (▼ ${secs.toFixed(1)} s más lento que la semana anterior)`;
          cls = 'down';
        }
      }
      lines.push({ text, cls });
    }
    if (trend.currVolume > 0 || trend.prevVolume > 0) {
      lines.push({ text: `Ejercicios: ${trend.currVolume} esta semana · ${trend.prevVolume} la anterior`, cls: '' });
    }
    if (!lines.length) {
      lines.push({ text: 'Practica varios días para ver tu tendencia semanal.', cls: '' });
    }
    lines.forEach(({ text, cls }) => {
      const p = document.createElement('p');
      if (cls) p.classList.add(cls);
      p.textContent = text;
      wrap.appendChild(p);
    });
    container.appendChild(wrap);
  }

  /** Grupo de fichas de habilidades (fortalezas, refuerzos o repasos). */
  function renderSkillChips(container, heading, skills, kind, detailFor) {
    if (!skills || !skills.length) return;
    const section = document.createElement('div');
    section.className = 'analysis-section';
    const h4 = document.createElement('h4');
    h4.textContent = heading;
    section.appendChild(h4);
    const list = document.createElement('div');
    list.className = 'analysis-chips';
    skills.forEach((skill) => {
      const chip = document.createElement('span');
      chip.className = `analysis-chip ${kind}`;
      const name = document.createElement('strong');
      name.textContent = skill.label;
      chip.appendChild(name);
      const detail = document.createElement('small');
      detail.textContent = detailFor(skill);
      chip.appendChild(detail);
      list.appendChild(chip);
    });
    section.appendChild(list);
    container.appendChild(section);
  }

  /**
   * Actividad de los últimos 14 días: cada barra es un día (cuanto más
   * alta, más ejercicios) y su color indica la precisión de ese día.
   */
  function renderHistoryBars(container, days) {
    if (!days || !days.length) return;
    const section = document.createElement('div');
    section.className = 'analysis-section';
    const h4 = document.createElement('h4');
    h4.textContent = '📅 Tu actividad, día a día (últimas 2 semanas)';
    section.appendChild(h4);

    // Resumen del período: la conclusión primero, el gráfico después
    const totalQ = days.reduce((sum, d) => sum + d.q, 0);
    const totalOk = days.reduce((sum, d) => sum + d.ok, 0);
    const activeDays = days.filter((d) => d.q > 0).length;
    const intro = document.createElement('p');
    intro.className = 'analysis-summary';
    intro.textContent =
      totalQ > 0
        ? `Entrenaste ${activeDays} de 14 días: ${totalQ} ejercicios con un ${Math.round((totalOk / totalQ) * 100)}% de acierto.`
        : 'Aún no hay actividad en las últimas dos semanas: cada día entrenado pintará aquí su barra.';
    section.appendChild(intro);

    const bars = document.createElement('div');
    bars.className = 'analysis-bars';
    const maxQ = Math.max(1, ...days.map((d) => d.q));
    const WEEKDAYS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
    days.forEach((d, index) => {
      const col = document.createElement('div');
      col.className = 'analysis-bar-col';
      const bar = document.createElement('div');
      bar.className = 'analysis-bar';
      const fill = document.createElement('div');
      fill.className = 'analysis-bar-fill';
      fill.style.height = d.q > 0 ? `${Math.max(10, Math.round((d.q / maxQ) * 100))}%` : '4%';
      if (d.q === 0) {
        fill.classList.add('empty');
      } else {
        const acc = d.ok / d.q;
        fill.classList.add(acc >= 0.85 ? 'good' : acc >= 0.6 ? 'mid' : 'low');
      }
      const [year, month, dayNum] = d.day.split('-').map(Number);
      const weekday = WEEKDAYS[new Date(year, month - 1, dayNum).getDay()];
      bar.title =
        d.q > 0
          ? `${dayNum}/${month}: ${d.q} ejercicios, ${Math.round((d.ok / d.q) * 100)}% de acierto`
          : `${dayNum}/${month}: sin actividad`;
      bar.appendChild(fill);
      const dayLabel = document.createElement('span');
      dayLabel.className = 'analysis-bar-day';
      dayLabel.textContent = index === days.length - 1 ? 'hoy' : weekday;
      if (index === days.length - 1) dayLabel.classList.add('today');
      col.appendChild(bar);
      col.appendChild(dayLabel);
      bars.appendChild(col);
    });
    section.appendChild(bars);

    // Leyenda con muestras de color reales
    const legend = document.createElement('div');
    legend.className = 'analysis-legend-row';
    [
      ['good', 'buen día (≥85%)'],
      ['mid', 'mejorable (60-84%)'],
      ['low', 'día duro (<60%)'],
      ['empty', 'sin actividad'],
    ].forEach(([kind, text]) => {
      const item = document.createElement('span');
      item.className = 'legend-item';
      const swatch = document.createElement('span');
      swatch.className = `legend-swatch ${kind}`;
      item.appendChild(swatch);
      item.appendChild(document.createTextNode(text));
      legend.appendChild(item);
    });
    section.appendChild(legend);
    const note = document.createElement('p');
    note.className = 'analysis-legend';
    note.textContent = 'La altura de cada barra es la cantidad de ejercicios de ese día.';
    section.appendChild(note);
    container.appendChild(section);
  }

  // ----- PANEL DE INICIO, ENTRENAR, BIBLIOTECA Y PERFIL -----

  /** Racha de días consecutivos con actividad según el historial del motor. */
  function computeStreakDays() {
    const engine = getAdaptiveEngine();
    if (!engine || !adaptiveState) return 0;
    const history = adaptiveState.history || {};
    const DAY = 24 * 60 * 60 * 1000;
    const now = Date.now();
    const todayRec = history[engine.todayKey(now)];
    let streak = 0;
    // Si hoy aún no hay actividad, la racha viva se cuenta desde ayer.
    const start = todayRec && todayRec.q > 0 ? 0 : 1;
    for (let i = start; i < 400; i++) {
      const rec = history[engine.todayKey(now - i * DAY)];
      if (rec && rec.q > 0) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }

  /**
   * La brújula única del camino: calcula el siguiente paso CONCRETO del
   * usuario (aprender cimientos, practicar la próxima técnica o lanzar
   * el desafío) y lo devuelve como acción ejecutable. La usan el reto
   * del Inicio, "Continuar el camino", el asistente y el botón
   * "Siguiente paso" tras cada sesión: una sola recomendación en toda
   * la app, sin brújulas contradictorias.
   */
  function nextPathAction() {
    const id = currentPathNode();
    const LevelsMod = getLevelsModule();
    // Etapa 0: cimientos aún sin medalla → aprender la operación más floja
    if (id === 0 && !pathNodeState(0).medal) {
      const mulPct = Math.round(calculateProgress('multiplication'));
      const divPct = Math.round(calculateProgress('division'));
      const op = divPct < mulPct ? 'division' : 'multiplication';
      return {
        stage: 0,
        label: op === 'division' ? '🎓 Aprender divisiones' : '🎓 Aprender multiplicaciones',
        description: `Etapa 0 · Cimientos: domina las tablas (× ${mulPct}% · ÷ ${divPct}%) y las etapas se abrirán.`,
        run: () => {
          if (getActiveOperation() !== op) {
            setActiveOperation(op);
            localStorage.setItem('config', JSON.stringify(config));
            updateHomeOperationToggle();
          }
          startLearningSession();
        },
      };
    }
    const level = LevelsMod ? LevelsMod.getLevel(id) : null;
    if (!level || !Array.isArray(level.techniques)) return null;
    // ¿Queda alguna técnica de la etapa sin evidencia de dominio?
    const pending = level.techniques.find(
      (tech) => tech.id !== 'blitz' && !isTechniqueMastered(level.id, tech.id)
    );
    if (pending) {
      return {
        stage: id,
        label: `🎓 Practicar: ${pending.name}`,
        description: `Etapa ${id} · ${level.title}: tu siguiente técnica de la progresión.`,
        run: () => startLevelSession(id, 'practice', pending.id),
      };
    }
    const state = pathNodeState(id);
    return {
      stage: id,
      label: `⚔️ Desafío de la etapa ${id}`,
      description: state.medal
        ? `Etapa ${id} · ${level.title}: ya tienes ${MEDAL_LABELS[state.medal].split(' ')[1].toLowerCase()}, ve a por más.`
        : `Etapa ${id} · ${level.title}: técnicas listas, ¡a por la medalla!`,
      run: () => startLevelSession(id, 'boss'),
    };
  }

  function countMedals() {
    // Solo etapas 1-12: la de cimientos (clave 0) se cuenta aparte
    return Object.keys(levelProgress).filter(
      (id) => id !== '0' && levelProgress[id] && levelProgress[id].medal
    ).length;
  }

  /** Medallas del camino completo (incluye la etapa 0 de cimientos). */
  function countPathMedals() {
    return countMedals() + (foundationMedal() ? 1 : 0);
  }

  /** Panel de Inicio: saludo, racha, anillo de meta diaria y próximo reto. */
  function renderHomeDashboard() {
    const greeting = document.getElementById('home-greeting');
    if (greeting) {
      const hour = new Date().getHours();
      greeting.textContent =
        hour < 7 ? 'Entrenando a deshoras 🌙' : hour < 13 ? '¡Buenos días! Tu mente, primero.' : hour < 20 ? '¡Buenas tardes! Toca entrenar.' : 'Última sesión del día 🌆';
    }
    const streakChip = document.getElementById('streak-chip');
    if (streakChip) {
      const streak = computeStreakDays();
      streakChip.textContent = `🔥 ${streak}`;
      streakChip.title = streak === 1 ? '1 día seguido entrenando' : `${streak} días seguidos entrenando`;
    }
    // Anillo de meta diaria
    const ringFill = document.getElementById('goal-ring-fill');
    const ringCount = document.getElementById('goal-ring-count');
    const done = dailyStats.totalQuestions || 0;
    if (ringFill) {
      const circumference = 2 * Math.PI * 52;
      const pct = Math.min(1, done / getDailyGoal());
      ringFill.style.strokeDasharray = `${circumference}`;
      ringFill.style.strokeDashoffset = `${circumference * (1 - pct)}`;
      ringFill.classList.toggle('complete', pct >= 1);
    }
    if (ringCount) {
      ringCount.textContent = `${done}/${getDailyGoal()}`;
    }
    // Pista bajo los botones: qué contendrá la sesión inteligente
    const hint = document.getElementById('smart-session-hint');
    if (hint) {
      const today = getTodayDate();
      const errorCount = (errorsToday[today] || []).filter((key) => parseProblemKey(key)).length;
      const engine = getAdaptiveEngine();
      let dueSkills = 0;
      if (engine && adaptiveState) {
        dueSkills = engine.analyze(adaptiveState, { now: Date.now() }).review.length;
      }
      const parts = [];
      if (errorCount > 0) parts.push(`${errorCount} error${errorCount === 1 ? '' : 'es'} de hoy`);
      if (dueSkills > 0) parts.push(`${dueSkills} repaso${dueSkills === 1 ? '' : 's'} pendiente${dueSkills === 1 ? '' : 's'}`);
      hint.textContent = parts.length ? `El entrenador incluirá: ${parts.join(' · ')}` : 'Tu entrenador personal global';
    }
    // Estadísticas rápidas: hoy, camino y racha de etapas
    const quickStats = document.getElementById('home-quick-stats');
    if (quickStats) {
      quickStats.innerHTML = '';
      const accToday = dailyStats.totalQuestions > 0 ? Math.round((dailyStats.totalCorrect / dailyStats.totalQuestions) * 100) : null;
      const items = [
        { label: 'acierto hoy', value: accToday === null ? '—' : `${accToday}%` },
        { label: 'progresión', value: `🛤️ ${pathProgressPercent()}%` },
        { label: 'medallas', value: `🏅 ${countPathMedals()}/13` },
      ];
      items.forEach(({ label, value }) => {
        const stat = document.createElement('div');
        stat.className = 'quick-stat';
        const strong = document.createElement('strong');
        strong.textContent = value;
        const span = document.createElement('span');
        span.textContent = label;
        stat.appendChild(strong);
        stat.appendChild(span);
        quickStats.appendChild(stat);
      });
    }
    // Próximo paso del camino: la misma brújula que en todas partes
    const challenge = document.getElementById('next-challenge-card');
    if (challenge) {
      challenge.innerHTML = '';
      const action = nextPathAction();
      if (!action) {
        challenge.classList.add('hidden');
      } else {
        challenge.classList.remove('hidden');
        const title = document.createElement('h3');
        title.className = 'section-head';
        title.textContent = '🧭 Tu próximo paso';
        const desc = document.createElement('p');
        desc.className = 'section-desc';
        desc.textContent = action.description;
        const btn = document.createElement('button');
        btn.className = 'primary-btn';
        btn.textContent = action.label;
        btn.addEventListener('click', () => {
          action.run();
        });
        challenge.appendChild(title);
        challenge.appendChild(desc);
        challenge.appendChild(btn);
      }
    }
  }

  /** Pestaña Entrenar: refrescar contadores de errores y niveles. */
  function renderTrainTab() {
    updateErrorsBadge();
    const today = getTodayDate();
    const errorCount = (errorsToday[today] || []).filter((key) => parseProblemKey(key)).length;
    const errorsDesc = document.getElementById('train-errors-desc');
    if (errorsDesc) {
      errorsDesc.textContent =
        errorCount > 0
          ? `Tienes ${errorCount} combinación${errorCount === 1 ? '' : 'es'} fallada${errorCount === 1 ? '' : 's'} hoy esperando revancha.`
          : 'Sin errores pendientes hoy. ¡Sigue así!';
    }
    // Detallar qué compondrá la sesión inteligente ahora mismo
    const smartDesc = document.getElementById('smart-session-desc');
    if (smartDesc) {
      const engine = getAdaptiveEngine();
      const parts = [];
      if (errorCount > 0) parts.push(`${errorCount} error${errorCount === 1 ? '' : 'es'} de hoy`);
      if (engine && adaptiveState) {
        const analysis = engine.analyze(adaptiveState, { now: Date.now() });
        if (analysis.review.length) parts.push(`${analysis.review.length} repaso${analysis.review.length === 1 ? '' : 's'} vencido${analysis.review.length === 1 ? '' : 's'}`);
        if (analysis.weaknesses.length) {
          parts.push(`refuerzo de ${analysis.weaknesses[0].label.toLowerCase()}`);
        }
      }
      smartDesc.textContent = parts.length
        ? `Tu entrenador incluirá ahora: ${parts.join(' · ')} y variedad de todo lo desbloqueado.`
        : 'Tu entrenador personal: analiza todas tus habilidades y compone una tanda con lo que más te conviene ahora.';
    }
    // Fichas de "una tabla concreta": siguen la configuración del usuario
    const tableChips = document.getElementById('table-chips');
    if (tableChips) {
      tableChips.innerHTML = '';
      const chipMax = Math.min(TABLE_MAX_LIMIT, Math.max(getModeConfig('multiplication').max, getModeConfig('division').max));
      for (let n = 1; n <= chipMax; n++) {
        const chip = document.createElement('button');
        chip.type = 'button';
        chip.className = 'table-chip';
        chip.textContent = n;
        chip.setAttribute('aria-label', `Entrenar la tabla del ${n}`);
        chip.addEventListener('click', () => {
          startSpecificRowTraining(n);
        });
        tableChips.appendChild(chip);
      }
    }
    // Sincronizar el constructor con la configuración vigente
    try {
      fillConfigInputs(getActiveOperation());
      updateHomeOperationToggle();
    } catch (e) {
      /* sin configuración aún */
    }
  }

  /**
   * Biblioteca de técnicas en Entrenar: rejilla de tarjetas visuales.
   * Cada tarjeta abre el modal de la técnica (resumen + pasos) con el
   * botón "▶ Practicar" integrado. Se refresca al mostrar la pestaña
   * para reflejar los desbloqueos y la maestría del momento.
   */
  function renderTechLibrary() {
    const container = document.getElementById('tech-library');
    const LevelsMod = getLevelsModule();
    if (!container || !LevelsMod) return;
    container.innerHTML = '';
    LevelsMod.LEVELS.forEach((level) => {
      if (!Array.isArray(level.techniques) || !level.techniques.length) return;
      const unlocked = LevelsMod.isUnlocked(level.id, levelProgress);
      level.techniques.forEach((tech) => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'tech-card';
        if (!unlocked) card.classList.add('ahead');
        const top = document.createElement('span');
        top.className = 'tech-card-top';
        const emoji = document.createElement('span');
        emoji.className = 'tech-card-emoji';
        emoji.textContent = level.emoji;
        const stage = document.createElement('span');
        stage.className = 'tech-stage-chip';
        stage.textContent = `Etapa ${level.id}`;
        top.appendChild(emoji);
        top.appendChild(stage);
        if (isTechniqueMastered(level.id, tech.id)) {
          const tick = document.createElement('span');
          tick.className = 'tech-card-tick';
          tick.textContent = '✓';
          tick.title = 'Técnica con dominio demostrado';
          top.appendChild(tick);
        }
        const name = document.createElement('span');
        name.className = 'tech-card-name';
        name.textContent = tech.name;
        const meta = document.createElement('span');
        meta.className = 'tech-card-meta';
        meta.textContent = unlocked ? tech.summary : 'Más adelante en tu progresión';
        card.appendChild(top);
        card.appendChild(name);
        card.appendChild(meta);
        card.addEventListener('click', () => {
          openModal(tech.name, [tech.summary].concat(tech.steps), {
            actionLabel: '▶ Practicar',
            onAction: () => startLevelSession(level.id, 'practice', tech.id),
          });
        });
        container.appendChild(card);
      });
    });
  }

  /** Perfil: medallas, racha, totales e indicador de dominio. */
  function renderProfile() {
    const summary = document.getElementById('profile-summary');
    const LevelsMod = getLevelsModule();
    if (summary) {
      summary.innerHTML = '';
      const title = document.createElement('h3');
      title.className = 'section-head';
      title.textContent = '🏅 Tu recorrido';
      summary.appendChild(title);
      // Galería de medallas de las 13 etapas del camino (0 = cimientos)
      if (LevelsMod) {
        const gallery = document.createElement('div');
        gallery.className = 'medal-gallery';
        const medalIcon = { bronze: '🥉', silver: '🥈', gold: '🥇' };
        const foundation = document.createElement('div');
        foundation.className = 'medal-cell';
        const fMedal = foundationMedal();
        foundation.textContent = fMedal ? medalIcon[fMedal] : '🧮';
        foundation.title = `Etapa 0 · Cimientos: las tablas${fMedal ? ` — ${MEDAL_LABELS[fMedal]}` : ' — sin medalla aún'}`;
        if (!fMedal) foundation.classList.add('pending');
        gallery.appendChild(foundation);
        LevelsMod.LEVELS.forEach((level) => {
          const cell = document.createElement('div');
          cell.className = 'medal-cell';
          const progress = levelProgress[level.id];
          const unlocked = LevelsMod.isUnlocked(level.id, levelProgress);
          const medal = progress && progress.medal;
          cell.textContent = medal ? medalIcon[medal] : unlocked ? level.emoji : '🔒';
          cell.title = `Etapa ${level.id} · ${level.title}${medal ? ` — ${MEDAL_LABELS[medal]}` : unlocked ? ' — sin medalla aún' : ' — bloqueada'}`;
          if (!medal) cell.classList.add('pending');
          gallery.appendChild(cell);
        });
        summary.appendChild(gallery);
      }
      // Totales del historial del motor (últimos 120 días)
      const engine = getAdaptiveEngine();
      const rows = [];
      const streak = computeStreakDays();
      rows.push(['Racha actual', streak === 1 ? '1 día' : `${streak} días`]);
      rows.push(['Etapas con medalla', `${countPathMedals()} de 13`]);
      rows.push(['Avance de la progresión', `${pathProgressPercent()}%`]);
      if (engine && adaptiveState) {
        const history = adaptiveState.history || {};
        let total = 0;
        let correct = 0;
        let bestDay = 0;
        Object.keys(history).forEach((day) => {
          total += history[day].q || 0;
          correct += history[day].ok || 0;
          bestDay = Math.max(bestDay, history[day].q || 0);
        });
        rows.push(['Ejercicios (últimos 120 días)', String(total)]);
        if (total > 0) rows.push(['Acierto medio', `${Math.round((correct / total) * 100)}%`]);
        if (bestDay > 0) rows.push(['Mejor día', `${bestDay} ejercicios`]);
      }
      const list = document.createElement('div');
      list.className = 'profile-rows';
      rows.forEach(([label, value]) => {
        const row = document.createElement('p');
        const strong = document.createElement('strong');
        strong.textContent = value;
        row.textContent = `${label}: `;
        row.appendChild(strong);
        list.appendChild(row);
      });
      summary.appendChild(list);
    }
    updateProgressBar();
    const modeLabel = document.getElementById('progress-mode-label');
    if (modeLabel) {
      modeLabel.textContent =
        getActiveOperation() === 'multiplication'
          ? 'Modo activo: multiplicación · cambia el modo en Entrenar'
          : 'Modo activo: división · cambia el modo en Entrenar';
    }
    // Dominio por operación: las divisiones tienen su propio progreso
    const dominioBoth = document.getElementById('dominio-both');
    if (dominioBoth) {
      dominioBoth.innerHTML = '';
      [
        { op: 'multiplication', label: '× multiplicación' },
        { op: 'division', label: '÷ división' },
      ].forEach(({ op, label }) => {
        const pct = Math.round(calculateProgress(op));
        const row = document.createElement('p');
        row.className = 'foundation-row';
        row.textContent = `${label}: ${pct}%`;
        const bar = document.createElement('div');
        bar.className = 'mini-bar';
        const fill = document.createElement('div');
        fill.className = 'mini-bar-fill';
        fill.style.width = `${pct}%`;
        bar.appendChild(fill);
        dominioBoth.appendChild(row);
        dominioBoth.appendChild(bar);
      });
    }
    // Reflejar los ajustes personales vigentes
    const dailyGoalInput = document.getElementById('setting-daily-goal');
    if (dailyGoalInput) dailyGoalInput.value = getDailyGoal();
    const tableMaxSelect = document.getElementById('setting-table-max');
    if (tableMaxSelect) {
      const currentMax = Math.max(getModeConfig('multiplication').max, getModeConfig('division').max);
      const options = Array.from(tableMaxSelect.options).map((o) => parseInt(o.value, 10));
      const closest = options.reduce((best, v) => (Math.abs(v - currentMax) < Math.abs(best - currentMax) ? v : best), options[0]);
      tableMaxSelect.value = String(options.includes(currentMax) ? currentMax : closest);
    }
  }

  /**
   * Mapa habilidad → técnica practicable. Se construye una vez a partir
   * de los generadores de los niveles (cada técnica declara sus skills).
   */
  let skillPracticeMap = null;
  function getSkillPracticeMap() {
    if (skillPracticeMap) return skillPracticeMap;
    const LevelsMod = getLevelsModule();
    skillPracticeMap = {};
    if (!LevelsMod) return skillPracticeMap;
    LevelsMod.LEVELS.forEach((level) => {
      (level.techniques || []).forEach((tech) => {
        if (tech.id === 'blitz') return;
        try {
          const sample = tech.generate(LevelsMod.createRng(7));
          (sample.skills || []).forEach((skillId) => {
            if (!skillPracticeMap[skillId]) {
              skillPracticeMap[skillId] = { levelId: level.id, generate: tech.generate };
            }
          });
        } catch (err) {
          /* generador defectuoso: se ignora */
        }
      });
    });
    return skillPracticeMap;
  }

  /** Habilidades por etapa y por técnica (para tiers y progreso de etapa). */
  let levelSkillsCache = null;
  function getLevelSkillsInfo() {
    if (levelSkillsCache) return levelSkillsCache;
    const LevelsMod = getLevelsModule();
    levelSkillsCache = { byLevel: {}, byTechnique: {} };
    if (!LevelsMod) return levelSkillsCache;
    LevelsMod.LEVELS.forEach((level) => {
      const all = new Set();
      (level.techniques || []).forEach((tech) => {
        if (tech.id === 'blitz') return;
        try {
          const sample = tech.generate(LevelsMod.createRng(7), 2);
          const skills = sample.skills || [];
          levelSkillsCache.byTechnique[`${level.id}:${tech.id}`] = skills;
          skills.forEach((s) => all.add(s));
        } catch (err) {
          /* generador defectuoso: se ignora */
        }
      });
      levelSkillsCache.byLevel[level.id] = Array.from(all);
    });
    return levelSkillsCache;
  }

  /** ¿Hay evidencia de dominio de una técnica? (motor: intentos + acierto). */
  function isTechniqueMastered(levelId, techId) {
    const engine = getAdaptiveEngine();
    const info = getLevelSkillsInfo();
    const skills = info.byTechnique[`${levelId}:${techId}`] || [];
    if (!engine || !adaptiveState || !skills.length) return false;
    return skills.every((skillId) => {
      const s = adaptiveState.skills[skillId];
      return s && s.attempts >= 6 && engine.accuracyOf(s) >= 0.6;
    });
  }

  /**
   * Tramo de dificultad (1 principiante · 2 intermedio · 3 avanzado)
   * según el rating del motor en esas habilidades. Sin evidencia
   * suficiente se empieza suave: el siguiente reto siempre es alcanzable.
   */
  function tierForSkills(skillIds) {
    const engine = getAdaptiveEngine();
    if (!engine || !adaptiveState || !skillIds || !skillIds.length) return 1;
    let sum = 0;
    let n = 0;
    skillIds.forEach((id) => {
      const skill = adaptiveState.skills[id];
      if (skill && skill.attempts >= 6) {
        sum += skill.rating;
        n++;
      }
    });
    if (!n) return 1;
    const avg = sum / n;
    return avg >= 1230 ? 3 : avg >= 1080 ? 2 : 1;
  }

  /** Tramo global del usuario (para rellenos variados). */
  function globalTier() {
    if (!adaptiveState) return 1;
    return tierForSkills(Object.keys(adaptiveState.skills));
  }

  /** Problemas de tabla para una habilidad mul.tN / div.tN del motor. */
  function tableProblemsForSkill(skillId, count) {
    const match = /^(mul|div)\.t(\d+)$/.exec(skillId);
    if (!match) return [];
    const table = parseInt(match[2], 10);
    const { min, max } = getActiveModeConfig();
    const problems = [];
    for (let i = 0; i < count; i++) {
      const b = randomInt(min, max);
      if (match[1] === 'mul') {
        problems.push({ type: 'multiplication', a: table, b, answer: table * b });
      } else {
        problems.push({ type: 'division', dividend: table * b, divisor: table, answer: b });
      }
    }
    return problems;
  }

  /**
   * Sesión inteligente global: el entrenador personal. Analiza TODAS las
   * habilidades (tablas y técnicas de los niveles ya desbloqueados) y
   * compone la tanda con: errores de tablas de hoy → habilidades con
   * repaso vencido → debilidades → variedad de todo lo desbloqueado.
   * Corre en contexto LEVEL: fallar no corta la sesión.
   */
  function startSmartSession() {
    const LevelsMod = getLevelsModule();
    const engine = getAdaptiveEngine();
    const { numQuestions } = getActiveModeConfig();
    const today = getTodayDate();
    const list = [];
    const push = (problem) => {
      if (problem && list.length < numQuestions) list.push(Object.assign({}, problem));
    };

    // 1) Errores de tablas de hoy (revancha inmediata)
    (errorsToday[today] || [])
      .map((key) => parseProblemKey(key))
      .filter(Boolean)
      .slice(0, 4)
      .forEach(push);

    // 2) Habilidades vencidas y débiles según el análisis global
    if (engine && adaptiveState) {
      const analysis = engine.analyze(adaptiveState, { now: Date.now() });
      const seen = new Set();
      const targets = analysis.review.concat(analysis.weaknesses).filter((s) => {
        if (seen.has(s.id)) return false;
        seen.add(s.id);
        return true;
      });
      const practiceMap = getSkillPracticeMap();
      targets.forEach((skill) => {
        if (list.length >= numQuestions - 2) return;
        const mapped = practiceMap[skill.id];
        if (mapped && LevelsMod && LevelsMod.isUnlocked(mapped.levelId, levelProgress)) {
          const rng = LevelsMod.createRng((Date.now() + skill.id.length * 7919) >>> 0);
          const skillTier = tierForSkills([skill.id]);
          push(mapped.generate(rng, skillTier));
          push(mapped.generate(rng, skillTier));
        } else {
          tableProblemsForSkill(skill.id, 2).forEach(push);
        }
      });
    }

    // 3) Variedad: rellenar alternando tablas adaptativas y técnicas de
    //    los niveles con medalla (lo desbloqueado se mantiene fresco)
    const adaptive = generateProblems();
    const freshGenerators = [];
    if (LevelsMod) {
      LevelsMod.LEVELS.forEach((level) => {
        if (!Array.isArray(level.techniques)) return;
        if (levelProgress[level.id] && levelProgress[level.id].medal) {
          level.techniques.forEach((tech) => {
            if (tech.id !== 'blitz') freshGenerators.push(tech.generate);
          });
        }
      });
    }
    let adaptiveIdx = 0;
    let genIdx = 0;
    const fillRng = LevelsMod ? LevelsMod.createRng(Date.now() >>> 0) : null;
    const fillTier = globalTier();
    while (list.length < numQuestions) {
      const useTechnique = freshGenerators.length > 0 && fillRng && list.length % 2 === 1;
      if (useTechnique) {
        push(freshGenerators[genIdx % freshGenerators.length](fillRng, fillTier));
        genIdx++;
      } else if (adaptive.length > 0) {
        push(adaptive[adaptiveIdx % adaptive.length]);
        adaptiveIdx++;
      } else if (freshGenerators.length > 0 && fillRng) {
        push(freshGenerators[genIdx % freshGenerators.length](fillRng, fillTier));
        genIdx++;
      } else {
        break;
      }
    }
    if (!list.length) return;

    // Contexto LEVEL con tipo "smart": los fallos no terminan la sesión
    currentSpecificSelection = null;
    strictTrainingSession = false;
    levelSession = { levelId: 0, kind: 'smart', techniqueId: null, results: [] };
    configureTrainingSession(TRAINING_CONTEXT.LEVEL);
    trainProblems = list;
    trainIndex = 0;
    trainCorrectCount = 0;
    trainTypedAnswer = '';
    trainScoreDiv.textContent = '';
    trainRestartBtn.classList.add('hidden');
    showScreen('training');
    renderTrainingProblem();
  }

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
      updateAnalysisOpToggle();
      buildHeatmap();
      renderDailyMetrics();
      renderDailyGoal();
      renderPerformanceAnalysis();
    } catch (e) {
      // En caso de error (por ejemplo, combinación inválida), imprimimos en la consola
      console.error('Error al construir la pantalla de progreso', e);
    }
    // Siempre mostramos la pantalla de progreso aunque haya fallos de construcción
    showScreen('analysis');
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

  /** Modo con el que se registran los intentos de la sesión actual. */
  function currentTrainingMode() {
    if (trainingSessionContext === TRAINING_CONTEXT.LEVEL) return 'level';
    return isSpecificTrainingActive() ? 'specific' : 'training';
  }

  /**
   * Regla unificada: fallar muestra la solución y la sesión continúa.
   * La única excepción es el "modo racha 🔥" que el usuario activa a
   * propósito en el constructor (un fallo termina la sesión).
   */
  function sessionContinuesOnMistake() {
    if (trainingSessionContext === TRAINING_CONTEXT.LEVEL) return true;
    return trainingSessionContext === TRAINING_CONTEXT.GENERAL && !strictTrainingSession;
  }

  /**
   * Comprobar si un valor responde al problema. Los ejercicios de
   * estimación declaran `tolerance`: cualquier valor dentro del margen
   * cuenta como acierto (los problemas exactos usan tolerancia 0).
   */
  function isAnswerAcceptable(problem, value) {
    if (!problem || !Number.isFinite(value)) return false;
    const tolerance = Number.isFinite(problem.tolerance) ? problem.tolerance : 0;
    return Math.abs(value - problem.answer) <= tolerance;
  }

  function scheduleNextTrainingQuestion(delay = 800) {
    const advance = () => {
      if (!isScreenActive('training')) {
        return;
      }
      if (trainIndex < trainProblems.length - 1) {
        trainIndex++;
        renderTrainingProblem();
      } else {
        handleTrainFinish();
      }
    };
    scheduleUITimeout(advance, delay);
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
    const strictInput = document.getElementById('config-strict-mode');
    if (strictInput) strictInput.checked = !!modeConfig.strict;
  }

  /**
   * Guardar la configuración leída del constructor de sesiones.
   * Devuelve true si los valores son válidos y quedaron persistidos.
   */
  function saveConfig() {
    // El modo lo marca el conmutador ×/÷ del constructor (los antiguos
    // radios ya no existen, pero se respetan si estuvieran presentes).
    let selectedOperation = getActiveOperation();
    operationRadios.forEach((radio) => {
      if (radio.checked) selectedOperation = radio.value;
    });
    const minVal = parseInt(configMinInput.value, 10);
    const maxVal = parseInt(configMaxInput.value, 10);
    const mcVal = configMultipleChoice.checked;
    const numQVal = parseInt(configNumQuestionsSelect.value, 10);
    const secondsVal = parseInt(configSecondsInput.value, 10);

    // Tope superior del intervalo: sin él, un valor muy alto (p. ej. 999)
    // genera cientos de miles de combinaciones y congela el mapa de calor.
    const MAX_INTERVAL_VALUE = TABLE_MAX_LIMIT;
    const MAX_SECONDS = 600;

    if (isNaN(minVal) || isNaN(maxVal) || minVal <= 0 || maxVal < minVal) {
      showToast('Ingresa un intervalo de cifras válido.', 'error');
      return false;
    }
    if (maxVal > MAX_INTERVAL_VALUE) {
      showToast(`El intervalo máximo permitido es ${MAX_INTERVAL_VALUE}.`, 'error');
      return false;
    }
    if (isNaN(secondsVal) || secondsVal <= 0 || secondsVal > MAX_SECONDS) {
      showToast(`Ingresa un tiempo válido (1 a ${MAX_SECONDS} segundos).`, 'error');
      return false;
    }

    setActiveOperation(selectedOperation);
    const modeConfig = getModeConfig(selectedOperation);
    modeConfig.min = minVal;
    modeConfig.max = maxVal;
    modeConfig.multipleChoice = mcVal;
    modeConfig.numQuestions = numQVal;
    modeConfig.seconds = secondsVal;
    const strictInput = document.getElementById('config-strict-mode');
    if (strictInput) modeConfig.strict = strictInput.checked;
    config.activeOperation = selectedOperation;
    localStorage.setItem('config', JSON.stringify(config));
    fillConfigInputs(selectedOperation);
    // Actualizar el conmutador de operación del constructor
    updateHomeOperationToggle();
    return true;
  }

  /**
   * Actualizar el estado visual de los botones de operación en la pantalla de inicio
   */
  function updateHomeOperationToggle() {
    const isMultiplication = getActiveOperation() === 'multiplication';
    homeOpMulBtn.classList.toggle('active', isMultiplication);
    homeOpDivBtn.classList.toggle('active', !isMultiplication);
    homeOpMulBtn.setAttribute('aria-pressed', String(isMultiplication));
    homeOpDivBtn.setAttribute('aria-pressed', String(!isMultiplication));
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
    // Mostrar el porcentaje sin decimales (ejemplo 2%, 10%, 88%).
    const rounded = Math.round(percent);
    progressText.textContent = `${rounded}%`;
    const wrapper = document.getElementById('progress-wrapper');
    if (wrapper) {
      wrapper.setAttribute('aria-valuenow', String(rounded));
    }
  }

  const scrollContainer = document.querySelector('.scroll');

  /**
   * Mostrar una pantalla específica y ocultar las demás.
   * @param {string} screenName - Clave de la pantalla a mostrar.
   */
  function showScreen(screenName) {
    // Cancelar cualquier avance diferido y el cronómetro: evita que un
    // setTimeout huérfano navegue o registre fallos tras salir de la sesión.
    clearPendingUITimeouts();
    if (trainTimer && screenName !== 'training') {
      clearInterval(trainTimer);
      trainTimer = null;
    }
    Object.keys(screens).forEach((name) => {
      screens[name].classList.remove('active');
    });
    const scr = screens[screenName];
    if (scr) {
      scr.classList.add('active');
      // Restablecer el scroll y llevar el foco a la nueva pantalla
      if (scrollContainer) {
        scrollContainer.scrollTop = 0;
      }
      scr.setAttribute('tabindex', '-1');
      scr.focus({ preventScroll: true });
    }
    // Seguir la pestaña activa y activar el modo enfoque en las sesiones
    if (TAB_SCREENS.includes(screenName)) {
      currentTab = screenName;
    } else if (SUBSCREEN_TAB[screenName]) {
      currentTab = SUBSCREEN_TAB[screenName];
    }
    const focusMode = screenName === 'learning' || screenName === 'training';
    document.body.classList.toggle('focus-mode', focusMode);
    updateTabBar();

    // Preparar el contenido de cada pestaña al mostrarla
    try {
      if (screenName === 'home') {
        loadDailyStats();
        renderHomeDashboard();
        updateErrorsBadge();
        renderAssistantPanel();
      } else if (screenName === 'train') {
        renderTrainTab();
        renderTechLibrary();
      } else if (screenName === 'learn') {
        renderPath();
      } else if (screenName === 'profile') {
        renderProfile();
      }
    } catch (e) {
      console.error('Error al preparar la pantalla', screenName, e);
    }
  }

  /** Resaltar en la barra de pestañas la sección activa. */
  function updateTabBar() {
    document.querySelectorAll('#tab-bar .tab-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.tab === currentTab);
    });
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
      // El peso base (estrellas + repaso) se modula con el sesgo del motor
      // adaptativo: habilidades débiles o vencidas pesan más, dominadas menos.
      const baseWeight = calculateProblemWeight(prob, { now });
      const weight = baseWeight > 0 ? Math.max(1, Math.round(baseWeight * adaptiveProblemBias(prob, now))) : 0;
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
      // Comparación conmutativa: 3×4 y 4×3 son el mismo problema
      // (coherente con createProblemKey, que también los unifica)
      return (
        Math.min(a.a, a.b) === Math.min(b.a, b.b) &&
        Math.max(a.a, a.b) === Math.max(b.a, b.b)
      );
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
      const baseWeight = calculateProblemWeight(prob, { now });
      const weight = baseWeight > 0 ? Math.max(1, Math.round(baseWeight * adaptiveProblemBias(prob, now))) : 0;
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
    setFeedback(learnFeedbackDiv, '');
    learnAnswerArea.innerHTML = '';
    learnTypedAnswer = '';
    // Ocultar botón de salto
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
      setFeedback(learnFeedbackDiv, '¡Correcto!', 'success');
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
      scheduleUITimeout(() => {
        if (isScreenActive('learning')) {
          nextLearningStep();
        }
      }, 500);
    } else {
      // Incorrecto: marcar la opción, deshabilitar sólo esta
      btn.classList.add('incorrect');
      btn.disabled = true;
      setFeedback(learnFeedbackDiv, '¡Respuesta incorrecta!', 'error');
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
    // Registrar la pregunta también en modo escrito (antes solo se contaba
    // en modo de opciones múltiples y totalCorrect podía superar a totalQuestions)
    stats.totalQuestions++;
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
      setFeedback(learnFeedbackDiv, '¡Correcto!', 'success');
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
      scheduleUITimeout(() => {
        if (isScreenActive('learning')) {
          nextLearningStep();
        }
      }, 500);
    } else {
      // Incorrecto: marcar en rojo y permitir nuevo intento
      display.classList.remove('correct');
      display.classList.add('incorrect');
      setFeedback(learnFeedbackDiv, '¡Respuesta incorrecta!', 'error');
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
    // Usar la longitud real de la lista generada: si la configuración cambia
    // a mitad de sesión, numQuestions podría superar los problemas disponibles.
    const total = learnProblems.length;
    if (learnIndex < total - 1) {
      learnIndex++;
      renderLearningProblem();
    } else {
      // Mostrar resumen y volver a la pestaña de origen tras una pausa
      setFeedback(learnFeedbackDiv, `Respuestas correctas: ${learnCorrectCount} de ${total}`);
      scheduleUITimeout(() => {
        showScreen(currentTab);
      }, 2000);
    }
  }

  /**
   * Iniciar sesión de entrenamiento.
   */
  // ----- NIVELES DE CÁLCULO MENTAL (lib/levels.js) -----
  const LEVEL_PROGRESS_KEY = 'levelProgress';
  let levelProgress = {};

  function getLevelsModule() {
    return typeof Levels !== 'undefined' && Levels ? Levels : null;
  }

  /**
   * Migración del currículo v2: la reordenación de etapas transfiere
   * cada medalla conseguida a su etapa equivalente del nuevo orden.
   * Las etapas nuevas (2 · Duplicar y partir, 3 · × un dígito) empiezan
   * vírgenes: son contenido que nunca se practicó.
   */
  const LEVEL_MIGRATION_V2 = { 0: 0, 1: 1, 2: 8, 3: 4, 4: 5, 5: 6, 6: 10, 7: 11, 8: 9, 9: 7, 10: 11, 11: 12, 12: 12 };

  function migrateLevelProgressV2(old) {
    const LevelsMod = getLevelsModule();
    const migrated = { __v2: true };
    Object.keys(old).forEach((key) => {
      const target = LEVEL_MIGRATION_V2[key];
      if (target === undefined) return;
      const entry = old[key];
      if (!entry || typeof entry !== 'object') return;
      const existing = migrated[target];
      if (!existing) {
        migrated[target] = Object.assign({}, entry);
      } else {
        // Fusiones (7+10 → 11, 11+12 → 12): se conserva lo mejor de cada una
        migrated[target] = {
          medal: LevelsMod ? LevelsMod.betterMedal(existing.medal || null, entry.medal || null) : existing.medal || entry.medal,
          bestAcc: Math.max(existing.bestAcc || 0, entry.bestAcc || 0),
          bestAvgMs:
            existing.bestAvgMs > 0 && entry.bestAvgMs > 0
              ? Math.min(existing.bestAvgMs, entry.bestAvgMs)
              : existing.bestAvgMs || entry.bestAvgMs || 0,
          attempts: (existing.attempts || 0) + (entry.attempts || 0),
          lastPlayed: Math.max(existing.lastPlayed || 0, entry.lastPlayed || 0),
        };
      }
    });
    return migrated;
  }

  function loadLevelProgress() {
    try {
      const parsed = JSON.parse(localStorage.getItem(LEVEL_PROGRESS_KEY) || 'null');
      levelProgress = parsed && typeof parsed === 'object' ? parsed : {};
      if (Object.keys(levelProgress).length > 0 && !levelProgress.__v2) {
        levelProgress = migrateLevelProgressV2(levelProgress);
        saveLevelProgress();
      } else if (!levelProgress.__v2) {
        levelProgress.__v2 = true;
      }
    } catch (err) {
      console.error('No se pudo cargar levelProgress', err);
      levelProgress = { __v2: true };
    }
  }

  function saveLevelProgress() {
    try {
      localStorage.setItem(LEVEL_PROGRESS_KEY, JSON.stringify(levelProgress));
    } catch (err) {
      console.error('No se pudo guardar levelProgress', err);
    }
  }

  const MEDAL_LABELS = { bronze: '🥉 Bronce', silver: '🥈 Plata', gold: '🥇 Oro' };

  /** Iniciar práctica de técnica o desafío de etapa reutilizando el entrenamiento. */
  function startLevelSession(levelId, kind, techniqueId = null) {
    const LevelsMod = getLevelsModule();
    if (!LevelsMod) return;
    // Tramo de dificultad según el dominio del usuario en esas habilidades
    const info = getLevelSkillsInfo();
    const skills =
      kind === 'boss'
        ? info.byLevel[levelId]
        : info.byTechnique[`${levelId}:${techniqueId}`] || info.byLevel[levelId];
    const tier = tierForSkills(skills);
    const rng = LevelsMod.createRng(Date.now() >>> 0);
    const problems =
      kind === 'boss'
        ? LevelsMod.generateBoss(levelId, rng, tier)
        : LevelsMod.generatePractice(levelId, techniqueId, 10, rng, tier);
    if (!problems.length) return;
    currentSpecificSelection = null;
    strictTrainingSession = false;
    levelSession = { levelId, kind, techniqueId, results: [] };
    configureTrainingSession(TRAINING_CONTEXT.LEVEL);
    trainProblems = problems;
    trainIndex = 0;
    trainCorrectCount = 0;
    trainTypedAnswer = '';
    trainScoreDiv.textContent = '';
    trainRestartBtn.classList.add('hidden');
    showScreen('training');
    renderTrainingProblem();
  }

  /**
   * Mostrar el botón "Siguiente paso" al terminar cualquier sesión, con
   * la acción que la brújula del camino recomiende en ese momento.
   */
  function showNextStepButton() {
    const btn = document.getElementById('train-next-btn');
    if (!btn) return;
    const action = nextPathAction();
    if (!action) {
      btn.classList.add('hidden');
      return;
    }
    btn.textContent = `▶ ${action.label}`;
    btn.classList.remove('hidden');
  }

  function hideNextStepButton() {
    const btn = document.getElementById('train-next-btn');
    if (btn) btn.classList.add('hidden');
  }

  /** Cerrar la sesión de nivel: resumen y, en el jefe, medalla y registro. */
  function finishLevelSession() {
    const LevelsMod = getLevelsModule();
    const session = levelSession;
    if (!LevelsMod || !session) return;
    if (session.kind === 'smart') {
      // Sesión inteligente: resumen del entrenador, sin medallas en juego
      const smartSummary = LevelsMod.evaluateBoss(session.results);
      const smartAcc = Math.round(smartSummary.accuracy * 100);
      const smartAvg = smartSummary.avgMs > 0 ? ` · ${(smartSummary.avgMs / 1000).toFixed(1)} s por ítem` : '';
      trainScoreDiv.textContent = `Aciertos: ${smartSummary.correct} de ${smartSummary.total} (${smartAcc}%${smartAvg})`;
      setFeedback(
        trainFeedbackDiv,
        smartAcc >= 85
          ? '💪 Sesión inteligente completada: tu entrenador está satisfecho.'
          : 'Sesión completada. Lo fallado volverá a aparecer: así se entrena.',
        smartAcc >= 85 ? 'success' : 'neutral'
      );
      trainRestartBtn.classList.remove('hidden');
      showNextStepButton();
      return;
    }
    const level = LevelsMod.getLevel(session.levelId);
    const summary = LevelsMod.evaluateBoss(session.results, level && level.criteria ? level.criteria : undefined);
    const accPct = Math.round(summary.accuracy * 100);
    const avgTxt = summary.avgMs > 0 ? ` · ${(summary.avgMs / 1000).toFixed(1)} s por ítem` : '';
    trainScoreDiv.textContent = `Aciertos: ${summary.correct} de ${summary.total} (${accPct}%${avgTxt})`;
    if (session.kind === 'boss') {
      const prev = levelProgress[session.levelId] || {};
      if (summary.medal) {
        levelProgress[session.levelId] = {
          medal: LevelsMod.betterMedal(summary.medal, prev.medal || null),
          bestAcc: Math.max(prev.bestAcc || 0, summary.accuracy),
          bestAvgMs: prev.bestAvgMs > 0 && prev.bestAvgMs < summary.avgMs ? prev.bestAvgMs : summary.avgMs,
          attempts: (prev.attempts || 0) + 1,
          lastPlayed: Date.now(),
        };
        saveLevelProgress();
        setFeedback(trainFeedbackDiv, `${MEDAL_LABELS[summary.medal]}: desafío de la etapa ${session.levelId} superado.`, 'success');
        showToast(`${MEDAL_LABELS[summary.medal]} — Etapa ${session.levelId}: ${level.title}`, 'success');
      } else {
        levelProgress[session.levelId] = Object.assign({}, prev, {
          attempts: (prev.attempts || 0) + 1,
          lastPlayed: Date.now(),
        });
        saveLevelProgress();
        setFeedback(
          trainFeedbackDiv,
          'Sin medalla esta vez: necesitas al menos un 80% de acierto. Repasa las técnicas y reinténtalo.',
          'error'
        );
      }
    } else {
      setFeedback(
        trainFeedbackDiv,
        accPct >= 90 ? '¡Técnica dominada! Atrévete con el desafío de la etapa.' : 'Buen entrenamiento: repite la técnica hasta rozar el 100%.',
        accPct >= 90 ? 'success' : 'neutral'
      );
    }
    trainRestartBtn.classList.remove('hidden');
    showNextStepButton();
  }

  // ----- EL CAMINO: recorrido oficial de 13 etapas -----
  // Etapa 0 = Cimientos (tablas, medida por el dominio de estrellas);
  // etapas 1-12 = los niveles de cálculo mental con sus medallas.

  const FOUNDATION_THRESHOLDS = { bronze: 40, silver: 70, gold: 95 };
  let selectedPathNode = null;

  /** Dominio combinado de la etapa 0: media de multiplicación y división. */
  function foundationProgress() {
    return (calculateProgress('multiplication') + calculateProgress('division')) / 2;
  }

  function foundationMedal() {
    const pct = foundationProgress();
    const computed =
      pct >= FOUNDATION_THRESHOLDS.gold
        ? 'gold'
        : pct >= FOUNDATION_THRESHOLDS.silver
          ? 'silver'
          : pct >= FOUNDATION_THRESHOLDS.bronze
            ? 'bronze'
            : null;
    // Una medalla ganada no se pierde: si el usuario amplía el rango de
    // tablas y el dominio se recalcula a la baja, la conquista se conserva.
    const stored = (levelProgress[0] && levelProgress[0].medal) || null;
    const LevelsMod = getLevelsModule();
    const best = LevelsMod ? LevelsMod.betterMedal(computed, stored) : computed || stored;
    if (best && best !== stored) {
      levelProgress[0] = Object.assign({}, levelProgress[0], { medal: best });
      saveLevelProgress();
    }
    return best || null;
  }

  /**
   * Progreso estimado dentro de una etapa (0-100): la medalla marca el
   * nivel alcanzado (🥉50 · 🥈75 · 🥇100) y, sin medalla, se estima por
   * la evidencia de técnicas ya trabajadas (hasta un 40%).
   */
  function pathStageProgress(id) {
    const state = pathNodeState(id);
    if (id === 0) {
      return Math.round(foundationProgress());
    }
    if (state.medal === 'gold') return 100;
    if (state.medal === 'silver') return 75;
    if (state.medal === 'bronze') return 50;
    if (!state.unlocked) return 0;
    const engine = getAdaptiveEngine();
    const info = getLevelSkillsInfo();
    const skills = info.byLevel[id] || [];
    if (!engine || !adaptiveState || !skills.length) return 0;
    let worked = 0;
    skills.forEach((skillId) => {
      const s = adaptiveState.skills[skillId];
      if (s && s.attempts >= 6 && engine.accuracyOf(s) >= 0.6) worked++;
    });
    return Math.round((worked / skills.length) * 40);
  }

  /** Estado de una etapa del camino (0 = cimientos, 1-12 = niveles). */
  function pathNodeState(id) {
    if (id === 0) {
      return { unlocked: true, medal: foundationMedal() };
    }
    const LevelsMod = getLevelsModule();
    const unlocked = LevelsMod ? LevelsMod.isUnlocked(id, levelProgress) : false;
    return { unlocked, medal: (levelProgress[id] && levelProgress[id].medal) || null };
  }

  /** Avance global del camino: puntos de medalla sobre el máximo (13×3). */
  function pathProgressPercent() {
    const points = { bronze: 1, silver: 2, gold: 3 };
    let total = 0;
    for (let id = 0; id <= 12; id++) {
      total += points[pathNodeState(id).medal] || 0;
    }
    return Math.round((total / 39) * 100);
  }

  /** Etapa "actual": primera desbloqueada sin medalla; si no, sin oro. */
  function currentPathNode() {
    for (let id = 0; id <= 12; id++) {
      const s = pathNodeState(id);
      if (s.unlocked && !s.medal) return id;
    }
    for (let id = 0; id <= 12; id++) {
      const s = pathNodeState(id);
      if (s.unlocked && s.medal !== 'gold') return id;
    }
    return 12;
  }

  function renderPath() {
    if (selectedPathNode === null) selectedPathNode = currentPathNode();
    renderPathSummary();
    renderPathMap();
    renderPathDetail(selectedPathNode);
  }

  function renderPathSummary() {
    const summary = document.getElementById('path-summary');
    if (!summary) return;
    summary.innerHTML = '';
    let withMedal = 0;
    for (let id = 0; id <= 12; id++) {
      if (pathNodeState(id).medal) withMedal++;
    }
    const pct = pathProgressPercent();
    const hero = document.createElement('div');
    hero.className = 'path-hero';
    const big = document.createElement('div');
    big.className = 'path-hero-pct';
    const strong = document.createElement('strong');
    strong.textContent = `${pct}%`;
    const label = document.createElement('span');
    label.textContent = 'de tu progresión';
    big.appendChild(strong);
    big.appendChild(label);
    const medals = document.createElement('div');
    medals.className = 'path-hero-medals';
    const medalsStrong = document.createElement('strong');
    medalsStrong.textContent = `🏅 ${withMedal}/13`;
    const medalsLabel = document.createElement('span');
    medalsLabel.textContent = 'etapas con medalla';
    medals.appendChild(medalsStrong);
    medals.appendChild(medalsLabel);
    hero.appendChild(big);
    hero.appendChild(medals);
    const bar = document.createElement('div');
    bar.className = 'mini-bar path-hero-bar';
    const fill = document.createElement('div');
    fill.className = 'mini-bar-fill';
    fill.style.width = `${pct}%`;
    bar.appendChild(fill);
    summary.appendChild(hero);
    summary.appendChild(bar);
  }

  function renderPathMap() {
    const map = document.getElementById('path-map');
    const LevelsMod = getLevelsModule();
    if (!map) return;
    map.innerHTML = '';
    const medalIcon = { bronze: '🥉', silver: '🥈', gold: '🥇' };
    const current = currentPathNode();
    for (let id = 0; id <= 12; id++) {
      const state = pathNodeState(id);
      const level = id === 0 ? null : LevelsMod && LevelsMod.getLevel(id);
      const node = document.createElement('button');
      node.type = 'button';
      node.className = 'path-node';
      node.setAttribute('role', 'listitem');
      if (!state.unlocked) node.classList.add('locked');
      if (state.medal) node.classList.add(`medal-${state.medal}`);
      if (id < current) node.classList.add('done');
      if (id === current) node.classList.add('current');
      if (id === selectedPathNode) node.classList.add('selected');
      // Anillo de avance alrededor del nodo (conic-gradient vía --p)
      const stagePct = state.unlocked ? pathStageProgress(id) : 0;
      node.style.setProperty('--p', String(stagePct));
      const face = document.createElement('span');
      face.className = 'path-node-face';
      const core = document.createElement('span');
      core.className = 'path-node-core';
      core.textContent = state.medal ? medalIcon[state.medal] : !state.unlocked ? '🔒' : id === 0 ? '🧮' : level ? level.emoji : '·';
      face.appendChild(core);
      const label = document.createElement('span');
      label.className = 'path-node-label';
      label.textContent = id === 0 ? 'Cimientos' : `${id}`;
      node.appendChild(face);
      node.appendChild(label);
      node.title =
        (id === 0 ? 'Etapa 0 · Cimientos: las tablas' : level ? `Etapa ${id} · ${level.title}` : `Etapa ${id}`) +
        (state.unlocked ? ` — ${stagePct}%` : ' — bloqueada');
      node.addEventListener('click', () => {
        selectedPathNode = id;
        renderPathMap();
        renderPathDetail(id);
      });
      map.appendChild(node);
    }
    // Llevar la etapa seleccionada a la vista en pantallas estrechas
    const selected = map.querySelector('.path-node.selected');
    if (selected && typeof selected.scrollIntoView === 'function') {
      selected.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
  }

  function renderPathDetail(id) {
    const detail = document.getElementById('path-detail');
    const LevelsMod = getLevelsModule();
    if (!detail) return;
    detail.innerHTML = '';
    const state = pathNodeState(id);
    const medalIcon = { bronze: '🥉 Bronce', silver: '🥈 Plata', gold: '🥇 Oro' };

    const title = document.createElement('h3');
    title.className = 'section-head';
    const medalBadge = document.createElement('span');
    medalBadge.className = 'section-badge';
    medalBadge.textContent = state.medal ? medalIcon[state.medal] : state.unlocked ? 'Sin medalla' : 'Bloqueada';

    if (id === 0) {
      title.textContent = '🧮 Etapa 0 · Cimientos: las tablas';
      title.appendChild(medalBadge);
      detail.appendChild(title);
      const desc = document.createElement('p');
      desc.className = 'section-desc';
      desc.textContent = `Multiplicaciones y divisiones automáticas: la base de todo el camino. La medalla se gana con la media de ambos dominios (🥉 ${FOUNDATION_THRESHOLDS.bronze}% · 🥈 ${FOUNDATION_THRESHOLDS.silver}% · 🥇 ${FOUNDATION_THRESHOLDS.gold}%).`;
      detail.appendChild(desc);
      // Dominio por operación: dos barras gemelas
      [
        { op: 'multiplication', label: 'Multiplicación (A × B)' },
        { op: 'division', label: 'División (A ÷ B)' },
      ].forEach(({ op, label }) => {
        const pct = Math.round(calculateProgress(op));
        const row = document.createElement('p');
        row.className = 'foundation-row';
        row.textContent = `${label}: ${pct}%`;
        const bar = document.createElement('div');
        bar.className = 'mini-bar';
        const fill = document.createElement('div');
        fill.className = 'mini-bar-fill';
        fill.style.width = `${pct}%`;
        bar.appendChild(fill);
        detail.appendChild(row);
        detail.appendChild(bar);
      });
      // Aprendizaje guiado por operación: mismo recorrido, dos frentes
      const startGuided = (op) => {
        if (getActiveOperation() !== op) {
          setActiveOperation(op);
          localStorage.setItem('config', JSON.stringify(config));
          updateHomeOperationToggle();
        }
        startLearningSession();
      };
      const learnMulBtn = document.createElement('button');
      learnMulBtn.className = 'primary-btn';
      learnMulBtn.textContent = '🎓 Aprender multiplicaciones';
      learnMulBtn.addEventListener('click', () => startGuided('multiplication'));
      const learnDivBtn = document.createElement('button');
      learnDivBtn.className = 'primary-btn';
      learnDivBtn.textContent = '🎓 Aprender divisiones';
      learnDivBtn.addEventListener('click', () => startGuided('division'));
      const tablesBtn = document.createElement('button');
      tablesBtn.className = 'primary-btn ghost-btn';
      tablesBtn.textContent = '🧮 Ver las tablas';
      tablesBtn.addEventListener('click', () => {
        showTablesScreen();
      });
      detail.appendChild(learnMulBtn);
      detail.appendChild(learnDivBtn);
      detail.appendChild(tablesBtn);
      return;
    }

    const level = LevelsMod ? LevelsMod.getLevel(id) : null;
    if (!level) return;
    title.textContent = `${level.emoji} Etapa ${id} · ${level.title}`;
    title.appendChild(medalBadge);
    detail.appendChild(title);
    const desc = document.createElement('p');
    desc.className = 'section-desc';
    desc.textContent = level.tagline;
    detail.appendChild(desc);

    // Avance de la etapa, siempre visible
    if (state.unlocked) {
      const stagePct = pathStageProgress(id);
      const progressRow = document.createElement('p');
      progressRow.className = 'foundation-row';
      progressRow.textContent = state.medal
        ? `Progreso de la etapa: ${stagePct}%${state.medal === 'gold' ? ' · ¡completada!' : ' · sube de medalla para avanzar más'}`
        : `Progreso de la etapa: ${stagePct}% · gana una medalla en el desafío para consolidarla`;
      const stageBar = document.createElement('div');
      stageBar.className = 'mini-bar';
      const stageFill = document.createElement('div');
      stageFill.className = 'mini-bar-fill';
      stageFill.style.width = `${stagePct}%`;
      stageBar.appendChild(stageFill);
      detail.appendChild(progressRow);
      detail.appendChild(stageBar);
    }

    if (!state.unlocked) {
      const note = document.createElement('p');
      note.className = 'level-note';
      note.textContent = 'Consigue una medalla en la etapa anterior para desbloquear esta.';
      detail.appendChild(note);
      return;
    }

    const list = document.createElement('div');
    list.className = 'level-techniques';
    level.techniques.forEach((tech) => {
      const row = document.createElement('div');
      row.className = 'level-tech-row';
      const mastered = tech.id !== 'blitz' && isTechniqueMastered(level.id, tech.id);
      const info = document.createElement('button');
      info.className = 'level-tech-info';
      if (mastered) info.classList.add('mastered');
      info.type = 'button';
      info.textContent = `${mastered ? '✅' : '📖'} ${tech.name}`;
      info.addEventListener('click', () => {
        openModal(tech.name, [tech.summary].concat(tech.steps), {
          actionLabel: '▶ Practicar',
          onAction: () => startLevelSession(level.id, 'practice', tech.id),
        });
      });
      const practice = document.createElement('button');
      practice.className = 'level-tech-practice';
      practice.type = 'button';
      practice.textContent = 'Practicar';
      practice.addEventListener('click', () => {
        startLevelSession(level.id, 'practice', tech.id);
      });
      row.appendChild(info);
      row.appendChild(practice);
      list.appendChild(row);
    });
    detail.appendChild(list);

    const bossBtn = document.createElement('button');
    bossBtn.className = 'level-boss-btn';
    bossBtn.type = 'button';
    bossBtn.textContent = `⚔️ Desafío de etapa (${level.bossCount} ejercicios)`;
    bossBtn.addEventListener('click', () => {
      startLevelSession(level.id, 'boss');
    });
    detail.appendChild(bossBtn);

    const criteria = document.createElement('p');
    criteria.className = 'level-criteria';
    const c = level.criteria;
    criteria.textContent = `🥇 ${Math.round(c.gold.acc * 100)}% y ≤${(c.gold.avgMs / 1000).toFixed(1)} s · 🥈 ${Math.round(c.silver.acc * 100)}% y ≤${(c.silver.avgMs / 1000).toFixed(1)} s · 🥉 ${Math.round(c.bronze.acc * 100)}%`;
    detail.appendChild(criteria);

    const progress = levelProgress[id];
    if (progress && progress.bestAcc) {
      const best = document.createElement('p');
      best.className = 'level-note';
      const bestAvg = progress.bestAvgMs > 0 ? ` · mejor ritmo ${(progress.bestAvgMs / 1000).toFixed(1)} s` : '';
      best.textContent = `Mejor marca: ${Math.round(progress.bestAcc * 100)}%${bestAvg}`;
      detail.appendChild(best);
    }
  }

  function startTrainingSession() {
    levelSession = null;
    strictTrainingSession = !!getActiveModeConfig().strict;
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
    // Los problemas de nivel y las sesiones inteligentes se responden
    // siempre con el teclado numérico (mide pensamiento, no suerte).
    const multipleChoice =
      getActiveModeConfig().multipleChoice && !problem.prompt && trainingSessionContext !== TRAINING_CONTEXT.LEVEL;
    // Mostrar progreso basado en la longitud actual de la lista de problemas
    trainProgressSpan.textContent = `${trainIndex + 1}/${trainProblems.length}`;
    if (problem.prompt) {
      trainProblemDiv.textContent = problem.prompt;
    } else if (problem.type === 'multiplication') {
      trainProblemDiv.textContent = `${problem.a} × ${problem.b} = ?`;
    } else {
      trainProblemDiv.textContent = `${problem.dividend} ÷ ${problem.divisor} = ?`;
    }
    // Los enunciados con contexto usan una tipografía más contenida
    trainProblemDiv.classList.toggle('problem-long', !!problem.prompt && problem.prompt.length > 24);

    trainQuestionStartTime = Date.now();
    applyTrainingSkipPolicy();

    setFeedback(trainFeedbackDiv, '');
    hideNextStepButton();
    // En la práctica de técnica se muestra la pista pedagógica del ejercicio;
    // en el resto, las estimaciones anuncian siempre su margen aceptado
    if (levelSession && levelSession.kind === 'practice' && problem.hint) {
      setFeedback(trainFeedbackDiv, `💡 ${problem.hint}`);
    } else if (Number.isFinite(problem.tolerance) && problem.tolerance > 0) {
      setFeedback(trainFeedbackDiv, `Estimación: se acepta un margen de ±${problem.tolerance.toLocaleString('es-ES')}`);
    }
    trainAnswerArea.innerHTML = '';
    trainTypedAnswer = '';

    // Iniciar o ocultar el temporizador según el tipo de entrenamiento
    if (isSpecificTrainingActive()) {
      // Entrenamiento específico: sin cronómetro
      if (trainTimer) {
        clearInterval(trainTimer);
        trainTimer = null;
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
    trainTotalSeconds = seconds;
    trainTimerFill.style.width = '100%';
    // Cuenta atrás basada en timestamps: no acumula deriva del setInterval
    // ni se "congela" cuando el navegador limita los intervalos en segundo plano.
    const deadline = Date.now() + seconds * 1000;
    trainTimer = setInterval(() => {
      const remainingMs = deadline - Date.now();
      const percent = (remainingMs / (trainTotalSeconds * 1000)) * 100;
      trainTimerFill.style.width = `${Math.max(0, percent)}%`;
      if (remainingMs <= 0) {
        clearInterval(trainTimer);
        trainTimer = null;
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
      mode: currentTrainingMode(),
      source: 'multiple-choice',
    });
    // Alimentar las métricas diarias también desde el entrenamiento
    updateDailyStats(isCorrect, timeTaken);
    const isSpecificContext = trainingSessionContext === TRAINING_CONTEXT.SPECIFIC;

    if (isCorrect) {
      // Correcto: marcar en verde y continuar al siguiente problema
      trainCorrectCount++;
      stats.totalCorrect++;
      btn.classList.add('correct');
      setFeedback(trainFeedbackDiv, '¡Correcto!', 'success');
      // Guardar estadísticas
      saveStats();
      // Esperar brevemente y avanzar al siguiente problema
      scheduleNextTrainingQuestion(500);
    } else {
      trainingHasMistake = true;
      if (sessionContinuesOnMistake()) {
        // El fallo no termina la sesión: se muestra la solución y se avanza
        buttons.forEach((b) => {
          const val = parseInt(b.textContent, 10);
          b.classList.add(val === correct ? 'correct' : 'incorrect');
        });
        setFeedback(trainFeedbackDiv, `La respuesta era ${correct}.`, 'error');
        saveStats();
        scheduleNextTrainingQuestion(1200);
      } else if (isSpecificContext) {
        btn.classList.add('incorrect');
        setFeedback(
          trainFeedbackDiv,
          'Respuesta incorrecta. Intenta nuevamente o usa "Mostrar respuesta".',
          'error'
        );
        saveStats();
        applyTrainingSkipPolicy();
        buttons.forEach((b) => {
          if (b === btn) {
            return;
          }
          b.disabled = false;
          b.classList.remove('incorrect');
          b.classList.remove('correct');
        });
        btn.disabled = true;
      } else {
        buttons.forEach((b) => {
          const val = parseInt(b.textContent, 10);
          if (val === correct) {
            b.classList.add('correct');
          } else {
            b.classList.add('incorrect');
          }
        });
        saveStats();
        const correctText = String(correct);
        handleTrainFail('wrong', correctText);
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
    const isCorrect = isAnswerAcceptable(currentProblem, value);
    recordProblemAttempt(currentProblem, {
      correct: isCorrect,
      timeTaken,
      skipped: false,
      mode: currentTrainingMode(),
      source: 'written',
    });
    // Alimentar las métricas diarias también desde el entrenamiento
    updateDailyStats(isCorrect, timeTaken);
    const isSpecificContext = trainingSessionContext === TRAINING_CONTEXT.SPECIFIC;

    if (isCorrect) {
      // Correcto: sumar puntaje y continuar. En estimaciones aceptadas
      // dentro del margen se muestra además el valor exacto.
      trainCorrectCount++;
      stats.totalCorrect++;
      display.classList.add('correct');
      const approxNote =
        currentProblem && currentProblem.tolerance > 0 && value !== currentProblem.answer
          ? ` Exacto: ${currentProblem.answer}.`
          : '';
      setFeedback(trainFeedbackDiv, `¡Correcto!${approxNote}`, 'success');
      saveStats();
      scheduleNextTrainingQuestion(approxNote ? 900 : 500);
    } else {
      trainingHasMistake = true;
      const correctText = String(correct);
      display.classList.add('incorrect');
      if (sessionContinuesOnMistake()) {
        display.textContent = correctText;
        setFeedback(trainFeedbackDiv, `La respuesta era ${correctText}.`, 'error');
        saveStats();
        scheduleNextTrainingQuestion(1200);
      } else if (isSpecificContext) {
        setFeedback(
          trainFeedbackDiv,
          'Respuesta incorrecta. Intenta nuevamente o usa "Mostrar respuesta".',
          'error'
        );
        saveStats();
        applyTrainingSkipPolicy();
        trainAnswerArea.querySelectorAll('button').forEach((btn) => {
          btn.disabled = false;
        });
        trainTypedAnswer = '';
        setTimeout(() => {
          display.classList.remove('incorrect');
        }, 220);
        display.textContent = '';
      } else {
        display.textContent = correctText;
        saveStats();
        handleTrainFail('wrong', correctText);
      }
    }
  }

  /**
   * Finalizar entrenamiento tras completarlo sin errores.
   */
  function handleTrainFinish() {
    if (trainTimer) {
      clearInterval(trainTimer);
      trainTimer = null;
    }
    hideTrainSkipButton();
    if (trainingSessionContext === TRAINING_CONTEXT.LEVEL && levelSession) {
      finishLevelSession();
      return;
    }
    trainScoreDiv.textContent = `Respuestas correctas: ${trainCorrectCount} de ${trainProblems.length}`;
    setFeedback(trainFeedbackDiv, '¡Sesión completada!', 'success');
    trainRestartBtn.classList.remove('hidden');
    showNextStepButton();
  }

  /**
   * Finalizar la sesión de entrenamiento debido a un fallo (respuesta incorrecta
   * o tiempo agotado). Muestra el número de respuestas correctas alcanzadas y
   * habilita el botón para reiniciar la sesión.
   */
  function endTrainingDueToError() {
    if (trainTimer) {
      clearInterval(trainTimer);
      trainTimer = null;
    }
    hideTrainSkipButton();
    // Mostrar puntuación alcanzada antes del fallo
    trainScoreDiv.textContent = `Respuestas correctas: ${trainCorrectCount} de ${trainProblems.length}`;
    // El mensaje ya se ha establecido antes de llamar a esta función
    // Aseguramos que el botón de reinicio sea visible
    trainRestartBtn.classList.remove('hidden');
    showNextStepButton();
  }

  /**
   * Manejar finalización del entrenamiento por error o tiempo.
   * @param {string} reason - 'time' o 'wrong'.
   */
  function handleTrainFail(reason, correctAnswerText = null) {
    // Manejo de fallo durante el entrenamiento: ya sea por tiempo o respuesta incorrecta.
    if (trainTimer) {
      clearInterval(trainTimer);
      trainTimer = null;
    }
    // Regla unificada: agotar el tiempo cuenta como fallo del ítem pero
    // la sesión continúa (salvo modo racha explícito).
    if (sessionContinuesOnMistake()) {
      const currentProblemTimed = trainProblems[trainIndex];
      if (currentProblemTimed && reason === 'time') {
        const timeTaken = Date.now() - trainQuestionStartTime;
        recordProblemAttempt(currentProblemTimed, {
          correct: false,
          timeTaken,
          skipped: false,
          mode: currentTrainingMode(),
          source: 'timeout',
          timedOut: true,
        });
        updateDailyStats(false, timeTaken);
        const display = trainAnswerArea.querySelector('#train-display');
        if (display) display.textContent = String(currentProblemTimed.answer);
        const options = trainAnswerArea.querySelectorAll('.answer-option');
        options.forEach((btn) => {
          if (parseInt(btn.textContent, 10) === currentProblemTimed.answer) btn.classList.add('correct');
        });
        setFeedback(trainFeedbackDiv, `¡Tiempo agotado! La respuesta era ${currentProblemTimed.answer}.`, 'error');
      }
      trainAnswerArea.querySelectorAll('button').forEach((btn) => {
        btn.disabled = true;
      });
      scheduleNextTrainingQuestion(1200);
      return;
    }
    disableTrainSkipButton();
    applyTrainingSkipPolicy();
    const currentProblem = trainProblems[trainIndex];
    // Solo registrar el intento aquí cuando el fallo es por tiempo: cuando el
    // motivo es una respuesta incorrecta, el handler que nos llamó ya lo
    // registró (antes se contaba el mismo fallo dos veces).
    if (currentProblem && reason === 'time') {
      const now = Date.now();
      const timeTaken = now - trainQuestionStartTime;
      recordProblemAttempt(currentProblem, {
        correct: false,
        timeTaken,
        skipped: false,
        mode: isSpecificTrainingActive() ? 'specific' : 'training',
        source: 'timeout',
        timedOut: true,
      });
      updateDailyStats(false, timeTaken);
    }
    // Deshabilitar botones restantes
    trainAnswerArea.querySelectorAll('button').forEach((btn) => {
      btn.disabled = true;
    });
    // Al agotarse el tiempo, revelar la respuesta correcta como feedback de aprendizaje
    if (reason === 'time' && currentProblem) {
      const correct = currentProblem.answer;
      const options = trainAnswerArea.querySelectorAll('.answer-option');
      if (options.length) {
        options.forEach((btn) => {
          if (parseInt(btn.textContent, 10) === correct) {
            btn.classList.add('correct');
          }
        });
      } else {
        const display = trainAnswerArea.querySelector('#train-display');
        if (display) {
          display.textContent = String(correct);
        }
      }
    }
    // Mostrar mensaje según el tipo de fallo
    if (reason === 'time' && currentProblem) {
      setFeedback(
        trainFeedbackDiv,
        `¡Tiempo agotado! La respuesta era ${currentProblem.answer}.`,
        'error'
      );
    } else if (reason === 'time') {
      setFeedback(trainFeedbackDiv, '¡Tiempo agotado! Sesión terminada.', 'error');
    } else if (typeof correctAnswerText === 'string' && correctAnswerText.length > 0) {
      setFeedback(
        trainFeedbackDiv,
        `¡Respuesta incorrecta! La respuesta es ${correctAnswerText}.`,
        'error'
      );
    } else {
      setFeedback(trainFeedbackDiv, '¡Respuesta incorrecta! Sesión terminada.', 'error');
    }
    // Finalizar entrenamiento completamente tras una breve pausa
    scheduleUITimeout(() => {
      if (isScreenActive('training')) {
        endTrainingDueToError();
      }
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
    levelSession = null;
    strictTrainingSession = false;
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
          // El contenedor que hace scroll es .scroll; usar la pantalla como
          // root hacía que todas las tarjetas "intersectaran" a la vez y el
          // renderizado perezoso no aplazara nada.
          root: scrollContainer || null,
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
    // Cargar el estado del motor adaptativo
    loadAdaptiveState();
    // Cargar el progreso de niveles
    loadLevelProgress();
    // Registrar las etiquetas de las habilidades de nivel en el motor
    // adaptativo, para que el análisis las muestre con nombre legible.
    const engineForLabels = getAdaptiveEngine();
    const levelsForLabels = getLevelsModule();
    if (engineForLabels && levelsForLabels && levelsForLabels.SKILL_META) {
      Object.keys(levelsForLabels.SKILL_META).forEach((id) => {
        engineForLabels.registerSkill(id, levelsForLabels.SKILL_META[id]);
      });
    }
    updateProgressBar();
    // Barra de pestañas: navegación principal
    document.querySelectorAll('#tab-bar .tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.dataset.tab;
        if (tab === 'analysis') {
          showProgressScreen();
        } else {
          showScreen(tab);
        }
      });
    });
    // Sesión inteligente (Inicio y Entrenar)
    ['smart-session-btn', 'smart-session-btn-train'].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          startSmartSession();
        });
      }
    });
    if (homeLearnBtn) {
      homeLearnBtn.addEventListener('click', () => {
        startLearningSession();
      });
    }
    if (homeErrorsBtn) {
      homeErrorsBtn.addEventListener('click', () => {
        startErrorsSession();
      });
    }
    if (homeTablesBtn) {
      homeTablesBtn.addEventListener('click', () => {
        showTablesScreen();
      });
    }
    // Conmutador ×/÷ del mapa de calor en Análisis (solo cambia la vista)
    const analysisOpMul = document.getElementById('analysis-op-mul');
    const analysisOpDiv = document.getElementById('analysis-op-div');
    if (analysisOpMul) {
      analysisOpMul.addEventListener('click', () => {
        analysisViewOperation = 'multiplication';
        updateAnalysisOpToggle();
        buildHeatmap();
      });
    }
    if (analysisOpDiv) {
      analysisOpDiv.addEventListener('click', () => {
        analysisViewOperation = 'division';
        updateAnalysisOpToggle();
        buildHeatmap();
      });
    }
    // Continuar el camino: un toque y directo a la acción que toca
    const continuePathBtn = document.getElementById('continue-path-btn');
    if (continuePathBtn) {
      continuePathBtn.addEventListener('click', () => {
        const action = nextPathAction();
        selectedPathNode = currentPathNode();
        if (action) {
          action.run();
        } else {
          showScreen('learn');
        }
      });
    }
    // "Siguiente paso" tras cada sesión: continuidad sin navegar
    const trainNextBtn = document.getElementById('train-next-btn');
    if (trainNextBtn) {
      trainNextBtn.addEventListener('click', () => {
        const action = nextPathAction();
        if (action) {
          action.run();
        } else {
          showScreen('learn');
        }
      });
    }
    // Constructor de sesiones: guarda la configuración y arranca
    const builderStartBtn = document.getElementById('builder-start-btn');
    if (builderStartBtn) {
      builderStartBtn.addEventListener('click', () => {
        if (saveConfig()) {
          startTrainingSession();
        }
      });
    }
    // Ajustes de personalización en Perfil
    const dailyGoalInput = document.getElementById('setting-daily-goal');
    if (dailyGoalInput) {
      dailyGoalInput.addEventListener('change', () => {
        config.dailyGoal = normalizeDailyGoal(dailyGoalInput.value);
        dailyGoalInput.value = config.dailyGoal;
        localStorage.setItem('config', JSON.stringify(config));
        showToast(`Meta diaria: ${config.dailyGoal} ejercicios`, 'success');
      });
    }
    const tableMaxSelect = document.getElementById('setting-table-max');
    if (tableMaxSelect) {
      tableMaxSelect.addEventListener('change', () => {
        const value = Math.min(TABLE_MAX_LIMIT, Math.max(5, parseInt(tableMaxSelect.value, 10) || 10));
        // Se aplica a ambos modos; el progreso previo nunca se borra:
        // al reducir el rango, las estrellas fuera de él quedan guardadas.
        getModeConfig('multiplication').max = value;
        getModeConfig('division').max = value;
        localStorage.setItem('config', JSON.stringify(config));
        fillConfigInputs(getActiveOperation());
        updateProgressBar();
        renderProfile();
        showToast(`Practicarás hasta la tabla del ${value}`, 'success');
      });
    }

    operationRadios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (radio.checked) {
          fillConfigInputs(radio.value);
        }
      });
    });

    // Conmutador de operación del constructor (cambia el modo global)
    if (homeOpMulBtn) {
      homeOpMulBtn.addEventListener('click', () => {
        setActiveOperation('multiplication');
        localStorage.setItem('config', JSON.stringify(config));
        updateHomeOperationToggle();
        fillConfigInputs('multiplication');
        updateProgressBar();
      });
    }
    if (homeOpDivBtn) {
      homeOpDivBtn.addEventListener('click', () => {
        setActiveOperation('division');
        localStorage.setItem('config', JSON.stringify(config));
        updateHomeOperationToggle();
        fillConfigInputs('division');
        updateProgressBar();
      });
    }

    // Reiniciar progreso
    resetProgressBtn.addEventListener('click', () => {
      // Mostrar confirmación antes de eliminar todo el progreso
      const confirmed = window.confirm('¿Estás seguro de que deseas eliminar todo tu progreso?');
      if (!confirmed) return;
      // Restablecer TODO el progreso: estadísticas, estrellas, repaso,
      // errores, medallas del camino, motor adaptativo y métricas del día.
      // La configuración personal (metas, rangos) se conserva.
      stats = Object.assign({}, defaultStats);
      stars = {};
      dueTimes = {};
      intervalStages = {};
      errorsToday = {};
      masteryMap = {};
      levelProgress = {};
      selectedPathNode = null;
      const engineForReset = getAdaptiveEngine();
      adaptiveState = engineForReset ? engineForReset.createState() : null;
      dailyStats = {
        date: getTodayDate(),
        totalQuestions: 0,
        totalCorrect: 0,
        totalTime: 0,
        streakCurrent: 0,
        streakMax: 0,
      };
      saveStats();
      saveStars();
      saveDueTimes();
      saveIntervalStages();
      saveErrors();
      saveMastery();
      saveLevelProgress();
      saveDailyStats();
      if (adaptiveState) {
        saveAdaptiveState();
      } else {
        localStorage.removeItem(ADAPTIVE_STORAGE_KEY);
      }
      updateProgressBar();
      updateErrorsBadge();
      scheduleAssistantPanelRefresh();
      renderProfile();
      showToast('Progreso eliminado por completo', 'success');
    });
    // Botones de salida del modo enfoque: vuelven a la pestaña de origen
    learnBackBtn.addEventListener('click', () => {
      if (trainTimer) {
        clearInterval(trainTimer);
      }
      showScreen(currentTab);
    });
    trainBackBtn.addEventListener('click', () => {
      if (trainTimer) {
        clearInterval(trainTimer);
      }
      showScreen(currentTab);
    });
    tablesBackBtn.addEventListener('click', () => {
      showScreen('learn');
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
        setFeedback(learnFeedbackDiv, `La respuesta era ${correct}`, 'error');
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
        stats.totalQuestions++;
        recordProblemAttempt(problem, {
          correct: false,
          timeTaken: skipTimeTaken,
          skipped: true,
          mode: 'learning',
          source: 'skip',
        });
        saveStats();
        // Ocultar el botón de salto para evitar múltiples clics
        learnSkipBtn.style.display = 'none';
        // Avanzar después de un breve retraso para dar tiempo a leer la respuesta
        scheduleUITimeout(() => {
          if (isScreenActive('learning')) {
            nextLearningStep();
          }
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
        updateDailyStats(false, timeTaken);
        setFeedback(trainFeedbackDiv, `La respuesta era ${correct}.`, 'error');
        saveStats();
        scheduleNextTrainingQuestion(1000);
      });
    }
    // Reiniciar entrenamiento
    trainRestartBtn.addEventListener('click', () => {
      // Reiniciar según el tipo de sesión: inteligente, nivel, específica o aleatoria
      if (trainingSessionContext === TRAINING_CONTEXT.LEVEL && levelSession && levelSession.kind === 'smart') {
        startSmartSession();
      } else if (trainingSessionContext === TRAINING_CONTEXT.LEVEL && levelSession) {
        startLevelSession(levelSession.levelId, levelSession.kind, levelSession.techniqueId);
      } else if (isSpecificTrainingActive()) {
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
          showToast('Selecciona al menos una tabla y un número para entrenar.', 'error');
          return;
        }
        startSpecificTrainingSession(selectedProblems);
      });
    }

    // Botones de ayuda y consejos en la pantalla de inicio
    const helpBtn = document.getElementById('help-btn');
    const tipsBtn = document.getElementById('tips-btn');
    if (helpBtn) {
      helpBtn.addEventListener('click', () => {
        openModal('¿Cómo funciona?', HELP_ITEMS);
      });
    }
    if (tipsBtn) {
      tipsBtn.addEventListener('click', () => {
        openModal('Consejos para aprender', TIPS_ITEMS);
      });
    }
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', closeModal);
      const modalActionBtn = document.getElementById('modal-action-btn');
      if (modalActionBtn) {
        modalActionBtn.addEventListener('click', () => {
          const run = modalAction;
          closeModal();
          if (run) run();
        });
      }
    }
    if (appModal) {
      // Cerrar al pulsar el fondo oscurecido (no la tarjeta)
      appModal.addEventListener('click', (event) => {
        if (event.target === appModal) {
          closeModal();
        }
      });
    }

    // Soporte de teclado físico (escritorio y tablets con teclado):
    // dígitos para escribir, Enter para enviar, Backspace para borrar y
    // 1-4 para elegir opción en el modo de opciones múltiples.
    document.addEventListener('keydown', (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      if (isModalOpen()) {
        if (event.key === 'Escape') {
          closeModal();
        }
        return;
      }
      const mode = isScreenActive('learning')
        ? 'learning'
        : isScreenActive('training')
          ? 'training'
          : null;
      if (!mode) return;
      const area = mode === 'learning' ? learnAnswerArea : trainAnswerArea;
      if (!area) return;
      const key = event.key;
      if (/^[0-9]$/.test(key)) {
        const options = area.querySelectorAll('.answer-option');
        if (options.length) {
          const idx = parseInt(key, 10) - 1;
          if (idx >= 0 && idx < options.length && !options[idx].disabled) {
            options[idx].click();
          }
          return;
        }
        const numButtons = area.querySelectorAll('.num-btn:not(.delete-btn):not(.submit-btn)');
        for (const btn of numButtons) {
          if (btn.textContent === key && !btn.disabled) {
            btn.click();
            break;
          }
        }
      } else if (key === 'Backspace') {
        const del = area.querySelector('.delete-btn');
        if (del && !del.disabled) {
          event.preventDefault();
          del.click();
        }
      } else if (key === 'Enter') {
        const submit = area.querySelector('.submit-btn');
        if (submit && !submit.disabled) {
          event.preventDefault();
          submit.click();
        }
      }
    });

    updateErrorsBadge();
    // Mostrar pantalla de inicio
    showScreen('home');
  }

  init();

  // Registrar el service worker para funcionamiento offline e instalación
  // como PWA. El archivo sw.js existía pero nunca se registraba, por lo que
  // la aplicación no tenía soporte offline real.
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch((err) => {
        console.error('No se pudo registrar el service worker', err);
      });
    });
  }
});
