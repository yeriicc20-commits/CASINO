using System;
using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    /// <summary>Palo de la baraja francesa.</summary>
    public enum Suit { Spades, Hearts, Diamonds, Clubs }

    /// <summary>
    /// Una carta. `Rank` va de 1 (as) a 13 (rey), igual que en la versión web,
    /// para que los vectores de prueba coincidan.
    /// </summary>
    public readonly struct Card
    {
        public readonly int Rank;
        public readonly Suit Suit;

        public Card(int rank, Suit suit)
        {
            Rank = rank;
            Suit = suit;
        }

        public bool IsRed => Suit == Suit.Hearts || Suit == Suit.Diamonds;

        public string Label =>
            Rank == 1 ? "A" : Rank == 11 ? "J" : Rank == 12 ? "Q" : Rank == 13 ? "K" : Rank.ToString();

        public string Symbol =>
            Suit == Suit.Spades ? "♠" : Suit == Suit.Hearts ? "♥" :
            Suit == Suit.Diamonds ? "♦" : "♣";

        public string SuitId =>
            Suit == Suit.Spades ? "s" : Suit == Suit.Hearts ? "h" :
            Suit == Suit.Diamonds ? "d" : "c";

        /// <summary>"Ks", "7h"… el mismo identificador que usa la versión web.</summary>
        public string Id => Label + SuitId;

        public override string ToString() => Label + Symbol;
    }

    /// <summary>Puntuación de una mano de blackjack.</summary>
    public struct BjScore
    {
        public int Total;
        public bool Soft;
        public bool Bust;
        public bool Blackjack;
    }

    /// <summary>Categorías de mano del video póker, de mejor a peor.</summary>
    public enum PokerHand
    {
        Nothing = 0,
        LowPair,
        JacksOrBetter,
        TwoPair,
        ThreeOfAKind,
        Straight,
        Flush,
        FullHouse,
        FourOfAKind,
        StraightFlush,
        RoyalFlush
    }

    public struct PokerResult
    {
        public PokerHand Hand;
        public string Name;
        /// <summary>Índices de las cartas que forman la combinación.</summary>
        public List<int> Cards;
    }

    /// <summary>
    /// Zapato con reposición automática.
    ///
    /// Nunca se queda sin cartas a mitad de una mano: si se agota, se rellena.
    /// Esa es una causa clásica de fallos en el blackjack, y por eso el
    /// barajado sólo se ofrece ENTRE manos, con <see cref="Exhausted"/>.
    /// </summary>
    public sealed class Shoe
    {
        private readonly int _decks;
        private readonly Rng _rng;
        private readonly int _cut;
        private List<Card> _cards;

        public Shoe(int decks, Rng rng, double penetration = 0.75)
        {
            _decks = decks;
            _rng = rng;
            _cards = Deck.Build(decks, rng);
            _cut = (int)(_cards.Count * (1.0 - penetration));
        }

        public int Remaining => _cards.Count;

        /// <summary>¿Conviene barajar antes de la siguiente mano?</summary>
        public bool Exhausted => _cards.Count <= _cut;

        public Card Draw()
        {
            if (_cards.Count == 0) _cards = Deck.Build(_decks, _rng);
            Card c = _cards[_cards.Count - 1];
            _cards.RemoveAt(_cards.Count - 1);
            return c;
        }

        public void Reshuffle()
        {
            _cards = Deck.Build(_decks, _rng);
        }
    }

    /// <summary>
    /// Baraja francesa y evaluadores, compartidos por blackjack, video póker,
    /// punto y banca y más-o-menos. Port de js/games/deck.js.
    /// </summary>
    public static class Deck
    {
        public static readonly Suit[] Suits = { Suit.Spades, Suit.Hearts, Suit.Diamonds, Suit.Clubs };

        /// <summary>
        /// Baraja de `decks` mazos, ya mezclada.
        /// El orden de generación (palo exterior, rango interior) y el mezclado
        /// son los mismos que en la web, para que las semillas coincidan.
        /// </summary>
        public static List<Card> Build(int decks, Rng rng)
        {
            var list = new List<Card>(decks * 52);
            for (int d = 0; d < decks; d++)
            {
                foreach (var s in Suits)
                {
                    for (int r = 1; r <= 13; r++) list.Add(new Card(r, s));
                }
            }
            rng.Shuffle(list);
            return list;
        }

        // ------------------------------ BLACKJACK ------------------------------

        /// <summary>Valor en blackjack; el as vale 11 y se ajusta después.</summary>
        public static int BjCardValue(Card c)
        {
            if (c.Rank == 1) return 11;
            return c.Rank >= 10 ? 10 : c.Rank;
        }

        /// <summary>Puntúa una mano bajando los ases de 11 a 1 mientras se pase de 21.</summary>
        public static BjScore ScoreBlackjack(IList<Card> hand)
        {
            int total = 0, aces = 0;
            foreach (var c in hand)
            {
                total += BjCardValue(c);
                if (c.Rank == 1) aces++;
            }
            int soft = aces;
            while (total > 21 && soft > 0) { total -= 10; soft--; }

            return new BjScore
            {
                Total = total,
                Soft = soft > 0 && total <= 21,
                Bust = total > 21,
                Blackjack = hand.Count == 2 && total == 21
            };
        }

        // -------------------------------- PÓKER --------------------------------

        public static string PokerHandName(PokerHand h)
        {
            switch (h)
            {
                case PokerHand.RoyalFlush: return "Escalera de color real";
                case PokerHand.StraightFlush: return "Escalera de color";
                case PokerHand.FourOfAKind: return "Póker";
                case PokerHand.FullHouse: return "Full";
                case PokerHand.Flush: return "Color";
                case PokerHand.Straight: return "Escalera";
                case PokerHand.ThreeOfAKind: return "Trío";
                case PokerHand.TwoPair: return "Doble pareja";
                case PokerHand.JacksOrBetter: return "Pareja de J o mejor";
                case PokerHand.LowPair: return "Pareja baja";
                default: return "Nada";
            }
        }

        /// <summary>
        /// Evalúa 5 cartas para video póker (Jacks or Better).
        /// Contempla las dos escaleras con as: A-2-3-4-5 y 10-J-Q-K-A.
        /// </summary>
        public static PokerResult EvaluatePoker(IList<Card> hand)
        {
            if (hand.Count != 5) throw new ArgumentException("Se esperaban 5 cartas.");

            var byRank = new Dictionary<int, List<int>>();
            var bySuit = new Dictionary<Suit, int>();
            for (int i = 0; i < 5; i++)
            {
                if (!byRank.TryGetValue(hand[i].Rank, out var l))
                {
                    l = new List<int>();
                    byRank[hand[i].Rank] = l;
                }
                l.Add(i);
                bySuit.TryGetValue(hand[i].Suit, out int c);
                bySuit[hand[i].Suit] = c + 1;
            }

            bool isFlush = false;
            foreach (var kv in bySuit) if (kv.Value == 5) isFlush = true;

            var ranks = new List<int>(5);
            foreach (var c in hand) ranks.Add(c.Rank);
            ranks.Sort();

            var unique = new List<int>();
            foreach (int r in ranks) if (!unique.Contains(r)) unique.Add(r);

            bool isStraight = false;
            int straightHigh = 0;
            if (unique.Count == 5)
            {
                if (unique[4] - unique[0] == 4) { isStraight = true; straightHigh = unique[4]; }
                else if (unique[0] == 1 && unique[1] == 10 && unique[2] == 11 &&
                         unique[3] == 12 && unique[4] == 13)
                {
                    isStraight = true;
                    straightHigh = 14;          // el as va arriba
                }
            }

            var all = new List<int> { 0, 1, 2, 3, 4 };

            if (isStraight && isFlush)
            {
                var h = straightHigh == 14 ? PokerHand.RoyalFlush : PokerHand.StraightFlush;
                return new PokerResult { Hand = h, Name = PokerHandName(h), Cards = all };
            }

            // Grupos ordenados por tamaño, de mayor a menor.
            var groups = new List<KeyValuePair<int, List<int>>>(byRank);
            groups.Sort((a, b) => b.Value.Count.CompareTo(a.Value.Count));

            if (groups[0].Value.Count == 4)
            {
                return new PokerResult
                {
                    Hand = PokerHand.FourOfAKind,
                    Name = PokerHandName(PokerHand.FourOfAKind),
                    Cards = groups[0].Value
                };
            }
            if (groups[0].Value.Count == 3 && groups.Count > 1 && groups[1].Value.Count == 2)
            {
                return new PokerResult
                {
                    Hand = PokerHand.FullHouse, Name = PokerHandName(PokerHand.FullHouse), Cards = all
                };
            }
            if (isFlush)
            {
                return new PokerResult { Hand = PokerHand.Flush, Name = PokerHandName(PokerHand.Flush), Cards = all };
            }
            if (isStraight)
            {
                return new PokerResult { Hand = PokerHand.Straight, Name = PokerHandName(PokerHand.Straight), Cards = all };
            }
            if (groups[0].Value.Count == 3)
            {
                return new PokerResult
                {
                    Hand = PokerHand.ThreeOfAKind,
                    Name = PokerHandName(PokerHand.ThreeOfAKind),
                    Cards = groups[0].Value
                };
            }
            if (groups[0].Value.Count == 2 && groups.Count > 1 && groups[1].Value.Count == 2)
            {
                var cards = new List<int>(groups[0].Value);
                cards.AddRange(groups[1].Value);
                return new PokerResult
                {
                    Hand = PokerHand.TwoPair, Name = PokerHandName(PokerHand.TwoPair), Cards = cards
                };
            }
            if (groups[0].Value.Count == 2)
            {
                int r = groups[0].Key;
                bool high = r == 1 || r >= 11;      // A, J, Q, K pagan
                var h = high ? PokerHand.JacksOrBetter : PokerHand.LowPair;
                return new PokerResult { Hand = h, Name = PokerHandName(h), Cards = groups[0].Value };
            }
            return new PokerResult
            {
                Hand = PokerHand.Nothing, Name = PokerHandName(PokerHand.Nothing), Cards = new List<int>()
            };
        }

        // ------------------------------- BACCARAT -------------------------------

        /// <summary>En baccarat el 10 y las figuras valen 0; el as, 1.</summary>
        public static int BaccaratValue(Card c)
        {
            return c.Rank >= 10 ? 0 : c.Rank;
        }

        /// <summary>Sólo cuenta la unidad de la suma.</summary>
        public static int ScoreBaccarat(IList<Card> hand)
        {
            int t = 0;
            foreach (var c in hand) t += BaccaratValue(c);
            return t % 10;
        }
    }
}
