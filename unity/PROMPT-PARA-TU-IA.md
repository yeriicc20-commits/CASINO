# Prompt para la IA que trabaja en tu proyecto de Unity

Copia el bloque de abajo y pégaselo a la IA que tenga acceso a tu proyecto de
Unity en local (Claude Code en tu ordenador, Cursor, Copilot…).

Está escrito para que **no reinvente nada**: el port de la lógica ya está
hecho y verificado en este repositorio, así que su trabajo es traerlo y
construir la interfaz encima, no volver a calcular las matemáticas.

---

## ⬇️ COPIA DESDE AQUÍ ⬇️

Tengo un casino hecho como web (HTML/CSS/JS) en este repositorio público:

    https://github.com/yeriicc20-commits/CASINO
    rama: claude/wonderful-maxwell-21ei7q

Quiero llevarlo a mi proyecto de Unity, que está sólo en mi ordenador.

**Primer paso — trae lo que ya está portado.** En ese repo hay una carpeta
`unity/Assets/Casino/` con TODA la lógica ya pasada a C# y verificada:

- `Scripts/Core/Money.cs` — dinero en céntimos enteros y formato español
- `Scripts/Core/Rng.cs` — generador Mulberry32 (mismo algoritmo que la web)
- `Scripts/Core/Bank.cs` — el sistema de dinero con rondas atómicas
- `Scripts/Games/Deck.cs` — baraja, zapato y evaluadores de manos
- `Scripts/Games/*.cs` — **las 12 máquinas**, con sus tablas y su RTP
- `Tests/` — 147 comprobaciones contra la versión web
- Los tres `.asmdef` para que compile aislado

Clónalo o descárgalo y **copia `unity/Assets/Casino/` dentro de mi
`Assets/`**. No reescribas esos ficheros: ya están comprobados.

**Segundo paso — ejecuta los tests antes de tocar nada.**
`Window > General > Test Runner > EditMode > Run All`. Deben pasar los 147.
Comparan el C# contra números sacados del JavaScript original, así que si
algo falla es que la copia ha ido mal. No sigas hasta que estén en verde.

**Tercer paso — lee cómo funciona el dinero.** Está en `Bank.cs` y es lo
más importante del proyecto. Ningún juego toca el saldo: todo pasa por una
ronda.

```csharp
var round = bank.OpenRound("slots", 5m);   // cobra la apuesta YA
round.Raise(5m);                           // doblar, separar, seguro…
round.Settle(12.50m);                      // devuelve el TOTAL (0 = pierde)
```

Eso garantiza, por construcción: la apuesta se cobra una vez, `Settle()`
sólo puede llamarse una vez, no puede haber dos rondas abiertas del mismo
juego (un doble clic no cobra dos veces) y el saldo nunca queda negativo.
**Respeta ese patrón en todo lo que añadas.** No sumes ni restes saldo a
mano en ningún sitio.

**Cuarto paso — la interfaz, que es lo que falta.** La lógica de las doce
máquinas YA está portada y testeada. No la reescribas ni «mejores» sus
números: las tablas de pagos están resueltas y medidas, no puestas a ojo.

Lo que tienes que construir es la capa visual encima, llamando a esas clases. El diseño visual está en `css/` del repo. Si
mi proyecto usa **UI Toolkit**, el CSS se traduce a USS con bastante
parecido (mismas propiedades de flexbox, colores y transiciones). Si usa
**uGUI**, hay que rehacerlo con Canvas y componentes. Mírate cómo está
montado mi proyecto y sigue la convención que ya tenga, no impongas otra.

Detalles de la tragaperras que quiero conservar:
- Símbolos de fruta, **nunca cartas de baraja ni emoji** (en la web están
  dibujados en `js/games/slot-symbols.js`; en Unity usa sprites o SVG)
- Se acciona con una **palanca** que baja y vuelve, no con un botón
- Cuatro botones: **Pagos, Rápido, Auto, Máx**
- Apuesta mínima **5 €**, máxima **500 €**
- La máquina **no debe ocupar toda la pantalla**: es un mueble estrecho

**Cómo quiero que trabajes:** ve juego por juego, y después de cada uno
escribe tests como los de `CasinoGoldenTests.cs` que comprueben el RTP y los
pagos. Enséñame cada máquina funcionando antes de pasar a la siguiente. Si
algo del port no te cuadra con el original, **pregúntame en lugar de
inventarte el número**.

## ⬆️ COPIA HASTA AQUÍ ⬆️

---

## Si prefieres que lo siga haciendo yo

También puedo seguir portando el resto aquí mismo, en este repositorio, y tú
sólo copias la carpeta `unity/Assets/Casino/` cada vez. La pega es que **no
veo tu proyecto**: no sé tu versión de Unity, ni si usas uGUI o UI Toolkit,
ni qué hay ya montado. Con la lógica da igual (es C# puro y entra en
cualquier proyecto), pero para la interfaz iría a ciegas.

Lo más práctico sería que subieras tu proyecto de Unity a un repositorio —
aunque sea privado — y me des acceso. Entonces trabajo dentro de él y te
dejo los cambios listos, igual que he hecho con la web.
