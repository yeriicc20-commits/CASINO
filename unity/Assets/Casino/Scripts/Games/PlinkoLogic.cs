using System;
using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    public enum PlinkoRisk { Bajo, Medio, Alto }

    /// <summary>
    /// Plinko: la bola cae por 16 filas de clavos y acaba en una cubeta.
    /// Port de js/games/plinko.js.
    ///
    /// La cubeta sigue una binomial(16, ½): la del centro es 12.870 veces más
    /// probable que las de los extremos. Las tres tablas están resueltas para
    /// dar el MISMO 97% de retorno; sólo cambia la varianza. Son simétricas y
    /// nunca suben hacia el centro.
    /// </summary>
    public static class PlinkoLogic
    {
        public const int Rows = 16;
        public const int Buckets = Rows + 1;   // 17

        public static readonly decimal[] PaysBajo =
        {
            16m, 9m, 2m, 1.6m, 1.4m, 1.2m, 0.99m, 0.87m, 0.75m,
            0.87m, 0.99m, 1.2m, 1.4m, 1.6m, 2m, 9m, 16m
        };

        public static readonly decimal[] PaysMedio =
        {
            110m, 41m, 10m, 5m, 2.7m, 1.5m, 0.82m, 0.52m, 0.47m,
            0.52m, 0.82m, 1.5m, 2.7m, 5m, 10m, 41m, 110m
        };

        public static readonly decimal[] PaysAlto =
        {
            1000m, 130m, 26m, 9m, 4m, 1.4m, 0.46m, 0.22m, 0.15m,
            0.22m, 0.46m, 1.4m, 4m, 9m, 26m, 130m, 1000m
        };

        public static decimal[] PaysFor(PlinkoRisk risk)
        {
            switch (risk)
            {
                case PlinkoRisk.Bajo: return PaysBajo;
                case PlinkoRisk.Alto: return PaysAlto;
                default: return PaysMedio;
            }
        }

        private static double Comb(int n, int k)
        {
            if (k < 0 || k > n) return 0.0;
            k = Math.Min(k, n - k);
            double r = 1.0;
            for (int i = 0; i < k; i++) r = r * (n - i) / (i + 1);
            return r;
        }

        /// <summary>Probabilidad de acabar en la cubeta `i` (binomial simétrica).</summary>
        public static double BucketProbability(int i)
        {
            return Comb(Rows, i) / Math.Pow(2, Rows);
        }

        /// <summary>RTP exacto de una tabla, sumando probabilidad × pago.</summary>
        public static decimal RtpOf(decimal[] pays)
        {
            decimal s = 0m;
            for (int i = 0; i < Buckets; i++) s += (decimal)BucketProbability(i) * pays[i];
            return s;
        }

        /// <summary>
        /// Deja caer una bola. Devuelve el camino (true = derecha) y la cubeta.
        /// El camino se decide entero antes de animar, así lo que se ve es lo
        /// que se cobra.
        /// </summary>
        public static int Drop(Rng rng, out bool[] path)
        {
            path = new bool[Rows];
            int pos = 0;
            for (int r = 0; r < Rows; r++)
            {
                bool right = rng.NextDouble() < 0.5;
                path[r] = right;
                if (right) pos++;
            }
            return pos;
        }

        public static decimal Payout(decimal stake, PlinkoRisk risk, int bucket)
        {
            var pays = PaysFor(risk);
            if (bucket < 0 || bucket >= pays.Length) return 0m;
            return Money.RoundToCent(stake * pays[bucket]);
        }
    }
}
