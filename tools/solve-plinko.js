#!/usr/bin/env node
/* =========================================================================
   Resuelve las tablas de premios de Plinko.

   La cubeta final sigue una binomial(16, ½), así que
        RTP = Σ_i  C(16,i)/2^16 · pago(i)
   es una suma cerrada. Fijamos los pagos de las cubetas exteriores (las
   raras y llamativas) y resolvemos las centrales —que son las que se
   cobran casi siempre— para dar exactamente el RTP objetivo.
   ========================================================================= */
'use strict';
const ROWS = 16, BUCKETS = ROWS + 1, TARGET = 0.97;

function comb(n, k) {
  if (k < 0 || k > n) return 0;
  k = Math.min(k, n - k);
  let r = 1;
  for (let i = 0; i < k; i++) r = (r * (n - i)) / (i + 1);
  return r;
}
const prob = i => comb(ROWS, i) / Math.pow(2, ROWS);

/* Para cada riesgo: los pagos fijos de las cubetas exteriores (índices 0..),
   y desde qué índice se resuelve. La tabla es simétrica. */
const SHAPES = {
  bajo:  { fixed: [16, 9, 2],            solveFrom: 3, shape: [1, 0.86, 0.74, 0.63, 0.55, 0.5] },
  medio: { fixed: [110, 41, 10, 5],      solveFrom: 4, shape: [1, 0.55, 0.3, 0.19, 0.16] },
  alto:  { fixed: [1000, 130, 26, 9, 4], solveFrom: 5, shape: [1, 0.34, 0.16, 0.13] }
};

function nice(v) {
  if (v <= 0) return 0;
  if (v < 1)  return Math.round(v * 100) / 100;
  if (v < 10) return Math.round(v * 10) / 10;
  return Math.round(v);
}

function build(cfg) {
  const pays = new Array(BUCKETS).fill(0);
  const mid = ROWS / 2;              // 8

  /* 1. Cubetas exteriores fijas, espejadas. */
  cfg.fixed.forEach((v, i) => { pays[i] = v; pays[BUCKETS - 1 - i] = v; });

  /* 2. Cuánto RTP consumen ya. */
  let used = 0;
  for (let i = 0; i < BUCKETS; i++) if (pays[i] > 0) used += prob(i) * pays[i];

  /* 3. Las centrales se reparten el resto manteniendo sus proporciones. */
  const idx = [];
  for (let i = cfg.solveFrom; i <= mid; i++) idx.push(i);
  const shape = cfg.shape.slice(0, idx.length);
  while (shape.length < idx.length) shape.push(shape[shape.length - 1]);

  /* peso total contando el espejo (la central no se espeja) */
  let wsum = 0;
  idx.forEach((i, k) => { wsum += prob(i) * shape[k] * (i === mid ? 1 : 2); });

  const budget = Math.max(0, TARGET - used);
  const scale = budget / wsum;
  idx.forEach((i, k) => {
    const v = nice(shape[k] * scale);
    pays[i] = v;
    pays[BUCKETS - 1 - i] = v;
  });

  /* 4. Cerramos el hueco del redondeo con la cubeta central, sin dejar que
        rompa la monotonía (la central nunca puede pagar más que su vecina:
        quedaría raro a la vista y no es como funciona el juego). */
  for (let guard = 0; guard < 8000; guard++) {
    let r = 0;
    for (let i = 0; i < BUCKETS; i++) r += prob(i) * pays[i];
    if (Math.abs(r - TARGET) <= 0.001) break;
    const step = 0.01;
    let next = Math.round((pays[mid] + (r < TARGET ? step : -step)) * 100) / 100;
    if (next < 0) break;
    if (next > pays[mid - 1]) {
      /* La central ya toca su techo: seguimos ajustando con la siguiente. */
      next = pays[mid - 1];
      pays[mid] = next;
      const v = Math.round((pays[mid - 1] + (r < TARGET ? step : -step)) * 100) / 100;
      pays[mid - 1] = v; pays[BUCKETS - mid] = v;
      continue;
    }
    pays[mid] = next;
  }
  return pays;
}

function rtpOf(pays) {
  let s = 0;
  for (let i = 0; i < BUCKETS; i++) s += prob(i) * pays[i];
  return s;
}

console.log('Plinko — 16 filas, objetivo RTP ' + (TARGET * 100).toFixed(1) + '%\n');
console.log('cubeta  probabilidad     1 entre');
for (let i = 0; i <= ROWS / 2; i++) {
  console.log(String(i + 1).padStart(5) + '   ' + (prob(i) * 100).toFixed(4).padStart(9) + '%   ' +
              Math.round(1 / prob(i)).toLocaleString('es-ES').padStart(9));
}
console.log('');

const out = {};
let ok = true;
for (const key of Object.keys(SHAPES)) {
  const pays = build(SHAPES[key]);
  out[key] = pays;
  const r = rtpOf(pays);
  const symmetric = pays.every((v, i) => v === pays[BUCKETS - 1 - i]);
  /* De fuera hacia el centro los pagos nunca deben subir. */
  let monotonic = true;
  for (let i = 1; i <= ROWS / 2; i++) if (pays[i] > pays[i - 1]) monotonic = false;
  if (Math.abs(r - TARGET) > 0.005 || !symmetric || !monotonic) ok = false;
  console.log('riesgo ' + key.padEnd(6) + ' RTP ' + (r * 100).toFixed(2) + '%  simétrica: ' +
              (symmetric ? 'sí' : 'NO') + '  decreciente: ' + (monotonic ? 'sí' : 'NO') +
              '  máx ' + Math.max(...pays) + '×');
  console.log('  [' + pays.join(', ') + ']');
}

console.log('\n--- pays para plinko.js ---');
for (const key of Object.keys(out)) {
  console.log('    ' + key + ': pays: [' + out[key].join(', ') + ']');
}
console.log('\n' + (ok ? '✓ las tres tablas dan el RTP objetivo, son simétricas y decrecientes'
                       : '✗ alguna tabla no cuadra'));
process.exit(ok ? 0 : 1);
