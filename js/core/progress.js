/* =========================================================================
   progress.js — nivel, experiencia, logros y bonus diario.
   Escucha al banco: no duplica contabilidad, sólo reacciona a ella.
   ========================================================================= */
(function (root) {
  'use strict';
  var U = root.Casino.util;
  var store = root.Casino.store;
  var bank = root.Casino.bank;
  var ui = root.Casino.ui;
  var fx = root.Casino.fx;
  var audio = root.Casino.audio;

  var bus = U.emitter();

  /* --------------------------------- NIVEL --------------------------------- */

  /** XP necesaria para pasar del nivel L al L+1. */
  function xpForLevel(level) {
    return Math.round(200 * Math.pow(level, 1.25));
  }

  function levelInfo() {
    var s = store.state;
    var need = xpForLevel(s.level);
    return {
      level: s.level,
      xp: s.xp,
      need: need,
      pct: U.clamp(s.xp / need, 0, 1),
      title: levelTitle(s.level)
    };
  }

  var TITLES = [
    [1, 'Novato'], [3, 'Aficionado'], [6, 'Jugador'], [10, 'Habitual'],
    [15, 'Tiburón'], [22, 'Veterano'], [30, 'Profesional'], [40, 'Leyenda'],
    [55, 'Ballena'], [70, 'Magnate']
  ];

  function levelTitle(level) {
    var t = TITLES[0][1];
    for (var i = 0; i < TITLES.length; i++) {
      if (level >= TITLES[i][0]) t = TITLES[i][1];
    }
    return t;
  }

  /** Suma XP y gestiona subidas de nivel (con recompensa). */
  function addXp(amount) {
    if (!(amount > 0)) return;
    var s = store.state;
    s.xp += Math.round(amount);
    var leveled = 0;
    while (s.xp >= xpForLevel(s.level)) {
      s.xp -= xpForLevel(s.level);
      s.level++;
      leveled++;
      if (leveled > 50) break; // salvaguarda
    }
    if (leveled > 0) {
      var reward = 0;
      for (var i = 0; i < leveled; i++) reward += 100 * (s.level - i);
      bank.credit(reward, 'levelup');
      audio.play('levelUp');
      fx.confetti(0.7);
      ui.toast('¡Nivel ' + s.level + ' — ' + levelTitle(s.level) + '! +' + U.money(reward),
               { type: 'win', icon: '⭐', ms: 3600 });
      bus.emit('levelup', { level: s.level, reward: reward });
    }
    store.save();
    bus.emit('xp', levelInfo());
  }

  /* -------------------------------- LOGROS -------------------------------- */

  var ACHIEVEMENTS = [
    { id: 'first_bet',   icon: '🎲', name: 'Primera apuesta',    desc: 'Juega tu primera ronda.',                      reward: 50 },
    { id: 'rounds_50',   icon: '🔁', name: 'Calentando',         desc: 'Juega 50 rondas.',                             reward: 150 },
    { id: 'rounds_250',  icon: '🏭', name: 'Maquinista',         desc: 'Juega 250 rondas.',                            reward: 500 },
    { id: 'rounds_1000', icon: '♾️', name: 'Sin descanso',       desc: 'Juega 1.000 rondas.',                          reward: 2000 },
    { id: 'win_100',     icon: '💵', name: 'Buen golpe',         desc: 'Gana 100 € netos en una sola ronda.',          reward: 100 },
    { id: 'win_1000',    icon: '💰', name: 'Golpe maestro',      desc: 'Gana 1.000 € netos en una sola ronda.',        reward: 750 },
    { id: 'win_10000',   icon: '🏦', name: 'Atraco perfecto',    desc: 'Gana 10.000 € netos en una sola ronda.',       reward: 3000 },
    { id: 'mult_10',     icon: '✖️', name: 'Multiplicador x10',  desc: 'Consigue un retorno de 10× la apuesta.',       reward: 250 },
    { id: 'mult_50',     icon: '🚀', name: 'Multiplicador x50',  desc: 'Consigue un retorno de 50× la apuesta.',       reward: 1000 },
    { id: 'mult_200',    icon: '☄️', name: 'Multiplicador x200', desc: 'Consigue un retorno de 200× la apuesta.',      reward: 5000 },
    { id: 'balance_5k',  icon: '📈', name: 'Cinco mil',          desc: 'Alcanza 5.000 € de saldo.',                    reward: 300 },
    { id: 'balance_25k', icon: '👑', name: 'Veinticinco mil',    desc: 'Alcanza 25.000 € de saldo.',                   reward: 1500 },
    { id: 'balance_100k',icon: '🏝️', name: 'Seis cifras',        desc: 'Alcanza 100.000 € de saldo.',                  reward: 7500 },
    { id: 'try_all',     icon: '🗺️', name: 'Turista',            desc: 'Prueba todas las máquinas del casino.',        reward: 1000 },
    { id: 'jackpot',     icon: '🎰', name: '¡JACKPOT!',          desc: 'Consigue el bote máximo en las tragaperras.',  reward: 2500 },
    { id: 'blackjack',   icon: '🃏', name: 'Blackjack natural',  desc: 'Consigue un blackjack servido.',               reward: 200 },
    { id: 'royal',       icon: '♠️', name: 'Escalera real',      desc: 'Consigue una escalera de color real al póker.', reward: 5000 },
    { id: 'crash_10x',   icon: '📊', name: 'Nervios de acero',   desc: 'Retírate en Crash por encima de 10×.',         reward: 750 },
    { id: 'mines_clear', icon: '💎', name: 'Pulso firme',        desc: 'Descubre 15 gemas en una partida de Minas.',    reward: 1200 },
    { id: 'roulette_0',  icon: '🟢', name: 'El cero paga',       desc: 'Acierta el cero a pleno en la ruleta.',        reward: 800 },
    { id: 'bonus_7',     icon: '📅', name: 'Cliente fiel',       desc: 'Reclama el bonus diario 7 días seguidos.',     reward: 2000 },
    { id: 'comeback',    icon: '🔥', name: 'Remontada',          desc: 'Vuelve a 2.000 € tras caer por debajo de 50 €.', reward: 500 }
  ];

  var BY_ID = {};
  ACHIEVEMENTS.forEach(function (a) { BY_ID[a.id] = a; });

  function unlocked(id) {
    return !!store.state.achievements[id];
  }

  /** Desbloquea un logro (idempotente) y paga su recompensa. */
  function unlock(id) {
    if (unlocked(id)) return false;
    var a = BY_ID[id];
    if (!a) return false;
    store.state.achievements[id] = Date.now();
    if (a.reward) bank.credit(a.reward, 'achievement:' + id);
    store.save();
    audio.play('achievement');
    fx.confetti(0.5);
    ui.toast('Logro: ' + a.name + (a.reward ? '  +' + U.money(a.reward) : ''),
             { type: 'win', icon: a.icon, ms: 3800 });
    bus.emit('achievement', a);
    return true;
  }

  /** Cuántas máquinas distintas se han probado. */
  function gamesTried() {
    return Object.keys(store.state.games).filter(function (g) {
      return store.state.games[g].rounds > 0;
    }).length;
  }

  var sawLowBalance = false;

  /** Reglas que se evalúan después de cada ronda. */
  function evaluate(result) {
    var s = store.state;
    var T = s.totals;

    unlock('first_bet');
    if (T.rounds >= 50) unlock('rounds_50');
    if (T.rounds >= 250) unlock('rounds_250');
    if (T.rounds >= 1000) unlock('rounds_1000');

    if (result) {
      if (result.net >= 100) unlock('win_100');
      if (result.net >= 1000) unlock('win_1000');
      if (result.net >= 10000) unlock('win_10000');
      if (result.multiplier >= 10) unlock('mult_10');
      if (result.multiplier >= 50) unlock('mult_50');
      if (result.multiplier >= 200) unlock('mult_200');
    }

    var bal = bank.balance;
    if (bal >= 5000) unlock('balance_5k');
    if (bal >= 25000) unlock('balance_25k');
    if (bal >= 100000) unlock('balance_100k');

    if (bal < 50) sawLowBalance = true;
    if (sawLowBalance && bal >= 2000) unlock('comeback');

    var total = root.Casino.engine ? root.Casino.engine.count() : 0;
    if (total > 0 && gamesTried() >= total) unlock('try_all');
  }

  /* ----------------------------- BONUS DIARIO ----------------------------- */

  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function yesterdayKey() {
    var d = new Date(Date.now() - 86400000);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' +
           String(d.getDate()).padStart(2, '0');
  }

  function bonusAvailable() {
    return store.state.lastBonusDay !== todayKey();
  }

  /** Importe del bonus según la racha (tope a 7 días). */
  function bonusAmount() {
    var s = store.state;
    var streak = s.lastBonusDay === yesterdayKey() ? Math.min(s.bonusStreak + 1, 7) : 1;
    return { streak: streak, amount: 250 * streak };
  }

  function claimBonus() {
    if (!bonusAvailable()) return null;
    var s = store.state;
    var info = bonusAmount();
    s.bonusStreak = info.streak;
    s.lastBonusDay = todayKey();
    bank.credit(info.amount, 'dailybonus');
    store.save();
    if (info.streak >= 7) unlock('bonus_7');
    audio.play('cashout');
    fx.coinRain(1400);
    fx.confetti(0.8);
    bus.emit('bonus', info);
    return info;
  }

  /* -------------------------- RESCATE (sin saldo) -------------------------- */

  var RESCUE_AMOUNT = 500;

  function needsRescue() {
    return bank.balance < 0.5;
  }

  function rescue() {
    if (!needsRescue()) return false;
    store.state.rescues++;
    bank.credit(RESCUE_AMOUNT, 'rescue');
    store.save();
    audio.play('coin');
    ui.toast('La casa te presta ' + U.money(RESCUE_AMOUNT) + ' para seguir jugando.',
             { type: 'info', icon: '🤝', ms: 3400 });
    bus.emit('rescue', { amount: RESCUE_AMOUNT });
    return true;
  }

  /* ------------------------------------------------------------------------ */

  function init() {
    bank.on('round:settle', function (result) {
      // 1 XP por cada euro apostado, mínimo 1; extra al ganar.
      var xp = Math.max(1, Math.round(result.stake));
      if (result.outcome === 'win') xp += Math.round(Math.min(result.net, result.stake * 10) * 0.5);
      addXp(xp);
      evaluate(result);
    });
    bank.on('change', function () {
      if (bank.balance < 50) sawLowBalance = true;
    });
  }

  root.Casino.progress = {
    init: init,
    addXp: addXp, levelInfo: levelInfo, xpForLevel: xpForLevel, levelTitle: levelTitle,
    ACHIEVEMENTS: ACHIEVEMENTS, byId: function (id) { return BY_ID[id]; },
    unlock: unlock, unlocked: unlocked, evaluate: evaluate, gamesTried: gamesTried,
    bonusAvailable: bonusAvailable, bonusAmount: bonusAmount, claimBonus: claimBonus,
    needsRescue: needsRescue, rescue: rescue, RESCUE_AMOUNT: RESCUE_AMOUNT,
    on: bus.on.bind(bus), off: bus.off.bind(bus)
  };
})(typeof window !== 'undefined' ? window : globalThis);
