/** Classic persistent card trails. Purely visual: foundation state is untouched. */
const paths = {
  H: "M12 21 3 12C-3 3 8-2 12 5c4-7 15-2 9 7z",
  D: "m12 0 10 12-10 12L2 12z",
  C: "M12 0a5 5 0 0 1 4 8 5 5 0 1 1-2 9v3l4 3H6l4-3v-3a5 5 0 1 1-2-9 5 5 0 0 1 4-8z",
  S: "M12 0 3 10c-6 8 3 13 7 6v5l-4 3h12l-4-3v-5c4 7 13 2 7-6z",
};
const pips = {
  1: [[0.5, 0.5]],
  2: [
    [0.5, 0.2],
    [0.5, 0.8],
  ],
  3: [
    [0.5, 0.18],
    [0.5, 0.5],
    [0.5, 0.82],
  ],
  4: [
    [0.26, 0.2],
    [0.74, 0.2],
    [0.26, 0.8],
    [0.74, 0.8],
  ],
  5: [
    [0.26, 0.2],
    [0.74, 0.2],
    [0.5, 0.5],
    [0.26, 0.8],
    [0.74, 0.8],
  ],
  6: [
    [0.26, 0.18],
    [0.74, 0.18],
    [0.26, 0.5],
    [0.74, 0.5],
    [0.26, 0.82],
    [0.74, 0.82],
  ],
  7: [
    [0.26, 0.18],
    [0.74, 0.18],
    [0.5, 0.34],
    [0.26, 0.5],
    [0.74, 0.5],
    [0.26, 0.82],
    [0.74, 0.82],
  ],
  8: [
    [0.26, 0.18],
    [0.74, 0.18],
    [0.5, 0.34],
    [0.26, 0.5],
    [0.74, 0.5],
    [0.5, 0.66],
    [0.26, 0.82],
    [0.74, 0.82],
  ],
  9: [
    [0.26, 0.15],
    [0.74, 0.15],
    [0.26, 0.39],
    [0.74, 0.39],
    [0.5, 0.5],
    [0.26, 0.63],
    [0.74, 0.63],
    [0.26, 0.87],
    [0.74, 0.87],
  ],
  10: [
    [0.26, 0.15],
    [0.74, 0.15],
    [0.5, 0.26],
    [0.26, 0.39],
    [0.74, 0.39],
    [0.26, 0.63],
    [0.74, 0.63],
    [0.5, 0.76],
    [0.26, 0.87],
    [0.74, 0.87],
  ],
};

function makeSprite(card) {
  const canvas = document.createElement("canvas");
  canvas.width = 71;
  canvas.height = 96;
  const c = canvas.getContext("2d");
  c.fillStyle = "#fff";
  c.strokeStyle = "#000";
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(4, 0.5);
  c.lineTo(67, 0.5);
  c.quadraticCurveTo(70.5, 0.5, 70.5, 4);
  c.lineTo(70.5, 92);
  c.quadraticCurveTo(70.5, 95.5, 67, 95.5);
  c.lineTo(4, 95.5);
  c.quadraticCurveTo(0.5, 95.5, 0.5, 92);
  c.lineTo(0.5, 4);
  c.quadraticCurveTo(0.5, 0.5, 4, 0.5);
  c.fill();
  c.stroke();
  const color = card.suit === "D" || card.suit === "H" ? "#f00" : "#000",
    shape = new Path2D(paths[card.suit]);
  const suit = (x, y, width, height, upsideDown = false) => {
    c.save();
    c.translate(x, y);
    if (upsideDown) c.rotate(Math.PI);
    c.translate(-width / 2, -height / 2);
    c.scale(width / 24, height / 24);
    c.fillStyle = color;
    c.fill(shape);
    c.restore();
  };
  const rank =
    { 1: "A", 11: "J", 12: "Q", 13: "K" }[card.rank] || String(card.rank);
  for (const rotate of [false, true]) {
    c.save();
    if (rotate) {
      c.translate(71, 96);
      c.rotate(Math.PI);
    }
    c.fillStyle = color;
    c.textAlign = "center";
    c.font = 'bold 15px "Times New Roman", serif';
    c.fillText(rank, 9, 16);
    suit(9, 23, 10, 11);
    c.restore();
  }
  if (card.rank <= 10)
    for (const [x, y] of pips[card.rank])
      suit(
        16 + x * 39,
        8 + y * 80,
        card.rank === 1 ? 27 : 14,
        card.rank === 1 ? 31 : 16,
        y > 0.5,
      );
  else {
    c.fillStyle = "#000080";
    c.fillRect(17, 10, 37, 76);
    c.strokeStyle = "#000";
    c.strokeRect(16.5, 9.5, 38, 77);
    for (const rotate of [false, true]) {
      c.save();
      if (rotate) {
        c.translate(71, 96);
        c.rotate(Math.PI);
      }
      c.fillStyle = "#ff0";
      c.beginPath();
      c.moveTo(24, 22);
      c.lineTo(24, 14);
      c.lineTo(30, 18);
      c.lineTo(35, 12);
      c.lineTo(41, 18);
      c.lineTo(47, 14);
      c.lineTo(47, 22);
      c.closePath();
      c.fill();
      c.fillRect(29, 24, 13, 15);
      c.fillStyle = "#000";
      c.fillRect(31, 28, 2, 2);
      c.fillRect(38, 28, 2, 2);
      c.fillRect(34, 35, 5, 1);
      c.fillStyle = "#800000";
      c.fillRect(22, 41, 28, 6);
      c.strokeStyle = "#ff0";
      c.beginPath();
      c.moveTo(24, 41);
      c.lineTo(35, 47);
      c.lineTo(47, 41);
      c.stroke();
      c.restore();
    }
  }
  return canvas;
}

