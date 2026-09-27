/* =========================================================================
   videopoker.js — Video Póker "Jacks or Better" (9/6, RTP 99,5%).

   Flujo: se apuesta y se reparten 5 cartas (una ronda), se marcan las que
   se quieren conservar y se cambian el resto. El premio se liquida sobre
   la misma ronda, así el dinero sólo se cobra una vez por mano.
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, D = C.deck, el = U.el;

  /* Tabla 9/6: full paga 9, color 6. Valores por crédito apostado.
     La columna de 5 créditos premia la escalera real (800 en vez de 250). */
  var PAYTABLE = [
    { key: 'ROYAL_FLUSH',    name: 'Escalera de color real', pay: [250, 500, 750, 1000, 4000] },
    { key: 'STRAIGHT_FLUSH', name: 'Escalera de color',      pay: [50, 100, 150, 200, 250] },
    { key: 'FOUR_KIND',      name: 'Póker',                  pay: [25, 50, 75, 100, 125] },
    { key: 'FULL_HOUSE',     name: 'Full',                   pay: [9, 18, 27, 36, 45] },
    { key: 'FLUSH',          name: 'Color',                  pay: [6, 12, 18, 24, 30] },
    { key: 'STRAIGHT',       name: 'Escalera',               pay: [4, 8, 12, 16, 20] },
    { key: 'THREE_KIND',     name: 'Trío',                   pay: [3, 6, 9, 12, 15] },
    { key: 'TWO_PAIR',       name: 'Doble pareja',           pay: [2, 4, 6, 8, 10] },
    { key: 'JACKS_BETTER',   name: 'Pareja de J o mejor',    pay: [1, 2, 3, 4, 5] }
  ];

  var PAY_BY_KEY = {};
  PAYTABLE.forEach(function (p) { PAY_BY_KEY[p.key] = p; });

  /**
   * Premio total (en euros) de una mano.
   * `credits` es cuántos créditos se apuestan (1..5) y `unit` el valor del
   * crédito, de modo que la apuesta total es credits * unit.
   */
  function payout(handKey, credits, unit) {
    var row = PAY_BY_KEY[handKey];
    if (!row) return 0;
    var c = U.clamp(Math.round(credits), 1, 5);
    return Math.round(row.pay[c - 1] * unit * 100) / 100;
  }

  /* ============================== interfaz ============================== */

  C.engine.register({
    id: 'videopoker',
    name: 'Video Póker',
    icon: '🂡',
    accent: '#8b5cf6',
    tagline: 'Jacks or Better 9/6 · escalera real 4.000×',
    desc: 'Cinco cartas, decides cuáles guardas y cambias el resto. La tabla 9/6 es la más generosa del casino.',
    minBet: 0.25,
    maxBet: 100,
    rtp: 99.5,

    create: function (ctx) {
      var rng = ctx.rng;
      var deck = [];
      var hand = [];
      var held = [false, false, false, false, false];
      var phase = 'idle';    // idle | hold
      var round = null;
      var credits = 5;       // apostar 5 créditos es lo óptimo (escalera real 4.000×)
      var lastEval = null;

      /* ------------------------------ escenario ------------------------------ */

      var handRow = el('.vp__hand');
      var resultLine = el('.vp__result', { text: 'Pulsa REPARTIR para empezar' });
      var payHost = el('.vp__pay');

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: '' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel); verdict.appendChild(verdictAmount);

      ctx.stage.appendChild(el('.vp', {}, [payHost, handRow, resultLine, verdict]));

      /* ------------------------- tabla de pagos en vivo ------------------------- */

      function renderPaytable() {
        U.clear(payHost);
        var head = el('tr', {}, [el('th', { text: 'Mano' })]);
        for (var c = 1; c <= 5; c++) {
          head.appendChild(el('th', {
            text: String(c),
            class: c === credits ? 'is-col' : ''
          }));
        }
        var body = el('tbody');
        PAYTABLE.forEach(function (p) {
          var tr = el('tr', p.key === (lastEval && lastEval.key) ? { class: 'is-hl is-flash' } : {});
          tr.appendChild(el('td', { text: p.name }));
          for (var c = 1; c <= 5; c++) {
            tr.appendChild(el('td', {
              text: String(p.pay[c - 1]),
              class: c === credits ? 'is-col' : ''
            }));
          }
          body.appendChild(tr);
        });
        payHost.appendChild(el('table.ptable.ptable--compact.vp__ptable', {}, [
          el('thead', {}, [head]), body
        ]));
      }

      /* -------------------------------- cartas -------------------------------- */

      function cardNode(card, idx, faceDown) {
        if (faceDown) {
          return el('.card.card--back.vp__card', {}, [el('span.card__pattern')]);
        }
        var node = el('.card.card--flip.vp__card' + (card.red ? '.card--red' : '.card--black'), {
          role: 'button', tabindex: phase === 'hold' ? '0' : '-1',
          'aria-pressed': held[idx] ? 'true' : 'false',
          'aria-label': card.label + ' — ' + (held[idx] ? 'guardada' : 'se cambia')
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
        node.style.animationDelay = (idx * 70) + 'ms';
        if (held[idx]) node.classList.add('is-held');
        if (phase !== 'hold') node.classList.add('is-locked');
        return node;
      }

      function render() {
        U.clear(handRow);
        for (var i = 0; i < 5; i++) {
          (function (i) {
            var slot = el('.vp__slot');
            var node = hand[i]
              ? cardNode(hand[i], i, false)
              : el('.card.card--back.vp__card', {}, [el('span.card__pattern')]);
            var tag = el('.vp__hold' + (held[i] ? '.is-on' : ''), { text: 'Guardar' });

            if (phase === 'hold') {
              C.ui.attachTactile(node, function () { toggleHold(i); }, 'flip');
              node.addEventListener('keydown', function (e) {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleHold(i); }
              });
            }
            slot.appendChild(node);
            slot.appendChild(tag);
            handRow.appendChild(slot);
          })(i);
        }
        renderPaytable();
        refreshButtons();
      }

      function toggleHold(i) {
        if (phase !== 'hold') return;
        held[i] = !held[i];
        C.audio.play('flip');
        render();
      }

      /* ------------------------------- botones ------------------------------- */

      var dealBtn, drawBtn, creditBtns;

      function refreshButtons() {
        dealBtn.style.display = phase === 'hold' ? 'none' : '';
        drawBtn.style.display = phase === 'hold' ? '' : 'none';
        creditBtns.forEach(function (b, i) {
          b.classList.toggle('is-active-credit', i + 1 === credits);
          b.disabled = phase === 'hold';
          b.classList.toggle('is-disabled', phase === 'hold');
        });
        ctx.bet.setEnabled(phase !== 'hold');
      }

      /* ------------------------------- reparto ------------------------------- */

      var deal = ctx.guard(function () {
        if (phase === 'hold') return;

        var unit = ctx.bet.get();
        var total = Math.round(unit * credits * 100) / 100;
        round = ctx.open(total);
        if (!round) return;

        deck = D.build(1, rng);
        hand = [];
        held = [false, false, false, false, false];
        lastEval = null;
        verdict.className = 'verdict';
        phase = 'dealing';
        render();

        ctx.play('shuffle');

        /* reparto de las 5 cartas, una a una */
        var chain = Promise.resolve();
        for (var i = 0; i < 5; i++) {
          chain = chain.then(function () {
            hand.push(deck.pop());
            ctx.play('card');
            render();
            return ctx.wait(110);
          });
        }

        return chain.then(function () {
          phase = 'hold';
          /* Sugerencia: marcamos automáticamente lo que ya forma premio. */
          var ev = D.evaluatePoker(hand);
          if (ev.rank >= 1 || ev.key === 'LOW_PAIR') {
            ev.cards.forEach(function (i) { held[i] = true; });
          }
          resultLine.textContent = ev.rank >= 1
            ? 'Ya tienes ' + ev.name + ' — cambia si quieres mejorar'
            : 'Elige las cartas que guardas y pulsa CAMBIAR';
          resultLine.className = 'vp__result';
          render();
        });
      });

      /* -------------------------------- cambio -------------------------------- */

      var draw = ctx.guard(function () {
        if (phase !== 'hold' || !round) return;
        phase = 'drawing';
        render();

        /* Sustituimos las no guardadas. */
        var chain = Promise.resolve();
        for (var i = 0; i < 5; i++) {
          if (held[i]) continue;
          (function (i) {
            chain = chain.then(function () {
              hand[i] = deck.pop();
              ctx.play('card');
              render();
              return ctx.wait(140);
            });
          })(i);
        }

        return chain.then(function () {
          var ev = D.evaluatePoker(hand);
          lastEval = ev;
          var unit = round.stake / credits;
          var win = payout(ev.key, credits, unit);

          var result = round.settle(win, { hand: ev.key });
          round = null;
          phase = 'idle';

          /* resaltamos las cartas que forman el premio */
          render();
          if (win > 0 && ev.cards.length) {
            var nodes = U.qsa('.vp__card', handRow);
            nodes.forEach(function (n, i) {
              if (ev.cards.indexOf(i) !== -1) n.classList.add('is-win');
              else n.classList.add('is-dim');
            });
          }

          resultLine.textContent = win > 0
            ? ev.name + ' — ' + U.money(win)
            : 'Nada esta vez (' + ev.name + ')';
          resultLine.className = 'vp__result ' + (win > 0 ? 'is-win' : 'is-lose');

          verdict.className = 'verdict is-show verdict--' +
            (result.net > 0 ? 'win' : result.net < 0 ? 'lose' : 'push');
          verdictLabel.textContent = ev.name;
          verdictAmount.textContent = (result.net > 0 ? '+' : result.net < 0 ? '−' : '') +
                                      U.money(Math.abs(result.net));

          if (ev.key === 'ROYAL_FLUSH') {
            C.progress.unlock('royal');
            ctx.fx.coinRain(2400);
          }
          ctx.celebrate(result, handRow);
          root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2600);
          return ctx.wait(500);
        });
      });

      /* ------------------------------ controles ------------------------------ */

      dealBtn = ctx.button({ label: 'Repartir', icon: '🂠', variant: 'play',
                             onClick: function () { deal(); } });
      drawBtn = ctx.button({ label: 'Cambiar', icon: '♻️', variant: 'play',
                             onClick: function () { draw(); } });

      creditBtns = [1, 2, 3, 4, 5].map(function (c) {
        var b = ctx.button({
          label: String(c), variant: 'ghost', size: 'sm',
          title: 'Apostar ' + c + ' crédito' + (c > 1 ? 's' : ''),
          onClick: function () { credits = c; C.audio.play('chip'); render(); }
        });
        return b;
      });

      var creditRow = el('.vp__credits', {}, [
        el('span.vp__creditlabel', { text: 'Créditos' })
      ].concat(creditBtns).concat([
        ctx.button({
          label: 'MÁX', variant: 'primary', size: 'sm',
          title: 'Apostar 5 créditos: la escalera real pasa a pagar 4.000×',
          onClick: function () { credits = 5; C.audio.play('chip'); render(); }
        })
      ]));

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(creditRow);
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(el('.controls__group', {}, [dealBtn, drawBtn]));
      ctx.lockDuringPlay(dealBtn, drawBtn);

      /* teclado: 1-5 alternan guardar, espacio reparte/cambia */
      function onKey(e) {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.code === 'Space') {
          e.preventDefault();
          if (phase === 'hold') draw(); else deal();
          return;
        }
        var n = parseInt(e.key, 10);
        if (phase === 'hold' && n >= 1 && n <= 5) toggleHold(n - 1);
      }
      document.addEventListener('keydown', onKey);

      /* información */
      ctx.setInfo(el('div', {}, [
        el('p', { text: 'La apuesta total es el valor del crédito × el número de créditos (1 a 5). ' +
                        'Con 5 créditos la escalera real pasa de 250× a 800× por crédito, así que ' +
                        'apostar el máximo es siempre lo óptimo.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: 'var(--s-3)' } }),
        el('p', { text: 'Tabla 9/6: el full paga 9 y el color 6 por crédito. Es la versión más ' +
                        'generosa del juego (99,5% de retorno con estrategia óptima).',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)' } }),
        el('p', { text: 'Atajos: 1–5 guardan o sueltan cada carta, espacio reparte y cambia.',
                  style: { fontSize: '12.5px', color: 'var(--ink-3)', marginTop: 'var(--s-3)' } })
      ]));

      render();

      return { destroy: function () { document.removeEventListener('keydown', onKey); } };
    }
  });

  C.videopokerLogic = { PAYTABLE: PAYTABLE, payout: payout };
})(typeof window !== 'undefined' ? window : globalThis);
