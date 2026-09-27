using System;
using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    public enum RouletteBetType
    {
        Straight,   // pleno, paga 35:1
        Red, Black,
        Even, Odd,
        Low, High,  // 1-18 / 19-36
        Dozen,      // Key = 0,1,2
        Column      // Key = 0,1,2
    }

    public struct RouletteBet
    {
        public RouletteBetType Type;
        /// <summary>Número para el pleno; índice para docena/columna; ignorado en el resto.</summary>
        public int Key;
        public decimal Amount;

        public RouletteBet(RouletteBetType type, int key, decimal amount)
        {
            Type = type; Key = key; Amount = amount;
        }
    }

    /// <summary>
    /// Ruleta europea: 37 casillas con un solo cero.
    ///
    /// Port de js/games/roulette.js. Enumerando la rueda entera, TODAS las
    /// apuestas dan exactamente 36/37 = 97,297% de retorno, que es lo que
    /// comprueban los tests.
    /// </summary>
    public static class RouletteLogic
    {
        /// <summary>Orden real de la rueda europea.</summary>
        public static readonly int[] Wheel =
        {
            0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10,
            5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
        };

        public static readonly int[] Reds =
        {
            1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36
        };

        private static readonly HashSet<int> RedSet = new HashSet<int>(Reds);

        public static bool IsRed(int n) => RedSet.Contains(n);

        public static string ColorOf(int n) => n == 0 ? "green" : IsRed(n) ? "red" : "black";

        /// <summary>Cuánto paga a 1 cada tipo de apuesta.</summary>
        public static int PayoutRatio(RouletteBetType type)
        {
            switch (type)
            {
                case RouletteBetType.Straight: return 35;
                case RouletteBetType.Dozen:
                case RouletteBetType.Column: return 2;
                default: return 1;
            }
        }

        /// <summary>¿Cubre la apuesta el número que ha salido?</summary>
        public static bool Covers(RouletteBetType type, int key, int n)
        {
            switch (type)
            {
                case RouletteBetType.Straight: return n == key;
                // El cero pierde todas las apuestas sencillas: ahí está la ventaja.
                case RouletteBetType.Red: return n != 0 && IsRed(n);
                case RouletteBetType.Black: return n != 0 && !IsRed(n);
                case RouletteBetType.Even: return n != 0 && n % 2 == 0;
                case RouletteBetType.Odd: return n != 0 && n % 2 == 1;
                case RouletteBetType.Low: return n >= 1 && n <= 18;
                case RouletteBetType.High: return n >= 19 && n <= 36;
                case RouletteBetType.Dozen: return n >= key * 12 + 1 && n <= key * 12 + 12;
                case RouletteBetType.Column: return n >= 1 && (n - 1) % 3 == key;
                default: return false;
            }
        }

        /// <summary>Números que cubre una apuesta (para pintar el tapete).</summary>
        public static List<int> CoveredNumbers(RouletteBetType type, int key)
        {
            var list = new List<int>();
            for (int n = 0; n <= 36; n++) if (Covers(type, key, n)) list.Add(n);
            return list;
        }

        /// <summary>
        /// Retorno TOTAL (apuesta incluida) de una lista de apuestas.
        /// Se suman todas las que acierten, igual que en la mesa real.
        /// </summary>
        public static decimal Payout(IEnumerable<RouletteBet> bets, int winning)
        {
            decimal total = 0m;
            foreach (var b in bets)
            {
                if (Covers(b.Type, b.Key, winning)) total += b.Amount * (PayoutRatio(b.Type) + 1);
            }
            return Money.RoundToCent(total);
        }

        /// <summary>Gira la rueda y devuelve el número.</summary>
        public static int Spin(Rng rng) => Wheel[rng.Range(0, Wheel.Length - 1)];
    }
}
