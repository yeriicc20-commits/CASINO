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
require(path.join(base, 'js/games/slots.js'));

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
w('    }');
w('}');

console.log(out.join('\n'));
