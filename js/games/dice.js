/* =========================================================================
   dice.js — Dados: eliges el objetivo y si apuestas a más o a menos.
   El multiplicador se calcula con una ventaja fija del 1%, así el RTP es
   siempre 99% sea cual sea la probabilidad elegida.
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, el = U.el;

  var HOUSE_EDGE = 0.01;
  var MIN_TARGET = 2, MAX_TARGET = 98;
  /* El tiro da uno de 10.000 valores equiprobables: 0,00 … 99,99. */
  var OUTCOMES = 10000;

  /**
   * Probabilidad EXACTA de ganar (0..1), contada sobre los 10.000 valores
   * posibles. Importa el detalle: "más de 50" gana con 50,01…99,99, que son
   * 4.999 valores (49,99%), no 5.000. Si usáramos (100-target)/100 el
   * multiplicador mostrado no cuadraría con la probabilidad real.
   */
  function winChance(target, over) {
    var t = Math.round(target * 100);
    var count = over ? (OUTCOMES - 1 - t) : t;
    return count / OUTCOMES;
  }

  /** Multiplicador del retorno total (apuesta incluida). */
  function multiplier(target, over) {
    var p = winChance(target, over);
    if (p <= 0) return 0;
    return Math.floor(((1 - HOUSE_EDGE) / p) * 10000) / 10000;
  }

  /** ¿Gana el tiro? */
  function wins(rollValue, target, over) {
    return over ? rollValue > target : rollValue < target;
  }

  C.engine.register({
    id: 'dice',
    name: 'Dados',
    icon: '🎲',
    accent: '#fb923c',
    tagline: 'Elige tu probabilidad · RTP 99%',
    desc: 'Tú decides el riesgo: mueve el objetivo y el multiplicador se ajusta. La mejor ventaja del casino.',
    minBet: 0.5,
    maxBet: 500,
    rtp: 99.0,

    create: function (ctx) {
      var rng = ctx.rng;
      var target = 50;
      var over = true;
      var history = [];

      /* ------------------------------ escenario ------------------------------ */

      var resultNum = el('.dice__result', { text: '—' });
      var track = el('.dice__track');
      var fillLow = el('.dice__fill.dice__fill--low');
      var fillHigh = el('.dice__fill.dice__fill--high');
      var marker = el('.dice__marker');
      var pin = el('.dice__pin', { hidden: true });
      track.appendChild(fillLow);
      track.appendChild(fillHigh);
      track.appendChild(pin);
      track.appendChild(marker);

      var slider = el('input.dice__slider', {
        type: 'range', min: String(MIN_TARGET), max: String(MAX_TARGET), step: '1',
        value: String(target), 'aria-label': 'Objetivo'
      });

      var statChance = statBox('Probabilidad', '50,00%');
      var statMult = statBox('Multiplicador', '1,98×');
      var statWin = statBox('Ganancia', U.money(0));

      var verdict = el('.verdict');
      var verdictLabel = el('.verdict__label', { text: '' });
      var verdictAmount = el('.verdict__amount', { text: '' });
      verdict.appendChild(verdictLabel); verdict.appendChild(verdictAmount);

      ctx.stage.appendChild(el('.dice', {}, [
        resultNum,
        el('.dice__trackwrap', {}, [
          track,
          slider,
          el('.dice__scale', {}, [
            el('span', { text: '0' }), el('span', { text: '25' }),
            el('span', { text: '50' }), el('span', { text: '75' }), el('span', { text: '100' })
          ])
        ]),
        el('.dice__stats', {}, [statChance.node, statMult.node, statWin.node]),
        verdict
      ]));

      function statBox(label, value) {
        var v = el('.dice__statval', { text: value });
        return {
          node: el('.dice__stat', {}, [el('.dice__statlabel', { text: label }), v]),
          set: function (t) { v.textContent = t; }
        };
      }

      /* ------------------------------ actualización ------------------------------ */

      function refresh() {
        var p = winChance(target, over);
        var m = multiplier(target, over);
        var bet = ctx.bet ? ctx.bet.get() : 1;

        statChance.set((p * 100).toFixed(2).replace('.', ',') + '%');
        statMult.set(m.toFixed(4).replace('.', ',') + '×');
        statWin.set('+' + U.money(Math.round((bet * m - bet) * 100) / 100));

        marker.style.left = target + '%';
        fillLow.style.width = target + '%';
        fillHigh.style.left = target + '%';
        fillHigh.style.width = (100 - target) + '%';
        fillLow.classList.toggle('is-active', !over);
        fillHigh.classList.toggle('is-active', over);
        marker.textContent = target;

        overBtn.classList.toggle('is-active-credit', over);
        underBtn.classList.toggle('is-active-credit', !over);
        slider.value = String(target);
      }

      slider.addEventListener('input', function () {
        target = U.clamp(parseInt(slider.value, 10) || 50, MIN_TARGET, MAX_TARGET);
        refresh();
      });
      slider.addEventListener('change', function () { C.audio.play('tick'); });

      /* -------------------------------- tirada -------------------------------- */

      var roll = ctx.guard(function () {
        var round = ctx.open();
        if (!round) return;

        var m = multiplier(target, over);
        /* Valor con 2 decimales entre 0,00 y 99,99. */
        var value = Math.floor(rng() * 10000) / 100;
        var won = wins(value, target, over);
        var ret = won ? Math.round(round.stake * m * 100) / 100 : 0;

        verdict.className = 'verdict';
        resultNum.className = 'dice__result is-rolling';
        ctx.play('dice');

        /* Animación: el número "busca" antes de fijarse. */
        var dur = ctx.dur(760);
        var anim = U.animate({
          from: 0, to: 1, duration: dur, easing: U.ease.outCubic,
          onUpdate: function (t) {
            if (t < 0.92) {
              resultNum.textContent = (Math.random() * 100).toFixed(2).replace('.', ',');
            } else {
              resultNum.textContent = value.toFixed(2).replace('.', ',');
            }
          }
        });

        return anim.then(function () {
          resultNum.textContent = value.toFixed(2).replace('.', ',');
          resultNum.className = 'dice__result ' + (won ? 'is-win' : 'is-lose');

          pin.hidden = false;
          pin.style.left = value + '%';

          var result = round.settle(ret, { value: value });

          verdict.className = 'verdict is-show verdict--' + (won ? 'win' : 'lose');
          verdictLabel.textContent = 'Sale ' + value.toFixed(2).replace('.', ',') +
            ' · necesitabas ' + (over ? 'más de ' : 'menos de ') + target;
          verdictAmount.textContent = (result.net > 0 ? '+' : '−') + U.money(Math.abs(result.net));

          history.unshift({ v: value, won: won });
          if (history.length > 16) history.pop();
          renderHistory();

          ctx.celebrate(result, resultNum);
          refresh();
          root.setTimeout(function () { verdict.classList.remove('is-show'); }, 2200);
          return ctx.wait(360);
        });
      });

      var histNode = el('.history');
      ctx.side.appendChild(el('.panel', {}, [
        el('.panel__title', { text: 'Últimas tiradas' }),
        histNode
      ]));

      function renderHistory() {
        U.clear(histNode);
        history.forEach(function (h) {
          histNode.appendChild(el('.history__item' + (h.won ? '.is-win' : '.is-loss'), {
            text: h.v.toFixed(0)
          }));
        });
      }

      /* ------------------------------ controles ------------------------------ */

      var overBtn = ctx.button({
        label: 'Más que', icon: '▲', variant: 'ghost', size: 'lg',
        onClick: function () { over = true; refresh(); }
      });
      var underBtn = ctx.button({
        label: 'Menos que', icon: '▼', variant: 'ghost', size: 'lg',
        onClick: function () { over = false; refresh(); }
      });
      var rollBtn = ctx.button({
        label: 'Tirar', icon: '🎲', variant: 'play',
        onClick: function () { roll(); }
      });

      ctx.controls.appendChild(ctx.bet.node);
      ctx.controls.appendChild(el('.controls__group', {}, [underBtn, overBtn]));
      ctx.controls.appendChild(el('.controls__spacer'));
      ctx.controls.appendChild(rollBtn);
      ctx.lockDuringPlay(rollBtn, overBtn, underBtn);

      if (ctx.bet) {
        var origSet = ctx.bet.set;
        // Al cambiar la apuesta se actualiza la ganancia potencial.
        C.bank.on('change', refresh);
      }
      ctx.bet.node.addEventListener('input', refresh);
      ctx.bet.node.addEventListener('click', function () { root.setTimeout(refresh, 0); });

      ctx.setInfo(el('div', {}, [
        el('p', { text: 'El multiplicador se calcula como 0,99 ÷ probabilidad. Por eso el retorno ' +
                        'teórico es del 99% con cualquier objetivo que elijas: sólo cambias cuánto ' +
                        'riesgo asumes, no la ventaja de la casa.',
                  style: { fontSize: '12.5px', color: 'var(--ink-2)', marginBottom: 'var(--s-3)' } }),
        ctx.table(['Objetivo', 'Probabilidad', 'Multiplicador'], [
          { cells: ['Más de 50', '50,00%', '1,98×'] },
          { cells: ['Más de 75', '25,00%', '3,96×'] },
          { cells: ['Más de 90', '10,00%', '9,90×'] },
          { cells: ['Más de 98', '2,00%', '49,50×'] },
          { cells: ['Menos de 10', '10,00%', '9,90×'] },
          { cells: ['Menos de 2', '2,00%', '49,50×'] }
        ], { compact: true })
      ]));

      refresh();
      return { destroy: function () { C.bank.off('change', refresh); } };
    }
  });

  C.diceLogic = { winChance: winChance, multiplier: multiplier, wins: wins, HOUSE_EDGE: HOUSE_EDGE };
})(typeof window !== 'undefined' ? window : globalThis);
