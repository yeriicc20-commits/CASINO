using System;
using System.Collections.Generic;
using NUnit.Framework;
using Casino.Core;
using Casino.Games;

namespace Casino.Tests
{
    /// <summary>
    /// Demuestra que el port a C# calcula EXACTAMENTE lo mismo que la versión
    /// web, que es la que está verificada con millones de simulaciones.
    ///
    /// Los valores esperados están en GoldenVectors.cs, generado con
    /// tools/gen-unity-vectors.js ejecutando el JavaScript de verdad. Si algo
    /// del port se desvía —el generador aleatorio, el reparto de las tiras,
    /// la evaluación de líneas o la contabilidad— estos tests lo cazan.
    ///
    /// Cómo ejecutarlos: Window > General > Test Runner > EditMode > Run All.
    /// </summary>
    public class CasinoGoldenTests
    {
        // =====================================================================
        //  1. El generador aleatorio, bit a bit
        // =====================================================================

        [Test]
        public void Rng_ReproduceLaMismaSecuenciaQueLaWeb()
        {
            foreach (var (seed, expected) in GoldenVectors.Rng)
            {
                var rng = new Rng(seed);
                for (int i = 0; i < expected.Length; i++)
                {
                    double got = rng.NextDouble();
                    Assert.AreEqual(expected[i], got, 1e-15,
                        $"semilla {seed}, valor {i}: el generador no coincide con la versión web");
                }
            }
        }

        [Test]
        public void Rng_SiempreDevuelveValoresEnRango()
        {
            var rng = new Rng(12345u);
            for (int i = 0; i < 200000; i++)
            {
                double v = rng.NextDouble();
                Assert.GreaterOrEqual(v, 0.0);
                Assert.Less(v, 1.0);
            }
        }

        [Test]
        public void Rng_RangeRespetaLosLimites()
        {
            var rng = new Rng(7u);
            var seen = new HashSet<int>();
            for (int i = 0; i < 50000; i++)
            {
                int v = rng.Range(1, 6);
                Assert.GreaterOrEqual(v, 1);
                Assert.LessOrEqual(v, 6);
                seen.Add(v);
            }
            Assert.AreEqual(6, seen.Count, "un dado de 6 caras debe sacar las 6");
        }

        // =====================================================================
        //  2. Las tiras de los carretes
        // =====================================================================

        [Test]
        public void Tiras_SonIdenticasALasDeLaWeb()
        {
            foreach (var (seed, expected) in GoldenVectors.Strips)
            {
                var strip = SlotsLogic.BuildStrip(new Rng(seed));
                Assert.AreEqual(expected.Length, strip.Length, $"semilla {seed}: longitud distinta");
                for (int i = 0; i < expected.Length; i++)
                {
                    Assert.AreEqual(expected[i], strip[i],
                        $"semilla {seed}, posición {i}: símbolo distinto al de la versión web");
                }
            }
        }

        [Test]
        public void Tiras_LlevanElRecuentoExactoDeCadaSimbolo()
        {
            for (uint seed = 0; seed < 500; seed++)
            {
                var strip = SlotsLogic.BuildStrip(new Rng(seed));
                var counts = new Dictionary<string, int>();
                foreach (var id in strip)
                {
                    counts.TryGetValue(id, out int c);
                    counts[id] = c + 1;
                }
                foreach (var sym in SlotsLogic.Symbols)
                {
                    counts.TryGetValue(sym.Id, out int got);
                    Assert.AreEqual(sym.N, got, $"semilla {seed}: {sym.Id} aparece {got} veces, esperadas {sym.N}");
                }
            }
        }

