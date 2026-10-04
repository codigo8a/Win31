import { el, button, field, clear } from "../core/dom.js";
import { Minesweeper, MINE_LEVELS } from "./minesweeper.js";
import { Solitaire, cardName, isRed } from "./solitaire.js";
import { startVictoryAnimation } from "./victory.js";

const svg = (body, viewBox = "0 0 24 24", cls = "") =>
  el("span", {
    class: cls,
    html: `<svg viewBox="${viewBox}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" shape-rendering="crispEdges">${body}</svg>`,
  });
const mineGraphic = () =>
  svg(
    '<path d="M11 2h2v5h-2zM11 17h2v5h-2zM2 11h5v2H2zM17 11h5v2h-5zM4 4h3v3H4zM17 4h3v3h-3zM4 17h3v3H4zM17 17h3v3h-3z"/><path d="M8 6h8v2h2v8h-2v2H8v-2H6V8h2z"/><path d="M9 8h3v3H9z" fill="white"/>',
    undefined,
    "mine-symbol",
  );
const flagGraphic = () =>
  svg(
    '<path d="M11 5h2v13h5v3H5v-3h6z"/><path d="M11 3v9L3 8z" fill="red"/>',
    undefined,
    "mine-symbol",
  );
const faceGraphic = (state) => {
  let face =
    '<rect x="8" y="8" width="2" height="3"/><rect x="16" y="8" width="2" height="3"/><path d="M8 15h2v2h6v-2h2v3h-2v1h-6v-1H8z"/>';
  if (state === "lost")
    face =
      '<path d="m7 7 4 4m0-4-4 4m8-4 4 4m0-4-4 4" stroke="black" stroke-width="2"/><path d="M8 18h2v-2h6v2h2v-3h-2v-1h-6v1H8z"/>';
  if (state === "won")
    face =
      '<path d="M5 7h7v5H7V9H5zm9 0h7v2h-2v3h-5zM12 8h2v2h-2z"/><path d="M8 15h2v2h6v-2h2v3h-2v1h-6v-1H8z"/>';
  if (state === "pressed")
    face =
      '<rect x="8" y="7" width="2" height="3"/><rect x="16" y="7" width="2" height="3"/><rect x="11" y="14" width="4" height="5"/>';
  return svg(
    `<path d="M9 2h8v2h4v4h2v10h-2v4h-4v2H9v-2H5v-4H3V8h2V4h4z" fill="#ffff00" stroke="#000"/>${face}`,
    "0 0 26 26",
  );
};
const segments = {
  0: "abcdef",
  1: "bc",
  2: "abdeg",
  3: "abcdg",
  4: "bcfg",
  5: "acdfg",
  6: "acdefg",
  7: "abc",
  8: "abcdefg",
  9: "abcdfg",
  "-": "g",
};
function setCounter(node, value) {
  const number = Math.max(-99, Math.min(999, value));
  const label =
    number < 0
      ? `-${String(-number).padStart(2, "0")}`
      : String(number).padStart(3, "0");
  node.setAttribute("aria-label", String(number));
  if (node.dataset.value === label) return;
  node.dataset.value = label;
  clear(node);
  const paths = {
    a: "M3 1h10l-2 2H5z",
    b: "M13 2v9l-2-1V4z",
    c: "M13 12v9l-2-2v-6z",
    d: "M3 22h10l-2-2H5z",
    e: "M2 12v9l2-2v-6z",
    f: "M2 2v9l2-1V4z",
    g: "M4 10h7l2 2-2 1H4l-2-1z",
  };
  for (const digit of label)
    node.append(
      svg(
        Object.entries(paths)
          .map(
            ([key, d]) =>
              `<path d="${d}" fill="${segments[digit].includes(key) ? "#ff0000" : "#320000"}"/>`,
          )
          .join(""),
        "0 0 15 24",
      ),
    );
}

