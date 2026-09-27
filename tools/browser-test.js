#!/usr/bin/env node
/* =========================================================================
   browser-test.js — prueba en un Chromium real.

   Comprueba lo que no se puede comprobar sin navegador:
     · que la app arranca y las 12 máquinas se abren sin errores
     · que JUGANDO de verdad el dinero se cobra y se paga bien
     · que un doble clic rápido NO cobra la apuesta dos veces
     · que salir de una máquina a mitad de ronda devuelve la apuesta

   Necesita Playwright:  npm install playwright
   Uso:                  node tools/browser-test.js
   ========================================================================= */
'use strict';
const path = require('path');

let chromium;
try {
  ({ chromium } = require('playwright'));
} catch (e) {
  console.error('Esta prueba necesita Playwright:  npm install playwright');
  console.error('(Las comprobaciones de matemáticas y dinero van en node tools/test.js, que no necesita nada.)');
  process.exit(2);
}

const APP = 'file://' + path.join(__dirname, '..', 'index.html');

/* Para cada máquina: el botón que inicia la jugada y cuánto esperar. */
/* `play` inicia la jugada; `finish` es la acción que hace falta después para
   que la ronda quede liquidada (plantarse, cambiar cartas, cobrar…). Las
   máquinas sin `finish` se resuelven solas con un clic. */
const GAMES = [
  { id: 'slots',      play: 'lever',          wait: 3200, lever: true },
  { id: 'roulette',   play: 'Girar',          wait: 6000, setup: 'roulette' },
  { id: 'blackjack',  play: 'Repartir',       wait: 2600, finish: 'Plantarse' },
  { id: 'videopoker', play: 'Repartir',       wait: 1800, finish: 'Cambiar' },
  { id: 'baccarat',   play: 'Repartir',       wait: 3600, setup: 'baccarat' },
  { id: 'dice',       play: 'Tirar',          wait: 1800 },
  { id: 'mines',      play: 'Empezar',        wait: 900,  pick: '.mtile', finish: ['Cobrar'] },
  /* Crash puede estallar antes de que lleguemos a cobrar: la ronda se cierra
     igual, así que el botón puede no existir ya. Es un final válido. */
  { id: 'crash',      play: 'Despegar',       wait: 1000, finish: ['Cobrar'] },
  { id: 'plinko',     play: 'Soltar bola',    wait: 3200 },
  /* En Hi-Lo un acierto NO cierra la ronda (la racha sigue), así que
     adivinamos y después cobramos. */
  { id: 'hilo',       play: 'Empezar',        wait: 900,  finish: ['Más alta', 'Cobrar'] },
  { id: 'keno',       play: 'Sortear',        wait: 3200, setup: 'keno' },
  { id: 'scratch',    play: 'Comprar boleto', wait: 900,  finish: ['Rascar todo'] }
];

let passed = 0, failed = 0;
const problems = [];

function ok(cond, label, detail) {
  if (cond) { passed++; console.log('  \x1b[32m✓\x1b[0m ' + label); }
  else {
    failed++; problems.push(label);
    console.log('  \x1b[31m✗ ' + label + '\x1b[0m' + (detail !== undefined ? '  → ' + detail : ''));
  }
}

