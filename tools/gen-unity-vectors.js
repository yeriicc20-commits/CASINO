#!/usr/bin/env node
/* =========================================================================
   gen-unity-vectors.js — genera vectores de prueba para el port a C#.

   No se puede compilar C# en este entorno, así que la forma de demostrar que
   el port de Unity calcula EXACTAMENTE lo mismo que la versión web (que sí
   está verificada a base de millones de simulaciones) es ésta: ejecutar el
   JavaScript de verdad con semillas fijas, volcar los resultados, y meterlos
   en un test de Unity que compare número por número.

   Si el port tuviera cualquier desviación —en el generador aleatorio, en el
   reparto de las tiras o en la evaluación de líneas— el test falla al abrir
   el proyecto en Unity.

   Uso: node tools/gen-unity-vectors.js > unity/Assets/Casino/Tests/GoldenVectors.cs
   ========================================================================= */
'use strict';
globalThis.window = undefined;
globalThis.localStorage = { getItem: () => null, setItem: () => {} };
globalThis.document = {
  addEventListener() {}, removeEventListener() {}, getElementById: () => null,
  createElement: () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} },
                          appendChild() {}, setAttribute() {}, addEventListener() {} }),
  createElementNS: () => ({ setAttribute() {}, setAttributeNS() {}, appendChild() {} }),
  body: { appendChild() {} }
};
const path = require('path');
const base = path.join(__dirname, '..');
require(path.join(base, 'js/core/util.js'));
require(path.join(base, 'js/core/store.js'));
require(path.join(base, 'js/core/bank.js'));
const C = globalThis.Casino;
C.audio = { play() {}, unlock() {}, toggle() {} };
C.fx = { reduced: true, celebrate() {}, clearAll() {}, mount() {}, countUp() { const p = Promise.resolve(true); p.cancel = () => {}; return p; } };
C.ui = { toast() {}, betControl: () => ({ node: {}, get: () => 1, setEnabled() {}, destroy() {} }),
         button: () => ({ style: {}, addEventListener() {}, querySelector: () => ({ textContent: '' }),
                          classList: { add() {}, remove() {}, toggle() {} } }),
         infoPanel: () => ({}), table: () => ({}), notEnough() {}, CHIPS: [], attachTactile() {}, setBusy() {} };
C.progress = { unlock() {}, init() {} };
require(path.join(base, 'js/core/engine.js'));
require(path.join(base, 'js/games/slot-symbols.js'));
require(path.join(base, 'js/games/deck.js'));
['slots','roulette','blackjack','videopoker','baccarat','dice','mines','crash','plinko','hilo','keno','scratch']
  .forEach(g => require(path.join(base, 'js/games/' + g + '.js')));

const U = C.util, L = C.slotsLogic;

const SEEDS = [1, 42, 1337, 20240927, 4294967295];
const out = [];
const w = s => out.push(s);

/* ---------------------- 1. el generador aleatorio ---------------------- */
const rngRows = SEEDS.map(seed => {
  const rng = U.createRng(seed);
  const vals = [];
  for (let i = 0; i < 8; i++) vals.push(rng());
  return { seed, vals };
});

/* ---------------------- 2. las tiras de los carretes ---------------------- */
const stripRows = [1, 42, 1337].map(seed => {
  const rng = U.createRng(seed);
  return { seed, strip: L.buildStrip(rng) };
});

