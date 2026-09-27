using System;
using System.Globalization;

namespace Casino.Core
{
    /// <summary>
    /// Dinero en CÉNTIMOS ENTEROS.
    ///
    /// Toda la contabilidad del casino usa long de céntimos, nunca float ni
    /// double: con decimales de coma flotante, sumar 0,10 € mil veces no da
    /// 100,00 €, y el saldo acaba descuadrando. Esta es la misma decisión que
    /// en la versión web, y es la razón de que el cuadre sea exacto.
    /// </summary>
    public static class Money
    {
        /// <summary>
        /// Formato español construido a mano, no con CultureInfo("es-ES").
        ///
        /// Motivo: en compilaciones IL2CPP con globalización invariante (algo
        /// habitual al exportar a móvil o consola) pedir una cultura concreta
        /// lanza CultureNotFoundException, y los importes reventarían en la
        /// build aunque funcionen en el editor. Definiendo los separadores
        /// explícitamente, 1.234,50 € se ve igual en todas partes.
        /// </summary>
        private static readonly NumberFormatInfo Es = CreateSpanishFormat();

        private static NumberFormatInfo CreateSpanishFormat()
        {
            var f = (NumberFormatInfo)CultureInfo.InvariantCulture.NumberFormat.Clone();
            f.NumberDecimalSeparator = ",";
            f.NumberGroupSeparator = ".";
            f.NumberGroupSizes = new[] { 3 };
            f.NumberNegativePattern = 1;   // -1.234,50 (signo delante, sin paréntesis)
            return f;
        }

        /// <summary>Euros (decimal) -> céntimos, redondeando al céntimo más cercano.</summary>
        public static long ToCents(decimal euros)
        {
            return (long)Math.Round(euros * 100m, MidpointRounding.AwayFromZero);
        }

        /// <summary>Céntimos -> euros.</summary>
        public static decimal ToEuros(long cents)
        {
            return cents / 100m;
        }

        /// <summary>1234.5 -> "1.234,50 €"</summary>
        public static string Format(decimal euros, int decimals = 2)
        {
            return euros.ToString("N" + decimals, Es) + " €";
        }

        public static string FormatCents(long cents, int decimals = 2)
        {
            return Format(ToEuros(cents), decimals);
        }

        /// <summary>Versión corta para cifras grandes: 2,5M €, 120,4k €.</summary>
        public static string FormatCompact(decimal euros)
        {
            decimal abs = Math.Abs(euros);
            string sign = euros < 0 ? "-" : "";
            if (abs >= 1_000_000m) return sign + (abs / 1_000_000m).ToString("0.##", Es) + "M €";
            if (abs >= 100_000m) return sign + (abs / 1_000m).ToString("0.#", Es) + "k €";
            return Format(euros);
        }

        /// <summary>Multiplicador: 2 -> "2,00x"</summary>
        public static string Mult(double m)
        {
            return m.ToString("0.00", Es) + "×";
        }

        /// <summary>
        /// Acepta lo que escriba la gente: "12,50", "12.50" y "1.234,50".
        /// Devuelve false si no hay un número reconocible.
        /// </summary>
        public static bool TryParse(string text, out decimal euros)
        {
            euros = 0m;
            if (string.IsNullOrWhiteSpace(text)) return false;

            string t = text.Trim();
            // Quitamos todo lo que no sea dígito, coma, punto o signo.
            var sb = new System.Text.StringBuilder(t.Length);
            foreach (char c in t)
            {
                if (char.IsDigit(c) || c == ',' || c == '.' || c == '-') sb.Append(c);
            }
            t = sb.ToString();
            if (t.Length == 0) return false;

            if (t.IndexOf(',') >= 0)
            {
                // La coma es el separador decimal; los puntos son de millar.
                t = t.Replace(".", string.Empty).Replace(',', '.');
            }
            return decimal.TryParse(t, NumberStyles.Number, CultureInfo.InvariantCulture, out euros);
        }

        /// <summary>Redondea a céntimos exactos (evita apuestas tipo 3,333333 €).</summary>
        public static decimal RoundToCent(decimal euros)
        {
            return Math.Round(euros, 2, MidpointRounding.AwayFromZero);
        }
    }
}
