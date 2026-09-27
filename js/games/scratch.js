/* =========================================================================
   scratch.js — Rasca y gana: 9 casillas, 3 símbolos iguales premian.

   El boleto se genera entero al comprarlo (con su premio ya decidido),
   igual que un rasca de verdad: rascar sólo descubre lo que ya estaba.
   El premio se decide por sorteo ponderado sobre la tabla, así el RTP es
   exacto y se verifica sumando probabilidad × premio.
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, el = U.el;

  var CELLS = 9;

  /* Símbolos del boleto. `mult` es lo que paga un trío. */
  var SYMBOLS = [
    { id: 'cherry',  glyph: '🍒', mult: 1 },
    { id: 'clover',  glyph: '🍀', mult: 2 },
    { id: 'bell',    glyph: '🔔', mult: 4 },
    { id: 'star',    glyph: '⭐', mult: 10 },
    { id: 'gem',     glyph: '💎', mult: 25 },
    { id: 'seven',   glyph: '7️⃣', mult: 100 },
    { id: 'crown',   glyph: '👑', mult: 500 }
  ];
  var BY_ID = {};
  SYMBOLS.forEach(function (s) { BY_ID[s.id] = s; });

  /**
   * Tabla de resultados con sus pesos. `w` es el peso del sorteo y `mult`
   * el multiplicador del retorno total. La suma ponderada da el RTP:
   *   RTP = Σ (w/Σw) · mult
   * Los pesos están elegidos para dar ~95% (ver verificación más abajo).
   */
  var OUTCOMES = [
    { w: 620000, mult: 0,   sym: null },
    { w: 210000, mult: 1,   sym: 'cherry' },
    { w: 110000, mult: 2,   sym: 'clover' },
    { w: 42000,  mult: 4,   sym: 'bell' },
    { w: 13000,  mult: 10,  sym: 'star' },
    { w: 4200,   mult: 25,  sym: 'gem' },
    { w: 700,    mult: 100, sym: 'seven' },
    { w: 100,    mult: 500, sym: 'crown' }
  ];

  var TOTAL_W = OUTCOMES.reduce(function (a, o) { return a + o.w; }, 0);

  /** RTP exacto de la tabla. */
  function rtp() {
    var s = 0;
    OUTCOMES.forEach(function (o) { s += (o.w / TOTAL_W) * o.mult; });
    return s;
  }

  /** Sortea el resultado del boleto. */
  function rollOutcome(rng) {
    var r = rng() * TOTAL_W;
    for (var i = 0; i < OUTCOMES.length; i++) {
      r -= OUTCOMES[i].w;
      if (r <= 0) return OUTCOMES[i];
    }
    return OUTCOMES[0];
  }

  /**
   * Construye las 9 casillas coherentes con el resultado sorteado:
   *  · si premia, hay EXACTAMENTE 3 del símbolo ganador y ningún otro trío
   *  · si no premia, ningún símbolo aparece 3 veces
   */
  function buildTicket(outcome, rng) {
    var cells = new Array(CELLS).fill(null);

    if (outcome.mult > 0) {
      /* 3 del símbolo ganador en posiciones al azar */
      var slots = [];
      for (var i = 0; i < CELLS; i++) slots.push(i);
      rng.shuffle(slots);
      var winSlots = slots.slice(0, 3);
      winSlots.forEach(function (s) { cells[s] = outcome.sym; });

      /* El resto: como mucho 2 de cada símbolo, y nunca 3 del ganador. */
      var rest = slots.slice(3);
      var counts = {};
      counts[outcome.sym] = 3;
      rest.forEach(function (s) {
        var pick = null, guard = 0;
        while (guard++ < 60) {
          var cand = rng.pick(SYMBOLS).id;
          var c = counts[cand] || 0;
          // El ganador ya está completo; los demás no pueden llegar a 3.
          if (cand === outcome.sym) continue;
          if (c >= 2) continue;
          pick = cand;
          break;
        }
        if (!pick) pick = 'cherry';
        counts[pick] = (counts[pick] || 0) + 1;
        cells[s] = pick;
      });
    } else {
      /* Sin premio: repartimos sin que nada llegue a 3. */
      var counts2 = {};
      for (var j = 0; j < CELLS; j++) {
        var pick2 = null, guard2 = 0;
        while (guard2++ < 80) {
          var cand2 = rng.pick(SYMBOLS).id;
          if ((counts2[cand2] || 0) >= 2) continue;
          pick2 = cand2;
          break;
        }
        if (!pick2) {
          // Con 7 símbolos y 9 casillas siempre hay hueco, pero por si acaso:
          pick2 = SYMBOLS.filter(function (s) { return (counts2[s.id] || 0) < 2; })[0].id;
        }
        counts2[pick2] = (counts2[pick2] || 0) + 1;
        cells[j] = pick2;
      }
    }
    return cells;
  }

  /** Cuenta tríos en un boleto: devuelve {sym, mult} o null. */
  function evaluateTicket(cells) {
    var counts = {};
    cells.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
    var best = null;
    Object.keys(counts).forEach(function (id) {
      if (counts[id] >= 3) {
        var s = BY_ID[id];
        if (!best || s.mult > best.mult) best = { sym: id, mult: s.mult };
      }
    });
    return best;
  }

  C.engine.register({
    id: 'scratch',
    name: 'Rasca y Gana',
    icon: '🎟️',
    accent: '#fbbf24',
    tagline: '3 iguales premian · hasta 500×',
    desc: 'Compra el boleto, rasca las nueve casillas y busca tres símbolos iguales. Sin estrategia, sólo suerte.',
    minBet: 1,
    maxBet: 100,
    rtp: 95.0,

    create: function (ctx) {
      var rng = ctx.rng;
      var cells = [];
      var scratched = [];
      var round = null;
      var outcome = null;
      var active = false;
      var settled = false;

      /* ------------------------------ escenario ------------------------------ */

      var grid = el('.scratch__grid');
      var cellNodes = [];
      for (var i = 0; i < CELLS; i++) {
        (function (i) {
          var glyph = el('span.scell__glyph', { text: '' });
          var foil = el('span.scell__foil', {}, [el('span.scell__hint', { text: '?' })]);
          var node = el('.scell', {
            role: 'button', tabindex: '0', 'aria-label': 'Casilla ' + (i + 1) + ' sin rascar'
          }, [glyph, foil]);
          C.ui.attachTactile(node, function () { scratch(i); }, 'scratch');
          node.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); scratch(i); }
          });
          /* Rascar arrastrando el dedo o el ratón. */
          node.addEventListener('pointerenter', function (e) {
            if (e.buttons === 1) scratch(i);
          });
          cellNodes.push({ node: node, glyph: glyph, foil: foil });
          grid.appendChild(node);
        })(i);
      }

      var ticketLabel = el('.scratch__label', { text: 'Compra un boleto para empezar' });

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: '' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel); verdict.appendChild(verdictAmount);

      ctx.stage.appendChild(el('.scratch', {}, [
        el('.scratch__ticket', {}, [
          el('.scratch__head', {}, [
            el('span.scratch__brand', { text: '🎟️  CASINO ROYALE' }),
            el('span.scratch__serie', { text: 'SERIE A' })
          ]),
          grid,
          ticketLabel
        ]),
        verdict
      ]));

      /* ------------------------------ comprar ------------------------------ */

      var buy = ctx.guard(function () {
        if (active) return;
        round = ctx.open();
        if (!round) return;

        outcome = rollOutcome(rng);
        cells = buildTicket(outcome, rng);
        scratched = new Array(CELLS).fill(false);
        active = true;
        settled = false;
        verdict.className = 'verdict';

        cellNodes.forEach(function (c, i) {
          c.node.className = 'scell';
          c.node.setAttribute('aria-label', 'Casilla ' + (i + 1) + ' sin rascar');
          c.glyph.textContent = BY_ID[cells[i]].glyph;
        });

        ticketLabel.textContent = 'Rasca las nueve casillas — busca tres iguales';
        ctx.play('chip');
        refresh();
      });

      /* ------------------------------ rascar ------------------------------ */

      function scratch(i) {
        if (!active || scratched[i]) return;
        scratched[i] = true;
        var c = cellNodes[i];
        c.node.classList.add('is-open');
        c.node.setAttribute('aria-label', 'Casilla ' + (i + 1) + ': ' + cells[i]);
        C.audio.play('scratch');

        /* Si ya hay tres del mismo símbolo descubiertas, lo marcamos. */
        var open = cells.filter(function (id, j) { return scratched[j]; });
        var counts = {};
        open.forEach(function (id) { counts[id] = (counts[id] || 0) + 1; });
        if (counts[cells[i]] === 3) {
          C.audio.play('coin');
          cells.forEach(function (id, j) {
            if (id === cells[i] && scratched[j]) cellNodes[j].node.classList.add('is-match');
          });
          ctx.fx.sparks(c.node, 8);
        }

        var allOpen = scratched.every(Boolean);
        if (allOpen) finish();
        refresh();
      }

      function revealAll() {
        if (!active) return;
        for (var i = 0; i < CELLS; i++) {
          if (!scratched[i]) {
            scratched[i] = true;
            cellNodes[i].node.classList.add('is-open');
          }
        }
        C.audio.play('scratch');
        finish();
        refresh();
      }

      /* ------------------------------ resolver ------------------------------ */

      function finish() {
        if (settled || !round) return;
        settled = true;
        active = false;

        var found = evaluateTicket(cells);
        /* El boleto se construye para que el trío coincida con el sorteo;
           usamos el boleto como fuente de verdad y avisamos si no cuadra. */
        var mult = found ? found.mult : 0;
        if (mult !== outcome.mult) {
          console.warn('Boleto incoherente con el sorteo', { esperado: outcome.mult, encontrado: mult });
        }

        var win = Math.round(round.stake * mult * 100) / 100;
        var result = round.settle(win, { mult: mult });
        round = null;

        if (found) {
          cells.forEach(function (id, j) {
            if (id === found.sym) cellNodes[j].node.classList.add('is-match');
            else cellNodes[j].node.classList.add('is-dull');
          });
        }

        verdict.className = 'verdict is-show verdict--' +
          (result.net > 0 ? (mult >= 100 ? 'jackpot' : 'win') : 'lose');
        verdictLabel.textContent = found
          ? 'Tres ' + BY_ID[found.sym].glyph + '  ·  ' + found.mult + '×'
          : 'Sin premio';
        verdictAmount.textContent = (result.net > 0 ? '+' : '−') + U.money(Math.abs(result.net));

        ticketLabel.textContent = found
          ? '¡Premio de ' + U.money(win) + '!'
          : 'Este boleto no tenía premio. Prueba otro.';

        ctx.celebrate(result, grid);
        root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2600);
      }

      /* ------------------------------ controles ------------------------------ */

      function refresh() {
        buyBtn.style.display = active ? 'none' : '';
        revealBtn.style.display = active ? '' : 'none';
        ctx.bet.setEnabled(!active);
      }

      var buyBtn = ctx.button({ label: 'Comprar boleto', icon: '🎟️', variant: 'play',
                                onClick: function () { buy(); } });
      var revealBtn = ctx.button({ label: 'Rascar todo', icon: '✨', variant: 'primary', size: 'lg',
                                   onClick: revealAll });

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(el('.controls__group', {}, [revealBtn, buyBtn]));
      ctx.lockDuringPlay(buyBtn);

      /* ------------------------------ información ------------------------------ */

      var rows = SYMBOLS.slice().sort(function (a, b) { return b.mult - a.mult; }).map(function (s) {
        var o = OUTCOMES.filter(function (x) { return x.sym === s.id; })[0];
        return {
          cells: [
            s.glyph + '  ×3',
            s.mult + '×',
            o ? '1 entre ' + Math.round(TOTAL_W / o.w).toLocaleString('es-ES') : '—'
          ]
        };
      });

      ctx.setInfo(el('div', {}, [
        el('p', { text: 'El boleto se genera completo al comprarlo, con su premio ya decidido: ' +
                        'rascar sólo descubre lo que ya estaba. Tres símbolos iguales premian.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: 'var(--s-3)' } }),
        ctx.table(['Combinación', 'Paga', 'Probabilidad'], rows, { compact: true }),
        el('p', { text: 'Un boleto premia 1 de cada ' +
                        (1 / (1 - OUTCOMES[0].w / TOTAL_W)).toFixed(1).replace('.', ',') +
                        ' veces. Retorno teórico: ' + (rtp() * 100).toFixed(1).replace('.', ',') + '%.',
                  style: { fontSize: '12.5px', color: 'var(--ink-3)', marginTop: 'var(--s-3)' } })
      ]));

      refresh();
      return { destroy: function () { active = false; } };
    }
  });

  C.scratchLogic = {
    SYMBOLS: SYMBOLS, OUTCOMES: OUTCOMES, CELLS: CELLS, TOTAL_W: TOTAL_W,
    rtp: rtp, rollOutcome: rollOutcome, buildTicket: buildTicket, evaluateTicket: evaluateTicket
  };
})(typeof window !== 'undefined' ? window : globalThis);