/* ---------------------- 3. evaluación de pantallas ---------------------- */
const S = id => id;
const grids = [
  { name: 'cinco BAR', grid: Array.from({ length: 5 }, () => ['bar', 'bar', 'bar']) },
  { name: 'tres limones en la linea 1',
    grid: [['cereza','limon','uvas'], ['sandia','limon','naranja'], ['campana','limon','cereza'],
           ['uvas','naranja','sandia'], ['cereza','campana','limon']] },
  { name: 'comodin completa sietes',
    grid: [['comodin','cereza','cereza'], ['siete','cereza','cereza'], ['siete','cereza','cereza'],
           ['limon','cereza','cereza'], ['limon','cereza','cereza']] },
  { name: 'tres estrellas dispersas',
    grid: [['estrella','cereza','limon'], ['naranja','estrella','uvas'], ['sandia','campana','estrella'],
           ['cereza','limon','naranja'], ['uvas','sandia','campana']] },
  { name: 'cinco estrellas',
    grid: Array.from({ length: 5 }, (_, i) => i === 0 ? ['estrella','estrella','cereza']
                                                      : ['estrella','cereza','limon']) },
  { name: 'sin premio',
    grid: [['cereza','limon','uvas'], ['sandia','naranja','campana'], ['limon','uvas','cereza'],
           ['naranja','sandia','limon'], ['campana','cereza','uvas']] },
  { name: 'todo comodines cuenta como BAR',
    grid: Array.from({ length: 5 }, () => ['comodin', 'cereza', 'limon']) }
];
const gridRows = grids.map(g => {
  const ev = L.evaluate(g.grid);
  return {
    name: g.name,
    grid: g.grid,
    lineMult: ev.lineMult,
    scatterMult: ev.scatterMult,
    lines: ev.lines.length,
    scatterCount: ev.scatter ? ev.scatter.count : 0,
    scatterSpins: ev.scatter ? ev.scatter.spins : 0,
    payout10: L.payoutFor(ev, 10, 1),
    payout10free: L.payoutFor(ev, 10, L.FREE_MULTIPLIER)
  };
});

/* ---------------------- 4. una sesión completa de giros ---------------------- */
function sessionFor(seed, spins) {
  const rng = U.createRng(seed);
  const strips = [];
  for (let i = 0; i < L.REELS; i++) strips.push(L.buildStrip(rng));
  let wagered = 0, returned = 0, owed = 0, hits = 0;
  for (let i = 0; i < spins; i++) {
    const free = owed > 0;
    if (free) owed--; else wagered += 10;
    const grid = [];
    for (let r = 0; r < L.REELS; r++) {
      const p = rng.int(0, L.STRIP_LEN - 1);
      const col = [];
      for (let f = 0; f < L.ROWS; f++) col.push(strips[r][(p + f) % L.STRIP_LEN]);
      grid.push(col);
    }
    const ev = L.evaluate(grid);
    const win = L.payoutFor(ev, 10, free ? L.FREE_MULTIPLIER : 1);
    returned += win;
    if (win > 0) hits++;
    if (ev.scatter && ev.scatter.spins) owed += ev.scatter.spins;
  }
  return { seed, spins, wagered, returned: Math.round(returned * 100) / 100, hits };
}
const sessions = [1, 42, 1337].map(s => sessionFor(s, 20000));

/* ---------------------- 5. el banco ---------------------- */
function bankScenario() {
  C.store._replace(Object.assign(C.store.defaultState(), { balanceCents: 100000 }));
  C.bank._clearRounds(); C.bank._resetLedger();
  const steps = [];
  const snap = label => steps.push({ label, cents: C.bank.balanceCents });

  snap('inicio');
  let r = C.bank.openRound('slots', 10); snap('tras apostar 10');
  r.settle(25); snap('tras ganar 25');
  r = C.bank.openRound('slots', 7.5); snap('tras apostar 7,50');
  r.raise(7.5); snap('tras doblar');
  r.settle(0); snap('tras perder');
  r = C.bank.openRound('bj', 3.33); snap('tras apostar 3,33');
  r.settle(3.33); snap('tras empatar');
  C.bank.credit(50, 'bonus'); snap('tras bonus de 50');
  // mil rondas de 0,10 devueltas: el saldo debe quedar idéntico
  const before = C.bank.balanceCents;
  for (let i = 0; i < 1000; i++) { const x = C.bank.openRound('t', 0.1); x.settle(0.1); }
  steps.push({ label: '1000 rondas de 0,10 devueltas', cents: C.bank.balanceCents });
  return { steps, sameAfterLoop: before === C.bank.balanceCents,
           debit: C.bank.ledger.debitCents, credit: C.bank.ledger.creditCents };
}
const bank = bankScenario();

