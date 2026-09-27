/* =========================================================================
   util.js — helpers compartidos
   ========================================================================= */
(function (root) {
  'use strict';

  /** Redondea a 2 decimales evitando errores de coma flotante (0.1+0.2). */
  function round2(n) {
    return Math.round((n + Number.EPSILON) * 100) / 100;
  }

  /** Convierte a céntimos enteros. Toda la contabilidad interna usa céntimos. */
  function toCents(n) {
    return Math.round(n * 100);
  }

  function fromCents(c) {
    return c / 100;
  }

  /** 1234.5 -> "1.234,50 €"  (formato es-ES) */
  function money(n, opts) {
    opts = opts || {};
    var v = Number(n) || 0;
    var decimals = opts.decimals === undefined ? 2 : opts.decimals;
    if (opts.compact && Math.abs(v) >= 1000000) {
      return sign(v) + trimZeros((Math.abs(v) / 1000000).toFixed(2)) + 'M €';
    }
    if (opts.compact && Math.abs(v) >= 100000) {
      return sign(v) + trimZeros((Math.abs(v) / 1000).toFixed(1)) + 'k €';
    }
    var s = Math.abs(v).toFixed(decimals);
    var parts = s.split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return sign(v) + parts.join(',') + ' €';
  }

  function sign(v) {
    return v < 0 ? '-' : '';
  }

  function trimZeros(s) {
    return s.replace(/\.?0+$/, '');
  }

  /** Formatea un multiplicador: 2 -> "2.00x" */
  function mult(n) {
    return (Number(n) || 0).toFixed(2) + 'x';
  }

  function clamp(n, lo, hi) {
    return n < lo ? lo : n > hi ? hi : n;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /* ---------------------------------------------------------------------
     RNG — Mulberry32 sembrable. Sembrable para poder testear de forma
     determinista; por defecto se siembra con crypto para juego real.
     --------------------------------------------------------------------- */
  function createRng(seed) {
    var s;
    if (seed === undefined || seed === null) {
      s = secureSeed();
    } else {
      s = seed >>> 0;
    }
    function next() {
      s = (s + 0x6d2b79f5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    /** Entero en [lo, hi] inclusive. */
    next.int = function (lo, hi) {
      return lo + Math.floor(next() * (hi - lo + 1));
    };
    /** Elemento aleatorio de un array. */
    next.pick = function (arr) {
      return arr[Math.floor(next() * arr.length)];
    };
    /** Fisher-Yates in-place. */
    next.shuffle = function (arr) {
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(next() * (i + 1));
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    };
    /** true con probabilidad p. */
    next.chance = function (p) {
      return next() < p;
    };
    /** Elección ponderada: items [{w:peso, ...}] */
    next.weighted = function (items, weightKey) {
      var key = weightKey || 'w';
      var total = 0, i;
      for (i = 0; i < items.length; i++) total += items[i][key];
      var r = next() * total;
      for (i = 0; i < items.length; i++) {
        r -= items[i][key];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    };
    next.reseed = function (v) {
      s = v >>> 0;
    };
    return next;
  }

  function secureSeed() {
    try {
      if (root.crypto && root.crypto.getRandomValues) {
        var a = new Uint32Array(1);
        root.crypto.getRandomValues(a);
        return a[0];
      }
    } catch (e) { /* entorno sin crypto */ }
    return (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
  }

  /* --------------------------------------------------------------------- */

  function sleep(ms) {
    return new Promise(function (res) { root.setTimeout(res, ms); });
  }

  /** Espera un frame de animación. */
  function nextFrame() {
    return new Promise(function (res) { root.requestAnimationFrame(function () { res(); }); });
  }

  /** Easings (t en 0..1). */
  var ease = {
    linear: function (t) { return t; },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    outQuart: function (t) { return 1 - Math.pow(1 - t, 4); },
    outQuint: function (t) { return 1 - Math.pow(1 - t, 5); },
    inOutCubic: function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    outBack: function (t) {
      var c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    outElastic: function (t) {
      var c4 = (2 * Math.PI) / 3;
      return t === 0 ? 0 : t === 1 ? 1
        : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    outBounce: function (t) {
      var n1 = 7.5625, d1 = 2.75;
      if (t < 1 / d1) return n1 * t * t;
      if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
      if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
      return n1 * (t -= 2.625 / d1) * t + 0.984375;
    }
  };

  /**
   * Bucle de animación por rAF. Llama a onUpdate(valorInterpolado, t) y
   * devuelve una promesa que resuelve al terminar. Cancelable.
   */
  function animate(opts) {
    var from = opts.from === undefined ? 0 : opts.from;
    var to = opts.to === undefined ? 1 : opts.to;
    var duration = Math.max(1, opts.duration || 300);
    var easing = opts.easing || ease.outCubic;
    var onUpdate = opts.onUpdate || function () {};
    var cancelled = false;
    var raf = 0;

    var promise = new Promise(function (resolve) {
      var start = 0;
      function step(ts) {
        if (cancelled) { resolve(false); return; }
        if (!start) start = ts;
        var t = clamp((ts - start) / duration, 0, 1);
        onUpdate(lerp(from, to, easing(t)), t);
        if (t < 1) {
          raf = root.requestAnimationFrame(step);
        } else {
          resolve(true);
        }
      }
      raf = root.requestAnimationFrame(step);
    });
    promise.cancel = function () {
      cancelled = true;
      root.cancelAnimationFrame(raf);
    };
    return promise;
  }

  /* --------------------------- DOM helpers --------------------------- */

  /** el('div.clase#id', {attrs}, [hijos|texto]) */
  function el(spec, attrs, children) {
    var m = /^([a-zA-Z0-9-]+)?((?:[.#][\w-]+)*)$/.exec(spec || 'div');
    var tag = (m && m[1]) || 'div';
    var node = document.createElement(tag);
    if (m && m[2]) {
      m[2].match(/[.#][\w-]+/g).forEach(function (tok) {
        if (tok[0] === '.') node.classList.add(tok.slice(1));
        else node.id = tok.slice(1);
      });
    }
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
        else if (k === 'dataset') Object.assign(node.dataset, v);
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') {
          node.addEventListener(k.slice(2).toLowerCase(), v);
        } else node.setAttribute(k, v === true ? '' : v);
      });
    }
    if (children !== undefined && children !== null) {
      (Array.isArray(children) ? children : [children]).forEach(function (c) {
        if (c === null || c === undefined || c === false) return;
        node.appendChild(typeof c === 'object' ? c : document.createTextNode(String(c)));
      });
    }
    return node;
  }

  function qs(sel, ctx) { return (ctx || document).querySelector(sel); }
  function qsa(sel, ctx) {
    return Array.prototype.slice.call((ctx || document).querySelectorAll(sel));
  }
  function clear(node) {
    while (node && node.firstChild) node.removeChild(node.firstChild);
    return node;
  }

  /** Escapa texto para interpolación en HTML. */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function throttle(fn, ms) {
    var last = 0, timer = null, lastArgs = null;
    return function () {
      lastArgs = arguments;
      var now = Date.now();
      if (now - last >= ms) {
        last = now;
        fn.apply(null, lastArgs);
      } else if (!timer) {
        timer = root.setTimeout(function () {
          timer = null;
          last = Date.now();
          fn.apply(null, lastArgs);
        }, ms - (now - last));
      }
    };
  }

  /** Emisor de eventos minimalista. */
  function emitter() {
    var map = {};
    return {
      on: function (evt, fn) {
        (map[evt] || (map[evt] = [])).push(fn);
        return function () { this.off(evt, fn); }.bind(this);
      },
      off: function (evt, fn) {
        if (!map[evt]) return;
        map[evt] = map[evt].filter(function (f) { return f !== fn; });
      },
      emit: function (evt, payload) {
        (map[evt] || []).slice().forEach(function (f) {
          try { f(payload); } catch (e) { console.error('[' + evt + ']', e); }
        });
      }
    };
  }

  root.Casino = root.Casino || {};
  root.Casino.util = {
    round2: round2, toCents: toCents, fromCents: fromCents,
    money: money, mult: mult, clamp: clamp, lerp: lerp,
    createRng: createRng, sleep: sleep, nextFrame: nextFrame,
    ease: ease, animate: animate,
    el: el, qs: qs, qsa: qsa, clear: clear, esc: esc,
    throttle: throttle, emitter: emitter
  };
})(typeof window !== 'undefined' ? window : globalThis);
