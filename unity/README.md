# Casino Royale — port a Unity

Esta carpeta contiene el casino portado a C# para Unity. **No es la web**: la
versión web vive en la raíz del repositorio y sigue funcionando por su cuenta.

## Qué hay hecho

| Parte | Estado |
|---|---|
| `Scripts/Core/Money.cs` — céntimos enteros, formato es-ES | ✅ |
| `Scripts/Core/Rng.cs` — Mulberry32, idéntico a la web | ✅ |
| `Scripts/Core/Bank.cs` — rondas atómicas, libro mayor, auditoría | ✅ |
| `Scripts/Games/SlotsLogic.cs` — tragaperras 5×3, 10 líneas | ✅ |
| `Tests/` — 52 comprobaciones contra la versión web | ✅ |
| Las otras 11 máquinas | ⏳ pendiente |
| Interfaz (UI Toolkit / uGUI) | ⏳ pendiente |

## Cómo instalarlo

1. Copia la carpeta `Assets/Casino` dentro del `Assets/` de tu proyecto.
2. Abre Unity y deja que compile.
3. `Window > General > Test Runner > EditMode > Run All`.

Los 52 tests deben pasar. Si alguno falla, la copia ha ido mal: no sigas.

Requiere el paquete **Test Framework** (viene de serie en Unity 2019+).

## Por qué hay tests "dorados"

El entorno donde se escribió este port no tenía compilador de C#, así que no
se pudo compilar ni ejecutar aquí. Para no entregar código sin comprobar, la
verificación se hizo al revés: se ejecutó el **JavaScript original** —que sí
está verificado con millones de simulaciones— con semillas fijas, y se
volcaron los resultados exactos a `Tests/GoldenVectors.cs`.

Los tests comparan el C# contra esos números. Si el port se desviara en algo
—el generador aleatorio, el reparto de las tiras, la evaluación de líneas o
la contabilidad del banco— el test falla nada más abrir el proyecto.

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
