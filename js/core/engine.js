/* =========================================================================
   engine.js — registro de máquinas y ciclo de vida.

   Cada juego se declara con engine.register({...}) y recibe un "ctx" con
   el escenario ya montado y utilidades comunes. Dos piezas clave para que
   no haya bugs ni tirones:

     ctx.guard(fn)  envuelve una acción asíncrona de forma que:
                      · no puede reentrar (doble clic = una sola jugada)
                      · bloquea la apuesta mientras dura
                      · libera SIEMPRE, incluso si la acción lanza error
     ctx.open(stake) abre la ronda en el banco y avisa si no hay saldo.
   ========================================================================= */
(function (root) {
  'use strict';
  var U = root.Casino.util;
  var bank = root.Casino.bank;
  var ui = root.Casino.ui;
  var fx = root.Casino.fx;
  var audio = root.Casino.audio;
  var store = root.Casino.store;
  var el = U.el;

  var games = [];
  var byId = {};
  var active = null;

  function register(def) {
    if (!def || !def.id) throw new Error('El juego necesita un id.');
    if (byId[def.id]) throw new Error('Juego duplicado: ' + def.id);
    var game = Object.assign({
      name: def.id,
      icon: '🎲',
      tagline: '',
      desc: '',
      accent: '#f5c451',
      minBet: 0.5,
      maxBet: 500,
      rtp: null,
      howTo: [],
      tags: []
    }, def);
    games.push(game);
    byId[def.id] = game;
    return game;
  }

  function list() { return games.slice(); }
  function get(id) { return byId[id] || null; }
  function count() { return games.length; }

  /* --------------------------- montaje de un juego --------------------------- */

  /**
   * Construye el marco estándar y llama a game.create(ctx).
   * Devuelve un handle con destroy() para que el router limpie bien.
   */
  function mount(gameId, host) {
    var game = byId[gameId];
    if (!game) throw new Error('Juego desconocido: ' + gameId);
    unmount();

    var stage = el('.stage', { 'data-game': game.id });
    var controls = el('.controls');
    var side = el('.side');
    var infoHost = el('.game__info');

    var betCtl = null;
    if (game.useBet !== false) {
      betCtl = ui.betControl({
        min: game.minBet,
        max: game.maxBet,
        value: suggestedBet(game),
        gameId: game.id
      });
    }

    var busy = false;
    var busyNodes = [];

    function setBusy(on) {
      busy = !!on;
      if (betCtl) betCtl.setEnabled(!busy);
      stage.classList.toggle('is-busy', busy);
      busyNodes.forEach(function (n) {
        n.disabled = busy;
        n.classList.toggle('is-disabled', busy);
      });
    }

    /**
     * Envoltorio anti-reentrada. Devuelve una función que, al invocarse
     * mientras la anterior sigue en marcha, no hace nada.
     */
    function guard(fn) {
      return function () {
        if (busy) return Promise.resolve(undefined);
        var args = arguments;
        setBusy(true);
        var out;
        try {
          out = fn.apply(null, args);
        } catch (err) {
          setBusy(false);
          reportError(err);
          return Promise.reject(err);
        }
        return Promise.resolve(out)
          .then(function (v) { setBusy(false); return v; })
          .catch(function (err) {
            setBusy(false);
            reportError(err);
          });
      };
    }

    function reportError(err) {
      console.error('[' + game.id + ']', err);
      if (err && err.name === 'BankError') {
        if (err.code === 'INSUFFICIENT_FUNDS') {
          ui.notEnough(err.detail ? U.fromCents(err.detail.need) : 0);
          return;
        }
        ui.toast(err.message, { type: 'warn', icon: '⚠️' });
        return;
      }
      ui.toast('Algo ha salido mal en la máquina; la apuesta se ha devuelto.',
               { type: 'error', icon: '🛠️' });
    }

    /**
     * Abre una ronda. Si no hay saldo devuelve null tras avisar, así el
     * juego puede salir limpio sin tocar nada.
     */
    function open(stake) {
      var amount = stake === undefined ? (betCtl ? betCtl.get() : game.minBet) : stake;
      if (!bank.canAfford(amount)) {
        ui.notEnough(amount);
        return null;
      }
      // Ronda huérfana por un error previo: la devolvemos antes de seguir.
      var stale = bank.getOpenRound(game.id);
      if (stale) {
        console.warn('Ronda huérfana en ' + game.id + '; se devuelve la apuesta.');
        stale.cancel();
      }
      try {
        return bank.openRound(game.id, amount);
      } catch (err) {
        reportError(err);
        return null;
      }
    }

    /** Feedback estándar al liquidar. */
    function celebrate(result, target) {
      if (!result) return;
      if (result.outcome === 'win') {
        fx.celebrate(result.multiplier, target || stage);
        fx.floatText(target || stage, '+' + U.money(result.net), { big: result.multiplier >= 8 });
      } else if (result.outcome === 'push') {
        audio.play('push');
        fx.floatText(target || stage, 'Empate', {});
      } else {
        audio.play('lose');
        fx.floatText(target || stage, '−' + U.money(result.stake), { negative: true });
      }
    }

    var ctx = {
      game: game,
      id: game.id,
      stage: stage,
      controls: controls,
      side: side,
      bet: betCtl,
      rng: U.createRng(),
      guard: guard,
      open: open,
      setBusy: setBusy,
      get busy() { return busy; },
      /** Registra botones que deben bloquearse durante una jugada. */
      lockDuringPlay: function () {
        Array.prototype.forEach.call(arguments, function (n) {
          if (n) busyNodes.push(n);
        });
      },
      celebrate: celebrate,
      toast: ui.toast,
      modal: ui.modal,
      button: ui.button,
      table: ui.table,
      play: audio.play,
      fx: fx,
      el: el,
      money: U.money,
      /** Contenido del panel de información/pagos. */
      setInfo: function (node) {
        U.clear(infoHost);
        infoHost.appendChild(ui.infoPanel('Reglas y pagos', node));
      },
      /** Espera que respeta el modo rápido y "reducir movimiento". */
      wait: function (ms) {
        if (fx.reduced) return U.sleep(Math.min(ms, 40));
        if (store.state.settings.fastMode) return U.sleep(ms * 0.45);
        return U.sleep(ms);
      },
      /** Escala una duración igual que wait(). */
      dur: function (ms) {
        if (fx.reduced) return 1;
        return store.state.settings.fastMode ? Math.round(ms * 0.45) : ms;
      }
    };

    /* ---- estructura visual común a todas las máquinas ---- */
    var header = el('.game__head', {}, [
      el('.game__ident', {}, [
        el('span.game__icon', { text: game.icon, 'aria-hidden': 'true' }),
        el('.game__titles', {}, [
          el('h1.game__name', { text: game.name }),
          el('p.game__tagline', { text: game.tagline })
        ])
      ]),
      el('.game__meta', {}, [
        game.rtp ? el('span.tag.tag--rtp', { text: 'RTP ' + game.rtp + '%', title: 'Retorno teórico al jugador' }) : null,
        el('span.tag', { text: U.money(game.minBet) + ' – ' + U.money(game.maxBet) })
      ])
    ]);

    var layout = el('.game', { 'data-game': game.id, style: { '--accent': game.accent } }, [
      header,
      el('.game__body', {}, [
        el('.game__main', {}, [stage, controls]),
        side
      ]),
      infoHost
    ]);

    host.appendChild(layout);

    var instance = null;
    try {
      instance = game.create(ctx) || {};
    } catch (err) {
      console.error('No se pudo iniciar ' + game.id, err);
      U.clear(host);
      host.appendChild(el('.game__error', {}, [
        el('h2', { text: 'Esta máquina está en mantenimiento' }),
        el('p', { text: 'No se ha podido iniciar. Vuelve al vestíbulo e inténtalo de nuevo.' })
      ]));
      return { destroy: function () {} };
    }

    // Si el juego no colocó la apuesta, la ponemos nosotros en los controles.
    if (betCtl && !betCtl.node.isConnected) {
      controls.insertBefore(betCtl.node, controls.firstChild);
    }

    store.state.lastGame = game.id;
    store.save();

    active = {
      id: game.id,
      destroy: function () {
        // Una ronda abierta al salir se devuelve: nunca se pierde dinero.
        var openRound = bank.getOpenRound(game.id);
        if (openRound) {
          openRound.cancel();
          ui.toast('Ronda sin terminar: se te ha devuelto la apuesta.', { type: 'info', icon: '↩️' });
        }
        try { if (instance.destroy) instance.destroy(); } catch (e) { console.error(e); }
        if (betCtl) betCtl.destroy();
        fx.clearAll();
      }
    };
    return active;
  }

  function unmount() {
    if (active) {
      active.destroy();
      active = null;
    }
  }

  /** Apuesta inicial razonable: ni la mínima ni algo que vacíe el saldo. */
  function suggestedBet(game) {
    var bal = bank.balance;
    var target = Math.max(game.minBet, Math.min(game.maxBet, Math.round(bal * 0.01 * 100) / 100));
    if (target > bal) target = game.minBet;
    // Redondeamos a una ficha cómoda.
    var chips = ui.CHIPS.filter(function (c) { return c <= target && c <= bal; });
    return chips.length ? chips[chips.length - 1] : Math.max(game.minBet, Math.min(bal, game.minBet));
  }

  root.Casino.engine = {
    register: register, list: list, get: get, count: count,
    mount: mount, unmount: unmount,
    get activeId() { return active ? active.id : null; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
