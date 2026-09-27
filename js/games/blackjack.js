/* =========================================================================
   blackjack.js — Blackjack con reglas completas.

   Reglas: 6 mazos, el crupier se planta en 17 (también en 17 blando),
   blackjack paga 3:2, se puede doblar en cualquier mano de 2 cartas,
   separar parejas hasta 4 manos, y hay seguro si el crupier enseña un as.

   Contabilidad: UNA sola ronda. La apuesta base se cobra al repartir y
   cada doblar / separar / seguro llama a round.raise(), así el total
   apostado siempre es exacto. Al final se liquida una única vez con la
   suma de lo que devuelven todas las manos.
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, D = C.deck, el = U.el;

  var DECKS = 6;
  var MAX_HANDS = 4;

  /** Decide la jugada del crupier: pide hasta 17 o más. */
  function dealerShouldHit(hand) {
    var s = D.bjScore(hand);
    return s.total < 17;
  }

  /**
   * Compara una mano del jugador con la del crupier.
   * Devuelve el multiplicador del retorno sobre la apuesta de esa mano:
   *   0 = pierde, 1 = empate, 2 = gana, 2.5 = blackjack natural.
   */
  function compare(playerHand, dealerHand, wasSplit) {
    var p = D.bjScore(playerHand);
    var d = D.bjScore(dealerHand);
    if (p.bust) return 0;
    // Un 21 con 2 cartas tras separar cuenta como 21 normal, no como natural.
    var pNatural = p.blackjack && !wasSplit;
    var dNatural = d.blackjack;
    if (pNatural && dNatural) return 1;
    if (pNatural) return 2.5;
    if (dNatural) return 0;
    if (d.bust) return 2;
    if (p.total > d.total) return 2;
    if (p.total < d.total) return 0;
    return 1;
  }

  /* ============================== interfaz ============================== */

  C.engine.register({
    id: 'blackjack',
    name: 'Blackjack',
    icon: '🃏',
    accent: '#35d295',
    tagline: '6 mazos · paga 3:2 · doblar y separar',
    desc: 'El clásico del 21. El crupier se planta en 17, puedes doblar, separar parejas y pedir seguro.',
    minBet: 1,
    maxBet: 500,
    rtp: 99.4,

    create: function (ctx) {
      var rng = ctx.rng;
      var shoe = D.shoe(DECKS, rng, 0.72);

      var round = null;
      var baseBet = 0;
      var hands = [];          // [{cards, stake, done, doubled, fromSplit, result}]
      var activeHand = 0;
      var dealer = [];
      var holeHidden = true;
      var insuranceStake = 0;
      var inRound = false;

      /* ------------------------------ escenario ------------------------------ */

      var dealerRow = el('.bj__hand.bj__hand--dealer');
      var dealerScore = el('.bj__score', { text: '' });
      var playerRows = el('.bj__players');
      var shoeInfo = el('.bj__shoe', { text: '' });

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: '' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel); verdict.appendChild(verdictAmount);

      ctx.stage.classList.add('stage--felt');
      ctx.stage.appendChild(el('.bj', {}, [
        el('.bj__seat', {}, [
          el('.bj__seatlabel', {}, [el('span', { text: 'Crupier' }), dealerScore]),
          dealerRow
        ]),
        el('.bj__rule', {}, [
          el('span', { text: 'El crupier se planta en 17  ·  Blackjack paga 3:2' })
        ]),
        el('.bj__seat', {}, [
          el('.bj__seatlabel', {}, [el('span', { text: 'Tú' }), shoeInfo]),
          playerRows
        ]),
        verdict
      ]));

      /* ------------------------------- cartas ------------------------------- */

      function cardNode(card, hidden) {
        if (hidden) {
          return el('.card.card--back', { 'aria-label': 'Carta tapada' }, [
            el('span.card__pattern', { 'aria-hidden': 'true' })
          ]);
        }
        var n = el('.card' + (card.red ? '.card--red' : '.card--black'), {
          'aria-label': card.label + ' de ' + suitName(card.suit)
        }, [
          el('span.card__corner.card__corner--tl', {}, [
            el('span.card__rank', { text: card.label }),
            el('span.card__suit', { text: card.symbol })
          ]),
          el('span.card__pip', { text: card.symbol, 'aria-hidden': 'true' }),
          el('span.card__corner.card__corner--br', {}, [
            el('span.card__rank', { text: card.label }),
            el('span.card__suit', { text: card.symbol })
          ])
        ]);
        return n;
      }

      function suitName(id) {
        return { s: 'picas', h: 'corazones', d: 'diamantes', c: 'tréboles' }[id] || '';
      }

      /* -------------------------------- render -------------------------------- */

      function render() {
        /* crupier */
        U.clear(dealerRow);
        dealer.forEach(function (c, i) {
          var hidden = holeHidden && i === 1;
          var node = cardNode(c, hidden);
          node.style.setProperty('--i', i);
          dealerRow.appendChild(node);
        });
        if (dealer.length) {
          if (holeHidden) {
            var up = D.bjScore([dealer[0]]);
            dealerScore.textContent = up.total + ' + ?';
            dealerScore.className = 'bj__score';
          } else {
            var ds = D.bjScore(dealer);
            dealerScore.textContent = String(ds.total) + (ds.bust ? '  ¡se pasa!' : '');
            dealerScore.className = 'bj__score' + (ds.bust ? ' is-bust' : ds.total === 21 ? ' is-21' : '');
          }
        } else {
          dealerScore.textContent = '';
        }

        /* manos del jugador */
        U.clear(playerRows);
        hands.forEach(function (h, idx) {
          var s = D.bjScore(h.cards);
          var isActive = inRound && idx === activeHand && !h.done;

          var row = el('.bj__hand');
          h.cards.forEach(function (c, i) {
            var node = cardNode(c, false);
            node.style.setProperty('--i', i);
            row.appendChild(node);
          });

          var label = s.total + (s.bust ? '  ¡te pasas!' : s.blackjack && !h.fromSplit ? '  ¡BLACKJACK!' : s.soft ? ' blando' : '');
          var meta = el('.bj__handmeta', {}, [
            el('span.bj__score' + (s.bust ? '.is-bust' : s.total === 21 ? '.is-21' : ''), { text: label }),
            el('span.bj__handbet', { text: U.money(h.stake) + (h.doubled ? '  (doblada)' : '') }),
            h.result ? el('span.bj__handres.is-' + h.result.kind, { text: h.result.text }) : null
          ]);

          playerRows.appendChild(el('.bj__handwrap' + (isActive ? '.is-active' : '') + (h.done ? '.is-done' : ''), {}, [
            hands.length > 1 ? el('.bj__handtag', { text: 'Mano ' + (idx + 1) }) : null,
            row, meta
          ]));
        });

        shoeInfo.textContent = 'Zapato: ' + shoe.remaining + ' cartas';
        refreshButtons();
      }

      /* -------------------------------- botones -------------------------------- */

      var dealBtn, hitBtn, standBtn, doubleBtn, splitBtn, insureBtn;

      function refreshButtons() {
        var h = hands[activeHand];
        var canAct = inRound && h && !h.done;
        var s = h ? D.bjScore(h.cards) : null;

        show(dealBtn, !inRound);
        show(hitBtn, inRound);
        show(standBtn, inRound);
        show(doubleBtn, inRound);
        show(splitBtn, inRound);
        show(insureBtn, inRound && insuranceOffered);

        setEnabled(hitBtn, canAct && !s.bust);
        setEnabled(standBtn, canAct);
        setEnabled(doubleBtn, canAct && h.cards.length === 2 && round && round.canRaise(h.stake));
        setEnabled(splitBtn, canAct && canSplit(h));
        setEnabled(insureBtn, insuranceOffered && insuranceStake === 0 && round && round.canRaise(baseBet / 2));
        setEnabled(dealBtn, !inRound);
      }

      function show(btn, on) { if (btn) btn.style.display = on ? '' : 'none'; }
      function setEnabled(btn, on) {
        if (!btn) return;
        btn.disabled = !on;
        btn.classList.toggle('is-disabled', !on);
      }

      function canSplit(h) {
        if (!h || h.cards.length !== 2) return false;
        if (hands.length >= MAX_HANDS) return false;
        // Se separa por valor: dos figuras cualesquiera valen 10.
        var a = D.bjCardValue(h.cards[0]);
        var b = D.bjCardValue(h.cards[1]);
        if (a !== b) return false;
        return round && round.canRaise(h.stake);
      }

      /* ------------------------------ reparto ------------------------------ */

      var insuranceOffered = false;

      var startRound = ctx.guard(function () {
        if (inRound) return;

        // Mezclamos SOLO entre manos, nunca a mitad de una.
        if (shoe.exhausted) {
          shoe.reshuffle();
          ctx.play('shuffle');
          C.ui.toast('Zapato nuevo: se han mezclado las cartas.', { type: 'info', icon: '🔀' });
        }

        round = ctx.open();
        if (!round) return;

        baseBet = round.stake;
        hands = [{ cards: [], stake: baseBet, done: false, doubled: false, fromSplit: false, result: null }];
        dealer = [];
        activeHand = 0;
        holeHidden = true;
        insuranceStake = 0;
        insuranceOffered = false;
        inRound = true;
        verdict.className = 'verdict';
        render();

        /* reparto: jugador, crupier, jugador, crupier(tapada) */
        return dealCard(hands[0].cards)
          .then(function () { return dealCard(dealer); })
          .then(function () { return dealCard(hands[0].cards); })
          .then(function () { return dealCard(dealer); })
          .then(function () {
            /* ¿seguro? El crupier enseña un as. */
            if (dealer[0].rank === 1 && round.canRaise(baseBet / 2)) {
              insuranceOffered = true;
              render();
              C.ui.toast('El crupier enseña un as: puedes pedir seguro.', { type: 'info', icon: '🛡️' });
              return ctx.wait(200);
            }
            return null;
          })
          .then(function () {
            var ps = D.bjScore(hands[0].cards);
            var ds = D.bjScore(dealer);
            /* blackjack inmediato de cualquiera de los dos cierra la mano */
            if (ps.blackjack || ds.blackjack) {
              if (ps.blackjack) C.progress.unlock('blackjack');
              return finish();
            }
            render();
            return null;
          });
      });

      function dealCard(target) {
        var c = shoe.draw();
        target.push(c);
        ctx.play('card');
        render();
        return ctx.wait(240);
      }

      /* ---------------------------- acciones ---------------------------- */

      var hit = ctx.guard(function () {
        var h = hands[activeHand];
        if (!inRound || !h || h.done) return;
        return dealCard(h.cards).then(function () {
          var s = D.bjScore(h.cards);
          if (s.bust) {
            h.done = true;
            ctx.play('lose');
            ctx.fx.pulse(playerRows, 'bad');
            return nextHandOrFinish();
          }
          if (s.total === 21) {
            h.done = true;
            return nextHandOrFinish();
          }
          render();
          return null;
        });
      });

      var stand = ctx.guard(function () {
        var h = hands[activeHand];
        if (!inRound || !h || h.done) return;
        h.done = true;
        return nextHandOrFinish();
      });

      var doubleDown = ctx.guard(function () {
        var h = hands[activeHand];
        if (!inRound || !h || h.done || h.cards.length !== 2) return;
        if (!round.canRaise(h.stake)) { C.ui.notEnough(h.stake); return; }
        round.raise(h.stake);
        h.stake = Math.round(h.stake * 2 * 100) / 100;
        h.doubled = true;
        ctx.play('bet');
        return dealCard(h.cards).then(function () {
          h.done = true;
          var s = D.bjScore(h.cards);
          if (s.bust) { ctx.play('lose'); ctx.fx.pulse(playerRows, 'bad'); }
          return nextHandOrFinish();
        });
      });

      var split = ctx.guard(function () {
        var h = hands[activeHand];
        if (!canSplit(h)) return;
        round.raise(h.stake);
        ctx.play('bet');

        var moved = h.cards.pop();
        var newHand = {
          cards: [moved], stake: h.stake, done: false,
          doubled: false, fromSplit: true, result: null
        };
        h.fromSplit = true;
        hands.splice(activeHand + 1, 0, newHand);
        render();

        // Una carta nueva para cada mano.
        return dealCard(h.cards).then(function () {
          return dealCard(newHand.cards);
        }).then(function () {
          /* Los ases separados reciben una sola carta y se plantan. */
          if (moved.rank === 1) {
            h.done = true;
            newHand.done = true;
            return nextHandOrFinish();
          }
          render();
          return null;
        });
      });

      var insure = ctx.guard(function () {
        if (!insuranceOffered || insuranceStake > 0) return;
        var amount = Math.round((baseBet / 2) * 100) / 100;
        if (!round.canRaise(amount)) { C.ui.notEnough(amount); return; }
        round.raise(amount);
        insuranceStake = amount;
        insuranceOffered = false;
        ctx.play('bet');
        C.ui.toast('Seguro de ' + U.money(amount) + ' contratado.', { type: 'info', icon: '🛡️' });
        render();
      });

      /** Pasa a la siguiente mano pendiente, o resuelve la ronda. */
      function nextHandOrFinish() {
        for (var i = activeHand + 1; i < hands.length; i++) {
          if (!hands[i].done) {
            activeHand = i;
            render();
            return ctx.wait(240);
          }
        }
        return finish();
      }

      /* ---------------------------- resolución ---------------------------- */

      function finish() {
        insuranceOffered = false;
        holeHidden = false;
        render();

        var ds = D.bjScore(dealer);
        var anyAlive = hands.some(function (h) { return !D.bjScore(h.cards).bust; });
        var playerNatural = hands.length === 1 && D.bjScore(hands[0].cards).blackjack;

        var chain = ctx.wait(360);

        /* El crupier sólo roba si alguna mano sigue viva y nadie tiene natural. */
        if (anyAlive && !ds.blackjack && !playerNatural) {
          chain = chain.then(function () { return dealerPlay(); });
        }

        return chain.then(function () {
          /* ---- cálculo del retorno total ---- */
          var totalReturn = 0;

          hands.forEach(function (h) {
            var mult = compare(h.cards, dealer, h.fromSplit);
            var ret = Math.round(h.stake * mult * 100) / 100;
            totalReturn += ret;
            h.result = {
              kind: mult > 1 ? 'win' : mult === 1 ? 'push' : 'loss',
              text: mult > 1 ? '+' + U.money(ret - h.stake)
                  : mult === 1 ? 'Empate'
                  : '−' + U.money(h.stake)
            };
          });

          /* El seguro paga 2:1 si el crupier tiene blackjack. */
          var insuranceReturn = 0;
          if (insuranceStake > 0) {
            insuranceReturn = ds.blackjack ? insuranceStake * 3 : 0;
            totalReturn += insuranceReturn;
          }

          totalReturn = Math.round(totalReturn * 100) / 100;

          var result = round.settle(totalReturn, { dealer: ds.total });
          round = null;
          inRound = false;
          render();

          /* ---- feedback ---- */
          var net = result.net;
          verdict.className = 'verdict is-show verdict--' +
            (net > 0 ? 'win' : net < 0 ? 'lose' : 'push');
          verdictLabel.textContent =
            ds.bust ? 'El crupier se pasa con ' + ds.total
            : ds.blackjack ? 'Blackjack del crupier'
            : 'El crupier se queda en ' + ds.total;
          verdictAmount.textContent = (net > 0 ? '+' : net < 0 ? '−' : '') + U.money(Math.abs(net));

          if (insuranceStake > 0) {
            C.ui.toast(insuranceReturn > 0
              ? 'El seguro paga ' + U.money(insuranceReturn) + '.'
              : 'El seguro se pierde.', { type: insuranceReturn > 0 ? 'win' : 'info', icon: '🛡️' });
          }

          ctx.celebrate(result, ctx.stage);
          root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2800);
          return ctx.wait(600);
        });
      }

      /** El crupier descubre y roba hasta 17. */
      function dealerPlay() {
        if (!dealerShouldHit(dealer)) return Promise.resolve();
        return dealCard(dealer).then(function () {
          return ctx.wait(160).then(dealerPlay);
        });
      }

      /* ---------------------------- controles ---------------------------- */

      dealBtn = ctx.button({ label: 'Repartir', icon: '🃏', variant: 'play',
                             onClick: function () { startRound(); } });
      hitBtn = ctx.button({ label: 'Pedir', icon: '➕', variant: 'primary', size: 'lg',
                            onClick: function () { hit(); } });
      standBtn = ctx.button({ label: 'Plantarse', icon: '✋', variant: 'success', size: 'lg',
                              onClick: function () { stand(); } });
      doubleBtn = ctx.button({ label: 'Doblar', icon: '✖️', variant: 'violet', size: 'lg',
                               onClick: function () { doubleDown(); } });
      splitBtn = ctx.button({ label: 'Separar', icon: '🔀', variant: 'ghost', size: 'lg',
                              onClick: function () { split(); } });
      insureBtn = ctx.button({ label: 'Seguro', sub: 'paga 2:1', icon: '🛡️', variant: 'ghost', size: 'lg',
                               onClick: function () { insure(); } });

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(el('.controls__group', {}, [
        insureBtn, splitBtn, doubleBtn, standBtn, hitBtn, dealBtn
      ]));

      /* ---------------------------- teclado ---------------------------- */
      function onKey(e) {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        var k = e.key.toLowerCase();
        if (!inRound && (e.code === 'Space' || k === 'r')) { e.preventDefault(); startRound(); }
        else if (inRound && k === 'p') hit();
        else if (inRound && (k === 'e' || e.code === 'Space')) { e.preventDefault(); stand(); }
        else if (inRound && k === 'd') doubleDown();
        else if (inRound && k === 's') split();
      }
      document.addEventListener('keydown', onKey);

      /* ---------------------------- información ---------------------------- */
      ctx.setInfo(el('div', {}, [
        ctx.table(['Resultado', 'Paga'], [
          { cells: ['Blackjack (21 con 2 cartas)', '3 : 2'], highlight: true },
          { cells: ['Ganar la mano', '1 : 1'] },
          { cells: ['Empate', 'Se devuelve la apuesta'] },
          { cells: ['Seguro acertado', '2 : 1'] }
        ], { compact: true }),
        el('ul', { style: { marginTop: 'var(--s-3)', fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: '1.75' } }, [
          el('li', { text: '• 6 mazos; se mezclan entre manos, nunca a mitad de una.' }),
          el('li', { text: '• El crupier pide hasta 17 y se planta (también con 17 blando).' }),
          el('li', { text: '• Puedes doblar con 2 cartas y separar parejas hasta 4 manos.' }),
          el('li', { text: '• Los ases separados reciben una sola carta.' }),
          el('li', { text: '• Un 21 tras separar cuenta como 21 normal, no como blackjack.' }),
          el('li', { text: '• Atajos: P pedir · E plantarse · D doblar · S separar · R repartir.' })
        ])
      ]));

      render();

      return {
        destroy: function () {
          document.removeEventListener('keydown', onKey);
        }
      };
    }
  });

  C.blackjackLogic = { compare: compare, dealerShouldHit: dealerShouldHit, DECKS: DECKS, MAX_HANDS: MAX_HANDS };
})(typeof window !== 'undefined' ? window : globalThis);
