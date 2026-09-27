using System;
using Casino.Core;

namespace Casino.Games
{
    /// <summary>
    /// Crash: el multiplicador sube hasta estallar; hay que cobrar antes.
    /// Port de js/games/crash.js.
    ///
    /// El punto de estallido se sortea ANTES de despegar, así que no depende
    /// de cuándo pulses. La probabilidad de llegar a M es 0,99/M, lo que da un
    /// 99% de retorno con cualquier estrategia.
    ///
    /// Un matiz: truncar a dos decimales hace que los valores por debajo de
    /// 1,01 caigan también en 1,00, así que las rondas instantáneas son ~2% y
    /// no 1%. No es un fallo: es justo lo que mantiene el 99% en los
    /// multiplicadores bajos.
    /// </summary>
    public static class CrashLogic
    {
        public const double HouseEdge = 0.01;
        public const double MaxCrash = 1000000.0;

        /// <summary>Sortea el multiplicador al que estallará la ronda.</summary>
        public static double RollCrash(Rng rng)
        {
            if (rng.NextDouble() < HouseEdge) return 1.0;
            double u = rng.NextDouble();
            if (u >= 0.9999999) u = 0.9999999;      // evita dividir por cero
            double v = 1.0 / (1.0 - u);
            return Math.Min(Math.Floor(v * 100.0) / 100.0, MaxCrash);
        }

        /// <summary>Probabilidad de que la ronda alcance el multiplicador `m`.</summary>
        public static double ChanceOfReaching(double m)
        {
            if (m <= 1.0) return 1.0 - HouseEdge;
            return (1.0 - HouseEdge) / m;
        }

        /// <summary>
        /// Curva de crecimiento en función del tiempo, la misma que usa la web.
        /// A los ~6 s va por 4×; a los ~12 s, por 16×.
        /// </summary>
        public static double MultiplierAt(double seconds)
        {
            double m = Math.Exp(0.235 * seconds);
            m = Math.Floor(m * 100.0) / 100.0;
            return m < 1.0 ? 1.0 : m;
        }

        public static decimal Payout(decimal stake, double cashOutAt, double crashAt)
        {
            if (cashOutAt > crashAt) return 0m;      // estalló antes de cobrar
            return Money.RoundToCent(stake * (decimal)cashOutAt);
        }
    }
}
