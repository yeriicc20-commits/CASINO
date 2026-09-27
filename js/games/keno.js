/* =========================================================================
   keno.js — Keno: eliges hasta 10 números de 40 y salen 10.
   La tabla de pagos está calculada con la distribución hipergeométrica
   para dar un RTP cercano al 95%.
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, el = U.el;

  var POOL = 40;      // números del 1 al 40
  var DRAWN = 10;     // cuántos salen
  var MAX_PICKS = 10;

  /* Tabla resuelta con tools/solve-keno.js: para cada número de selecciones
     el RTP queda dentro de ±1 punto del 95%. Los botes de los niveles
     máximos están topados a valores razonables (acertar 10 de 10 es 1 entre
     847.660.528; si la fórmula fijara "lo que toca" saldrían pagos de
     cientos de millones), y el RTP sobrante se reparte entre los niveles
     bajos, que son los que se cobran de verdad.
     PAYS[nº elegidos][aciertos] = multiplicador del retorno total. */
  var PAYS = {
    1:  [0, 3.8],
    2:  [0, 0, 16.5],
    3:  [0, 0, 3, 45],
    4:  [0, 0, 2, 6.4, 120],
    5:  [0, 0, 0, 5.7, 28, 600],
    6:  [0, 0, 0, 3.5, 11, 71, 2000],
    7:  [0, 0, 0, 2.6, 5.4, 23, 215, 6000],
    8:  [0, 0, 0, 0, 6.5, 19, 110, 1450, 20000],
    9:  [0, 0, 0, 0, 4.5, 9.7, 39, 320, 6200, 40000],
    10: [0, 0, 0, 0, 0, 12, 36, 205, 2450, 76000, 100000]
  };

  function comb(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    var r = 1;
    for (var i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
  }

  /** Probabilidad hipergeométrica de acertar exactamente `hits`. */
  function probability(picks, hits) {
    return (comb(picks, hits) * comb(POOL - picks, DRAWN - hits)) / comb(POOL, DRAWN);
  }

  /** RTP teórico exacto para un número de selecciones. */
  function rtpFor(picks) {
    var table = PAYS[picks];
    if (!table) return 0;
    var sum = 0;
    for (var h = 0; h <= picks; h++) {
      sum += probability(picks, h) * (table[h] || 0);
    }
    return sum;
  }

  C.engine.register({
    id: 'keno',
    name: 'Keno',
    icon: '🔢',
    accent: '#a78bfa',
    tagline: 'Elige hasta 10 de 40 · hasta 100.000×',
    desc: 'Marca tus números, salen diez y cobras según cuántos aciertes. El premio gordo es enorme.',
    minBet: 0.5,
    maxBet: 200,
    rtp: 95.0,

    create: function (ctx) {
      var rng = ctx.rng;
      var picked = [];
      var drawn = [];
      var busy = false;

      /* ------------------------------ escenario ------------------------------ */

      var grid = el('.keno__grid');
      var cellNodes = {};
      for (var n = 1; n <= POOL; n++) {
        (function (n) {
          var node = el('.kcell', {
            role: 'button', tabindex: '0',
            'aria-label': 'Número ' + n, 'aria-pressed': 'false'
          }, [el('span.kcell__n', { text: String(n) })]);
          C.ui.attachTactile(node, function () { toggle(n); }, 'chip');
          node.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(n); }
          });
          cellNodes[n] = node;
          grid.appendChild(node);
        })(n);
      }

      var infoLine = el('.keno__info', { text: 'Elige entre 1 y 10 números' });
      var payHost = el('.keno__pays');

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: '' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel); verdict.appendChild(verdictAmount);

      ctx.stage.appendChild(el('.keno', {}, [infoLine, grid, payHost, verdict]));

      /* ------------------------------ selección ------------------------------ */

      function toggle(n) {
        if (busy) return;
        var i = picked.indexOf(n);
        if (i !== -1) {
          picked.splice(i, 1);
        } else {
          if (picked.length >= MAX_PICKS) {
            C.ui.toast('Como máximo 10 números.', { type: 'warn', icon: '🔢' });
            C.audio.play('deny');
            return;
          }
          picked.push(n);
        }
        refresh();
      }

      function quickPick() {
        if (busy) return;
        var count = picked.length || 6;
        picked = [];
        var pool = [];
        for (var i = 1; i <= POOL; i++) pool.push(i);
        rng.shuffle(pool);
        picked = pool.slice(0, count).sort(function (a, b) { return a - b; });
        C.audio.play('chip');
        refresh();
      }

      function clearPicks() {
        if (busy) return;
        picked = [];
        C.audio.play('back');
        refresh();
      }

      function refresh() {
        for (var n = 1; n <= POOL; n++) {
          var isPicked = picked.indexOf(n) !== -1;
          var isDrawn = drawn.indexOf(n) !== -1;
          var node = cellNodes[n];
          node.classList.toggle('is-picked', isPicked);
          node.classList.toggle('is-drawn', isDrawn && !isPicked);
          node.classList.toggle('is-hit', isDrawn && isPicked);
          node.setAttribute('aria-pressed', isPicked ? 'true' : 'false');
        }

        infoLine.textContent = picked.length === 0
          ? 'Elige entre 1 y 10 números'
          : picked.length + (picked.length === 1 ? ' número elegido' : ' números elegidos') +
            '  ·  RTP ' + (rtpFor(picked.length) * 100).toFixed(1).replace('.', ',') + '%';

        renderPays();
        playBtn.disabled = picked.length === 0 || busy;
        playBtn.classList.toggle('is-disabled', picked.length === 0);
      }

      function renderPays() {
        U.clear(payHost);
        if (!picked.length) return;
        var table = PAYS[picked.length];
        var bet = ctx.bet.get();
        var hits = drawn.length ? picked.filter(function (n) { return drawn.indexOf(n) !== -1; }).length : -1;

        var rows = [];
        for (var h = picked.length; h >= 0; h--) {
          if (!table[h]) continue;
          rows.push({
            cells: [h + ' de ' + picked.length, table[h] + '×', U.money(bet * table[h])],
            highlight: h === hits
          });
        }
        if (!rows.length) return;
        payHost.appendChild(el('.keno__paystitle', { text: 'Premios con ' + picked.length + ' números' }));
        payHost.appendChild(ctx.table(['Aciertos', 'Paga', 'Con tu apuesta'], rows, { compact: true }));
      }

      /* -------------------------------- sorteo -------------------------------- */

      var play = ctx.guard(function () {
        if (!picked.length) return;
        var round = ctx.open();
        if (!round) return;

        busy = true;
        drawn = [];
        verdict.className = 'verdict';
        refresh();

        /* El sorteo se resuelve antes de animar. */
        var pool = [];
        for (var i = 1; i <= POOL; i++) pool.push(i);
        rng.shuffle(pool);
        var result = pool.slice(0, DRAWN);

        /* Se van revelando uno a uno. */
        var chainP = Promise.resolve();
        result.forEach(function (n) {
          chainP = chainP.then(function () {
            drawn.push(n);
            refresh();
            var hit = picked.indexOf(n) !== -1;
            ctx.play(hit ? 'coin' : 'reveal');
            if (hit) ctx.fx.sparks(cellNodes[n], 6);
            return ctx.wait(190);
          });
        });

        return chainP.then(function () {
          var hits = picked.filter(function (n) { return drawn.indexOf(n) !== -1; }).length;
          var mult = (PAYS[picked.length] || [])[hits] || 0;
          var win = Math.round(round.stake * mult * 100) / 100;

          var res = round.settle(win, { hits: hits });
          busy = false;
          refresh();

          verdict.className = 'verdict is-show verdict--' +
            (res.net > 0 ? (mult >= 100 ? 'jackpot' : 'win') : res.net < 0 ? 'lose' : 'push');
          verdictLabel.textContent = hits + ' acierto' + (hits === 1 ? '' : 's') + ' de ' + picked.length;
          verdictAmount.textContent = (res.net > 0 ? '+' : res.net < 0 ? '−' : '') + U.money(Math.abs(res.net));

          ctx.celebrate(res, grid);
          root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2800);
          return ctx.wait(500);
        });
      });

      /* ------------------------------ controles ------------------------------ */

      var playBtn = ctx.button({ label: 'Sortear', icon: '🔢', variant: 'play',
                                 onClick: function () { play(); } });
      var quickBtn = ctx.button({ label: 'Al azar', icon: '🎲', variant: 'ghost', size: 'lg',
                                  title: 'Elige números aleatorios', onClick: quickPick });
      var clearBtn = ctx.button({ label: 'Limpiar', icon: '🧹', variant: 'ghost', size: 'lg',
                                  onClick: clearPicks });

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(el('.controls__group', {}, [clearBtn, quickBtn, playBtn]));
      ctx.lockDuringPlay(playBtn, quickBtn, clearBtn);

      var rtpRows = [];
      for (var k = 1; k <= MAX_PICKS; k++) {
        rtpRows.push({ cells: [k + ' número' + (k === 1 ? '' : 's'),
                               (PAYS[k][k] || 0) + '×',
                               (rtpFor(k) * 100).toFixed(1).replace('.', ',') + '%'] });
      }
      ctx.setInfo(el('div', {}, [
        el('p', { text: 'Se eligen hasta 10 números del 1 al 40 y se sortean 10. Cuantos más ' +
                        'números marques, más difícil es acertarlos todos pero mayor es el premio máximo.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: 'var(--s-3)' } }),
        ctx.table(['Elegidos', 'Pleno paga', 'RTP'], rtpRows, { compact: true })
      ]));

      refresh();
      return { destroy: function () { busy = false; } };
    }
  });

  C.kenoLogic = { PAYS: PAYS, POOL: POOL, DRAWN: DRAWN, MAX_PICKS: MAX_PICKS,
                  probability: probability, rtpFor: rtpFor, comb: comb };
})(typeof window !== 'undefined' ? window : globalThis);
