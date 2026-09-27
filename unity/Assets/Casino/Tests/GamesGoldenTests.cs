using System;
using System.Collections.Generic;
using NUnit.Framework;
using Casino.Core;
using Casino.Games;

namespace Casino.Tests
{
    /// <summary>
    /// Comprueba las once máquinas restantes contra los números sacados del
    /// JavaScript verificado. Mismo criterio que CasinoGoldenTests: si el port
    /// se desvía en cualquier tabla de pagos, probabilidad o regla, falla aquí.
    /// </summary>
    public class GamesGoldenTests
    {
        private static Card C(int rank, int suitIndex) => new Card(rank, (Suit)suitIndex);

        private static List<Card> Hand(int[][] spec)
        {
            var list = new List<Card>(spec.Length);
            foreach (var c in spec) list.Add(C(c[0], c[1]));
            return list;
        }

        // =====================================================================
        //  Baraja
        // =====================================================================

        [Test]
        public void Baraja_SembradaSaleEnElMismoOrdenQueLaWeb()
        {
            foreach (var (seed, ids) in GoldenVectors.Decks)
            {
                var deck = Deck.Build(1, new Rng(seed));
                Assert.AreEqual(ids.Length, deck.Count, $"semilla {seed}: número de cartas");
                for (int i = 0; i < ids.Length; i++)
                {
                    Assert.AreEqual(ids[i], deck[i].Id, $"semilla {seed}, carta {i}");
                }
            }
        }

        [Test]
        public void Baraja_TieneLas52CartasSinRepetir()
        {
            var deck = Deck.Build(1, new Rng(5u));
            var seen = new HashSet<string>();
            foreach (var c in deck) Assert.IsTrue(seen.Add(c.Id), $"carta repetida: {c.Id}");
            Assert.AreEqual(52, seen.Count);
        }

        [Test]
        public void Zapato_NuncaSeQuedaSinCartas()
        {
            var shoe = new Shoe(6, new Rng(9u), 0.72);
            for (int i = 0; i < 2000; i++)
            {
                var c = shoe.Draw();
                Assert.GreaterOrEqual(c.Rank, 1);
                Assert.LessOrEqual(c.Rank, 13);
            }
        }

        // =====================================================================
        //  Ruleta
        // =====================================================================

        [Test]
        public void Ruleta_TieneLaRuedaEuropeaCorrecta()
        {
            Assert.AreEqual(37, RouletteLogic.Wheel.Length, "37 casillas, un solo cero");
            Assert.AreEqual(37, new HashSet<int>(RouletteLogic.Wheel).Count, "sin números repetidos");
            Assert.AreEqual(18, RouletteLogic.Reds.Length, "18 rojos");

            int blacks = 0;
            foreach (int n in RouletteLogic.Wheel)
            {
                if (n != 0 && !RouletteLogic.IsRed(n)) blacks++;
            }
            Assert.AreEqual(18, blacks, "18 negros");
        }

        [Test]
        public void Ruleta_PagaLoMismoQueLaWebEnLas37Casillas()
        {
            foreach (var (typeName, key, expectedReturned, expectedHits) in GoldenVectors.Roulette)
            {
                var type = (RouletteBetType)Enum.Parse(typeof(RouletteBetType), typeName, true);
                int k = key < 0 ? 0 : key;

                decimal ret = 0m;
                int hits = 0;
                foreach (int n in RouletteLogic.Wheel)
                {
                    decimal p = RouletteLogic.Payout(
                        new[] { new RouletteBet(type, k, 10m) }, n);
                    ret += p;
                    if (p > 0m) hits++;
                }
                Assert.AreEqual(expectedReturned, ret, $"{typeName}:{key}: dinero devuelto");
                Assert.AreEqual(expectedHits, hits, $"{typeName}:{key}: casillas que aciertan");
            }
        }