        [Test]
        public void Tiras_NuncaPonenDosEspecialesEnLaMismaVentana()
        {
            // Si dos estrellas caben en la misma ventana de 3 celdas, el bono se
            // dispara el doble de a menudo. Esta separación es lo que mantiene
            // la frecuencia en 1/140 en lugar de variar entre 1/91 y 1/141.
            for (uint seed = 0; seed < 500; seed++)
            {
                var strip = SlotsLogic.BuildStrip(new Rng(seed));
                int len = strip.Length;
                for (int i = 0; i < len; i++)
                {
                    int scatters = 0, wilds = 0;
                    for (int k = 0; k < SlotsLogic.Rows; k++)
                    {
                        string id = strip[(i + k) % len];
                        if (id == SlotsLogic.ScatterId) scatters++;
                        if (id == SlotsLogic.WildId) wilds++;
                    }
                    Assert.LessOrEqual(scatters, 1, $"semilla {seed}, ventana {i}: dos estrellas juntas");
                    Assert.LessOrEqual(wilds, 1, $"semilla {seed}, ventana {i}: dos comodines juntos");
                }
            }
        }

        // =====================================================================
        //  3. La evaluación de pantallas
        // =====================================================================

        [Test]
        public void Evaluacion_CoincideConLaWebEnCadaPantalla()
        {
            foreach (var c in GoldenVectors.Grids)
            {
                var ev = SlotsLogic.Evaluate(c.Grid);
                Assert.AreEqual(c.LineMult, ev.LineMult, $"{c.Name}: multiplicador de líneas");
                Assert.AreEqual(c.ScatterMult, ev.ScatterMult, $"{c.Name}: multiplicador de dispersas");
                Assert.AreEqual(c.LineCount, ev.Lines.Count, $"{c.Name}: número de líneas premiadas");
                Assert.AreEqual(c.ScatterCount, ev.HasScatter ? ev.Scatter.Count : 0, $"{c.Name}: dispersas");
                Assert.AreEqual(c.ScatterSpins, ev.HasScatter ? ev.Scatter.Spins : 0, $"{c.Name}: giros gratis");
                Assert.AreEqual(c.Payout10, SlotsLogic.PayoutFor(ev, 10m), $"{c.Name}: premio con 10 € de apuesta");
                Assert.AreEqual(c.Payout10Free, SlotsLogic.PayoutFor(ev, 10m, SlotsLogic.FreeMultiplier),
                    $"{c.Name}: premio en giro gratis");
            }
        }

        [Test]
        public void Evaluacion_UnSimboloDesconocidoNoRompe()
        {
            var grid = new string[5][];
            for (int i = 0; i < 5; i++) grid[i] = new[] { "zzz", "zzz", "zzz" };
            Assert.DoesNotThrow(() => SlotsLogic.Evaluate(grid));
        }

        [Test]
        public void Simbolos_SumanLaLongitudDeLaTira()
        {
            int total = 0;
            foreach (var s in SlotsLogic.Symbols) total += s.N;
            Assert.AreEqual(SlotsLogic.StripLength, total);
            Assert.AreEqual(10, SlotsLogic.Symbols.Length);
        }

        // =====================================================================
        //  4. Sesiones largas: mismo dinero, mismo número de premios
        // =====================================================================

        [Test]
        public void Sesion_DevuelveElMismoDineroQueLaWeb()
        {
            foreach (var s in GoldenVectors.Sessions)
            {
                var rng = new Rng(s.Seed);
                var strips = new string[SlotsLogic.Reels][];
                for (int i = 0; i < SlotsLogic.Reels; i++) strips[i] = SlotsLogic.BuildStrip(rng);

                decimal wagered = 0m, returned = 0m;
                int owed = 0, hits = 0;

                for (int i = 0; i < s.Spins; i++)
                {
                    bool free = owed > 0;
                    if (free) owed--; else wagered += 10m;

                    var grid = new string[SlotsLogic.Reels][];
                    for (int r = 0; r < SlotsLogic.Reels; r++)
                    {
                        int p = rng.Range(0, SlotsLogic.StripLength - 1);
                        grid[r] = new string[SlotsLogic.Rows];
                        for (int f = 0; f < SlotsLogic.Rows; f++)
                            grid[r][f] = strips[r][(p + f) % SlotsLogic.StripLength];
                    }

                    var ev = SlotsLogic.Evaluate(grid);
                    decimal win = SlotsLogic.PayoutFor(ev, 10m, free ? SlotsLogic.FreeMultiplier : 1);
                    returned += win;
                    if (win > 0m) hits++;
                    if (ev.HasScatter) owed += ev.Scatter.Spins;
                }

                Assert.AreEqual(s.Wagered, wagered, $"semilla {s.Seed}: apostado");
                Assert.AreEqual(s.Returned, decimal.Round(returned, 2), $"semilla {s.Seed}: devuelto");
                Assert.AreEqual(s.Hits, hits, $"semilla {s.Seed}: número de premios");
            }
        }

