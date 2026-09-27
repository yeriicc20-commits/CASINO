using System;
using System.Collections.Generic;

namespace Casino.Core
{
    public enum BankErrorCode
    {
        InvalidStake,
        InvalidReturn,
        InsufficientFunds,
        RoundInProgress,
        DoubleSettle,
        RoundClosed,
        NegativeBalance,
        InvalidGame
    }

    public sealed class BankException : Exception
    {
        public BankErrorCode Code { get; }
        public long NeedCents { get; }
        public long HaveCents { get; }

        public BankException(BankErrorCode code, string message, long need = 0, long have = 0)
            : base(message)
        {
            Code = code;
            NeedCents = need;
            HaveCents = have;
        }
    }

    public enum Outcome { Loss, Push, Win }

    /// <summary>Resultado de liquidar una ronda.</summary>
    public struct RoundResult
    {
        public string GameId;
        public decimal Stake;
        public decimal Returned;
        public decimal Net;
        public double Multiplier;
        public Outcome Outcome;
    }

    /// <summary>
    /// Una ronda de juego. La apuesta se cobra al abrirla y se liquida UNA vez.
    /// No se construye directamente: sale de <see cref="Bank.OpenRound"/>.
    /// </summary>
    public sealed class Round
    {
        private readonly Bank _bank;

        public int Id { get; }
        public string GameId { get; }
        public long StakeCents { get; internal set; }
        public long ReturnedCents { get; private set; }
        public bool Settled { get; private set; }
        public bool Cancelled { get; private set; }

        /// <summary>Desglose de la apuesta: base y cada subida.</summary>
        public IReadOnlyList<long> Parts => _parts;
        private readonly List<long> _parts = new List<long>();

        public decimal Stake => Money.ToEuros(StakeCents);
        public decimal Returned => Money.ToEuros(ReturnedCents);
        public decimal Net => Money.ToEuros(ReturnedCents - StakeCents);

        internal Round(Bank bank, int id, string gameId, long stakeCents)
        {
            _bank = bank;
            Id = id;
            GameId = gameId;
            StakeCents = stakeCents;
            _parts.Add(stakeCents);
        }

        /// <summary>¿Se puede subir la apuesta en `euros` sin pasarse del saldo?</summary>
        public bool CanRaise(decimal euros)
        {
            if (Settled) return false;
            if (euros <= 0m) return false;
            return Money.ToCents(euros) <= _bank.BalanceCents;
        }

        /// <summary>Dinero extra sobre la misma ronda: doblar, separar, seguro.</summary>
        public Round Raise(decimal euros)
        {
            if (Settled)
            {
                throw new BankException(BankErrorCode.RoundClosed,
                    "La ronda ya está liquidada; no se puede subir la apuesta.");
            }
            long cents = Bank.NormalizeStake(euros);
            if (cents > _bank.BalanceCents)
            {
                throw new BankException(BankErrorCode.InsufficientFunds,
                    "Saldo insuficiente para subir la apuesta.", cents, _bank.BalanceCents);
            }
            _bank.ApplyDelta(-cents, "raise:" + GameId);
            StakeCents += cents;
            _parts.Add(cents);
            return this;
        }

        /// <summary>
        /// Cierra la ronda devolviendo `euros` al jugador (TOTAL, apuesta incluida).
        ///   perder    -> Settle(0)
        ///   empatar   -> Settle(round.Stake)
        ///   ganar 1:1 -> Settle(round.Stake * 2)
        /// </summary>
        public RoundResult Settle(decimal euros)
        {
            if (Settled)
            {
                throw new BankException(BankErrorCode.DoubleSettle,
                    "Esta ronda ya se había liquidado.");
            }
            long retCents = Bank.NormalizeReturn(euros);
            Settled = true;
            ReturnedCents = retCents;
            return _bank.CloseRound(this, retCents);
        }

        /// <summary>Anula la ronda y devuelve la apuesta íntegra (no cuenta como jugada).</summary>
        public void Cancel()
        {
            if (Settled)
            {
                throw new BankException(BankErrorCode.RoundClosed,
                    "La ronda ya está liquidada; no se puede anular.");
            }
            Settled = true;
            Cancelled = true;
            ReturnedCents = StakeCents;
            _bank.CancelRound(this);
        }
    }

