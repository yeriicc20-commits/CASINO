// ATENCIÓN: fichero GENERADO. No editar a mano.
// Lo produce tools/gen-unity-vectors.js a partir del JavaScript ya
// verificado de la versión web. Si cambias las matemáticas del juego,
// vuelve a generarlo y los tests te dirán si el port sigue cuadrando.
//
// Generado el 2026-09-27.

namespace Casino.Tests
{
    public static class GoldenVectors
    {
        /// <summary>Primeros 8 valores del generador para cada semilla.</summary>
        public static readonly (uint seed, double[] values)[] Rng =
        {
            (1u, new[] { 0.62707394058816135, 0.0027357211802154779, 0.52744703995995224, 0.98105096747167408, 0.96837789821438491, 0.28110350295901299, 0.61283886060118675, 0.72074314113706350 }),
            (42u, new[] { 0.60110375192016363, 0.44829055899754167, 0.85246579349040985, 0.66973404143936932, 0.17481389874592423, 0.52659254218451679, 0.27322799433022738, 0.62474465393461287 }),
            (1337u, new[] { 0.18441183259710670, 0.18998925131745636, 0.81047199224121869, 0.64374882215633988, 0.43077461561188102, 0.38104589702561498, 0.52656264882534742, 0.54858637205325067 }),
            (20240927u, new[] { 0.40528070204891264, 0.66021381481550634, 0.18613456981256604, 0.70339754037559032, 0.61811032751575112, 0.70060257543809712, 0.46192270424216986, 0.30662605282850564 }),
            (4294967295u, new[] { 0.89642261411063373, 0.18947825673967600, 0.71565267816185951, 0.94405990932136774, 0.84523643157444894, 0.53913999884389341, 0.68049773876555264, 0.47557209641672671 }),
        };

        /// <summary>Tira completa de 64 posiciones para cada semilla.</summary>
        public static readonly (uint seed, string[] strip)[] Strips =
        {
            (1u, new[]
            {
                "uvas", "uvas", "limon", "uvas", "comodin", "sandia", "uvas", "naranja",
                "naranja", "estrella", "siete", "cereza", "comodin", "naranja", "limon", "limon",
                "sandia", "naranja", "naranja", "sandia", "sandia", "cereza", "cereza", "cereza",
                "campana", "limon", "estrella", "uvas", "sandia", "cereza", "sandia", "comodin",
                "cereza", "campana", "campana", "naranja", "sandia", "limon", "sandia", "cereza",
                "naranja", "limon", "siete", "uvas", "limon", "naranja", "campana", "uvas",
                "cereza", "comodin", "cereza", "limon", "sandia", "limon", "cereza", "bar",
                "campana", "limon", "limon", "cereza", "naranja", "naranja", "siete", "naranja",
            }),
            (42u, new[]
            {
                "limon", "campana", "cereza", "naranja", "limon", "uvas", "limon", "comodin",
                "sandia", "sandia", "limon", "uvas", "sandia", "uvas", "limon", "cereza",
                "estrella", "naranja", "cereza", "naranja", "cereza", "naranja", "limon", "naranja",
                "bar", "cereza", "naranja", "sandia", "comodin", "sandia", "limon", "campana",
                "sandia", "siete", "campana", "uvas", "campana", "estrella", "siete", "cereza",
                "comodin", "uvas", "limon", "naranja", "cereza", "uvas", "limon", "cereza",
                "siete", "cereza", "sandia", "naranja", "cereza", "naranja", "sandia", "naranja",
                "cereza", "limon", "comodin", "sandia", "uvas", "limon", "naranja", "campana",
            }),
            (1337u, new[]
            {
                "cereza", "sandia", "estrella", "limon", "limon", "uvas", "limon", "naranja",
                "uvas", "comodin", "uvas", "naranja", "campana", "bar", "naranja", "cereza",
                "naranja", "campana", "limon", "limon", "uvas", "cereza", "campana", "siete",
                "sandia", "naranja", "comodin", "sandia", "cereza", "cereza", "sandia", "limon",
                "limon", "sandia", "cereza", "sandia", "sandia", "naranja", "cereza", "campana",
                "comodin", "uvas", "cereza", "campana", "naranja", "limon", "limon", "limon",
                "uvas", "cereza", "cereza", "siete", "estrella", "uvas", "naranja", "comodin",
                "sandia", "siete", "limon", "naranja", "cereza", "sandia", "naranja", "naranja",
            }),
        };

        public struct GridCase
        {
            public string Name;
            public string[][] Grid;
            public int LineMult;
            public int ScatterMult;
            public int LineCount;
            public int ScatterCount;
            public int ScatterSpins;
            public decimal Payout10;
            public decimal Payout10Free;
        }

