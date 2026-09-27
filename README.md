# 🎰 Casino Royale

Un casino completo en el navegador: **12 máquinas**, animaciones, niveles y
logros. Todo el dinero es **ficticio** — no hay pagos, compras ni cuentas.

Se abre haciendo doble clic en `index.html`. No hay que instalar ni compilar
nada: son HTML, CSS y JavaScript sin dependencias.

---

## Las 12 máquinas

| Máquina | RTP | En qué consiste |
|---|---|---|
| 🎰 **Tragaperras Royale** | 96,3% | 5 carretes, 10 líneas, palanca, comodines y giros gratis ×2 |
| 🎡 **Ruleta Europea** | 97,3% | Un solo cero. Pleno, docenas, columnas y apuestas sencillas |
| 🃏 **Blackjack** | 99,4% | 6 mazos, paga 3:2, doblar, separar hasta 4 manos y seguro |
| 🂡 **Video Póker** | 99,5% | Jacks or Better tabla 9/6, hasta 4.000× con 5 créditos |
| 🎴 **Punto y Banca** | 98,9% | Baccarat con las reglas oficiales de tercera carta |
| 🎲 **Dados** | 99,0% | Eliges el objetivo y el multiplicador se ajusta solo |
| 💎 **Minas** | 98,0% | Descubre gemas sin pisar una mina; cobra cuando quieras |
| 🚀 **Crash** | 99,0% | El multiplicador sube hasta estallar. Retírate a tiempo |
| 🔻 **Plinko** | 97,0% | 16 filas de clavos, tres niveles de riesgo, hasta 1.000× |
| 🔼 **Más o Menos** | 98,0% | Encadena aciertos de carta alta/baja |
| 🔢 **Keno** | 95,0% | Elige hasta 10 de 40; salen 10 |
| 🎟️ **Rasca y Gana** | 95,0% | Nueve casillas, tres iguales premian |

El **RTP** (retorno al jugador) de cada ficha no está puesto a ojo: sale de
calcularlo o simularlo con la lógica real del juego. `node tools/test.js` lo
comprueba en cada ejecución.

---

## Cómo se juega

- **Empiezas con 1.000 €** de fichas, que se guardan en el navegador.
- Si te quedas sin nada, la casa te presta 500 € para seguir.
- Hay **bonus diario** (hasta 1.750 € con 7 días de racha), **niveles** con
  recompensa y **22 logros**.
- Atajos: `L` vestíbulo · `S` estadísticas · `A` logros · `espacio` jugar.
- En Ajustes (⚙️) puedes apagar el sonido, las animaciones o el confeti, y
  activar el **modo rápido**.

---

## Cómo está hecho

```
index.html            Punto de entrada; carga todo en orden
css/
  base.css            Variables de diseño, reset, tipografía
  buttons.css         Botones y fichas
  layout.css          Estructura, barra superior, vestíbulo
  components.css      Toasts, modales, control de apuesta, tablas
  animations.css      Keyframes y respeto por "reducir movimiento"
  games/              Estilos de cada familia de juegos
js/core/
  util.js             Utilidades, RNG sembrable, animación, DOM
  store.js            Estado persistente (localStorage)
  bank.js             EL DINERO. Única fuente de verdad
  audio.js            Efectos de sonido sintetizados (sin ficheros)
  fx.js               Confeti, monedas, sacudidas, números flotantes
  ui.js               Botones, toasts, modales, control de apuesta
  progress.js         Nivel, experiencia, logros, bonus diario
  engine.js           Registro de máquinas y ciclo de vida
  router.js           Navegación por hash
js/games/             Las 12 máquinas
  deck.js               Baraja francesa y evaluadores de manos
  slot-symbols.js       Símbolos de la tragaperras, dibujados en SVG
js/app.js             Arranque, vestíbulo, estadísticas, ajustes
tools/                Pruebas y herramientas de cálculo
```

### El dinero, que es lo que importa

Ningún juego toca el saldo. Todo pasa por una **ronda** del banco:

```js
var round = Bank.openRound('slots', 2.50);  // cobra la apuesta YA
round.raise(2.50);                          // doblar, separar, seguro…
round.settle(7.50);                         // devuelve el total (0 = pierde)
```