export function startVictoryAnimation({
  container,
  foundations,
  origins,
  height,
  onStop = () => {},
}) {
  const width = Math.max(1, container.clientWidth),
    viewHeight = Math.max(130, height || container.clientHeight);
  const canvas = document.createElement("canvas");
  canvas.className = "sol-victory";
  canvas.width = width;
  canvas.height = viewHeight;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${viewHeight}px`;
  canvas.tabIndex = 0;
  canvas.setAttribute("role", "button");
  canvas.setAttribute(
    "aria-label",
    "You won. Click or press Escape to stop the bouncing cards.",
  );
  canvas.title = "Click to stop";
  const context = canvas.getContext("2d");
  context.imageSmoothingEnabled = false;
  container.append(canvas);
  const sprites = new Map(
    foundations.flat().map((card) => [card.id, makeSprite(card)]),
  );
  const queue = [];
  for (let rank = 12; rank >= 0; rank--)
    foundations.forEach((pile, index) => {
      if (pile[rank])
        queue.push({ card: pile[rank], index, next: pile[rank - 1] });
    });
  let active = [],
    next = 0,
    frame = 0,
    lastTime = 0,
    nextLaunch = 0,
    stopped = false;
  function stop() {
    if (stopped) return;
    stopped = true;
    cancelAnimationFrame(frame);
    canvas.remove();
    onStop();
  }
  function animate(time) {
    if (stopped) return;
    const delta = Math.min(2.5, (time - (lastTime || time - 16.67)) / 16.67);
    lastTime = time;
    if (next < queue.length && time >= nextLaunch) {
      const entry = queue[next++],
        origin = origins[entry.index] || {
          x: width - 85 * (4 - entry.index),
          y: 18,
        };
      context.fillStyle = "#008000";
      context.fillRect(origin.x - 1, origin.y - 1, 73, 98);
      if (entry.next)
        context.drawImage(sprites.get(entry.next.id), origin.x, origin.y);
      const direction = Math.random() < 0.8 ? -1 : 1;
      active.push({
        sprite: sprites.get(entry.card.id),
        x: origin.x,
        y: origin.y,
        vx: direction * (3.5 + Math.random() * 5),
        vy: -0.8 - Math.random() * 2.2,
      });
      nextLaunch = time + 270;
    }
    for (const card of active) {
      card.x += card.vx * delta;
      card.vy += 0.42 * delta;
      card.y += card.vy * delta;
      if (card.y > viewHeight - 96) {
        card.y = viewHeight - 96;
        card.vy = -Math.max(3.3, Math.abs(card.vy) * 0.77);
      }
      context.drawImage(card.sprite, Math.round(card.x), Math.round(card.y));
    }
    active = active.filter((card) => card.x > -74 && card.x < width + 3);
    if (next === queue.length && !active.length) {
      stop();
      return;
    }
    frame = requestAnimationFrame(animate);
  }
  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    event.stopPropagation();
    stop();
  });
  canvas.addEventListener("keydown", (event) => {
    if (["Escape", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      stop();
    }
  });
  frame = requestAnimationFrame(animate);
  canvas.focus({ preventScroll: true });
  return stop;
}
