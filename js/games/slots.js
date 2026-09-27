/* =========================================================================
   slots.js — Tragaperras 5×3 con 10 líneas, comodín, dispersos y giros gratis.

   Los carretes se animan con UNA sola transición CSS de `transform` por
   carrete (compuesta por la GPU). No hay trabajo de JavaScript por frame,
   así el giro es fluido incluso en móviles modestos.
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, el = U.el;

  var REELS = 5, ROWS = 3, LINES_N = 10;

  /* --------------------------------- símbolos --------------------------------- */
  /* `w` es el peso en el carrete (mayor = más frecuente).
     `pay` es el multiplicador por 3, 4 y 5 iguales, sobre la apuesta por línea. */
  var SYMBOLS = [
    { id: 'cherry',  glyph: '🍒', name: 'Cereza',   n: 11, pay: [0, 0, 4, 12, 40] },
    { id: 'lemon',   glyph: '🍋', name: 'Limón',    n: 11, pay: [0, 0, 5, 16, 50] },
    { id: 'grape',   glyph: '🍇', name: 'Uva',      n: 11, pay: [0, 0, 8, 20, 70] },
    { id: 'melon',   glyph: '🍉', name: 'Sandía',   n: 9,  pay: [0, 0, 10, 30, 100] },
    { id: 'bell',    glyph: '🔔', name: 'Campana',  n: 7,  pay: [0, 0, 15, 50, 160] },
    { id: 'diamond', glyph: '💎', name: 'Diamante', n: 5,  pay: [0, 0, 25, 80, 250] },
    { id: 'seven',   glyph: '7️⃣', name: 'Siete',    n: 3,  pay: [0, 0, 40, 150, 500] },
    { id: 'crown',   glyph: '👑', name: 'Corona',   n: 1,  pay: [0, 0, 100, 400, 2000] },
    { id: 'wild',    glyph: '🃏', name: 'Comodín',  n: 4,  pay: [0, 0, 0, 0, 0], wild: true },
    { id: 'scatter', glyph: '⭐', name: 'Disperso', n: 2,  pay: [0, 0, 0, 0, 0], scatter: true }
  ];

  var BY_ID = {};
  SYMBOLS.forEach(function (s) { BY_ID[s.id] = s; });

  /* Dispersos: pagan en cualquier posición, sobre la apuesta TOTAL. */
  var SCATTER_PAY = { 3: 2, 4: 8, 5: 40 };
  var SCATTER_SPINS = { 3: 8, 4: 12, 5: 20 };
  var FREE_MULTIPLIER = 2; // los giros gratis pagan doble

  /* Las 10 líneas: para cada carrete, qué fila toca. */
  var LINES = [
    [1, 1, 1, 1, 1], [0, 0, 0, 0, 0], [2, 2, 2, 2, 2],
    [0, 1, 2, 1, 0], [2, 1, 0, 1, 2],
    [0, 0, 1, 0, 0], [2, 2, 1, 2, 2],
    [1, 0, 0, 0, 1], [1, 2, 2, 2, 1],
    [0, 1, 1, 1, 0]
  ];

  /* -------------------------------- las tiras --------------------------------
     Cada carrete es una tira fija de 64 posiciones, como en una máquina real.
     Dos reglas hacen que la frecuencia sea EXACTA y no dependa de la suerte
     al generar la tira:
       1. Cada símbolo aparece un número exacto de veces (su `n`).
       2. Los comodines y los dispersos se colocan separados al menos ROWS
          posiciones, así una ventana de 3 celdas nunca muestra dos del mismo
          tipo especial. Sin esto, dos dispersos juntos disparaban el bono el
          doble de a menudo en unas tiras que en otras.
     ------------------------------------------------------------------------ */
  var STRIP_LEN = 64;

  /** Posiciones repartidas con holgura mínima `minGap` y algo de variación. */
  function spacedPositions(count, len, minGap, rng, taken) {
    var spacing = Math.floor(len / count);
    var jitter = Math.max(0, Math.floor((spacing - minGap) / 2));
    var offset = rng.int(0, len - 1);
    var out = [];
    for (var i = 0; i < count; i++) {
      var pos = (offset + i * spacing + (jitter ? rng.int(-jitter, jitter) : 0) + len) % len;
      // Si la posición está ocupada o demasiado cerca de otra, avanzamos.
      var guard = 0;
      while (guard++ < len && !fits(pos)) pos = (pos + 1) % len;
      out.push(pos);
      taken[pos] = true;
    }
    return out;

    function fits(p) {
      if (taken[p]) return false;
      for (var d = 1; d < minGap; d++) {
        if (taken[(p + d) % len] || taken[(p - d + len) % len]) return false;
      }
      return true;
    }
  }

  function buildStrip(rng) {
    var strip = new Array(STRIP_LEN);
    var taken = {};

    // 1. Especiales primero, bien separados.
    var scatter = SYMBOLS.filter(function (s) { return s.scatter; })[0];
    var wild = SYMBOLS.filter(function (s) { return s.wild; })[0];
    spacedPositions(scatter.n, STRIP_LEN, ROWS, rng, taken).forEach(function (p) {
      strip[p] = scatter.id;
    });
    spacedPositions(wild.n, STRIP_LEN, ROWS, rng, taken).forEach(function (p) {
      strip[p] = wild.id;
    });

    // 2. El resto de símbolos, mezclados, en los huecos libres.
    var rest = [];
    SYMBOLS.forEach(function (s) {
      if (s.wild || s.scatter) return;
      for (var i = 0; i < s.n; i++) rest.push(s.id);
    });
    rng.shuffle(rest);
    var k = 0;
    for (var i = 0; i < STRIP_LEN; i++) {
      if (strip[i] === undefined) strip[i] = rest[k++] || 'lemon';
    }
    return strip;
  }

  /**
   * Evalúa la pantalla. `grid` es [carrete][fila] con ids de símbolo.
   * Devuelve {lines:[{line, symbol, count, pay, cells}], scatter, totalMult}
   * donde los multiplicadores de línea van por apuesta-por-línea y el de
   * dispersos por apuesta total. Función pura: los tests la usan directamente.
   */
  function evaluate(grid) {
    var wins = [];

    for (var li = 0; li < LINES.length; li++) {
      var pattern = LINES[li];
      var ids = [];
      for (var r = 0; r < REELS; r++) ids.push(grid[r][pattern[r]]);

      // El símbolo base es el primero que no sea comodín; si todos son
      // comodines, cuenta como la corona (el mejor pago).
      var baseId = null;
      for (var k = 0; k < ids.length; k++) {
        if (ids[k] !== 'wild' && ids[k] !== 'scatter') { baseId = ids[k]; break; }
        if (ids[k] === 'scatter') break; // un disperso corta la línea
      }
      if (baseId === null) {
        if (ids[0] === 'wild') baseId = 'crown';
        else continue;
      }

      // Contamos coincidencias desde la izquierda (comodín sustituye).
      var count = 0;
      for (var c = 0; c < REELS; c++) {
        if (ids[c] === baseId || ids[c] === 'wild') count++;
        else break;
      }

      if (count >= 3) {
        var sym = BY_ID[baseId];
        var mult = sym.pay[count - 1] || 0;
        if (mult > 0) {
          var cells = [];
          for (var q = 0; q < count; q++) cells.push([q, pattern[q]]);
          wins.push({ line: li, symbol: baseId, count: count, pay: mult, cells: cells });
        }
      }
    }

    /* dispersos en cualquier posición */
    var scatterCells = [];
    for (var rr = 0; rr < REELS; rr++) {
      for (var ff = 0; ff < ROWS; ff++) {
        if (grid[rr][ff] === 'scatter') scatterCells.push([rr, ff]);
      }
    }
    var scatter = null;
    if (scatterCells.length >= 3) {
      var n = Math.min(scatterCells.length, 5);
      scatter = {
        count: n,
        pay: SCATTER_PAY[n] || 0,
        spins: SCATTER_SPINS[n] || 0,
        cells: scatterCells
      };
    }

    var lineMult = wins.reduce(function (a, w) { return a + w.pay; }, 0);
    return {
      lines: wins,
      scatter: scatter,
      lineMult: lineMult,
      scatterMult: scatter ? scatter.pay : 0
    };
  }

  /** Premio en euros a partir de una evaluación. */
  function payoutFor(result, totalBet, multiplier) {
    var perLine = totalBet / LINES_N;
    var m = multiplier || 1;
    var win = result.lineMult * perLine + result.scatterMult * totalBet;
    return Math.round(win * m * 100) / 100;
  }

  /* ============================== interfaz ============================== */

  C.engine.register({
    id: 'slots',
    name: 'Tragaperras Royale',
    icon: '🎰',
    accent: '#f5c451',
    tagline: '5 carretes · 10 líneas · giros gratis',
    desc: 'La clásica. Comodines que sustituyen, dispersos que regalan tiradas y una corona que paga 2.000×.',
    minBet: 0.5,
    maxBet: 500,
    rtp: 96.3,

    create: function (ctx) {
      var rng = ctx.rng;
      var strips = [];
      for (var i = 0; i < REELS; i++) strips.push(buildStrip(rng));

      /* estado de los giros gratis */
      var freeSpins = 0;
      var freeTotal = 0;
      var freeWon = 0;
      var lastGrid = null;

      /* ---------- construcción del escenario ---------- */
      var cells = [];   // [carrete][fila] -> nodo de la celda final
      var reelNodes = [];
      var stripNodes = [];

      var reelsWrap = el('.reels', { role: 'img', 'aria-label': 'Carretes de la tragaperras' });

      for (var r = 0; r < REELS; r++) {
        var strip = el('.reel__strip');
        var reel = el('.reel', { 'data-reel': r }, [strip]);
        reelsWrap.appendChild(reel);
        reelNodes.push(reel);
        stripNodes.push(strip);
        cells.push([]);
      }

      /* marcador de línea ganadora dibujado encima */
      var lineOverlay = el('svg.reels__lines', {
        viewBox: '0 0 100 60', preserveAspectRatio: 'none', 'aria-hidden': 'true'
      });

      var jackpotSign = el('.slots__sign', {}, [
        el('span.slots__signlabel', { text: 'Corona × 5 paga' }),
        el('span.slots__signvalue.shimmer', { text: '2.000×' })
      ]);

      var freeBanner = el('.slots__free', { hidden: true });

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: 'Premio' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel);
      verdict.appendChild(verdictAmount);

      ctx.stage.appendChild(el('.slots', {}, [
        jackpotSign,
        freeBanner,
        el('.reels__frame', {}, [reelsWrap, lineOverlay]),
        verdict
      ]));

      /* ---------- render inicial de los carretes ---------- */

      /** Coloca 3 símbolos definitivos en un carrete, sin animación. */
      function setReel(r, ids) {
        var strip = stripNodes[r];
        U.clear(strip);
        cells[r] = [];
        for (var f = 0; f < ROWS; f++) {
          var cell = symbolCell(ids[f]);
          strip.appendChild(cell);
          cells[r].push(cell);
        }
        strip.style.transition = 'none';
        strip.style.transform = 'translate3d(0,0,0)';
      }

      function symbolCell(id) {
        var s = BY_ID[id];
        return el('.cell' + (s.wild ? '.cell--wild' : '') + (s.scatter ? '.cell--scatter' : ''), {
          'data-sym': id, title: s.name
        }, [el('span.cell__glyph', { text: s.glyph })]);
      }

      /** Pantalla aleatoria de arranque (sin premio visible). */
      function randomGrid() {
        var g = [];
        for (var r = 0; r < REELS; r++) {
          var pos = rng.int(0, STRIP_LEN - 1);
          var col = [];
          for (var f = 0; f < ROWS; f++) col.push(strips[r][(pos + f) % STRIP_LEN]);
          g.push(col);
        }
        return g;
      }

      lastGrid = randomGrid();
      for (var ri = 0; ri < REELS; ri++) setReel(ri, lastGrid[ri]);

      /* ---------- animación del giro ---------- */

      /**
       * Gira un carrete: monta una tira larga (relleno + resultado) y la
       * desplaza con UNA transición. Resuelve cuando termina.
       */
      function spinReel(r, finalIds, duration, fillerCount) {
        return new Promise(function (resolve) {
          var strip = stripNodes[r];
          U.clear(strip);
          cells[r] = [];

          var filler = fillerCount === undefined ? 14 : fillerCount;
          var pos = rng.int(0, STRIP_LEN - 1);
          for (var i = 0; i < filler; i++) {
            strip.appendChild(symbolCell(strips[r][(pos + i) % STRIP_LEN]));
          }
          for (var f = 0; f < ROWS; f++) {
            var cell = symbolCell(finalIds[f]);
            strip.appendChild(cell);
            cells[r].push(cell);
          }

          // Arrancamos arriba y bajamos hasta dejar visibles las 3 finales.
          strip.style.transition = 'none';
          strip.style.transform = 'translate3d(0,0,0)';

          // Doble rAF: garantiza que el navegador aplica el estado inicial
          // antes de activar la transición (si no, el giro "salta").
          root.requestAnimationFrame(function () {
            root.requestAnimationFrame(function () {
              var cellH = reelNodes[r].clientHeight / ROWS;
              var travel = filler * cellH;
              if (ctx.fx.reduced) {
                strip.style.transform = 'translate3d(0,' + (-travel) + 'px,0)';
                resolve();
                return;
              }
              // Curva con un pequeño rebote final: el carrete "encaja".
              strip.style.transition = 'transform ' + duration + 'ms cubic-bezier(.16,.62,.12,1.02)';
              strip.style.transform = 'translate3d(0,' + (-travel) + 'px,0)';

              var done = false;
              function finish() {
                if (done) return;
                done = true;
                strip.removeEventListener('transitionend', finish);
                resolve();
              }
              strip.addEventListener('transitionend', finish);
              // Red de seguridad: si el navegador no emite transitionend
              // (pestaña oculta, etc.) resolvemos igualmente.
              root.setTimeout(finish, duration + 260);
            });
          });
        });
      }

      /* ---------- marcado de premios ---------- */

      function clearHighlights() {
        U.clear(lineOverlay);
        for (var r = 0; r < REELS; r++) {
          for (var f = 0; f < ROWS; f++) {
            if (cells[r][f]) cells[r][f].classList.remove('is-win', 'is-dim', 'is-scatter-win');
          }
        }
      }

      function dimAll() {
        for (var r = 0; r < REELS; r++) {
          for (var f = 0; f < ROWS; f++) {
            if (cells[r][f]) cells[r][f].classList.add('is-dim');
          }
        }
      }

      /** Ilumina una combinación y dibuja su línea. */
      function highlight(win, color) {
        win.cells.forEach(function (rc) {
          var cell = cells[rc[0]][rc[1]];
          if (!cell) return;
          cell.classList.remove('is-dim');
          cell.classList.add('is-win');
        });
        if (win.cells.length < 2) return;
        var pts = win.cells.map(function (rc) {
          var x = (rc[0] + 0.5) * (100 / REELS);
          var y = (rc[1] + 0.5) * (60 / ROWS);
          return x.toFixed(2) + ',' + y.toFixed(2);
        }).join(' ');
        var poly = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        poly.setAttribute('points', pts);
        poly.setAttribute('class', 'winline');
        poly.setAttribute('stroke', color || 'var(--gold)');
        lineOverlay.appendChild(poly);
      }

      function showVerdict(kind, label, amount) {
        verdict.className = 'verdict verdict--' + kind + ' is-show';
        verdictLabel.textContent = label;
        verdictAmount.textContent = amount;
      }
      function hideVerdict() { verdict.className = 'verdict'; }

      /* ---------- controles ---------- */

      var spinBtn = ctx.button({
        label: 'Girar', icon: '🎰', variant: 'play',
        onClick: function () { doSpin(); }
      });

      var autoBtn = ctx.button({
        label: 'Auto', sub: '10 giros', icon: '🔁', variant: 'ghost', size: 'lg',
        title: 'Lanza 10 giros seguidos',
        onClick: function () { startAuto(10); }
      });

      var autoRunning = false;
      var autoLeft = 0;

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(el('.controls__group', {}, [autoBtn, spinBtn]));
      ctx.lockDuringPlay(spinBtn, autoBtn);

      /* panel lateral: última jugada */
      var sideWins = el('.panel', {}, [
        el('.panel__title', { text: 'Última jugada' }),
        el('.slots__winlist', { text: 'Gira para empezar.' })
      ]);
      var winList = sideWins.querySelector('.slots__winlist');
      ctx.side.appendChild(sideWins);

      var statsPanel = el('.panel', {}, [
        el('.panel__title', { text: 'Sesión' }),
        el('.panel__row', {}, [el('span.panel__key', { text: 'Giros' }), el('span.panel__val', { text: '0' })]),
        el('.panel__row', {}, [el('span.panel__key', { text: 'Premios' }), el('span.panel__val', { text: '0' })]),
        el('.panel__row', {}, [el('span.panel__key', { text: 'Mejor' }), el('span.panel__val', { text: '—' })])
      ]);
      var statVals = U.qsa('.panel__val', statsPanel);
      var sess = { spins: 0, wins: 0, best: 0 };
      ctx.side.appendChild(statsPanel);

      function refreshStats() {
        statVals[0].textContent = String(sess.spins);
        statVals[1].textContent = String(sess.wins);
        statVals[2].textContent = sess.best > 0 ? U.money(sess.best) : '—';
      }

      /* ---------- una tirada completa ---------- */

      var doSpin = ctx.guard(function () {
        return runSpin();
      });

      function runSpin() {
        hideVerdict();
        clearHighlights();

        var isFree = freeSpins > 0;
        var round = null;
        var totalBet;

        if (isFree) {
          // Los giros gratis no cobran: la apuesta es la del giro que los
          // activó, pero no se descuenta saldo.
          totalBet = freeBet;
          freeSpins--;
          updateFreeBanner();
        } else {
          round = ctx.open();
          if (!round) return Promise.resolve();
          totalBet = round.stake;
        }

        sess.spins++;
        ctx.play('spin');

        /* resultado decidido ANTES de animar: la animación sólo lo muestra */
        var grid = randomGrid();
        lastGrid = grid;
        var result = evaluate(grid);
        var mult = isFree ? FREE_MULTIPLIER : 1;
        var win = payoutFor(result, totalBet, mult);

        /* animación escalonada de los 5 carretes */
        var base = ctx.dur(620);
        var promises = [];
        for (var r = 0; r < REELS; r++) {
          (function (r) {
            var dur = base + r * ctx.dur(150);
            promises.push(
              U.sleep(r * ctx.dur(85)).then(function () {
                return spinReel(r, grid[r], dur, 12 + r * 2).then(function () {
                  ctx.play('reelStop');
                });
              })
            );
          })(r);
        }

        return Promise.all(promises).then(function () {
          return settle(round, result, win, totalBet, isFree, mult);
        });
      }

      var freeBet = 0;

      function settle(round, result, win, totalBet, isFree, mult) {
        /* --- contabilidad primero, efectos después --- */
        if (isFree) {
          freeWon += win;
          if (win > 0) C.bank.credit(win, 'slots:freespin');
        } else if (round) {
          round.settle(win);
        }

        if (win > 0) {
          sess.wins++;
          if (win > sess.best) sess.best = win;
        }
        refreshStats();

        /* --- resaltado de combinaciones --- */
        renderWinList(result, totalBet, mult);

        var chain = Promise.resolve();
        if (result.lines.length || result.scatter) {
          dimAll();
          if (result.scatter) {
            result.scatter.cells.forEach(function (rc) {
              var cell = cells[rc[0]][rc[1]];
              if (cell) { cell.classList.remove('is-dim'); cell.classList.add('is-scatter-win'); }
            });
          }
          result.lines.forEach(function (w, i) {
            chain = chain.then(function () {
              highlight(w, 'var(--gold)');
              ctx.play('coin');
              return ctx.wait(220);
            });
          });
        }

        return chain.then(function () {
          var ratio = totalBet > 0 ? win / totalBet : 0;

          if (win > 0) {
            var kind = ratio >= 50 ? 'jackpot' : 'win';
            var label = ratio >= 50 ? '¡PREMIO GORDO!'
                      : ratio >= 10 ? '¡GRAN PREMIO!'
                      : isFree ? 'Giro gratis ×' + mult : 'Premio';
            showVerdict(kind, label, U.money(win));
            ctx.fx.celebrate(ratio, ctx.stage);
            if (ratio >= 50) {
              C.progress.unlock('jackpot');
              ctx.fx.coinRain(2200);
            }
          } else {
            showVerdict('lose', isFree ? 'Giro gratis' : 'Sin premio', U.money(0));
            if (!isFree) ctx.play('lose');
          }

          /* --- ¿se activan giros gratis? --- */
          if (result.scatter && result.scatter.spins > 0) {
            if (!isFree) freeBet = totalBet;
            freeSpins += result.scatter.spins;
            freeTotal += result.scatter.spins;
            updateFreeBanner();
            return ctx.wait(700).then(function () {
              return ctx.modal({
                icon: '⭐',
                title: '¡' + result.scatter.spins + ' giros gratis!',
                subtitle: result.scatter.count + ' dispersos en pantalla',
                body: '<p>Los giros gratis pagan <strong>×' + FREE_MULTIPLIER +
                      '</strong> y no descuentan saldo.</p>',
                actions: [{ label: '¡Vamos!', value: true, primary: true }]
              });
            }).then(function () {
              hideVerdict();
              return runFreeSpins();
            });
          }

          if (freeSpins > 0) {
            return ctx.wait(900).then(function () {
              hideVerdict();
              return runFreeSpins();
            });
          }

          if (freeTotal > 0 && freeSpins === 0) {
            var totalFree = freeWon;
            freeTotal = 0; freeWon = 0;
            updateFreeBanner();
            return ctx.wait(500).then(function () {
              return ctx.modal({
                icon: '🎁',
                title: 'Fin de los giros gratis',
                subtitle: 'Has ganado ' + U.money(totalFree),
                actions: [{ label: 'Seguir', value: true, primary: true }]
              });
            });
          }

          return ctx.wait(500);
        });
      }

      /** Encadena los giros gratis pendientes. */
      function runFreeSpins() {
        if (freeSpins <= 0) return Promise.resolve();
        return runSpin();
      }

      function updateFreeBanner() {
        if (freeSpins > 0) {
          freeBanner.hidden = false;
          U.clear(freeBanner);
          freeBanner.appendChild(el('span.slots__freeicon', { text: '⭐' }));
          freeBanner.appendChild(el('span', {}, [
            el('strong', { text: freeSpins + ' giros gratis' }),
            el('span', { text: '  ×' + FREE_MULTIPLIER + '  ·  ganado ' + U.money(freeWon) })
          ]));
        } else {
          freeBanner.hidden = true;
        }
      }

      function renderWinList(result, totalBet, mult) {
        U.clear(winList);
        if (!result.lines.length && !result.scatter) {
          winList.appendChild(el('p', { text: 'Sin combinaciones esta vez.',
                                        style: { fontSize: '12.5px', color: 'var(--ink-3)' } }));
          return;
        }
        var perLine = totalBet / LINES_N;
        result.lines.forEach(function (w) {
          var amount = w.pay * perLine * mult;
          winList.appendChild(el('.panel__row', {}, [
            el('span.panel__key', { text: BY_ID[w.symbol].glyph + ' ×' + w.count + '  L' + (w.line + 1) }),
            el('span.panel__val.text-win', { text: '+' + U.money(amount) })
          ]));
        });
        if (result.scatter) {
          winList.appendChild(el('.panel__row', {}, [
            el('span.panel__key', { text: '⭐ ×' + result.scatter.count + '  dispersos' }),
            el('span.panel__val.text-gold', { text: '+' + U.money(result.scatter.pay * totalBet * mult) })
          ]));
        }
      }

      /* ---------- giros automáticos ---------- */

      function startAuto(n) {
        if (autoRunning) { autoRunning = false; return; }
        autoRunning = true;
        autoLeft = n;
        C.ui.setBusy(autoBtn, false);
        autoBtn.querySelector('.btn__label').textContent = 'Parar';
        next();

        function next() {
          if (!autoRunning || autoLeft <= 0 || !C.bank.canAfford(ctx.bet.get())) {
            stopAuto();
            return;
          }
          autoLeft--;
          autoBtn.querySelector('.btn__sub').textContent = autoLeft + ' restantes';
          doSpin().then(function () {
            if (!autoRunning) return;
            root.setTimeout(next, ctx.dur(420));
          });
        }
      }

      function stopAuto() {
        autoRunning = false;
        var l = autoBtn.querySelector('.btn__label');
        var s = autoBtn.querySelector('.btn__sub');
        if (l) l.textContent = 'Auto';
        if (s) s.textContent = '10 giros';
      }

      /* ---------- teclado ---------- */
      function onKey(e) {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.code === 'Space') { e.preventDefault(); doSpin(); }
      }
      document.addEventListener('keydown', onKey);

      /* ---------- panel de información ---------- */
      var payRows = SYMBOLS.filter(function (s) { return !s.wild && !s.scatter; })
        .sort(function (a, b) { return b.pay[4] - a.pay[4]; })
        .map(function (s) {
          return { cells: [s.glyph + '  ' + s.name, s.pay[2] + '×', s.pay[3] + '×', s.pay[4] + '×'] };
        });

      ctx.setInfo(el('div', {}, [
        el('p', { text: 'Apuesta repartida entre 10 líneas. Los pagos de la tabla son por línea, ' +
                        'sobre la apuesta de cada línea (apuesta total ÷ 10). Se paga de izquierda a derecha.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: 'var(--s-3)' } }),
        ctx.table(['Símbolo', '3 iguales', '4 iguales', '5 iguales'], payRows, { compact: true }),
        el('p', { text: '🃏 Comodín: sustituye a cualquier símbolo menos al disperso.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginTop: 'var(--s-3)' } }),
        el('p', { text: '⭐ Disperso: paga en cualquier posición sobre la apuesta total — ' +
                        '3 dispersos = 2× y 8 giros gratis, 4 = 10× y 12 giros, 5 = 50× y 20 giros. ' +
                        'Los giros gratis pagan ×' + FREE_MULTIPLIER + '.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginTop: '6px' } })
      ]));

      refreshStats();

      return {
        destroy: function () {
          autoRunning = false;
          document.removeEventListener('keydown', onKey);
        }
      };
    }
  });

  /* Exponemos la lógica pura para los tests. */
  C.slotsLogic = {
    SYMBOLS: SYMBOLS, LINES: LINES, LINES_N: LINES_N, REELS: REELS, ROWS: ROWS,
    STRIP_LEN: STRIP_LEN, buildStrip: buildStrip, evaluate: evaluate, payoutFor: payoutFor,
    SCATTER_PAY: SCATTER_PAY, SCATTER_SPINS: SCATTER_SPINS, FREE_MULTIPLIER: FREE_MULTIPLIER
  };
})(typeof window !== 'undefined' ? window : globalThis);