        [Test]
        public void Ruleta_TodaApuestaDaExactamente36Entre37()
        {
            // 37 casillas, se paga 36 veces la apuesta: la ventaja de la casa
            // es idéntica en todas las apuestas de la mesa.
            var cases = new (RouletteBetType, int)[]
            {
                (RouletteBetType.Straight, 17), (RouletteBetType.Straight, 0),
                (RouletteBetType.Red, 0), (RouletteBetType.Black, 0),
                (RouletteBetType.Even, 0), (RouletteBetType.Odd, 0),
                (RouletteBetType.Low, 0), (RouletteBetType.High, 0),
                (RouletteBetType.Dozen, 0), (RouletteBetType.Dozen, 1), (RouletteBetType.Dozen, 2),
                (RouletteBetType.Column, 0), (RouletteBetType.Column, 1), (RouletteBetType.Column, 2)
            };

            foreach (var (type, key) in cases)
            {
                decimal ret = 0m;
                foreach (int n in RouletteLogic.Wheel)
                {
                    ret += RouletteLogic.Payout(new[] { new RouletteBet(type, key, 1m) }, n);
                }
                Assert.AreEqual(36m, ret, $"{type}:{key} debería devolver exactamente 36 por 37 apostados");
            }
        }

        [Test]
        public void Ruleta_DocenasYColumnasParten1a36SinSolapes()
        {
            foreach (var type in new[] { RouletteBetType.Dozen, RouletteBetType.Column })
            {
                var all = new List<int>();
                for (int k = 0; k < 3; k++) all.AddRange(RouletteLogic.CoveredNumbers(type, k));
                Assert.AreEqual(36, all.Count, $"{type}: 36 números en total");
                Assert.AreEqual(36, new HashSet<int>(all).Count, $"{type}: sin solapes");
                Assert.IsFalse(all.Contains(0), $"{type}: el cero no entra");
            }
        }

        // =====================================================================
        //  Blackjack
        // =====================================================================

        [Test]
        public void Blackjack_ResuelveLasManosComoLaWeb()
        {
            foreach (var c in GoldenVectors.Blackjack)
            {
                decimal mult = BlackjackLogic.Compare(Hand(c.Player), Hand(c.Dealer), c.Split);
                Assert.AreEqual(c.Mult, mult, c.Name);
            }
        }

        [Test]
        public void Blackjack_ElCrupierPideSegunLaRegla()
        {
            foreach (var (name, hand, hits) in GoldenVectors.BlackjackDealer)
            {
                Assert.AreEqual(hits, BlackjackLogic.DealerShouldHit(Hand(hand)), name);
            }
        }

        [Test]
        public void Blackjack_ElAsBajaDe11A1CuandoHaceFalta()
        {
            Assert.AreEqual(21, Deck.ScoreBlackjack(Hand(new[] { new[] { 1, 0 }, new[] { 13, 1 } })).Total);
            Assert.AreEqual(21, Deck.ScoreBlackjack(Hand(new[] { new[] { 1, 0 }, new[] { 1, 1 }, new[] { 9, 2 } })).Total);
            Assert.AreEqual(14, Deck.ScoreBlackjack(Hand(new[]
                { new[] { 1, 0 }, new[] { 1, 1 }, new[] { 1, 2 }, new[] { 1, 3 } })).Total);
        }

        [Test]
        public void Blackjack_SeSeparaPorValorNoPorRango()
        {
            // Dos figuras distintas valen 10 las dos: se pueden separar.
            Assert.IsTrue(BlackjackLogic.CanSplit(Hand(new[] { new[] { 12, 0 }, new[] { 13, 1 } }), 1));
            Assert.IsFalse(BlackjackLogic.CanSplit(Hand(new[] { new[] { 9, 0 }, new[] { 13, 1 } }), 1));
            Assert.IsFalse(BlackjackLogic.CanSplit(Hand(new[] { new[] { 8, 0 }, new[] { 8, 1 } }),
                BlackjackLogic.MaxHands), "no más de 4 manos");
        }

