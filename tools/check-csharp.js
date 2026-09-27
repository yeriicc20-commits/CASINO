#!/usr/bin/env node
/* =========================================================================
   check-csharp.js — revisión estática del port a C#.

   No sustituye a un compilador (aquí no hay ninguno), pero caza los fallos
   que más se cuelan al portar a mano: llaves descompensadas, tipos que los
   tests usan y no existen, `using` que faltan, nombres de enum que no
   coinciden con las cadenas de los vectores y culturas por nombre.
   ========================================================================= */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'unity', 'Assets', 'Casino');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.cs')) files.push(p);
  }
})(root);

let problems = 0;
const fail = m => { console.log('  ✗ ' + m); problems++; };

/* Quita comentarios y cadenas para contar símbolos con fiabilidad. */
function strip(src) {
  let s = src.replace(/\/\/.*$/gm, '');
  s = s.replace(/\/\*[\s\S]*?\*\//g, '');
  s = s.replace(/@"(?:[^"]|"")*"/g, '""');
  s = s.replace(/\$?"(?:\\.|[^"\\])*"/g, '""');
  s = s.replace(/'(?:\\.|[^'\\])*'/g, "''");
  return s;
}

console.log('Revisión estática del C# (' + files.length + ' ficheros)\n');

const declaredTypes = new Set();
const declaredMembers = new Map();   // Tipo -> Set(miembros)
const sources = new Map();

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(path.join(__dirname, '..'), f);
  sources.set(rel, src);
  const s = strip(src);

  for (const [op, cl, label] of [['{', '}', 'llaves'], ['(', ')', 'paréntesis'], ['[', ']', 'corchetes']]) {
    const a = (s.match(new RegExp('\\' + op, 'g')) || []).length;
    const b = (s.match(new RegExp('\\' + cl, 'g')) || []).length;
    if (a !== b) fail(`${rel}: ${label} descompensados (${a} vs ${b})`);
  }

  if (!/namespace\s+[\w.]+/.test(s)) fail(`${rel}: sin namespace`);
  if (/GetCultureInfo\("|new CultureInfo\("/.test(s)) {
    fail(`${rel}: cultura por nombre (rompe en IL2CPP con globalización invariante)`);
  }

  // tipos declarados
  for (const m of s.matchAll(/\b(?:public|internal)\s+(?:static\s+|sealed\s+|readonly\s+|partial\s+)*(?:class|struct|enum)\s+(\w+)/g)) {
    declaredTypes.add(m[1]);
  }
  // miembros públicos, groseramente
  for (const m of s.matchAll(/\b(?:public|internal)\s+(?:static\s+|readonly\s+|const\s+|sealed\s+|override\s+|virtual\s+)*[\w<>\[\],.\s?()]+?\s+(\w+)\s*(?:[({=;]|=>)/g)) {
    const name = m[1];
    if (['class','struct','enum','return','if','new','get','set'].includes(name)) continue;
    if (!declaredMembers.has('*')) declaredMembers.set('*', new Set());
    declaredMembers.get('*').add(name);
  }
  // valores de enum
  for (const m of s.matchAll(/enum\s+(\w+)\s*\{([^}]*)\}/g)) {
    const vals = m[2].split(',').map(x => x.trim().split(/\s|=/)[0]).filter(Boolean);
    declaredMembers.set(m[1], new Set(vals));
  }
}

/* --- los tests no deben usar tipos que no existen --- */
const testFiles = files.filter(f => f.includes(path.sep + 'Tests' + path.sep));
const runtimeTypes = declaredTypes;
for (const f of testFiles) {
  const src = strip(fs.readFileSync(f, 'utf8'));
  const rel = path.relative(path.join(__dirname, '..'), f);
  const used = new Set();
  // (?<![.\w]) evita confundir una propiedad encadenada con un tipo.
  for (const m of src.matchAll(/(?<![.\w])([A-Z]\w+)\.(\w+)/g)) used.add(m[1]);
  for (const t of used) {
    if (['Assert','CollectionAssert','GoldenVectors','Math','Enum','Convert','System','Casino',
         'UnityEngine','Debug','TestCase','Test','String','Double','Decimal','Int32','NUnit',
         'Framework','Collections','Generic'].includes(t)) continue;
    if (!runtimeTypes.has(t)) fail(`${rel}: usa el tipo «${t}», que no está declarado en el runtime`);
  }
}

/* --- los nombres de enum deben coincidir con las cadenas de los vectores --- */
const vectors = fs.readFileSync(path.join(root, 'Tests', 'GoldenVectors.cs'), 'utf8');

function checkEnumStrings(enumName, regex, label) {
  const vals = declaredMembers.get(enumName);
  if (!vals) { fail(`no encuentro el enum ${enumName}`); return; }
  const lower = new Set([...vals].map(v => v.toLowerCase()));
  const found = new Set();
  for (const m of vectors.matchAll(regex)) found.add(m[1].toLowerCase());
  for (const v of found) {
    if (!lower.has(v)) fail(`${label}: la cadena «${v}» no existe en el enum ${enumName} (${[...vals].join(', ')})`);
  }
  if (found.size) console.log(`  ✓ ${label}: ${found.size} valores coinciden con ${enumName}`);
}

checkEnumStrings('RouletteBetType', /^\s*\("(\w+)", -?\d+, [\d.]+m/gm, 'ruleta');
checkEnumStrings('PlinkoRisk', /^\s*\("(bajo|medio|alto)", /gm, 'plinko');
checkEnumStrings('BaccaratSide', /W = "(\w+)"/g, 'baccarat (ganador)');

/* --- los pagos de la web y del C# deben ser los mismos números --- */
function comparePays(csFile, csRegex, jsFile, jsRegex, label) {
  const cs = fs.readFileSync(path.join(root, csFile), 'utf8');
  const js = fs.readFileSync(path.join(__dirname, '..', jsFile), 'utf8');
  const a = (cs.match(csRegex) || []).join(' ').replace(/[m\s]/g, '');
  const b = (js.match(jsRegex) || []).join(' ').replace(/\s/g, '');
  if (!a || !b) { fail(`${label}: no pude extraer los pagos para comparar`); return; }
  // Sólo números de verdad: los puntos sueltos de «PokerHand.RoyalFlush»
  // se colaban como NaN y hacían saltar una falsa alarma.
  const nums = t => (t.match(/\d+(?:\.\d+)?/g) || []).map(Number);
  const na = nums(a);
  const nb = nums(b);
  if (na.length !== nb.length || na.some((v, i) => v !== nb[i])) {
    fail(`${label}: los pagos del C# NO coinciden con los del JavaScript`);
    console.log('      C#: ' + na.join(','));
    console.log('      JS: ' + nb.join(','));
  } else {
    console.log(`  ✓ ${label}: ${na.length} valores idénticos a los del JavaScript`);
  }
}

comparePays('Scripts/Games/PlinkoLogic.cs', /PaysBajo\s*=\s*\{[^}]*\}/s,
            'js/games/plinko.js', /bajo:\s*\{[^}]*pays:\s*\[[^\]]*\]/s, 'plinko (bajo)');
comparePays('Scripts/Games/PlinkoLogic.cs', /PaysMedio\s*=\s*\{[^}]*\}/s,
            'js/games/plinko.js', /medio:\s*\{[^}]*pays:\s*\[[^\]]*\]/s, 'plinko (medio)');
