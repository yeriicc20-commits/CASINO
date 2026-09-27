/* =========================================================================
   app.js — arranque, barra superior, vestíbulo y pantallas de meta-juego.
   ========================================================================= */
(function (root) {
  'use strict';
  var C = root.Casino;
  var U = C.util, store = C.store, bank = C.bank, ui = C.ui, fx = C.fx,
      audio = C.audio, progress = C.progress, engine = C.engine, router = C.router;
  var el = U.el;

  /* ============================ BARRA SUPERIOR ============================ */

  var hudAmount, hudDelta, hudMoney, hudBadge, hudTitle, hudXpNum, hudXpFill;
  var shownBalance = 0;
  var balanceAnim = null;

  function initHud() {
    hudAmount = U.qs('#hudAmount');
    hudDelta = U.qs('#hudDelta');
    hudMoney = U.qs('#hudMoney');
    hudBadge = U.qs('#hudBadge');
    hudTitle = U.qs('#hudTitle');
    hudXpNum = U.qs('#hudXpNum');
    hudXpFill = U.qs('#hudXpFill');

    shownBalance = bank.balance;
    hudAmount.textContent = U.money(shownBalance);
    renderXp();

    bank.on('change', onBalanceChange);
    progress.on('xp', renderXp);
    progress.on('levelup', renderXp);

    var brand = U.qs('#brand');
    ui.attachTactile(brand, function () { router.go('lobby'); });
    brand.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.go('lobby'); }
    });

    var lvl = U.qs('#hudLevel');
    ui.attachTactile(lvl, function () { router.go('logros'); });
    lvl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.go('logros'); }
    });

    var actions = U.qs('#topbarActions');
    actions.appendChild(ui.button({
      label: 'Vestíbulo', icon: '🏠', variant: 'flat', size: 'sm',
      title: 'Ir al vestíbulo',
      onClick: function () { router.go('lobby'); }
    }));
    actions.appendChild(ui.button({
      label: 'Ajustes', icon: '⚙️', variant: 'flat', size: 'sm', iconOnly: true,
      ariaLabel: 'Ajustes', title: 'Ajustes',
      onClick: openSettings
    }));
  }

  /** Saldo animado: cuenta hasta el nuevo valor y muestra el delta. */
  function onBalanceChange(info) {
    var target = bank.balance;
    if (balanceAnim) balanceAnim.cancel();

    if (info && info.deltaCents) {
      var d = U.fromCents(info.deltaCents);
      hudDelta.textContent = (d > 0 ? '+' : '−') + U.money(Math.abs(d));
      hudDelta.className = 'hud__delta ' + (d > 0 ? 'is-win' : 'is-loss');
      void hudDelta.offsetWidth;
      hudDelta.classList.add('is-show');

      hudMoney.classList.remove('is-up', 'is-down');
      void hudMoney.offsetWidth;
      hudMoney.classList.add(d > 0 ? 'is-up' : 'is-down');
      root.setTimeout(function () { hudMoney.classList.remove('is-up', 'is-down'); }, 700);
    }

    balanceAnim = fx.countUp(hudAmount, shownBalance, target, { duration: 520 });
    var from = shownBalance;
    shownBalance = target;
    balanceAnim.then(function (ok) {
      if (!ok) return;
      hudAmount.textContent = U.money(target);
      if (target > from) fx.pulse(hudAmount, 'gold');
    });
  }

  function renderXp() {
    var info = progress.levelInfo();
    hudBadge.textContent = info.level;
    hudTitle.textContent = info.title;
    hudXpNum.textContent = info.xp + '/' + info.need;
    hudXpFill.style.width = (info.pct * 100).toFixed(1) + '%';
  }

  /* ============================== VESTÍBULO ============================== */

  function lobby(host) {
    var bonus = progress.bonusAvailable();
    var bonusInfo = progress.bonusAmount();

    /* --- hero --- */
    var heroActions = el('.hero__actions');
    var featured = pickFeatured();
    heroActions.appendChild(ui.button({
      label: featured ? 'Jugar a ' + featured.name : 'Empezar a jugar',
      sub: featured ? featured.tagline : null,
      icon: featured ? featured.icon : '🎲',
      variant: 'primary', size: 'lg',
      onClick: function () { router.go('juego/' + (featured ? featured.id : 'slots')); }
    }));
    if (bonus) {
      heroActions.appendChild(ui.button({
        label: 'Bonus diario', sub: '+' + U.money(bonusInfo.amount),
        icon: '🎁', variant: 'success', size: 'lg',
        onClick: claimBonus
      }));
    }
    heroActions.appendChild(ui.button({
      label: 'Estadísticas', icon: '📊', variant: 'ghost', size: 'lg',
      onClick: function () { router.go('stats'); }
    }));

    var T = store.state.totals;
    host.appendChild(el('.hero.anim-in-scale', {}, [
      el('.hero__inner', {}, [
        el('span.hero__eyebrow', {}, [
          el('span', { text: '●', style: { color: 'var(--emerald-hi)' } }),
          el('span', { text: engine.count() + ' máquinas abiertas' })
        ]),
        el('h1.hero__title', {}, [
          el('span', { text: 'Bienvenido al ' }),
          el('span.grad-gold', { text: 'Casino Royale' })
        ]),
        el('p.hero__text', {
          text: T.rounds > 0
            ? 'Llevas ' + T.rounds.toLocaleString('es-ES') + ' rondas jugadas y ' +
              U.money(U.fromCents(T.wageredCents), { compact: true }) + ' apostados. ' +
              'Elige tu máquina y sigue.'
            : 'Doce máquinas, fichas de sobra y ningún euro real en juego. ' +
              'Empieza con 1.000 € de fichas y a ver hasta dónde llegas.'
        }),
        heroActions
      ])
    ]));

    /* --- aviso si el saldo está a cero --- */
    if (progress.needsRescue()) {
      var rescueCard = el('.panel.anim-in-up', {
        style: { borderLeft: '3px solid var(--warn)', marginBottom: 'var(--s-5)' }
      }, [
        el('.row.row--between.row--wrap', {}, [
          el('div', {}, [
            el('.panel__title', { text: 'Te has quedado sin fichas' }),
            el('p', { text: 'La casa te presta ' + U.money(progress.RESCUE_AMOUNT) + ' para que sigas jugando.',
                      style: { fontSize: '13px', color: 'var(--ink-2)' } })
          ]),
          ui.button({
            label: 'Aceptar el préstamo', icon: '🤝', variant: 'primary',
            onClick: function () { progress.rescue(); router.render(); }
          })
        ])
      ]);
      host.appendChild(rescueCard);
    }

    /* --- rejilla de máquinas --- */
    host.appendChild(el('.section-head', {}, [
      el('div', {}, [
        el('h2.section-head__title', {}, [
          el('span', { text: '🎪', 'aria-hidden': 'true' }),
          el('span', { text: 'Las máquinas' })
        ]),
        el('p.section-head__sub', { text: 'Todas pagan según su tabla; el RTP indica el retorno teórico.' })
      ])
    ]));

    var grid = el('.machines.stagger');
    engine.list().forEach(function (game) {
      grid.appendChild(machineCard(game));
    });
    host.appendChild(grid);

    return { destroy: function () {} };
  }

  /** La máquina destacada: la última jugada, o las tragaperras. */
  function pickFeatured() {
    var last = store.state.lastGame && engine.get(store.state.lastGame);
    return last || engine.get('slots') || engine.list()[0];
  }

  function machineCard(game) {
    var g = store.state.games[game.id];
    var played = g && g.rounds > 0;
    var isNew = !played;
    var best = g && g.biggestWinCents > 0 ? U.fromCents(g.biggestWinCents) : 0;

    var card = el('.mcard', {
      role: 'link', tabindex: '0',
      'aria-label': 'Jugar a ' + game.name,
      style: { '--mc-accent': game.accent }
    }, [
      isNew ? el('span.mcard__flag', { text: 'Nuevo' }) : null,
      el('.mcard__top', {}, [
        el('span.mcard__icon', { text: game.icon, 'aria-hidden': 'true' }),
        el('div.grow', {}, [
          el('h3.mcard__name', { text: game.name }),
          el('p.mcard__tagline', { text: game.tagline })
        ])
      ]),
      el('p.mcard__desc', { text: game.desc }),
      el('.mcard__foot', {}, [
        el('.mcard__tags', {}, [
          game.rtp ? el('span.tag.tag--rtp', { text: 'RTP ' + game.rtp + '%' }) : null,
          played ? el('span.tag', { text: g.rounds + ' rondas' }) : null,
          best > 0 ? el('span.tag.tag--hot', { text: 'Récord ' + U.money(best, { compact: true }) }) : null
        ]),
        el('span.mcard__play', {}, [
          el('span', { text: 'Jugar' }),
          el('span', { text: '→', 'aria-hidden': 'true' })
        ])
      ])
    ]);

    function open() { router.go('juego/' + game.id); }
    ui.attachTactile(card, open);
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
    return card;
  }

  function claimBonus() {
    var info = progress.claimBonus();
    if (!info) {
      ui.toast('El bonus de hoy ya está reclamado. Vuelve mañana.', { type: 'info', icon: '⏳' });
      return;
    }
    ui.modal({
      icon: '🎁',
      title: '¡Bonus diario!',
      subtitle: 'Día ' + info.streak + ' de racha',
      body: '<p>Se han añadido <strong>' + U.money(info.amount) + '</strong> a tu saldo.</p>' +
            (info.streak < 7
              ? '<p>Vuelve mañana para subir la racha: el día 7 se pagan <strong>1.750 €</strong>.</p>'
              : '<p>¡Racha máxima! Sigues cobrando <strong>1.750 €</strong> cada día.</p>'),
      actions: [{ label: '¡Gracias!', value: true, primary: true }]
    }).then(function () { router.render(); });
  }

  /* ============================ PANTALLA DE JUEGO ============================ */

  function gameScreen(host, gameId) {
    var game = engine.get(gameId);
    if (!game) {
      host.appendChild(el('.screen-error', {}, [
        el('h2', { text: 'Esa máquina no existe' }),
        el('p', { text: 'Puede que el enlace esté mal. Vuelve al vestíbulo para ver todas.' }),
        el('div', { style: { marginTop: 'var(--s-4)' } }, [
          ui.button({ label: 'Ir al vestíbulo', icon: '🏠', variant: 'primary',
                      onClick: function () { router.go('lobby'); } })
        ])
      ]));
      return null;
    }
    return engine.mount(gameId, host);
  }

  /* ============================= ESTADÍSTICAS ============================= */

  function statsScreen(host) {
    var T = store.state.totals;
    var wagered = U.fromCents(T.wageredCents);
    var returned = U.fromCents(T.returnedCents);
    var net = returned - wagered;
    var rtp = wagered > 0 ? (returned / wagered) * 100 : 0;
    var decided = T.wins + T.losses;

    host.appendChild(el('.section-head', {}, [
      el('div', {}, [
        el('h2.section-head__title', {}, [
          el('span', { text: '📊', 'aria-hidden': 'true' }),
          el('span', { text: 'Tus estadísticas' })
        ]),
        el('p.section-head__sub', { text: 'Todo lo que has jugado desde que empezaste.' })
      ]),
      ui.button({ label: 'Logros', icon: '🏆', variant: 'ghost',
                  onClick: function () { router.go('logros'); } })
    ]));

    host.appendChild(el('.stats-grid.stagger', { style: { marginBottom: 'var(--s-6)' } }, [
      stat('Saldo actual', U.money(bank.balance), 'Máximo: ' + U.money(U.fromCents(T.peakBalanceCents)), 'gold'),
      stat('Resultado neto', (net >= 0 ? '+' : '−') + U.money(Math.abs(net)),
           net >= 0 ? 'Vas por delante' : 'Vas por detrás', net >= 0 ? 'win' : 'lose'),
      stat('Total apostado', U.money(wagered, { compact: true }), T.rounds.toLocaleString('es-ES') + ' rondas'),
      stat('Retorno real', wagered > 0 ? rtp.toFixed(1) + '%' : '—',
           'Devuelto: ' + U.money(returned, { compact: true })),
      stat('Rondas ganadas', T.wins.toLocaleString('es-ES'),
           decided > 0 ? ((T.wins / decided) * 100).toFixed(1) + '% de las decididas' : 'Aún sin datos'),
      stat('Mayor premio', U.money(U.fromCents(T.biggestWinCents)),
           T.biggestMultiplier > 0 ? 'Mejor multiplicador: ' + U.mult(T.biggestMultiplier) : '', 'gold'),
      stat('Nivel', String(store.state.level), progress.levelInfo().title, 'violet'),
      stat('Logros', Object.keys(store.state.achievements).length + '/' + progress.ACHIEVEMENTS.length,
           'Pulsa para verlos')
    ]));

    /* --- desglose por máquina --- */
    host.appendChild(el('.section-head', {}, [
      el('div', {}, [
        el('h2.section-head__title', { text: 'Por máquina' }),
        el('p.section-head__sub', { text: 'Ordenado por dinero apostado.' })
      ])
    ]));

    var rows = engine.list().map(function (game) {
      var g = store.state.games[game.id] || store.blankGameStats();
      return { game: game, g: g };
    }).filter(function (r) { return r.g.rounds > 0; })
      .sort(function (a, b) { return b.g.wageredCents - a.g.wageredCents; });

    if (!rows.length) {
      host.appendChild(el('.panel', {}, [
        el('p', { text: 'Todavía no has jugado a ninguna máquina. ¡Empieza cuando quieras!',
                  style: { color: 'var(--ink-2)', fontSize: '13.5px' } })
      ]));
    } else {
      var body = rows.map(function (r) {
        var w = U.fromCents(r.g.wageredCents);
        var ret = U.fromCents(r.g.returnedCents);
        var n = ret - w;
        return {
          cells: [
            { html: '<span style="font-size:15px">' + r.game.icon + '</span> ' + U.esc(r.game.name) },
            String(r.g.rounds),
            U.money(w, { compact: true }),
            {
              html: '<span class="' + (n >= 0 ? 'text-win' : 'text-lose') + '">' +
                    (n >= 0 ? '+' : '−') + U.esc(U.money(Math.abs(n), { compact: true })) + '</span>'
            },
            w > 0 ? ((ret / w) * 100).toFixed(1) + '%' : '—'
          ]
        };
      });
      host.appendChild(el('.panel', {}, [
        ui.table(['Máquina', 'Rondas', 'Apostado', 'Neto', 'Retorno'], body)
      ]));
    }

    host.appendChild(el('div', { style: { marginTop: 'var(--s-6)', textAlign: 'center' } }, [
      ui.button({
        label: 'Reiniciar la partida', icon: '🗑️', variant: 'ghost', size: 'sm',
        onClick: confirmReset
      })
    ]));

    return { destroy: function () {} };
  }

  function stat(label, value, sub, tone) {
    var color = tone === 'win' ? 'var(--win)' : tone === 'lose' ? 'var(--lose)'
              : tone === 'gold' ? 'var(--gold-hi)' : tone === 'violet' ? 'var(--violet-hi)' : 'var(--ink)';
    return el('.stat', {}, [
      el('.stat__label', { text: label }),
      el('.stat__value', { text: value, style: { color: color } }),
      sub ? el('.stat__sub', { text: sub }) : null
    ]);
  }

  /* =============================== LOGROS =============================== */

  function achievementsScreen(host) {
    var done = Object.keys(store.state.achievements).length;
    var total = progress.ACHIEVEMENTS.length;
    var info = progress.levelInfo();

    host.appendChild(el('.section-head', {}, [
      el('div', {}, [
        el('h2.section-head__title', {}, [
          el('span', { text: '🏆', 'aria-hidden': 'true' }),
          el('span', { text: 'Logros' })
        ]),
        el('p.section-head__sub', { text: done + ' de ' + total + ' desbloqueados' })
      ]),
      ui.button({ label: 'Estadísticas', icon: '📊', variant: 'ghost',
                  onClick: function () { router.go('stats'); } })
    ]));

    /* barra de progreso general */
    host.appendChild(el('.panel', { style: { marginBottom: 'var(--s-5)' } }, [
      el('.row.row--between', { style: { marginBottom: 'var(--s-3)' } }, [
        el('div', {}, [
          el('.panel__title', { text: 'Nivel ' + info.level + ' — ' + info.title,
                                style: { marginBottom: '2px' } }),
          el('p', { text: info.xp + ' / ' + info.need + ' XP para el siguiente nivel',
                    style: { fontSize: '12px', color: 'var(--ink-3)' } })
        ]),
        el('span.stat__value', { text: ((done / total) * 100).toFixed(0) + '%',
                                 style: { color: 'var(--gold-hi)' } })
      ]),
      el('.xpbar', { style: { height: '8px' } }, [
        el('.xpbar__fill', { style: { width: (info.pct * 100).toFixed(1) + '%' } })
      ])
    ]));

    var grid = el('.ach-grid.stagger');
    // Primero los desbloqueados, luego el resto.
    progress.ACHIEVEMENTS.slice().sort(function (a, b) {
      var ua = progress.unlocked(a.id) ? 0 : 1;
      var ub = progress.unlocked(b.id) ? 0 : 1;
      return ua - ub;
    }).forEach(function (a) {
      var got = progress.unlocked(a.id);
      grid.appendChild(el('.ach' + (got ? '.is-done' : '.is-locked'), {}, [
        el('span.ach__icon', { text: got ? a.icon : '🔒', 'aria-hidden': 'true' }),
        el('div.grow', {}, [
          el('.ach__name', { text: a.name }),
          el('.ach__desc', { text: a.desc }),
          el('.ach__reward', { text: got ? '✓ Conseguido · +' + U.money(a.reward) : 'Recompensa: ' + U.money(a.reward) })
        ])
      ]));
    });
    host.appendChild(grid);

    return { destroy: function () {} };
  }

  /* =============================== AJUSTES =============================== */

  function openSettings() {
    var s = store.state.settings;
    var body = el('div');

    body.appendChild(toggleRow('Sonido', 'Efectos sintetizados de fichas, cartas y premios.',
      s.sound, function (on) { audio.toggle(on); if (on) audio.play('coin'); }));

    body.appendChild(toggleRow('Animaciones', 'Desactívalas si prefieres una interfaz más estática.',
      s.animations, function (on) {
        s.animations = on;
        document.documentElement.classList.toggle('no-anim', !on);
        store.save();
      }));

    body.appendChild(toggleRow('Confeti en los premios', 'El confeti sólo aparece al ganar.',
      s.confetti, function (on) { s.confetti = on; store.save(); }));

    body.appendChild(toggleRow('Modo rápido', 'Acorta las animaciones de las máquinas casi a la mitad.',
      s.fastMode, function (on) { s.fastMode = on; store.save(); }));

    /* volumen */
    var vol = el('input.slider', {
      type: 'range', min: '0', max: '100', value: String(Math.round(s.volume * 100)),
      'aria-label': 'Volumen'
    });
    vol.addEventListener('input', function () {
      audio.setVolume(Number(vol.value) / 100);
    });
    vol.addEventListener('change', function () { audio.play('chip'); });
    body.appendChild(el('.setting', {}, [
      el('div', {}, [
        el('.setting__name', { text: 'Volumen' }),
        el('.setting__desc', { text: 'Nivel general de los efectos.' })
      ]),
      vol
    ]));

    if (!store.storageOk) {
      body.appendChild(el('.setting', {}, [
        el('div', {}, [
          el('.setting__name', { text: '⚠️ Sin guardado', style: { color: 'var(--warn)' } }),
          el('.setting__desc', { text: 'El navegador no permite almacenamiento local, así que la partida no se guardará al cerrar.' })
        ])
      ]));
    }

    ui.modal({
      title: 'Ajustes',
      icon: '⚙️',
      wide: true,
      body: body,
      actions: [
        { label: 'Reiniciar partida', value: 'reset', variant: 'danger' },
        { label: 'Cerrar', value: 'close', variant: 'primary' }
      ]
    }).then(function (v) {
      if (v === 'reset') confirmReset();
    });
  }

  function toggleRow(name, desc, initial, onChange) {
    var sw = el('.switch', {
      role: 'switch', tabindex: '0',
      'aria-checked': initial ? 'true' : 'false',
      'aria-label': name
    });
    function flip() {
      var on = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', on ? 'true' : 'false');
      onChange(on);
      audio.play('click');
    }
    sw.addEventListener('click', flip);
    sw.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); }
    });
    return el('.setting', {}, [
      el('div', {}, [
        el('.setting__name', { text: name }),
        el('.setting__desc', { text: desc })
      ]),
      sw
    ]);
  }

  function confirmReset() {
    ui.confirm({
      title: '¿Reiniciar la partida?',
      subtitle: 'Se borra todo: saldo, nivel, logros y estadísticas.',
      icon: '🗑️',
      confirmLabel: 'Sí, borrar todo',
      danger: true
    }).then(function (yes) {
      if (!yes) return;
      store.reset();
      shownBalance = bank.balance;
      bank._resetLedger();
      bank._clearRounds();
      hudAmount.textContent = U.money(shownBalance);
      renderXp();
      document.documentElement.classList.toggle('no-anim', !store.state.settings.animations);
      ui.toast('Partida reiniciada. Tienes 1.000 € de fichas otra vez.', { type: 'info', icon: '🔄' });
      router.go('lobby');
      router.render();
    });
  }

  /* ============================ MOTAS DE AMBIENTE ============================ */

  function initAmbient() {
    var host = U.qs('.ambient');
    if (!host) return;
    var n = root.innerWidth < 700 ? 10 : 20;
    for (var i = 0; i < n; i++) {
      host.appendChild(el('.ambient__mote', {
        style: {
          left: (Math.random() * 100).toFixed(2) + '%',
          animationDuration: (12 + Math.random() * 16).toFixed(1) + 's',
          animationDelay: (-Math.random() * 24).toFixed(1) + 's',
          '--drift': (Math.random() * 120 - 60).toFixed(0) + 'px',
          transform: 'scale(' + (0.6 + Math.random() * 1.5).toFixed(2) + ')'
        }
      }));
    }
  }

  /* ================================ ARRANQUE ================================ */

  function boot() {
    store.load();
    document.documentElement.classList.toggle('no-anim', !store.state.settings.animations);

    progress.init();
    fx.mount();
    initAmbient();
    initHud();

    router.define('lobby', lobby);
    router.define('juego', gameScreen);
    router.define('stats', statsScreen);
    router.define('logros', achievementsScreen);
    router.define('404', function (host) {
      host.appendChild(el('.screen-error', {}, [
        el('h2', { text: 'Página no encontrada' }),
        el('div', { style: { marginTop: 'var(--s-4)' } }, [
          ui.button({ label: 'Ir al vestíbulo', icon: '🏠', variant: 'primary',
                      onClick: function () { router.go('lobby'); } })
        ])
      ]));
    });

    router.start(U.qs('#screen'));

    // El audio necesita un gesto del usuario para arrancar.
    ['pointerdown', 'keydown'].forEach(function (evt) {
      root.addEventListener(evt, function once() {
        audio.unlock();
        root.removeEventListener(evt, once);
      }, { once: true });
    });

    // Guardado al cerrar: no perdemos la última ronda.
    root.addEventListener('beforeunload', function () { store.saveNow(); });
    root.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') store.saveNow();
    });

    // Atajos: L vestíbulo, S estadísticas, A logros.
    root.addEventListener('keydown', function (e) {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      var k = e.key.toLowerCase();
      if (k === 'l') router.go('lobby');
      else if (k === 's') router.go('stats');
      else if (k === 'a') router.go('logros');
    });

    console.log('%c🎰 Casino Royale', 'color:#f5c451;font-size:16px;font-weight:bold',
                '\n' + engine.count() + ' máquinas cargadas.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})(typeof window !== 'undefined' ? window : globalThis);
