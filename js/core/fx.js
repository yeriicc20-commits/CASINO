/* =========================================================================
   fx.js — efectos visuales (confeti, monedas, números flotantes, shake…)

   Todas las partículas viven en UN solo canvas con UN solo bucle rAF que
   se detiene cuando no hay nada que dibujar. Así las animaciones de los
   juegos nunca compiten con varios bucles a la vez (cero tirones).
   ========================================================================= */
(function (root) {
  'use strict';
  var U = root.Casino.util;
  var store = root.Casino.store;

  var canvas = null, ctx = null, dpr = 1;
  var particles = [];
  var running = false;
  var lastTs = 0;
  var MAX_PARTICLES = 420;

  var GOLD = ['#ffd76e', '#f5c451', '#e0a92b', '#fff3c9'];
  var FESTIVE = ['#ffd76e', '#f5c451', '#ff5d73', '#4ecdc4', '#a78bfa', '#7ee787', '#fff3c9'];

  function reduced() {
    if (!store.state.settings.animations) return true;
    try {
      return root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch (e) { return false; }
  }

  function mount() {
    if (canvas) return;
    canvas = U.el('canvas.fx-canvas', { 'aria-hidden': 'true' });
    document.body.appendChild(canvas);
    ctx = canvas.getContext('2d');
    resize();
    root.addEventListener('resize', U.throttle(resize, 120));
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(root.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(root.innerWidth * dpr);
    canvas.height = Math.floor(root.innerHeight * dpr);
    canvas.style.width = root.innerWidth + 'px';
    canvas.style.height = root.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function start() {
    if (running) return;
    running = true;
    lastTs = 0;
    root.requestAnimationFrame(tick);
  }

  function tick(ts) {
    if (!lastTs) lastTs = ts;
    // dt acotado: si la pestaña estuvo en segundo plano no damos un salto brusco
    var dt = Math.min((ts - lastTs) / 1000, 0.05);
    lastTs = ts;

    ctx.clearRect(0, 0, root.innerWidth, root.innerHeight);

    for (var i = particles.length - 1; i >= 0; i--) {
      var p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.vy += p.gravity * dt;
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      if (p.y > root.innerHeight + 60) { particles.splice(i, 1); continue; }
      drawParticle(p);
    }

    if (particles.length) {
      root.requestAnimationFrame(tick);
    } else {
      running = false;
      ctx.clearRect(0, 0, root.innerWidth, root.innerHeight);
    }
  }

  function drawParticle(p) {
    var alpha = p.life < p.fade ? p.life / p.fade : 1;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    if (p.kind === 'coin') {
      // "moneda": elipse que se aplasta al girar, con brillo
      var w = Math.abs(Math.cos(p.rot)) * p.size + p.size * 0.18;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, p.size / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha * 0.55;
      ctx.fillStyle = '#fff8dc';
      ctx.beginPath();
      ctx.ellipse(-w * 0.12, -p.size * 0.14, w / 5, p.size / 5, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'spark') {
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size * 0.32;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, -p.size * 0.6);
      ctx.lineTo(0, p.size * 0.6);
      ctx.stroke();
    } else {
      // confeti rectangular
      ctx.fillStyle = p.color;
      var h = p.size * (0.35 + Math.abs(Math.cos(p.rot)) * 0.65);
      ctx.fillRect(-p.size / 2, -h / 2, p.size, h);
    }
    ctx.restore();
  }

  function spawn(p) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push(p);
  }

  function base(x, y, o) {
    o = o || {};
    return {
      x: x, y: y,
      vx: 0, vy: 0,
      gravity: o.gravity === undefined ? 900 : o.gravity,
      drag: o.drag === undefined ? 0.995 : o.drag,
      size: o.size || 9,
      color: o.color || '#ffd76e',
      rot: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 14,
      life: o.life || 1.6,
      fade: o.fade || 0.5,
      kind: o.kind || 'confetti'
    };
  }

  /* ------------------------------ API pública ------------------------------ */

  /** Lluvia de confeti desde arriba. intensity 0..1 */
  function confetti(intensity, colors) {
    if (reduced() || !store.state.settings.confetti) return;
    mount();
    var n = Math.round(U.clamp(intensity === undefined ? 0.6 : intensity, 0.1, 1) * 160);
    var pal = colors || FESTIVE;
    for (var i = 0; i < n; i++) {
      var p = base(Math.random() * root.innerWidth, -20 - Math.random() * 120, {
        size: 7 + Math.random() * 8,
        color: pal[(Math.random() * pal.length) | 0],
        gravity: 420 + Math.random() * 380,
        life: 2.4 + Math.random() * 1.6,
        fade: 0.8
      });
      p.vx = (Math.random() - 0.5) * 160;
      p.vy = 60 + Math.random() * 140;
      spawn(p);
    }
    start();
  }

  /** Explosión radial de monedas desde un elemento o punto. */
  function coinBurst(target, count) {
    if (reduced()) return;
    mount();
    var pt = pointOf(target);
    var n = count || 22;
    for (var i = 0; i < n; i++) {
      var ang = (Math.PI * 2 * i) / n + Math.random() * 0.4;
      var speed = 220 + Math.random() * 380;
      var p = base(pt.x, pt.y, {
        kind: 'coin',
        size: 12 + Math.random() * 10,
        color: GOLD[(Math.random() * GOLD.length) | 0],
        gravity: 1150,
        life: 1.5 + Math.random() * 0.8,
        fade: 0.45
      });
      p.vx = Math.cos(ang) * speed;
      p.vy = Math.sin(ang) * speed - 220;
      spawn(p);
    }
    start();
  }

  /** Chispas cortas: aciertos pequeños, revelados. */
  function sparks(target, count, color) {
    if (reduced()) return;
    mount();
    var pt = pointOf(target);
    var n = count || 12;
    for (var i = 0; i < n; i++) {
      var ang = Math.random() * Math.PI * 2;
      var speed = 120 + Math.random() * 260;
      var p = base(pt.x, pt.y, {
        kind: 'spark',
        size: 8 + Math.random() * 8,
        color: color || '#ffd76e',
        gravity: 520,
        drag: 0.975,
        life: 0.5 + Math.random() * 0.4,
        fade: 0.4
      });
      p.vx = Math.cos(ang) * speed;
      p.vy = Math.sin(ang) * speed;
      spawn(p);
    }
    start();
  }

  /** Chorro de monedas cayendo desde arriba (premio gordo). */
  function coinRain(duration) {
    if (reduced()) return;
    mount();
    var until = Date.now() + (duration || 1600);
    (function drop() {
      if (Date.now() > until) return;
      for (var i = 0; i < 4; i++) {
        var p = base(Math.random() * root.innerWidth, -30, {
          kind: 'coin',
          size: 14 + Math.random() * 12,
          color: GOLD[(Math.random() * GOLD.length) | 0],
          gravity: 700 + Math.random() * 400,
          life: 3, fade: 0.6
        });
        p.vx = (Math.random() - 0.5) * 90;
        p.vy = 120 + Math.random() * 120;
        spawn(p);
      }
      start();
      root.setTimeout(drop, 70);
    })();
  }

  function pointOf(target) {
    if (!target) return { x: root.innerWidth / 2, y: root.innerHeight / 2 };
    if (typeof target.x === 'number') return target;
    var r = target.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  /* ---------------------------- efectos sobre DOM ---------------------------- */

  /** Sacude un elemento (o la pantalla). */
  function shake(target, strength) {
    if (reduced()) return;
    var node = target || document.getElementById('app') || document.body;
    var cls = strength === 'hard' ? 'fx-shake-hard' : 'fx-shake';
    node.classList.remove('fx-shake', 'fx-shake-hard');
    void node.offsetWidth; // fuerza reinicio de la animación
    node.classList.add(cls);
    root.setTimeout(function () { node.classList.remove(cls); }, strength === 'hard' ? 620 : 420);
  }

  /** Destello de color a pantalla completa. */
  function flash(color, ms) {
    if (reduced()) return;
    mount();
    var f = U.el('div.fx-flash', { style: { background: color || 'rgba(255,215,110,.28)' } });
    document.body.appendChild(f);
    root.setTimeout(function () { f.remove(); }, ms || 420);
  }

  /** Número flotante que asciende y se desvanece (+12,50 €). */
  function floatText(target, text, opts) {
    opts = opts || {};
    var pt = pointOf(target);
    var node = U.el('div.fx-float' + (opts.negative ? '.is-negative' : '') + (opts.big ? '.is-big' : ''), {
      text: text,
      style: { left: pt.x + 'px', top: pt.y + 'px' }
    });
    document.body.appendChild(node);
    root.setTimeout(function () { node.remove(); }, 1500);
  }

  /**
   * Cuenta ascendente sobre un elemento de texto. Devuelve la animación
   * (cancelable) para que el juego pueda interrumpirla si el jugador acelera.
   */
  function countUp(node, from, to, opts) {
    opts = opts || {};
    var fmt = opts.format || function (v) { return U.money(v); };
    if (reduced() || store.state.settings.fastMode) {
      node.textContent = fmt(to);
      var done = Promise.resolve(true);
      done.cancel = function () {};
      return done;
    }
    var anim = U.animate({
      from: from, to: to,
      duration: opts.duration || U.clamp(Math.abs(to - from) * 6, 260, 1100),
      easing: U.ease.outQuart,
      onUpdate: function (v) { node.textContent = fmt(v); }
    });
    anim.then(function (ok) { if (ok) node.textContent = fmt(to); });
    return anim;
  }

  /** Marca un elemento con un pulso de "ganancia". */
  function pulse(node, variant) {
    if (!node || reduced()) return;
    var cls = 'fx-pulse' + (variant ? '-' + variant : '');
    node.classList.remove('fx-pulse', 'fx-pulse-gold', 'fx-pulse-bad');
    void node.offsetWidth;
    node.classList.add(cls);
    root.setTimeout(function () { node.classList.remove(cls); }, 700);
  }

  /** Ondas concéntricas en un punto (impacto de bola, revelado). */
  function ripple(target, color) {
    if (reduced()) return;
    var pt = pointOf(target);
    var r = U.el('div.fx-ripple', {
      style: { left: pt.x + 'px', top: pt.y + 'px', borderColor: color || 'rgba(255,215,110,.7)' }
    });
    document.body.appendChild(r);
    root.setTimeout(function () { r.remove(); }, 700);
  }

  function clearAll() {
    particles.length = 0;
    if (ctx) ctx.clearRect(0, 0, root.innerWidth, root.innerHeight);
  }

  /**
   * Celebración escalada según el multiplicador conseguido.
   * Un único punto de entrada evita que cada juego invente su propia mezcla.
   */
  function celebrate(multiplier, target) {
    var audio = root.Casino.audio;
    if (multiplier >= 25) {
      confetti(1); coinRain(1800); coinBurst(target, 34);
      flash('rgba(255,215,110,.3)'); shake(null, 'hard');
      audio.play('winMega');
    } else if (multiplier >= 8) {
      confetti(0.7); coinBurst(target, 24); flash('rgba(255,215,110,.18)');
      audio.play('winBig');
    } else if (multiplier >= 2) {
      coinBurst(target, 14); sparks(target, 10);
      audio.play('win');
    } else if (multiplier > 0) {
      sparks(target, 8);
      audio.play('coin');
    }
  }

  root.Casino.fx = {
    mount: mount, confetti: confetti, coinBurst: coinBurst, coinRain: coinRain,
    sparks: sparks, shake: shake, flash: flash, floatText: floatText,
    countUp: countUp, pulse: pulse, ripple: ripple, celebrate: celebrate,
    clearAll: clearAll,
    get reduced() { return reduced(); },
    PALETTE: { GOLD: GOLD, FESTIVE: FESTIVE }
  };
})(typeof window !== 'undefined' ? window : globalThis);
