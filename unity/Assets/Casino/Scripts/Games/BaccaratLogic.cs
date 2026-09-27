using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    public enum BaccaratSide { Player, Banker, Tie }

    public sealed class BaccaratHand
    {
        public List<Card> Player = new List<Card>();
        public List<Card> Banker = new List<Card>();
        public int PlayerScore;
        public int BankerScore;
        public BaccaratSide Winner;
    }

    /// <summary>
    /// Punto y banca con las reglas oficiales de tercera carta.
    /// Port de js/games/baccarat.js.
    ///
    /// No hay decisiones que tomar: quién roba está fijado por la tabla, y
    /// por eso las frecuencias salen siempre 44,6% jugador / 45,9% banca /
    /// 9,5% empate.
    /// </summary>
    public static class BaccaratLogic
    {
        public const int Decks = 8;
        public const decimal BankerCommission = 0.05m;

        /// <summary>Reparte una mano completa aplicando la tabla de tercera carta.</summary>
        public static BaccaratHand Play(Shoe shoe)
        {
            var h = new BaccaratHand();
            h.Player.Add(shoe.Draw());
            h.Player.Add(shoe.Draw());
            h.Banker.Add(shoe.Draw());
            h.Banker.Add(shoe.Draw());

            int p = Deck.ScoreBaccarat(h.Player);
            int b = Deck.ScoreBaccarat(h.Banker);

            // Con 8 o 9 de salida ("natural") no roba nadie.
            if (p < 8 && b < 8)
            {
                bool playerDrew = false;
                int playerThird = 0;

                if (p <= 5)
                {
                    var c = shoe.Draw();
                    h.Player.Add(c);
                    playerThird = Deck.BaccaratValue(c);
                    playerDrew = true;
                    p = Deck.ScoreBaccarat(h.Player);
                }

                bool bankerDraws;
                if (!playerDrew)
                {
                    bankerDraws = b <= 5;
                }
                else
                {
                    // Tabla oficial: depende del punto de la banca y de la
                    // tercera carta del jugador.
                    switch (b)
                    {
                        case 0: case 1: case 2: bankerDraws = true; break;
                        case 3: bankerDraws = playerThird != 8; break;
                        case 4: bankerDraws = playerThird >= 2 && playerThird <= 7; break;
                        case 5: bankerDraws = playerThird >= 4 && playerThird <= 7; break;
                        case 6: bankerDraws = playerThird == 6 || playerThird == 7; break;
                        default: bankerDraws = false; break;   // con 7 se planta
                    }
                }

                if (bankerDraws)
                {
                    h.Banker.Add(shoe.Draw());
                    b = Deck.ScoreBaccarat(h.Banker);
                }
            }

            h.PlayerScore = p;
            h.BankerScore = b;
            h.Winner = p > b ? BaccaratSide.Player : b > p ? BaccaratSide.Banker : BaccaratSide.Tie;
            return h;
        }

        /// <summary>
        /// Retorno TOTAL (apuesta incluida).
        /// Con empate, las apuestas a Jugador y Banca se DEVUELVEN, no se pierden.
        /// </summary>
        public static decimal Payout(BaccaratSide side, decimal amount, BaccaratSide winner)
        {
            if (side == BaccaratSide.Tie)
            {
                return winner == BaccaratSide.Tie ? Money.RoundToCent(amount * 9m) : 0m;
            }
            if (winner == BaccaratSide.Tie) return amount;      // se devuelve
            if (side != winner) return 0m;

            if (side == BaccaratSide.Banker)
            {
                // 1:1 menos el 5% de comisión sobre la ganancia.
                decimal profit = amount * (1m - BankerCommission);
                return Money.RoundToCent(amount + profit);
            }
            return Money.RoundToCent(amount * 2m);
        }
    }
}
