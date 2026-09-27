using System;
using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    /// <summary>
    /// Rasca y gana: 9 casillas, tres símbolos iguales premian.
    /// Port de js/games/scratch.js.
    ///
    /// El boleto se genera ENTERO al comprarlo, con su premio ya decidido,
    /// igual que un rasca de verdad: rascar sólo descubre lo que ya estaba.
    /// </summary>
    public static class ScratchLogic
    {
        public const int Cells = 9;

        public sealed class Symbol
        {
            public string Id;
            public decimal Mult;
            public Symbol(string id, decimal mult) { Id = id; Mult = mult; }
        }

        public static readonly Symbol[] Symbols =
        {
            new Symbol("cereza", 1m),
            new Symbol("trebol", 2m),
            new Symbol("campana", 4m),
            new Symbol("estrella", 10m),
            new Symbol("gema", 25m),
            new Symbol("siete", 100m),
            new Symbol("corona", 500m)
        };

        public struct Prize
        {
            public int Weight;
            public decimal Mult;
            public string SymbolId;     // null = sin premio
        }

        /// <summary>
        /// Tabla de resultados con sus pesos. El RTP sale de la suma ponderada:
        /// RTP = Σ (peso/total) × multiplicador.
        /// </summary>
        public static readonly Prize[] Outcomes =
        {
            new Prize { Weight = 620000, Mult = 0m,   SymbolId = null },
            new Prize { Weight = 210000, Mult = 1m,   SymbolId = "cereza" },
            new Prize { Weight = 110000, Mult = 2m,   SymbolId = "trebol" },
            new Prize { Weight = 42000,  Mult = 4m,   SymbolId = "campana" },
            new Prize { Weight = 13000,  Mult = 10m,  SymbolId = "estrella" },
            new Prize { Weight = 4200,   Mult = 25m,  SymbolId = "gema" },
            new Prize { Weight = 700,    Mult = 100m, SymbolId = "siete" },
            new Prize { Weight = 100,    Mult = 500m, SymbolId = "corona" }
        };

        public static readonly int TotalWeight = ComputeTotalWeight();

        private static int ComputeTotalWeight()
        {
            int t = 0;
            foreach (var o in Outcomes) t += o.Weight;
            return t;
        }

        /// <summary>RTP exacto de la tabla.</summary>
        public static double Rtp()
        {
            double s = 0.0;
            foreach (var o in Outcomes) s += (o.Weight / (double)TotalWeight) * (double)o.Mult;
            return s;
        }

        /// <summary>Sortea el resultado del boleto.</summary>
        public static Prize RollOutcome(Rng rng)
        {
            double r = rng.NextDouble() * TotalWeight;
            foreach (var o in Outcomes)
            {
                r -= o.Weight;
                if (r <= 0) return o;
            }
            return Outcomes[0];
        }

        /// <summary>
        /// Construye las 9 casillas coherentes con el premio sorteado:
        /// si premia hay EXACTAMENTE 3 del símbolo ganador y ningún otro trío;
        /// si no premia, ningún símbolo llega a 3.
        /// </summary>
        public static string[] BuildTicket(Prize outcome, Rng rng)
        {
            var cells = new string[Cells];
            var counts = new Dictionary<string, int>();

            if (outcome.Mult > 0m && outcome.SymbolId != null)
            {
                var slots = new List<int>(Cells);
                for (int i = 0; i < Cells; i++) slots.Add(i);
                rng.Shuffle(slots);

                for (int i = 0; i < 3; i++) cells[slots[i]] = outcome.SymbolId;
                counts[outcome.SymbolId] = 3;

                for (int i = 3; i < slots.Count; i++)
                {
                    string pick = null;
                    int guard = 0;
                    while (guard++ < 60)
                    {
                        string cand = rng.Pick(Symbols).Id;
                        if (cand == outcome.SymbolId) continue;      // el ganador ya está completo
                        counts.TryGetValue(cand, out int c);
                        if (c >= 2) continue;                        // nadie más puede llegar a 3
                        pick = cand;
                        break;
                    }
                    if (pick == null) pick = FirstWithRoom(counts, outcome.SymbolId);
                    counts.TryGetValue(pick, out int cc);
                    counts[pick] = cc + 1;
                    cells[slots[i]] = pick;
                }
            }
            else
            {
                for (int i = 0; i < Cells; i++)
                {
                    string pick = null;
                    int guard = 0;
                    while (guard++ < 80)
                    {
                        string cand = rng.Pick(Symbols).Id;
                        counts.TryGetValue(cand, out int c);
                        if (c >= 2) continue;
                        pick = cand;
                        break;
                    }
                    if (pick == null) pick = FirstWithRoom(counts, null);
                    counts.TryGetValue(pick, out int cc);
                    counts[pick] = cc + 1;
                    cells[i] = pick;
                }
            }
            return cells;
        }

        private static string FirstWithRoom(Dictionary<string, int> counts, string exclude)
        {
            foreach (var s in Symbols)
            {
                if (s.Id == exclude) continue;
                counts.TryGetValue(s.Id, out int c);
                if (c < 2) return s.Id;
            }
            return Symbols[0].Id;
        }

        /// <summary>Busca el mejor trío del boleto. Devuelve 0 si no hay ninguno.</summary>
        public static decimal EvaluateTicket(string[] cells, out string symbolId)
        {
            symbolId = null;
            var counts = new Dictionary<string, int>();
            foreach (var id in cells)
            {
                if (id == null) continue;
                counts.TryGetValue(id, out int c);
                counts[id] = c + 1;
            }
            decimal best = 0m;
            foreach (var kv in counts)
            {
                if (kv.Value < 3) continue;
                foreach (var s in Symbols)
                {
                    if (s.Id == kv.Key && s.Mult > best) { best = s.Mult; symbolId = s.Id; }
                }
            }
            return best;
        }

        public static decimal Payout(decimal stake, string[] cells)
        {
            decimal mult = EvaluateTicket(cells, out _);
            return Money.RoundToCent(stake * mult);
        }
    }
}