        /// <summary>Pantallas concretas con su evaluación exacta.</summary>
        public static readonly GridCase[] Grids =
        {
            new GridCase
            {
                Name = "cinco BAR",
                Grid = new[]
                {
                    new[] { "bar", "bar", "bar" },
                    new[] { "bar", "bar", "bar" },
                    new[] { "bar", "bar", "bar" },
                    new[] { "bar", "bar", "bar" },
                    new[] { "bar", "bar", "bar" },
                },
                LineMult = 20000, ScatterMult = 0,
                LineCount = 10, ScatterCount = 0, ScatterSpins = 0,
                Payout10 = 20000m, Payout10Free = 40000m
            },
            new GridCase
            {
                Name = "tres limones en la linea 1",
                Grid = new[]
                {
                    new[] { "cereza", "limon", "uvas" },
                    new[] { "sandia", "limon", "naranja" },
                    new[] { "campana", "limon", "cereza" },
                    new[] { "uvas", "naranja", "sandia" },
                    new[] { "cereza", "campana", "limon" },
                },
                LineMult = 5, ScatterMult = 0,
                LineCount = 1, ScatterCount = 0, ScatterSpins = 0,
                Payout10 = 5m, Payout10Free = 10m
            },
            new GridCase
            {
                Name = "comodin completa sietes",
                Grid = new[]
                {
                    new[] { "comodin", "cereza", "cereza" },
                    new[] { "siete", "cereza", "cereza" },
                    new[] { "siete", "cereza", "cereza" },
                    new[] { "limon", "cereza", "cereza" },
                    new[] { "limon", "cereza", "cereza" },
                },
                LineMult = 224, ScatterMult = 0,
                LineCount = 7, ScatterCount = 0, ScatterSpins = 0,
                Payout10 = 224m, Payout10Free = 448m
            },
            new GridCase
            {
                Name = "tres estrellas dispersas",
                Grid = new[]
                {
                    new[] { "estrella", "cereza", "limon" },
                    new[] { "naranja", "estrella", "uvas" },
                    new[] { "sandia", "campana", "estrella" },
                    new[] { "cereza", "limon", "naranja" },
                    new[] { "uvas", "sandia", "campana" },
                },
                LineMult = 0, ScatterMult = 2,
                LineCount = 0, ScatterCount = 3, ScatterSpins = 8,
                Payout10 = 20m, Payout10Free = 40m
            },
            new GridCase
            {
                Name = "cinco estrellas",
                Grid = new[]
                {
                    new[] { "estrella", "estrella", "cereza" },
                    new[] { "estrella", "cereza", "limon" },
                    new[] { "estrella", "cereza", "limon" },
                    new[] { "estrella", "cereza", "limon" },
                    new[] { "estrella", "cereza", "limon" },
                },
                LineMult = 0, ScatterMult = 40,
                LineCount = 0, ScatterCount = 5, ScatterSpins = 20,
                Payout10 = 400m, Payout10Free = 800m
            },
            new GridCase
            {
                Name = "sin premio",
                Grid = new[]
                {
                    new[] { "cereza", "limon", "uvas" },
                    new[] { "sandia", "naranja", "campana" },
                    new[] { "limon", "uvas", "cereza" },
                    new[] { "naranja", "sandia", "limon" },
                    new[] { "campana", "cereza", "uvas" },
                },
                LineMult = 0, ScatterMult = 0,
                LineCount = 0, ScatterCount = 0, ScatterSpins = 0,
                Payout10 = 0m, Payout10Free = 0m
            },
            new GridCase
            {
                Name = "todo comodines cuenta como BAR",
                Grid = new[]
                {
                    new[] { "comodin", "cereza", "limon" },
                    new[] { "comodin", "cereza", "limon" },
                    new[] { "comodin", "cereza", "limon" },
                    new[] { "comodin", "cereza", "limon" },
                    new[] { "comodin", "cereza", "limon" },
                },
                LineMult = 2210, ScatterMult = 0,
                LineCount = 6, ScatterCount = 0, ScatterSpins = 0,
                Payout10 = 2210m, Payout10Free = 4420m
            },
        };

        public struct SessionCase
        {
            public uint Seed;
            public int Spins;
            public decimal Wagered;
            public decimal Returned;
            public int Hits;
        }

        /// <summary>Sesiones largas: mismo número de premios y mismo dinero devuelto.</summary>
        public static readonly SessionCase[] Sessions =
        {
            new SessionCase { Seed = 1u, Spins = 20000, Wagered = 188320m, Returned = 176652m, Hits = 7494 },
            new SessionCase { Seed = 42u, Spins = 20000, Wagered = 188960m, Returned = 179544m, Hits = 7576 },
            new SessionCase { Seed = 1337u, Spins = 20000, Wagered = 186140m, Returned = 186634m, Hits = 7433 },
        };

        /// <summary>Saldo en céntimos tras cada paso de una secuencia del banco.</summary>
        public static readonly (string label, long cents)[] BankSteps =
        {
            ("inicio", 100000L),
            ("tras apostar 10", 99000L),
            ("tras ganar 25", 101500L),
            ("tras apostar 7,50", 100750L),
            ("tras doblar", 100000L),
            ("tras perder", 100000L),
            ("tras apostar 3,33", 99667L),
            ("tras empatar", 100000L),
            ("tras bonus de 50", 105000L),
            ("1000 rondas de 0,10 devueltas", 105000L),
        };

        public const long BankLedgerDebit = 12833L;
        public const long BankLedgerCredit = 17833L;
    }
}
