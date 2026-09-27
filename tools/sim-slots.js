#!/usr/bin/env node
/* Simula millones de giros de la tragaperras usando la MISMA lógica que el
   juego (js/games/slots.js), para comprobar el RTP y la frecuencia de premios. */
'use strict';
globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.document = {
  addEventListener() {},
  createElement: () => ({ style: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, setAttribute() {} }),
  createElementNS: () => ({ setAttribute() {} })
};
const path = require('path');
const base = path.join(__dirname, '..');
require(path.join(base, 'js/core/util.js'));
require(path.join(base, 'js/core/store.js'));
require(path.join(base, 'js/core/bank.js'));
const C = globalThis.Casino;
C.audio = { play() {}, unlock() {}, toggle() {} };
C.fx = { reduced: true, celebrate() {}, floatText() {}, clearAll() {}, coinRain() {}, confetti() {}, mount() {}, pulse() {},
         countUp() { const p = Promise.resolve(true); p.cancel = () => {}; return p; } };
C.ui = { toast() {}, betControl: () => ({ node: {}, get: () => 1, setEnabled() {}, destroy() {} }),
         button: () => ({ addEventListener() {}, querySelector: () => ({ textContent: '' }), classList: { add() {}, remove() {}, toggle() {} } }),
         infoPanel: () => ({}), table: () => ({}), notEnough() {}, CHIPS: [0.5, 1, 5, 25, 100, 500], attachTactile() {}, setBusy() {} };
C.progress = { unlock() {}, init() {} };
require(path.join(base, 'js/core/engine.js'));
require(path.join(base, 'js/games/slots.js'));

const L = C.slotsLogic, U = C.util;
const SPINS = Number(process.argv[2]) || 2000000;
const SEEDS = [7, 101, 2024, 55555, 987654, 31337, 424242];
const BET = 10;

function simulate(seed, n) {
  const rng = U.createRng(seed);
  const strips = [];
  for (let i = 0; i < L.REELS; i++) strips.push(L.buildStrip(rng));

  let wagered = 0, returned = 0, hits = 0, trig = 0, owed = 0, freeWon = 0;
  let max = 0, big50 = 0, big200 = 0;

  for (let i = 0; i < n; i++) {
    const isFree = owed > 0;
    if (isFree) owed--; else wagered += BET;

    const grid = [];
    for (let r = 0; r < L.REELS; r++) {
      const p = rng.int(0, L.STRIP_LEN - 1);
      const col = [];
      for (let f = 0; f < L.ROWS; f++) col.push(strips[r][(p + f) % L.STRIP_LEN]);
      grid.push(col);
    }
    const res = L.evaluate(grid);
    const mult = isFree ? L.FREE_MULTIPLIER : 1;
    const win = L.payoutFor(res, BET, mult);

    returned += win;
    if (isFree) freeWon += win;
    if (win > 0) hits++;
    if (win > max) max = win;
    if (win / BET >= 50) big50++;
    if (win / BET >= 200) big200++;
    if (res.scatter && res.scatter.spins) { owed += res.scatter.spins; trig++; }
  }
  return {
    rtp: returned / wagered * 100,
    freeShare: freeWon / wagered * 100,
    hit: hits / n * 100,
    trigEvery: trig ? n / trig : Infinity,
    big50Every: big50 ? n / big50 : Infinity,
    big200Every: big200 ? n / big200 : Infinity,
    maxX: max / BET
  };
}

console.log('Tragaperras — ' + SPINS.toLocaleString('es-ES') + ' giros por semilla\n');
const rtps = [];
for (const seed of SEEDS) {
  const r = simulate(seed, SPINS);
  rtps.push(r.rtp);
  console.log(
    'semilla ' + String(seed).padStart(7) +
    '  RTP ' + r.rtp.toFixed(2) + '%' +
    '  gratis ' + r.freeShare.toFixed(1) + '%' +
    '  acierto ' + r.hit.toFixed(1) + '%' +
    '  bono 1/' + r.trigEvery.toFixed(0) +
    '  50x 1/' + (r.big50Every === Infinity ? '—' : r.big50Every.toFixed(0)) +
    '  200x 1/' + (r.big200Every === Infinity ? '—' : r.big200Every.toFixed(0)) +
    '  máx ' + r.maxX.toFixed(0) + 'x'
  );
}
const avg = rtps.reduce((a, b) => a + b, 0) / rtps.length;
const min = Math.min(...rtps), max = Math.max(...rtps);
console.log('\nRTP medio ' + avg.toFixed(2) + '%   rango ' + min.toFixed(2) + '% – ' + max.toFixed(2) + '%');
console.log('dispersión entre semillas: ' + (max - min).toFixed(2) + ' puntos');
const declared = C.engine.get('slots').rtp;
const ok = Math.abs(avg - declared) < 1.0 && (max - min) < 1.5;
console.log((ok ? '✓' : '✗') + ' RTP declarado en el juego: ' + declared + '%');
process.exit(ok ? 0 : 1);
