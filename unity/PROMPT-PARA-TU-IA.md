# Prompt para la IA que trabaja en mi ordenador

Copia todo lo que hay debajo de la línea y pégaselo a la IA que tenga abierto
tu proyecto de Unity (Claude Code instalado en tu PC, Cursor, etc.).

---

Tengo un casino hecho como web (HTML/CSS/JS) y su lógica **ya portada a C# y
verificada**. Quiero llevarlo a mi proyecto de Unity, que tienes abierto.

## PASO 0 — Trae el código

Todo está en un repositorio público. Clónalo en una carpeta temporal:

```bash
git clone --branch claude/bold-hypatia-ebjafg \
  https://github.com/yeriicc20-commits/CASINO.git casino-web
```

Esa rama es la que lo tiene **todo**. Si ya tengo el repo descargado en el
escritorio, úsalo y sáltate el clone.

Para ver cómo debe quedar: abre `index.html` de ese repo en el navegador. Es
el juego real funcionando. Esa es la referencia visual, no te la imagines.

## PASO 1 — Trae la lógica (ya está hecha, NO la reescribas)

Copia la carpeta `unity/Assets/Casino/` dentro del `Assets/` de mi proyecto.

Contiene:

- `Scripts/Core/Money.cs` — dinero en céntimos enteros, formato español
- `Scripts/Core/Rng.cs` — generador Mulberry32, el mismo que la web
- `Scripts/Core/Bank.cs` — el sistema de dinero
- `Scripts/Games/Deck.cs` — baraja, zapato y evaluadores de manos
- `Scripts/Games/*.cs` — **las 12 máquinas** con sus tablas de pagos
- `Art/Symbols/*.png` — **los 10 símbolos ya dibujados**, 512×512 con alfa
- `Tests/` — 67 tests (147 aserciones) contra la versión web
- Los tres `.asmdef`

**NO toques los ficheros de `Scripts/` ni de `Tests/`.** Las tablas de pagos
están calculadas y medidas con millones de simulaciones. Si cambias un
número, rompes el equilibrio del juego.

## PASO 2 — Ejecuta los tests antes de nada

`Window > General > Test Runner > EditMode > Run All`

**Deben pasar 67 tests**, no 147. (147 es el número de aserciones; el Test
Runner cuenta tests: 57 `[Test]` + 10 `[TestCase]` = 67.) Si falla alguno, la
copia ha ido mal: no sigas.

Si no aparece el Test Runner: `Window > Package Manager > Unity Registry >
Test Framework`.

Dos cosas ya comprobadas, para que no las investigues:

- El port **compila limpio y pasa los 67** — se verificó fuera de Unity con
  `dotnet test tools/verify-csharp/Casino.Verify.csproj`, que está en el
  mismo repo y no necesita el editor.
- `Bank.cs` llama a `UnityEngine.Debug.LogWarning` al topar el saldo. Dentro
  de Unity compila sin más. (Fuera hace falta un sustituto, por eso el arnés
  lleva uno; no es asunto tuyo.)

## PASO 3 — La regla del dinero (lo más importante)

Ningún juego toca el saldo directamente. Todo pasa por una ronda:

```csharp
var round = bank.OpenRound("slots", 5m);  // cobra la apuesta YA
round.Raise(5m);                          // doblar, separar, seguro
round.Settle(12.50m);                     // devuelve el TOTAL (0 = pierde)
```

Eso garantiza que la apuesta se cobra una vez, que `Settle()` sólo se puede
llamar una vez, que no hay dos rondas abiertas del mismo juego (un doble clic
no cobra dos veces) y que el saldo nunca queda negativo.

**NUNCA sumes ni restes saldo a mano.** Si te ves escribiendo `balance +=
algo`, lo estás haciendo mal.

## PASO 4 — Los símbolos ya están dibujados

En `Art/Symbols/`: cereza, limon, naranja, sandia, uvas, campana, siete, bar,
comodin, estrella. Son PNG de 512×512 con transparencia, sacados de los
mismos dibujos SVG de la web.

Selecciona los diez y ponlos como **Sprite (2D and UI)**, Pivot `Center`,
**Alpha Is Transparency** activado, Filter `Bilinear`, Compression `High
Quality`.

**No uses emoji ni cartas de baraja.** Ya se probó: el sistema operativo
dibujaba el comodín como una carta y el siete como una tecla azul.

## PASO 5 — Construye la interfaz (esto es tu trabajo)

Es lo único que falta. **Mira primero cómo está montado mi proyecto** (uGUI o
UI Toolkit, qué escenas hay, qué convenciones uso) y **sigue lo que ya
tenga**. No impongas una estructura nueva.

Colores (están en `css/base.css` del repo):

| | |
|---|---|
| fondo | `#0b0d18` |
| panel | `#171b2e` |
| oro (acento) | `#f5c451` (claro `#ffe08f`, oscuro `#c3941f`) |
| verde (ganar) | `#35d295` |
| rojo (perder) | `#ff6b7e` |
| tapete verde | `#0e4f3a` |
| texto | `#f2f4ff` (secundario `#b9c0dd`, apagado `#7d86a8`) |

Pantallas necesarias:

- Vestíbulo con las 12 máquinas en tarjetas
- Una pantalla por máquina
- Saldo siempre visible arriba
- Estadísticas y logros

## La tragaperras (es la que más me importa)

- Símbolos: los sprites de `Art/Symbols/`. Nunca cartas ni emoji.
- Se acciona con una **PALANCA** que baja y vuelve con rebote, no con un
  botón de girar. Debe poder arrastrarse hacia abajo.
- Cuatro botones: **Pagos**, **Rápido**, **Auto**, **Máx**
- Apuesta mínima 5 €, máxima 500 €
- Tres marcadores: **Apuesta**, **Ganancia**, **Crédito**
- La máquina **NO debe ocupar toda la pantalla**: es un mueble estrecho (en
  la web está limitada a 660 px de ancho y centrada)
- 5 carretes × 3 filas, 10 líneas de pago
- El cartel de premio sólo aparece con premios grandes (**5× o más**): si
  sale en cada tirada, tapa los símbolos que acaban de ganar

## Cómo animar sin que dé tirones

- El resultado se decide **antes** de animar. La animación sólo lo muestra.
  Nunca decidas el resultado a mitad de la animación.
- Bloquea la entrada mientras dura una jugada y libérala **siempre**, incluso
  si algo falla (`try/finally`).
- Los carretes: una sola animación por carrete, escalonados.

## Cómo quiero que trabajes

1. Primero la tragaperras completa y funcionando.
2. Enséñamela antes de pasar a la siguiente máquina.
3. Después el resto, una a una.
4. Tras cada máquina, escribe tests como los de `Tests/` que comprueben que
   el dinero cuadra.
5. Si algo no te cuadra con el original, **pregúntame** en vez de inventarte
   el número.

## Lo que no debes hacer

- No toques `Scripts/` ni `Tests/`
- No cambies ni una cifra de las tablas de pagos
- No modifiques el saldo directamente
- No uses emoji ni cartas como símbolos
- No hagas la tragaperras a pantalla completa