    /// <summary>
    /// ÚNICA fuente de verdad del dinero.
    ///
    /// Ningún juego toca el saldo: todo pasa por una ronda. Eso da cuatro
    /// garantías por construcción, no por disciplina del programador:
    ///
    ///   1. La apuesta se cobra UNA vez, al abrir la ronda.
    ///   2. Settle() sólo puede llamarse UNA vez; la segunda lanza.
    ///   3. No puede haber dos rondas abiertas del mismo juego a la vez,
    ///      así un doble clic nunca cobra dos veces.
    ///   4. El saldo nunca queda negativo: se valida ANTES de cobrar.
    ///
    /// Además el libro mayor permite auditar el cuadre exacto en cualquier
    /// momento: saldo == inicial - débitos + créditos.
    /// </summary>
    public sealed class Bank
    {
        /// <summary>
        /// Tope de saldo: 10.000 millones de euros.
        /// Los long aguantan mucho más, pero este tope mantiene las cifras en
        /// un rango donde cualquier conversión intermedia sigue siendo exacta.
        /// Con ventaja de la casa en las 12 máquinas nadie se acerca.
        /// </summary>
        public const long MaxBalanceCents = 1_000_000_000_000L;

        private readonly Dictionary<string, Round> _open = new Dictionary<string, Round>();
        private int _seq;
        private bool _warnedCap;

        public long BalanceCents { get; private set; }
        public decimal Balance => Money.ToEuros(BalanceCents);

        public long LedgerDebitCents { get; private set; }
        public long LedgerCreditCents { get; private set; }

        /// <summary>Estadísticas acumuladas. El banco las lleva porque es quien ve todo el dinero.</summary>
        public BankTotals Totals { get; } = new BankTotals();
        public Dictionary<string, GameTotals> PerGame { get; } = new Dictionary<string, GameTotals>();

        // --- eventos para que la interfaz reaccione sin preguntar ---
        public event Action<long, long, string> BalanceChanged;   // (saldoCents, deltaCents, motivo)
        public event Action<Round> RoundOpened;
        public event Action<RoundResult> RoundSettled;

        public Bank(long openingCents)
        {
            BalanceCents = openingCents;
            Totals.PeakBalanceCents = openingCents;
        }

        internal static long NormalizeStake(decimal euros)
        {
            long cents = Money.ToCents(euros);
            if (cents <= 0)
            {
                throw new BankException(BankErrorCode.InvalidStake, "La apuesta debe ser mayor que 0.");
            }
            return cents;
        }

        internal static long NormalizeReturn(decimal euros)
        {
            if (euros < 0m)
            {
                throw new BankException(BankErrorCode.InvalidReturn, "El importe devuelto no es válido.");
            }
            return Money.ToCents(euros);
        }

        public bool CanAfford(decimal euros)
        {
            if (euros <= 0m) return false;
            return Money.ToCents(euros) <= BalanceCents;
        }

        public bool HasOpenRound(string gameId)
        {
            return gameId != null && _open.ContainsKey(gameId);
        }

        public Round GetOpenRound(string gameId)
        {
            if (gameId == null) return null;
            return _open.TryGetValue(gameId, out var r) ? r : null;
        }

        /// <summary>Abre una ronda cobrando la apuesta inmediatamente.</summary>
        public Round OpenRound(string gameId, decimal stakeEuros)
        {
            if (string.IsNullOrEmpty(gameId))
            {
                throw new BankException(BankErrorCode.InvalidGame, "Falta el identificador del juego.");
            }
            if (_open.ContainsKey(gameId))
            {
                throw new BankException(BankErrorCode.RoundInProgress,
                    "Ya hay una ronda en curso en este juego.");
            }
            long cents = NormalizeStake(stakeEuros);
            if (cents > BalanceCents)
            {
                throw new BankException(BankErrorCode.InsufficientFunds,
                    "Saldo insuficiente para esta apuesta.", cents, BalanceCents);
            }

            var round = new Round(this, ++_seq, gameId, cents);
            _open[gameId] = round;
            ApplyDelta(-cents, "stake:" + gameId);
            RoundOpened?.Invoke(round);
            return round;
        }

