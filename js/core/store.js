/* =========================================================================
   store.js — estado persistente del jugador
   Toda cantidad monetaria se guarda en CÉNTIMOS ENTEROS.
   ========================================================================= */
(function (root) {
  'use strict';
  var U = root.Casino.util;

  var KEY = 'casino.save.v1';
  var SCHEMA = 1;
  var START_BALANCE_CENTS = 100000; // 1.000,00 €

  function defaultState() {
    return {
      schema: SCHEMA,
      balanceCents: START_BALANCE_CENTS,
      createdAt: Date.now(),
      xp: 0,
      level: 1,
      lastBonusDay: null,
      bonusStreak: 0,
      rescues: 0,
      settings: {
        sound: true,
        music: false,
        volume: 0.6,
        animations: true,
        fastMode: false,
        confetti: true
      },
      totals: {
        wageredCents: 0,
        returnedCents: 0,
        rounds: 0,
        wins: 0,
        losses: 0,
        pushes: 0,
        biggestWinCents: 0,
        biggestMultiplier: 0,
        peakBalanceCents: START_BALANCE_CENTS
      },
      games: {},        // gameId -> {rounds, wageredCents, returnedCents, wins, losses, pushes, biggestWinCents}
      achievements: {}, // id -> timestamp de desbloqueo
      lastGame: null
    };
  }

  function blankGameStats() {
    return {
      rounds: 0, wageredCents: 0, returnedCents: 0,
      wins: 0, losses: 0, pushes: 0, biggestWinCents: 0
    };
  }

  var state = defaultState();
  var bus = U.emitter();
  var saveTimer = null;
  var storageOk = true;

  /** Mezcla defensiva: rellena claves que falten en saves antiguos. */
  function hydrate(loaded) {
    var base = defaultState();
    if (!loaded || typeof loaded !== 'object') return base;
    var out = base;
    // Sólo copiamos claves conocidas y con el tipo esperado.
    if (Number.isFinite(loaded.balanceCents)) out.balanceCents = Math.max(0, Math.round(loaded.balanceCents));
    if (Number.isFinite(loaded.xp)) out.xp = Math.max(0, Math.round(loaded.xp));
    if (Number.isFinite(loaded.level)) out.level = Math.max(1, Math.round(loaded.level));
    if (Number.isFinite(loaded.createdAt)) out.createdAt = loaded.createdAt;
    if (Number.isFinite(loaded.rescues)) out.rescues = loaded.rescues;
    if (Number.isFinite(loaded.bonusStreak)) out.bonusStreak = loaded.bonusStreak;
    if (typeof loaded.lastBonusDay === 'string') out.lastBonusDay = loaded.lastBonusDay;
    if (typeof loaded.lastGame === 'string') out.lastGame = loaded.lastGame;
    if (loaded.settings) {
      Object.keys(out.settings).forEach(function (k) {
        if (typeof loaded.settings[k] === typeof out.settings[k]) out.settings[k] = loaded.settings[k];
      });
    }
    if (loaded.totals) {
      Object.keys(out.totals).forEach(function (k) {
        if (Number.isFinite(loaded.totals[k])) out.totals[k] = loaded.totals[k];
      });
    }
    if (loaded.games && typeof loaded.games === 'object') {
      Object.keys(loaded.games).forEach(function (g) {
        var src = loaded.games[g];
        if (!src || typeof src !== 'object') return;
        var dst = blankGameStats();
        Object.keys(dst).forEach(function (k) {
          if (Number.isFinite(src[k])) dst[k] = src[k];
        });
        out.games[g] = dst;
      });
    }
    if (loaded.achievements && typeof loaded.achievements === 'object') {
      Object.keys(loaded.achievements).forEach(function (a) {
        if (Number.isFinite(loaded.achievements[a])) out.achievements[a] = loaded.achievements[a];
      });
    }
    return out;
  }

  function load() {
    try {
      var raw = root.localStorage && root.localStorage.getItem(KEY);
      state = hydrate(raw ? JSON.parse(raw) : null);
    } catch (e) {
      storageOk = false;
      state = defaultState();
      console.warn('No se pudo leer la partida guardada; empezando de cero.', e);
    }
    bus.emit('load', state);
    return state;
  }

  function saveNow() {
    if (!storageOk) return;
    try {
      root.localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      storageOk = false;
      console.warn('No se pudo guardar la partida (almacenamiento no disponible).', e);
    }
  }

  /** Guardado diferido: agrupa escrituras durante ráfagas de juego. */
  function save() {
    if (saveTimer) return;
    saveTimer = root.setTimeout(function () {
      saveTimer = null;
      saveNow();
    }, 400);
  }

  function gameStats(gameId) {
    if (!state.games[gameId]) state.games[gameId] = blankGameStats();
    return state.games[gameId];
  }

  function reset() {
    state = defaultState();
    saveNow();
    bus.emit('reset', state);
    bus.emit('change', state);
  }

  root.Casino.store = {
    SCHEMA: SCHEMA,
    START_BALANCE_CENTS: START_BALANCE_CENTS,
    get state() { return state; },
    load: load,
    save: save,
    saveNow: saveNow,
    reset: reset,
    gameStats: gameStats,
    blankGameStats: blankGameStats,
    defaultState: defaultState,
    /** Sustituye el estado entero (usado por los tests). */
    _replace: function (s) { state = hydrate(s); },
    get storageOk() { return storageOk; },
    on: bus.on.bind(bus),
    off: bus.off.bind(bus),
    emit: bus.emit.bind(bus)
  };
})(typeof window !== 'undefined' ? window : globalThis);
