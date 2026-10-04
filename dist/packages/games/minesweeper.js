/** A deterministic, DOM-free Minesweeper engine. Supply rng and now for tests. */
export function seededRandom(seed = 1) {
  let n = seed >>> 0;
  return () => {
    n += 0x6d2b79f5;
    let t = Math.imul(n ^ (n >>> 15), 1 | n);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Minesweeper {
  constructor({
    rows = 8,
    cols = 8,
    mines = 10,
    rng = Math.random,
    now = Date.now,
  } = {}) {
    this.rows = Math.max(2, Math.min(40, Math.floor(rows) || 8));
    this.cols = Math.max(2, Math.min(60, Math.floor(cols) || 8));
    this.mineCount = Math.max(
      1,
      Math.min(this.rows * this.cols - 1, Math.floor(mines) || 10),
    );
    this.rng = rng;
    this.now = now;
    this.reset();
  }
  reset() {
    this.cells = Array.from({ length: this.rows * this.cols }, () => ({
      mine: false,
      open: false,
      flag: false,
      adjacent: 0,
    }));
    this.status = "ready";
    this.flags = 0;
    this.opened = 0;
    this.startedAt = null;
    this.endedAt = null;
    this.exploded = -1;
    return this;
  }
  get remaining() {
    return this.mineCount - this.flags;
  }
  get elapsed() {
    return this.startedAt === null
      ? 0
      : Math.max(
          0,
          Math.floor(((this.endedAt ?? this.now()) - this.startedAt) / 1000),
        );
  }
  neighbors(index) {
    const r = Math.floor(index / this.cols),
      c = index % this.cols,
      result = [];
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const rr = r + dy,
          cc = c + dx;
        if (rr >= 0 && rr < this.rows && cc >= 0 && cc < this.cols)
          result.push(rr * this.cols + cc);
      }
    return result;
  }
  _place(safeIndex) {
    let safe = new Set([safeIndex, ...this.neighbors(safeIndex)]);
    if (this.cells.length - safe.size < this.mineCount)
      safe = new Set([safeIndex]);
    const available = this.cells.map((_, i) => i).filter((i) => !safe.has(i));
    for (let i = available.length - 1; i > 0; i--) {
      const j = Math.max(0, Math.min(i, Math.floor(this.rng() * (i + 1))));
      [available[i], available[j]] = [available[j], available[i]];
    }
    for (const i of available.slice(0, this.mineCount))
      this.cells[i].mine = true;
    this.cells.forEach((cell, i) => {
      cell.adjacent = this.neighbors(i).filter(
        (n) => this.cells[n].mine,
      ).length;
    });
    this.status = "playing";
    this.startedAt = this.now();
  }
  toggleFlag(index) {
    const cell = this.cells[index];
    if (!cell || cell.open || this.status === "won" || this.status === "lost")
      return false;
    cell.flag = !cell.flag;
    this.flags += cell.flag ? 1 : -1;
    return true;
  }
  reveal(index) {
    const cell = this.cells[index];
    if (!cell || cell.flag || this.status === "won" || this.status === "lost")
      return false;
    if (cell.open) return this.chord(index);
    if (this.status === "ready") this._place(index);
    return this._reveal([index]);
  }
  chord(index) {
    const cell = this.cells[index];
    if (this.status !== "playing" || !cell?.open || !cell.adjacent)
      return false;
    const neighbors = this.neighbors(index);
    if (neighbors.filter((n) => this.cells[n].flag).length !== cell.adjacent)
      return false;
    return this._reveal(
      neighbors.filter((n) => !this.cells[n].open && !this.cells[n].flag),
    );
  }
  _reveal(indices) {
    const queue = [...indices];
    let changed = false;
    for (let q = 0; q < queue.length; q++) {
      const index = queue[q],
        cell = this.cells[index];
      if (cell.open || cell.flag) continue;
      changed = true;
      cell.open = true;
      if (cell.mine) {
        this.status = "lost";
        this.exploded = index;
        this.endedAt = this.now();
        return true;
      }
      this.opened++;
      if (!cell.adjacent)
        for (const n of this.neighbors(index))
          if (!this.cells[n].open && !this.cells[n].flag) queue.push(n);
    }
    if (this.opened === this.cells.length - this.mineCount) {
      this.status = "won";
      this.endedAt = this.now();
      this.cells.forEach((cell) => {
        if (cell.mine) cell.flag = true;
      });
      this.flags = this.mineCount;
    }
    return changed;
  }
}

export const MINE_LEVELS = Object.freeze({
  beginner: { rows: 8, cols: 8, mines: 10 },
  intermediate: { rows: 16, cols: 16, mines: 40 },
  expert: { rows: 16, cols: 30, mines: 99 },
});
