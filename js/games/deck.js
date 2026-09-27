/* =========================================================================
   deck.js — baraja francesa y evaluador de manos, compartido por
   blackjack, video póker, baccarat e hi-lo.
   ========================================================================= */
(function (root) {
  'use strict';
  var U = root.Casino.util;

  var SUITS = [
    { id: 's', symbol: '♠', name: 'picas',    red: false },
    { id: 'h', symbol: '♥', name: 'corazones', red: true },
    { id: 'd', symbol: '♦', name: 'diamantes', red: true },
    { id: 'c', symbol: '♣', name: 'tréboles',  red: false }
  ];

  /** rank: 1=A, 11=J, 12=Q, 13=K */
  var RANK_LABEL = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };

  function label(rank) {
    return RANK_LABEL[rank] || String(rank);
  }

  function card(rank, suitId) {
    var s = SUITS.filter(function (x) { return x.id === suitId; })[0];
    return { rank: rank, suit: s.id, symbol: s.symbol, red: s.red, label: label(rank), id: label(rank) + s.id };
  }

  /** Baraja de `decks` mazos, ya mezclada. */
  function build(decks, rng) {
    var out = [];
    var n = decks || 1;
    for (var d = 0; d < n; d++) {
      for (var s = 0; s < SUITS.length; s++) {
        for (var r = 1; r <= 13; r++) out.push(card(r, SUITS[s].id));
      }
    }
    return (rng || U.createRng()).shuffle(out);
  }

  /**
   * Zapato con reposición automática: nunca se queda sin cartas a mitad de
   * una mano (causa clásica de bugs en blackjack).
   */
  function shoe(decks, rng, penetration) {
    var r = rng || U.createRng();
    var n = decks || 6;
    var cards = build(n, r);
    var pen = penetration === undefined ? 0.75 : penetration;
    var cut = Math.floor(cards.length * (1 - pen));
    var needsShuffle = false;

    return {
      /** Reparte una carta; rellena si se agota. */
      draw: function () {
        if (!cards.length) { cards = build(n, r); needsShuffle = false; }
        return cards.pop();
      },
      get remaining() { return cards.length; },
      /** ¿Toca mezclar antes de la siguiente mano? */
      get exhausted() { return cards.length <= cut; },
      /** Mezcla sólo entre manos, nunca en medio. */
      reshuffle: function () {
        cards = build(n, r);
        needsShuffle = false;
        return true;
      },
      get needsShuffle() { return needsShuffle; }
    };
  }

  /* ----------------------------- BLACKJACK ----------------------------- */

  /** Valor de una carta en blackjack (A cuenta 11 y se ajusta luego). */
  function bjCardValue(c) {
    if (c.rank === 1) return 11;
    return c.rank >= 10 ? 10 : c.rank;
  }

  /** Puntúa una mano: {total, soft, bust, blackjack} */
  function bjScore(hand) {
    var total = 0, aces = 0;
    hand.forEach(function (c) {
      total += bjCardValue(c);
      if (c.rank === 1) aces++;
    });
    // Cada as de 11 pasa a valer 1 mientras nos pasemos de 21.
    var softAces = aces;
    while (total > 21 && softAces > 0) { total -= 10; softAces--; }
    return {
      total: total,
      soft: softAces > 0 && total <= 21,
      bust: total > 21,
      blackjack: hand.length === 2 && total === 21
    };
  }

  /* ----------------------------- PÓKER ----------------------------- */

  var HANDS = {
    ROYAL_FLUSH:     { key: 'ROYAL_FLUSH',     name: 'Escalera de color real', rank: 9 },
    STRAIGHT_FLUSH:  { key: 'STRAIGHT_FLUSH',  name: 'Escalera de color',      rank: 8 },
    FOUR_KIND:       { key: 'FOUR_KIND',       name: 'Póker',                  rank: 7 },
    FULL_HOUSE:      { key: 'FULL_HOUSE',      name: 'Full',                   rank: 6 },
    FLUSH:           { key: 'FLUSH',           name: 'Color',                  rank: 5 },
    STRAIGHT:        { key: 'STRAIGHT',        name: 'Escalera',               rank: 4 },
    THREE_KIND:      { key: 'THREE_KIND',      name: 'Trío',                   rank: 3 },
    TWO_PAIR:        { key: 'TWO_PAIR',        name: 'Doble pareja',           rank: 2 },
    JACKS_BETTER:    { key: 'JACKS_BETTER',    name: 'Pareja de J o mejor',    rank: 1 },
    LOW_PAIR:        { key: 'LOW_PAIR',        name: 'Pareja baja',            rank: 0.5 },
    NOTHING:         { key: 'NOTHING',         name: 'Nada',                   rank: 0 }
  };

  /**
   * Evalúa 5 cartas para video póker (Jacks or Better).
   * Devuelve {key, name, rank, cards:[índices que forman la mano]}
   */
  function evaluatePoker(hand) {
    if (hand.length !== 5) throw new Error('Se esperaban 5 cartas.');

    var counts = {};        // rank -> [índices]
    var suitCounts = {};    // suit -> nº
    hand.forEach(function (c, i) {
      (counts[c.rank] || (counts[c.rank] = [])).push(i);
      suitCounts[c.suit] = (suitCounts[c.suit] || 0) + 1;
    });

    var ranks = hand.map(function (c) { return c.rank; }).slice().sort(function (a, b) { return a - b; });
    var isFlush = Object.keys(suitCounts).some(function (s) { return suitCounts[s] === 5; });

    /* escalera: 5 consecutivos, con A-2-3-4-5 y 10-J-Q-K-A */
    var unique = ranks.filter(function (r, i) { return ranks.indexOf(r) === i; });
    var isStraight = false, straightHigh = 0;
    if (unique.length === 5) {
      if (unique[4] - unique[0] === 4) { isStraight = true; straightHigh = unique[4]; }
      // A-10-J-Q-K: el as vale 14
      else if (unique.join(',') === '1,10,11,12,13') { isStraight = true; straightHigh = 14; }
    }

    var all = [0, 1, 2, 3, 4];

    if (isStraight && isFlush) {
      return straightHigh === 14
        ? Object.assign({}, HANDS.ROYAL_FLUSH, { cards: all })
        : Object.assign({}, HANDS.STRAIGHT_FLUSH, { cards: all });
    }

    var groups = Object.keys(counts).map(function (r) {
      return { rank: Number(r), idx: counts[r] };
    }).sort(function (a, b) { return b.idx.length - a.idx.length; });

    if (groups[0].idx.length === 4) {
      return Object.assign({}, HANDS.FOUR_KIND, { cards: groups[0].idx });
    }
    if (groups[0].idx.length === 3 && groups[1] && groups[1].idx.length === 2) {
      return Object.assign({}, HANDS.FULL_HOUSE, { cards: all });
    }
    if (isFlush) return Object.assign({}, HANDS.FLUSH, { cards: all });
    if (isStraight) return Object.assign({}, HANDS.STRAIGHT, { cards: all });
    if (groups[0].idx.length === 3) {
      return Object.assign({}, HANDS.THREE_KIND, { cards: groups[0].idx });
    }
    if (groups[0].idx.length === 2 && groups[1] && groups[1].idx.length === 2) {
      return Object.assign({}, HANDS.TWO_PAIR, { cards: groups[0].idx.concat(groups[1].idx) });
    }
    if (groups[0].idx.length === 2) {
      var r = groups[0].rank;
      // J(11), Q(12), K(13) o A(1) pagan; el resto es pareja baja.
      var high = r === 1 || r >= 11;
      return Object.assign({}, high ? HANDS.JACKS_BETTER : HANDS.LOW_PAIR, { cards: groups[0].idx });
    }
    return Object.assign({}, HANDS.NOTHING, { cards: [] });
  }

  /* ----------------------------- BACCARAT ----------------------------- */

  /** En baccarat sólo cuenta la unidad: 10 y figuras valen 0. */
  function bacValue(c) {
    if (c.rank >= 10) return 0;
    return c.rank; // el as vale 1
  }

  function bacScore(hand) {
    var t = 0;
    hand.forEach(function (c) { t += bacValue(c); });
    return t % 10;
  }

  root.Casino.deck = {
    SUITS: SUITS, card: card, build: build, shoe: shoe, label: label,
    bjCardValue: bjCardValue, bjScore: bjScore,
    HANDS: HANDS, evaluatePoker: evaluatePoker,
    bacValue: bacValue, bacScore: bacScore
  };
})(typeof window !== 'undefined' ? window : globalThis);