        // =====================================================================
        //  Video póker
        // =====================================================================

        [Test]
        public void VideoPoker_ClasificaYPagaComoLaWeb()
        {
            var map = new Dictionary<string, PokerHand>
            {
                { "ROYAL_FLUSH", PokerHand.RoyalFlush }, { "STRAIGHT_FLUSH", PokerHand.StraightFlush },
                { "FOUR_KIND", PokerHand.FourOfAKind }, { "FULL_HOUSE", PokerHand.FullHouse },
                { "FLUSH", PokerHand.Flush }, { "STRAIGHT", PokerHand.Straight },
                { "THREE_KIND", PokerHand.ThreeOfAKind }, { "TWO_PAIR", PokerHand.TwoPair },
                { "JACKS_BETTER", PokerHand.JacksOrBetter }, { "LOW_PAIR", PokerHand.LowPair },
                { "NOTHING", PokerHand.Nothing }
            };

            foreach (var c in GoldenVectors.VideoPoker)
            {
                var ev = Deck.EvaluatePoker(Hand(c.Cards));
                Assert.AreEqual(map[c.Key], ev.Hand, c.Name + ": clasificación");
                Assert.AreEqual(c.Pay5, VideoPokerLogic.Payout(ev.Hand, 5, 1m), c.Name + ": pago con 5 créditos");
                Assert.AreEqual(c.Pay1, VideoPokerLogic.Payout(ev.Hand, 1, 1m), c.Name + ": pago con 1 crédito");
            }
        }

        [Test]
        public void VideoPoker_LaEscaleraRealPremiaApostarElMaximo()
        {
            // 250 por crédito con 1, pero 800 por crédito con 5: por eso
            // apostar el máximo es siempre lo óptimo.
            Assert.AreEqual(250m, VideoPokerLogic.Payout(PokerHand.RoyalFlush, 1, 1m));
            Assert.AreEqual(4000m, VideoPokerLogic.Payout(PokerHand.RoyalFlush, 5, 1m));
            Assert.AreEqual(45m, VideoPokerLogic.Payout(PokerHand.FullHouse, 5, 1m), "tabla 9/6: full paga 9");
            Assert.AreEqual(30m, VideoPokerLogic.Payout(PokerHand.Flush, 5, 1m), "tabla 9/6: color paga 6");
            Assert.AreEqual(0m, VideoPokerLogic.Payout(PokerHand.LowPair, 5, 1m));
            Assert.AreEqual(11.25m, VideoPokerLogic.Payout(PokerHand.FullHouse, 5, 0.25m));
        }

        // =====================================================================
        //  Baccarat
        // =====================================================================

        [Test]
        public void Baccarat_RepartelasManosComoLaWeb()
        {
            foreach (var (seed, hands) in GoldenVectors.Baccarat)
            {
                var shoe = new Shoe(BaccaratLogic.Decks, new Rng(seed), 0.8);
                for (int i = 0; i < hands.Length; i++)
                {
                    var h = BaccaratLogic.Play(shoe);
                    Assert.AreEqual(hands[i].P, h.PlayerScore, $"semilla {seed}, mano {i}: punto del jugador");
                    Assert.AreEqual(hands[i].B, h.BankerScore, $"semilla {seed}, mano {i}: punto de la banca");
                    Assert.AreEqual(hands[i].W, h.Winner.ToString().ToLowerInvariant(),
                        $"semilla {seed}, mano {i}: ganador");
                    Assert.AreEqual(hands[i].PN, h.Player.Count, $"semilla {seed}, mano {i}: cartas del jugador");
                    Assert.AreEqual(hands[i].BN, h.Banker.Count, $"semilla {seed}, mano {i}: cartas de la banca");
                }
            }
        }

        [Test]
        public void Baccarat_PagaComoLaWeb()
        {
            foreach (var (name, side, winner, pay) in GoldenVectors.BaccaratPays)
            {
                var s = (BaccaratSide)Enum.Parse(typeof(BaccaratSide), side, true);
                var wn = (BaccaratSide)Enum.Parse(typeof(BaccaratSide), winner, true);
                Assert.AreEqual(pay, BaccaratLogic.Payout(s, 10m, wn), name);
            }
        }

