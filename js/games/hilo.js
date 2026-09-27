/* =========================================================================
   hilo.js — ¿Más alta o más baja?

   Se acierta seguido para encadenar multiplicadores. En cualquier momento
   se puede retirar el bote. Cada paso paga según su probabilidad real
   (contando las cartas que quedan), con un 2% de ventaja para la casa.

   El dinero: UNA ronda por partida. La apuesta se cobra al empezar y la
   ronda se liquida al retirarse (con el bote) o al fallar (con 0).
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, D = C.deck, el = U.el;

  var HOUSE_EDGE = 0.02;

  /** Valor para comparar: el as es el más bajo (1), el rey el más alto (13). */
  function val(card) { return card.rank; }

  /**
   * Probabilidad de acertar "más alta o igual" / "más baja o igual" sobre las
   * cartas que quedan en el mazo. Los iguales cuentan como acierto en ambas
   * direcciones (es lo estándar y evita callejones sin salida con A y K).
   */
  function chance(current, remaining, higher) {
    if (!remaining.length) return 0;
    var v = val(current);
    var hit = remaining.filter(function (c) {
      return higher ? val(c) >= v : val(c) <= v;
    }).length;
    return hit / remaining.length;
  }

  function stepMultiplier(current, remaining, higher) {
    var p = chance(current, remaining, higher);
    if (p <= 0) return 0;
    return Math.floor(((1 - HOUSE_EDGE) / p) * 10000) / 10000;
  }

  C.engine.register({
    id: 'hilo',
    name: 'Más o Menos',
    icon: '🔼',
    accent: '#60a5fa',
    tagline: 'Encadena aciertos · retírate cuando quieras',
    desc: 'Adivina si la siguiente carta es más alta o más baja. Cada acierto multiplica el bote.',
    minBet: 0.5,
    maxBet: 500,
    rtp: 98.0,

    create: function (ctx) {
      var rng = ctx.rng;
      var deck = [];
      var current = null;
      var round = null;
      var pot = 0;
      var chain = 0;
      var playing = false;

      /* ------------------------------ escenario ------------------------------ */

      var cardHost = el('.hilo__card');
      var chainVal = el('.hilo__chainval', { text: '1,00×' });
      var potVal = el('.hilo__chainval', { text: U.money(0) });
      var oddsRow = el('.hilo__odds');
      var deckInfo = el('.hilo__odd', { text: '' });

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: '' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel); verdict.appendChild(verdictAmount);

      ctx.stage.classList.add('stage--felt');
      ctx.stage.appendChild(el('.hilo', {}, [
        el('.hilo__chain', {}, [
          el('span.hilo__chainlabel', { text: 'Multiplicador' }), chainVal,
          el('span.hilo__chainlabel', { text: 'Bote' }), potVal
        ]),
        el('.hilo__stage', {}, [cardHost]),
        oddsRow,
        verdict
      ]));

      function renderCard(card, flip) {
        U.clear(cardHost);
        if (!card) {
          cardHost.appendChild(el('.card.card--back', {}, [el('span.card__pattern')]));
          return;
        }
        var node = el('.card' + (flip ? '.card--flip' : '') + (card.red ? '.card--red' : '.card--black'), {
          'aria-label': card.label
        }, [
          el('span.card__corner.card__corner--tl', {}, [
            el('span.card__rank', { text: card.label }),
            el('span.card__suit', { text: card.symbol })
          ]),
          el('span.card__pip', { text: card.symbol }),
          el('span.card__corner.card__corner--br', {}, [
            el('span.card__rank', { text: card.label }),
            el('span.card__suit', { text: card.symbol })
          ])
        ]);
        cardHost.appendChild(node);
      }

      function refresh() {
        chainVal.textContent = (chain > 0 ? (pot / (round ? round.stake : 1)) : 1).toFixed(2).replace('.', ',') + '×';
        potVal.textContent = U.money(pot);

        U.clear(oddsRow);
        if (playing && current) {
          var pH = chance(current, deck, true);
          var pL = chance(current, deck, false);
          oddsRow.appendChild(el('.hilo__odd', {
            html: '▲ Más o igual: <strong>' + (pH * 100).toFixed(1).replace('.', ',') + '%</strong> → <strong>' +
                  stepMultiplier(current, deck, true).toFixed(2).replace('.', ',') + '×</strong>'
          }));
          oddsRow.appendChild(el('.hilo__odd', {
            html: '▼ Menos o igual: <strong>' + (pL * 100).toFixed(1).replace('.', ',') + '%</strong> → <strong>' +
                  stepMultiplier(current, deck, false).toFixed(2).replace('.', ',') + '×</strong>'
          }));
          oddsRow.appendChild(el('.hilo__odd', { text: 'Quedan ' + deck.length + ' cartas · racha ' + chain }));
        }

        startBtn.style.display = playing ? 'none' : '';
        higherBtn.style.display = playing ? '' : 'none';
        lowerBtn.style.display = playing ? '' : 'none';
        cashBtn.style.display = playing && chain > 0 ? '' : 'none';
        ctx.bet.setEnabled(!playing);
      }

      /* ------------------------------ empezar ------------------------------ */

      var start = ctx.guard(function () {
        if (playing) return;
        round = ctx.open();
        if (!round) return;

        deck = D.build(1, rng);
        current = deck.pop();
        pot = round.stake;
        chain = 0;
        playing = true;
        verdict.className = 'verdict';
        ctx.play('card');
        renderCard(current, true);
        refresh();
      });

      /* ------------------------------ adivinar ------------------------------ */

      function makeGuess(higher) {
        return ctx.guard(function () {
          if (!playing || !current || !deck.length) return;

          var mult = stepMultiplier(current, deck, higher);
          var next = deck.pop();
          var correct = higher ? val(next) >= val(current) : val(next) <= val(current);

          ctx.play('flip');
          renderCard(next, true);

          return ctx.wait(360).then(function () {
            current = next;

            if (!correct) {
              /* --- se pierde todo el bote --- */
              var result = round.settle(0, { chain: chain });
              round = null;
              playing = false;
              pot = 0;
              ctx.play('lose');
              ctx.fx.shake(ctx.stage);
              verdict.className = 'verdict is-show verdict--lose';
              verdictLabel.textContent = 'Fallaste con ' + next.label + ' — racha de ' + chain;
              verdictAmount.textContent = '−' + U.money(result.stake);
              chain = 0;
              refresh();
              root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2400);
              return;
            }

            /* --- acierto: crece el bote --- */
            chain++;
            pot = Math.round(pot * mult * 100) / 100;
            ctx.play('coin');
            ctx.fx.sparks(cardHost, 8);
            ctx.fx.floatText(cardHost, '×' + mult.toFixed(2).replace('.', ','), {});

            /* Si el mazo se acaba, se cobra automáticamente. */
            if (!deck.length) {
              return cashOutNow('¡Mazo agotado! Cobras el bote entero.');
            }
            refresh();
          });
        });
      }

      var guessHigher = makeGuess(true);
      var guessLower = makeGuess(false);

      /* ------------------------------ retirarse ------------------------------ */

      function cashOutNow(message) {
        if (!playing || !round) return Promise.resolve();
        var result = round.settle(pot, { chain: chain });
        round = null;
        playing = false;
        ctx.play('cashout');
        verdict.className = 'verdict is-show verdict--win';
        verdictLabel.textContent = message || ('Te retiras con ' + chain + ' aciertos');
        verdictAmount.textContent = '+' + U.money(result.net);
        ctx.celebrate(result, cardHost);
        pot = 0; chain = 0;
        refresh();
        root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2600);
        return ctx.wait(400);
      }

      var cashOut = ctx.guard(function () { return cashOutNow(); });

      /* ------------------------------ controles ------------------------------ */

      var startBtn = ctx.button({ label: 'Empezar', icon: '🔼', variant: 'play',
                                  onClick: function () { start(); } });
      var higherBtn = ctx.button({ label: 'Más alta', sub: 'o igual', icon: '▲', variant: 'primary', size: 'lg',
                                   onClick: function () { guessHigher(); } });
      var lowerBtn = ctx.button({ label: 'Más baja', sub: 'o igual', icon: '▼', variant: 'violet', size: 'lg',
                                  onClick: function () { guessLower(); } });
      var cashBtn = ctx.button({ label: 'Cobrar', icon: '💰', variant: 'success', size: 'lg',
                                 onClick: function () { cashOut(); } });

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(el('.controls__group', {}, [lowerBtn, higherBtn, cashBtn, startBtn]));
      ctx.lockDuringPlay(startBtn, higherBtn, lowerBtn, cashBtn);

      ctx.setInfo(el('div', {}, [
        el('p', { text: 'Cada paso paga según la probabilidad real, contando las cartas que quedan ' +
                        'en el mazo: 0,98 ÷ probabilidad. Las cartas iguales cuentan como acierto ' +
                        'en ambas direcciones.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: 'var(--s-3)' } }),
        el('ul', { style: { fontSize: '12.5px', color: 'var(--ink-2)', lineHeight: '1.75' } }, [
          el('li', { text: '• El as es la carta más baja y el rey la más alta.' }),
          el('li', { text: '• Si fallas pierdes el bote completo, no sólo la última ganancia.' }),
          el('li', { text: '• Puedes cobrar tras cualquier acierto.' }),
          el('li', { text: '• Si agotas el mazo entero, cobras automáticamente.' })
        ])
      ]));

      renderCard(null);
      refresh();
      return { destroy: function () { playing = false; } };
    }
  });

  C.hiloLogic = { chance: chance, stepMultiplier: stepMultiplier, val: val, HOUSE_EDGE: HOUSE_EDGE };
})(typeof window !== 'undefined' ? window : globalThis);