        // =====================================================================
        //  5. El banco: invariantes del dinero
        // =====================================================================

        [Test]
        public void Banco_SigueLosMismosPasosQueLaWeb()
        {
            var bank = new Bank(100000L);
            var steps = GoldenVectors.BankSteps;
            int i = 0;

            void Check(string label)
            {
                Assert.AreEqual(steps[i].cents, bank.BalanceCents,
                    $"paso «{steps[i].label}»: el saldo no coincide con la versión web");
                i++;
            }

            Check("inicio");
            var r = bank.OpenRound("slots", 10m); Check("tras apostar 10");
            r.Settle(25m); Check("tras ganar 25");
            r = bank.OpenRound("slots", 7.5m); Check("tras apostar 7,50");
            r.Raise(7.5m); Check("tras doblar");
            r.Settle(0m); Check("tras perder");
            r = bank.OpenRound("bj", 3.33m); Check("tras apostar 3,33");
            r.Settle(3.33m); Check("tras empatar");
            bank.Credit(50m, "bonus"); Check("tras bonus");

            long before = bank.BalanceCents;
            for (int k = 0; k < 1000; k++)
            {
                var x = bank.OpenRound("t", 0.10m);
                x.Settle(0.10m);
            }
            Assert.AreEqual(before, bank.BalanceCents,
                "mil rondas de 0,10 € devueltas deben dejar el saldo idéntico (sin deriva decimal)");
            Check("1000 rondas de 0,10 devueltas");

            Assert.AreEqual(GoldenVectors.BankLedgerDebit, bank.LedgerDebitCents, "débitos del libro mayor");
            Assert.AreEqual(GoldenVectors.BankLedgerCredit, bank.LedgerCreditCents, "créditos del libro mayor");
            Assert.IsTrue(bank.Audit(100000L), "el cuadre final debe ser exacto");
        }

        [Test]
        public void Banco_LiquidarDosVecesLanza()
        {
            var bank = new Bank(100000L);
            var r = bank.OpenRound("t", 10m);
            r.Settle(20m);
            var ex = Assert.Throws<BankException>(() => r.Settle(5m));
            Assert.AreEqual(BankErrorCode.DoubleSettle, ex.Code);
        }

        [Test]
        public void Banco_DosRondasDelMismoJuegoLanza()
        {
            var bank = new Bank(100000L);
            bank.OpenRound("t", 10m);
            var ex = Assert.Throws<BankException>(() => bank.OpenRound("t", 10m));
            Assert.AreEqual(BankErrorCode.RoundInProgress, ex.Code);
        }

        [Test]
        public void Banco_ApostarMasQueElSaldoLanza()
        {
            var bank = new Bank(1000L);           // 10 €
            var ex = Assert.Throws<BankException>(() => bank.OpenRound("t", 999m));
            Assert.AreEqual(BankErrorCode.InsufficientFunds, ex.Code);
            Assert.AreEqual(1000L, bank.BalanceCents, "un intento fallido no debe mover el saldo");
        }

        [TestCase(0)]
        [TestCase(-5)]
        public void Banco_ApuestasInvalidasLanzan(int euros)
        {
            var bank = new Bank(100000L);
            Assert.Throws<BankException>(() => bank.OpenRound("t", euros));
        }