        [Test]
        public void Baccarat_LaBancaPagaMenosComision()
        {
            Assert.AreEqual(19.5m, BaccaratLogic.Payout(BaccaratSide.Banker, 10m, BaccaratSide.Banker),
                "10 + 9,50 tras el 5% de comisión");
            Assert.AreEqual(10m, BaccaratLogic.Payout(BaccaratSide.Player, 10m, BaccaratSide.Tie),
                "con empate se devuelve la apuesta");
        }

        // =====================================================================
        //  Dados
        // =====================================================================

        [Test]
        public void Dados_ProbabilidadesYMultiplicadoresComoLaWeb()
        {
            foreach (var (target, over, chance, mult) in GoldenVectors.Dice)
            {
                Assert.AreEqual(chance, DiceLogic.WinChance(target, over), 1e-12,
                    $"objetivo {target} {(over ? "más" : "menos")}: probabilidad");
                Assert.AreEqual(mult, DiceLogic.Multiplier(target, over), 1e-9,
                    $"objetivo {target} {(over ? "más" : "menos")}: multiplicador");
            }
        }

        [Test]
        public void Dados_LaProbabilidadMostradaEsLaReal()
        {
            // Contando los 10.000 resultados posibles, la probabilidad que se
            // anuncia tiene que salir exacta. "Más de 50" gana 4.999 veces.
            foreach (var (target, over, _, _) in GoldenVectors.Dice)
            {
                int hits = 0;
                for (int i = 0; i < DiceLogic.Outcomes; i++)
                {
                    if (DiceLogic.Wins(i / 100.0, target, over)) hits++;
                }
                Assert.AreEqual(hits / (double)DiceLogic.Outcomes, DiceLogic.WinChance(target, over), 1e-12,
                    $"objetivo {target}: lo anunciado no coincide con el conteo real");
            }
        }

        [Test]
        public void Dados_MantienenEl99PorCientoEnTodosLosObjetivos()
        {
            for (int t = DiceLogic.MinTarget; t <= DiceLogic.MaxTarget; t++)
            {
                foreach (bool over in new[] { true, false })
                {
                    double rtp = DiceLogic.WinChance(t, over) * DiceLogic.Multiplier(t, over) * 100.0;
                    Assert.LessOrEqual(rtp, 99.001, $"objetivo {t}: el RTP no puede pasar del 99%");
                    Assert.GreaterOrEqual(rtp, 98.5, $"objetivo {t}: el RTP se queda corto");
                }
            }
        }

        [Test]
        public void Dados_ClavarElObjetivoPierde()
        {
            Assert.IsFalse(DiceLogic.Wins(50, 50, true));
            Assert.IsFalse(DiceLogic.Wins(50, 50, false));
            Assert.IsTrue(DiceLogic.Wins(50.01, 50, true));
            Assert.IsTrue(DiceLogic.Wins(49.99, 50, false));
        }

        // =====================================================================
        //  Minas
        // =====================================================================

        [Test]
        public void Minas_MultiplicadoresComoLaWeb()
        {
            foreach (var (mines, picks, mult) in GoldenVectors.Mines)
            {
                Assert.AreEqual(mult, MinesLogic.Multiplier(mines, picks), 1e-9,
                    $"{mines} minas, {picks} gemas");
            }
        }

