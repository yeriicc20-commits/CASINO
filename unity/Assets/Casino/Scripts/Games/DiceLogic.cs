using System;
using Casino.Core;

namespace Casino.Games
{
    /// <summary>
    /// Dados: el jugador elige el objetivo y si apuesta a más o a menos.
    /// Port de js/games/dice.js.
    ///
    /// El multiplicador es 0,99 ÷ probabilidad, así que el RTP es del 99% sea
    /// cual sea el objetivo: sólo cambia cuánto riesgo se asume.
    /// </summary>
    public static class DiceLogic
    {
        public const double HouseEdge = 0.01;
        public const int MinTarget = 2;
        public const int MaxTarget = 98;

        /// <summary>El tiro da uno de 10.000 valores equiprobables: 0,00 … 99,99.</summary>
        public const int Outcomes = 10000;

        /// <summary>
        /// Probabilidad EXACTA de ganar, contada sobre los 10.000 resultados.
        ///
        /// El detalle importa: "más de 50" gana con 50,01…99,99, que son 4.999
        /// valores (49,99%), no 5.000. Usar (100-target)/100 haría que el
        /// multiplicador mostrado no cuadrara con la probabilidad real.
        /// </summary>
        public static double WinChance(int target, bool over)
        {
            int t = target * 100;
            int count = over ? (Outcomes - 1 - t) : t;
            return count / (double)Outcomes;
        }

        /// <summary>Multiplicador del retorno total. Trunca a favor de la casa.</summary>
        public static double Multiplier(int target, bool over)
        {
            double p = WinChance(target, over);
            if (p <= 0.0) return 0.0;
            return Math.Floor((1.0 - HouseEdge) / p * 10000.0) / 10000.0;
        }

        /// <summary>Clavar el objetivo pierde en ambas direcciones.</summary>
        public static bool Wins(double roll, int target, bool over)
        {
            return over ? roll > target : roll < target;
        }

        /// <summary>Un tiro: valor con dos decimales entre 0,00 y 99,99.</summary>
        public static double Roll(Rng rng)
        {
            return Math.Floor(rng.NextDouble() * Outcomes) / 100.0;
        }

        public static decimal Payout(decimal stake, int target, bool over, double roll)
        {
            if (!Wins(roll, target, over)) return 0m;
            return Money.RoundToCent(stake * (decimal)Multiplier(target, over));
        }
    }
}