comparePays('Scripts/Games/PlinkoLogic.cs', /PaysAlto\s*=\s*\{[^}]*\}/s,
            'js/games/plinko.js', /alto:\s*\{[^}]*pays:\s*\[[^\]]*\]/s, 'plinko (alto)');
comparePays('Scripts/Games/KenoLogic.cs', /Pays = new Dictionary<int, decimal\[\]>\s*\{[\s\S]*?\n        \};/,
            'js/games/keno.js', /var PAYS = \{[\s\S]*?\n  \};/, 'keno');
comparePays('Scripts/Games/VideoPokerLogic.cs', /Paytable = new Dictionary<PokerHand, int\[\]>[\s\S]*?\n        \};/,
            'js/games/videopoker.js', /var PAYTABLE = \[[\s\S]*?\n  \];/, 'video póker');
comparePays('Scripts/Games/SlotsLogic.cs', /public static readonly SlotSymbol\[\] Symbols =[\s\S]*?\n        \};/,
            'js/games/slots.js', /var SYMBOLS = \[[\s\S]*?\n  \];/, 'tragaperras (pesos y pagos)');
comparePays('Scripts/Games/RouletteLogic.cs', /public static readonly int\[\] Wheel =[\s\S]*?\n        \};/,
            'js/games/roulette.js', /var WHEEL = \[[\s\S]*?\];/, 'ruleta (orden de la rueda)');
comparePays('Scripts/Games/RouletteLogic.cs', /public static readonly int\[\] Reds =[\s\S]*?\n        \};/,
            'js/games/roulette.js', /var REDS = \[[\s\S]*?\];/, 'ruleta (números rojos)');
comparePays('Scripts/Games/ScratchLogic.cs', /public static readonly Prize\[\] Outcomes =[\s\S]*?\n        \};/,
            'js/games/scratch.js', /var OUTCOMES = \[[\s\S]*?\n  \];/, 'rasca (pesos y premios)');

console.log('');
if (problems === 0) {
  console.log('\x1b[32m✓ sin problemas estáticos en ' + files.length + ' ficheros C#\x1b[0m');
} else {
  console.log('\x1b[31m✗ ' + problems + ' problema(s)\x1b[0m');
}
process.exit(problems === 0 ? 0 : 1);