/* ---------------------- 6. el resto de las máquinas ---------------------- */
const D = C.deck;

/* --- barajas sembradas: el orden debe coincidir carta a carta --- */
const deckRows = [1, 42].map(seed => ({
  seed,
  ids: D.build(1, U.createRng(seed)).map(c => c.id)
}));

/* --- ruleta: RTP exacto enumerando las 37 casillas --- */
const R = C.rouletteLogic;
const rouletteTypes = [
  ['straight', 17], ['straight', 0], ['red', null], ['black', null],
  ['even', null], ['odd', null], ['low', null], ['high', null],
  ['dozen', 0], ['dozen', 1], ['dozen', 2], ['column', 0], ['column', 1], ['column', 2]
];
const rouletteRows = rouletteTypes.map(([type, key]) => {
  let ret = 0;
  const hits = [];
  for (const n of R.WHEEL) {
    const p = R.payout([{ type, key, amount: 10 }], n);
    ret += p;
    if (p > 0) hits.push(n);
  }
  return { type, key: key === null ? -1 : key, returned: Math.round(ret * 100) / 100, hits: hits.length };
});

/* --- blackjack: comparaciones concretas --- */
const B = C.blackjackLogic;
const cd = (r, s) => D.card(r, s);
const bjCases = [
  ['BJ natural contra 20', [[1,'s'],[13,'h']], [[10,'s'],[10,'h']], false],
  ['BJ contra BJ', [[1,'s'],[13,'h']], [[1,'d'],[12,'c']], false],
  ['20 contra BJ del crupier', [[10,'s'],[10,'h']], [[1,'d'],[12,'c']], false],
  ['21 tras separar', [[1,'s'],[13,'h']], [[10,'s'],[9,'h']], true],
  ['el jugador se pasa', [[10,'s'],[9,'h'],[5,'d']], [[6,'s'],[10,'h']], false],
  ['el crupier se pasa', [[10,'s'],[8,'h']], [[6,'s'],[10,'h'],[9,'d']], false],
  ['20 contra 19', [[10,'s'],[10,'h']], [[9,'s'],[10,'h']], false],
  ['18 contra 18', [[8,'s'],[10,'h']], [[8,'d'],[10,'c']], false],
  ['ambos se pasan', [[10,'s'],[9,'h'],[8,'d']], [[10,'c'],[9,'d'],[7,'s']], false]
].map(([name, ph, dh, split]) => ({
  name,
  player: ph, dealer: dh, split,
  mult: B.compare(ph.map(x => cd(x[0], x[1])), dh.map(x => cd(x[0], x[1])), split)
}));

const bjDealer = [
  ['16', [[10,'s'],[6,'h']]],
  ['17 duro', [[10,'s'],[7,'h']]],
  ['17 blando A+6', [[1,'s'],[6,'h']]],
  ['12 blando A+A', [[1,'s'],[1,'h']]],
  ['21', [[1,'s'],[13,'h']]]
].map(([name, h]) => ({ name, hand: h, hits: B.dealerShouldHit(h.map(x => cd(x[0], x[1]))) }));

