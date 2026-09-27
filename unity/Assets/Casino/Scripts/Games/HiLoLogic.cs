using System;
using System.Collections.Generic;
using Casino.Core;

namespace Casino.Games
{
    /// <summary>
    /// Más o menos: encadenar aciertos de carta alta o baja.
    /// Port de js/games/hilo.js.
    ///
    /// Cada paso paga según la probabilidad REAL contando las cartas que
    /// quedan en el mazo, con un 2% para la casa. Las cartas iguales cuentan
    /// como acierto en ambas direcciones, lo que evita callejones sin salida
    /// con el as y el rey.
    /// </summary>
    public static class HiLoLogic
    {
        public const double HouseEdge = 0.02;

        /// <summary>El as es la carta más baja (1) y el rey la más alta (13).</summary>
        public static int Value(Card c) => c.Rank;

        /// <summary>Probabilidad de acertar sobre las cartas que quedan.</summary>
        public static double Chance(Card current, IList<Card> remaining, bool higher)
        {
            if (remaining == null || remaining.Count == 0) return 0.0;
            int v = Value(current);
            int hit = 0;
            foreach (var c in remaining)
            {
                if (higher ? Value(c) >= v : Value(c) <= v) hit++;
            }
            return hit / (double)remaining.Count;
        }

        /// <summary>Multiplicador de ESE paso. Trunca a favor de la casa.</summary>
        public static double StepMultiplier(Card current, IList<Card> remaining, bool higher)
        {
            double p = Chance(current, remaining, higher);
            if (p <= 0.0) return 0.0;
            return Math.Floor((1.0 - HouseEdge) / p * 10000.0) / 10000.0;
        }

        /// <summary>¿Acierta la predicción? Los empates cuentan a favor.</summary>
        public static bool IsCorrect(Card current, Card next, bool higher)
        {
            return higher ? Value(next) >= Value(current) : Value(next) <= Value(current);
        }
    }
}