        [Test]
        public void Minas_RetirarseEnCualquierPuntoDaEl98PorCiento()
        {
            foreach (int mines in new[] { 1, 2, 3, 5, 10, 24 })
            {
                int safe = MinesLogic.Tiles - mines;
                for (int picks = 1; picks <= Math.Min(safe, 20); picks++)
                {
                    double prob = 1.0;
                    for (int i = 0; i < picks; i++) prob *= (safe - i) / (double)(MinesLogic.Tiles - i);
                    double rtp = prob * MinesLogic.Multiplier(mines, picks) * 100.0;
                    Assert.LessOrEqual(rtp, 98.001, $"{mines} minas, {picks} gemas: pasa del 98%");
                    Assert.GreaterOrEqual(rtp, 97.2, $"{mines} minas, {picks} gemas: se queda corto");
                }
            }
        }

        [Test]
        public void Minas_ElTableroTieneLasMinasPedidas()
        {
            foreach (int mines in new[] { 1, 3, 5, 10, 24 })
            {
                for (uint seed = 0; seed < 100; seed++)
                {
                    var board = MinesLogic.NewBoard(mines, new Rng(seed));
                    int count = 0;
                    foreach (bool b in board) if (b) count++;
                    Assert.AreEqual(mines, count, $"semilla {seed}: número de minas");
                    Assert.AreEqual(MinesLogic.Tiles, board.Length);
                }
            }
        }

        // =====================================================================
        //  Crash
        // =====================================================================

        [Test]
        public void Crash_SorteaLosMismosEstallidosQueLaWeb()
        {
            foreach (var (seed, crashes) in GoldenVectors.Crash)
            {
                var rng = new Rng(seed);
                for (int i = 0; i < crashes.Length; i++)
                {
                    Assert.AreEqual(crashes[i], CrashLogic.RollCrash(rng), 1e-9, $"semilla {seed}, ronda {i}");
                }
            }
        }

        [Test]
        public void Crash_NuncaEstallaPorDebajoDe1()
        {
            var rng = new Rng(8888u);
            for (int i = 0; i < 200000; i++) Assert.GreaterOrEqual(CrashLogic.RollCrash(rng), 1.0);
        }

        [Test]
        public void Crash_DaEl99PorCientoConCualquierObjetivo()
        {
            var rng = new Rng(8888u);
            var crashes = new double[200000];
            for (int i = 0; i < crashes.Length; i++) crashes[i] = CrashLogic.RollCrash(rng);

            foreach (double target in new[] { 1.5, 2.0, 5.0, 10.0 })
            {
                decimal wagered = 0m, returned = 0m;
                foreach (double c in crashes)
                {
                    wagered += 10m;
                    if (c >= target) returned += 10m * (decimal)target;
                }
                double rtp = (double)(returned / wagered) * 100.0;
                Assert.AreEqual(99.0, rtp, 2.0, $"cobrando en {target}×");
            }
        }

        // =====================================================================
        //  Plinko
        // =====================================================================

        [Test]
        public void Plinko_ProbabilidadesBinomialesComoLaWeb()
        {
            double sum = 0.0;
            for (int i = 0; i < PlinkoLogic.Buckets; i++)
            {
                Assert.AreEqual(GoldenVectors.PlinkoBucketProbs[i], PlinkoLogic.BucketProbability(i), 1e-12,
                    $"cubeta {i}");
                sum += PlinkoLogic.BucketProbability(i);
            }
            Assert.AreEqual(1.0, sum, 1e-9, "las probabilidades deben sumar 1");
        }

        [Test]
        public void Plinko_LasTresTablasDanElMismoRtpYSonSimetricas()
        {
            foreach (var (riskName, rtp, pays) in GoldenVectors.Plinko)
            {
                var risk = (PlinkoRisk)Enum.Parse(typeof(PlinkoRisk), riskName, true);
                var mine = PlinkoLogic.PaysFor(risk);

                CollectionAssert.AreEqual(pays, mine, $"riesgo {riskName}: tabla de pagos");
                Assert.AreEqual((double)rtp, (double)PlinkoLogic.RtpOf(mine), 1e-6, $"riesgo {riskName}: RTP");
                Assert.AreEqual(0.97, (double)PlinkoLogic.RtpOf(mine), 0.005, $"riesgo {riskName}: debe rondar el 97%");

                for (int i = 0; i < PlinkoLogic.Buckets; i++)
                {
                    Assert.AreEqual(mine[i], mine[PlinkoLogic.Buckets - 1 - i], $"riesgo {riskName}: simetría en {i}");
                }
                for (int i = 1; i <= PlinkoLogic.Rows / 2; i++)
                {
                    Assert.LessOrEqual(mine[i], mine[i - 1], $"riesgo {riskName}: los pagos no deben subir hacia el centro");
                }
            }
        }