function createMines(ctx) {
  const { os } = ctx;
  let level = os.storage.get("mines.level", "beginner");
  if (!MINE_LEVELS[level] && level !== "custom") level = "beginner";
  let custom = os.storage.get("mines.custom", {
    rows: 12,
    cols: 12,
    mines: 20,
  });
  let sound = os.storage.get("mines.sound", false),
    flagMode = false,
    game,
    announced = false;
  const root = el("div", { class: "mine-app" }),
    panel = el("div", { class: "mine-panel" });
  const left = el("div", {
    class: "mine-counter",
    role: "status",
    title: "Mines remaining",
  });
  const right = el("div", {
    class: "mine-counter",
    role: "timer",
    title: "Seconds elapsed",
  });
  const face = el("button", {
    class: "mine-face",
    title: "New game (F2)",
    "aria-label": "New game",
    onClick: () => start(),
  });
  const grid = el("div", {
    class: "mine-grid",
    role: "grid",
    "aria-label": "Mine field",
  });
  const status = el("div", { class: "mine-status" });
  const scroll = el("div", { class: "mine-scroll" }, panel);
  panel.append(el("div", { class: "mine-header" }, left, face, right), grid);
  root.append(scroll, status);
  ctx.content.append(root);

  function refreshFace(pressed = false) {
    clear(face);
    face.append(
      faceGraphic(
        (pressed && game.status === "playing") ||
          (pressed && game.status === "ready")
          ? "pressed"
          : game.status,
      ),
    );
  }
  function updateTime() {
    setCounter(right, game.elapsed);
  }
  function draw(focusIndex = null) {
    clear(grid);
    grid.style.gridTemplateColumns = `repeat(${game.cols}, var(--mine-cell))`;
    game.cells.forEach((cell, index) => {
      const done = game.status === "lost",
        showMine = done && cell.mine;
      const square = el("button", {
        type: "button",
        class: `mine-cell ${cell.open || showMine ? "mine-open" : ""} ${index === game.exploded ? "mine-exploded" : ""}`,
        role: "gridcell",
        "aria-label": `Row ${Math.floor(index / game.cols) + 1}, column ${(index % game.cols) + 1}: ${cell.flag ? "flagged" : cell.open ? (cell.mine ? "mine" : cell.adjacent ? `${cell.adjacent} adjacent mines` : "empty") : "covered"}`,
        "data-cell": index,
        onClick: (event) => {
          if (event.shiftKey || flagMode) act(index, true);
          else act(index);
        },
        onContextmenu: (event) => {
          event.preventDefault();
          act(index, true);
        },
        onDblclick: (event) => {
          event.preventDefault();
          act(index);
        },
        onPointerdown: (event) => {
          if (event.button === 0) refreshFace(true);
        },
        onPointerup: () => refreshFace(),
        onPointerleave: () => refreshFace(),
        onKeydown: (event) => {
          let next = index;
          if (event.key === "ArrowLeft") next = Math.max(0, index - 1);
          else if (event.key === "ArrowRight")
            next = Math.min(game.cells.length - 1, index + 1);
          else if (event.key === "ArrowUp")
            next = Math.max(0, index - game.cols);
          else if (event.key === "ArrowDown")
            next = Math.min(game.cells.length - 1, index + game.cols);
          else if (event.key.toLowerCase() === "f") {
            event.preventDefault();
            act(index, true, true);
            return;
          } else return;
          event.preventDefault();
          grid.children[next]?.focus();
        },
      });
      if (cell.flag && !cell.open) {
        square.append(flagGraphic());
        if (done && !cell.mine)
          square.append(el("span", { class: "mine-wrong", text: "×" }));
      } else if (showMine || (cell.open && cell.mine))
        square.append(mineGraphic());
      else if (cell.open && cell.adjacent) {
        square.textContent = cell.adjacent;
        square.classList.add(`mine-n${cell.adjacent}`);
      }
      grid.append(square);
    });
    setCounter(left, game.remaining);
    updateTime();
    refreshFace();
    status.textContent =
      game.status === "won"
        ? `You win! ${game.elapsed} seconds.`
        : game.status === "lost"
          ? "Game over. Click the face to try again."
          : flagMode
            ? "Flag mode: click a square to mark it."
            : "Click to uncover. Right-click to flag.";
    if (focusIndex !== null) grid.children[focusIndex]?.focus();
    if (game.status === "won" && !announced) {
      announced = true;
      const best = os.storage.get("mines.best", {});
      if (
        level !== "custom" &&
        (!best[level] || game.elapsed < best[level].time)
      ) {
        best[level] = {
          time: game.elapsed,
          date: new Date().toLocaleDateString(),
        };
        os.storage.set("mines.best", best);
      }
      if (sound) os.playSound("success");
    }
  }
  function act(index, flag = false, focus = false) {
    const keyboard = focus || document.activeElement === grid.children[index];
    const changed = flag ? game.toggleFlag(index) : game.reveal(index);
    if (changed) {
      if (sound) os.playSound(game.status === "lost" ? "error" : "click");
      draw(keyboard ? index : null);
    } else refreshFace();
  }
  function start(nextLevel = level) {
    level = nextLevel;
    announced = false;
    game = new Minesweeper(level === "custom" ? custom : MINE_LEVELS[level]);
    os.storage.set("mines.level", level);
    draw();
    menu();
  }
  async function configure() {
    const rows = el("input", {
      class: "win-input",
      type: "number",
      min: 8,
      max: 30,
      value: custom.rows,
    });
    const cols = el("input", {
      class: "win-input",
      type: "number",
      min: 8,
      max: 40,
      value: custom.cols,
    });
    const mines = el("input", {
      class: "win-input",
      type: "number",
      min: 1,
      max: 1199,
      value: custom.mines,
    });
    const result = await os.dialog({
      title: "Custom Field",
      body: el(
        "div",
        { class: "mine-custom" },
        field("Height (8–30):", rows),
        field("Width (8–40):", cols),
        field("Mines:", mines),
      ),
      buttons: [
        { label: "OK", value: true, default: true },
        { label: "Cancel", value: false },
      ],
      width: 290,
    });
    if (!result) return;
    const r = Number(rows.value),
      c = Number(cols.value),
      m = Number(mines.value);
    if (
      ![r, c, m].every(Number.isInteger) ||
      r < 8 ||
      r > 30 ||
      c < 8 ||
      c > 40 ||
      m < 1 ||
      m >= r * c
    ) {
      await os.message(
        "Enter a height from 8 to 30, a width from 8 to 40, and fewer mines than squares.",
        "Custom Field",
      );
      return configure();
    }
    custom = { rows: r, cols: c, mines: m };
    os.storage.set("mines.custom", custom);
    start("custom");
  }
  async function bestTimes() {
    const best = os.storage.get("mines.best", {});
    const body = el(
      "div",
      { class: "mine-best" },
      ...Object.keys(MINE_LEVELS).map((key) =>
        el(
          "p",
          {},
          `${key[0].toUpperCase() + key.slice(1)}: ${best[key] ? `${best[key].time} seconds (${best[key].date})` : "No record yet"}`,
        ),
      ),
    );
    const result = await os.dialog({
      title: "Fastest Mine Sweepers",
      body,
      buttons: [
        { label: "Reset Scores", value: "reset" },
        { label: "OK", value: "ok", default: true },
      ],
      width: 330,
    });
    if (result === "reset") {
      os.storage.set("mines.best", {});
      bestTimes();
    }
  }
  function menu() {
    ctx.setMenu([
      {
        label: "&Game",
        items: [
          { label: "&New", shortcut: "F2", action: () => start() },
          { separator: true },
          ...Object.keys(MINE_LEVELS).map((key) => ({
            label: `&${key[0].toUpperCase()}${key.slice(1)}`,
            checked: level === key,
            action: () => start(key),
          })),
          { label: "&Custom…", checked: level === "custom", action: configure },
          { separator: true },
          {
            label: "&Flag Mode",
            checked: flagMode,
            action: () => {
              flagMode = !flagMode;
              draw();
              menu();
            },
          },
          {
            label: "&Sound",
            checked: sound,
            action: () => {
              sound = !sound;
              os.storage.set("mines.sound", sound);
              menu();
            },
          },
          { label: "&Best Times…", action: bestTimes },
          { separator: true },
          { label: "E&xit", action: () => ctx.win.close() },
        ],
      },
      {
        label: "&Help",
        items: [
          {
            label: "&How to Play",
            shortcut: "F1",
            action: () =>
              os.message(
                "Find all the safe squares without uncovering a mine. A number tells you how many mines touch that square.\n\nClick to uncover. Right-click, Shift-click, or press F on a focused square to place a flag. Flag Mode in the Game menu also works on a touch screen.\n\nAfter marking the correct number of flags around a revealed number, click the number again to uncover the other neighboring squares. A wrong flag can cause you to hit a mine.\n\nYour first click is always safe. Use the arrow keys to move between squares and Space to uncover. Click the face or press F2 to start again.",
                "Minesweeper Help",
              ),
          },
          { separator: true },
          {
            label: "&About Minesweeper…",
            action: () =>
              os.about(
                "Minesweeper",
                "The classic mine-field puzzle.\nWindows 3.1 browser edition.",
              ),
          },
        ],
      },
    ]);
  }
  start();
  const timer = setInterval(updateTime, 250);
  ctx.cleanup(() => clearInterval(timer));
}