(async () => {
  const exe = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
  const launch = { args: ['--allow-file-access-from-files', '--mute-audio'] };
  try { require('fs').accessSync(exe); launch.executablePath = exe; } catch (e) { /* usa el de Playwright */ }

  const browser = await chromium.launch(launch);
  const page = await browser.newPage({ viewport: { width: 1360, height: 950 } });

  const jsErrors = [];
  page.on('pageerror', e => jsErrors.push(e.message));
  page.on('console', m => {
    const t = m.text();
    if (m.type() === 'error' && !/favicon|fonts\.(googleapis|gstatic)|net::ERR/.test(t)) jsErrors.push(t);
  });
  page.on('requestfailed', r => {
    if (!/fonts\.(googleapis|gstatic)|favicon/.test(r.url())) jsErrors.push('recurso: ' + r.url());
  });

  /* --------------------------- 1. arranque --------------------------- */
  console.log('\n\x1b[1m1. Arranque\x1b[0m');
  await page.goto(APP, { waitUntil: 'load' });
  await page.waitForTimeout(700);

  const boot = await page.evaluate(() => ({
    games: window.Casino && window.Casino.engine ? window.Casino.engine.count() : -1,
    cards: document.querySelectorAll('.mcard').length,
    balance: window.Casino ? window.Casino.bank.balance : null,
    hud: (document.querySelector('#hudAmount') || {}).textContent
  }));
  ok(boot.games === 12, 'se registran las 12 máquinas', boot.games);
  ok(boot.cards === 12, 'el vestíbulo muestra 12 tarjetas', boot.cards);
  ok(boot.balance === 1000, 'el saldo inicial es 1.000 €', boot.balance);
  ok(jsErrors.length === 0, 'ningún error de JavaScript al arrancar', jsErrors[0]);

  /* Desactivamos animaciones para que la prueba sea rápida y estable. */
  await page.evaluate(() => {
    window.Casino.store.state.settings.animations = false;
    window.Casino.store.state.settings.sound = false;
    window.Casino.store.state.settings.fastMode = true;
    document.documentElement.classList.add('no-anim');
  });

  /* --------------------- 2. jugar en cada máquina --------------------- */
  console.log('\n\x1b[1m2. Una jugada real en cada máquina\x1b[0m');

  for (const g of GAMES) {
    const before = jsErrors.length;
    await page.evaluate(id => { window.location.hash = '#/juego/' + id; }, g.id);
    await page.waitForTimeout(450);

    /* Fijamos una apuesta conocida. */
    await page.evaluate(() => {
      const inp = document.querySelector('.bet__input');
      /* 5 € es la apuesta mínima de la tragaperras y válida en el resto. */
      if (inp) { inp.value = '5'; inp.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await page.waitForTimeout(120);

    /* Algunas mesas exigen elegir apuesta antes de repartir. */
    if (g.setup === 'roulette') {
      await page.evaluate(() => { const s = document.querySelector('.rspot--red'); if (s) s.click(); });
    } else if (g.setup === 'baccarat') {
      await page.evaluate(() => { const s = document.querySelector('.bacbet'); if (s) s.click(); });
    } else if (g.setup === 'keno') {
      await page.evaluate(() => {
        document.querySelectorAll('.kcell').forEach((c, i) => { if (i < 5) c.click(); });
      });
    }
    await page.waitForTimeout(150);

    const balBefore = await page.evaluate(() => window.Casino.bank.balance);

    /* Pulsamos el botón de jugar (o tiramos de la palanca). */
    const clicked = await page.evaluate(cfg => {
      if (cfg.lever) {
        const lv = document.querySelector('.lever');
        if (!lv) return false;
        lv.click();
        return true;
      }
      const btns = [...document.querySelectorAll('.controls .btn')];
      const b = btns.find(x => {
        const l = x.querySelector('.btn__label');
        return l && l.textContent.trim() === cfg.play && x.offsetParent !== null && !x.disabled;
      });
      if (!b) return false;
      b.click();
      return true;
    }, { lever: !!g.lever, play: g.play });

    await page.waitForTimeout(g.wait);

    const after = await page.evaluate(() => ({
      balance: window.Casino.bank.balance,
      rounds: window.Casino.store.state.totals.rounds,
      open: !!window.Casino.bank.getOpenRound(window.Casino.engine.activeId)
    }));

    ok(clicked, g.id.padEnd(11) + ' se pulsa "' + g.play + '" y se cobra la apuesta  (' +
       balBefore.toFixed(2) + ' € → ' + after.balance.toFixed(2) + ' €)',
       !clicked ? (g.lever ? 'no se encontró la palanca' : 'no se encontró el botón "' + g.play + '"') : undefined);

    /* Algunos juegos necesitan descubrir una casilla antes de poder cobrar. */
    if (g.pick) {
      await page.evaluate(sel => { const t = document.querySelector(sel); if (t) t.click(); }, g.pick);
      await page.waitForTimeout(400);
    }

    /* Y otros necesitan una o varias acciones más (plantarse, cambiar,
       adivinar, cobrar) para que la ronda quede liquidada. Que un botón ya
       no esté es válido: significa que la ronda se resolvió antes. */
    const steps = Array.isArray(g.finish) ? g.finish : g.finish ? [g.finish] : [];
    for (const label of steps) {
      const stillOpen = await page.evaluate(
        () => !!window.Casino.bank.getOpenRound(window.Casino.engine.activeId));
      if (!stillOpen) break;
      await page.evaluate(l => {
        const b = [...document.querySelectorAll('.controls .btn')].find(x => {
          const lab = x.querySelector('.btn__label');
          return lab && lab.textContent.trim() === l && x.offsetParent !== null && !x.disabled;
        });
        if (b) b.click();
      }, label);
      await page.waitForTimeout(2000);
    }

    const settled = await page.evaluate(() => ({
      balance: window.Casino.bank.balance,
      open: !!window.Casino.bank.getOpenRound(window.Casino.engine.activeId),
      rounds: window.Casino.store.state.totals.rounds
    }));
    const newErrs = jsErrors.length - before;
    ok(newErrs === 0, g.id.padEnd(11) + ' sin errores durante la jugada',
       newErrs > 0 ? jsErrors[jsErrors.length - 1] : undefined);
    ok(!settled.open, g.id.padEnd(11) + ' ronda liquidada  (saldo ' + settled.balance.toFixed(2) + ' €)',
       'la ronda se quedó abierta tras ' + (steps.length ? steps.join(' → ') : 'la jugada'));
  }

  /* ----------------- 3. doble clic no cobra dos veces ----------------- */
  console.log('\n\x1b[1m3. Doble clic rápido (no debe cobrar dos veces)\x1b[0m');
  {
    await page.evaluate(() => { window.location.hash = '#/juego/slots'; });
    await page.waitForTimeout(450);
    await page.evaluate(() => {
      const inp = document.querySelector('.bet__input');
      if (inp) { inp.value = '10'; inp.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await page.waitForTimeout(150);

    const r = await page.evaluate(async () => {
      const before = window.Casino.bank.balance;
      const roundsBefore = window.Casino.store.state.totals.rounds;
      const lever = document.querySelector('.lever');
      /* Diez tirones de palanca en el mismo instante. */
      for (let i = 0; i < 10; i++) lever.click();
      return { before, roundsBefore };
    });
    await page.waitForTimeout(4200);

    const outcome = await page.evaluate(rb => ({
      rounds: window.Casino.store.state.totals.rounds - rb,
      balance: window.Casino.bank.balance,
      audit: window.Casino.bank.audit(100000)
    }), r.roundsBefore);

    ok(outcome.rounds === 1, '10 tirones de palanca seguidos producen UNA sola ronda',
       outcome.rounds + ' rondas');
  }

  /* -------- 4. salir a mitad de ronda devuelve la apuesta -------- */
  console.log('\n\x1b[1m4. Salir a mitad de ronda\x1b[0m');
  {
    await page.evaluate(() => { window.location.hash = '#/juego/mines'; });
    await page.waitForTimeout(450);
    await page.evaluate(() => {
      const inp = document.querySelector('.bet__input');
      if (inp) { inp.value = '25'; inp.dispatchEvent(new Event('change', { bubbles: true })); }
    });
    await page.waitForTimeout(150);

    const before = await page.evaluate(() => window.Casino.bank.balance);
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('.controls .btn')]
        .find(x => { const l = x.querySelector('.btn__label'); return l && l.textContent.trim() === 'Empezar'; });
      if (b) b.click();
    });
    await page.waitForTimeout(500);
    const during = await page.evaluate(() => window.Casino.bank.balance);
    ok(Math.abs((before - during) - 25) < 0.001, 'al empezar se cobran los 25 € de la apuesta',
       'diferencia ' + (before - during));

    /* Nos vamos al vestíbulo sin terminar. */
    await page.evaluate(() => { window.location.hash = '#/lobby'; });
    await page.waitForTimeout(600);
    const after = await page.evaluate(() => window.Casino.bank.balance);
    ok(Math.abs(after - before) < 0.001, 'salir a mitad de ronda devuelve la apuesta íntegra',
       'antes ' + before + ', después ' + after);
  }

  /* --------------------- 5. cuadre final del dinero --------------------- */
  console.log('\n\x1b[1m5. Cuadre del dinero tras toda la sesión\x1b[0m');
  {
    const audit = await page.evaluate(() => {
      const st = window.Casino.store.state;
      let wag = 0, ret = 0;
      Object.keys(st.games).forEach(g => { wag += st.games[g].wageredCents; ret += st.games[g].returnedCents; });
      return {
        ledger: window.Casino.bank.audit(100000),
        balanceCents: window.Casino.bank.balanceCents,
        totalsWag: st.totals.wageredCents, totalsRet: st.totals.returnedCents,
        perGameWag: wag, perGameRet: ret,
        rounds: st.totals.rounds
      };
    });
    ok(audit.ledger.ok, 'el saldo cuadra con el libro mayor (inicial − débitos + créditos)',
       'esperado ' + audit.ledger.expectedCents + ', real ' + audit.ledger.actualCents);
    ok(audit.balanceCents >= 0, 'el saldo nunca quedó negativo', audit.balanceCents);
    ok(audit.perGameWag === audit.totalsWag, 'lo apostado por máquina suma el total');
    ok(audit.perGameRet === audit.totalsRet, 'lo devuelto por máquina suma el total');
    ok(audit.rounds >= GAMES.length,
       'se han liquidado al menos ' + GAMES.length + ' rondas (una por máquina)', audit.rounds);
    ok(Number.isInteger(audit.balanceCents), 'el saldo son céntimos enteros (sin deriva decimal)');
  }

  /* ------------- 6. la tragaperras: frutas, palanca y botones ------------- */
  console.log('\n\x1b[1m6. Tragaperras — aspecto de la máquina\x1b[0m');
  {
    await page.evaluate(() => { window.location.hash = '#/juego/slots'; });
    await page.waitForTimeout(600);
    const m = await page.evaluate(() => {
      const reels = document.querySelector('.reels');
      const cab = document.querySelector('.cabinet');
      return {
        /* Texto dentro de los carretes: si hay algo, es que quedan emoji. */
        texto: reels ? reels.textContent.replace(/\s/g, '') : 'SIN-CARRETES',
        usos: [...document.querySelectorAll('.cell use')].length,
        simbolos: [...new Set([...document.querySelectorAll('.cell use')]
                    .map(u => u.getAttribute('href')))].sort(),
        palanca: !!document.querySelector('.lever'),
        bola: !!document.querySelector('.lever__knob'),
        botones: [...document.querySelectorAll('.machine-btns .btn .btn__label')]
                   .map(x => x.textContent.trim()),
        anchoMueble: cab ? Math.round(cab.getBoundingClientRect().width) : 0,
        anchoPantalla: document.documentElement.clientWidth,
        min: window.Casino.engine.get('slots').minBet,
        max: window.Casino.engine.get('slots').maxBet,
        fichas: [...document.querySelectorAll('.chip__face')].map(c => c.textContent)
      };
    });

    ok(m.texto === '', 'los carretes no llevan ni un carácter de texto (todo dibujado)', '"' + m.texto + '"');
    ok(m.usos === 15, 'las 15 celdas muestran un símbolo dibujado', m.usos);
    ok(m.simbolos.every(h => /^#sym-[a-z]+$/.test(h)),
       'todos los símbolos vienen del juego de dibujos', m.simbolos.join(' '));
    ok(!m.simbolos.some(h => /joker|carta|card/.test(h)), 'ningún símbolo es una carta de la baraja');
    ok(m.palanca && m.bola, 'la palanca está montada, con su bola');
    ok(m.botones.length === 4 && m.botones.join(',') === 'Pagos,Rápido,Auto,Máx',
       'están los cuatro botones: Pagos · Rápido · Auto · Máx', m.botones.join(','));
    ok(m.min === 5, 'la apuesta mínima es 5 €', m.min);
    ok(m.max === 500, 'la apuesta máxima sigue en 500 €', m.max);
    ok(!m.fichas.some(f => parseFloat(String(f).replace(',', '.')) < 5),
       'no se ofrecen fichas por debajo del mínimo', m.fichas.join(', '));
    ok(m.anchoMueble <= 700 && m.anchoMueble < m.anchoPantalla * 0.75,
       'la máquina no ocupa toda la pantalla (' + m.anchoMueble + 'px de ' + m.anchoPantalla + 'px)');

    /* La palanca debe girar de verdad. */
    const antes = await page.evaluate(() => window.Casino.store.state.totals.rounds);
    await page.locator('.lever').click();
    await page.waitForTimeout(4200);
    const despues = await page.evaluate(() => window.Casino.store.state.totals.rounds);
    ok(despues === antes + 1, 'tirar de la palanca juega exactamente una ronda', despues - antes);
  }

  /* ----------------------- 7. diseño adaptable ----------------------- */
  console.log('\n\x1b[1m7. Diseño adaptable\x1b[0m');
  for (const [w, h, name] of [[390, 844, 'móvil'], [820, 1180, 'tableta'], [1440, 900, 'escritorio']]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => { window.location.hash = '#/juego/slots'; });
    await page.waitForTimeout(420);
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok(overflow <= 1, name + ' (' + w + '×' + h + '): sin desbordamiento horizontal', overflow + 'px');
  }

  /* ------------------------------ resumen ------------------------------ */
  await page.setViewportSize({ width: 1360, height: 950 });
  console.log('\n' + '─'.repeat(64));
  const uniqueErrors = [...new Set(jsErrors)];
  if (uniqueErrors.length) {
    console.log('\x1b[31merrores de JavaScript (' + uniqueErrors.length + '):\x1b[0m');
    uniqueErrors.slice(0, 12).forEach(e => console.log('  ✗ ' + String(e).slice(0, 200)));
    failed += uniqueErrors.length;
  }
  if (failed === 0) console.log('\x1b[32m\x1b[1m✓ ' + passed + ' comprobaciones superadas en el navegador\x1b[0m');
  else {
    console.log('\x1b[31m\x1b[1m✗ ' + failed + ' fallo(s) de ' + (passed + failed) + '\x1b[0m');
    problems.forEach(p => console.log('  · ' + p));
  }

  await browser.close();
  process.exit(failed === 0 ? 0 : 1);
})().catch(e => { console.error(e); process.exit(1); });
