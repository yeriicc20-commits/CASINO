#!/usr/bin/env node
/* Comprueba que Crash da 99% de RTP con cualquier objetivo de cobro. */
'use strict';
globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.document = {
  addEventListener() {}, removeEventListener() {},
  createElement: () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
                          appendChild() {}, setAttribute() {}, addEventListener() {}, querySelector: () => ({ textContent: '' }) }),
  createElementNS: () => ({ setAttribute() {}, classList: { add() {}, remove() {} } })
};
const path = require('path');
const base = path.join(__dirname, '..');
require(path.join(base, 'js/core/util.js'));
require(path.join(base, 'js/core/store.js'));
require(path.join(base, 'js/core/bank.js'));
const C = globalThis.Casino;
C.audio = { play() {} };
C.fx = { reduced: true, celebrate() {}, clearAll() {}, shake() {}, flash() {}, floatText() {}, mount() {}, sparks() {} };
C.ui = { toast() {}, betControl: () => ({ node: { appendChild() {} }, get: () => 1, setEnabled() {}, destroy() {} }),
         button: () => ({ style: {}, dataset: {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} } }),
         infoPanel: () => ({}), table: () => ({}), notEnough() {}, CHIPS: [], attachTactile() {}, setBusy() {} };
C.progress = { unlock() {} };
require(path.join(base, 'js/core/engine.js'));
require(path.join(base, 'js/games/crash.js'));

const K = C.crashLogic, U = C.util;
const N = Number(process.argv[2]) || 2000000;
const rng = U.createRng(8888);
const BET = 10;

console.log('Crash — ' + N.toLocaleString('es-ES') + ' rondas por objetivo\n');
const targets = [1.1, 1.5, 2, 3, 5, 10, 25, 100];
const crashes = [];
for (let i = 0; i < N; i++) crashes.push(K.rollCrash(rng));

let instant = 0;
for (const c of crashes) if (c <= 1) instant++;

let ok = true;
for (const t of targets) {
  let wag = 0, ret = 0, hits = 0;
  for (const c of crashes) {
    wag += BET;
    // Se cobra en t sólo si la ronda llega a t.
    if (c >= t) { ret += BET * t; hits++; }
  }
  const rtp = ret / wag * 100;
  const realChance = hits / N * 100;
  const theoryChance = K.chanceOfReaching(t) * 100;
  if (Math.abs(rtp - 99) > 1.2) ok = false;
  console.log('cobrar en ' + String(t).padStart(5) + '×   RTP ' + rtp.toFixed(2) + '%' +
              '   llega ' + realChance.toFixed(2) + '% (teoría ' + theoryChance.toFixed(2) + '%)');
}
console.log('\nrondas instantáneas (1,00×): ' + (instant / N * 100).toFixed(2) + '%  (esperado 1,00%)');
const median = crashes.slice().sort((a, b) => a - b)[Math.floor(N / 2)];
console.log('mediana del estallido: ' + median.toFixed(2) + '×  (esperado ~2,00×)');
console.log('\n' + (ok ? '✓ RTP del 99% con todos los objetivos' : '✗ algún objetivo se desvía'));
process.exit(ok ? 0 : 1);
