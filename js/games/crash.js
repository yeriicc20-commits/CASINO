/* =========================================================================
   crash.js — El multiplicador sube hasta que "estalla". Cóbralo antes.

   El punto de estallido se sortea ANTES de empezar la subida:
        con probabilidad 0,01  ->  estalla en 1,00
        si no                  ->  crash = truncar(1 / (1 - u), 2 decimales)
   La combinación del truncado con la fórmula da exactamente 0,99/M de
   probabilidad de alcanzar el multiplicador M, es decir un RTP del 99% con
   CUALQUIER objetivo de cobro (verificado en tools/sim-crash.js).

   Ojo con un detalle: el truncado hace que los valores de 1/(1-u) por
   debajo de 1,01 caigan también en 1,00, así que las rondas instantáneas
   son ~2% y no 1%. No es un fallo — es justo lo que mantiene el 99% en los
   multiplicadores bajos — pero el panel de reglas lo dice tal cual es.

   Dinero: UNA ronda. Se cobra al despegar y se liquida al retirarse (con
   apuesta × multiplicador) o al estallar (con 0).
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, el = U.el;

  var HOUSE_EDGE = 0.01;
  var MAX_CRASH = 1000000;   // tope duro por seguridad numérica

  /**
   * Sortea el multiplicador de estallido.
   * Con probabilidad HOUSE_EDGE estalla en 1,00 (ronda instantánea); si no,
   * sigue 1/(1-u), que es la distribución que hace el juego justo al 99%.
   */
  function rollCrash(rng) {
    if (rng() < HOUSE_EDGE) return 1;
    var u = rng();
    // Evitamos u=1 exacto (división por cero).
    if (u >= 0.9999999) u = 0.9999999;
    var v = 1 / (1 - u);
    return Math.min(Math.floor(v * 100) / 100, MAX_CRASH);
  }

  /** Probabilidad de que la ronda alcance el multiplicador `m`. */
  function chanceOfReaching(m) {
    if (m <= 1) return 1 - HOUSE_EDGE;
    return (1 - HOUSE_EDGE) * (1 / m);
  }

  C.engine.register({
    id: 'crash',
    name: 'Crash',
    icon: '🚀',
    accent: '#ff6b7e',
    tagline: 'Retírate antes de que estalle · RTP 99%',
    desc: 'El multiplicador sube sin parar. Cuanto más esperes más ganas, pero puede estallar en cualquier momento.',
    minBet: 0.5,
    maxBet: 500,
    rtp: 99.0,

    create: function (ctx) {
      var rng = ctx.rng;
      var round = null;
      var flying = false;
      var crashAt = 0;
      var current = 1;
      var raf = 0;
      var startTs = 0;
      var history = [];
      var autoTarget = 0;    // 0 = sin retirada automática

      /* ------------------------------ escenario ------------------------------ */

      var multNode = el('.crash__mult', { text: '1,00×' });
      var statusNode = el('.crash__status', { text: 'Pulsa DESPEGAR' });

      /* Curva dibujada en SVG: una sola polilínea que vamos alargando. */
      var svg = el('svg.crash__chart', {
        viewBox: '0 0 100 56', preserveAspectRatio: 'none', 'aria-hidden': 'true'
      });
      var area = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      area.setAttribute('class', 'crash__area');
      var line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      line.setAttribute('class', 'crash__line');
      var rocket = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      rocket.setAttribute('class', 'crash__dot');
      rocket.setAttribute('r', '1.4');
      svg.appendChild(area); svg.appendChild(line); svg.appendChild(rocket);

      var histNode = el('.history');

      ctx.stage.appendChild(el('.crash', {}, [
        el('.crash__screen', {}, [
          svg,
          el('.crash__overlay', {}, [multNode, statusNode])
        ])
      ]));

      ctx.side.appendChild(el('.panel', {}, [
        el('.panel__title', { text: 'Rondas anteriores' }),
        histNode
      ]));

      var autoInput = el('input.bet__input', {
        type: 'number', min: '1.01', max: '1000', step: '0.1',
        placeholder: '0', 'aria-label': 'Retirada automática',
        style: { width: '100px' }
      });
      autoInput.addEventListener('change', function () {
        var v = parseFloat(autoInput.value);
        autoTarget = Number.isFinite(v) && v > 1 ? v : 0;
        if (!autoTarget) autoInput.value = '';
      });
      ctx.side.appendChild(el('.panel', {}, [
        el('.panel__title', { text: 'Retirada automática' }),
        el('p', { text: 'Cobra solo al llegar a este multiplicador.',
                  style: { fontSize: '12px', color: 'var(--ink-3)', marginBottom: 'var(--s-2)' } }),
        autoInput
      ]));

      /* ------------------------------ la curva ------------------------------ */

      /** Convierte (tiempo, multiplicador) a coordenadas del SVG. */
      function buildPath(points) {
        if (!points.length) return '';
        return points.map(function (p, i) {
          return (i === 0 ? 'M' : 'L') + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
        }).join(' ');
      }

      var points = [];

      function drawCurve(t, mult) {
        /* Escala dinámica: la curva siempre cabe en el recuadro. */
        var maxT = Math.max(6, t * 1.08);
        var maxM = Math.max(2, mult * 1.12);
        var x = (t / maxT) * 100;
        var y = 56 - (Math.log(mult) / Math.log(maxM)) * 52 - 2;

        points.push({ x: x, y: y });
        // Reescalamos los puntos previos al nuevo encuadre.
        if (points.length > 240) points.splice(0, points.length - 240);
        var scaled = points.map(function (p, i) {
          var tt = (i / (points.length - 1 || 1)) * t;
          var mm = 1 + (Math.exp((1 - (p.y + 2 - 56) / -52) * Math.log(maxM)) - 1);
          return p;
        });

        var d = buildPath(points);
        line.setAttribute('d', d);
        area.setAttribute('d', d + ' L' + x.toFixed(2) + ' 56 L' + (points[0].x).toFixed(2) + ' 56 Z');
        rocket.setAttribute('cx', x.toFixed(2));
        rocket.setAttribute('cy', y.toFixed(2));
      }

      function resetCurve() {
        points = [{ x: 0, y: 54 }];
        line.setAttribute('d', 'M0 54');
        area.setAttribute('d', '');
        rocket.setAttribute('cx', '0');
        rocket.setAttribute('cy', '54');
      }

      /* ------------------------------ despegue ------------------------------ */

      var launch = ctx.guard(function () {
        if (flying) return;
        round = ctx.open();
        if (!round) return;

        crashAt = rollCrash(rng);
        current = 1;
        flying = true;
        resetCurve();
        multNode.className = 'crash__mult';
        statusNode.textContent = autoTarget ? 'Retirada automática en ' + autoTarget.toFixed(2) + '×' : 'Subiendo…';
        ctx.play('spin');

        return new Promise(function (resolve) {
          startTs = 0;
          var lastTick = 0;

          function frame(ts) {
            if (!flying) { resolve(); return; }
            if (!startTs) startTs = ts;
            var t = (ts - startTs) / 1000;

            /* Curva de crecimiento: exponencial suave.
               A los ~6 s va por 4×, a los ~12 s por 16×. */
            var speed = ctx.fx.reduced ? 3.2 : 1;
            current = Math.exp(0.235 * t * speed);
            current = Math.floor(current * 100) / 100;
            if (current < 1) current = 1;

            /* ¿Estalla? */
            if (current >= crashAt) {
              current = crashAt;
              drawCurve(t, Math.max(current, 1.001));
              bust();
              resolve();
              return;
            }

            multNode.textContent = current.toFixed(2).replace('.', ',') + '×';
            drawCurve(t, Math.max(current, 1.001));

            /* sonido cada vez que sube medio punto */
            if (current - lastTick >= 0.5) { lastTick = current; ctx.play('tick'); }

            /* retirada automática */
            if (autoTarget && current >= autoTarget) {
              cashNow();
              resolve();
              return;
            }

            raf = root.requestAnimationFrame(frame);
          }
          raf = root.requestAnimationFrame(frame);
        });
      });

      /* -------------------------------- estallido -------------------------------- */

      function bust() {
        root.cancelAnimationFrame(raf);
        flying = false;
        if (!round) return;

        var result = round.settle(0, { crashAt: crashAt });
        round = null;

        multNode.textContent = crashAt.toFixed(2).replace('.', ',') + '×';
        multNode.className = 'crash__mult is-bust';
        statusNode.textContent = '¡Ha estallado!';
        line.classList.add('is-bust');
        area.classList.add('is-bust');
        ctx.play('explode');
        ctx.fx.shake(ctx.stage, 'hard');
        ctx.fx.flash('rgba(255,107,126,.2)');
        ctx.fx.floatText(multNode, '−' + U.money(result.stake), { negative: true, big: true });

        pushHistory(crashAt, false);
        refresh();
      }

      /* -------------------------------- cobrar -------------------------------- */

      function cashNow() {
        root.cancelAnimationFrame(raf);
        if (!flying || !round) return;
        flying = false;

        var mult = current;
        var pot = Math.round(round.stake * mult * 100) / 100;
        var result = round.settle(pot, { mult: mult });
        round = null;

        multNode.className = 'crash__mult is-cashed';
        statusNode.textContent = 'Cobrado a ' + mult.toFixed(2).replace('.', ',') + '×  ·  estalló en ' +
                                 crashAt.toFixed(2).replace('.', ',') + '×';
        line.classList.add('is-cashed');
        ctx.play('cashout');
        if (mult >= 10) C.progress.unlock('crash_10x');
        ctx.celebrate(result, multNode);

        pushHistory(crashAt, true);
        refresh();
      }

      var cashOut = ctx.guard(function () { cashNow(); });

      function pushHistory(at, cashed) {
        history.unshift({ at: at, cashed: cashed });
        if (history.length > 16) history.pop();
        U.clear(histNode);
        history.forEach(function (h) {
          histNode.appendChild(el('.history__item' + (h.cashed ? '.is-win' : '.is-loss'), {
            text: h.at.toFixed(2).replace('.', ',') + '×'
          }));
        });
      }

      function refresh() {
        launchBtn.style.display = flying ? 'none' : '';
        cashBtn.style.display = flying ? '' : 'none';
        ctx.bet.setEnabled(!flying);
        autoInput.disabled = flying;
        if (!flying) {
          line.classList.remove('is-bust', 'is-cashed');
          area.classList.remove('is-bust');
        }
      }

      /* ------------------------------ controles ------------------------------ */

      var launchBtn = ctx.button({ label: 'Despegar', icon: '🚀', variant: 'play',
                                   onClick: function () { launch(); } });
      var cashBtn = ctx.button({ label: 'Cobrar', icon: '💰', variant: 'success', size: 'xl',
                                 onClick: function () { cashOut(); } });

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(el('.controls__group', {}, [launchBtn, cashBtn]));

      function onKey(e) {
        if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
        if (e.code === 'Space') {
          e.preventDefault();
          if (flying) cashOut(); else launch();
        }
      }
      document.addEventListener('keydown', onKey);

      ctx.setInfo(el('div', {}, [
        el('p', { text: 'El punto de estallido se sortea antes de despegar, así que no depende de ' +
                        'cuándo pulses. La probabilidad de llegar a un multiplicador M es 0,99 ÷ M, ' +
                        'lo que da un 99% de retorno con cualquier estrategia.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: 'var(--s-3)' } }),
        ctx.table(['Cobrar en', 'Probabilidad de llegar', 'Retorno'], [
          { cells: ['1,50×', (chanceOfReaching(1.5) * 100).toFixed(1).replace('.', ',') + '%', '99%'] },
          { cells: ['2,00×', (chanceOfReaching(2) * 100).toFixed(1).replace('.', ',') + '%', '99%'] },
          { cells: ['5,00×', (chanceOfReaching(5) * 100).toFixed(1).replace('.', ',') + '%', '99%'] },
          { cells: ['10,0×', (chanceOfReaching(10) * 100).toFixed(1).replace('.', ',') + '%', '99%'] },
          { cells: ['100×', (chanceOfReaching(100) * 100).toFixed(2).replace('.', ',') + '%', '99%'] }
        ], { compact: true }),
        el('p', { text: 'Alrededor de 2 de cada 100 rondas se quedan en 1,00× y no dan tiempo a nada: ' +
                        'ahí está la ventaja de la casa. La mediana del estallido está en 2,00×.',
                  style: { fontSize: '12.5px', color: 'var(--ink-3)', marginTop: 'var(--s-3)' } }),
        el('p', { text: 'Atajo: espacio despega y cobra.',
                  style: { fontSize: '12.5px', color: 'var(--ink-3)', marginTop: '4px' } })
      ]));

      resetCurve();
      refresh();

      return {
        destroy: function () {
          flying = false;
          root.cancelAnimationFrame(raf);
          document.removeEventListener('keydown', onKey);
        }
      };
    }
  });

  C.crashLogic = { rollCrash: rollCrash, chanceOfReaching: chanceOfReaching, HOUSE_EDGE: HOUSE_EDGE };
})(typeof window !== 'undefined' ? window : globalThis);