const suitPaths = {
  H: '<path d="M12 21 3 12C-3 3 8-2 12 5c4-7 15-2 9 7z"/>',
  D: '<path d="m12 0 10 12-10 12L2 12z"/>',
  C: '<path d="M12 0a5 5 0 0 1 4 8 5 5 0 1 1-2 9v3l4 3H6l4-3v-3a5 5 0 1 1-2-9 5 5 0 0 1 4-8z"/>',
  S: '<path d="M12 0 3 10c-6 8 3 13 7 6v5l-4 3h12l-4-3v-5c4 7 13 2 7-6z"/>',
};
const pipLocations = {
  1: [[50, 50]],
  2: [
    [50, 20],
    [50, 80],
  ],
  3: [
    [50, 18],
    [50, 50],
    [50, 82],
  ],
  4: [
    [26, 20],
    [74, 20],
    [26, 80],
    [74, 80],
  ],
  5: [
    [26, 20],
    [74, 20],
    [50, 50],
    [26, 80],
    [74, 80],
  ],
  6: [
    [26, 18],
    [74, 18],
    [26, 50],
    [74, 50],
    [26, 82],
    [74, 82],
  ],
  7: [
    [26, 18],
    [74, 18],
    [50, 34],
    [26, 50],
    [74, 50],
    [26, 82],
    [74, 82],
  ],
  8: [
    [26, 18],
    [74, 18],
    [50, 34],
    [26, 50],
    [74, 50],
    [50, 66],
    [26, 82],
    [74, 82],
  ],
  9: [
    [26, 15],
    [74, 15],
    [26, 39],
    [74, 39],
    [50, 50],
    [26, 63],
    [74, 63],
    [26, 87],
    [74, 87],
  ],
  10: [
    [26, 15],
    [74, 15],
    [50, 26],
    [26, 39],
    [74, 39],
    [26, 63],
    [74, 63],
    [50, 76],
    [26, 87],
    [74, 87],
  ],
};
function suitIcon(suit, cls = "") {
  return svg(suitPaths[suit], "0 0 24 24", cls);
}
function courtArt(card) {
  const crown =
    card.rank === 11
      ? '<path d="M8 9h24v5H8z" fill="#800000"/>'
      : '<path d="M7 14V4l7 6 6-9 6 9 7-6v10z" fill="#ff0" stroke="#000"/>';
  return svg(
    `<rect x="1" y="1" width="38" height="68" fill="#fff" stroke="#000"/><path d="M3 3h34v64H3z" fill="#000080"/><g>${crown}<path d="M13 15h14v15l-7 7-7-7z" fill="#ffff00" stroke="#000"/><path d="M15 21h3m5 0h3M18 29h5" stroke="#000" stroke-width="2"/><path d="M8 37h24l5 18H3z" fill="#800000" stroke="#000"/><path d="m8 37 24 18M32 37 8 55" stroke="#ff0" stroke-width="3"/><path d="M3 57h34v10H3z" fill="#ffff00"/><path d="m5 60 5 5 5-5 5 5 5-5 5 5 5-5" fill="none" stroke="#800000" stroke-width="2"/></g>`,
    "0 0 40 70",
    "sol-court",
  );
}
function cardElement(card, back = "crosshatch") {
  const node = el("div", {
    class: `sol-card ${card.faceUp ? `sol-face ${isRed(card) ? "sol-red" : "sol-black"}` : `sol-back sol-back-${back}`}`,
    role: "button",
    tabIndex: card.faceUp ? 0 : -1,
    "aria-label": card.faceUp ? cardName(card) : "Face-down card",
  });
  if (!card.faceUp) {
    node.append(el("div", { class: "sol-back-pattern" }));
    return node;
  }
  const rank =
    { 1: "A", 11: "J", 12: "Q", 13: "K" }[card.rank] || String(card.rank);
  node.append(
    el(
      "div",
      { class: "sol-corner sol-corner-top" },
      el("span", { text: rank }),
      suitIcon(card.suit),
    ),
    el(
      "div",
      { class: "sol-corner sol-corner-bottom" },
      el("span", { text: rank }),
      suitIcon(card.suit),
    ),
  );
  if (card.rank <= 10) {
    const pips = el("div", {
      class: `sol-pips ${card.rank === 1 ? "sol-ace" : ""}`,
    });
    pipLocations[card.rank].forEach(([x, y]) => {
      const pip = suitIcon(card.suit, "sol-pip");
      pip.style.left = `${x}%`;
      pip.style.top = `${y}%`;
      if (y > 50) pip.style.transform = "translate(-50%, -50%) rotate(180deg)";
      pips.append(pip);
    });
    node.append(pips);
  } else node.append(courtArt(card));
  return node;
}

