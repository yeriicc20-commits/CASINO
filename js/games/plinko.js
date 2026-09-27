/* =========================================================================
   plinko.js — La bola cae por los clavos y cae en una cubeta.

   Con 16 filas de clavos, la cubeta final sigue una binomial(16, ½): la
   del centro es 12.870 veces más probable que las de los extremos. Las
   tablas de premios se resuelven para dar el RTP declarado (ver
   tools/solve-plinko.js) y se comprueban con la distribución exacta.

   La bola se anima con una sola pasada de rAF sobre un camino ya decidido,
   así lo que se ve coincide siempre con lo que se cobra.
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, el = U.el;

  var ROWS = 16;
  var BUCKETS = ROWS + 1;

  /* Tres niveles de riesgo. Cada tabla es simétrica y está resuelta para el
     RTP indicado con la distribución binomial(16, ½). */
  /* Tres niveles de riesgo. Las tres tablas están resueltas con
     tools/solve-plinko.js para dar el MISMO RTP (97%) con la distribución
     binomial(16, ½) exacta: sólo cambia la varianza. Son simétricas y
     decrecientes de fuera hacia el centro. */
  var RISK = {
    bajo: {
      label: 'Bajo',
      pays: [16, 9, 2, 1.6, 1.4, 1.2, 0.99, 0.87, 0.75, 0.87, 0.99, 1.2, 1.4, 1.6, 2, 9, 16]
    },
    medio: {
      label: 'Medio',
      pays: [110, 41, 10, 5, 2.7, 1.5, 0.82, 0.52, 0.47, 0.52, 0.82, 1.5, 2.7, 5, 10, 41, 110]
    },
    alto: {
      label: 'Alto',
      pays: [1000, 130, 26, 9, 4, 1.4, 0.46, 0.22, 0.15, 0.22, 0.46, 1.4, 4, 9, 26, 130, 1000]
    }
  };

  function comb(n, k) {
    if (k < 0 || k > n) return 0;
    k = Math.min(k, n - k);
    var r = 1;
    for (var i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
    return r;
  }

  /** Probabilidad de acabar en la cubeta `i` (binomial simétrica). */
  function bucketProbability(i) {
    return comb(ROWS, i) / Math.pow(2, ROWS);
  }

  /** RTP exacto de una tabla de premios. */
  function rtpOf(pays) {
    var s = 0;
    for (var i = 0; i < BUCKETS; i++) s += bucketProbability(i) * pays[i];
    return s;
  }

  C.engine.register({
    id: 'plinko',
    name: 'Plinko',
    icon: '🔻',
    accent: '#2dd4bf',
    tagline: '16 filas · hasta 1.000×',
    desc: 'Suelta la bola y deja que los clavos decidan. Tres niveles de riesgo, del suave al extremo.',
    minBet: 0.5,
    maxBet: 200,
    rtp: 97.0,

    create: function (ctx) {
      var rng = ctx.rng;
      var risk = 'medio';
      var ballsInFlight = 0;
      var history = [];

      /* ------------------------------ escenario ------------------------------ */

      /* Los clavos y las cubetas se dibujan en SVG: un solo nodo, escalable
         y sin coste de layout al animar (movemos la bola con transform). */
      var W = 100, H = 76;
      var svg = el('svg.plinko__board', {
        viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'xMidYMid meet'
      });
      var NS = 'http://www.w3.org/2000/svg';

      var pegLayer = document.createElementNS(NS, 'g');
      var pegPos = [];   // [fila][índice] -> {x,y}

      var topY = 5, botY = H - 13;
      var rowGap = (botY - topY) / ROWS;

      for (var r = 0; r < ROWS; r++) {
        var count = r + 3;              // la primera fila tiene 3 clavos
        var spread = (count - 1) * 5.0;
        var rowArr = [];
        for (var i = 0; i < count; i++) {
          var x = W / 2 - spread / 2 + i * 5.0;
          var y = topY + r * rowGap;
          var peg = document.createElementNS(NS, 'circle');
          peg.setAttribute('cx', x.toFixed(2));
          peg.setAttribute('cy', y.toFixed(2));
          peg.setAttribute('r', '0.8');
          peg.setAttribute('class', 'plinko__peg');
          pegLayer.appendChild(peg);
          rowArr.push({ x: x, y: y, node: peg });
        }
        pegPos.push(rowArr);
      }
      svg.appendChild(pegLayer);

      var ballLayer = document.createElementNS(NS, 'g');
      svg.appendChild(ballLayer);

      /* cubetas */
      var bucketsRow = el('.plinko__buckets');
      var bucketNodes = [];

      function renderBuckets() {
        U.clear(bucketsRow);
        bucketNodes = [];
        var pays = RISK[risk].pays;
        for (var i = 0; i < BUCKETS; i++) {
          var p = pays[i];
          var tone = p >= 20 ? 'hot' : p >= 2 ? 'warm' : p >= 1 ? 'mid' : 'cold';
          var node = el('.pbucket.pbucket--' + tone, {
            title: 'Cubeta ' + (i + 1) + ': paga ' + p + '× (probabilidad ' +
                   (bucketProbability(i) * 100).toFixed(2) + '%)'
          }, [el('span.pbucket__val', { text: p >= 100 ? String(p) : p.toString().replace('.', ',') })]);
          bucketNodes.push(node);
          bucketsRow.appendChild(node);
        }
      }

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: '' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel); verdict.appendChild(verdictAmount);

      ctx.stage.appendChild(el('.plinko', {}, [
        el('.plinko__frame', {}, [svg, bucketsRow]),
        verdict
      ]));

      var histNode = el('.history');
      ctx.side.appendChild(el('.panel', {}, [
        el('.panel__title', { text: 'Últimas bolas' }),
        histNode
      ]));

      /* --------------------------- caída de la bola --------------------------- */

      /**
       * Suelta una bola. El camino se decide entero antes de animar (16
       * decisiones izquierda/derecha), así la cubeta que se ve es la que
       * paga, sin depender de la física de la animación.
       */
      function dropBall(round) {
        var path = [];
        var pos = 0;               // desplazamiento a la derecha acumulado
        for (var r = 0; r < ROWS; r++) {
          var right = rng() < 0.5;
          if (right) pos++;
          path.push(right);
        }
        var bucket = pos;          // 0..16
        var pays = RISK[risk].pays;
        var mult = pays[bucket];
        var win = Math.round(round.stake * mult * 100) / 100;

        /* nodo de la bola */
        var ball = document.createElementNS(NS, 'circle');
        ball.setAttribute('r', '1.45');
        ball.setAttribute('class', 'plinko__ball');
        ballLayer.appendChild(ball);

        /* Puntos por los que pasa: entra arriba centrada y va cruzando filas. */
        var pts = [{ x: W / 2, y: 0 }];
        var offset = 0;
        for (var rr = 0; rr < ROWS; rr++) {
          if (path[rr]) offset += 0.5; else offset -= 0.5;
          pts.push({
            x: W / 2 + offset * 5.0,
            y: topY + rr * rowGap + rowGap * 0.5
          });
        }
        /* punto final: centro de la cubeta */
        pts.push({ x: W / 2 + (bucket - ROWS / 2) * 5.0, y: botY + 4 });

        ballsInFlight++;
        var perStep = ctx.dur(105);
        var total = perStep * pts.length;

        return new Promise(function (resolve) {
          var lastIdx = -1;
          var anim = U.animate({
            from: 0, to: pts.length - 1,
            duration: total,
            easing: function (t) { return t; },   // velocidad constante entre clavos
            onUpdate: function (v) {
              var i = Math.floor(v);
              var frac = v - i;
              var a = pts[Math.min(i, pts.length - 1)];
              var b = pts[Math.min(i + 1, pts.length - 1)];
              /* Parábola entre clavos: sube un poco al rebotar. */
              var hop = Math.sin(frac * Math.PI) * -1.1;
              ball.setAttribute('cx', U.lerp(a.x, b.x, frac).toFixed(2));
              ball.setAttribute('cy', (U.lerp(a.y, b.y, frac) + hop).toFixed(2));

              if (i !== lastIdx) {
                lastIdx = i;
                if (i > 0 && i <= ROWS) {
                  ctx.play('peg');
                  flashPeg(i - 1, path);
                }
              }
            }
          });

          anim.then(function () {
            ball.remove();
            ballsInFlight--;

            /* --- liquidación --- */
            var result = round.settle(win, { bucket: bucket, mult: mult });

            /* cubeta iluminada */
            var bn = bucketNodes[bucket];
            if (bn) {
              bn.classList.remove('is-hit');
              void bn.offsetWidth;
              bn.classList.add('is-hit');
              root.setTimeout(function () { bn.classList.remove('is-hit'); }, 900);
            }

            verdict.className = 'verdict is-show verdict--' +
              (result.net > 0 ? (mult >= 50 ? 'jackpot' : 'win') : result.net < 0 ? 'lose' : 'push');
            verdictLabel.textContent = mult.toString().replace('.', ',') + '×  ·  cubeta ' + (bucket + 1);
            verdictAmount.textContent = (result.net > 0 ? '+' : result.net < 0 ? '−' : '') +
                                        U.money(Math.abs(result.net));

            history.unshift({ mult: mult, win: result.net > 0 });
            if (history.length > 16) history.pop();
            U.clear(histNode);
            history.forEach(function (h) {
              histNode.appendChild(el('.history__item' + (h.win ? '.is-win' : '.is-loss'), {
                text: h.mult.toString().replace('.', ',') + '×'
              }));
            });

            ctx.celebrate(result, bn || ctx.stage);
            root.setTimeout(function () {
              if (ballsInFlight === 0) verdict.classList.remove('is-show');
            }, 1900);
            resolve(result);
          });
        });
      }

      function flashPeg(rowIdx, path) {
        var rowArr = pegPos[rowIdx];
        if (!rowArr) return;
        /* Aproximamos el clavo golpeado por el desplazamiento acumulado. */
        var off = 0;
        for (var i = 0; i <= rowIdx; i++) off += path[i] ? 1 : 0;
        var idx = U.clamp(off + Math.floor((rowArr.length - rowIdx - 1) / 1), 0, rowArr.length - 1);
        var peg = rowArr[idx];
        if (!peg) return;
        peg.node.classList.remove('is-hit');
        peg.node.setAttribute('class', 'plinko__peg is-hit');
        root.setTimeout(function () { peg.node.setAttribute('class', 'plinko__peg'); }, 260);
      }

      /* ------------------------------ soltar ------------------------------ */

      /* Plinko permite varias bolas a la vez, así que NO usamos ctx.guard
         (que bloquea la reentrada). Cada bola abre y liquida su propia
         ronda, y limitamos cuántas puede haber en el aire. */
      var MAX_BALLS = 6;

      function drop() {
        if (ballsInFlight >= MAX_BALLS) {
          C.audio.play('deny');
          return;
        }
        var stake = ctx.bet.get();
        if (!C.bank.canAfford(stake)) { C.ui.notEnough(stake); return; }

        /* Cada bola necesita su propia ronda. El banco impide dos rondas
           abiertas del mismo juego, así que usamos un id por bola. */
        var round;
        try {
          round = C.bank.openRound('plinko#' + (++ballSeq), stake);
        } catch (err) {
          if (err && err.code === 'INSUFFICIENT_FUNDS') { C.ui.notEnough(stake); return; }
          console.error(err);
          return;
        }
        ctx.play('chip');
        dropBall(round);
      }

      var ballSeq = 0;

      /* ------------------------------ controles ------------------------------ */

      var dropBtn = ctx.button({ label: 'Soltar bola', icon: '🔻', variant: 'play',
                                 onClick: drop });

      var riskBtns = Object.keys(RISK).map(function (key) {
        var b = ctx.button({
          label: RISK[key].label, variant: 'ghost', size: 'sm',
          title: 'Riesgo ' + RISK[key].label.toLowerCase() + ' — máximo ' +
                 Math.max.apply(null, RISK[key].pays) + '×',
          onClick: function () {
            if (ballsInFlight > 0) {
              C.ui.toast('Espera a que caigan las bolas para cambiar el riesgo.', { type: 'warn', icon: '⏳' });
              return;
            }
            risk = key;
            C.audio.play('chip');
            renderBuckets();
            refreshRisk();
          }
        });
        b.dataset.risk = key;
        return b;
      });

      function refreshRisk() {
        riskBtns.forEach(function (b) {
          b.classList.toggle('is-active-credit', b.dataset.risk === risk);
        });
      }

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(el('.plinko__risk', {}, [
        el('span.vp__creditlabel', { text: 'Riesgo' })
      ].concat(riskBtns)));
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(dropBtn);

      function onKey(e) {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.code === 'Space') { e.preventDefault(); drop(); }
      }
      document.addEventListener('keydown', onKey);

      /* ------------------------------ información ------------------------------ */

      var probRows = [];
      for (var i = 0; i <= ROWS / 2; i++) {
        probRows.push({
          cells: [
            i === ROWS / 2 ? 'Centro' : 'Cubeta ' + (i + 1) + ' y ' + (BUCKETS - i),
            (bucketProbability(i) * 100).toFixed(3).replace('.', ',') + '%',
            RISK.bajo.pays[i] + '×',
            RISK.medio.pays[i] + '×',
            RISK.alto.pays[i] + '×'
          ]
        });
      }

      ctx.setInfo(el('div', {}, [
        el('p', { text: 'Con 16 filas de clavos la bola acaba en una cubeta siguiendo una binomial: ' +
                        'la del centro es 12.870 veces más probable que las de los extremos. Por eso ' +
                        'las cubetas centrales pagan menos de 1× y las exteriores hasta 1.000×.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: 'var(--s-3)' } }),
        ctx.table(['Cubeta', 'Probabilidad', 'Bajo', 'Medio', 'Alto'], probRows, { compact: true }),
        el('p', { text: 'Puedes soltar hasta 6 bolas a la vez; cada una es una apuesta independiente. ' +
                        'Los tres niveles de riesgo tienen el mismo retorno teórico ' +
                        '(' + rtpOf(RISK.medio.pays).toFixed(3).replace('.', ',').slice(0, 5) +
                        '%), sólo cambia la varianza.',
                  style: { fontSize: '12.5px', color: 'var(--ink-3)', marginTop: 'var(--s-3)' } })
      ]));

      renderBuckets();
      refreshRisk();

      return {
        destroy: function () {
          document.removeEventListener('keydown', onKey);
        }
      };
    }
  });

  C.plinkoLogic = { ROWS: ROWS, BUCKETS: BUCKETS, RISK: RISK,
                    bucketProbability: bucketProbability, rtpOf: rtpOf, comb: comb };
})(typeof window !== 'undefined' ? window : globalThis);
