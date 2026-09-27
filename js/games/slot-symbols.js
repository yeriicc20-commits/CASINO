/* =========================================================================
   slot-symbols.js — símbolos de la tragaperras dibujados en SVG.

   Por qué SVG y no emoji: los emoji los dibuja el sistema operativo, así
   que 🃏 salía como una CARTA de la baraja y 7️⃣ como una tecla azul —
   cosas que no pintan nada en una máquina de frutas. Además cada
   plataforma los dibuja distinto (Windows, Mac, Android…), así que la
   máquina nunca se veía igual en dos sitios.

   Dibujados aquí: mismos símbolos siempre, nítidos a cualquier tamaño y
   sin un solo fichero que descargar.
   ========================================================================= */
(function (root) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  /* Cada símbolo es un <symbol> con viewBox 0 0 100 100. */
  var DEFS = {

    /* ------------------------------ frutas ------------------------------ */

    cereza:
      '<path d="M50 24C44 38 36 46 31 55" stroke="#2f7d32" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M50 24C56 38 64 46 69 55" stroke="#2f7d32" stroke-width="5" fill="none" stroke-linecap="round"/>' +
      '<path d="M50 25c9-12 24-11 30-4-10 9-22 11-30 4z" fill="#43a047"/>' +
      '<circle cx="30" cy="71" r="17" fill="#c62333"/>' +
      '<circle cx="70" cy="71" r="17" fill="#e03a4a"/>' +
      '<ellipse cx="24" cy="65" rx="5.5" ry="3.6" fill="#ff9aa2" opacity=".85"/>' +
      '<ellipse cx="64" cy="65" rx="5.5" ry="3.6" fill="#ffb0b6" opacity=".85"/>',

    limon:
      '<g transform="rotate(-20 50 58)">' +
      '<ellipse cx="50" cy="58" rx="34" ry="25" fill="#edc319"/>' +
      '<ellipse cx="50" cy="55" rx="30" ry="21" fill="#f7d942"/>' +
      '<ellipse cx="38" cy="47" rx="10" ry="6" fill="#fff0a0" opacity=".8"/>' +
      '<path d="M84 58c4 0 6 0 6 0" stroke="#c9a413" stroke-width="5" stroke-linecap="round"/>' +
      '</g>' +
      '<path d="M70 32c9-11 22-10 28-4-10 9-21 10-28 4z" fill="#57b04a"/>',

    naranja:
      '<circle cx="50" cy="59" r="30" fill="#e0701a"/>' +
      '<circle cx="50" cy="57" r="27" fill="#f5871f"/>' +
      '<ellipse cx="39" cy="47" rx="9" ry="6" fill="#ffc07a" opacity=".8"/>' +
      '<circle cx="42" cy="66" r="1.6" fill="#c96010" opacity=".6"/>' +
      '<circle cx="58" cy="70" r="1.6" fill="#c96010" opacity=".6"/>' +
      '<circle cx="62" cy="55" r="1.6" fill="#c96010" opacity=".6"/>' +
      '<path d="M50 30v-6" stroke="#6b4a1f" stroke-width="5" stroke-linecap="round"/>' +
      '<path d="M52 26c9-11 22-10 28-4-10 9-21 10-28 4z" fill="#43a047"/>',

    sandia:
      '<path d="M6 84a44 44 0 0 1 88 0z" fill="#1f6b2a"/>' +
      '<path d="M13 84a37 37 0 0 1 74 0z" fill="#7cb342"/>' +
      '<path d="M20 84a30 30 0 0 1 60 0z" fill="#e5384a"/>' +
      '<ellipse cx="35" cy="70" rx="3" ry="4.6" fill="#2b1b12" transform="rotate(-22 35 70)"/>' +
      '<ellipse cx="50" cy="63" rx="3" ry="4.6" fill="#2b1b12"/>' +
      '<ellipse cx="65" cy="70" rx="3" ry="4.6" fill="#2b1b12" transform="rotate(22 65 70)"/>' +
      '<ellipse cx="42" cy="78" rx="3" ry="4.6" fill="#2b1b12" transform="rotate(-10 42 78)"/>' +
      '<ellipse cx="58" cy="78" rx="3" ry="4.6" fill="#2b1b12" transform="rotate(10 58 78)"/>',

    uvas:
      '<path d="M50 26c-2 7-2 11 0 15" stroke="#6d4c33" stroke-width="4" fill="none" stroke-linecap="round"/>' +
      '<path d="M52 27c9-11 22-10 28-4-10 9-21 10-28 4z" fill="#4caf50"/>' +
      '<circle cx="36" cy="52" r="9.5" fill="#7e57c2"/>' +
      '<circle cx="64" cy="52" r="9.5" fill="#7e57c2"/>' +
      '<circle cx="50" cy="48" r="9.5" fill="#9575cd"/>' +
      '<circle cx="29" cy="66" r="9.5" fill="#6a45b8"/>' +
      '<circle cx="43" cy="63" r="9.5" fill="#8a63cc"/>' +
      '<circle cx="57" cy="63" r="9.5" fill="#7e57c2"/>' +
      '<circle cx="71" cy="66" r="9.5" fill="#6a45b8"/>' +
      '<circle cx="36" cy="77" r="9.5" fill="#7e57c2"/>' +
      '<circle cx="50" cy="75" r="9.5" fill="#9575cd"/>' +
      '<circle cx="64" cy="77" r="9.5" fill="#7e57c2"/>' +
      '<circle cx="50" cy="87" r="8" fill="#6a45b8"/>' +
      '<ellipse cx="47" cy="45" rx="3.4" ry="2.4" fill="#d9c8f5" opacity=".75"/>',

    /* --------------------------- clásicos --------------------------- */

    campana:
      '<path d="M50 20c-16 0-25 12-25 29 0 14-4 19-8 25h66c-4-6-8-11-8-25 0-17-9-29-25-29z" fill="#e0a92b"/>' +
      '<path d="M50 24c-13 0-21 10-21 25 0 12-3 17-6 22h54c-3-5-6-10-6-22 0-15-8-25-21-25z" fill="#f5c451"/>' +
      '<circle cx="50" cy="16" r="5.5" fill="#c3941f"/>' +
      '<ellipse cx="50" cy="80" rx="8" ry="7" fill="#c3941f"/>' +
      '<path d="M37 38c2-8 6-12 11-14" stroke="#fff3c9" stroke-width="4.5" fill="none" stroke-linecap="round" opacity=".75"/>',

    siete:
      '<path d="M26 20h48v14L52 84H34l22-50H26z" fill="#c62333"/>' +
      '<path d="M29 23h42v10L49 81H39l22-50H29z" fill="#e8404f"/>' +
      '<path d="M33 25h30" stroke="#ff9aa2" stroke-width="3.5" stroke-linecap="round" opacity=".7"/>',

    bar:
      '<rect x="10" y="33" width="80" height="34" rx="7" fill="#14182b"/>' +
      '<rect x="13.5" y="36.5" width="73" height="27" rx="5" fill="none" stroke="#f5c451" stroke-width="3"/>' +
      '<text x="50" y="59" text-anchor="middle" font-size="25" font-weight="800" ' +
      'font-family="Georgia, \'Times New Roman\', serif" fill="#f5c451" letter-spacing="1.5">BAR</text>',

    /* --------------------------- especiales --------------------------- */

    comodin:
      '<path d="M50 10 88 50 50 90 12 50z" fill="#8a4ee0"/>' +
      '<path d="M50 17 81 50 50 83 19 50z" fill="#a870ff"/>' +
      '<text x="50" y="58" text-anchor="middle" font-size="19" font-weight="800" ' +
      'font-family="Verdana, Geneva, sans-serif" fill="#fff" letter-spacing="0.5">WILD</text>',

    estrella:
      '<path d="M50 14 59.4 39.1 86.1 40.3 65.2 56.9 72.3 82.7 50 68 27.7 82.7 34.8 56.9 13.9 40.3 40.6 39.1z" ' +
      'fill="#e0a92b"/>' +
      '<path d="M50 21 57.7 41.5 79.5 42.5 62.4 56.1 68.2 77.2 50 65.2 31.8 77.2 37.6 56.1 20.5 42.5 42.3 41.5z" ' +
      'fill="#f7d34e"/>' +
      '<path d="M50 27 55.5 42 70.5 42.8 58.6 52.2" stroke="#fff6d8" stroke-width="3" fill="none" ' +
      'stroke-linecap="round" opacity=".7"/>'
  };

  var SPRITE_ID = 'slot-sprite';

  /** Inyecta el sprite una sola vez en el documento. */
  function ensureSprite() {
    if (document.getElementById(SPRITE_ID)) return;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('id', SPRITE_ID);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    // Fuera de pantalla, sin ocupar sitio ni afectar al layout.
    svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');

    var markup = '';
    Object.keys(DEFS).forEach(function (id) {
      markup += '<symbol id="sym-' + id + '" viewBox="0 0 100 100">' + DEFS[id] + '</symbol>';
    });
    svg.innerHTML = markup;
    document.body.appendChild(svg);
  }

  /** Devuelve un <svg><use> listo para insertar en una celda. */
  function node(id, cls) {
    ensureSprite();
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'sym' + (cls ? ' ' + cls : ''));
    svg.setAttribute('viewBox', '0 0 100 100');
    svg.setAttribute('aria-hidden', 'true');
    var use = document.createElementNS(NS, 'use');
    // href moderno + xlink por compatibilidad con navegadores antiguos.
    use.setAttribute('href', '#sym-' + id);
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', '#sym-' + id);
    svg.appendChild(use);
    return svg;
  }

  root.Casino.slotSymbols = {
    ensureSprite: ensureSprite,
    node: node,
    ids: Object.keys(DEFS),
    has: function (id) { return Object.prototype.hasOwnProperty.call(DEFS, id); }
  };
})(typeof window !== 'undefined' ? window : globalThis);
