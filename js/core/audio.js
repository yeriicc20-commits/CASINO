/* =========================================================================
   audio.js — efectos de sonido sintetizados con WebAudio.
   No hay ficheros de audio: todo se genera en tiempo real, así el proyecto
   funciona abriendo index.html sin descargar nada.
   ========================================================================= */
(function (root) {
  'use strict';
  var store = root.Casino.store;

  var ctx = null;
  var master = null;
  var unlocked = false;
  var noiseBuffer = null;

  function settings() { return store.state.settings; }

  function ensureCtx() {
    if (ctx) return ctx;
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = settings().volume;
      master.connect(ctx.destination);
    } catch (e) {
      ctx = null;
    }
    return ctx;
  }

  /** Los navegadores exigen un gesto del usuario antes de sonar. */
  function unlock() {
    if (unlocked) return;
    var c = ensureCtx();
    if (!c) return;
    if (c.state === 'suspended') c.resume();
    unlocked = true;
  }

  function setVolume(v) {
    settings().volume = Math.max(0, Math.min(1, v));
    if (master) master.gain.value = settings().volume;
    store.save();
  }

  function enabled() {
    return settings().sound && ensureCtx() !== null;
  }

  function now() { return ctx.currentTime; }

  /** Envolvente ADSR breve sobre un gain node. */
  function envGain(t0, dur, peak, attack) {
    var g = ctx.createGain();
    var a = attack === undefined ? 0.005 : attack;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t0 + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    g.connect(master);
    return g;
  }

  /** Tono simple. */
  function tone(freq, dur, opts) {
    if (!enabled()) return;
    opts = opts || {};
    var t0 = now() + (opts.delay || 0);
    var osc = ctx.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, opts.to), t0 + dur);
    }
    var g = envGain(t0, dur, opts.gain === undefined ? 0.18 : opts.gain, opts.attack);
    if (opts.detune) osc.detune.setValueAtTime(opts.detune, t0);
    osc.connect(g);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function getNoise() {
    if (noiseBuffer) return noiseBuffer;
    var len = Math.floor(ctx.sampleRate * 0.5);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = noiseBuffer.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return noiseBuffer;
  }

  /** Ruido filtrado: clics, fichas, roces. */
  function noise(dur, opts) {
    if (!enabled()) return;
    opts = opts || {};
    var t0 = now() + (opts.delay || 0);
    var src = ctx.createBufferSource();
    src.buffer = getNoise();
    var filt = ctx.createBiquadFilter();
    filt.type = opts.filter || 'bandpass';
    filt.frequency.setValueAtTime(opts.freq || 1800, t0);
    if (opts.freqTo) filt.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + dur);
    filt.Q.value = opts.q === undefined ? 1.2 : opts.q;
    var g = envGain(t0, dur, opts.gain === undefined ? 0.15 : opts.gain, opts.attack || 0.002);
    src.connect(filt); filt.connect(g);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function chord(freqs, dur, opts) {
    freqs.forEach(function (f, i) {
      tone(f, dur, Object.assign({}, opts, { delay: (opts && opts.delay || 0) + i * 0.045 }));
    });
  }

  /* --------------------------- biblioteca de SFX --------------------------- */

  var sfx = {
    click: function () { noise(0.04, { freq: 2600, gain: 0.1, q: 2 }); tone(880, 0.05, { gain: 0.05, type: 'triangle' }); },
    hover: function () { tone(1400, 0.035, { gain: 0.028, type: 'sine' }); },
    back:  function () { tone(520, 0.1, { to: 300, gain: 0.1, type: 'triangle' }); },
    open:  function () { tone(420, 0.16, { to: 780, gain: 0.1, type: 'triangle' }); },

    chip:  function () { noise(0.07, { freq: 3200, freqTo: 1200, gain: 0.13, q: 3 }); },
    bet:   function () { noise(0.06, { freq: 2800, gain: 0.12, q: 3 }); tone(660, 0.07, { gain: 0.06, type: 'square' }); },
    deny:  function () { tone(200, 0.18, { to: 120, gain: 0.16, type: 'sawtooth' }); },

    reelTick: function () { noise(0.03, { freq: 1500, gain: 0.07, q: 4 }); },
    reelStop: function () { noise(0.09, { freq: 700, freqTo: 220, gain: 0.17, q: 1.5 }); tone(160, 0.1, { gain: 0.1, type: 'square' }); },
    spin:  function () { noise(0.3, { freq: 600, freqTo: 2400, gain: 0.07, filter: 'bandpass', q: 0.8 }); },

    card:  function () { noise(0.075, { freq: 2200, freqTo: 800, gain: 0.11, q: 1.2 }); },
    flip:  function () { noise(0.05, { freq: 3000, freqTo: 1400, gain: 0.09, q: 2 }); },
    shuffle: function () {
      for (var i = 0; i < 6; i++) noise(0.05, { freq: 2000 + Math.random() * 1200, gain: 0.07, delay: i * 0.05, q: 2 });
    },

    dice: function () {
      for (var i = 0; i < 5; i++) {
        noise(0.045, { freq: 900 + Math.random() * 700, gain: 0.1, delay: i * 0.075, q: 2.5, filter: 'bandpass' });
      }
    },
    peg:   function () { tone(1200 + Math.random() * 600, 0.045, { gain: 0.07, type: 'triangle' }); },
    tick:  function () { tone(1800, 0.025, { gain: 0.05, type: 'square' }); },

    win:   function () { chord([523.25, 659.25, 783.99], 0.3, { gain: 0.13, type: 'triangle' }); },
    winBig: function () {
      chord([523.25, 659.25, 783.99, 1046.5], 0.5, { gain: 0.15, type: 'triangle' });
      chord([783.99, 987.77, 1174.66], 0.45, { gain: 0.1, type: 'sine', delay: 0.22 });
    },
    winMega: function () {
      [0, 0.12, 0.24, 0.36].forEach(function (d, i) {
        chord([523.25 * (1 + i * 0.25), 659.25 * (1 + i * 0.25), 783.99 * (1 + i * 0.25)],
              0.4, { gain: 0.14, type: 'triangle', delay: d });
      });
      noise(0.6, { freq: 400, freqTo: 5000, gain: 0.08, q: 0.6, delay: 0.1 });
    },
    lose: function () { tone(330, 0.22, { to: 165, gain: 0.12, type: 'triangle' }); },
    push: function () { tone(440, 0.14, { gain: 0.1, type: 'sine' }); tone(440, 0.14, { gain: 0.08, type: 'sine', delay: 0.16 }); },

    cashout: function () {
      [659.25, 830.61, 987.77, 1318.5].forEach(function (f, i) {
        tone(f, 0.18, { gain: 0.12, type: 'triangle', delay: i * 0.06 });
      });
    },
    explode: function () {
      noise(0.45, { freq: 900, freqTo: 80, gain: 0.26, filter: 'lowpass', q: 1 });
      tone(90, 0.4, { to: 40, gain: 0.2, type: 'sawtooth' });
    },
    reveal: function () { tone(1000 + Math.random() * 400, 0.07, { gain: 0.07, type: 'sine' }); },
    scratch: function () { noise(0.12, { freq: 1200, freqTo: 3000, gain: 0.08, filter: 'highpass', q: 0.8 }); },

    levelUp: function () {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(function (f, i) {
        tone(f, 0.22, { gain: 0.13, type: 'triangle', delay: i * 0.07 });
      });
    },
    achievement: function () {
      chord([783.99, 1046.5, 1318.5], 0.35, { gain: 0.12, type: 'sine' });
    },
    coin: function () { tone(1318.5, 0.07, { gain: 0.09, type: 'square' }); tone(1760, 0.09, { gain: 0.07, type: 'square', delay: 0.05 }); }
  };

  function play(name) {
    if (!settings().sound) return;
    unlock();
    var fn = sfx[name];
    if (fn && ctx) { try { fn(); } catch (e) { /* audio no crítico */ } }
  }

  root.Casino.audio = {
    play: play,
    unlock: unlock,
    setVolume: setVolume,
    get volume() { return settings().volume; },
    toggle: function (on) {
      settings().sound = on === undefined ? !settings().sound : !!on;
      if (settings().sound) unlock();
      store.save();
      return settings().sound;
    },
    get enabled() { return settings().sound; },
    names: Object.keys(sfx)
  };
})(typeof window !== 'undefined' ? window : globalThis);
