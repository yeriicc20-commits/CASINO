/* =========================================================================
   baccarat.js — Punto y Banca con las reglas oficiales de tercera carta.

   Pagos: Jugador 1:1, Banca 1:1 menos 5% de comisión, Empate 8:1.
   En caso de empate, las apuestas a Jugador y Banca se devuelven.
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, D = C.deck, el = U.el;

  var DECKS = 8;
  var BANKER_COMMISSION = 0.05;

  var SIDES = {
    player: { label: 'Jugador', pay: 1,   key: 'player' },
    banker: { label: 'Banca',   pay: 1,   key: 'banker', commission: true },
    tie:    { label: 'Empate',  pay: 8,   key: 'tie' }
  };

  /**
   * Reparte una mano completa aplicando las reglas de tercera carta.
   * Devuelve {player:[cartas], banker:[cartas], pScore, bScore, winner}
   */
  function playHand(shoe) {
    var player = [shoe.draw(), shoe.draw()];
    var banker = [shoe.draw(), shoe.draw()];

    var p = D.bacScore(player);
    var b = D.bacScore(banker);

    /* Con 8 o 9 ("natural") ninguno roba. */
    if (p < 8 && b < 8) {
      var playerThird = null;

      /* El jugador roba con 0-5 y se queda con 6-7. */
      if (p <= 5) {
        playerThird = shoe.draw();
        player.push(playerThird);
        p = D.bacScore(player);
      }

      /* La banca sigue la tabla oficial. */
      if (playerThird === null) {
        // El jugador se quedó: la banca roba con 0-5.
        if (b <= 5) { banker.push(shoe.draw()); b = D.bacScore(banker); }
      } else {
        var t = playerThird.rank >= 10 ? 0 : playerThird.rank; // valor baccarat
        var draws =
          b <= 2 ? true :
          b === 3 ? t !== 8 :
          b === 4 ? (t >= 2 && t <= 7) :
          b === 5 ? (t >= 4 && t <= 7) :
          b === 6 ? (t === 6 || t === 7) :
          false; // con 7 se queda
        if (draws) { banker.push(shoe.draw()); b = D.bacScore(banker); }
      }
    }

    return {
      player: player, banker: banker,
      pScore: p, bScore: b,
      winner: p > b ? 'player' : b > p ? 'banker' : 'tie'
    };
  }

  /** Retorno total (apuesta incluida) de una apuesta dada la mano. */
  function payout(side, amount, winner) {
    if (side === 'tie') {
      return winner === 'tie' ? Math.round(amount * (SIDES.tie.pay + 1) * 100) / 100 : 0;
    }
    // Empate: se devuelve la apuesta a Jugador y Banca.
    if (winner === 'tie') return amount;
    if (side !== winner) return 0;
    if (side === 'banker') {
      // 1:1 menos el 5% de comisión sobre la ganancia.
      var profit = amount * (1 - BANKER_COMMISSION);
      return Math.round((amount + profit) * 100) / 100;
    }
    return Math.round(amount * 2 * 100) / 100;
  }

  /* ============================== interfaz ============================== */

  C.engine.register({
    id: 'baccarat',
    name: 'Punto y Banca',
    icon: '🎴',
    accent: '#2dd4bf',
    tagline: 'Baccarat · banca paga 0,95:1',
    desc: 'Apuesta a Jugador, Banca o Empate. Sin decisiones: las reglas de la tercera carta son automáticas.',
    minBet: 1,
    maxBet: 500,
    rtp: 98.9,

    create: function (ctx) {
      var rng = ctx.rng;
      var shoe = D.shoe(DECKS, rng, 0.8);
      var picks = {};     // side -> importe
      var busy = false;
      var history = [];

      /* ------------------------------ escenario ------------------------------ */

      function sideBlock(key) {
        var cards = el('.bac__cards');
        var score = el('.bac__sidescore', { text: '—' });
        var wrap = el('.bac__side', { 'data-side': key }, [
          el('.bac__sidehead', {}, [
            el('span.bac__sidename', { text: SIDES[key].label }),
            score
          ]),
          cards
        ]);
        return { wrap: wrap, cards: cards, score: score };
      }

      var playerSide = sideBlock('player');
      var bankerSide = sideBlock('banker');

      var betNodes = {};
      var betsRow = el('.bac__bets');
      ['player', 'tie', 'banker'].forEach(function (key) {
        var s = SIDES[key];
        var stakeLabel = el('.bacbet__stake', { text: '' });
        var node = el('.bacbet', {
          role: 'button', tabindex: '0',
          'aria-label': 'Apostar a ' + s.label
        }, [
          el('.bacbet__name', { text: s.label }),
          el('.bacbet__pay', {
            text: key === 'banker' ? 'paga 0,95 : 1' : key === 'tie' ? 'paga 8 : 1' : 'paga 1 : 1'
          }),
          stakeLabel
        ]);
        C.ui.attachTactile(node, function () { addBet(key); }, 'chip');
        node.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addBet(key); }
        });
        node.addEventListener('contextmenu', function (e) { e.preventDefault(); clearBet(key); });
        betNodes[key] = { node: node, stake: stakeLabel };
        betsRow.appendChild(node);
      });

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: '' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel); verdict.appendChild(verdictAmount);

      var histNode = el('.history');

      ctx.stage.classList.add('stage--felt');
      ctx.stage.appendChild(el('.bac', {}, [
        el('.bac__table', {}, [playerSide.wrap, bankerSide.wrap]),
        betsRow,
        verdict
      ]));

      ctx.side.appendChild(el('.panel', {}, [
        el('.panel__title', { text: 'Historial' }),
        histNode
      ]));
      ctx.side.appendChild(el('.panel', {}, [
        el('.panel__title', { text: 'Zapato' }),
        el('.panel__row', {}, [
          el('span.panel__key', { text: 'Cartas restantes' }),
          el('span.panel__val', { id: 'bacShoe', text: String(shoe.remaining) })
        ])
      ]));
      var shoeVal = ctx.stage.parentNode ? null : null;

      /* ------------------------------ apuestas ------------------------------ */

      function totalStaked() {
        return Math.round(Object.keys(picks).reduce(function (a, k) { return a + picks[k]; }, 0) * 100) / 100;
      }

      function addBet(key) {
        if (busy) return;
        var amount = ctx.bet.get();
        var next = totalStaked() + amount;
        if (!C.bank.canAfford(next)) { C.ui.notEnough(next); return; }
        picks[key] = Math.round(((picks[key] || 0) + amount) * 100) / 100;
        refresh();
      }

      function clearBet(key) {
        if (busy) return;
        delete picks[key];
        C.audio.play('back');
        refresh();
      }

      function clearAll() {
        if (busy) return;
        picks = {};
        C.audio.play('back');
        refresh();
      }

      function refresh() {
        Object.keys(betNodes).forEach(function (k) {
          var has = picks[k] > 0;
          betNodes[k].node.classList.toggle('is-picked', has);
          betNodes[k].stake.textContent = has ? U.money(picks[k]) : '';
        });
        var any = totalStaked() > 0;
        dealBtn.disabled = !any || busy;
        dealBtn.classList.toggle('is-disabled', !any);
        clearBtn.disabled = !any || busy;
        var sv = document.getElementById('bacShoe');
        if (sv) sv.textContent = String(shoe.remaining);
      }

      /* -------------------------------- reparto -------------------------------- */

      function renderCards(side, cards, reveal) {
        U.clear(side.cards);
        cards.forEach(function (c, i) {
          var node = el('.card' + (c.red ? '.card--red' : '.card--black'), {}, [
            el('span.card__corner.card__corner--tl', {}, [
              el('span.card__rank', { text: c.label }),
              el('span.card__suit', { text: c.symbol })
            ]),
            el('span.card__pip', { text: c.symbol }),
            el('span.card__corner.card__corner--br', {}, [
              el('span.card__rank', { text: c.label }),
              el('span.card__suit', { text: c.symbol })
            ])
          ]);
          node.style.setProperty('--i', i);
          side.cards.appendChild(node);
        });
        side.score.textContent = reveal ? String(D.bacScore(cards)) : '—';
      }

      var deal = ctx.guard(function () {
        var stake = totalStaked();
        if (stake <= 0) {
          C.ui.toast('Elige Jugador, Banca o Empate antes de repartir.', { type: 'warn', icon: '🎴' });
          return;
        }

        if (shoe.exhausted) {
          shoe.reshuffle();
          ctx.play('shuffle');
          C.ui.toast('Zapato nuevo.', { type: 'info', icon: '🔀' });
        }

        var round = ctx.open(stake);
        if (!round) return;

        busy = true;
        refresh();
        verdict.className = 'verdict';
        playerSide.wrap.classList.remove('is-winner');
        bankerSide.wrap.classList.remove('is-winner');
        Object.keys(betNodes).forEach(function (k) { betNodes[k].node.classList.remove('is-won'); });

        /* La mano se resuelve entera antes de animar. */
        var handResult = playHand(shoe);

        /* Animación: mostramos las cartas de dos en dos, luego la tercera. */
        var pShown = [], bShown = [];
        U.clear(playerSide.cards); U.clear(bankerSide.cards);
        playerSide.score.textContent = '—';
        bankerSide.score.textContent = '—';

        var steps = [];
        steps.push(function () { pShown.push(handResult.player[0]); renderCards(playerSide, pShown, false); ctx.play('card'); });
        steps.push(function () { bShown.push(handResult.banker[0]); renderCards(bankerSide, bShown, false); ctx.play('card'); });
        steps.push(function () { pShown.push(handResult.player[1]); renderCards(playerSide, pShown, true); ctx.play('card'); });
        steps.push(function () { bShown.push(handResult.banker[1]); renderCards(bankerSide, bShown, true); ctx.play('card'); });
        if (handResult.player.length > 2) {
          steps.push(function () { pShown.push(handResult.player[2]); renderCards(playerSide, pShown, true); ctx.play('card'); });
        }
        if (handResult.banker.length > 2) {
          steps.push(function () { bShown.push(handResult.banker[2]); renderCards(bankerSide, bShown, true); ctx.play('card'); });
        }

        var chain = Promise.resolve();
        steps.forEach(function (step) {
          chain = chain.then(function () { step(); return ctx.wait(300); });
        });

        return chain.then(function () {
          /* --- premio total --- */
          var totalReturn = 0;
          Object.keys(picks).forEach(function (k) {
            totalReturn += payout(k, picks[k], handResult.winner);
          });
          totalReturn = Math.round(totalReturn * 100) / 100;

          var result = round.settle(totalReturn, { winner: handResult.winner });
          busy = false;

          /* --- feedback --- */
          if (handResult.winner === 'player') playerSide.wrap.classList.add('is-winner');
          else if (handResult.winner === 'banker') bankerSide.wrap.classList.add('is-winner');
          else {
            playerSide.wrap.classList.add('is-winner');
            bankerSide.wrap.classList.add('is-winner');
          }
          if (picks[handResult.winner]) betNodes[handResult.winner].node.classList.add('is-won');

          verdict.className = 'verdict is-show verdict--' +
            (result.net > 0 ? 'win' : result.net < 0 ? 'lose' : 'push');
          verdictLabel.textContent = handResult.winner === 'tie'
            ? 'Empate a ' + handResult.pScore
            : 'Gana ' + SIDES[handResult.winner].label + '  ' +
              handResult.pScore + ' – ' + handResult.bScore;
          verdictAmount.textContent = (result.net > 0 ? '+' : result.net < 0 ? '−' : '') +
                                      U.money(Math.abs(result.net));

          history.unshift(handResult.winner);
          if (history.length > 16) history.pop();
          renderHistory();

          ctx.celebrate(result, ctx.stage);
          refresh();
          root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2600);
          return ctx.wait(600);
        });
      });

      function renderHistory() {
        U.clear(histNode);
        history.forEach(function (w) {
          var txt = w === 'player' ? 'J' : w === 'banker' ? 'B' : 'E';
          var cls = w === 'player' ? '.is-win' : w === 'banker' ? '.is-loss' : '.is-push';
          histNode.appendChild(el('.history__item' + cls, { text: txt, title: SIDES[w].label }));
        });
      }

      /* ------------------------------ controles ------------------------------ */

      var dealBtn = ctx.button({ label: 'Repartir', icon: '🎴', variant: 'play',
                                 onClick: function () { deal(); } });
      var clearBtn = ctx.button({ label: 'Quitar apuestas', icon: '🧹', variant: 'ghost', size: 'lg',
                                  onClick: clearAll });

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(el('.controls__group', {}, [clearBtn, dealBtn]));
      ctx.lockDuringPlay(dealBtn, clearBtn);

      ctx.setInfo(el('div', {}, [
        ctx.table(['Apuesta', 'Paga', 'Ventaja de la casa'], [
          { cells: ['Banca', '1 : 1 menos 5% de comisión', '1,06%'], highlight: true },
          { cells: ['Jugador', '1 : 1', '1,24%'] },
          { cells: ['Empate', '8 : 1', '14,4%'] }
        ], { compact: true }),
        el('ul', { style: { marginTop: 'var(--s-3)', fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: '1.75' } }, [
          el('li', { text: '• Las cartas suman por su unidad: 10, J, Q y K valen 0 y el as 1.' }),
          el('li', { text: '• Gana quien más se acerque a 9. No hay decisiones que tomar.' }),
          el('li', { text: '• Con 8 o 9 de salida ("natural") nadie roba tercera carta.' }),
          el('li', { text: '• Si hay empate, las apuestas a Jugador y Banca se devuelven.' }),
          el('li', { text: '• La apuesta a Empate paga mucho pero es la peor del tapete.' })
        ])
      ]));

      refresh();
      renderHistory();

      return { destroy: function () { busy = false; } };
    }
  });

  C.baccaratLogic = { playHand: playHand, payout: payout, SIDES: SIDES, DECKS: DECKS, BANKER_COMMISSION: BANKER_COMMISSION };
})(typeof window !== 'undefined' ? window : globalThis);
