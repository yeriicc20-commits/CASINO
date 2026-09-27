/* =========================================================================
   gen-unity-sprites.js — saca los símbolos de la tragaperras a PNG para Unity.

   Los símbolos viven dibujados en SVG dentro de js/games/slot-symbols.js, que
   es la única fuente de verdad: son frutas de verdad, no emoji (el sistema
   operativo dibujaba 🃏 como una carta de baraja) ni cartas.

   Este script lee esos mismos dibujos y los rasteriza con el Chromium del
   sistema, para que en Unity se usen como sprites sin volver a dibujar nada.

       node tools/gen-unity-sprites.js

   Salida: unity/Assets/Casino/Art/Symbols/<id>.png (512x512, fondo transparente)
   ========================================================================= */
'use strict';

var fs = require('fs');
var path = require('path');
var os = require('os');
var { execFileSync } = require('child_process');

var ROOT = path.resolve(__dirname, '..');
var SRC = path.join(ROOT, 'js', 'games', 'slot-symbols.js');
var OUT = path.join(ROOT, 'unity', 'Assets', 'Casino', 'Art', 'Symbols');
var SIZE = 512;

/* --- 1. Extraer el mapa DEFS del fichero de la web -------------------------
   DEFS es privado (el módulo sólo expone node() e ids), así que se recorta el
   literal del objeto y se evalúa. Es código del propio repositorio: sólo
   contiene cadenas concatenadas con el marcado SVG de cada símbolo. */
function loadDefs() {
  var src = fs.readFileSync(SRC, 'utf8');
  var start = src.indexOf('var DEFS = {');
  if (start < 0) throw new Error('No encuentro "var DEFS = {" en ' + SRC);
  var open = src.indexOf('{', start);

  // Recorte por conteo de llaves, ignorando las que van dentro de cadenas.
  var depth = 0, quote = null, end = -1;
  for (var i = open; i < src.length; i++) {
    var c = src[i];
    if (quote) {
      if (c === '\\') { i++; continue; }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end < 0) throw new Error('El literal DEFS está sin cerrar');

  var defs = new Function('return (' + src.slice(open, end + 1) + ');')();
  var ids = Object.keys(defs);
  if (!ids.length) throw new Error('DEFS está vacío');
  return defs;
}

/* --- 2. Localizar el Chromium del contenedor ------------------------------ */
function findChromium() {
  var candidates = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'
  ];
  var base = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (base && fs.existsSync(base)) {
    fs.readdirSync(base).forEach(function (d) {
      candidates.push(path.join(base, d, 'chrome-linux', 'chrome'));
      candidates.push(path.join(base, d, 'chrome-linux', 'headless_shell'));
    });
  }
  for (var i = 0; i < candidates.length; i++) {
    if (fs.existsSync(candidates[i])) return candidates[i];
  }
  throw new Error('No encuentro Chromium. Instálalo o exporta PLAYWRIGHT_BROWSERS_PATH.');
}

/* --- 3. Rasterizar cada símbolo ------------------------------------------- */
function main() {
  var defs = loadDefs();
  var chrome = findChromium();
  var tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sprites-'));
  fs.mkdirSync(OUT, { recursive: true });

  var ids = Object.keys(defs);
  console.log('Chromium: ' + chrome);
  console.log('Símbolos: ' + ids.length + ' → ' + path.relative(ROOT, OUT) + '\n');

  ids.forEach(function (id) {
    // El símbolo se dibuja en un viewBox 0 0 100 100; se escala al tamaño final.
    var svg =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
      'viewBox="0 0 100 100" width="' + SIZE + '" height="' + SIZE + '">' +
      defs[id] + '</svg>';
    var svgPath = path.join(tmp, id + '.svg');
    fs.writeFileSync(svgPath, svg);

    var pngPath = path.join(OUT, id + '.png');
    execFileSync(chrome, [
      '--headless', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=1',
      '--default-background-color=00000000',   // fondo transparente
      '--window-size=' + SIZE + ',' + SIZE,
      '--screenshot=' + pngPath,
      'file://' + svgPath
    ], { stdio: ['ignore', 'ignore', 'pipe'] });

    var kb = (fs.statSync(pngPath).size / 1024).toFixed(1);
    console.log('  ✓ ' + id.padEnd(10) + ' ' + kb + ' kB');
  });

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log('\nListo: ' + ids.length + ' sprites de ' + SIZE + '×' + SIZE + '.');
}

main();