        [Test]
        public void Plinko_LaBolaSiempreCaeEnUnaCubetaValida()
        {
            var rng = new Rng(55u);
            for (int i = 0; i < 20000; i++)
            {
                int b = PlinkoLogic.Drop(rng, out bool[] path);
                Assert.AreEqual(PlinkoLogic.Rows, path.Length);
                Assert.GreaterOrEqual(b, 0);
                Assert.Less(b, PlinkoLogic.Buckets);
            }
        }

        // =====================================================================
        //  Hi-Lo
        // =====================================================================

        [Test]
        public void HiLo_ProbabilidadesYMultiplicadoresComoLaWeb()
        {
            var deck = Deck.Build(1, new Rng(3u));

            foreach (var c in GoldenVectors.HiLo)
            {
                // Se quita del mazo exactamente la misma carta que quitó la web.
                var current = new Card(c.Rank, (Suit)c.Suit);
                var rest = new List<Card>();
                foreach (var card in deck) if (card.Id != current.Id) rest.Add(card);

                string what = $"{current.Label}{current.SuitId}";
                Assert.AreEqual(c.Remaining, rest.Count, $"{what}: cartas restantes");
                Assert.AreEqual(c.ChanceHi, HiLoLogic.Chance(current, rest, true), 1e-12, $"{what}: prob. alta");
                Assert.AreEqual(c.ChanceLo, HiLoLogic.Chance(current, rest, false), 1e-12, $"{what}: prob. baja");
                Assert.AreEqual(c.MultHi, HiLoLogic.StepMultiplier(current, rest, true), 1e-9, $"{what}: mult. alta");
                Assert.AreEqual(c.MultLo, HiLoLogic.StepMultiplier(current, rest, false), 1e-9, $"{what}: mult. baja");
            }
        }

        [Test]
        public void HiLo_LosEmpatesCuentanEnLasDosDirecciones()
        {
            var deck = Deck.Build(1, new Rng(11u));
            var current = new Card(7, Suit.Spades);
            var rest = new List<Card>();
            foreach (var c in deck) if (c.Id != current.Id) rest.Add(c);

            double hi = HiLoLogic.Chance(current, rest, true);
            double lo = HiLoLogic.Chance(current, rest, false);
            Assert.Greater(hi + lo, 1.0, "al contar los iguales en ambos lados, la suma pasa de 1");

            Assert.IsTrue(HiLoLogic.IsCorrect(current, new Card(7, Suit.Hearts), true));
            Assert.IsTrue(HiLoLogic.IsCorrect(current, new Card(7, Suit.Hearts), false));
        }

        [Test]
        public void HiLo_CadaPasoMantieneEl98PorCiento()
        {
            var deck = Deck.Build(1, new Rng(21u));
            foreach (int rank in new[] { 1, 5, 7, 10, 13 })
            {
                var current = new Card(rank, Suit.Spades);
                var rest = new List<Card>();
                foreach (var c in deck) if (c.Id != current.Id) rest.Add(c);

                foreach (bool hi in new[] { true, false })
                {
                    double rtp = HiLoLogic.Chance(current, rest, hi) *
                                 HiLoLogic.StepMultiplier(current, rest, hi) * 100.0;
                    Assert.LessOrEqual(rtp, 98.001, $"rango {rank}: pasa del 98%");
                    Assert.GreaterOrEqual(rtp, 97.3, $"rango {rank}: se queda corto");
                }
            }
        }

        // =====================================================================
        //  Keno
        // =====================================================================