/* --- video póker: evaluación y pagos --- */
const V = C.videopokerLogic;
const vpHands = [
  ['escalera real', [[1,'s'],[13,'s'],[12,'s'],[11,'s'],[10,'s']]],
  ['escalera de color', [[9,'h'],[8,'h'],[7,'h'],[6,'h'],[5,'h']]],
  ['poker', [[4,'s'],[4,'h'],[4,'d'],[4,'c'],[9,'s']]],
  ['full', [[3,'s'],[3,'h'],[3,'d'],[8,'c'],[8,'s']]],
  ['color', [[2,'s'],[5,'s'],[9,'s'],[11,'s'],[13,'s']]],
  ['escalera A-5', [[1,'s'],[2,'h'],[3,'d'],[4,'c'],[5,'s']]],
  ['escalera 10-A', [[10,'s'],[11,'h'],[12,'d'],[13,'c'],[1,'s']]],
  ['trio', [[7,'s'],[7,'h'],[7,'d'],[2,'c'],[9,'s']]],
  ['doble pareja', [[7,'s'],[7,'h'],[9,'d'],[9,'c'],[2,'s']]],
  ['pareja de damas', [[12,'s'],[12,'h'],[3,'d'],[7,'c'],[9,'s']]],
  ['pareja de ases', [[1,'s'],[1,'h'],[3,'d'],[7,'c'],[9,'s']]],
  ['pareja baja', [[5,'s'],[5,'h'],[3,'d'],[7,'c'],[9,'s']]],
  ['nada', [[2,'s'],[5,'h'],[9,'d'],[11,'c'],[13,'s']]]
].map(([name, h]) => {
  const hand = h.map(x => cd(x[0], x[1]));
  const ev = D.evaluatePoker(hand);
  return { name, cards: h, key: ev.key, pay5: V.payout(ev.key, 5, 1), pay1: V.payout(ev.key, 1, 1) };
});

/* --- baccarat: manos sembradas y pagos --- */
const Bc = C.baccaratLogic;
const bacRows = [1, 42, 1337].map(seed => {
  const shoe = D.shoe(Bc.DECKS, U.createRng(seed), 0.8);
  const hands = [];
  for (let i = 0; i < 12; i++) {
    const h = Bc.playHand(shoe);
    hands.push({ p: h.pScore, b: h.bScore, w: h.winner, pn: h.player.length, bn: h.banker.length });
  }
  return { seed, hands };
});
const bacPays = [
  ['player gana player', 'player', 'player'], ['player gana banker', 'player', 'banker'],
  ['player empate', 'player', 'tie'], ['banker gana banker', 'banker', 'banker'],
  ['banker empate', 'banker', 'tie'], ['tie acierta', 'tie', 'tie'], ['tie falla', 'tie', 'player']
].map(([name, side, winner]) => ({ name, side, winner, pay: Bc.payout(side, 10, winner) }));

/* --- dados --- */
const Dc = C.diceLogic;
const diceRows = [[50,true],[50,false],[75,true],[90,true],[98,true],[2,false],[25,false],[10,false]]
  .map(([t, o]) => ({ target: t, over: o, chance: Dc.winChance(t, o), mult: Dc.multiplier(t, o) }));

/* --- minas --- */
const M = C.minesLogic;
const minesRows = [];
for (const mines of [1, 3, 5, 10, 24]) {
  for (const picks of [1, 2, 3, 5, 10]) {
    const m = M.multiplier(mines, picks);
    minesRows.push({ mines, picks, mult: m });
  }
}

/* --- crash --- */
const K = C.crashLogic;
const crashRows = [1, 42].map(seed => {
  const rng = U.createRng(seed);
  const vals = [];
  for (let i = 0; i < 12; i++) vals.push(K.rollCrash(rng));
  return { seed, vals };
});

/* --- plinko --- */
const P = C.plinkoLogic;
const plinkoRows = Object.keys(P.RISK).map(k => ({
  risk: k, rtp: P.rtpOf(P.RISK[k].pays), pays: P.RISK[k].pays
}));
const plinkoProbs = [];
for (let i = 0; i <= P.ROWS; i++) plinkoProbs.push(P.bucketProbability(i));

/* --- hi-lo --- */
const H = C.hiloLogic;
const hiloRows = [];
{
  const deck = D.build(1, U.createRng(3));
  for (const [r, s] of [[1,'s'],[7,'h'],[13,'d']]) {
    const cur = cd(r, s);
    const rest = deck.filter(x => x.id !== cur.id);
    hiloRows.push({
      rank: r,
      suit: { s: 0, h: 1, d: 2, c: 3 }[s],
      remaining: rest.length,
      chanceHi: H.chance(cur, rest, true),
      chanceLo: H.chance(cur, rest, false),
      multHi: H.stepMultiplier(cur, rest, true),
      multLo: H.stepMultiplier(cur, rest, false)
    });
  }
}

