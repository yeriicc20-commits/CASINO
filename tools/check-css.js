#!/usr/bin/env node
/* Comprobación rápida de CSS: detecta valores de color inválidos, llaves
   descompensadas y variables usadas pero nunca definidas. */
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..', 'css');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.endsWith('.css')) files.push(p);
  }
})(root);

let problems = 0;
const defined = new Set();
const used = [];

for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  const rel = path.relative(path.join(__dirname, '..'), f);

  // llaves descompensadas
  const open = (src.match(/\{/g) || []).length;
  const close = (src.match(/\}/g) || []).length;
  if (open !== close) {
    console.log(`${rel}: llaves descompensadas (${open} abren, ${close} cierran)`);
    problems++;
  }

  src.split('\n').forEach((rawLine, i) => {
    const ln = i + 1;
    if (rawLine.trim().startsWith('/*') || rawLine.trim().startsWith('*')) return;
    // Quitamos comentarios en línea: su texto en castellano no es un valor.
    const line = rawLine.replace(/\/\*[\s\S]*?\*\//g, '');
    if (!line.trim()) return;

    // Hex inválido: # seguido de algo que no sea 3/4/6/8 hex digits
    const hexes = line.match(/#[0-9a-zA-Z]+/g) || [];
    for (const h of hexes) {
      const body = h.slice(1);
      if (!/^([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(body)) {
        // los selectores de id (#app) son válidos: sólo miramos dentro de valores
        if (/:\s*[^;]*$/.test(line.slice(0, line.indexOf(h)))) {
          console.log(`${rel}:${ln}: color hex inválido "${h}"`);
          problems++;
        }
      }
    }

    // Caracteres no ASCII dentro de un valor de propiedad (síntoma de texto corrupto)
    const valueMatch = /^\s*[-a-zA-Z]+\s*:\s*(.+?);?\s*$/.exec(line);
    if (valueMatch && /[^\x00-\x7F]/.test(valueMatch[1])) {
      const prop = line.trim().split(':')[0].trim();
      // content: y font-family: legítimamente pueden llevar acentos
      if (!/^(content|font-family|--font)/.test(prop)) {
        console.log(`${rel}:${ln}: carácter no ASCII en un valor: ${line.trim()}`);
        problems++;
      }
    }

    // recopila var() definidas y usadas
    const defs = line.match(/(--[\w-]+)\s*:/g) || [];
    defs.forEach(d => defined.add(d.replace(/\s*:$/, '')));
    // var(--x) sin fallback: si tiene coma, el fallback la cubre.
    const uses = line.match(/var\(\s*--[\w-]+\s*[,)]/g) || [];
    uses.forEach(u => {
      if (u.trim().endsWith(',')) return;           // tiene fallback, es válido
      const name = u.replace(/var\(\s*/, '').replace(/\s*[,)]$/, '');
      used.push({ name, file: rel, line: ln });
    });
  });
}

// variables usadas sin definir (ignorando las que tienen fallback)
const missing = new Map();
for (const u of used) {
  if (!defined.has(u.name)) {
    if (!missing.has(u.name)) missing.set(u.name, u);
  }
}
for (const [name, u] of missing) {
  console.log(`${u.file}:${u.line}: var(${name}) no está definida en ningún sitio`);
  problems++;
}

console.log(problems === 0
  ? `CSS OK — ${files.length} ficheros, ${defined.size} variables definidas.`
  : `\n${problems} problema(s) encontrado(s).`);
process.exit(problems === 0 ? 0 : 1);
