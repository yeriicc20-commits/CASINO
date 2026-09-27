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

        /// <summary>Baraja sembrada: el orden debe coincidir carta a carta.</summary>
        public static readonly (uint seed, string[] ids)[] Decks =
        {
            (1u, new[]
            {
                "Qh", "6c", "Jh", "Js", "5c", "6d", "Qc", "3c", "7s", "4d", "10d", "10h", "2c",
                "9d", "Qs", "4s", "Jc", "8d", "9s", "2h", "5s", "2d", "7c", "Kd", "5d", "8s",
                "9h", "4h", "Ks", "2s", "Jd", "Qd", "Kh", "9c", "3s", "5h", "Ac", "10s", "3h",
                "6s", "8h", "7h", "4c", "6h", "Kc", "3d", "Ah", "8c", "10c", "Ad", "As", "7d",
            }),
            (42u, new[]
            {
                "3c", "9c", "2h", "Kh", "Kc", "9d", "7s", "Jc", "10d", "5c", "Jh", "3s", "Ah",
                "4h", "2c", "Qc", "2d", "6s", "10c", "10s", "Ac", "4s", "6c", "7c", "7h", "5s",
                "5d", "Qd", "8d", "5h", "2s", "Ad", "3h", "As", "9h", "8c", "6h", "8s", "Qs",
                "4d", "Jd", "Js", "8h", "Kd", "3d", "Ks", "Qh", "9s", "7d", "4c", "10h", "6d",
            }),
        };

        /// <summary>Ruleta: dinero devuelto al enumerar las 37 casillas con 10 € por apuesta.</summary>
        public static readonly (string type, int key, decimal returned, int hits)[] Roulette =
        {
            ("straight", 17, 360m, 1),
            ("straight", 0, 360m, 1),
            ("red", -1, 360m, 18),
            ("black", -1, 360m, 18),
            ("even", -1, 360m, 18),
            ("odd", -1, 360m, 18),
            ("low", -1, 360m, 18),
            ("high", -1, 360m, 18),
            ("dozen", 0, 360m, 12),
            ("dozen", 1, 360m, 12),
            ("dozen", 2, 360m, 12),
            ("column", 0, 360m, 12),
            ("column", 1, 360m, 12),
            ("column", 2, 360m, 12),
        };

        public struct BjCase { public string Name; public int[][] Player; public int[][] Dealer; public bool Split; public decimal Mult; }
        public static readonly BjCase[] Blackjack =
        {
            new BjCase { Name = "BJ natural contra 20", Player = new[] { new[] { 1, 0 }, new[] { 13, 1 } }, Dealer = new[] { new[] { 10, 0 }, new[] { 10, 1 } }, Split = false, Mult = 2.5m },
            new BjCase { Name = "BJ contra BJ", Player = new[] { new[] { 1, 0 }, new[] { 13, 1 } }, Dealer = new[] { new[] { 1, 2 }, new[] { 12, 3 } }, Split = false, Mult = 1m },
            new BjCase { Name = "20 contra BJ del crupier", Player = new[] { new[] { 10, 0 }, new[] { 10, 1 } }, Dealer = new[] { new[] { 1, 2 }, new[] { 12, 3 } }, Split = false, Mult = 0m },
            new BjCase { Name = "21 tras separar", Player = new[] { new[] { 1, 0 }, new[] { 13, 1 } }, Dealer = new[] { new[] { 10, 0 }, new[] { 9, 1 } }, Split = true, Mult = 2m },
            new BjCase { Name = "el jugador se pasa", Player = new[] { new[] { 10, 0 }, new[] { 9, 1 }, new[] { 5, 2 } }, Dealer = new[] { new[] { 6, 0 }, new[] { 10, 1 } }, Split = false, Mult = 0m },
            new BjCase { Name = "el crupier se pasa", Player = new[] { new[] { 10, 0 }, new[] { 8, 1 } }, Dealer = new[] { new[] { 6, 0 }, new[] { 10, 1 }, new[] { 9, 2 } }, Split = false, Mult = 2m },
            new BjCase { Name = "20 contra 19", Player = new[] { new[] { 10, 0 }, new[] { 10, 1 } }, Dealer = new[] { new[] { 9, 0 }, new[] { 10, 1 } }, Split = false, Mult = 2m },
            new BjCase { Name = "18 contra 18", Player = new[] { new[] { 8, 0 }, new[] { 10, 1 } }, Dealer = new[] { new[] { 8, 2 }, new[] { 10, 3 } }, Split = false, Mult = 1m },
            new BjCase { Name = "ambos se pasan", Player = new[] { new[] { 10, 0 }, new[] { 9, 1 }, new[] { 8, 2 } }, Dealer = new[] { new[] { 10, 3 }, new[] { 9, 2 }, new[] { 7, 0 } }, Split = false, Mult = 0m },
        };

        public static readonly (string name, int[][] hand, bool hits)[] BlackjackDealer =
        {
            ("16", new[] { new[] { 10, 0 }, new[] { 6, 1 } }, true),
            ("17 duro", new[] { new[] { 10, 0 }, new[] { 7, 1 } }, false),
            ("17 blando A+6", new[] { new[] { 1, 0 }, new[] { 6, 1 } }, false),
            ("12 blando A+A", new[] { new[] { 1, 0 }, new[] { 1, 1 } }, true),
            ("21", new[] { new[] { 1, 0 }, new[] { 13, 1 } }, false),
        };

        public struct VpCase { public string Name; public int[][] Cards; public string Key; public decimal Pay5; public decimal Pay1; }
        public static readonly VpCase[] VideoPoker =
        {
            new VpCase { Name = "escalera real", Cards = new[] { new[] { 1, 0 }, new[] { 13, 0 }, new[] { 12, 0 }, new[] { 11, 0 }, new[] { 10, 0 } }, Key = "ROYAL_FLUSH", Pay5 = 4000m, Pay1 = 250m },
            new VpCase { Name = "escalera de color", Cards = new[] { new[] { 9, 1 }, new[] { 8, 1 }, new[] { 7, 1 }, new[] { 6, 1 }, new[] { 5, 1 } }, Key = "STRAIGHT_FLUSH", Pay5 = 250m, Pay1 = 50m },
            new VpCase { Name = "poker", Cards = new[] { new[] { 4, 0 }, new[] { 4, 1 }, new[] { 4, 2 }, new[] { 4, 3 }, new[] { 9, 0 } }, Key = "FOUR_KIND", Pay5 = 125m, Pay1 = 25m },
            new VpCase { Name = "full", Cards = new[] { new[] { 3, 0 }, new[] { 3, 1 }, new[] { 3, 2 }, new[] { 8, 3 }, new[] { 8, 0 } }, Key = "FULL_HOUSE", Pay5 = 45m, Pay1 = 9m },
            new VpCase { Name = "color", Cards = new[] { new[] { 2, 0 }, new[] { 5, 0 }, new[] { 9, 0 }, new[] { 11, 0 }, new[] { 13, 0 } }, Key = "FLUSH", Pay5 = 30m, Pay1 = 6m },
            new VpCase { Name = "escalera A-5", Cards = new[] { new[] { 1, 0 }, new[] { 2, 1 }, new[] { 3, 2 }, new[] { 4, 3 }, new[] { 5, 0 } }, Key = "STRAIGHT", Pay5 = 20m, Pay1 = 4m },
            new VpCase { Name = "escalera 10-A", Cards = new[] { new[] { 10, 0 }, new[] { 11, 1 }, new[] { 12, 2 }, new[] { 13, 3 }, new[] { 1, 0 } }, Key = "STRAIGHT", Pay5 = 20m, Pay1 = 4m },
            new VpCase { Name = "trio", Cards = new[] { new[] { 7, 0 }, new[] { 7, 1 }, new[] { 7, 2 }, new[] { 2, 3 }, new[] { 9, 0 } }, Key = "THREE_KIND", Pay5 = 15m, Pay1 = 3m },
            new VpCase { Name = "doble pareja", Cards = new[] { new[] { 7, 0 }, new[] { 7, 1 }, new[] { 9, 2 }, new[] { 9, 3 }, new[] { 2, 0 } }, Key = "TWO_PAIR", Pay5 = 10m, Pay1 = 2m },
            new VpCase { Name = "pareja de damas", Cards = new[] { new[] { 12, 0 }, new[] { 12, 1 }, new[] { 3, 2 }, new[] { 7, 3 }, new[] { 9, 0 } }, Key = "JACKS_BETTER", Pay5 = 5m, Pay1 = 1m },
            new VpCase { Name = "pareja de ases", Cards = new[] { new[] { 1, 0 }, new[] { 1, 1 }, new[] { 3, 2 }, new[] { 7, 3 }, new[] { 9, 0 } }, Key = "JACKS_BETTER", Pay5 = 5m, Pay1 = 1m },
            new VpCase { Name = "pareja baja", Cards = new[] { new[] { 5, 0 }, new[] { 5, 1 }, new[] { 3, 2 }, new[] { 7, 3 }, new[] { 9, 0 } }, Key = "LOW_PAIR", Pay5 = 0m, Pay1 = 0m },
            new VpCase { Name = "nada", Cards = new[] { new[] { 2, 0 }, new[] { 5, 1 }, new[] { 9, 2 }, new[] { 11, 3 }, new[] { 13, 0 } }, Key = "NOTHING", Pay5 = 0m, Pay1 = 0m },
        };

        public struct BacHand { public int P; public int B; public string W; public int PN; public int BN; }
        public static readonly (uint seed, BacHand[] hands)[] Baccarat =
        {
            (1u, new[]
            {
                new BacHand { P = 2, B = 3, W = "banker", PN = 3, BN = 3 },
                new BacHand { P = 7, B = 7, W = "tie", PN = 3, BN = 2 },
                new BacHand { P = 8, B = 6, W = "player", PN = 2, BN = 2 },
                new BacHand { P = 7, B = 3, W = "player", PN = 3, BN = 3 },
                new BacHand { P = 5, B = 0, W = "player", PN = 3, BN = 3 },
                new BacHand { P = 1, B = 5, W = "banker", PN = 3, BN = 3 },
                new BacHand { P = 2, B = 8, W = "banker", PN = 3, BN = 3 },
                new BacHand { P = 5, B = 4, W = "player", PN = 3, BN = 2 },
                new BacHand { P = 6, B = 0, W = "player", PN = 2, BN = 3 },
                new BacHand { P = 6, B = 6, W = "tie", PN = 2, BN = 3 },
                new BacHand { P = 6, B = 4, W = "player", PN = 2, BN = 3 },
                new BacHand { P = 5, B = 7, W = "banker", PN = 3, BN = 3 },
            }),
            (42u, new[]
            {
                new BacHand { P = 9, B = 6, W = "player", PN = 2, BN = 2 },
                new BacHand { P = 7, B = 8, W = "banker", PN = 2, BN = 2 },
                new BacHand { P = 6, B = 7, W = "banker", PN = 3, BN = 2 },
                new BacHand { P = 9, B = 8, W = "player", PN = 2, BN = 2 },
                new BacHand { P = 0, B = 7, W = "banker", PN = 3, BN = 2 },
                new BacHand { P = 9, B = 7, W = "player", PN = 3, BN = 3 },
                new BacHand { P = 6, B = 2, W = "player", PN = 3, BN = 3 },
                new BacHand { P = 9, B = 9, W = "tie", PN = 2, BN = 2 },
                new BacHand { P = 7, B = 2, W = "player", PN = 2, BN = 3 },
                new BacHand { P = 0, B = 4, W = "banker", PN = 3, BN = 2 },
                new BacHand { P = 6, B = 9, W = "banker", PN = 2, BN = 2 },
                new BacHand { P = 6, B = 6, W = "tie", PN = 2, BN = 2 },
            }),
            (1337u, new[]
            {
                new BacHand { P = 0, B = 6, W = "banker", PN = 3, BN = 2 },
                new BacHand { P = 9, B = 5, W = "player", PN = 2, BN = 2 },
                new BacHand { P = 8, B = 6, W = "player", PN = 3, BN = 3 },
                new BacHand { P = 3, B = 2, W = "player", PN = 3, BN = 3 },
                new BacHand { P = 6, B = 6, W = "tie", PN = 3, BN = 2 },
                new BacHand { P = 6, B = 1, W = "player", PN = 3, BN = 3 },
                new BacHand { P = 1, B = 8, W = "banker", PN = 2, BN = 2 },
                new BacHand { P = 6, B = 8, W = "banker", PN = 3, BN = 3 },
                new BacHand { P = 0, B = 9, W = "banker", PN = 2, BN = 2 },
                new BacHand { P = 9, B = 6, W = "player", PN = 3, BN = 2 },
                new BacHand { P = 0, B = 7, W = "banker", PN = 3, BN = 2 },
                new BacHand { P = 9, B = 4, W = "player", PN = 3, BN = 3 },
            }),
        };

        public static readonly (string name, string side, string winner, decimal pay)[] BaccaratPays =
        {
            ("player gana player", "player", "player", 20m),
            ("player gana banker", "player", "banker", 0m),
            ("player empate", "player", "tie", 10m),
            ("banker gana banker", "banker", "banker", 19.5m),
            ("banker empate", "banker", "tie", 10m),
            ("tie acierta", "tie", "tie", 90m),
            ("tie falla", "tie", "player", 0m),
        };

        public static readonly (int target, bool over, double chance, double mult)[] Dice =
        {
            (50, true, 0.49990000000000001, 1.9802999999999999),
            (50, false, 0.50000000000000000, 1.9800000000000000),
            (75, true, 0.24990000000000001, 3.9615000000000000),
            (90, true, 0.099900000000000003, 9.9099000000000004),
            (98, true, 0.019900000000000001, 49.748699999999999),
            (2, false, 0.020000000000000000, 49.500000000000000),
            (25, false, 0.25000000000000000, 3.9600000000000000),
            (10, false, 0.10000000000000001, 9.8999000000000006),
        };

        public static readonly (int mines, int picks, double mult)[] Mines =
        {
            (1, 1, 1.0200000000000000),
            (1, 2, 1.0600000000000001),
            (1, 3, 1.1100000000000001),
            (1, 5, 1.2200000000000000),
            (1, 10, 1.6299999999999999),
            (3, 1, 1.1100000000000001),
            (3, 2, 1.2700000000000000),
            (3, 3, 1.4600000000000000),
            (3, 5, 1.9700000000000000),
            (3, 10, 4.9500000000000002),
            (5, 1, 1.2200000000000000),
            (5, 2, 1.5400000000000000),
            (5, 3, 1.9700000000000000),
            (5, 5, 3.3500000000000001),
            (5, 10, 17.329999999999998),
            (10, 1, 1.6299999999999999),
            (10, 2, 2.7999999999999998),
            (10, 3, 4.9500000000000002),
            (10, 5, 17.329999999999998),
            (10, 10, 1066.7200000000000),
            (24, 1, 24.500000000000000),
            (24, 2, 0.0000000000000000),
            (24, 3, 0.0000000000000000),
            (24, 5, 0.0000000000000000),
            (24, 10, 0.0000000000000000),
        };

        public static readonly (uint seed, double[] crashes)[] Crash =
        {
            (1u, new[] { 1.0000000000000000, 52.770000000000003, 1.3899999999999999, 3.5800000000000001, 193.16000000000000, 1.9500000000000000, 1.6699999999999999, 1.1799999999999999, 1.0700000000000001, 4.2900000000000000, 1.2300000000000000, 1.7400000000000000 }),
            (42u, new[] { 1.8100000000000001, 3.0200000000000000, 2.1099999999999999, 2.6600000000000001, 1.8899999999999999, 8.4700000000000006, 1.4399999999999999, 2.0000000000000000, 2.5600000000000001, 1.0000000000000000, 6.1399999999999997, 2.4500000000000002 }),
        };

        public static readonly (string risk, decimal rtp, decimal[] pays)[] Plinko =
        {
            ("bajo", 0.970232239m, new[] { 16m, 9m, 2m, 1.6m, 1.4m, 1.2m, 0.99m, 0.87m, 0.75m, 0.87m, 0.99m, 1.2m, 1.4m, 1.6m, 2m, 9m, 16m }),
            ("medio", 0.969598694m, new[] { 110m, 41m, 10m, 5m, 2.7m, 1.5m, 0.82m, 0.52m, 0.47m, 0.52m, 0.82m, 1.5m, 2.7m, 5m, 10m, 41m, 110m }),
            ("alto", 0.970487366m, new[] { 1000m, 130m, 26m, 9m, 4m, 1.4m, 0.46m, 0.22m, 0.15m, 0.22m, 0.46m, 1.4m, 4m, 9m, 26m, 130m, 1000m }),
        };

        public static readonly double[] PlinkoBucketProbs = { 0.000015258789062500000, 0.00024414062500000000, 0.0018310546875000000, 0.0085449218750000000, 0.027770996093750000, 0.066650390625000000, 0.12219238281250000, 0.17456054687500000, 0.19638061523437500, 0.17456054687500000, 0.12219238281250000, 0.066650390625000000, 0.027770996093750000, 0.0085449218750000000, 0.0018310546875000000, 0.00024414062500000000, 0.000015258789062500000 };

        public struct HiLoCase { public int Rank; public int Suit; public int Remaining;
            public double ChanceHi; public double ChanceLo; public double MultHi; public double MultLo; }
        public static readonly HiLoCase[] HiLo =
        {
            new HiLoCase { Rank = 1, Suit = 0, Remaining = 51, ChanceHi = 1.0000000000000000, ChanceLo = 0.058823529411764705, MultHi = 0.97999999999999998, MultLo = 16.660000000000000 },
            new HiLoCase { Rank = 7, Suit = 1, Remaining = 51, ChanceHi = 0.52941176470588236, ChanceLo = 0.52941176470588236, MultHi = 1.8511000000000000, MultLo = 1.8511000000000000 },
            new HiLoCase { Rank = 13, Suit = 2, Remaining = 51, ChanceHi = 0.058823529411764705, ChanceLo = 1.0000000000000000, MultHi = 16.660000000000000, MultLo = 0.97999999999999998 },
        };

        public static readonly (int picks, double rtp, double[] probs)[] Keno =
        {
            (1, 0.94999999999999996, new[] { 0.75000000000000000, 0.25000000000000000 }),
            (2, 0.95192307692307698, new[] { 0.55769230769230771, 0.38461538461538464, 0.057692307692307696 }),
            (3, 0.95647773279352233, new[] { 0.41093117408906882, 0.44028340080971662, 0.13663967611336034, 0.012145748987854251 }),
            (4, 0.95623153517890358, new[] { 0.29986869460553672, 0.44424991793412844, 0.21419192471824050, 0.039391618338986759, 0.0022978444031075611 }),
            (5, 0.95004923952292364, new[] { 0.21657183499288762, 0.41648429806324544, 0.27765619870883029, 0.079330342488237227, 0.0095743516796148367, 0.00038297406718459351 }),
            (6, 0.95530145530145527, new[] { 0.15469416785206258, 0.37126600284495020, 0.32128788707736078, 0.12692854798117956, 0.023799102746471169, 0.0019695809169493379, 0.000054710581026370500 }),
            (7, 0.95207996755984381, new[] { 0.10919588318969124, 0.31848799263659944, 0.34396703204752738, 0.17639334976796278, 0.045731609199101457, 0.0058797783255987593, 0.00033791829457464130, 0.0000064365389442788821 }),
            (8, 0.94942986893451287, new[] { 0.076106221617057532, 0.26471729258106969, 0.34744144651265396, 0.22236252576809853, 0.074833542325802388, 0.013303740857920425, 0.0011878340051714666, 0.000046811192322028233, 5.8513990402535289e-7 }),
            (9, 0.95225065286984800, new[] { 0.052323027361727052, 0.21404874829797430, 0.33503282342291629, 0.26058108488449044, 0.10944405565148599, 0.025256320534958306, 0.0031180642635750995, 0.00019090189368827141, 0.0000049371179402139156, 3.6571244001584556e-8 }),
            (10, 0.95422007664841990, new[] { 0.035444631438589294, 0.16878395923137759, 0.31071592494867240, 0.28820027821326133, 0.14710222533801881, 0.042365440897349414, 0.0067893334771393296, 0.00057475838959909667, 0.000023092971010677990, 3.5391526453146347e-7, 1.1797175484382116e-9 }),
        };

        public const double ScratchRtp = 0.95299999999999996;
        public const int ScratchTotalWeight = 1000000;
        /// <summary>Premio sorteado y premio encontrado en el boleto: deben coincidir.</summary>
        public static readonly (decimal rolled, decimal found)[] ScratchSequence =
        {
            (0m, 0m),
            (0m, 0m),
            (0m, 0m),
            (4m, 4m),
            (0m, 0m),
            (0m, 0m),
            (0m, 0m),
            (0m, 0m),
            (0m, 0m),
            (2m, 2m),
            (0m, 0m),
            (0m, 0m),
            (1m, 1m),
            (0m, 0m),
            (0m, 0m),
            (0m, 0m),
            (0m, 0m),
            (0m, 0m),
            (1m, 1m),
            (0m, 0m),
        };
    }
}
