using System;
using System.Collections.Generic;

namespace Casino.Core
{
    /// <summary>
    /// Generador Mulberry32, IDÉNTICO bit a bit al de la versión web.
    ///
    /// Que sea el mismo algoritmo no es capricho: permite sembrarlo con un
    /// número y comprobar que el C# produce exactamente la misma secuencia que
    /// el JavaScript ya verificado. Los tests de Assets/Casino/Tests usan esa
    /// propiedad para demostrar que el port no ha cambiado ningún resultado.
    ///
    /// Sembrable a propósito: para jugar de verdad se usa el constructor sin
    /// argumentos, que siembra con el reloj y la entropía del sistema.
    /// </summary>
    public sealed class Rng
    {
        private uint _state;

        public Rng()
        {
            _state = unchecked((uint)(Environment.TickCount ^ Guid.NewGuid().GetHashCode()));
            if (_state == 0) _state = 0x9E3779B9u;
        }

        public Rng(uint seed)
        {
            _state = seed;
        }

        public void Reseed(uint seed)
        {
            _state = seed;
        }

        /// <summary>Siguiente valor en [0, 1).</summary>
        public double NextDouble()
        {
            unchecked
            {
                _state += 0x6D2B79F5u;
                uint t = _state;
                // Math.imul de JavaScript es una multiplicación de 32 bits con
                // desbordamiento: en C# eso es un producto de int sin comprobar.
                t = (uint)((int)(t ^ (t >> 15)) * (int)(t | 1u));
                t ^= t + (uint)((int)(t ^ (t >> 7)) * (int)(t | 61u));
                return (t ^ (t >> 14)) / 4294967296.0;
            }
        }

        /// <summary>Entero en [lo, hi], ambos incluidos.</summary>
        public int Range(int lo, int hi)
        {
            if (hi < lo) throw new ArgumentException("hi debe ser >= lo");
            return lo + (int)(NextDouble() * (hi - lo + 1));
        }

        /// <summary>true con probabilidad p.</summary>
        public bool Chance(double p)
        {
            return NextDouble() < p;
        }

        /// <summary>Un elemento cualquiera de la lista.</summary>
        public T Pick<T>(IList<T> items)
        {
            if (items == null || items.Count == 0) throw new ArgumentException("lista vacía");
            return items[(int)(NextDouble() * items.Count)];
        }

        /// <summary>Fisher-Yates sobre la propia lista.</summary>
        public void Shuffle<T>(IList<T> items)
        {
            for (int i = items.Count - 1; i > 0; i--)
            {
                int j = (int)(NextDouble() * (i + 1));
                T tmp = items[i];
                items[i] = items[j];
                items[j] = tmp;
            }
        }
    }
}
