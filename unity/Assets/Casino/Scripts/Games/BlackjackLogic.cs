using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    /// <summary>
    /// Blackjack: 6 mazos, el crupier se planta en 17 (también blando),
    /// blackjack paga 3:2, se puede doblar y separar hasta 4 manos.
    /// Port de js/games/blackjack.js.
    /// </summary>
    public static class BlackjackLogic
    {
        public const int Decks = 6;
        public const int MaxHands = 4;

        /// <summary>El crupier pide mientras tenga menos de 17.</summary>
        public static bool DealerShouldHit(IList<Card> dealer)
        {
            return Deck.ScoreBlackjack(dealer).Total < 17;
        }

        /// <summary>
        /// Multiplicador del retorno sobre la apuesta de ESA mano:
        ///   0 = pierde · 1 = empate · 2 = gana · 2,5 = blackjack natural.
        ///
        /// `wasSplit` importa: un 21 con dos cartas tras separar cuenta como
        /// 21 normal, no como blackjack, y por eso paga 1:1 y no 3:2.
        /// </summary>
        public static decimal Compare(IList<Card> player, IList<Card> dealer, bool wasSplit)
        {
            var p = Deck.ScoreBlackjack(player);
            var d = Deck.ScoreBlackjack(dealer);

            if (p.Bust) return 0m;                       // pasarse pierde, aunque el crupier también se pase

            bool playerNatural = p.Blackjack && !wasSplit;
            bool dealerNatural = d.Blackjack;

            if (playerNatural && dealerNatural) return 1m;
            if (playerNatural) return 2.5m;
            if (dealerNatural) return 0m;
            if (d.Bust) return 2m;
            if (p.Total > d.Total) return 2m;
            if (p.Total < d.Total) return 0m;
            return 1m;
        }

        /// <summary>¿Se puede separar? Se compara por valor, así dos figuras valen.</summary>
        public static bool CanSplit(IList<Card> hand, int handCount)
        {
            if (hand.Count != 2) return false;
            if (handCount >= MaxHands) return false;
            return Deck.BjCardValue(hand[0]) == Deck.BjCardValue(hand[1]);
        }

        /// <summary>El seguro paga 2:1, o sea devuelve 3× lo puesto.</summary>
        public static decimal InsurancePayout(decimal stake, IList<Card> dealer)
        {
            return Deck.ScoreBlackjack(dealer).Blackjack ? Money.RoundToCent(stake * 3m) : 0m;
        }
    }
}
