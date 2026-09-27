#!/usr/bin/env node
/* =========================================================================
   test.js — batería de comprobaciones sin navegador.

   Lo importante que se verifica aquí:
     · El banco nunca descuadra: saldo == inicial − débitos + créditos.
     · La apuesta se cobra una vez y sólo una; liquidar dos veces falla.
     · El saldo nunca queda negativo, ni apostando al límite.
     · Las matemáticas de cada máquina dan el RTP que anuncia su ficha.
   Uso: node tools/test.js
   ========================================================================= */
'use strict';

/* ---------------------------- entorno simulado ----------------------------
   Se usa un DOM mínimo pero real (tools/lib/fake-dom.js) en lugar de nodos
   de mentira: así las pruebas pueden montar los juegos de verdad y detectar
   errores dentro de create(), que es donde se escondía un fallo de Plinko.
   -------------------------------------------------------------------------- */
const { createDocument } = require('./lib/fake-dom.js');

globalThis.window = undefined;
let storage = {};
globalThis.localStorage = {
  getItem: k => (k in storage ? storage[k] : null),
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: k => { delete storage[k]; }
};
globalThis.document = createDocument();
globalThis.requestAnimationFrame = cb => setTimeout(() => cb(Date.now()), 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.innerWidth = 1280;
globalThis.innerHeight = 900;
globalThis.devicePixelRatio = 1;
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.location = { hash: '#/lobby', replace() {} };
const fakeNode = () => globalThis.document.createElement('div');

const path = require('path');
const base = path.join(__dirname, '..');
const load = p => require(path.join(base, p));

load('js/core/util.js');
load('js/core/store.js');
load('js/core/bank.js');

const C = globalThis.Casino;
const U = C.util;

/* Con un DOM real podemos cargar la interfaz AUTÉNTICA (ui.js): así las
   pruebas ejercitan los botones, el control de apuesta y los paneles tal
   cual son, no unos dobles que nunca fallan. Sólo se simula el audio (no
   hay WebAudio en Node) y los efectos visuales. */
C.audio = { play() {}, unlock() {}, toggle() {}, setVolume() {}, get enabled() { return false; }, get volume() { return 0; }, names: [] };
C.fx = {
  reduced: true, celebrate() {}, floatText() {}, clearAll() {}, coinRain() {}, confetti() {},
  coinBurst() {}, sparks() {}, shake() {}, flash() {}, ripple() {}, pulse() {}, mount() {},
  countUp(node, from, to, opts) {
    if (node) node.textContent = (opts && opts.format ? opts.format(to) : String(to));
    const p = Promise.resolve(true); p.cancel = () => {}; return p;
  },
  PALETTE: { GOLD: [], FESTIVE: [] }
};
load('js/core/ui.js');

load('js/core/progress.js');
load('js/core/engine.js');
load('js/games/deck.js');
load('js/games/slot-symbols.js');
[
  'slots', 'roulette', 'blackjack', 'videopoker', 'baccarat',
  'dice', 'mines', 'crash', 'plinko', 'hilo', 'keno', 'scratch'
].forEach(g => load('js/games/' + g + '.js'));

/* ------------------------------ mini framework ------------------------------ */
let passed = 0, failed = 0;
const failures = [];

function group(name) { console.log('\n\x1b[1m' + name + '\x1b[0m'); }
function ok(cond, label, detail) {
  if (cond) { passed++; console.log('  \x1b[32m✓\x1b[0m ' + label); }
  else {
    failed++; failures.push(label);
    console.log('  \x1b[31m✗ ' + label + '\x1b[0m' + (detail !== undefined ? '  → ' + detail : ''));
  }
}
function near(a, b, tol, label) {
  const d = Math.abs(a - b);
  ok(d <= tol, label, 'obtenido ' + a + ', esperado ' + b + ' (±' + tol + ')');
}

function freshBank(cents) {
  storage = {};
  C.bank._clearRounds();
  C.bank._resetLedger();
  C.store._replace(Object.assign(C.store.defaultState(), { balanceCents: cents === undefined ? 100000 : cents }));
}

/* ============================ 1. EL BANCO ============================ */
group('1. Banco — invariantes del dinero');

freshBank(100000);
ok(C.bank.balance === 1000, 'saldo inicial de 1.000 €');

let r = C.bank.openRound('t', 10);
ok(C.bank.balance === 990, 'abrir ronda cobra la apuesta al instante');
ok(r.stake === 10, 'la ronda conoce su apuesta');
r.settle(25);
ok(C.bank.balance === 1015, 'liquidar acredita el retorno');

let threw = false;
try { r.settle(5); } catch (e) { threw = e.code === 'DOUBLE_SETTLE'; }
ok(threw, 'liquidar dos veces lanza DOUBLE_SETTLE');

let r2 = C.bank.openRound('t', 5);
threw = false;
try { C.bank.openRound('t', 5); } catch (e) { threw = e.code === 'ROUND_IN_PROGRESS'; }
ok(threw, 'dos rondas del mismo juego a la vez lanzan ROUND_IN_PROGRESS');
r2.settle(0);

threw = false;
try { C.bank.openRound('t', 999999); } catch (e) { threw = e.code === 'INSUFFICIENT_FUNDS'; }
ok(threw, 'apostar más que el saldo lanza INSUFFICIENT_FUNDS');

/* apuestas inválidas */
[0, -5, NaN, Infinity, null, undefined, 'abc'].forEach(v => {
  let caught = false;
  try { C.bank.openRound('t', v); } catch (e) { caught = e.name === 'BankError'; }
  ok(caught, 'apuesta inválida rechazada: ' + String(v));
});

/* cancelar devuelve exactamente lo puesto */
freshBank(10000);
let r3 = C.bank.openRound('t', 30);
r3.raise(20);
ok(C.bank.balance === 50, 'raise() cobra la subida (100 − 30 − 20)');
ok(r3.stake === 50, 'la apuesta acumulada es 50');
r3.cancel();
ok(C.bank.balance === 100, 'cancel() devuelve la apuesta íntegra');

/* céntimos: nada de errores de coma flotante */
freshBank(100000);
let acc = C.bank.balance;
for (let i = 0; i < 1000; i++) {
  const rr = C.bank.openRound('t', 0.1);
  rr.settle(0.1);
}
ok(C.bank.balance === acc, '1.000 rondas de 0,10 € devueltas dejan el saldo idéntico (sin deriva de coma flotante)');
ok(C.bank.audit(100000).ok, 'la auditoría del libro mayor cuadra');

/* el saldo nunca baja de cero apostando el máximo repetidamente */
freshBank(5000);
let guard = 0;
while (C.bank.balance > 0 && guard++ < 5000) {
  const stake = C.bank.balance;
  const rr = C.bank.openRound('t', stake);
  rr.settle(0);
}
ok(C.bank.balance === 0, 'apostar todo hasta arruinarse deja exactamente 0');
ok(C.bank.balanceCents === 0, 'y 0 céntimos, no un negativo diminuto');
threw = false;
try { C.bank.openRound('t', 0.5); } catch (e) { threw = e.code === 'INSUFFICIENT_FUNDS'; }
ok(threw, 'con saldo 0 no se puede abrir otra ronda');

/* tope de saldo: la aritmética entera debe seguir siendo exacta */
freshBank(C.bank.MAX_BALANCE_CENTS - 1000);
const capOpening = C.bank.balanceCents;
const capRound = C.bank.openRound('t', 10);
capRound.settle(1e12);      // intenta acreditar un billón de euros
ok(C.bank.balanceCents === C.bank.MAX_BALANCE_CENTS, 'el saldo se topa en el máximo seguro');
ok(Number.isSafeInteger(C.bank.balanceCents), 'el saldo sigue siendo un entero exacto tras el tope');
ok(C.bank.audit(capOpening).ok, 'el cuadre sigue siendo correcto con el tope aplicado');
ok(C.bank.MAX_BALANCE_CENTS < Number.MAX_SAFE_INTEGER,
   'el tope está holgadamente por debajo del límite de enteros de JavaScript');

/* estadísticas coherentes */
freshBank(100000);
const before = C.store.state.totals.rounds;
const rw = C.bank.openRound('slots', 10); rw.settle(30);
const rl = C.bank.openRound('slots', 10); rl.settle(0);
const rp = C.bank.openRound('slots', 10); rp.settle(10);
const T = C.store.state.totals;
ok(T.rounds === before + 3, 'se cuentan 3 rondas');
ok(T.wins === 1 && T.losses === 1 && T.pushes === 1, 'ganada/perdida/empate contadas por separado');
ok(T.wageredCents === 3000, 'apostado acumulado = 30,00 €');
ok(T.returnedCents === 4000, 'devuelto acumulado = 40,00 €');

/* ====================== 2. MATEMÁTICAS DE CADA MÁQUINA ====================== */

group('2. Tragaperras');
{
  const L = C.slotsLogic;
  const rng = U.createRng(4242);
  const strips = [];
  for (let i = 0; i < L.REELS; i++) strips.push(L.buildStrip(rng));

  /* recuentos exactos y separación de especiales */
  let countsOk = true, gapOk = true;
  for (let t = 0; t < 400; t++) {
    const s = L.buildStrip(U.createRng(t));
    const c = {};
    s.forEach(id => { c[id] = (c[id] || 0) + 1; });
    L.SYMBOLS.forEach(sym => { if (c[sym.id] !== sym.n) countsOk = false; });
    for (let i = 0; i < L.STRIP_LEN; i++) {
      const w = [s[i], s[(i + 1) % L.STRIP_LEN], s[(i + 2) % L.STRIP_LEN]];
      if (w.filter(x => x === 'scatter').length > 1) gapOk = false;
      if (w.filter(x => x === 'wild').length > 1) gapOk = false;
    }
  }
  ok(countsOk, 'cada tira lleva el recuento exacto de cada símbolo');
  ok(gapOk, 'ninguna ventana de 3 celdas muestra dos dispersos ni dos comodines');

  /* línea concreta: 5 BAR paga 2000 por línea */
  const g = [];
  for (let i = 0; i < 5; i++) g.push(['bar', 'bar', 'bar']);
  const ev = L.evaluate(g);
  ok(ev.lineMult >= 2000, 'pantalla llena de BAR paga al menos 2.000 por línea', ev.lineMult);
  near(L.payoutFor({ lineMult: 2000, scatterMult: 0 }, 10, 1), 2000, 0.01,
       'payoutFor: 2.000 por línea con 10 € de apuesta total = 2.000 €');

  /* el comodín sustituye */
  const g2 = [['comodin', 'x', 'x'], ['siete', 'x', 'x'], ['siete', 'x', 'x'],
              ['limon', 'x', 'x'], ['limon', 'x', 'x']];
  const ev2 = L.evaluate(g2.map(c => c.map(v => v === 'x' ? 'cereza' : v)));
  const sevenWin = ev2.lines.filter(w => w.symbol === 'siete' && w.count === 3)[0];
  ok(!!sevenWin, 'el comodín completa un trío de sietes');

  /* ningún símbolo puede ser una carta de la baraja ni un emoji */
  const idsOk = L.SYMBOLS.every(sym => /^[a-z]+$/.test(sym.id) && !!sym.name);
  ok(idsOk, 'todos los símbolos tienen id e identificador de dibujo propios');
  ok(L.SYMBOLS.length === 10, 'hay 10 símbolos en la tira', L.SYMBOLS.length);
  ok(L.SYMBOLS.reduce((a, sym) => a + sym.n, 0) === L.STRIP_LEN,
     'los recuentos suman la longitud de la tira (' + L.STRIP_LEN + ')');
  ok(!L.SYMBOLS.some(sym => sym.glyph !== undefined),
     'ya no quedan emoji en la definición de los símbolos');

  /* un id desconocido no debe reventar la evaluación */
  let crashed = false;
  try { L.evaluate([['zzz','zzz','zzz'],['zzz','zzz','zzz'],['zzz','zzz','zzz'],
                    ['zzz','zzz','zzz'],['zzz','zzz','zzz']]); }
  catch (e) { crashed = true; }
  ok(!crashed, 'un símbolo desconocido no rompe la evaluación');

  /* RTP medido */
  let wag = 0, ret = 0, owed = 0;
  const N = 400000;
  for (let i = 0; i < N; i++) {
    const free = owed > 0;
    if (free) owed--; else wag += 10;
    const grid = [];
    for (let rr2 = 0; rr2 < L.REELS; rr2++) {
      const p = rng.int(0, L.STRIP_LEN - 1);
      const col = [];
      for (let f = 0; f < L.ROWS; f++) col.push(strips[rr2][(p + f) % L.STRIP_LEN]);
      grid.push(col);
    }
    const e = L.evaluate(grid);
    ret += L.payoutFor(e, 10, free ? L.FREE_MULTIPLIER : 1);
    if (e.scatter && e.scatter.spins) owed += e.scatter.spins;
  }
  const rtpSlots = ret / wag * 100;
  near(rtpSlots, C.engine.get('slots').rtp, 2.5, 'RTP medido ≈ el declarado (' + C.engine.get('slots').rtp + '%)');
}

group('3. Ruleta');
{
  const R = C.rouletteLogic;
  ok(R.WHEEL.length === 37, 'la rueda tiene 37 casillas (un solo cero)');
  ok(R.REDS.length === 18, '18 números rojos');
  ok(R.WHEEL.filter(n => n !== 0 && !R.isRed(n)).length === 18, '18 números negros');
  ok(new Set(R.WHEEL).size === 37, 'no hay números repetidos en la rueda');

  near(R.payout([{ type: 'straight', key: 17, amount: 10 }], 17), 360, 0.01, 'pleno acertado paga 35:1 (360 € con 10 €)');
  ok(R.payout([{ type: 'straight', key: 17, amount: 10 }], 18) === 0, 'pleno fallado no paga');
  ok(R.payout([{ type: 'red', key: null, amount: 10 }], 0) === 0, 'el cero hace perder las apuestas sencillas');
  ok(R.payout([{ type: 'even', key: null, amount: 10 }], 0) === 0, 'el cero no cuenta como par');
  near(R.payout([{ type: 'dozen', key: 0, amount: 10 }], 5), 30, 0.01, 'docena acertada paga 2:1');
  near(R.payout([{ type: 'red', key: null, amount: 10 }, { type: 'straight', key: 3, amount: 5 }], 3),
       200, 0.01, 'varias apuestas acertadas se suman');

  /* docenas y columnas parten 1–36 sin solapes ni huecos */
  const doz = [0, 1, 2].flatMap(k => R.BETS.dozen.covers(k));
  const col = [0, 1, 2].flatMap(k => R.BETS.column.covers(k));
  ok(doz.length === 36 && new Set(doz).size === 36, 'las 3 docenas cubren 1–36 exactamente una vez');
  ok(col.length === 36 && new Set(col).size === 36, 'las 3 columnas cubren 1–36 exactamente una vez');

  /* RTP de cada tipo, ENUMERANDO las 37 casillas.
     Con sólo 37 resultados posibles el RTP se calcula exacto; simularlo
     sería peor prueba, porque un pleno (1/37 a 36×) tiene más de un punto
     de error estándar incluso con cientos de miles de tiradas. */
  const betTypes = [
    ['straight', 17], ['straight', 0], ['red', null], ['black', null],
    ['even', null], ['odd', null], ['low', null], ['high', null],
    ['dozen', 0], ['dozen', 1], ['dozen', 2],
    ['column', 0], ['column', 1], ['column', 2]
  ];
  let allExact = true;
  const results = [];
  betTypes.forEach(([type, key]) => {
    let ret = 0;
    for (const n of R.WHEEL) ret += R.payout([{ type, key, amount: 10 }], n);
    const rtp = ret / (10 * R.WHEEL.length) * 100;
    results.push(type + (key === null ? '' : ':' + key) + ' ' + rtp.toFixed(3) + '%');
    /* 36/37 = 97,297…% exacto para toda apuesta bien pagada */
    if (Math.abs(rtp - (36 / 37) * 100) > 1e-9) allExact = false;
  });
  ok(allExact, 'las 14 apuestas dan EXACTAMENTE 36/37 = 97,297% de RTP (enumeración completa)',
     results.join(', '));
}

group('4. Blackjack');
{
  const B = C.blackjackLogic, D = C.deck;
  const c = (r2, s) => D.card(r2, s);
  ok(B.compare([c(1, 's'), c(13, 'h')], [c(10, 's'), c(10, 'h')], false) === 2.5, 'blackjack natural paga 3:2 (mult 2,5)');
  ok(B.compare([c(1, 's'), c(13, 'h')], [c(1, 'd'), c(12, 'c')], false) === 1, 'blackjack contra blackjack es empate');
  ok(B.compare([c(1, 's'), c(13, 'h')], [c(10, 's'), c(9, 'h')], true) === 2, '21 tras separar paga 1:1, no 3:2');
  ok(B.compare([c(10, 's'), c(9, 'h'), c(5, 'd')], [c(6, 's'), c(10, 'h')], false) === 0, 'pasarse pierde');
  ok(B.compare([c(10, 's'), c(9, 'h'), c(8, 'd')], [c(10, 'c'), c(9, 'd'), c(7, 's')], false) === 0,
     'si los dos se pasan, gana la casa');
  ok(B.compare([c(10, 's'), c(8, 'h')], [c(6, 's'), c(10, 'h'), c(9, 'd')], false) === 2, 'si la casa se pasa, gana el jugador');
  ok(B.compare([c(8, 's'), c(10, 'h')], [c(8, 'd'), c(10, 'c')], false) === 1, 'mismo total es empate');

  ok(B.dealerShouldHit([c(10, 's'), c(6, 'h')]) === true, 'el crupier pide con 16');
  ok(B.dealerShouldHit([c(10, 's'), c(7, 'h')]) === false, 'el crupier se planta con 17');
  ok(B.dealerShouldHit([c(1, 's'), c(6, 'h')]) === false, 'el crupier se planta con 17 blando');
  ok(B.dealerShouldHit([c(1, 's'), c(1, 'h')]) === true, 'el crupier pide con A+A (12 blando)');

  ok(D.bjScore([c(1, 's'), c(1, 'h'), c(9, 'd')]).total === 21, 'A+A+9 = 21 (un as baja a 1)');
  ok(D.bjScore([c(1, 's'), c(1, 'h'), c(1, 'd'), c(1, 'c')]).total === 14, 'cuatro ases = 14');

  /* el zapato nunca devuelve una carta vacía */
  const shoe = D.shoe(6, U.createRng(9), 0.72);
  let nulls = 0;
  for (let i = 0; i < 2000; i++) if (!shoe.draw()) nulls++;
  ok(nulls === 0, '2.000 extracciones del zapato sin una sola carta vacía');
}

group('5. Video póker');
{
  const V = C.videopokerLogic, D = C.deck;
  const c = (r2, s) => D.card(r2, s);
  const evalKey = h => D.evaluatePoker(h).key;
  ok(evalKey([c(1, 's'), c(13, 's'), c(12, 's'), c(11, 's'), c(10, 's')]) === 'ROYAL_FLUSH', 'detecta escalera de color real');
  ok(evalKey([c(1, 's'), c(2, 'h'), c(3, 'd'), c(4, 'c'), c(5, 's')]) === 'STRAIGHT', 'A-2-3-4-5 es escalera');
  ok(evalKey([c(10, 's'), c(11, 'h'), c(12, 'd'), c(13, 'c'), c(1, 's')]) === 'STRAIGHT', '10-J-Q-K-A es escalera');
  ok(evalKey([c(12, 's'), c(12, 'h'), c(3, 'd'), c(7, 'c'), c(9, 's')]) === 'JACKS_BETTER', 'pareja de damas paga');
  ok(evalKey([c(5, 's'), c(5, 'h'), c(3, 'd'), c(7, 'c'), c(9, 's')]) === 'LOW_PAIR', 'pareja de cincos no paga');
  ok(evalKey([c(1, 's'), c(1, 'h'), c(3, 'd'), c(7, 'c'), c(9, 's')]) === 'JACKS_BETTER', 'pareja de ases paga');

  near(V.payout('ROYAL_FLUSH', 5, 1), 4000, 0.01, 'escalera real con 5 créditos paga 4.000');
  near(V.payout('ROYAL_FLUSH', 1, 1), 250, 0.01, 'escalera real con 1 crédito paga 250');
  near(V.payout('FULL_HOUSE', 5, 1), 45, 0.01, 'full con 5 créditos paga 45 (tabla 9/6)');
  near(V.payout('FLUSH', 5, 1), 30, 0.01, 'color con 5 créditos paga 30 (tabla 9/6)');
  ok(V.payout('LOW_PAIR', 5, 1) === 0, 'pareja baja no paga nada');
  ok(V.payout('NOTHING', 5, 1) === 0, 'sin combinación no paga nada');
  near(V.payout('FULL_HOUSE', 5, 0.25), 11.25, 0.001, 'el valor del crédito escala el premio');
}

group('6. Baccarat');
{
  const Bc = C.baccaratLogic, D = C.deck;
  near(Bc.payout('player', 10, 'player'), 20, 0.01, 'jugador acertado paga 1:1');
  near(Bc.payout('banker', 10, 'banker'), 19.5, 0.01, 'banca acertada paga 1:1 menos 5% de comisión');
  near(Bc.payout('tie', 10, 'tie'), 90, 0.01, 'empate acertado paga 8:1');
  ok(Bc.payout('player', 10, 'tie') === 10, 'con empate se devuelve la apuesta al jugador');
  ok(Bc.payout('banker', 10, 'tie') === 10, 'con empate se devuelve la apuesta a la banca');
  ok(Bc.payout('tie', 10, 'player') === 0, 'apuesta al empate fallada no paga');

  /* frecuencias reales del juego */
  const shoe = D.shoe(8, U.createRng(2024), 0.8);
  let p = 0, b = 0, t = 0, n = 0, retP = 0, retB = 0, wag = 0;
  const N = 200000;
  for (let i = 0; i < N; i++) {
    if (shoe.exhausted) shoe.reshuffle();
    const h = Bc.playHand(shoe);
    n++;
    if (h.winner === 'player') p++; else if (h.winner === 'banker') b++; else t++;
    wag += 10;
    retP += Bc.payout('player', 10, h.winner);
    retB += Bc.payout('banker', 10, h.winner);
  }
  near(p / n * 100, 44.62, 1.2, 'gana el jugador ≈ 44,62% de las manos');
  near(b / n * 100, 45.86, 1.2, 'gana la banca ≈ 45,86% de las manos');
  near(t / n * 100, 9.52, 1.0, 'empate ≈ 9,52% de las manos');
  near(retP / wag * 100, 98.76, 1.0, 'RTP apostando a jugador ≈ 98,76%');
  near(retB / wag * 100, 98.94, 1.0, 'RTP apostando a banca ≈ 98,94%');
}

group('7. Dados');
{
  const Dc = C.diceLogic;
  /* la probabilidad anunciada debe ser la real, contada sobre los 10.000 valores */
  let exact = true;
  [[50, true], [50, false], [75, true], [90, true], [98, true], [2, false], [25, false]].forEach(([t, o]) => {
    let hit = 0;
    for (let i = 0; i < 10000; i++) if (Dc.wins(i / 100, t, o)) hit++;
    if (Dc.winChance(t, o) !== hit / 10000) exact = false;
  });
  ok(exact, 'la probabilidad mostrada coincide EXACTAMENTE con la frecuencia real');

  ok(Dc.wins(50.01, 50, true) && !Dc.wins(50, 50, true), 'clavar el objetivo no gana apostando a "más que"');
  ok(Dc.wins(49.99, 50, false) && !Dc.wins(50, 50, false), 'clavar el objetivo no gana apostando a "menos que"');

  let edgeOk = true;
  for (let t = 2; t <= 98; t++) {
    for (const o of [true, false]) {
      const rtp = Dc.winChance(t, o) * Dc.multiplier(t, o) * 100;
      if (rtp > 99.001 || rtp < 98.5) edgeOk = false;
    }
  }
  ok(edgeOk, 'el RTP se mantiene en 99% (sin pasarse) con los 194 objetivos posibles');
}

group('8. Minas');
{
  const M = C.minesLogic;
  let allOk = true;
  [1, 2, 3, 5, 10, 24].forEach(mines => {
    const safe = M.TILES - mines;
    for (let picks = 1; picks <= Math.min(safe, 20); picks++) {
      let prob = 1;
      for (let i = 0; i < picks; i++) prob *= (safe - i) / (M.TILES - i);
      const rtp = prob * M.multiplier(mines, picks) * 100;
      if (rtp > 98.001 || rtp < 97.2) allOk = false;
    }
  });
  ok(allOk, 'retirarse en cualquier punto da ~98% de RTP, con cualquier número de minas');
  ok(M.multiplier(3, 0) === 1, 'sin gemas el multiplicador es 1');
  ok(M.multiplier(3, 23) === 0, 'pedir más gemas que casillas seguras da 0');
  near(M.multiplier(24, 1), 24.5, 0.01, 'con 24 minas la única gema paga 24,50×');
}

group('9. Crash');
{
  const K = C.crashLogic;
  const rng = U.createRng(8888);
  const N = 400000;
  const crashes = [];
  for (let i = 0; i < N; i++) crashes.push(K.rollCrash(rng));
  ok(crashes.every(c => c >= 1), 'el estallido nunca es menor que 1,00×');

  [1.5, 2, 5, 10].forEach(t => {
    let w = 0, ret = 0;
    for (const c of crashes) { w += 10; if (c >= t) ret += 10 * t; }
    near(ret / w * 100, 99, 1.6, 'RTP cobrando en ' + t + '× ≈ 99%');
  });
  const sorted = crashes.slice().sort((a, b) => a - b);
  near(sorted[Math.floor(N / 2)], 2, 0.15, 'la mediana del estallido está en ~2,00×');
  near(K.chanceOfReaching(2) * 100, 49.5, 0.01, 'la probabilidad de llegar a 2× es 49,5%');
}

group('10. Plinko');
{
  const P = C.plinkoLogic;
  let sum = 0;
  for (let i = 0; i < P.BUCKETS; i++) sum += P.bucketProbability(i);
  near(sum, 1, 1e-9, 'las probabilidades de las cubetas suman 1');
  const declared = C.engine.get('plinko').rtp;
  Object.keys(P.RISK).forEach(k => {
    const pays = P.RISK[k].pays;
    near(P.rtpOf(pays) * 100, declared, 0.5, 'riesgo "' + k + '" da el RTP declarado (' + declared + '%)');
    ok(pays.every((v, i) => v === pays[P.BUCKETS - 1 - i]), 'riesgo "' + k + '": la tabla es simétrica');
    let mono = true;
    for (let i = 1; i <= P.ROWS / 2; i++) if (pays[i] > pays[i - 1]) mono = false;
    ok(mono, 'riesgo "' + k + '": los pagos no suben hacia el centro');
  });

  /* la simulación debe reproducir la binomial */
  const rng = U.createRng(55);
  const counts = new Array(P.BUCKETS).fill(0);
  const N = 300000;
  for (let i = 0; i < N; i++) {
    let pos = 0;
    for (let r2 = 0; r2 < P.ROWS; r2++) if (rng() < 0.5) pos++;
    counts[pos]++;
  }
  near(counts[8] / N, P.bucketProbability(8), 0.004, 'la cubeta central sale con la frecuencia binomial esperada');
}

group('11. Hi-Lo');
{
  const H = C.hiloLogic, D = C.deck;
  const c = (r2, s) => D.card(r2, s);
  const deck = D.build(1, U.createRng(3));
  /* con un mazo completo menos la carta actual */
  const cur = c(7, 's');
  const rest = deck.filter(x => x.id !== cur.id);
  const pH = H.chance(cur, rest, true), pL = H.chance(cur, rest, false);
  ok(pH > 0 && pH < 1 && pL > 0 && pL < 1, 'las probabilidades están entre 0 y 1');
  /* los iguales cuentan en ambos lados, así que la suma pasa de 1 */
  ok(pH + pL > 1, 'los empates cuentan como acierto en ambas direcciones');
  let edgeOk = true;
  [c(1, 's'), c(7, 'h'), c(13, 'd')].forEach(card => {
    const r2 = deck.filter(x => x.id !== card.id);
    [true, false].forEach(hi => {
      const rtp = H.chance(card, r2, hi) * H.stepMultiplier(card, r2, hi) * 100;
      if (rtp > 98.001 || rtp < 97.4) edgeOk = false;
    });
  });
  ok(edgeOk, 'cada paso mantiene ~98% de RTP');
  ok(H.stepMultiplier(c(7, 's'), [], true) === 0, 'sin cartas restantes el multiplicador es 0');
}

group('12. Keno');
{
  const K = C.kenoLogic;
  const declared = C.engine.get('keno').rtp;
  for (let k = 1; k <= K.MAX_PICKS; k++) {
    let ps = 0;
    for (let h = 0; h <= k; h++) ps += K.probability(k, h);
    near(ps, 1, 1e-9, 'con ' + k + ' números, las probabilidades suman 1');
    near(K.rtpFor(k) * 100, declared, 1.0, 'con ' + k + ' números el RTP ≈ ' + declared + '%');
  }
  near(1 / K.probability(10, 10), 847660528, 1, 'acertar 10 de 10 es 1 entre 847.660.528');
}

group('13. Rasca y gana');
{
  const S = C.scratchLogic;
  near(S.rtp() * 100, C.engine.get('scratch').rtp, 0.5, 'el RTP de la tabla ≈ el declarado');
  const rng = U.createRng(1234);
  let mismatch = 0, bad = 0;
  const N = 120000;
  for (let i = 0; i < N; i++) {
    const o = S.rollOutcome(rng);
    const cells = S.buildTicket(o, rng);
    if (cells.length !== S.CELLS || cells.some(x => !x)) { bad++; continue; }
    const ev = S.evaluateTicket(cells);
    if ((ev ? ev.mult : 0) !== o.mult) mismatch++;
  }
  ok(bad === 0, N.toLocaleString('es-ES') + ' boletos generados sin casillas vacías');
  ok(mismatch === 0, 'el premio del boleto coincide SIEMPRE con el sorteado');
}

/* ================= 14. FLUJO DE DINERO EN TODAS LAS MÁQUINAS ================= */
group('14. Flujo de dinero — simulación cruzada');
{
  /* Simulamos muchas rondas en todos los juegos a la vez y comprobamos
     que el saldo final coincide exactamente con el libro mayor. */
  freshBank(1000000);
  const opening = C.bank.balanceCents;
  const ids = C.engine.list().map(g => g.id);
  const rng = U.createRng(777);
  let rounds = 0, negative = false;

  for (let i = 0; i < 40000; i++) {
    const id = rng.pick(ids);
    const stake = rng.pick([0.5, 1, 5, 25]);
    if (!C.bank.canAfford(stake)) break;
    const round = C.bank.openRound(id, stake);
    /* un retorno cualquiera, incluidos empates y premios grandes */
    const ret = rng.pick([0, 0, 0, stake, stake * 2, stake * 2.5, stake * 10, stake * 100]);
    round.settle(ret);
    rounds++;
    if (C.bank.balanceCents < 0) negative = true;
  }
  ok(rounds > 1000, 'se han jugado ' + rounds.toLocaleString('es-ES') + ' rondas repartidas entre las 12 máquinas');
  ok(!negative, 'el saldo nunca pasó a negativo');
  const audit = C.bank.audit(opening);
  ok(audit.ok, 'el saldo final cuadra con el libro mayor',
     'esperado ' + audit.expectedCents + ', real ' + audit.actualCents);

  /* la contabilidad por juego debe sumar el total */
  let wag = 0, ret2 = 0;
  Object.keys(C.store.state.games).forEach(g => {
    wag += C.store.state.games[g].wageredCents;
    ret2 += C.store.state.games[g].returnedCents;
  });
  ok(wag === C.store.state.totals.wageredCents, 'lo apostado por máquina suma el total apostado');
  ok(ret2 === C.store.state.totals.returnedCents, 'lo devuelto por máquina suma el total devuelto');
}

/* ==================== 15. REGISTRO Y FICHAS DE LAS MÁQUINAS ==================== */
group('15. Registro de máquinas');
{
  const games = C.engine.list();
  ok(games.length === 12, 'están registradas las 12 máquinas', games.length);
  const ids = new Set();
  let allOk = true;
  games.forEach(g => {
    if (ids.has(g.id)) allOk = false;
    ids.add(g.id);
    if (!g.name || !g.icon || !g.tagline || !g.desc) allOk = false;
    if (!(g.minBet > 0) || !(g.maxBet > g.minBet)) allOk = false;
    if (typeof g.create !== 'function') allOk = false;
    if (!(g.rtp > 80 && g.rtp <= 100)) allOk = false;
  });
  ok(allOk, 'todas tienen id único, nombre, icono, descripción, límites y RTP coherentes');
  console.log('\n  ' + games.map(g => g.icon + ' ' + g.name + ' (' + g.rtp + '%)').join('\n  '));
}

/* ===================== 16. CONTROL DE APUESTA ===================== */
group('16. Control de apuesta');
{
  freshBank(100000);          // 1.000 €
  const bet = C.ui.betControl({ min: 0.5, max: 500, value: 1 });

  /* acepta los dos formatos decimales que puede escribir la gente */
  ok(bet.set('12,50') === 12.5, 'acepta la coma decimal española ("12,50")', bet.get());
  ok(bet.set('12.50') === 12.5, 'acepta también el punto ("12.50")', bet.get());
  ok(bet.set('1.234,50') === 500, 'recorta al máximo de la mesa ("1.234,50" → 500)', bet.get());
  ok(bet.set('abc') === 0.5, 'un texto sin números cae al mínimo', bet.get());
  ok(bet.set('') === 0.5, 'vacío cae al mínimo', bet.get());
  ok(bet.set(-5) === 0.5, 'un negativo cae al mínimo', bet.get());
  ok(bet.set(3.333333) === 3.33, 'redondea a céntimos (3,333333 → 3,33)', bet.get());
  ok(bet.set(99999) === 500, 'no supera el máximo de la mesa', bet.get());

  /* nunca se puede seleccionar más de lo que hay en la cuenta */
  freshBank(1000);            // 10 €
  const bet2 = C.ui.betControl({ min: 0.5, max: 500, value: 1 });
  ok(bet2.set(500) === 10, 'no deja apostar más que el saldo (10 € disponibles)', bet2.get());
  ok(bet2.max() === 10, 'el máximo efectivo es el saldo');

  /* y si el saldo baja, la apuesta se ajusta sola */
  const rr = C.bank.openRound('t', 8);
  rr.settle(0);               // quedan 2 €
  ok(bet2.get() <= 2.001, 'al bajar el saldo, la apuesta seleccionada se reduce sola', bet2.get());
  bet2.destroy(); bet.destroy();
}

/* ============ 17. MONTAJE REAL DE CADA MÁQUINA (create + destroy) ============ */
group('17. Montaje de cada máquina');
{
  /*
    Cargar el módulo no basta: el fallo que se colaba en Plinko estaba
    dentro de create(), así que aquí se monta CADA juego de verdad contra
    un DOM simulado y se comprueba que no lanza. También se destruye, para
    detectar fugas al salir.
  */
  freshBank(100000);
  const host = globalThis.document.createElement('div');
  globalThis.document.body.appendChild(host);
  let allMounted = true;
  C.engine.list().forEach(g => {
    let handle = null, err = null;
    try {
      handle = C.engine.mount(g.id, host);
    } catch (e) {
      err = e;
    }
    /* engine.mount() atrapa los errores de create() y pinta un aviso de
       mantenimiento, así que además miramos si el juego quedó activo. */
    const mounted = !err && C.engine.activeId === g.id;
    if (!mounted) allMounted = false;
    ok(mounted, 'monta ' + g.icon + ' ' + g.name, err ? err.message : 'create() falló');
    try { C.engine.unmount(); } catch (e) {
      ok(false, 'desmonta ' + g.name, e.message);
      allMounted = false;
    }
    while (host.firstChild) host.removeChild(host.firstChild);
  });
  ok(allMounted, 'las 12 máquinas se montan y desmontan sin lanzar');
  ok(!C.engine.activeId, 'tras desmontar no queda ninguna máquina activa');
  /* ninguna ronda debe quedarse abierta al salir de un juego */
  const leaked = C.engine.list().filter(g => C.bank.getOpenRound(g.id));
  ok(leaked.length === 0, 'ningún juego deja una ronda abierta al salir',
     leaked.map(g => g.id).join(', '));
}

/* ------------------------------- resultado ------------------------------- */
console.log('\n' + '─'.repeat(64));
if (failed === 0) {
  console.log('\x1b[32m\x1b[1m✓ ' + passed + ' comprobaciones superadas\x1b[0m');
} else {
  console.log('\x1b[31m\x1b[1m✗ ' + failed + ' fallo(s) de ' + (passed + failed) + '\x1b[0m');
  failures.forEach(f => console.log('  · ' + f));
}
process.exit(failed === 0 ? 0 : 1);
