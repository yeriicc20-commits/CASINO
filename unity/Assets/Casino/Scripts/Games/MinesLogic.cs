using System;
using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    /// <summary>
    /// Minas: descubrir gemas sin pisar una mina, cobrando cuando se quiera.
    /// Port de js/games/mines.js.
    ///
    /// El tablero se genera AL EMPEZAR: las minas están fijas desde el primer
    /// clic y no se mueven según dónde pulses.
    /// </summary>
    public static class MinesLogic
    {
        public const int Size = 5;
        public const int Tiles = Size * Size;    // 25
        public const double HouseEdge = 0.02;

        /// <summary>
        /// Multiplicador acumulado tras descubrir `picks` gemas.
        /// Es el inverso de la probabilidad de haber llegado hasta ahí, con un
        /// 2% para la casa — por eso retirarse en cualquier punto da el mismo
        /// 98% de retorno.
        /// </summary>
        public static double Multiplier(int mines, int picks)
        {
            if (picks <= 0) return 1.0;
            int safe = Tiles - mines;
            if (picks > safe) return 0.0;

            double p = 1.0;
            for (int i = 0; i < picks; i++) p *= (safe - i) / (double)(Tiles - i);
            if (p <= 0.0) return 0.0;
            return Math.Floor((1.0 - HouseEdge) / p * 100.0) / 100.0;
        }

        /// <summary>Tablero nuevo: true = mina.</summary>
        public static bool[] NewBoard(int mines, Rng rng)
        {
            var board = new bool[Tiles];
            var idx = new List<int>(Tiles);
            for (int i = 0; i < Tiles; i++) idx.Add(i);
            rng.Shuffle(idx);
            for (int m = 0; m < mines && m < Tiles; m++) board[idx[m]] = true;
            return board;
        }

        public static decimal Payout(decimal stake, int mines, int picks)
        {
            return Money.RoundToCent(stake * (decimal)Multiplier(mines, picks));
        }
    }
}