        [Test]
        public void Banco_CancelarDevuelveLaApuestaIntegra()
        {
            var bank = new Bank(10000L);          // 100 €
            var r = bank.OpenRound("t", 30m);
            r.Raise(20m);
            Assert.AreEqual(5000L, bank.BalanceCents, "100 − 30 − 20 = 50 €");
            r.Cancel();
            Assert.AreEqual(10000L, bank.BalanceCents, "al anular se devuelve todo");
        }

        [Test]
        public void Banco_ElSaldoNuncaQuedaNegativo()
        {
            var bank = new Bank(5000L);
            int guard = 0;
            while (bank.BalanceCents > 0 && guard++ < 5000)
            {
                var r = bank.OpenRound("t", bank.Balance);
                r.Settle(0m);
                Assert.GreaterOrEqual(bank.BalanceCents, 0L);
            }
            Assert.AreEqual(0L, bank.BalanceCents, "arruinarse deja exactamente 0, no un negativo diminuto");
        }

        [Test]
        public void Banco_CuadraTrasUnaSesionLarga()
        {
            var bank = new Bank(1000000L);
            const long opening = 1000000L;
            var rng = new Rng(777u);
            var ids = new[] { "slots", "ruleta", "bj", "poker", "dados", "minas" };
            decimal[] mults = { 0m, 0m, 0m, 1m, 2m, 2.5m, 10m };

            for (int i = 0; i < 20000; i++)
            {
                if (bank.Balance < 0.5m) bank.Credit(500m, "rescate");
                string id = rng.Pick(ids);
                decimal stake = rng.Pick(new[] { 0.5m, 1m, 5m, 25m });
                if (stake > bank.Balance) continue;

                var r = bank.OpenRound(id, stake);
                if (rng.Chance(0.15) && r.CanRaise(stake)) r.Raise(stake);
                r.Settle(Money.RoundToCent(r.Stake * rng.Pick(mults)));

                Assert.IsTrue(bank.Audit(opening), $"descuadre en la ronda {i}");
                Assert.GreaterOrEqual(bank.BalanceCents, 0L);
            }

            long wag = 0, ret = 0;
            foreach (var kv in bank.PerGame) { wag += kv.Value.WageredCents; ret += kv.Value.ReturnedCents; }
            Assert.AreEqual(bank.Totals.WageredCents, wag, "lo apostado por juego debe sumar el total");
            Assert.AreEqual(bank.Totals.ReturnedCents, ret, "lo devuelto por juego debe sumar el total");
        }

        // =====================================================================
        //  6. Formato y lectura de importes
        // =====================================================================

        [Test]
        public void Dinero_SeFormateaEnEspanol()
        {
            Assert.AreEqual("1.234,50 €", Money.Format(1234.5m));
            Assert.AreEqual("0,00 €", Money.Format(0m));
            Assert.AreEqual("-99,90 €", Money.Format(-99.9m));
        }

        [TestCase("12,50", 12.50)]
        [TestCase("12.50", 12.50)]
        [TestCase("1.234,50", 1234.50)]
        [TestCase("5", 5.0)]
        [TestCase("5,00 €", 5.0)]
        public void Dinero_AceptaComaYPunto(string text, double expected)
        {
            Assert.IsTrue(Money.TryParse(text, out decimal v), $"no supo leer «{text}»");
            Assert.AreEqual((decimal)expected, v);
        }

        [TestCase("")]
        [TestCase("abc")]
        [TestCase("   ")]
        public void Dinero_RechazaLoQueNoEsUnNumero(string text)
        {
            Assert.IsFalse(Money.TryParse(text, out _));
        }

        [Test]
        public void Dinero_ConvierteSinPerderCentimos()
        {
            for (int c = -100000; c <= 100000; c += 7)
            {
                Assert.AreEqual(c, Money.ToCents(Money.ToEuros(c)), $"ida y vuelta falló en {c} céntimos");
            }
        }
    }
}