function createSolitaire(ctx) {
  const { os } = ctx;
  let drawCount = os.storage.get("sol.draw", 1),
    timed = os.storage.get("sol.timed", true),
    deck = os.storage.get("sol.deck", "crosshatch");
  let scoring = os.storage.get("sol.scoring", "standard"),
    cumulative = os.storage.get("sol.cumulative", false),
    showStatus = os.storage.get("sol.statusbar", true),
    outlineDrag = os.storage.get("sol.outline", false);
  let game = new Solitaire({
      draw: drawCount,
      timed,
      scoring,
      cumulative,
      bankroll: os.storage.get("sol.bankroll", 0),
    }),
    restored = false;
  try {
    const saved = os.storage.get("sol.saved", null);
    if (saved) {
      game = Solitaire.fromJSON(saved);
      restored = true;
    }
  } catch {
    os.storage.set("sol.saved", null);
  }
  let selected = null,
    dragSource = null,
    wonAnnounced = game.status === "won",
    hintState = null,
    hintTimeout,
    lastCardClick = { id: "", time: 0 },
    stopAnimation = null,
    dragOutline = null,
    disposed = false;
  const root = el("div", { class: "sol-app" }),
    scroll = el("div", { class: "sol-scroll" }),
    table = el("div", {
      class: "sol-table",
      tabIndex: 0,
      "aria-label": "Solitaire card table",
    });
  const statusText = el("span", {
      class: "sol-status-text",
      text: "Select a card, then its destination.",
    }),
    scoreText = el("span"),
    timeText = el("span");
  const status = el(
    "div",
    { class: "sol-status statusbar" },
    statusText,
    scoreText,
    timeText,
  );
  scroll.append(table);
  root.append(scroll, status);
  ctx.content.append(root);

  function info() {
    scoreText.hidden = game.scoring === "none";
    scoreText.textContent =
      game.scoring === "vegas"
        ? `${game.cumulative ? "Balance" : "Score"}: ${game.displayScore < 0 ? "−" : ""}$${Math.abs(game.displayScore)}`
        : `Score: ${game.displayScore}`;
    scoreText.title =
      game.scoring === "vegas"
        ? `Stock pass ${game.redeals + 1} of ${game.maxPasses}`
        : "Standard scoring";
    timeText.textContent = game.timed
      ? `Time: ${game.elapsed}`
      : `Moves: ${game.moves}`;
    status.style.display = showStatus ? "" : "none";
  }
  function message(text) {
    statusText.textContent = text;
  }
  function saveGame() {
    os.storage.set("sol.saved", game.toJSON());
    if (game.scoring === "vegas" && game.cumulative)
      os.storage.set("sol.bankroll", game.displayScore);
  }
  function stopVictory() {
    if (stopAnimation) {
      const stop = stopAnimation;
      stopAnimation = null;
      stop();
    }
  }
  function celebrate() {
    stopVictory();
    scroll.scrollTop = 0;
    scroll.scrollLeft = 0;
    const bounds = root.getBoundingClientRect();
    const origins = [...table.querySelectorAll(".sol-foundation")].map(
      (node) => {
        const rect = node.getBoundingClientRect();
        return { x: rect.left - bounds.left, y: rect.top - bounds.top };
      },
    );
    message("You won! Click the table or press Escape to stop the cards.");
    stopAnimation = startVictoryAnimation({
      container: root,
      foundations: game.foundations,
      origins,
      height: scroll.clientHeight,
      onStop: () => {
        stopAnimation = null;
        if (!disposed) {
          message("Congratulations! You won. Choose Deal to play again.");
          menu();
        }
      },
    });
    menu();
  }
  function isSelected(source) {
    return (
      selected &&
      source.type === selected.type &&
      source.index === selected.index &&
      (source.type !== "tableau" || source.cardIndex >= selected.cardIndex)
    );
  }
  function sameSource(a, b) {
    return (
      a &&
      b &&
      a.type === b.type &&
      a.index === b.index &&
      a.cardIndex === b.cardIndex
    );
  }
  function changed(text = "") {
    selected = null;
    hintState = null;
    render();
    menu();
    info();
    saveGame();
    message(
      text ||
        (game.status === "won"
          ? "Congratulations! You won."
          : "Select a card, then its destination."),
    );
    if (game.status === "won" && !wonAnnounced) {
      wonAnnounced = true;
      os.playSound("success");
      celebrate();
    }
  }
  function destination(target, focus = false) {
    if (!selected) return false;
    const id = game.cardsAt(selected)[0]?.id;
    if (game.move(selected, target)) {
      changed();
      if (focus && id) table.querySelector(`[data-card-id="${id}"]`)?.focus();
      return true;
    }
    message("That move is not allowed. Choose another destination.");
    return false;
  }
  function select(source, focus = false) {
    if (!game.cardsAt(source).length) return;
    if (sameSource(selected, source)) {
      selected = null;
      render();
      message("Selection cleared.");
      return;
    }
    selected = source;
    hintState = null;
    render();
    message(
      `${cardName(game.cardsAt(source)[0])} selected. Click a destination.`,
    );
    if (focus)
      table
        .querySelector(`[data-card-id="${game.cardsAt(source)[0].id}"]`)
        ?.focus();
  }
  function attachDrop(node, target, clickable = true) {
    node.addEventListener("dragover", (event) => {
      if (dragSource && game.canMove(dragSource, target)) {
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        node.classList.add("sol-drop");
      }
    });
    node.addEventListener("dragleave", () => node.classList.remove("sol-drop"));
    node.addEventListener("drop", (event) => {
      event.preventDefault();
      event.stopPropagation();
      node.classList.remove("sol-drop");
      if (dragSource && game.move(dragSource, target)) changed();
      dragSource = null;
      dragOutline?.remove();
      dragOutline = null;
    });
    if (clickable)
      node.addEventListener("click", (event) => {
        if (event.target === node || event.target.closest(".sol-empty"))
          destination(target);
      });
  }
  function interactiveCard(card, source, target) {
    const node = cardElement(card, deck);
    if (!card.faceUp) return node;
    node.dataset.cardId = card.id;
    node.dataset.solType = source.type;
    node.dataset.solIndex = source.index ?? "";
    node.dataset.solCard = source.cardIndex ?? "";
    if (isSelected(source)) node.classList.add("sol-selected");
    if (
      hintState &&
      (sameSource(source, hintState.source) ||
        (target &&
          target.type === hintState.target.type &&
          target.index === hintState.target.index))
    )
      node.classList.add("sol-hint");
    node.draggable = game.cardsAt(source).length > 0;
    node.addEventListener("click", (event) => {
      event.stopPropagation();
      const now = Date.now(),
        doubleClick =
          lastCardClick.id === card.id && now - lastCardClick.time < 420;
      lastCardClick = { id: card.id, time: now };
      if (doubleClick) {
        lastCardClick.id = "";
        if (game.autoFoundation(source)) changed();
        else {
          selected = null;
          render();
          message("This card cannot move to a foundation yet.");
        }
        return;
      }
      if (selected && target && destination(target)) return;
      select(source);
    });
    node.addEventListener("dblclick", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    node.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (selected && target && destination(target, true)) return;
        select(source, true);
      }
    });
    node.addEventListener("dragstart", (event) => {
      dragSource = source;
      selected = null;
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", card.id);
      node.classList.add("sol-dragging");
      if (outlineDrag) {
        dragOutline?.remove();
        dragOutline = el("div", { class: "sol-drag-outline" });
        const count = game.cardsAt(source).length;
        dragOutline.style.height = `${96 + (count - 1) * 23}px`;
        root.append(dragOutline);
        event.dataTransfer.setDragImage(dragOutline, 16, 12);
      }
    });
    node.addEventListener("dragend", () => {
      dragSource = null;
      dragOutline?.remove();
      dragOutline = null;
      node.classList.remove("sol-dragging");
      table
        .querySelectorAll(".sol-drop")
        .forEach((n) => n.classList.remove("sol-drop"));
    });
    if (target) attachDrop(node, target, false);
    return node;
  }
  function emptySlot(label, kind = "") {
    return el(
      "div",
      { class: `sol-empty ${kind}`, "aria-label": label },
      el("span", {
        text:
          kind === "sol-redeal" ? "↻" : kind === "sol-stock-blocked" ? "×" : "",
      }),
    );
  }
  function render() {
    clear(table);
    const top = el("div", { class: "sol-top" });
    const blocked = !game.stock.length && game.waste.length && !game.canRedeal;
    const stockLabel = game.stock.length
      ? `Stock: ${game.stock.length} cards. Deal ${game.drawCount}.`
      : blocked
        ? `Vegas stock limit reached: ${game.maxPasses} pass${game.maxPasses === 1 ? "" : "es"}.`
        : "Empty stock. Click to redeal.";
    const stock = el("div", {
      class: "sol-pile sol-stock",
      role: "button",
      tabIndex: 0,
      title: stockLabel,
      "aria-label": stockLabel,
      "aria-disabled": !game.canDraw,
      "data-sol-type": "stock",
    });
    stock.append(
      game.stock.length
        ? cardElement({ faceUp: false }, deck)
        : emptySlot(
            "Redeal waste",
            game.canRedeal ? "sol-redeal" : blocked ? "sol-stock-blocked" : "",
          ),
    );
    const drawCard = () => {
      if (game.draw()) changed();
      else
        message(
          blocked
            ? "Vegas stock limit reached. You can still move the visible cards."
            : "No cards remain in the stock or waste.",
        );
    };
    stock.addEventListener("click", drawCard);
    stock.addEventListener("keydown", (event) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        drawCard();
      }
    });
    const waste = el("div", {
      class: "sol-pile sol-waste",
      "aria-label": "Waste pile",
    });
    if (!game.waste.length) waste.append(emptySlot("Waste pile"));
    else {
      const visible = game.drawCount === 3 ? Math.min(3, game.waste.length) : 1;
      game.waste.slice(-visible).forEach((card, n) => {
        const topCard = n === visible - 1,
          node = topCard
            ? interactiveCard(card, { type: "waste" })
            : cardElement(card, deck);
        node.style.left = `${n * 15}px`;
        node.style.zIndex = n + 1;
        if (!topCard) {
          node.tabIndex = -1;
          node.setAttribute(
            "aria-label",
            `${cardName(card)}; covered in waste`,
          );
        }
        waste.append(node);
      });
    }
    top.append(stock, waste, el("div", { class: "sol-top-space" }));
    game.foundations.forEach((pile, index) => {
      const target = { type: "foundation", index },
        slot = el("div", {
          class: "sol-pile sol-foundation",
          role: "button",
          tabIndex: 0,
          "data-sol-type": "foundation",
          "data-sol-index": index,
          "aria-label": `Foundation ${index + 1}${pile.length ? `: ${cardName(pile.at(-1))}` : ": empty; start with an ace"}`,
        });
      if (pile.length)
        slot.append(
          interactiveCard(pile.at(-1), { type: "foundation", index }, target),
        );
      else {
        const empty = emptySlot(`Foundation ${index + 1}`);
        empty.append(el("span", { class: "sol-foundation-a", text: "A" }));
        slot.append(empty);
      }
      attachDrop(slot, target);
      slot.addEventListener("keydown", (event) => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          event.target === slot
        ) {
          event.preventDefault();
          if (!destination(target, true) && pile.length)
            select({ type: "foundation", index }, true);
        }
      });
      if (
        hintState?.target.type === "foundation" &&
        hintState.target.index === index
      )
        slot.classList.add("sol-hint");
      top.append(slot);
    });
    const tableau = el("div", { class: "sol-tableau" });
    let maxHeight = 140;
    game.tableau.forEach((pile, index) => {
      const target = { type: "tableau", index },
        column = el("div", {
          class: "sol-column",
          role: "group",
          "aria-label": `Column ${index + 1}`,
        });
      const empty = emptySlot(
        `Empty column ${index + 1}: only a king can go here`,
      );
      empty.tabIndex = pile.length ? -1 : 0;
      empty.setAttribute("role", "button");
      empty.dataset.solType = "tableau";
      empty.dataset.solIndex = index;
      empty.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          destination(target, true);
        }
      });
      column.append(empty);
      attachDrop(column, target);
      let offset = 0;
      pile.forEach((card, cardIndex) => {
        const node = interactiveCard(
          card,
          { type: "tableau", index, cardIndex },
          target,
        );
        node.style.top = `${offset}px`;
        node.style.zIndex = cardIndex + 1;
        column.append(node);
        offset += card.faceUp ? 23 : 13;
      });
      const height = Math.max(
        100,
        offset - (pile.at(-1)?.faceUp ? 23 : 13) + 96,
      );
      maxHeight = Math.max(maxHeight, height);
      column.style.height = `${height}px`;
      if (
        hintState?.target.type === "tableau" &&
        hintState.target.index === index
      )
        column.classList.add("sol-hint");
      tableau.append(column);
    });
    tableau.style.minHeight = `${maxHeight}px`;
    table.append(top, tableau);
    info();
  }
  async function newGame() {
    if (
      game.moves &&
      game.status !== "won" &&
      !(await os.confirm(
        "Do you want to end this game and deal again?",
        "Solitaire",
      ))
    )
      return;
    dealNow();
  }
  function dealNow(resetBalance = false) {
    stopVictory();
    const bankroll =
      scoring === "vegas" && cumulative && !resetBalance
        ? game.scoring === "vegas" && game.cumulative
          ? game.displayScore
          : os.storage.get("sol.bankroll", 0)
        : 0;
    if (scoring !== "vegas" || !cumulative || resetBalance)
      os.storage.set("sol.bankroll", 0);
    game = new Solitaire({
      draw: drawCount,
      timed,
      scoring,
      cumulative,
      bankroll,
    });
    wonAnnounced = false;
    changed("New game. Good luck!");
  }
  function undo() {
    stopVictory();
    if (game.undo()) {
      wonAnnounced = false;
      changed("Last move undone.");
    }
  }
  function hint() {
    stopVictory();
    const moves = game
      .legalMoves()
      .filter(
        (move) =>
          !(move.source.type === "foundation") &&
          !(
            move.source.type === "tableau" &&
            move.source.cardIndex === 0 &&
            !game.tableau[move.target.index]?.length &&
            move.target.type === "tableau"
          ),
      );
    if (moves.length) {
      hintState = moves[0];
      selected = null;
      render();
      message(
        `Move ${cardName(game.cardsAt(hintState.source)[0])} to ${hintState.target.type === "foundation" ? "foundation" : "column"} ${hintState.target.index + 1}.`,
      );
      clearTimeout(hintTimeout);
      hintTimeout = setTimeout(() => {
        hintState = null;
        render();
      }, 3500);
    } else
      message(
        game.stock.length
          ? "Click the stock to turn over more cards."
          : game.canRedeal
            ? "Click the empty stock to redeal the waste."
            : "No legal moves remain. Deal a new game to try again.",
      );
  }
  function autoFinish() {
    let moved = 0,
      progress = true;
    while (progress && game.status !== "won") {
      progress = false;
      const sources = [
        { type: "waste" },
        ...game.tableau.map((p, index) => ({
          type: "tableau",
          index,
          cardIndex: p.length - 1,
        })),
      ];
      for (const source of sources)
        if (game.autoFoundation(source)) {
          moved++;
          progress = true;
        }
    }
    changed(
      moved
        ? `${moved} card${moved === 1 ? "" : "s"} moved to the foundations.`
        : "No cards can move to the foundations yet.",
    );
  }
  async function options() {
    const draw = el(
      "select",
      { class: "win-select" },
      el("option", { value: 1, text: "Draw one card" }),
      el("option", { value: 3, text: "Draw three cards" }),
    );
    draw.value = drawCount;
    const score = el(
      "select",
      { class: "win-select" },
      el("option", { value: "standard", text: "Standard" }),
      el("option", { value: "vegas", text: "Vegas" }),
      el("option", { value: "none", text: "None" }),
    );
    score.value = scoring;
    const keep = el("input", {
      type: "checkbox",
      checked: cumulative,
      disabled: scoring !== "vegas",
    });
    score.addEventListener("change", () => {
      keep.disabled = score.value !== "vegas";
    });
    const timer = el("input", { type: "checkbox", checked: timed }),
      statusBox = el("input", { type: "checkbox", checked: showStatus }),
      outline = el("input", { type: "checkbox", checked: outlineDrag });
    const result = await os.dialog({
      title: "Solitaire Options",
      body: el(
        "div",
        { class: "sol-options" },
        field("Cards:", draw),
        field("Scoring:", score),
        el("label", {}, keep, " Keep cumulative Vegas score"),
        el("label", {}, timer, " Timed game"),
        el("label", {}, statusBox, " Status bar"),
        el("label", {}, outline, " Outline dragging"),
        el("p", {
          text: "Changing the draw or scoring rules starts a new deal. Your current game is saved automatically.",
        }),
      ),
      buttons: [
        { label: "OK", value: true, default: true },
        { label: "Cancel", value: false },
      ],
      width: 360,
    });
    if (!result) return;
    const nextDraw = Number(draw.value),
      nextScoring = score.value,
      nextCumulative = score.value === "vegas" && keep.checked;
    const needsDeal =
      nextDraw !== game.drawCount ||
      nextScoring !== game.scoring ||
      nextCumulative !== game.cumulative;
    if (
      needsDeal &&
      game.moves &&
      game.status !== "won" &&
      !(await os.confirm(
        "These options start a new deal. End your current game?",
        "Solitaire",
      ))
    )
      return;
    drawCount = nextDraw;
    scoring = nextScoring;
    cumulative = nextCumulative;
    timed = timer.checked;
    showStatus = statusBox.checked;
    outlineDrag = outline.checked;
    for (const [key, value] of Object.entries({
      draw: drawCount,
      scoring,
      cumulative,
      timed,
      statusbar: showStatus,
      outline: outlineDrag,
    }))
      os.storage.set(`sol.${key}`, value);
    if (needsDeal) dealNow();
    else {
      game.setTimed(timed);
      info();
      menu();
      saveGame();
      message("Options saved.");
    }
  }
  async function resetBalance() {
    if (
      await os.confirm(
        "Reset the cumulative Vegas balance and start a fresh $52 game?",
        "Solitaire",
      )
    ) {
      scoring = "vegas";
      cumulative = true;
      os.storage.set("sol.scoring", scoring);
      os.storage.set("sol.cumulative", true);
      dealNow(true);
    }
  }
  async function chooseDeck() {
    let choice = deck;
    const preview = el("div", { class: "sol-deck-choices" });
    for (const [id, name] of [
      ["crosshatch", "Blue weave"],
      ["diamonds", "Red diamonds"],
      ["castle", "Blue tiles"],
    ]) {
      const item = el(
        "button",
        {
          class: `sol-deck-choice ${choice === id ? "sol-deck-choice-selected" : ""}`,
          "aria-label": name,
          title: name,
        },
        cardElement({ faceUp: false }, id),
        el("span", { text: name }),
      );
      item.addEventListener("click", () => {
        choice = id;
        [...preview.children].forEach((n) =>
          n.classList.remove("sol-deck-choice-selected"),
        );
        item.classList.add("sol-deck-choice-selected");
      });
      preview.append(item);
    }
    if (
      await os.dialog({
        title: "Select Card Back",
        body: preview,
        buttons: [
          { label: "OK", value: true, default: true },
          { label: "Cancel", value: false },
        ],
        width: 350,
      })
    ) {
      deck = choice;
      os.storage.set("sol.deck", deck);
      render();
    }
  }
  function menu() {
    ctx.setMenu([
      {
        label: "&Game",
        items: [
          { label: "&Deal", shortcut: "F2", action: newGame },
          {
            label: "&Undo",
            shortcut: "Ctrl+Z",
            disabled: !game.history.length,
            action: undo,
          },
          { separator: true },
          {
            label: "&Hint",
            shortcut: "H",
            disabled: game.status === "won",
            action: hint,
          },
          {
            label: "&Move Cards to Foundations",
            disabled: game.status === "won",
            action: autoFinish,
          },
          {
            label: "Stop &Animation",
            disabled: !stopAnimation,
            action: stopVictory,
          },
          { separator: true },
          { label: "&Options…", action: options },
          { label: "De&ck…", action: chooseDeck },
          {
            label: "&Reset Vegas Score…",
            disabled: scoring !== "vegas" && game.scoring !== "vegas",
            action: resetBalance,
          },
          { separator: true },
          { label: "E&xit", action: () => ctx.win.close() },
        ],
      },
      {
        label: "&Help",
        items: [
          {
            label: "&How to Play",
            shortcut: "F1",
            action: () =>
              os.message(
                "Build the four foundations from Ace to King, one suit in each.\n\nOn the table, stack cards in descending order, alternating red and black. Only a King (or a sequence starting with a King) can fill an empty column. Moving the last face-up card reveals the card beneath it.\n\nDrag a card or a face-up sequence to its destination. You can also click a card, then click the target column or foundation. Double-click a card to send it to a foundation. Only the top waste card can be moved.\n\nClick the stock to draw cards. Click the empty stock to turn the waste over and start again, unless the Vegas pass limit has been reached. Game → Options selects draw-one or draw-three and Standard, Vegas, or no scoring.\n\nUse Undo to take back a move, Hint for a suggestion, and Escape to clear your selection. Tab, arrow keys, and Enter select cards and destinations.\n\nMinimizing the game pauses the clock. Your deal and the last 100 undo steps are saved automatically. Reopen Solitaire to continue. On winning, click the table or press Escape to stop the bouncing cards.",
                "Solitaire Help",
              ),
          },
          {
            label: "&Scoring",
            action: () =>
              os.message(
                "STANDARD\nWaste to tableau: +5\nCard to foundation: +10\nReveal a face-down card: +5\nFoundation back to tableau: −15\nDraw-one redeal: −100\nDraw-three redeal after two free redeals: −20\nTimed games: −2 for every 10 seconds\n\nStandard scores do not fall below zero. A timed win taking over 30 seconds earns a bonus of 700,000 divided by elapsed seconds.\n\nVEGAS\nEach deal costs $52. Each foundation card returns $5; taking it back returns the $5. Draw-one allows one stock pass, and draw-three allows three passes. There is no time penalty or bonus. Keep cumulative score carries your balance into the next deal. Reset Vegas Score starts the balance over.\n\nNONE\nScoring and stock-pass limits are disabled.\n\nUndo restores the previous move and score; the clock continues.",
                "Solitaire Scoring",
              ),
          },
          { separator: true },
          {
            label: "&About Solitaire…",
            action: () =>
              os.about(
                "Solitaire",
                "Klondike Solitaire\nWindows 3.1 browser edition.\nCards drawn with original 16-color vector graphics.",
              ),
          },
        ],
      },
    ]);
  }
  const key = (event) => {
    if (event.key === "Escape") {
      if (stopAnimation) {
        event.preventDefault();
        stopVictory();
        return;
      }
      if (selected) {
        event.preventDefault();
        selected = null;
        render();
        message("Selection cleared.");
        table.focus();
        return;
      }
    }
    if (
      !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
        event.key,
      ) ||
      !table.contains(event.target)
    )
      return;
    const current = event.target.closest("[data-sol-type]");
    if (!current) return;
    const type = current.dataset.solType,
      index = Number(current.dataset.solIndex),
      horizontal = event.key === "ArrowLeft" || event.key === "ArrowRight",
      direction = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    let next;
    if (type === "tableau") {
      if (horizontal) {
        const column =
          table.querySelectorAll(".sol-column")[
            Math.max(0, Math.min(6, index + direction))
          ];
        next =
          [...column.querySelectorAll('.sol-card[tabindex="0"]')].at(-1) ||
          column.querySelector(".sol-empty");
      } else {
        const cards = [
          ...table
            .querySelectorAll(".sol-column")
            [index].querySelectorAll('.sol-card[tabindex="0"]'),
        ];
        const at = cards.indexOf(current);
        next = cards[Math.max(0, Math.min(cards.length - 1, at + direction))];
      }
    } else if (horizontal) {
      const piles = [
        table.querySelector(".sol-stock"),
        table.querySelector(".sol-waste .sol-card[data-card-id]"),
        ...table.querySelectorAll(".sol-foundation"),
      ].filter(Boolean);
      const stack =
        type === "foundation"
          ? current.closest(".sol-foundation")
          : type === "stock"
            ? current
            : current.closest(".sol-card");
      const at = piles.indexOf(stack);
      next = piles[Math.max(0, Math.min(piles.length - 1, at + direction))];
    } else if (event.key === "ArrowDown") {
      const column =
        table.querySelectorAll(".sol-column")[
          type === "foundation" ? index + 3 : type === "waste" ? 1 : 0
        ];
      next =
        [...column.querySelectorAll('.sol-card[tabindex="0"]')].at(-1) ||
        column.querySelector(".sol-empty");
    }
    if (next) {
      event.preventDefault();
      next.focus();
    }
  };
  function updateClock() {
    if (ctx.win.state.minimized) game.pause();
    else game.resume();
    info();
  }
  ctx.win.element.addEventListener("keydown", key);
  const observer = new MutationObserver(updateClock);
  observer.observe(ctx.win.element, {
    attributes: true,
    attributeFilter: ["style", "class"],
  });
  const timer = setInterval(updateClock, 1000),
    saveTimer = setInterval(saveGame, 15000);
  ctx.cleanup(() => {
    disposed = true;
    saveGame();
    stopVictory();
    clearInterval(timer);
    clearInterval(saveTimer);
    clearTimeout(hintTimeout);
    observer.disconnect();
    dragOutline?.remove();
    ctx.win.element.removeEventListener("keydown", key);
  });
  render();
  menu();
  saveGame();
  if (restored)
    message(
      game.status === "won"
        ? "Your completed game has been restored. Choose Deal to play again."
        : "Saved game restored. Continue where you left off.",
    );
}

export function registerApps(os) {
  os.registerApp({
    id: "minesweeper",
    title: "Minesweeper",
    icon: "minesweeper",
    width: 300,
    height: 405,
    minWidth: 230,
    minHeight: 290,
    singleton: true,
    create: createMines,
  });
  os.registerApp({
    id: "solitaire",
    title: "Solitaire",
    icon: "solitaire",
    width: 730,
    height: 570,
    minWidth: 550,
    minHeight: 380,
    singleton: true,
    create: createSolitaire,
  });
}