        [Test]
        public void Keno_ProbabilidadesYRtpComoLaWeb()
        {
            foreach (var (picks, rtp, probs) in GoldenVectors.Keno)
            {
                double sum = 0.0;
                for (int h = 0; h <= picks; h++)
                {
                    Assert.AreEqual(probs[h], KenoLogic.Probability(picks, h), 1e-12,
                        $"{picks} elegidos, {h} aciertos");
                    sum += KenoLogic.Probability(picks, h);
                }
                Assert.AreEqual(1.0, sum, 1e-9, $"{picks} elegidos: las probabilidades deben sumar 1");
                Assert.AreEqual(rtp, KenoLogic.RtpFor(picks), 1e-9, $"{picks} elegidos: RTP");
                Assert.AreEqual(0.95, KenoLogic.RtpFor(picks), 0.01,
                    $"{picks} elegidos: el RTP debe quedar a ±1 punto del 95%");
            }
        }

        [Test]
        public void Keno_ElPlenoDe10EsUnoEntre847Millones()
        {
            Assert.AreEqual(847660528.0, 1.0 / KenoLogic.Probability(10, 10), 1.0);
        }

        [Test]
        public void Keno_ElSorteoDaDiezNumerosDistintos()
        {
            var rng = new Rng(77u);
            for (int i = 0; i < 2000; i++)
            {
                var drawn = KenoLogic.DrawNumbers(rng);
                Assert.AreEqual(KenoLogic.Drawn, drawn.Count);
                Assert.AreEqual(KenoLogic.Drawn, new HashSet<int>(drawn).Count, "sin repetidos");
                foreach (int n in drawn)
                {
                    Assert.GreaterOrEqual(n, 1);
                    Assert.LessOrEqual(n, KenoLogic.Pool);
                }
            }
        }

        // =====================================================================
        //  Rasca y gana
        // =====================================================================

        [Test]
        public void Rasca_RtpYPesosComoLaWeb()
        {
            Assert.AreEqual(GoldenVectors.ScratchTotalWeight, ScratchLogic.TotalWeight, "peso total");
            Assert.AreEqual(GoldenVectors.ScratchRtp, ScratchLogic.Rtp(), 1e-12, "RTP de la tabla");
            Assert.AreEqual(0.95, ScratchLogic.Rtp(), 0.01, "debe rondar el 95%");
        }

        [Test]
        public void Rasca_ElBoletoSiempreCoincideConElSorteo()
        {
            // Lo más importante del juego: si el boleto no lleva el premio que
            // se ha sorteado, el jugador cobra algo distinto de lo que ve.
            var rng = new Rng(1234u);
            for (int i = 0; i < 50000; i++)
            {
                var prize = ScratchLogic.RollOutcome(rng);
                var cells = ScratchLogic.BuildTicket(prize, rng);

                Assert.AreEqual(ScratchLogic.Cells, cells.Length);
                foreach (var c in cells) Assert.IsNotNull(c, $"boleto {i}: casilla vacía");

                decimal found = ScratchLogic.EvaluateTicket(cells, out _);
                Assert.AreEqual(prize.Mult, found, $"boleto {i}: el premio del boleto no es el sorteado");
            }
        }

        [Test]
        public void Rasca_SecuenciaSembradaComoLaWeb()
        {
            var rng = new Rng(1234u);
            for (int i = 0; i < GoldenVectors.ScratchSequence.Length; i++)
            {
                var prize = ScratchLogic.RollOutcome(rng);
                var cells = ScratchLogic.BuildTicket(prize, rng);
                decimal found = ScratchLogic.EvaluateTicket(cells, out _);

                Assert.AreEqual(GoldenVectors.ScratchSequence[i].rolled, prize.Mult, $"boleto {i}: premio sorteado");
                Assert.AreEqual(GoldenVectors.ScratchSequence[i].found, found, $"boleto {i}: premio encontrado");
            }
        }
    }
}
