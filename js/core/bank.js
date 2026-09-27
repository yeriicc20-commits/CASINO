/* =========================================================================
   bank.js — ÚNICA fuente de verdad del dinero.

   Ningún juego toca el saldo directamente. Todo pasa por una "ronda":

       var round = Bank.openRound('slots', 2.50);   // cobra la apuesta YA
       round.raise(2.50);                           // apuesta extra (doblar…)
       round.settle(7.50);                          // devuelve total (0 = pierde)

   Garantías estructurales (lo que evita que el dinero se descuadre):
     · La apuesta se cobra UNA sola vez, al abrir la ronda.
     · settle() sólo puede llamarse UNA vez; la segunda lanza error.
     · No puede haber dos rondas abiertas del mismo juego a la vez,
       así un doble clic nunca cobra dos veces.
     · El saldo nunca puede quedar negativo.
     · El libro mayor (debits/credits) permite verificar el cuadre exacto.
   ========================================================================= */
(function (root) {
  'use strict';
  var U = root.Casino.util;
  var store = root.Casino.store;

  var bus = U.emitter();
  var openRounds = Object.create(null); // gameId -> Round abierta
  var seq = 0;

  /** Libro mayor acumulado en céntimos; sirve para auditar el cuadre. */
  var ledger = { debitCents: 0, creditCents: 0 };

  /*
    Tope de saldo: 10.000 millones de euros.

    Toda la contabilidad usa enteros, y los enteros de JavaScript sólo son
    exactos hasta 2^53 (unos 90 billones de euros en céntimos). Por encima de
    ahí las sumas empiezan a redondear y el cuadre deja de ser fiable. Con
    ventaja de la casa en las 12 máquinas ningún jugador se acerca a esta
    cifra, pero el tope garantiza que la aritmética sea exacta pase lo que
    pase, en lugar de degradarse en silencio.
  */
  var MAX_BALANCE_CENTS = 1000000000000; // 10.000.000.000,00 €
  var warnedCap = false;

  function BankError(code, message, detail) {
    var e = new Error(message);
    e.name = 'BankError';
    e.code = code;
    e.detail = detail || null;
    return e;
  }

  function balanceCents() { return store.state.balanceCents; }
  function balance() { return U.fromCents(store.state.balanceCents); }

  /** Normaliza un importe de euros a céntimos enteros positivos. */
  function normalizeStake(euros) {
    var n = Number(euros);
    if (!Number.isFinite(n)) throw BankError('INVALID_STAKE', 'La apuesta no es un número válido.', euros);
    var cents = Math.round(n * 100);
    if (cents <= 0) throw BankError('INVALID_STAKE', 'La apuesta debe ser mayor que 0.', euros);
    return cents;
  }

  function normalizeReturn(euros) {
    var n = Number(euros);
    if (!Number.isFinite(n) || n < 0) {
      throw BankError('INVALID_RETURN', 'El importe devuelto no es válido.', euros);
    }
    return Math.round(n * 100);
  }

  function applyDelta(deltaCents, reason) {
    var next = store.state.balanceCents + deltaCents;
    if (next < 0) {
      // Nunca debería ocurrir: openRound/raise validan antes de cobrar.
      throw BankError('NEGATIVE_BALANCE', 'Operación rechazada: dejaría el saldo en negativo.', {
        balanceCents: store.state.balanceCents, deltaCents: deltaCents, reason: reason
      });
    }
    if (next > MAX_BALANCE_CENTS) {
      // Inalcanzable jugando de verdad; existe para que la aritmética entera
      // siga siendo exacta en vez de perder precisión sin avisar.
      if (!warnedCap) {
        warnedCap = true;   // una sola vez: si no, inunda la consola
        console.warn('Saldo topado en ' + U.money(U.fromCents(MAX_BALANCE_CENTS)) +
                     ' para no perder precisión.');
      }
      deltaCents -= (next - MAX_BALANCE_CENTS);
      next = MAX_BALANCE_CENTS;
    }
    store.state.balanceCents = next;
    if (deltaCents < 0) ledger.debitCents += -deltaCents;
    else ledger.creditCents += deltaCents;
    if (next > store.state.totals.peakBalanceCents) {
      store.state.totals.peakBalanceCents = next;
    }
    store.save();
    bus.emit('change', { balanceCents: next, deltaCents: deltaCents, reason: reason });
    return next;
  }

  function canAfford(euros) {
    var n = Number(euros);
    if (!Number.isFinite(n) || n <= 0) return false;
    return Math.round(n * 100) <= balanceCents();
  }

  function hasOpenRound(gameId) {
    return !!openRounds[gameId];
  }

  /* -------------------------------------------------------------------- */

  function Round(gameId, stakeCents) {
    this.id = ++seq;
    this.gameId = gameId;
    this.stakeCents = stakeCents;
    this.returnedCents = 0;
    this.settled = false;
    this.openedAt = Date.now();
    this.parts = [stakeCents]; // desglose de la apuesta (base + subidas)
  }

  Object.defineProperty(Round.prototype, 'stake', {
    get: function () { return U.fromCents(this.stakeCents); }
  });
  Object.defineProperty(Round.prototype, 'returned', {
    get: function () { return U.fromCents(this.returnedCents); }
  });
  Object.defineProperty(Round.prototype, 'net', {
    get: function () { return U.fromCents(this.returnedCents - this.stakeCents); }
  });

  /** ¿Se puede subir la apuesta en `euros` sin pasarse del saldo? */
  Round.prototype.canRaise = function (euros) {
    if (this.settled) return false;
    var n = Number(euros);
    if (!Number.isFinite(n) || n <= 0) return false;
    return Math.round(n * 100) <= balanceCents();
  };

  /** Añade dinero a la apuesta en curso (doblar, split, seguro, subir bote). */
  Round.prototype.raise = function (euros) {
    if (this.settled) {
      throw BankError('ROUND_CLOSED', 'La ronda ya está liquidada; no se puede subir la apuesta.', this.id);
    }
    var cents = normalizeStake(euros);
    if (cents > balanceCents()) {
      throw BankError('INSUFFICIENT_FUNDS', 'Saldo insuficiente para subir la apuesta.', {
        need: cents, have: balanceCents()
      });
    }
    applyDelta(-cents, 'raise:' + this.gameId);
    this.stakeCents += cents;
    this.parts.push(cents);
    bus.emit('round:raise', { round: this, addedCents: cents });
    return this;
  };

  /**
   * Cierra la ronda devolviendo `euros` al jugador (total, apuesta incluida).
   *   perder -> settle(0)      empatar -> settle(round.stake)
   *   ganar 1:1 -> settle(round.stake * 2)
   */
  Round.prototype.settle = function (euros, meta) {
    if (this.settled) {
      throw BankError('DOUBLE_SETTLE', 'Esta ronda ya se había liquidado.', this.id);
    }
    var retCents = normalizeReturn(euros === undefined ? 0 : euros);
    this.settled = true;
    this.returnedCents = retCents;
    this.closedAt = Date.now();
    delete openRounds[this.gameId];

    if (retCents > 0) applyDelta(retCents, 'payout:' + this.gameId);

    var netCents = retCents - this.stakeCents;
    var multiplier = this.stakeCents > 0 ? retCents / this.stakeCents : 0;
    var outcome = netCents > 0 ? 'win' : netCents < 0 ? 'loss' : 'push';

    /* ---- contabilidad ---- */
    var T = store.state.totals;
    var G = store.gameStats(this.gameId);
    T.rounds++; G.rounds++;
    T.wageredCents += this.stakeCents; G.wageredCents += this.stakeCents;
    T.returnedCents += retCents;      G.returnedCents += retCents;
    if (outcome === 'win') {
      T.wins++; G.wins++;
      if (netCents > T.biggestWinCents) T.biggestWinCents = netCents;
      if (netCents > G.biggestWinCents) G.biggestWinCents = netCents;
      if (multiplier > T.biggestMultiplier) T.biggestMultiplier = multiplier;
    } else if (outcome === 'loss') {
      T.losses++; G.losses++;
    } else {
      T.pushes++; G.pushes++;
    }
    store.state.lastGame = this.gameId;
    store.save();

    var result = {
      round: this,
      gameId: this.gameId,
      stake: U.fromCents(this.stakeCents),
      returned: U.fromCents(retCents),
      net: U.fromCents(netCents),
      multiplier: multiplier,
      outcome: outcome,
      meta: meta || null
    };
    bus.emit('round:settle', result);
    return result;
  };

  /** Anula la ronda devolviendo la apuesta íntegra (no cuenta como jugada). */
  Round.prototype.cancel = function () {
    if (this.settled) {
      throw BankError('ROUND_CLOSED', 'La ronda ya está liquidada; no se puede anular.', this.id);
    }
    this.settled = true;
    this.cancelled = true;
    this.returnedCents = this.stakeCents;
    delete openRounds[this.gameId];
    if (this.stakeCents > 0) applyDelta(this.stakeCents, 'refund:' + this.gameId);
    bus.emit('round:cancel', { round: this });
    return this;
  };

  /* -------------------------------------------------------------------- */

  /** Abre una ronda cobrando la apuesta inmediatamente. */
  function openRound(gameId, stakeEuros) {
    if (!gameId) throw BankError('INVALID_GAME', 'Falta el identificador del juego.');
    if (openRounds[gameId]) {
      throw BankError('ROUND_IN_PROGRESS', 'Ya hay una ronda en curso en este juego.', gameId);
    }
    var cents = normalizeStake(stakeEuros);
    if (cents > balanceCents()) {
      throw BankError('INSUFFICIENT_FUNDS', 'Saldo insuficiente para esta apuesta.', {
        need: cents, have: balanceCents()
      });
    }
    var r = new Round(gameId, cents);
    openRounds[gameId] = r;
    applyDelta(-cents, 'stake:' + gameId);
    bus.emit('round:open', { round: r });
    return r;
  }

  /** Ingreso fuera de ronda: bonus diario, rescate, logros. */
  function credit(euros, reason) {
    var cents = normalizeReturn(euros);
    if (cents === 0) return balance();
    applyDelta(cents, reason || 'credit');
    bus.emit('credit', { cents: cents, reason: reason });
    return balance();
  }

  /** Cobro fuera de ronda (no se usa en juego; presente por simetría). */
  function debit(euros, reason) {
    var cents = normalizeStake(euros);
    if (cents > balanceCents()) {
      throw BankError('INSUFFICIENT_FUNDS', 'Saldo insuficiente.', { need: cents, have: balanceCents() });
    }
    applyDelta(-cents, reason || 'debit');
    return balance();
  }

  /**
   * Comprueba el cuadre: saldo == saldo_inicial - débitos + créditos.
   * Los tests y el panel de desarrollo lo usan como invariante.
   */
  function audit(openingCents) {
    var opening = openingCents === undefined ? store.START_BALANCE_CENTS : openingCents;
    var expected = opening - ledger.debitCents + ledger.creditCents;
    return {
      ok: expected === balanceCents(),
      expectedCents: expected,
      actualCents: balanceCents(),
      ledger: { debitCents: ledger.debitCents, creditCents: ledger.creditCents }
    };
  }

  root.Casino.bank = {
    get balance() { return balance(); },
    get balanceCents() { return balanceCents(); },
    canAfford: canAfford,
    hasOpenRound: hasOpenRound,
    getOpenRound: function (gameId) { return openRounds[gameId] || null; },
    openRound: openRound,
    credit: credit,
    debit: debit,
    audit: audit,
    get ledger() { return { debitCents: ledger.debitCents, creditCents: ledger.creditCents }; },
    _resetLedger: function () { ledger.debitCents = 0; ledger.creditCents = 0; },
    _clearRounds: function () { openRounds = Object.create(null); },
    BankError: BankError,
    MAX_BALANCE_CENTS: MAX_BALANCE_CENTS,
    on: bus.on.bind(bus),
    off: bus.off.bind(bus)
  };
})(typeof window !== 'undefined' ? window : globalThis);
