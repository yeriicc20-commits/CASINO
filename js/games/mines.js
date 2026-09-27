/* =========================================================================
   mines.js — Minas: descubre gemas sin tocar una mina.

   El multiplicador de cada gema sale de la probabilidad real que quedaba de
   acertar, con un 2% de ventaja para la casa. El tablero se genera al
   empezar la partida (las minas NO se mueven según dónde pulses).

   Dinero: UNA ronda por partida. Se cobra al empezar y se liquida al
   cobrar (con el bote) o al pisar una mina (con 0).
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, el = U.el;

  var SIZE = 5;                 // tablero 5×5
  var TILES = SIZE * SIZE;
  var HOUSE_EDGE = 0.02;

  /**
   * Multiplicador acumulado tras descubrir `picks` gemas con `mines` minas.
   * Es el inverso de la probabilidad de haber llegado hasta ahí:
   *   P = Π (seguras restantes / casillas restantes)
   */
  function multiplier(mines, picks) {
    if (picks <= 0) return 1;
    var safe = TILES - mines;
    if (picks > safe) return 0;
    var p = 1;
    for (var i = 0; i < picks; i++) {
      p *= (safe - i) / (TILES - i);
    }
    if (p <= 0) return 0;
    return Math.floor(((1 - HOUSE_EDGE) / p) * 100) / 100;
  }

  C.engine.register({
    id: 'mines',
    name: 'Minas',
    icon: '💎',
    accent: '#35d295',
    tagline: 'Gemas y minas · tú eliges el riesgo',
    desc: 'Descubre gemas para subir el multiplicador. Cobra antes de encontrar una mina.',
    minBet: 0.5,
    maxBet: 500,
    rtp: 98.0,

    create: function (ctx) {
      var rng = ctx.rng;
      var mineCount = 3;
      var board = [];            // true = mina
      var revealed = [];
      var picks = 0;
      var round = null;
      var playing = false;

      /* ------------------------------ escenario ------------------------------ */

      var grid = el('.mines__grid');
      var tileNodes = [];

      for (var i = 0; i < TILES; i++) {
        (function (i) {
          var node = el('.mtile', {
            role: 'button', tabindex: '0',
            'aria-label': 'Casilla ' + (i + 1)
          }, [
            el('span.mtile__face'),
            el('span.mtile__icon', { text: '' })
          ]);
          C.ui.attachTactile(node, function () { pick(i); }, 'click');
          node.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(i); }
          });
          tileNodes.push(node);
          grid.appendChild(node);
        })(i);
      }

      var multLabel = el('.mines__stat', {}, [
        el('.mines__statlabel', { text: 'Multiplicador' }),
        el('.mines__statval', { id: 'mMult', text: '1,00×' })
      ]);
      var potLabel = el('.mines__stat', {}, [
        el('.mines__statlabel', { text: 'Bote' }),
        el('.mines__statval', { id: 'mPot', text: U.money(0) })
      ]);
      var nextLabel = el('.mines__stat', {}, [
        el('.mines__statlabel', { text: 'Siguiente gema' }),
        el('.mines__statval', { id: 'mNext', text: '—' })
      ]);

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: '' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel); verdict.appendChild(verdictAmount);

      ctx.stage.appendChild(el('.mines', {}, [
        el('.mines__stats', {}, [multLabel, potLabel, nextLabel]),
        grid,
        verdict
      ]));

      var multVal = ctx.stage.querySelector('#mMult');
      var potVal = ctx.stage.querySelector('#mPot');
      var nextVal = ctx.stage.querySelector('#mNext');

      /* ------------------------------ mina/gema ------------------------------ */

      function newBoard() {
        board = new Array(TILES).fill(false);
        var idx = [];
        for (var i = 0; i < TILES; i++) idx.push(i);
        rng.shuffle(idx);
        for (var m = 0; m < mineCount; m++) board[idx[m]] = true;
        revealed = new Array(TILES).fill(false);
      }

      function refresh() {
        var stake = round ? round.stake : ctx.bet.get();
        var mult = multiplier(mineCount, picks);
        var pot = playing ? Math.round(stake * mult * 100) / 100 : 0;
        var nextMult = multiplier(mineCount, picks + 1);

        multVal.textContent = mult.toFixed(2).replace('.', ',') + '×';
        potVal.textContent = U.money(pot);
        nextVal.textContent = playing && nextMult > 0
          ? nextMult.toFixed(2).replace('.', ',') + '×  (' + U.money(Math.round(stake * nextMult * 100) / 100) + ')'
          : '—';

        grid.classList.toggle('is-live', playing);
        startBtn.style.display = playing ? 'none' : '';
        cashBtn.style.display = playing && picks > 0 ? '' : 'none';
        mineBtns.forEach(function (b) {
          b.disabled = playing;
          b.classList.toggle('is-disabled', playing);
          b.classList.toggle('is-active-credit', Number(b.dataset.mines) === mineCount);
        });
        ctx.bet.setEnabled(!playing);
      }

      /* ------------------------------ empezar ------------------------------ */

      var start = ctx.guard(function () {
        if (playing) return;
        round = ctx.open();
        if (!round) return;

        newBoard();
        picks = 0;
        playing = true;
        verdict.className = 'verdict';
        tileNodes.forEach(function (n) {
          n.className = 'mtile';
          n.querySelector('.mtile__icon').textContent = '';
        });
        ctx.play('open');
        refresh();
      });

      /* ------------------------------ descubrir ------------------------------ */

      var pick = ctx.guard(function (i) {
        if (!playing || revealed[i]) return;
        revealed[i] = true;
        var node = tileNodes[i];

        if (board[i]) {
          /* ---- mina: se pierde todo ---- */
          node.classList.add('is-mine', 'is-open');
          node.querySelector('.mtile__icon').textContent = '💥';
          ctx.play('explode');
          ctx.fx.shake(ctx.stage, 'hard');
          ctx.fx.flash('rgba(255,107,126,.22)');

          var result = round.settle(0, { picks: picks });
          round = null;
          playing = false;

          /* enseñamos el resto de minas */
          board.forEach(function (isMine, j) {
            if (isMine && j !== i) {
              tileNodes[j].classList.add('is-mine', 'is-open', 'is-faded');
              tileNodes[j].querySelector('.mtile__icon').textContent = '💣';
            } else if (!isMine && !revealed[j]) {
              tileNodes[j].classList.add('is-open', 'is-faded');
              tileNodes[j].querySelector('.mtile__icon').textContent = '💎';
            }
          });

          verdict.className = 'verdict is-show verdict--lose';
          verdictLabel.textContent = '¡Mina! Llevabas ' + picks + ' gema' + (picks === 1 ? '' : 's');
          verdictAmount.textContent = '−' + U.money(result.stake);
          picks = 0;
          refresh();
          root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2600);
          return ctx.wait(300);
        }

        /* ---- gema ---- */
        picks++;
        node.classList.add('is-gem', 'is-open');
        node.querySelector('.mtile__icon').textContent = '💎';
        ctx.play('coin');
        ctx.fx.sparks(node, 7, '#35d295');
        refresh();

        if (picks >= 15) C.progress.unlock('mines_clear');

        /* Si no quedan casillas seguras, se cobra automáticamente. */
        if (picks >= TILES - mineCount) {
          return cashOutNow('¡Tablero limpio! Has encontrado todas las gemas.');
        }
        return ctx.wait(60);
      });

      /* ------------------------------ cobrar ------------------------------ */

      function cashOutNow(message) {
        if (!playing || !round || picks === 0) return Promise.resolve();
        var mult = multiplier(mineCount, picks);
        var pot = Math.round(round.stake * mult * 100) / 100;
        var result = round.settle(pot, { picks: picks });
        round = null;
        playing = false;
        ctx.play('cashout');

        /* revelamos el tablero para que se vea dónde estaban las minas */
        board.forEach(function (isMine, j) {
          if (revealed[j]) return;
          tileNodes[j].classList.add('is-open', 'is-faded');
          tileNodes[j].querySelector('.mtile__icon').textContent = isMine ? '💣' : '💎';
          if (isMine) tileNodes[j].classList.add('is-mine');
        });

        verdict.className = 'verdict is-show verdict--win';
        verdictLabel.textContent = message || (picks + ' gemas  ·  ' + mult.toFixed(2).replace('.', ',') + '×');
        verdictAmount.textContent = '+' + U.money(result.net);
        ctx.celebrate(result, grid);
        picks = 0;
        refresh();
        root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2800);
        return ctx.wait(400);
      }

      var cashOut = ctx.guard(function () { return cashOutNow(); });

      /* ------------------------------ controles ------------------------------ */

      var startBtn = ctx.button({ label: 'Empezar', icon: '💎', variant: 'play',
                                  onClick: function () { start(); } });
      var cashBtn = ctx.button({ label: 'Cobrar', icon: '💰', variant: 'success', size: 'lg',
                                 onClick: function () { cashOut(); } });

      var mineBtns = [1, 3, 5, 10, 24].map(function (m) {
        var b = ctx.button({
          label: String(m), variant: 'ghost', size: 'sm',
          title: m + ' mina' + (m === 1 ? '' : 's') + ' — gema paga ' +
                 multiplier(m, 1).toFixed(2) + '×',
          onClick: function () { mineCount = m; C.audio.play('chip'); refresh(); }
        });
        b.dataset.mines = String(m);
        return b;
      });

      var mineRow = el('.mines__pick', {}, [
        el('span.vp__creditlabel', { text: 'Minas' })
      ].concat(mineBtns));

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(mineRow);
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(el('.controls__group', {}, [cashBtn, startBtn]));
      ctx.lockDuringPlay(startBtn, cashBtn);

      /* tabla de multiplicadores según minas */
      var rows = [1, 2, 3, 4, 5, 8, 12, 20].map(function (p) {
        return {
          cells: [String(p) + ' gemas',
                  multiplier(1, p) ? multiplier(1, p).toFixed(2) + '×' : '—',
                  multiplier(3, p) ? multiplier(3, p).toFixed(2) + '×' : '—',
                  multiplier(5, p) ? multiplier(5, p).toFixed(2) + '×' : '—',
                  multiplier(10, p) ? multiplier(10, p).toFixed(2) + '×' : '—']
        };
      });

      ctx.setInfo(el('div', {}, [
        el('p', { text: 'El tablero se genera al empezar la partida: las minas están fijas desde ' +
                        'el primer clic y no se mueven. Cada gema multiplica el bote según la ' +
                        'probabilidad real que quedaba de acertar (0,98 ÷ probabilidad).',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: 'var(--s-3)' } }),
        ctx.table(['Gemas', '1 mina', '3 minas', '5 minas', '10 minas'], rows, { compact: true }),
        el('p', { text: 'Con 24 minas una sola gema paga 24,50×, pero sólo aciertas 1 de cada 25 veces.',
                  style: { fontSize: '12.5px', color: 'var(--ink-3)', marginTop: 'var(--s-3)' } })
      ]));

      refresh();
      return { destroy: function () { playing = false; } };
    }
  });

  C.minesLogic = { multiplier: multiplier, SIZE: SIZE, TILES: TILES, HOUSE_EDGE: HOUSE_EDGE };
})(typeof window !== 'undefined' ? window : globalThis);
