/* =========================================================================
   ui.js — componentes compartidos: toasts, modales, control de apuesta,
   feedback táctil de los botones.
   ========================================================================= */
(function (root) {
  'use strict';
  var U = root.Casino.util;
  var fx = root.Casino.fx;
  var audio = root.Casino.audio;
  var bank = root.Casino.bank;
  var store = root.Casino.store;
  var el = U.el;

  var toastHost = null;
  var modalHost = null;
  var openModal = null;

  /* ------------------------------- TOASTS ------------------------------- */

  function ensureToastHost() {
    if (!toastHost) {
      toastHost = el('.toast-host', { role: 'status', 'aria-live': 'polite' });
      document.body.appendChild(toastHost);
    }
    return toastHost;
  }

  /** toast('Texto', {type:'win'|'info'|'warn'|'error', icon:'🎉', ms:2600}) */
  function toast(message, opts) {
    opts = opts || {};
    var host = ensureToastHost();
    var node = el('.toast.toast--' + (opts.type || 'info'), {}, [
      opts.icon ? el('span.toast__icon', { text: opts.icon }) : null,
      el('span.toast__msg', { text: message })
    ]);
    host.appendChild(node);
    // Entrada en el frame siguiente para que la transición se dispare.
    root.requestAnimationFrame(function () { node.classList.add('is-in'); });
    var ms = opts.ms || 2600;
    root.setTimeout(function () {
      node.classList.remove('is-in');
      node.classList.add('is-out');
      root.setTimeout(function () { node.remove(); }, 320);
    }, ms);
    // Más de 4 toasts a la vez es ruido: retiramos los más viejos.
    while (host.children.length > 4) host.removeChild(host.firstChild);
    return node;
  }

  /* ------------------------------- MODALES ------------------------------- */

  function ensureModalHost() {
    if (!modalHost) {
      modalHost = el('.modal-host', { hidden: true });
      modalHost.addEventListener('click', function (e) {
        if (e.target === modalHost && openModal && openModal.dismissable) close();
      });
      document.body.appendChild(modalHost);
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && openModal && openModal.dismissable) close();
      });
    }
    return modalHost;
  }

  /**
   * modal({title, body(Node|string), actions:[{label, variant, value, primary}],
   *        dismissable, icon, wide}) -> Promise<value|null>
   */
  function modal(opts) {
    opts = opts || {};
    var host = ensureModalHost();
    U.clear(host);
    host.hidden = false;

    return new Promise(function (resolve) {
      function finish(value) {
        resolve(value);
        close();
      }

      var card = el('.modal' + (opts.wide ? '.modal--wide' : ''), {
        role: 'dialog', 'aria-modal': 'true',
        'aria-label': opts.title || 'Diálogo'
      });

      if (opts.icon) card.appendChild(el('.modal__icon', { text: opts.icon }));
      if (opts.title) card.appendChild(el('h2.modal__title', { text: opts.title }));
      if (opts.subtitle) card.appendChild(el('p.modal__subtitle', { text: opts.subtitle }));

      if (opts.body) {
        var bodyNode = el('.modal__body');
        if (typeof opts.body === 'string') bodyNode.innerHTML = opts.body;
        else bodyNode.appendChild(opts.body);
        card.appendChild(bodyNode);
      }

      var acts = opts.actions || [{ label: 'Entendido', value: true, primary: true }];
      var row = el('.modal__actions');
      acts.forEach(function (a) {
        row.appendChild(button({
          label: a.label,
          variant: a.variant || (a.primary ? 'primary' : 'ghost'),
          size: 'lg',
          icon: a.icon,
          onClick: function () { finish(a.value === undefined ? a.label : a.value); }
        }));
      });
      card.appendChild(row);

      host.appendChild(card);
      openModal = { dismissable: opts.dismissable !== false, resolve: resolve };
      audio.play('open');

      root.requestAnimationFrame(function () {
        host.classList.add('is-open');
        var first = card.querySelector('.btn--primary, .btn');
        if (first) first.focus();
      });

      // El backdrop resuelve a null si se puede descartar.
      openModal.onDismiss = function () { resolve(null); };
    });
  }

  function close() {
    if (!modalHost) return;
    modalHost.classList.remove('is-open');
    var m = openModal;
    openModal = null;
    root.setTimeout(function () {
      if (!openModal) { modalHost.hidden = true; U.clear(modalHost); }
    }, 220);
    if (m && m.onDismiss) m.onDismiss();
  }

  function confirm(opts) {
    return modal({
      title: opts.title,
      subtitle: opts.subtitle,
      body: opts.body,
      icon: opts.icon || '❓',
      actions: [
        { label: opts.confirmLabel || 'Confirmar', value: true, variant: opts.danger ? 'danger' : 'primary' },
        { label: opts.cancelLabel || 'Cancelar', value: false, variant: 'ghost' }
      ]
    }).then(function (v) { return v === true; });
  }

  /* ------------------------------- BOTONES ------------------------------- */

  /**
   * Botón profesional: bisel, brillo, onda al pulsar, estados.
   * button({label, icon, variant, size, onClick, disabled, title, badge, sub})
   */
  function button(opts) {
    opts = opts || {};
    var cls = '.btn';
    if (opts.variant) cls += '.btn--' + opts.variant;
    if (opts.size) cls += '.btn--' + opts.size;
    if (opts.block) cls += '.btn--block';
    if (opts.iconOnly) cls += '.btn--icon';

    var node = el('button' + cls, {
      type: 'button',
      title: opts.title || null,
      'aria-label': opts.ariaLabel || (opts.iconOnly ? opts.label : null),
      disabled: opts.disabled ? true : null
    });

    // Capa de brillo que barre en hover.
    node.appendChild(el('span.btn__shine', { 'aria-hidden': 'true' }));
    var content = el('span.btn__content');
    if (opts.icon) content.appendChild(el('span.btn__icon', { text: opts.icon, 'aria-hidden': 'true' }));
    if (opts.label && !opts.iconOnly) {
      var labelWrap = el('span.btn__labels');
      labelWrap.appendChild(el('span.btn__label', { text: opts.label }));
      if (opts.sub) labelWrap.appendChild(el('span.btn__sub', { text: opts.sub }));
      content.appendChild(labelWrap);
    } else if (opts.iconOnly && !opts.icon) {
      content.appendChild(el('span.btn__label', { text: opts.label }));
    }
    node.appendChild(content);
    if (opts.badge) node.appendChild(el('span.btn__badge', { text: opts.badge }));

    attachTactile(node, opts.onClick, opts.sound);
    return node;
  }

  /** Añade onda + sonido a cualquier elemento pulsable. */
  function attachTactile(node, onClick, soundName) {
    node.addEventListener('pointerdown', function (e) {
      if (node.disabled || node.classList.contains('is-disabled')) return;
      if (fx.reduced) return;
      var r = node.getBoundingClientRect();
      var ink = el('span.btn__ink', {
        'aria-hidden': 'true',
        style: {
          left: (e.clientX - r.left) + 'px',
          top: (e.clientY - r.top) + 'px'
        }
      });
      node.appendChild(ink);
      root.setTimeout(function () { ink.remove(); }, 620);
    });
    node.addEventListener('pointerenter', function () {
      if (node.disabled || node.classList.contains('is-disabled')) return;
      audio.play('hover');
    });
    if (onClick) {
      node.addEventListener('click', function (e) {
        if (node.disabled || node.classList.contains('is-disabled')) return;
        audio.play(soundName || 'click');
        onClick(e);
      });
    }
    return node;
  }

  /** Marca/desmarca un botón como ocupado (spinner + bloqueo). */
  function setBusy(node, busy, label) {
    if (!node) return;
    node.classList.toggle('is-busy', !!busy);
    node.disabled = !!busy;
    if (label !== undefined) {
      var l = node.querySelector('.btn__label');
      if (l) {
        if (busy) { l.dataset.prev = l.textContent; l.textContent = label; }
        else if (l.dataset.prev) { l.textContent = l.dataset.prev; delete l.dataset.prev; }
      }
    }
  }

  /* --------------------------- CONTROL DE APUESTA --------------------------- */

  var CHIPS = [0.5, 1, 5, 25, 100, 500];

  /**
   * Control de apuesta reutilizable por todos los juegos.
   * Es el único sitio donde se valida la apuesta contra el saldo, así
   * ningún juego puede apostar más de lo que hay.
   *
   * betControl({min, max, value, gameId, onChange}) -> {node, get, set, setEnabled, refresh}
   */
  function betControl(opts) {
    opts = opts || {};
    var min = opts.min === undefined ? 0.5 : opts.min;
    var hardMax = opts.max === undefined ? 1000 : opts.max;
    var value = U.clamp(opts.value === undefined ? 1 : opts.value, min, hardMax);
    var onChange = opts.onChange || function () {};
    var enabled = true;

    var display = el('span.bet__value');
    var input = el('input.bet__input', {
      type: 'number', min: min, max: hardMax, step: '0.5',
      'aria-label': 'Importe de la apuesta',
      value: value.toFixed(2)
    });

    function currentMax() {
      // Nunca se puede seleccionar una apuesta mayor que el saldo.
      return Math.max(min, Math.min(hardMax, Math.floor(bank.balance * 100) / 100));
    }

    function set(v, silent) {
      var next = Number(v);
      if (!Number.isFinite(next)) next = min;
      // Redondeo a céntimos: evita apuestas tipo 3.333333 €
      next = Math.round(next * 100) / 100;
      next = U.clamp(next, min, currentMax());
      var changed = next !== value;
      value = next;
      display.textContent = U.money(value);
      input.value = value.toFixed(2);
      refreshChips();
      if (changed && !silent) onChange(value);
      return value;
    }

    function nudge(mult) {
      var before = value;
      set(value * mult);
      if (value === before) audio.play('deny'); else audio.play('chip');
    }

    var chipRow = el('.bet__chips');
    var chipButtons = CHIPS.map(function (c) {
      var b = el('button.chip', {
        type: 'button',
        'data-amount': c,
        'aria-label': 'Apostar ' + U.money(c)
      }, [
        el('span.chip__ring', { 'aria-hidden': 'true' }),
        el('span.chip__face', { text: c < 1 ? String(c).replace('.', ',') : String(c) })
      ]);
      attachTactile(b, function () {
        set(c);
        audio.play('chip');
      }, 'chip');
      chipRow.appendChild(b);
      return b;
    });

    function refreshChips() {
      var max = currentMax();
      chipButtons.forEach(function (b) {
        var amt = Number(b.dataset.amount);
        var tooBig = amt > max;
        b.classList.toggle('is-disabled', tooBig || !enabled);
        b.disabled = tooBig || !enabled;
        b.classList.toggle('is-active', Math.abs(amt - value) < 0.001);
      });
      halfBtn.disabled = !enabled;
      doubleBtn.disabled = !enabled;
      maxBtn.disabled = !enabled;
      input.disabled = !enabled;
    }

    var halfBtn = button({
      label: '½', variant: 'ghost', size: 'sm', title: 'Mitad de la apuesta',
      onClick: function () { nudge(0.5); }, sound: 'chip'
    });
    var doubleBtn = button({
      label: '2×', variant: 'ghost', size: 'sm', title: 'Doblar la apuesta',
      onClick: function () { nudge(2); }, sound: 'chip'
    });
    var maxBtn = button({
      label: 'MÁX', variant: 'ghost', size: 'sm', title: 'Apostar el máximo posible',
      onClick: function () {
        var before = value;
        set(currentMax());
        if (value === before) audio.play('deny'); else audio.play('chip');
      }, sound: 'chip'
    });

    input.addEventListener('change', function () { set(input.value); });
    input.addEventListener('blur', function () { set(input.value); });

    var node = el('.bet', {}, [
      el('.bet__head', {}, [
        el('span.bet__label', { text: 'Apuesta' }),
        el('.bet__field', {}, [input])
      ]),
      el('.bet__actions', {}, [halfBtn, doubleBtn, maxBtn]),
      chipRow
    ]);

    // Si el saldo baja, la apuesta seleccionada se ajusta sola.
    var off = bank.on('change', function () {
      if (value > currentMax()) set(currentMax());
      else refreshChips();
    });

    set(value, true);

    return {
      node: node,
      get: function () { return value; },
      set: set,
      max: currentMax,
      setEnabled: function (on) {
        enabled = !!on;
        node.classList.toggle('is-locked', !enabled);
        refreshChips();
      },
      refresh: refreshChips,
      destroy: function () { if (off) off(); }
    };
  }

  /* ------------------------------ MISCELÁNEA ------------------------------ */

  /** Panel plegable de reglas/pagos, igual en todos los juegos. */
  function infoPanel(title, contentNode) {
    var body = el('.info__body', {}, [contentNode]);
    var head = el('button.info__head', { type: 'button', 'aria-expanded': 'false' }, [
      el('span.info__title', { text: title }),
      el('span.info__chev', { text: '▾', 'aria-hidden': 'true' })
    ]);
    var wrap = el('.info', {}, [head, body]);
    attachTactile(head, function () {
      var open = wrap.classList.toggle('is-open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    return wrap;
  }

  /** Tabla simple para paytables. */
  function table(headers, rows, opts) {
    opts = opts || {};
    var thead = el('thead', {}, [
      el('tr', {}, headers.map(function (h) { return el('th', { text: h }); }))
    ]);
    var tbody = el('tbody', {}, rows.map(function (r) {
      return el('tr', r.highlight ? { class: 'is-hl' } : {}, (r.cells || r).map(function (c) {
        return el('td', typeof c === 'object' ? c : { text: String(c) });
      }));
    }));
    return el('table.ptable' + (opts.compact ? '.ptable--compact' : ''), {}, [thead, tbody]);
  }

  /** Aviso de saldo insuficiente, con oferta de rescate. */
  function notEnough(needed) {
    audio.play('deny');
    toast('Saldo insuficiente para apostar ' + U.money(needed), { type: 'warn', icon: '⚠️' });
  }

  root.Casino.ui = {
    toast: toast, modal: modal, confirm: confirm, closeModal: close,
    button: button, attachTactile: attachTactile, setBusy: setBusy,
    betControl: betControl, infoPanel: infoPanel, table: table,
    notEnough: notEnough, CHIPS: CHIPS
  };
})(typeof window !== 'undefined' ? window : globalThis);
