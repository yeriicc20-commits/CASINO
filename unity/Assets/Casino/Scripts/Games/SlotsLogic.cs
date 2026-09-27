using System;
using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    /// <summary>Un símbolo de la tira.</summary>
    public sealed class SlotSymbol
    {
        public string Id;
        public string Name;
        /// <summary>Veces que aparece en cada tira de 64 posiciones.</summary>
        public int N;
        /// <summary>Multiplicador por 1..5 iguales (los índices 0 y 1 son 0).</summary>
        public int[] Pay;
        public bool Wild;
        public bool Scatter;
    }

    public struct LineWin
    {
        public int Line;
        public string Symbol;
        public int Count;
        public int Pay;
        /// <summary>Celdas (carrete, fila) que forman la combinación.</summary>
        public List<(int reel, int row)> Cells;
    }

    public struct ScatterWin
    {
        public int Count;
        public int Pay;
        public int Spins;
        public List<(int reel, int row)> Cells;
    }

    public sealed class SpinEvaluation
    {
        public List<LineWin> Lines = new List<LineWin>();
        public bool HasScatter;
        public ScatterWin Scatter;
        /// <summary>Suma de multiplicadores de línea (sobre la apuesta POR LÍNEA).</summary>
        public int LineMult;
        /// <summary>Multiplicador de dispersas (sobre la apuesta TOTAL).</summary>
        public int ScatterMult;
    }

    /// <summary>
    /// Tragaperras 5x3 con 10 líneas, comodín, dispersas y giros gratis.
    ///
    /// Port exacto de js/games/slots.js. Los recuentos por tira y los pagos son
    /// los mismos números ya verificados por simulación en la versión web
    /// (RTP 96,3%), así que NO deben tocarse sin volver a medir el RTP.
    /// </summary>
    public static class SlotsLogic
    {
        public const int Reels = 5;
        public const int Rows = 3;
        public const int LinesCount = 10;
        public const int StripLength = 64;
        public const int FreeMultiplier = 2;

        public const string WildId = "comodin";
        public const string ScatterId = "estrella";

        public static readonly SlotSymbol[] Symbols =
        {
            new SlotSymbol { Id = "cereza",   Name = "Cereza",   N = 11, Pay = new[] { 0, 0, 4, 12, 40 } },
            new SlotSymbol { Id = "limon",    Name = "Limón",    N = 11, Pay = new[] { 0, 0, 5, 16, 50 } },
            new SlotSymbol { Id = "naranja",  Name = "Naranja",  N = 11, Pay = new[] { 0, 0, 8, 20, 70 } },
            new SlotSymbol { Id = "sandia",   Name = "Sandía",   N = 9,  Pay = new[] { 0, 0, 10, 30, 100 } },
            new SlotSymbol { Id = "uvas",     Name = "Uvas",     N = 7,  Pay = new[] { 0, 0, 15, 50, 160 } },
            new SlotSymbol { Id = "campana",  Name = "Campana",  N = 5,  Pay = new[] { 0, 0, 25, 80, 250 } },
            new SlotSymbol { Id = "siete",    Name = "Siete",    N = 3,  Pay = new[] { 0, 0, 40, 150, 500 } },
            new SlotSymbol { Id = "bar",      Name = "BAR",      N = 1,  Pay = new[] { 0, 0, 100, 400, 2000 } },
            new SlotSymbol { Id = WildId,     Name = "Comodín",  N = 4,  Pay = new[] { 0, 0, 0, 0, 0 }, Wild = true },
            new SlotSymbol { Id = ScatterId,  Name = "Estrella", N = 2,  Pay = new[] { 0, 0, 0, 0, 0 }, Scatter = true }
        };

        private static readonly Dictionary<string, SlotSymbol> ById = BuildIndex();

        private static Dictionary<string, SlotSymbol> BuildIndex()
        {
            var d = new Dictionary<string, SlotSymbol>();
            foreach (var s in Symbols) d[s.Id] = s;
            return d;
        }

        public static SlotSymbol Get(string id)
        {
            return ById.TryGetValue(id, out var s) ? s : null;
        }

        /// <summary>Dispersas: pagan en cualquier posición, sobre la apuesta TOTAL.</summary>
        public static readonly Dictionary<int, int> ScatterPay =
            new Dictionary<int, int> { { 3, 2 }, { 4, 8 }, { 5, 40 } };

        public static readonly Dictionary<int, int> ScatterSpins =
            new Dictionary<int, int> { { 3, 8 }, { 4, 12 }, { 5, 20 } };

        /// <summary>Las 10 líneas: para cada carrete, qué fila toca.</summary>
        public static readonly int[][] Lines =
        {
            new[] { 1, 1, 1, 1, 1 },
            new[] { 0, 0, 0, 0, 0 },
            new[] { 2, 2, 2, 2, 2 },
            new[] { 0, 1, 2, 1, 0 },
            new[] { 2, 1, 0, 1, 2 },
            new[] { 0, 0, 1, 0, 0 },
            new[] { 2, 2, 1, 2, 2 },
            new[] { 1, 0, 0, 0, 1 },
            new[] { 1, 2, 2, 2, 1 },
            new[] { 0, 1, 1, 1, 0 }
        };

        // ---------------------------------------------------------------
        //  Construcción de las tiras
        // ---------------------------------------------------------------

        /// <summary>
        /// Posiciones repartidas con holgura mínima, con algo de variación.
        /// Es lo que impide que dos dispersas caigan en la misma ventana de 3
        /// celdas: sin esta separación la frecuencia del bono variaba entre
        /// 1/91 y 1/141 según qué tira tocara generar.
        /// </summary>
        private static List<int> SpacedPositions(int count, int len, int minGap, Rng rng, bool[] taken)
        {
            int spacing = len / count;
            int jitter = Math.Max(0, (spacing - minGap) / 2);
            int offset = rng.Range(0, len - 1);
            var outPos = new List<int>(count);

            for (int i = 0; i < count; i++)
            {
                int pos = offset + i * spacing + (jitter > 0 ? rng.Range(-jitter, jitter) : 0);
                pos = ((pos % len) + len) % len;

                int guard = 0;
                while (guard++ < len && !Fits(pos)) pos = (pos + 1) % len;

                outPos.Add(pos);
                taken[pos] = true;
            }
            return outPos;

            bool Fits(int p)
            {
                if (taken[p]) return false;
                for (int d = 1; d < minGap; d++)
                {
                    if (taken[(p + d) % len]) return false;
                    if (taken[((p - d) % len + len) % len]) return false;
                }
                return true;
            }
        }

        /// <summary>Una tira de 64 posiciones con el recuento exacto de cada símbolo.</summary>
        public static string[] BuildStrip(Rng rng)
        {
            var strip = new string[StripLength];
            var taken = new bool[StripLength];

            SlotSymbol scatter = Get(ScatterId);
            SlotSymbol wild = Get(WildId);

            foreach (int p in SpacedPositions(scatter.N, StripLength, Rows, rng, taken)) strip[p] = scatter.Id;
            foreach (int p in SpacedPositions(wild.N, StripLength, Rows, rng, taken)) strip[p] = wild.Id;

            var rest = new List<string>();
            foreach (var s in Symbols)
            {
                if (s.Wild || s.Scatter) continue;
                for (int i = 0; i < s.N; i++) rest.Add(s.Id);
            }
            rng.Shuffle(rest);

            int k = 0;
            for (int i = 0; i < StripLength; i++)
            {
                if (strip[i] == null) strip[i] = k < rest.Count ? rest[k++] : "limon";
            }
            return strip;
        }

        /// <summary>Pantalla aleatoria: grid[carrete][fila].</summary>
        public static string[][] SpinGrid(string[][] strips, Rng rng)
        {
            var grid = new string[Reels][];
            for (int r = 0; r < Reels; r++)
            {
                int pos = rng.Range(0, StripLength - 1);
                grid[r] = new string[Rows];
                for (int f = 0; f < Rows; f++) grid[r][f] = strips[r][(pos + f) % StripLength];
            }
            return grid;
        }

        // ---------------------------------------------------------------
        //  Evaluación
        // ---------------------------------------------------------------

        /// <summary>
        /// Evalúa la pantalla. Función pura: los tests la usan directamente y
        /// es la que debe coincidir con la versión web símbolo por símbolo.
        /// </summary>
        public static SpinEvaluation Evaluate(string[][] grid)
        {
            var result = new SpinEvaluation();

            for (int li = 0; li < Lines.Length; li++)
            {
                int[] pattern = Lines[li];
                var ids = new string[Reels];
                for (int r = 0; r < Reels; r++) ids[r] = grid[r][pattern[r]];

                // El símbolo base es el primero que no sea comodín. Si todos lo
                // son, cuenta como BAR (el mejor pago). Una dispersa corta.
                string baseId = null;
                for (int k = 0; k < ids.Length; k++)
                {
                    if (ids[k] != WildId && ids[k] != ScatterId) { baseId = ids[k]; break; }
                    if (ids[k] == ScatterId) break;
                }
                if (baseId == null)
                {
                    if (ids[0] == WildId) baseId = "bar";
                    else continue;
                }

                int count = 0;
                for (int c = 0; c < Reels; c++)
                {
                    if (ids[c] == baseId || ids[c] == WildId) count++;
                    else break;
                }

                if (count >= 3)
                {
                    SlotSymbol sym = Get(baseId);
                    if (sym == null) continue;           // id desconocido: no paga
                    int mult = count - 1 < sym.Pay.Length ? sym.Pay[count - 1] : 0;
                    if (mult > 0)
                    {
                        var cells = new List<(int, int)>(count);
                        for (int q = 0; q < count; q++) cells.Add((q, pattern[q]));
                        result.Lines.Add(new LineWin
                        {
                            Line = li, Symbol = baseId, Count = count, Pay = mult, Cells = cells
                        });
                        result.LineMult += mult;
                    }
                }
            }

            // Dispersas en cualquier posición.
            var scatterCells = new List<(int, int)>();
            for (int r = 0; r < Reels; r++)
            {
                for (int f = 0; f < Rows; f++)
                {
                    if (grid[r][f] == ScatterId) scatterCells.Add((r, f));
                }
            }
            if (scatterCells.Count >= 3)
            {
                int n = Math.Min(scatterCells.Count, 5);
                result.HasScatter = true;
                result.Scatter = new ScatterWin
                {
                    Count = n,
                    Pay = ScatterPay.TryGetValue(n, out var p) ? p : 0,
                    Spins = ScatterSpins.TryGetValue(n, out var s) ? s : 0,
                    Cells = scatterCells
                };
                result.ScatterMult = result.Scatter.Pay;
            }

            return result;
        }

        /// <summary>Premio en euros de una evaluación.</summary>
        public static decimal PayoutFor(SpinEvaluation ev, decimal totalBet, int multiplier = 1)
        {
            decimal perLine = totalBet / LinesCount;
            decimal win = ev.LineMult * perLine + ev.ScatterMult * totalBet;
            return Money.RoundToCent(win * multiplier);
        }
    }
}