        internal RoundResult CloseRound(Round round, long retCents)
        {
            _open.Remove(round.GameId);
            if (retCents > 0) ApplyDelta(retCents, "payout:" + round.GameId);

            long netCents = retCents - round.StakeCents;
            double mult = round.StakeCents > 0 ? (double)retCents / round.StakeCents : 0.0;
            Outcome outcome = netCents > 0 ? Outcome.Win : netCents < 0 ? Outcome.Loss : Outcome.Push;

            var g = GetGameTotals(round.GameId);
            Totals.Rounds++; g.Rounds++;
            Totals.WageredCents += round.StakeCents; g.WageredCents += round.StakeCents;
            Totals.ReturnedCents += retCents; g.ReturnedCents += retCents;
            if (outcome == Outcome.Win)
            {
                Totals.Wins++; g.Wins++;
                if (netCents > Totals.BiggestWinCents) Totals.BiggestWinCents = netCents;
                if (netCents > g.BiggestWinCents) g.BiggestWinCents = netCents;
                if (mult > Totals.BiggestMultiplier) Totals.BiggestMultiplier = mult;
            }
            else if (outcome == Outcome.Loss) { Totals.Losses++; g.Losses++; }
            else { Totals.Pushes++; g.Pushes++; }

            var result = new RoundResult
            {
                GameId = round.GameId,
                Stake = round.Stake,
                Returned = Money.ToEuros(retCents),
                Net = Money.ToEuros(netCents),
                Multiplier = mult,
                Outcome = outcome
            };
            RoundSettled?.Invoke(result);
            return result;
        }

        internal void CancelRound(Round round)
        {
            _open.Remove(round.GameId);
            if (round.StakeCents > 0) ApplyDelta(round.StakeCents, "refund:" + round.GameId);
        }

        /// <summary>Ingreso fuera de ronda: bonus diario, rescate, logros.</summary>
        public decimal Credit(decimal euros, string reason = "credit")
        {
            long cents = NormalizeReturn(euros);
            if (cents == 0) return Balance;
            ApplyDelta(cents, reason);
            return Balance;
        }

        internal void ApplyDelta(long deltaCents, string reason)
        {
            long next = BalanceCents + deltaCents;
            if (next < 0)
            {
                // No debería ocurrir: OpenRound y Raise validan antes de cobrar.
                throw new BankException(BankErrorCode.NegativeBalance,
                    "Operación rechazada: dejaría el saldo en negativo.");
            }
            if (next > MaxBalanceCents)
            {
                if (!_warnedCap)
                {
                    _warnedCap = true;
                    UnityEngine.Debug.LogWarning(
                        "[Casino] Saldo topado en " + Money.FormatCents(MaxBalanceCents) +
                        " para mantener la aritmética exacta.");
                }
                deltaCents -= (next - MaxBalanceCents);
                next = MaxBalanceCents;
            }

            BalanceCents = next;
            if (deltaCents < 0) LedgerDebitCents += -deltaCents;
            else LedgerCreditCents += deltaCents;
            if (next > Totals.PeakBalanceCents) Totals.PeakBalanceCents = next;

            BalanceChanged?.Invoke(BalanceCents, deltaCents, reason);
        }

        public GameTotals GetGameTotals(string gameId)
        {
            if (!PerGame.TryGetValue(gameId, out var g))
            {
                g = new GameTotals();
                PerGame[gameId] = g;
            }
            return g;
        }

        /// <summary>
        /// Comprueba el cuadre: saldo == inicial - débitos + créditos.
        /// Los tests y el panel de desarrollo lo usan como invariante.
        /// </summary>
        public bool Audit(long openingCents, out long expected)
        {
            expected = openingCents - LedgerDebitCents + LedgerCreditCents;
            return expected == BalanceCents;
        }

        public bool Audit(long openingCents)
        {
            return Audit(openingCents, out _);
        }

        /// <summary>Sólo para tests y para reiniciar la partida.</summary>
        public void ResetLedger()
        {
            LedgerDebitCents = 0;
            LedgerCreditCents = 0;
        }

        public void ClearRounds()
        {
            _open.Clear();
        }

        public void SetBalanceCents(long cents)
        {
            BalanceCents = Math.Max(0, Math.Min(cents, MaxBalanceCents));
        }
    }

    [Serializable]
    public class BankTotals
    {
        public long WageredCents;
        public long ReturnedCents;
        public int Rounds;
        public int Wins;
        public int Losses;
        public int Pushes;
        public long BiggestWinCents;
        public double BiggestMultiplier;
        public long PeakBalanceCents;
    }

    [Serializable]
    public class GameTotals
    {
        public int Rounds;
        public long WageredCents;
        public long ReturnedCents;
        public int Wins;
        public int Losses;
        public int Pushes;
        public long BiggestWinCents;
    }
}