Eso da cuatro garantías **por construcción**, no por disciplina:

1. La apuesta se cobra **una vez**, al abrir la ronda.
2. `settle()` sólo puede llamarse **una vez**; la segunda lanza error.
3. **No puede haber dos rondas abiertas** del mismo juego, así un doble clic
   nunca cobra dos veces.
4. El saldo **nunca queda negativo**: se valida antes de cobrar.

Además, toda la contabilidad va en **céntimos enteros**, así que no hay
deriva de coma flotante, y `Bank.audit()` comprueba el cuadre exacto:
`saldo == inicial − débitos + créditos`.

El saldo está topado en 10.000 millones de euros. No es un límite de juego
(con ventaja de la casa nadie se acerca): está para que los enteros sigan
siendo exactos, porque por encima de 2⁵³ las sumas empezarían a redondear y
el cuadre dejaría de ser fiable.

Salir de una máquina a mitad de ronda **devuelve la apuesta**.

### Que vaya fluido

- Los carretes, la ruleta y las cartas se animan con **transiciones CSS de
  `transform`**, que resuelve el compositor: cero trabajo de JavaScript por
  frame durante la jugada.
- Todas las partículas comparten **un solo bucle `requestAnimationFrame`**
  que se detiene cuando no hay nada que dibujar.
- Cada acción pasa por `ctx.guard()`, que **impide la reentrada** y suelta
  el bloqueo siempre, incluso si algo falla.
- El resultado de cada jugada se decide **antes** de animarla, así lo que se
  ve siempre coincide con lo que se cobra.
- Se respeta `prefers-reduced-motion` y hay un interruptor en Ajustes.

---

## Pruebas

```bash
node tools/test.js            # 179 comprobaciones, sin dependencias
node tools/stress.js          # 50.000 rondas agresivas contra el banco
node tools/check-css.js       # revisa los estilos
node tools/sim-slots.js       # RTP de las tragaperras (millones de giros)
node tools/sim-crash.js       # RTP de Crash con distintos objetivos
node tools/solve-keno.js      # recalcula la tabla de pagos de Keno
node tools/solve-plinko.js    # recalcula las tablas de Plinko

npm install playwright        # sólo para la prueba de navegador
node tools/browser-test.js    # juega de verdad en Chromium (52 comprobaciones)
```

**`tools/test.js`** comprueba las matemáticas de las 12 máquinas, los
invariantes del dinero y que **todas las máquinas se montan sin errores**.
Para eso monta cada juego contra un DOM pequeño pero real
(`tools/lib/fake-dom.js`) en lugar de nodos falsos: con nodos falsos un
error dentro del `create()` de Plinko se colaba sin que nadie lo viera.

**`tools/stress.js`** juega decenas de miles de rondas por todas las
máquinas —con subidas de apuesta, apuestas a todo el saldo y rachas de
ruina— y comprueba el cuadre **después de cada ronda**, no sólo al final.

**`tools/browser-test.js`** va más allá: juega una ronda completa en cada
máquina en un Chromium de verdad, verifica que diez tirones de palanca
seguidos producen **una sola** apuesta, que salir a mitad de ronda devuelve
el dinero, y que ninguna pantalla se desborda en móvil, tableta ni
escritorio. También vigila el aspecto de la tragaperras: que en los
carretes no quede ni un carácter de texto (si aparece, es que se han
colado emoji otra vez), que ningún símbolo sea una carta y que la máquina
no se estire por toda la pantalla.

---

## Detalles que quizá te preguntes

**¿Por qué no hay fuentes ni imágenes externas?** La página no hace ni una
sola petición de red. Antes cargaba una fuente de Google y, al abrir el
fichero sin conexión, fallaba y llenaba la consola de errores.

**¿Por qué los símbolos están dibujados y no son emoji?** Porque los emoji
los pinta cada sistema operativo a su manera: 🃏 salía como una carta de la
baraja y 7️⃣ como una tecla azul, cosas que no pintan nada en una máquina de
frutas. Dibujados en SVG se ven igual en todas partes y son nítidos a
cualquier tamaño.

## Aviso

Proyecto de entretenimiento con dinero ficticio. El juego real con dinero
puede generar adicción; si te preocupa, busca ayuda profesional.
