#!/usr/bin/env node
/* =========================================================================
   Resuelve la tabla de pagos de Keno.

   Las probabilidades son exactas (hipergeométrica), así que
        RTP(k) = Σ_h  P(k,h) · pago(k,h)
   es una suma cerrada y se puede resolver en lugar de adivinarla.

   El bote de cada nivel máximo se FIJA a un valor razonable (acertar 10 de
   10 es 1 entre 848 millones: dejar que la fórmula pusiera el pago que
   "tocaba" daba multiplicadores de cientos de millones). El RTP que sobra
   se reparte entre los niveles bajos, que son los que se cobran de verdad.
   ========================================================================= */
'use strict';
const POOL = 40, DRAWN = 10, TARGET = 0.95;

function comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}
function prob(picks, hits) {
  return (comb(picks, hits) * comb(POOL - picks, DRAWN - hits)) / comb(POOL, DRAWN);
}

/* min   = aciertos mínimos que pagan
   jack  = pago fijo del nivel máximo (0 = lo resuelve la fórmula)
   decay = cómo se reparte el RTP restante entre los niveles bajos */
const CONFIG = {
  1:  { min: 1,  jack: 0,      decay: 0.62 },
  2:  { min: 2,  jack: 0,      decay: 0.62 },
  3:  { min: 2,  jack: 45,     decay: 0.62 },
  4:  { min: 2,  jack: 120,    decay: 0.60 },
  5:  { min: 3,  jack: 600,    decay: 0.58 },
  6:  { min: 3,  jack: 2000,   decay: 0.56 },
  7:  { min: 3,  jack: 6000,   decay: 0.54 },
  8:  { min: 4,  jack: 20000,  decay: 0.52 },
  9:  { min: 4,  jack: 40000,  decay: 0.50 },
  10: { min: 5,  jack: 100000, decay: 0.48 }
};

function nice(v) {
  if (v <= 0) return 0;
  if (v < 10)   return Math.round(v * 10) / 10;
  if (v < 100)  return Math.round(v);
  if (v < 1000) return Math.round(v / 5) * 5;
  return Math.round(v / 50) * 50;
}

function rtp(picks, table) {
  let s = 0;
  for (let h = 0; h <= picks; h++) s += prob(picks, h) * (table[h] || 0);
  return s;
}

function solve(picks) {
  const { min, jack, decay } = CONFIG[picks];
  const table = new Array(picks + 1).fill(0);

  /* 1. El bote fijo (si lo hay) y cuánto RTP consume. */
  let budget = TARGET;
  let tiers = [];
  for (let h = min; h <= picks; h++) tiers.push(h);

  if (jack > 0 && tiers.length > 1) {
    table[picks] = jack;
    budget -= prob(picks, picks) * jack;
    tiers = tiers.filter(h => h !== picks);
  }

  /* 2. El resto del RTP se reparte con pesos decrecientes: el nivel más
        bajo (el más frecuente) aporta la mayor parte. */
  const w = tiers.map((_, i) => Math.pow(decay, i));
  const wsum = w.reduce((a, b) => a + b, 0);
  tiers.forEach((h, i) => {
    const share = budget * w[i] / wsum;
    table[h] = nice(share / prob(picks, h));
  });

  /* 3. Cerramos el hueco que deja el redondeo ajustando el nivel que más
        aporta, en pasos pequeños. */
  const knob = tiers
    .map(h => ({ h, c: prob(picks, h) * table[h] }))
    .sort((a, b) => b.c - a.c)[0].h;

  for (let guard = 0; guard < 6000; guard++) {
    const r = rtp(picks, table);
    if (Math.abs(r - TARGET) <= 0.0025) break;
    const step = table[knob] < 10 ? 0.1 : table[knob] < 100 ? 0.5 : 5;
    const next = table[knob] + (r < TARGET ? step : -step);
    if (next <= 0) break;
    table[knob] = Math.round(next * 10) / 10;
  }
  return table;
}

const out = {};
console.log('Keno — objetivo RTP ' + (TARGET * 100).toFixed(1) + '%\n');
console.log('eleg.  RTP      probab. del pleno     tabla');
let ok = true;
for (let k = 1; k <= 10; k++) {
  const t = solve(k);
  out[k] = t;
  const r = rtp(k, t);
  if (Math.abs(r - TARGET) > 0.01) ok = false;
  const shown = t.map((v, h) => v > 0 ? h + ':' + v : null).filter(Boolean).join('  ');
  const pTop = prob(k, k);
  console.log(
    String(k).padStart(4) + '  ' + (r * 100).toFixed(2) + '%   1 entre ' +
    Math.round(1 / pTop).toLocaleString('es-ES').padStart(15) + '   ' + shown
  );
}
console.log('\n--- PAYS para keno.js ---');
console.log('  var PAYS = {');
for (let k = 1; k <= 10; k++) {
  console.log('    ' + String(k).padStart(2) + ': [' + out[k].join(', ') + '],');
}
console.log('  };');
console.log('\n' + (ok ? '✓ todos los niveles dentro de ±1 punto del objetivo'
                       : '✗ algún nivel se sale del objetivo'));
process.exit(ok ? 0 : 1);