/* --- keno --- */
const Kn = C.kenoLogic;
const kenoRows = [];
for (let k = 1; k <= 10; k++) {
  const probs = [];
  for (let h = 0; h <= k; h++) probs.push(Kn.probability(k, h));
  kenoRows.push({ picks: k, rtp: Kn.rtpFor(k), probs });
}

/* --- rasca --- */
const Sc = C.scratchLogic;
const scratchRow = { rtp: Sc.rtp(), totalWeight: Sc.TOTAL_W };
const scratchSeq = (() => {
  const rng = U.createRng(1234);
  const out = [];
  for (let i = 0; i < 20; i++) {
    const o = Sc.rollOutcome(rng);
    const cells = Sc.buildTicket(o, rng);
    const ev = Sc.evaluateTicket(cells);
    out.push({ mult: o.mult, found: ev ? ev.mult : 0 });
  }
  return out;
})();

/* ============================ salida en C# ============================ */
const esc = s => String(s).replace(/"/g, '\\"');
const fmtD = v => {
  // 17 cifras significativas: suficiente para reconstruir el double exacto.
  const s = v.toPrecision(17);
  return s.indexOf('.') === -1 && s.indexOf('e') === -1 ? s + '.0' : s;
};

w('// ATENCIÓN: fichero GENERADO. No editar a mano.');
w('// Lo produce tools/gen-unity-vectors.js a partir del JavaScript ya');
w('// verificado de la versión web. Si cambias las matemáticas del juego,');
w('// vuelve a generarlo y los tests te dirán si el port sigue cuadrando.');
w('//');
w('// Generado el ' + new Date().toISOString().slice(0, 10) + '.');
w('');
w('namespace Casino.Tests');
w('{');
w('    public static class GoldenVectors');
w('    {');

w('        /// <summary>Primeros 8 valores del generador para cada semilla.</summary>');
w('        public static readonly (uint seed, double[] values)[] Rng =');
w('        {');
rngRows.forEach(r => {
  w('            (' + (r.seed >>> 0) + 'u, new[] { ' + r.vals.map(fmtD).join(', ') + ' }),');
});
w('        };');
w('');

w('        /// <summary>Tira completa de 64 posiciones para cada semilla.</summary>');
w('        public static readonly (uint seed, string[] strip)[] Strips =');
w('        {');
stripRows.forEach(r => {
  w('            (' + (r.seed >>> 0) + 'u, new[]');
  w('            {');
  for (let i = 0; i < r.strip.length; i += 8) {
    w('                ' + r.strip.slice(i, i + 8).map(x => '"' + x + '"').join(', ') + ',');
  }
  w('            }),');
});
w('        };');
w('');

w('        public struct GridCase');
w('        {');
w('            public string Name;');
w('            public string[][] Grid;');
w('            public int LineMult;');
w('            public int ScatterMult;');
w('            public int LineCount;');
w('            public int ScatterCount;');
w('            public int ScatterSpins;');
w('            public decimal Payout10;');
w('            public decimal Payout10Free;');
w('        }');
w('');
w('        /// <summary>Pantallas concretas con su evaluación exacta.</summary>');
w('        public static readonly GridCase[] Grids =');
w('        {');
gridRows.forEach(g => {
  w('            new GridCase');
  w('            {');
  w('                Name = "' + esc(g.name) + '",');
  w('                Grid = new[]');
  w('                {');
  g.grid.forEach(col => {
    w('                    new[] { ' + col.map(x => '"' + x + '"').join(', ') + ' },');
  });
  w('                },');
  w('                LineMult = ' + g.lineMult + ', ScatterMult = ' + g.scatterMult + ',');
  w('                LineCount = ' + g.lines + ', ScatterCount = ' + g.scatterCount +
    ', ScatterSpins = ' + g.scatterSpins + ',');
  w('                Payout10 = ' + g.payout10 + 'm, Payout10Free = ' + g.payout10free + 'm');
  w('            },');
});
w('        };');
w('');

w('        public struct SessionCase');
w('        {');
w('            public uint Seed;');
w('            public int Spins;');
w('            public decimal Wagered;');
w('            public decimal Returned;');
w('            public int Hits;');
w('        }');
w('');
w('        /// <summary>Sesiones largas: mismo número de premios y mismo dinero devuelto.</summary>');
w('        public static readonly SessionCase[] Sessions =');
w('        {');
sessions.forEach(s => {
  w('            new SessionCase { Seed = ' + (s.seed >>> 0) + 'u, Spins = ' + s.spins +
    ', Wagered = ' + s.wagered + 'm, Returned = ' + s.returned + 'm, Hits = ' + s.hits + ' },');
});
w('        };');
w('');

w('        /// <summary>Saldo en céntimos tras cada paso de una secuencia del banco.</summary>');
w('        public static readonly (string label, long cents)[] BankSteps =');
w('        {');
bank.steps.forEach(s => w('            ("' + esc(s.label) + '", ' + s.cents + 'L),'));
w('        };');
w('');
w('        public const long BankLedgerDebit = ' + bank.debit + 'L;');
w('        public const long BankLedgerCredit = ' + bank.credit + 'L;');
w('');

/* ------------------------------ barajas ------------------------------ */
w('        /// <summary>Baraja sembrada: el orden debe coincidir carta a carta.</summary>');
w('        public static readonly (uint seed, string[] ids)[] Decks =');
w('        {');
deckRows.forEach(d => {
  w('            (' + (d.seed >>> 0) + 'u, new[]');
  w('            {');
  for (let i = 0; i < d.ids.length; i += 13) {
    w('                ' + d.ids.slice(i, i + 13).map(x => '"' + x + '"').join(', ') + ',');
  }
  w('            }),');
});
w('        };');
w('');

/* ------------------------------ ruleta ------------------------------ */
w('        /// <summary>Ruleta: dinero devuelto al enumerar las 37 casillas con 10 € por apuesta.</summary>');
w('        public static readonly (string type, int key, decimal returned, int hits)[] Roulette =');
w('        {');
rouletteRows.forEach(r => {
  w('            ("' + r.type + '", ' + r.key + ', ' + r.returned + 'm, ' + r.hits + '),');
});
w('        };');
w('');

/* ----------------------------- blackjack ----------------------------- */
w('        public struct BjCase { public string Name; public int[][] Player; public int[][] Dealer; public bool Split; public decimal Mult; }');
w('        public static readonly BjCase[] Blackjack =');
w('        {');
const suitIdx = { s: 0, h: 1, d: 2, c: 3 };
const handLit = h => 'new[] { ' + h.map(x => 'new[] { ' + x[0] + ', ' + suitIdx[x[1]] + ' }').join(', ') + ' }';
bjCases.forEach(c => {
  w('            new BjCase { Name = "' + esc(c.name) + '", Player = ' + handLit(c.player) +
    ', Dealer = ' + handLit(c.dealer) + ', Split = ' + c.split + ', Mult = ' + c.mult + 'm },');
});
w('        };');
w('');
w('        public static readonly (string name, int[][] hand, bool hits)[] BlackjackDealer =');
w('        {');
bjDealer.forEach(c => {
  w('            ("' + esc(c.name) + '", ' + handLit(c.hand) + ', ' + c.hits + '),');
});
w('        };');
w('');

/* ---------------------------- video póker ---------------------------- */
w('        public struct VpCase { public string Name; public int[][] Cards; public string Key; public decimal Pay5; public decimal Pay1; }');
w('        public static readonly VpCase[] VideoPoker =');
w('        {');
vpHands.forEach(c => {
  w('            new VpCase { Name = "' + esc(c.name) + '", Cards = ' + handLit(c.cards) +
    ', Key = "' + c.key + '", Pay5 = ' + c.pay5 + 'm, Pay1 = ' + c.pay1 + 'm },');
});
w('        };');
w('');

/* ------------------------------ baccarat ------------------------------ */
w('        public struct BacHand { public int P; public int B; public string W; public int PN; public int BN; }');
w('        public static readonly (uint seed, BacHand[] hands)[] Baccarat =');
w('        {');
bacRows.forEach(r => {
  w('            (' + (r.seed >>> 0) + 'u, new[]');
  w('            {');
  r.hands.forEach(h => {
    w('                new BacHand { P = ' + h.p + ', B = ' + h.b + ', W = "' + h.w +
      '", PN = ' + h.pn + ', BN = ' + h.bn + ' },');
  });
  w('            }),');
});
w('        };');
w('');
w('        public static readonly (string name, string side, string winner, decimal pay)[] BaccaratPays =');
w('        {');
bacPays.forEach(b => {
  w('            ("' + esc(b.name) + '", "' + b.side + '", "' + b.winner + '", ' + b.pay + 'm),');
});
w('        };');
w('');

/* ------------------------------- dados ------------------------------- */
w('        public static readonly (int target, bool over, double chance, double mult)[] Dice =');
w('        {');
diceRows.forEach(d => {
  w('            (' + d.target + ', ' + d.over + ', ' + fmtD(d.chance) + ', ' + fmtD(d.mult) + '),');
});
w('        };');
w('');

/* ------------------------------- minas ------------------------------- */
w('        public static readonly (int mines, int picks, double mult)[] Mines =');
w('        {');
minesRows.forEach(m => w('            (' + m.mines + ', ' + m.picks + ', ' + fmtD(m.mult) + '),'));
w('        };');
w('');

/* ------------------------------- crash ------------------------------- */
w('        public static readonly (uint seed, double[] crashes)[] Crash =');
w('        {');
crashRows.forEach(c => {
  w('            (' + (c.seed >>> 0) + 'u, new[] { ' + c.vals.map(fmtD).join(', ') + ' }),');
});
w('        };');
w('');

/* ------------------------------- plinko ------------------------------- */
w('        public static readonly (string risk, decimal rtp, decimal[] pays)[] Plinko =');
w('        {');
plinkoRows.forEach(p => {
  w('            ("' + p.risk + '", ' + (Math.round(p.rtp * 1e9) / 1e9) + 'm, new[] { ' +
    p.pays.map(x => x + 'm').join(', ') + ' }),');
});
w('        };');
w('');
w('        public static readonly double[] PlinkoBucketProbs = { ' + plinkoProbs.map(fmtD).join(', ') + ' };');
w('');

/* ------------------------------- hi-lo ------------------------------- */
w('        public struct HiLoCase { public int Rank; public int Suit; public int Remaining;');
w('            public double ChanceHi; public double ChanceLo; public double MultHi; public double MultLo; }');
w('        public static readonly HiLoCase[] HiLo =');
w('        {');
hiloRows.forEach(h => {
  w('            new HiLoCase { Rank = ' + h.rank + ', Suit = ' + h.suit + ', Remaining = ' + h.remaining +
    ', ChanceHi = ' + fmtD(h.chanceHi) + ', ChanceLo = ' + fmtD(h.chanceLo) +
    ', MultHi = ' + fmtD(h.multHi) + ', MultLo = ' + fmtD(h.multLo) + ' },');
});
w('        };');
w('');

/* -------------------------------- keno -------------------------------- */
w('        public static readonly (int picks, double rtp, double[] probs)[] Keno =');
w('        {');
kenoRows.forEach(k => {
  w('            (' + k.picks + ', ' + fmtD(k.rtp) + ', new[] { ' + k.probs.map(fmtD).join(', ') + ' }),');
});
w('        };');
w('');

/* -------------------------------- rasca -------------------------------- */
w('        public const double ScratchRtp = ' + fmtD(scratchRow.rtp) + ';');
w('        public const int ScratchTotalWeight = ' + scratchRow.totalWeight + ';');
w('        /// <summary>Premio sorteado y premio encontrado en el boleto: deben coincidir.</summary>');
w('        public static readonly (decimal rolled, decimal found)[] ScratchSequence =');
w('        {');
scratchSeq.forEach(x => w('            (' + x.mult + 'm, ' + x.found + 'm),'));
w('        };');

w('    }');
w('}');

console.log(out.join('\n'));
