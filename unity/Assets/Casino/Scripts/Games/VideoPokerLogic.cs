using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    /// <summary>
    /// Video póker "Jacks or Better", tabla 9/6 (el full paga 9 y el color 6).
    /// Port de js/games/videopoker.js.
    ///
    /// Con 5 créditos la escalera real pasa de 250× a 800× por crédito, así
    /// que apostar el máximo es siempre lo óptimo: de ahí el 99,5% de RTP.
    /// </summary>
    public static class VideoPokerLogic
    {
        /// <summary>Pago por crédito, según cuántos créditos se apuesten (1..5).</summary>
        public static readonly Dictionary<PokerHand, int[]> Paytable = new Dictionary<PokerHand, int[]>
        {
            { PokerHand.RoyalFlush,    new[] { 250, 500, 750, 1000, 4000 } },
            { PokerHand.StraightFlush, new[] { 50, 100, 150, 200, 250 } },
            { PokerHand.FourOfAKind,   new[] { 25, 50, 75, 100, 125 } },
            { PokerHand.FullHouse,     new[] { 9, 18, 27, 36, 45 } },
            { PokerHand.Flush,         new[] { 6, 12, 18, 24, 30 } },
            { PokerHand.Straight,      new[] { 4, 8, 12, 16, 20 } },
            { PokerHand.ThreeOfAKind,  new[] { 3, 6, 9, 12, 15 } },
            { PokerHand.TwoPair,       new[] { 2, 4, 6, 8, 10 } },
            { PokerHand.JacksOrBetter, new[] { 1, 2, 3, 4, 5 } }
        };

        /// <summary>Orden de la tabla tal como se muestra en pantalla.</summary>
        public static readonly PokerHand[] DisplayOrder =
        {
            PokerHand.RoyalFlush, PokerHand.StraightFlush, PokerHand.FourOfAKind,
            PokerHand.FullHouse, PokerHand.Flush, PokerHand.Straight,
            PokerHand.ThreeOfAKind, PokerHand.TwoPair, PokerHand.JacksOrBetter
        };

        /// <summary>
        /// Premio total en euros.
        /// La apuesta total es `credits * unit`, y el pago sale de la columna
        /// correspondiente al número de créditos.
        /// </summary>
        public static decimal Payout(PokerHand hand, int credits, decimal unit)
        {
            if (!Paytable.TryGetValue(hand, out int[] row)) return 0m;
            int c = credits < 1 ? 1 : credits > 5 ? 5 : credits;
            return Money.RoundToCent(row[c - 1] * unit);
        }

        public static decimal Payout(IList<Card> hand, int credits, decimal unit)
        {
            return Payout(Deck.EvaluatePoker(hand).Hand, credits, unit);
        }
    }
}
