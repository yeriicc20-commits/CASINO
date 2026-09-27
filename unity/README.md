# Casino Royale — port a Unity

Esta carpeta contiene el casino portado a C# para Unity. **No es la web**: la
versión web vive en la raíz del repositorio y sigue funcionando por su cuenta.

## Qué hay hecho

### Núcleo

| Parte | Estado |
|---|---|
| `Core/Money.cs` — céntimos enteros, formato es-ES | ✅ |
| `Core/Rng.cs` — Mulberry32, idéntico a la web | ✅ |
| `Core/Bank.cs` — rondas atómicas, libro mayor, auditoría | ✅ |
| `Games/Deck.cs` — baraja, zapato y evaluadores de manos | ✅ |

### Las 12 máquinas (lógica y matemáticas)

| Máquina | Fichero | RTP |
|---|---|---|
| Tragaperras | `SlotsLogic.cs` | 96,3% |
| Ruleta europea | `RouletteLogic.cs` | 97,3% |
| Blackjack | `BlackjackLogic.cs` | 99,4% |
| Video póker 9/6 | `VideoPokerLogic.cs` | 99,5% |
| Punto y banca | `BaccaratLogic.cs` | 98,9% |
| Dados | `DiceLogic.cs` | 99,0% |
| Minas | `MinesLogic.cs` | 98,0% |
| Crash | `CrashLogic.cs` | 99,0% |
| Plinko | `PlinkoLogic.cs` | 97,0% |
| Más o menos | `HiLoLogic.cs` | 98,0% |
| Keno | `KenoLogic.cs` | 95,0% |
| Rasca y gana | `ScratchLogic.cs` | 95,0% |

### Lo que falta

| Parte | Estado |
|---|---|
| Interfaz (UI Toolkit / uGUI) | ⏳ pendiente |
| Escenas y prefabs | ⏳ pendiente |

La lógica no depende de Unity: son clases estáticas con funciones puras, sin
`MonoBehaviour` ni referencias a escenas. Entra en cualquier proyecto y se
puede testear sin abrir el editor.

## Cómo instalarlo

1. Copia la carpeta `Assets/Casino` dentro del `Assets/` de tu proyecto.
2. Abre Unity y deja que compile.
3. `Window > General > Test Runner > EditMode > Run All`.

Deben pasar los **67** tests. Si alguno falla, la copia ha ido mal: no sigas.

(El Test Runner cuenta tests, no aserciones: son 57 `[Test]` más 10
`[TestCase]` = 67 entradas, con 147 aserciones dentro.)

Requiere el paquete **Test Framework** (viene de serie en Unity 2019+).

## Por qué hay tests "dorados"

El entorno donde se escribió este port no tenía compilador de C#, así que no
se pudo compilar ni ejecutar entonces. **Ya sí**: con el SDK de .NET
instalado, el port compila y los 67 tests pasan fuera de Unity (ver más
abajo). Aun así los vectores dorados siguen siendo la garantía de fondo. Para no entregar código sin comprobar, la
verificación se hizo al revés: se ejecutó el **JavaScript original** —que sí
está verificado con millones de simulaciones— con semillas fijas, y se
volcaron los resultados exactos a `Tests/GoldenVectors.cs`.

Los tests comparan el C# contra esos números: la secuencia del generador,
tiras enteras de 64 posiciones, barajas sembradas carta a carta, las 37
casillas de la ruleta, manos concretas de blackjack y de póker, doce manos
seguidas de baccarat, las probabilidades de keno y de plinko, la secuencia de
estallidos de crash y cincuenta mil boletos de rasca. Si el port se desviara
en algo, el test falla nada más abrir el proyecto.

Además, `node tools/check-csharp.js` compara las tablas de pagos del C# con
las del JavaScript directamente en el texto de los ficheros: 367 números
—pesos de la tragaperras, orden de la rueda, tablas de keno, video póker,
plinko y rasca— tienen que ser idénticos.

## Probarlo sin abrir Unity

El port es C# puro: no hereda de `MonoBehaviour` ni usa el motor, así que se
compila y se prueba con el SDK de .NET, sin editor y sin licencia.

```bash
dotnet test tools/verify-csharp/Casino.Verify.csproj
```

Compila exactamente los mismos ficheros que Unity y ejecuta las mismas
pruebas NUnit. El arnés vive fuera de `Assets/`, así que Unity ni lo ve.

Único detalle: `Bank.cs` avisa con `UnityEngine.Debug.LogWarning` cuando topa
el saldo, y ahí fuera esa clase no existe; el arnés incluye un sustituto
mínimo (`UnityEngineShim.cs`) para no tener que tocar el port.

## Regenerar los vectores

Para regenerar los vectores tras cambiar las matemáticas:

```bash
node tools/gen-unity-vectors.js > unity/Assets/Casino/Tests/GoldenVectors.cs
```

## El dinero

Ningún juego toca el saldo. Todo pasa por una ronda del banco:

```csharp
var bank = new Bank(Money.ToCents(1000m));   // 1.000 € de fichas

var round = bank.OpenRound("slots", 5m);     // cobra la apuesta YA
round.Raise(5m);                             // doblar, separar, seguro…
RoundResult r = round.Settle(12.50m);        // devuelve el TOTAL (0 = pierde)

Debug.Log(r.Net);                            // +7,50 €
Debug.Log(bank.Audit(Money.ToCents(1000m))); // true: el cuadre es exacto
```

Cuatro garantías **por construcción**:

1. La apuesta se cobra una vez, al abrir la ronda.
2. `Settle()` sólo puede llamarse una vez; la segunda lanza `BankException`.
3. No puede haber dos rondas abiertas del mismo juego a la vez.
4. El saldo nunca queda negativo: se valida antes de cobrar.

Y todo en `long` de céntimos, así que no hay deriva de coma flotante:
mil rondas de 0,10 € devueltas dejan el saldo exactamente igual.

## Seguir portando

`PROMPT-PARA-TU-IA.md` tiene un texto listo para pegar a la IA que trabaje en
tu proyecto en local, con el orden de trabajo y lo que no debe tocar.
