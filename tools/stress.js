#!/usr/bin/env node
/* =========================================================================
   stress.js — sesión larga y agresiva contra el banco.

   Juega decenas de miles de rondas repartidas por las 12 máquinas, con
   subidas de apuesta, apuestas a todo el saldo y rachas de ruina, y
   comprueba el cuadre DESPUÉS DE CADA RONDA (no sólo al final).

   Se prueban dos repartos de premios:
     · realista  — con ventaja de la casa, como en el juego de verdad
     · extremo   — absurdamente favorable, para forzar los límites
   Uso: node tools/stress.js [rondas]
   ========================================================================= */
'use strict';
const path = require('path');
const { createDocument } = require('./lib/fake-dom.js');

globalThis.window = undefined;
let storage = {};
globalThis.localStorage = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); }
};
globalThis.document = createDocument();
globalThis.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.innerWidth = 1280; globalThis.innerHeight = 900; globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {}; globalThis.removeEventListener = () => {};
globalThis.location = { hash: '#/lobby', replace() {} };

const base = path.join(__dirname, '..');
const load = p => require(path.join(base, p));
load('js/core/util.js'); load('js/core/store.js'); load('js/core/bank.js');
const C = globalThis.Casino, U = C.util;
C.audio = { play() {}, unlock() {}, toggle() {}, setVolume() {}, get enabled() { return false; }, get volume() { return 0; }, names: [] };
C.fx = {
  reduced: true, celebrate() {}, floatText() {}, clearAll() {}, coinRain() {}, confetti() {},
  coinBurst() {}, sparks() {}, shake() {}, flash() {}, ripple() {}, pulse() {}, mount() {},
  countUp() { const p = Promise.resolve(true); p.cancel = () => {}; return p; },
  PALETTE: { GOLD: [], FESTIVE: [] }
};
load('js/core/ui.js'); load('js/core/progress.js'); load('js/core/engine.js'); load('js/games/deck.js');
['slots','roulette','blackjack','videopoker','baccarat','dice','mines','crash','plinko','hilo','keno','scratch']
  .forEach(g => load('js/games/' + g + '.js'));
C.progress.init();

const N = Number(process.argv[2]) || 50000;

/* Repartos de premios (multiplicador del retorno sobre la apuesta).
   La media de cada tabla está calculada abajo y se imprime, para que el
   nombre del reparto no mienta sobre lo que hace. */
const PROFILES = {
  /* Media 0,95 — ventaja de la casa, como las máquinas de verdad. */
  realista: [0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2.5, 2.8],
  /* Media 11,6 — imposible en el juego; sirve para forzar el tope de saldo
     y comprobar que la aritmética entera sigue siendo exacta. */
  extremo:  [0, 0, 0, 0, 1, 2, 2.5, 10, 100, 0.5]
};

const meanOf = t => t.reduce((a, b) => a + b, 0) / t.length;

let allOk = true;

for (const [name, table] of Object.entries(PROFILES)) {
  const rng = U.createRng(20240927);
  const ids = C.engine.list().map(g => g.id);
  storage = {};
  C.store._replace(Object.assign(C.store.defaultState(), { balanceCents: 100000 }));
  C.bank._clearRounds(); C.bank._resetLedger();
  const opening = C.bank.balanceCents;

  let rounds = 0, desync = 0, negative = 0, rescues = 0, unsafe = 0;
  const errs = new Set();
  let minB = Infinity, maxB = 0;
  const t0 = Date.now();

  for (let i = 0; i < N; i++) {
    const id = rng.pick(ids);
    const bal = C.bank.balance;
    if (bal < 0.5) { C.bank.credit(500, 'rescate'); rescues++; continue; }

    /* 5% de las veces se apuesta TODO el saldo. */
    const stake = rng.chance(0.05)
      ? Math.floor(bal * 100) / 100
      : rng.pick([0.5, 1, 5, 25, 100]);
    if (stake > bal) continue;

    let r;
    try { r = C.bank.openRound(id, stake); }
    catch (e) { if (e.code !== 'INSUFFICIENT_FUNDS') errs.add(e.code); continue; }

    /* subidas: doblar, separar, seguro */
    if (rng.chance(0.15) && r.canRaise(stake)) {
      try { r.raise(stake); } catch (e) { errs.add('raise:' + e.code); }
    }

    const mult = rng.pick(table);
    try { r.settle(Math.round(r.stake * mult * 100) / 100); }
    catch (e) { errs.add('settle:' + e.code); }
    rounds++;

    const nb = C.bank.balance;
    if (nb < minB) minB = nb;
    if (nb > maxB) maxB = nb;
    if (C.bank.balanceCents < 0) negative++;
    if (!Number.isSafeInteger(C.bank.balanceCents)) unsafe++;
    if (!C.bank.audit(opening).ok) desync++;
  }

  const ms = Date.now() - t0;
  const st = C.store.state;
  let w = 0, ret = 0;
  Object.keys(st.games).forEach(g => { w += st.games[g].wageredCents; ret += st.games[g].returnedCents; });
  const audit = C.bank.audit(opening);
  const statsOk = w === st.totals.wageredCents && ret === st.totals.returnedCents;
  const good = desync === 0 && negative === 0 && unsafe === 0 && errs.size === 0 && audit.ok && statsOk;
  if (!good) allOk = false;

  console.log('\n\x1b[1mReparto "' + name + '"\x1b[0m (media ' + meanOf(table).toFixed(2) + '×)  —  ' +
              rounds.toLocaleString('es-ES') + ' rondas en ' + ms + 'ms (' +
              Math.round(rounds / (ms / 1000)).toLocaleString('es-ES') + '/s)');
  console.log('  cuadre tras cada ronda : ' + (desync === 0 ? '\x1b[32m✓ siempre\x1b[0m' : '\x1b[31m✗ ' + desync + ' fallos\x1b[0m'));
  console.log('  saldo negativo         : ' + (negative === 0 ? '\x1b[32m✓ nunca\x1b[0m' : '\x1b[31m✗ ' + negative + '\x1b[0m'));
  console.log('  enteros exactos        : ' + (unsafe === 0 ? '\x1b[32m✓ siempre\x1b[0m' : '\x1b[31m✗ ' + unsafe + ' veces fuera de rango\x1b[0m'));
  console.log('  errores inesperados    : ' + (errs.size === 0 ? '\x1b[32m✓ ninguno\x1b[0m' : '\x1b[31m✗ ' + [...errs].join(', ') + '\x1b[0m'));
  console.log('  cuadre final           : ' + (audit.ok ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m') +
              '  (' + audit.expectedCents + ' / ' + audit.actualCents + ')');
  console.log('  stats por juego = total: ' + (statsOk ? '\x1b[32m✓\x1b[0m' : '\x1b[31m✗\x1b[0m'));
  console.log('  saldo mín / máx / final: ' + U.money(minB) + ' / ' + U.money(maxB, { compact: true }) +
              ' / ' + U.money(C.bank.balance, { compact: true }));
  console.log('  rescates por ruina     : ' + rescues.toLocaleString('es-ES'));
  console.log('  RTP de la sesión       : ' + (ret / w * 100).toFixed(2) + '%');
}

console.log('\n' + '─'.repeat(64));
console.log(allOk ? '\x1b[32m\x1b[1m✓ el dinero cuadra en todas las condiciones\x1b[0m'
                  : '\x1b[31m\x1b[1m✗ hay descuadres\x1b[0m');
process.exit(allOk ? 0 : 1);
