using System;
using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    /// <summary>
    /// Keno: se eligen hasta 10 números de 40 y salen 10.
    /// Port de js/games/keno.js.
    ///
    /// La tabla está resuelta con tools/solve-keno.js para que cada número de
    /// selecciones quede dentro de ±1 punto del 95%. Los botes de los niveles
    /// máximos están topados a valores razonables: acertar 10 de 10 es 1 entre
    /// 847.660.528, y dejar que la fórmula pusiera "lo que toca" daba pagos de
    /// cientos de millones.
    /// </summary>
    public static class KenoLogic
    {
        public const int Pool = 40;
        public const int Drawn = 10;
        public const int MaxPicks = 10;

        /// <summary>Pays[elegidos][aciertos] = multiplicador del retorno total.</summary>
        public static readonly Dictionary<int, decimal[]> Pays = new Dictionary<int, decimal[]>
        {
            { 1,  new[] { 0m, 3.8m } },
            { 2,  new[] { 0m, 0m, 16.5m } },
            { 3,  new[] { 0m, 0m, 3m, 45m } },
            { 4,  new[] { 0m, 0m, 2m, 6.4m, 120m } },
            { 5,  new[] { 0m, 0m, 0m, 5.7m, 28m, 600m } },
            { 6,  new[] { 0m, 0m, 0m, 3.5m, 11m, 71m, 2000m } },
            { 7,  new[] { 0m, 0m, 0m, 2.6m, 5.4m, 23m, 215m, 6000m } },
            { 8,  new[] { 0m, 0m, 0m, 0m, 6.5m, 19m, 110m, 1450m, 20000m } },
            { 9,  new[] { 0m, 0m, 0m, 0m, 4.5m, 9.7m, 39m, 320m, 6200m, 40000m } },
            { 10, new[] { 0m, 0m, 0m, 0m, 0m, 12m, 36m, 205m, 2450m, 76000m, 100000m } }
        };

        private static double Comb(int n, int k)
        {
            if (k < 0 || k > n) return 0.0;
            k = Math.Min(k, n - k);
            double r = 1.0;
            for (int i = 0; i < k; i++) r = r * (n - i) / (i + 1);
            return r;
        }

        /// <summary>Probabilidad hipergeométrica de acertar exactamente `hits`.</summary>
        public static double Probability(int picks, int hits)
        {
            return Comb(picks, hits) * Comb(Pool - picks, Drawn - hits) / Comb(Pool, Drawn);
        }

        /// <summary>RTP teórico EXACTO: suma cerrada de probabilidad × pago.</summary>
        public static double RtpFor(int picks)
        {
            if (!Pays.TryGetValue(picks, out var table)) return 0.0;
            double s = 0.0;
            for (int h = 0; h <= picks; h++)
            {
                if (h < table.Length) s += Probability(picks, h) * (double)table[h];
            }
            return s;
        }

        /// <summary>Sortea los 10 números.</summary>
        public static List<int> DrawNumbers(Rng rng)
        {
            var pool = new List<int>(Pool);
            for (int i = 1; i <= Pool; i++) pool.Add(i);
            rng.Shuffle(pool);
            return pool.GetRange(0, Drawn);
        }

        public static decimal Payout(decimal stake, int picks, int hits)
        {
            if (!Pays.TryGetValue(picks, out var table)) return 0m;
            if (hits < 0 || hits >= table.Length) return 0m;
            return Money.RoundToCent(stake * table[hits]);
        }
    }
}
