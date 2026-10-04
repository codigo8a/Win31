/** DOM-free Klondike. Top of stock/waste/foundation is the last array element. */
export const SUITS = ["C", "D", "H", "S"];
export const isRed = (card) => card.suit === "D" || card.suit === "H";
export const cardName = (card) =>
  `${{ 1: "Ace", 11: "Jack", 12: "Queen", 13: "King" }[card.rank] || card.rank} of ${{ C: "Clubs", D: "Diamonds", H: "Hearts", S: "Spades" }[card.suit]}`;
export class Solitaire {
  constructor({
    rng = Math.random,
    now = Date.now,
    draw = 1,
    timed = true,
    scoring = "standard",
    cumulative = false,
    bankroll = 0,
  } = {}) {
    this.rng = rng;
    this.now = now;
    this.drawCount = draw === 3 ? 3 : 1;
    this.timed = !!timed;
    this.scoring = ["standard", "vegas", "none"].includes(scoring)
      ? scoring
      : "standard";
    this.cumulative = this.scoring === "vegas" && !!cumulative;
    this.bankroll = Number.isFinite(bankroll) ? Math.trunc(bankroll) : 0;
    this.newGame();
  }
  newGame({ bankroll } = {}) {
    const openingBalance = this.cumulative
      ? Number.isFinite(bankroll)
        ? Math.trunc(bankroll)
        : Number.isFinite(this.score)
          ? this.score
          : this.bankroll
      : 0;
    const cards = SUITS.flatMap((suit) =>
      Array.from({ length: 13 }, (_, n) => ({
        id: `${suit}${n + 1}`,
        suit,
        rank: n + 1,
        faceUp: false,
      })),
    );
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.max(0, Math.min(i, Math.floor(this.rng() * (i + 1))));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.tableau = Array.from({ length: 7 }, (_, col) =>
      Array.from({ length: col + 1 }, (_, n) => ({
        ...cards.pop(),
        faceUp: n === col,
      })),
    );
    this.stock = cards;
    this.waste = [];
    this.foundations = [[], [], [], []];
    this.bankroll = openingBalance;
    this.score = this.scoring === "vegas" ? openingBalance - 52 : 0;
    this.scoreTicks = 0;
    this.redeals = 0;
    this.startedAt = null;
    this.endedAt = null;
    this.pausedAt = null;
    this.pausedTotal = 0;
    this.history = [];
    this.moves = 0;
    this.status = "ready";
    return this;
  }
  get elapsedMilliseconds() {
    return this.startedAt === null
      ? 0
      : Math.max(
          0,
          (this.endedAt ?? this.pausedAt ?? this.now()) -
            this.startedAt -
            this.pausedTotal,
        );
  }
  get elapsed() {
    return Math.floor(this.elapsedMilliseconds / 1000);
  }
  get displayScore() {
    if (this.scoring === "none") return 0;
    if (this.scoring === "vegas") return this.score;
    return Math.max(
      0,
      this.score -
        (this.timed
          ? Math.max(0, Math.floor(this.elapsed / 10) - this.scoreTicks) * 2
          : 0),
    );
  }
  get maxPasses() {
    return this.scoring === "vegas" ? (this.drawCount === 3 ? 3 : 1) : Infinity;
  }
  get canRedeal() {
    return (
      !this.stock.length &&
      this.waste.length > 0 &&
      this.redeals < this.maxPasses - 1
    );
  }
  get canDraw() {
    return this.status !== "won" && (this.stock.length > 0 || this.canRedeal);
  }
  pause() {
    if (this.status === "playing" && this.pausedAt === null)
      this.pausedAt = this.now();
  }
  resume() {
    if (this.pausedAt !== null) {
      this.pausedTotal += Math.max(0, this.now() - this.pausedAt);
      this.pausedAt = null;
    }
  }
  setTimed(timed) {
    this.score = this.displayScore;
    this.scoreTicks = Math.floor(this.elapsed / 10);
    this.timed = !!timed;
  }
  _award(standard, vegas = 0) {
    if (this.scoring === "standard")
      this.score = Math.max(0, this.score + standard);
    else if (this.scoring === "vegas") this.score += vegas;
  }
  _snapshot() {
    return JSON.parse(
      JSON.stringify({
        tableau: this.tableau,
        stock: this.stock,
        waste: this.waste,
        foundations: this.foundations,
        score: this.score,
        scoreTicks: this.scoreTicks,
        redeals: this.redeals,
        moves: this.moves,
        status: this.status,
        endedAt: this.endedAt,
      }),
    );
  }
  _begin() {
    this.resume();
    this.score = this.displayScore;
    this.scoreTicks = Math.floor(this.elapsed / 10);
    this.history.push(this._snapshot());
    if (this.startedAt === null) this.startedAt = this.now();
    this.status = "playing";
    this.moves++;
  }
  undo() {
    if (!this.history.length) return false;
    const snapshot = this.history.pop();
    Object.assign(this, snapshot);
    if (this.startedAt !== null && this.status === "ready")
      this.status = "playing";
    return true;
  }
  pile(source) {
    if (source?.type === "tableau") return this.tableau[source.index];
    if (source?.type === "foundation") return this.foundations[source.index];
    if (source?.type === "waste") return this.waste;
    return null;
  }
  cardsAt(source) {
    const pile = this.pile(source);
    if (!pile?.length) return [];
    const from =
      source.type === "tableau"
        ? (source.cardIndex ?? pile.length - 1)
        : pile.length - 1;
    if (!Number.isInteger(from) || from < 0 || from >= pile.length) return [];
    const cards = pile.slice(from);
    if (cards.some((c) => !c.faceUp)) return [];
    for (let i = 1; i < cards.length; i++)
      if (
        cards[i - 1].rank !== cards[i].rank + 1 ||
        isRed(cards[i - 1]) === isRed(cards[i])
      )
        return [];
    return cards;
  }
  canMove(source, target) {
    if (this.status === "won" || !target) return false;
    if (source?.type === target.type && source.index === target.index)
      return false;
    const cards = this.cardsAt(source);
    if (!cards.length) return false;
    if (target.type === "tableau") {
      const pile = this.tableau[target.index];
      if (!pile) return false;
      const top = pile.at(-1);
      return top
        ? top.faceUp &&
            top.rank === cards[0].rank + 1 &&
            isRed(top) !== isRed(cards[0])
        : cards[0].rank === 13;
    }
    if (target.type === "foundation") {
      const pile = this.foundations[target.index];
      if (!pile || cards.length !== 1 || source.type === "foundation")
        return false;
      const top = pile.at(-1);
      return top
        ? top.suit === cards[0].suit && top.rank + 1 === cards[0].rank
        : cards[0].rank === 1;
    }
    return false;
  }
  move(source, target) {
    if (!this.canMove(source, target)) return false;
    this._begin();
    const sourcePile = this.pile(source),
      cards = this.cardsAt(source),
      targetPile = this.pile(target);
    sourcePile.splice(sourcePile.length - cards.length, cards.length);
    targetPile.push(...cards);
    if (source.type === "waste" && target.type === "tableau") this._award(5);
    if (target.type === "foundation") this._award(10, 5);
    if (source.type === "foundation" && target.type === "tableau")
      this._award(-15, -5);
    if (
      source.type === "tableau" &&
      sourcePile.length &&
      !sourcePile.at(-1).faceUp
    ) {
      sourcePile.at(-1).faceUp = true;
      this._award(5);
    }
    if (this.foundations.every((p) => p.length === 13)) {
      this.status = "won";
      this.endedAt = this.now();
      if (this.scoring === "standard" && this.timed && this.elapsed > 30)
        this.score += Math.floor(700000 / this.elapsed);
    }
    return true;
  }
  draw() {
    if (!this.canDraw) return false;
    this._begin();
    if (this.stock.length) {
      for (let i = 0; i < this.drawCount && this.stock.length; i++) {
        const card = this.stock.pop();
        card.faceUp = true;
        this.waste.push(card);
      }
    } else {
      this.stock = this.waste
        .reverse()
        .map((card) => ({ ...card, faceUp: false }));
      this.waste = [];
      this.redeals++;
      if (this.drawCount === 1) this._award(-100);
      else if (this.redeals > 2) this._award(-20);
    }
    return true;
  }
  autoFoundation(source) {
    for (let index = 0; index < 4; index++)
      if (this.move(source, { type: "foundation", index })) return true;
    return false;
  }
  legalMoves() {
    const sources = [];
    if (this.waste.length) sources.push({ type: "waste" });
    this.tableau.forEach((pile, index) =>
      pile.forEach((card, cardIndex) => {
        if (card.faceUp) sources.push({ type: "tableau", index, cardIndex });
      }),
    );
    this.foundations.forEach((pile, index) => {
      if (pile.length) sources.push({ type: "foundation", index });
    });
    const moves = [];
    for (const source of sources) {
      for (let index = 0; index < 4; index++)
        if (this.canMove(source, { type: "foundation", index }))
          moves.push({ source, target: { type: "foundation", index } });
      for (let index = 0; index < 7; index++)
        if (this.canMove(source, { type: "tableau", index }))
          moves.push({ source, target: { type: "tableau", index } });
    }
    return moves;
  }
  /** Versioned snapshot. Saved time pauses while the game is closed. */
  toJSON() {
    return {
      version: 1,
      settings: {
        draw: this.drawCount,
        timed: this.timed,
        scoring: this.scoring,
        cumulative: this.cumulative,
        bankroll: this.bankroll,
      },
      elapsedMs: this.elapsedMilliseconds,
      state: this._snapshot(),
      history: JSON.parse(JSON.stringify(this.history.slice(-100))),
    };
  }
  static fromJSON(data, { rng = Math.random, now = Date.now } = {}) {
    if (
      !data ||
      data.version !== 1 ||
      !data.settings ||
      !Number.isFinite(data.elapsedMs) ||
      data.elapsedMs < 0 ||
      data.elapsedMs > 31536000000
    )
      throw new Error("Invalid saved Solitaire game.");
    const settings = data.settings;
    if (
      ![1, 3].includes(settings.draw) ||
      !["standard", "vegas", "none"].includes(settings.scoring) ||
      typeof settings.timed !== "boolean" ||
      typeof settings.cumulative !== "boolean" ||
      !Number.isFinite(settings.bankroll)
    )
      throw new Error("Invalid saved Solitaire options.");
    const validate = (state) => {
      if (
        !state ||
        !Array.isArray(state.tableau) ||
        state.tableau.length !== 7 ||
        !Array.isArray(state.foundations) ||
        state.foundations.length !== 4 ||
        !Array.isArray(state.stock) ||
        !Array.isArray(state.waste) ||
        ![...state.tableau, ...state.foundations].every(Array.isArray)
      )
        return false;
      const cards = [
        ...state.stock,
        ...state.waste,
        ...state.tableau.flat(),
        ...state.foundations.flat(),
      ];
      if (
        cards.length !== 52 ||
        cards.some(
          (c) =>
            !c ||
            !SUITS.includes(c.suit) ||
            !Number.isInteger(c.rank) ||
            c.rank < 1 ||
            c.rank > 13 ||
            c.id !== `${c.suit}${c.rank}` ||
            typeof c.faceUp !== "boolean",
        ) ||
        new Set(cards.map((c) => c.id)).size !== 52
      )
        return false;
      if (
        state.stock.some((c) => c.faceUp) ||
        state.waste.some((c) => !c.faceUp)
      )
        return false;
      if (
        state.foundations.some((p) =>
          p.some(
            (c, i) => !c.faceUp || c.rank !== i + 1 || c.suit !== p[0].suit,
          ),
        )
      )
        return false;
      if (
        state.tableau.some(
          (p) =>
            p.length &&
            (!p.at(-1).faceUp ||
              p.some(
                (c, i) =>
                  i &&
                  p[i - 1].faceUp &&
                  (!c.faceUp ||
                    p[i - 1].rank !== c.rank + 1 ||
                    isRed(p[i - 1]) === isRed(c)),
              )),
        )
      )
        return false;
      if (
        !["ready", "playing", "won"].includes(state.status) ||
        !Number.isInteger(state.score) ||
        !Number.isInteger(state.moves) ||
        state.moves < 0 ||
        !Number.isInteger(state.redeals) ||
        state.redeals < 0 ||
        !Number.isInteger(state.scoreTicks) ||
        state.scoreTicks < 0
      )
        return false;
      if (
        (state.status === "won") !==
        state.foundations.every((p) => p.length === 13)
      )
        return false;
      if (
        settings.scoring === "vegas" &&
        state.redeals >= (settings.draw === 3 ? 3 : 1)
      )
        return false;
      return true;
    };
    if (!validate(data.state))
      throw new Error("Saved Solitaire cards are inconsistent.");
    const copyCard = (card) => ({
      id: card.id,
      suit: card.suit,
      rank: card.rank,
      faceUp: card.faceUp,
    });
    const copyState = (state) => ({
      tableau: state.tableau.map((p) => p.map(copyCard)),
      foundations: state.foundations.map((p) => p.map(copyCard)),
      stock: state.stock.map(copyCard),
      waste: state.waste.map(copyCard),
      score: state.score,
      scoreTicks: state.scoreTicks,
      redeals: state.redeals,
      moves: state.moves,
      status: state.status,
      endedAt: null,
    });
    const game = Object.create(Solitaire.prototype);
    game.rng = rng;
    game.now = now;
    game.drawCount = settings.draw;
    game.timed = settings.timed;
    game.scoring = settings.scoring;
    game.cumulative = settings.scoring === "vegas" && settings.cumulative;
    game.bankroll = settings.bankroll;
    Object.assign(game, copyState(data.state));
    game.history = Array.isArray(data.history)
      ? data.history
          .slice(-100)
          .filter((state) => validate(state) && state.status !== "won")
          .map(copyState)
      : [];
    const timestamp = now();
    game.startedAt =
      game.status === "ready" ? null : timestamp - data.elapsedMs;
    game.endedAt = game.status === "won" ? timestamp : null;
    game.pausedAt = null;
    game.pausedTotal = 0;
    return game;
  }
}
