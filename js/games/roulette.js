/* =========================================================================
   roulette.js — Ruleta europea (un solo cero, RTP 97,3%).

   Se pueden poner varias fichas en distintas apuestas antes de girar.
   El dinero se cobra SOLO al girar, en una única ronda con el total
   apostado, y se liquida una sola vez con la suma de todos los premios.
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, el = U.el;

  /* Orden real de la rueda europea. */
  var WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
               5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

  var REDS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];

  function isRed(n) { return REDS.indexOf(n) !== -1; }
  function color(n) { return n === 0 ? 'green' : isRed(n) ? 'red' : 'black'; }

  /* ---------------------- definición de las apuestas ----------------------
     Cada tipo sabe qué números cubre y cuánto paga (a 1). El pago total
     devuelto al jugador es apuesta * (payout + 1).
     ---------------------------------------------------------------------- */
  var BETS = {
    straight: { payout: 35, label: 'Pleno',        covers: function (k) { return [Number(k)]; } },
    red:      { payout: 1,  label: 'Rojo',         covers: function () { return REDS.slice(); } },
    black:    { payout: 1,  label: 'Negro',        covers: function () { return nums().filter(function (n) { return !isRed(n); }); } },
    even:     { payout: 1,  label: 'Par',          covers: function () { return nums().filter(function (n) { return n % 2 === 0; }); } },
    odd:      { payout: 1,  label: 'Impar',        covers: function () { return nums().filter(function (n) { return n % 2 === 1; }); } },
    low:      { payout: 1,  label: '1–18',         covers: function () { return range(1, 18); } },
    high:     { payout: 1,  label: '19–36',        covers: function () { return range(19, 36); } },
    dozen:    { payout: 2,  label: 'Docena',       covers: function (k) { var d = Number(k); return range(d * 12 + 1, d * 12 + 12); } },
    column:   { payout: 2,  label: 'Columna',      covers: function (k) {
                  var c = Number(k), out = [];
                  for (var n = 1; n <= 36; n++) if ((n - 1) % 3 === c) out.push(n);
                  return out;
                } }
  };

  function nums() { var o = []; for (var n = 1; n <= 36; n++) o.push(n); return o; }
  function range(a, b) { var o = []; for (var n = a; n <= b; n++) o.push(n); return o; }

  /** Premio total (apuesta incluida) de una lista de apuestas dado el número. */
  function payout(bets, winning) {
    var total = 0;
    bets.forEach(function (b) {
      var def = BETS[b.type];
      if (!def) return;
      if (def.covers(b.key).indexOf(winning) !== -1) {
        total += b.amount * (def.payout + 1);
      }
    });
    return Math.round(total * 100) / 100;
  }

  /* ============================== interfaz ============================== */

  C.engine.register({
    id: 'roulette',
    name: 'Ruleta Europea',
    icon: '🎡',
    accent: '#e03a52',
    tagline: 'Un solo cero · 37 números',
    desc: 'Pleno a 35, docenas, columnas y apuestas sencillas. Un solo cero, el mejor RTP de la casa.',
    minBet: 0.5,
    maxBet: 500,
    rtp: 97.3,
    useBet: true,

    create: function (ctx) {
      var rng = ctx.rng;
      var placed = [];          // [{type, key, amount, node}]
      var history = [];
      var spinning = false;

      /* ------------------------------ la rueda ------------------------------ */

      var SEG = 360 / WHEEL.length;

      var wheelInner = el('.rw__inner');
      WHEEL.forEach(function (n, i) {
        var seg = el('.rw__num' + (n === 0 ? '.is-zero' : isRed(n) ? '.is-red' : '.is-black'), {
          style: { transform: 'rotate(' + (i * SEG) + 'deg)' }
        }, [el('span.rw__numtext', { text: String(n) })]);
        wheelInner.appendChild(seg);
      });

      /* Fondo con los sectores de color en un solo gradiente cónico:
         mucho más barato que 37 nodos con fondo propio. */
      var stops = WHEEL.map(function (n, i) {
        var c = n === 0 ? 'var(--emerald)' : isRed(n) ? '#c0182e' : '#14161f';
        var a = (i * SEG).toFixed(3), b = ((i + 1) * SEG).toFixed(3);
        return c + ' ' + a + 'deg ' + b + 'deg';
      }).join(', ');
      var wheelFace = el('.rw__face', {
        style: { background: 'conic-gradient(from ' + (-SEG / 2) + 'deg, ' + stops + ')' }
      });

      var ball = el('.rw__ball');
      var ballArm = el('.rw__ballarm', {}, [ball]);

      var wheel = el('.rw', {}, [
        el('.rw__rim'),
        el('.rw__rotor', {}, [wheelFace, wheelInner, el('.rw__hub', {}, [el('span', { text: '♠' })])]),
        ballArm,
        el('.rw__marker', { 'aria-hidden': 'true' })
      ]);
      var rotor = wheel.querySelector('.rw__rotor');

      var resultChip = el('.rw__result', {}, [
        el('span.rw__resultnum', { text: '—' })
      ]);

      /* ------------------------------ el tapete ------------------------------ */

      var board = el('.rtable');
      var spotNodes = {};   // "type:key" -> nodo

      function spot(type, key, label, cls, styleObj) {
        var id = type + ':' + (key === undefined || key === null ? '' : key);
        var node = el('.rspot' + (cls ? cls : ''), {
          'data-bet': id, role: 'button', tabindex: '0',
          'aria-label': label + ' — paga ' + BETS[type].payout + ' a 1',
          style: styleObj || null
        }, [
          el('span.rspot__label', { text: label }),
          el('span.rspot__stack')
        ]);
        C.ui.attachTactile(node, function () { addChip(type, key, node); }, 'chip');
        node.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); addChip(type, key, node); }
        });
        node.addEventListener('contextmenu', function (e) {
          e.preventDefault();
          removeChip(type, key, node);
        });
        spotNodes[id] = node;
        return node;
      }

      /* cero, a la izquierda y a toda la altura */
      board.appendChild(spot('straight', 0, '0', '.rspot--zero', { gridArea: 'zero' }));

      /* los 36 números en 3 filas × 12 columnas.
         Fila de arriba: 3,6,9…  media: 2,5,8…  abajo: 1,4,7… */
      for (var rowI = 0; rowI < 3; rowI++) {
        for (var colI = 0; colI < 12; colI++) {
          var n = colI * 3 + (3 - rowI);
          board.appendChild(spot('straight', n, String(n),
            isRed(n) ? '.rspot--red' : '.rspot--black',
            { gridColumn: (colI + 2), gridRow: (rowI + 1) }));
        }
      }

      /* columnas (a la derecha de cada fila) */
      [2, 1, 0].forEach(function (c, i) {
        board.appendChild(spot('column', c, '2:1', '.rspot--outside',
          { gridColumn: 14, gridRow: i + 1 }));
      });

      /* docenas */
      ['1ª docena', '2ª docena', '3ª docena'].forEach(function (lab, i) {
        board.appendChild(spot('dozen', i, lab, '.rspot--outside',
          { gridColumn: (2 + i * 4) + ' / span 4', gridRow: 4 }));
      });

      /* apuestas sencillas */
      var outside = [
        ['low', null, '1–18'], ['even', null, 'Par'], ['red', null, 'Rojo'],
        ['black', null, 'Negro'], ['odd', null, 'Impar'], ['high', null, '19–36']
      ];
      outside.forEach(function (o, i) {
        var cls = '.rspot--outside' + (o[0] === 'red' ? '.rspot--red' : o[0] === 'black' ? '.rspot--black' : '');
        board.appendChild(spot(o[0], o[1], o[2], cls,
          { gridColumn: (2 + i * 2) + ' / span 2', gridRow: 5 }));
      });

      /* ---------------------------- montaje ---------------------------- */

      var totalLabel = el('.rbar__val', { text: U.money(0) });
      var betsLabel = el('.rbar__val', { text: '0' });

      var bar = el('.rbar', {}, [
        el('.rbar__item', {}, [el('span.rbar__key', { text: 'Fichas en mesa' }), betsLabel]),
        el('.rbar__item', {}, [el('span.rbar__key', { text: 'Total apostado' }), totalLabel])
      ]);

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: '' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel);
      verdict.appendChild(verdictAmount);

      ctx.stage.classList.add('stage--felt');
      ctx.stage.appendChild(el('.roulette', {}, [
        el('.roulette__top', {}, [
          el('.rw__wrap', {}, [wheel, resultChip]),
          el('.roulette__side', {}, [
            bar,
            el('.panel', { style: { background: 'rgba(0,0,0,.28)' } }, [
              el('.panel__title', { text: 'Últimos números' }),
              el('.history', { id: 'rHist' })
            ])
          ])
        ]),
        board,
        verdict
      ]));
      var histNode = ctx.stage.querySelector('#rHist');

      /* ------------------------- gestión de fichas ------------------------- */

      function totalStaked() {
        return Math.round(placed.reduce(function (a, b) { return a + b.amount; }, 0) * 100) / 100;
      }

      function addChip(type, key, node) {
        if (spinning) return;
        var amount = ctx.bet.get();
        var already = totalStaked();
        if (!C.bank.canAfford(already + amount)) {
          C.ui.notEnough(already + amount);
          return;
        }
        var existing = placed.filter(function (b) {
          return b.type === type && String(b.key) === String(key);
        })[0];
        if (existing) {
          existing.amount = Math.round((existing.amount + amount) * 100) / 100;
        } else {
          placed.push({ type: type, key: key, amount: amount, node: node });
        }
        refreshChips();
      }

      function removeChip(type, key) {
        if (spinning) return;
        var i = placed.findIndex(function (b) {
          return b.type === type && String(b.key) === String(key);
        });
        if (i === -1) return;
        placed.splice(i, 1);
        C.audio.play('back');
        refreshChips();
      }

      function clearChips() {
        if (spinning) return;
        placed = [];
        C.audio.play('back');
        refreshChips();
      }

      /** Redibuja las pilas de fichas sobre el tapete. */
      function refreshChips() {
        Object.keys(spotNodes).forEach(function (id) {
          var stack = spotNodes[id].querySelector('.rspot__stack');
          U.clear(stack);
          spotNodes[id].classList.remove('has-bet');
        });
        placed.forEach(function (b) {
          var id = b.type + ':' + (b.key === undefined || b.key === null ? '' : b.key);
          var node = spotNodes[id];
          if (!node) return;
          node.classList.add('has-bet');
          var stack = node.querySelector('.rspot__stack');
          U.clear(stack);
          stack.appendChild(el('span.rchip', { text: U.money(b.amount, { decimals: b.amount % 1 ? 2 : 0 }).replace(' €', '') }));
        });
        var t = totalStaked();
        totalLabel.textContent = U.money(t);
        betsLabel.textContent = String(placed.length);
        spinBtn.disabled = placed.length === 0 || spinning;
        spinBtn.classList.toggle('is-disabled', placed.length === 0);
        clearBtn.disabled = placed.length === 0 || spinning;
      }

      /* -------------------------- girar la rueda -------------------------- */

      var rotorAngle = 0;
      var ballAngle = 0;

      var doSpin = ctx.guard(function () {
        if (!placed.length) {
          C.ui.toast('Pon al menos una ficha en el tapete.', { type: 'warn', icon: '🪙' });
          return;
        }
        var stake = totalStaked();
        var round = ctx.open(stake);
        if (!round) return;

        spinning = true;
        refreshChips();
        verdict.className = 'verdict';
        clearWinHighlights();

        /* Resultado decidido antes de animar. */
        var idx = rng.int(0, WHEEL.length - 1);
        var winning = WHEEL[idx];
        var win = payout(placed, winning);

        ctx.play('spin');

        /* --- animación: rotor y bola giran en sentidos opuestos y frenan --- */
        var dur = ctx.dur(4200);
        // La bola debe acabar sobre el número ganador, que está en el rotor.
        // Ángulo final del rotor: vueltas + alineación del sector con el marcador.
        var rotorTurns = 5;
        var targetRotor = rotorAngle + rotorTurns * 360 + (360 - idx * SEG) - (rotorAngle % 360);
        var ballTurns = 9;
        var targetBall = ballAngle - ballTurns * 360;

        rotorAngle = targetRotor;
        ballAngle = targetBall;

        if (ctx.fx.reduced) {
          rotor.style.transition = 'none';
          ballArm.style.transition = 'none';
          rotor.style.transform = 'rotate(' + (targetRotor % 360) + 'deg)';
          ballArm.style.transform = 'rotate(0deg)';
          ball.style.transform = 'translateY(0)';
        } else {
          rotor.style.transition = 'transform ' + dur + 'ms cubic-bezier(.12,.66,.05,1)';
          rotor.style.transform = 'rotate(' + targetRotor + 'deg)';
          ballArm.style.transition = 'transform ' + dur + 'ms cubic-bezier(.1,.7,.08,1)';
          ballArm.style.transform = 'rotate(' + targetBall + 'deg)';
          // La bola cae del borde hacia el sector: animamos su radio.
          ball.style.transition = 'transform ' + dur + 'ms cubic-bezier(.4,0,.7,1)';
          ball.style.transform = 'translateY(var(--ball-in))';
        }

        /* tictac mientras gira */
        var ticks = 0;
        var tickTimer = root.setInterval(function () {
          ticks++;
          ctx.play('tick');
          if (ticks > 26) root.clearInterval(tickTimer);
        }, 130);

        return ctx.wait(dur + 260).then(function () {
          root.clearInterval(tickTimer);
          ctx.play('reelStop');

          /* --- liquidación: una sola vez, con todos los premios --- */
          var result = round.settle(win, { winning: winning });

          spinning = false;
          showResult(winning, win, stake);

          history.unshift({ n: winning, win: win > stake });
          if (history.length > 14) history.pop();
          renderHistory();

          if (winning === 0 && placed.some(function (b) { return b.type === 'straight' && Number(b.key) === 0; })) {
            C.progress.unlock('roulette_0');
          }

          ctx.celebrate(result, ctx.stage);

          // Las fichas se quedan puestas para repetir la jugada.
          refreshChips();
          return ctx.wait(700);
        });
      });

      function showResult(winning, win, stake) {
        var c = color(winning);
        var numNode = resultChip.querySelector('.rw__resultnum');
        numNode.textContent = String(winning);
        resultChip.className = 'rw__result is-show is-' + c;
        ctx.fx.pulse(resultChip, 'gold');

        /* resalta las apuestas acertadas */
        placed.forEach(function (b) {
          var def = BETS[b.type];
          if (def && def.covers(b.key).indexOf(winning) !== -1) {
            var id = b.type + ':' + (b.key === undefined || b.key === null ? '' : b.key);
            if (spotNodes[id]) spotNodes[id].classList.add('is-won');
          }
        });

        var net = win - stake;
        verdict.className = 'verdict is-show verdict--' + (net > 0 ? 'win' : net < 0 ? 'lose' : 'push');
        verdictLabel.textContent = 'Sale el ' + winning + ' ' +
          (c === 'green' ? '(cero)' : c === 'red' ? '(rojo)' : '(negro)');
        verdictAmount.textContent = (net > 0 ? '+' : net < 0 ? '−' : '') + U.money(Math.abs(net));
        root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2600);
      }

      function clearWinHighlights() {
        Object.keys(spotNodes).forEach(function (id) {
          spotNodes[id].classList.remove('is-won');
        });
      }

      function renderHistory() {
        U.clear(histNode);
        history.forEach(function (h) {
          histNode.appendChild(el('.history__item.is-' + color(h.n), { text: String(h.n) }));
        });
      }

      /* ------------------------------ controles ------------------------------ */

      var spinBtn = ctx.button({
        label: 'Girar', icon: '🎡', variant: 'play',
        onClick: function () { doSpin(); }
      });
      var clearBtn = ctx.button({
        label: 'Quitar fichas', icon: '🧹', variant: 'ghost', size: 'lg',
        onClick: clearChips
      });
      var repeatBtn = ctx.button({
        label: 'Doblar todo', icon: '✖️', variant: 'ghost', size: 'lg',
        title: 'Duplica cada ficha en la mesa',
        onClick: function () {
          if (spinning || !placed.length) return;
          var t = totalStaked();
          if (!C.bank.canAfford(t * 2)) { C.ui.notEnough(t * 2); return; }
          placed.forEach(function (b) { b.amount = Math.round(b.amount * 2 * 100) / 100; });
          C.audio.play('chip');
          refreshChips();
        }
      });

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(el('.controls__group', {}, [clearBtn, repeatBtn, spinBtn]));
      ctx.lockDuringPlay(spinBtn, clearBtn, repeatBtn);

      /* ------------------------------ información ------------------------------ */

      ctx.setInfo(el('div', {}, [
        el('p', { text: 'Pon fichas en el tapete con un clic (clic derecho quita la ficha). ' +
                        'El dinero se cobra al girar, con la suma de todas tus fichas.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: 'var(--s-3)' } }),
        ctx.table(['Apuesta', 'Cubre', 'Paga'], [
          { cells: ['Pleno', '1 número', '35 a 1'] },
          { cells: ['Docena', '12 números', '2 a 1'] },
          { cells: ['Columna', '12 números', '2 a 1'] },
          { cells: ['Rojo / Negro', '18 números', '1 a 1'] },
          { cells: ['Par / Impar', '18 números', '1 a 1'] },
          { cells: ['1–18 / 19–36', '18 números', '1 a 1'] }
        ], { compact: true }),
        el('p', { text: 'Ruleta europea: 37 casillas con un solo cero. La ventaja de la casa es ' +
                        'del 2,7% en todas las apuestas.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginTop: 'var(--s-3)' } })
      ]));

      refreshChips();

      return { destroy: function () { spinning = false; } };
    }
  });

  C.rouletteLogic = {
    WHEEL: WHEEL, REDS: REDS, BETS: BETS, isRed: isRed, color: color, payout: payout
  };
})(typeof window !== 'undefined' ? window : globalThis);
