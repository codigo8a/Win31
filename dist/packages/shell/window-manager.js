import { el, icon } from "../core/dom.js";

let nextId = 0;
export class DesktopWindow {
  constructor(manager, options = {}) {
    this.manager = manager;
    this.os = manager.os;
    this.options = options;
    this.id = options.id || `window-${++nextId}`;
    this.appId = options.appId;
    this.title = options.title || "Windows";
    this.icon = options.icon || "document";
    this.parent = options.parent || manager.desktop;
    this.isGroup = !!options.isGroup;
    this.modal = !!options.modal;
    this.events = new EventTarget();
    this.cleanups = [];
    this.closeGuards = [];
    this.closed = false;
    this.closing = false;
    const bounds = this.bounds(),
      count = manager.windows.filter(
        (w) => w.parent === this.parent && !w.isGroup,
      ).length;
    const width = Math.min(options.width || 600, bounds.width),
      height = Math.min(options.height || 400, bounds.height);
    this.state = {
      x:
        options.x ??
        Math.max(
          0,
          Math.round((bounds.width - width) / 2) + ((count * 17) % 68),
        ),
      y:
        options.y ??
        Math.max(
          0,
          Math.round((bounds.height - height) / 2) - 18 + ((count * 14) % 56),
        ),
      width,
      height,
      minimized: false,
      maximized: false,
    };
    this.element = el("section", {
      class: `win-window ${options.className || ""}${this.modal ? " modal" : ""}`,
      role: this.modal ? "dialog" : "region",
      "aria-label": this.title,
      "aria-modal": this.modal ? "true" : undefined,
      tabIndex: -1,
      dataset: { windowId: this.id, appId: this.appId || "" },
    });
    this.titlebar = el("div", { class: "win-titlebar" });
    this.systemButton = el(
      "button",
      {
        class: "win-system-button",
        "aria-label": `${this.title} system menu`,
        title: "Control-menu",
        onClick: (e) => {
          e.stopPropagation();
          this.systemMenu();
        },
        onDblclick: (e) => {
          e.stopPropagation();
          this.close();
        },
      },
      el("span", { class: "system-mark" }),
    );
    this.caption = el("div", { class: "win-caption" }, this.title);
    this.titlebar.append(this.systemButton, this.caption);
    if (!this.modal) {
      this.minButton = el(
        "button",
        {
          class: "win-caption-button",
          "aria-label": `Minimize ${this.title}`,
          title: "Minimize",
          onClick: (e) => {
            e.stopPropagation();
            this.minimize();
          },
        },
        el("span", { class: "caption-triangle down" }),
      );
      this.maxButton = el(
        "button",
        {
          class: "win-caption-button",
          "aria-label": `Maximize ${this.title}`,
          title: "Maximize",
          onClick: (e) => {
            e.stopPropagation();
            this.maximize();
          },
        },
        el("span", { class: "caption-triangle up" }),
      );
      this.titlebar.append(this.minButton, this.maxButton);
    }
    this.content = el("div", { class: "win-content" });
    this.element.append(this.titlebar, this.content);
    this.parent.append(this.element);
    this.element.addEventListener("pointerdown", () => this.focus(), true);
    this.element.addEventListener("focusin", (e) => {
      if (e.target.closest(".win-window") !== this.element) return;
      this.lastFocus = e.target;
      if (this.manager.active !== this) this.focus();
    });
    this.caption.addEventListener("pointerdown", (e) => this.startDrag(e));
    this.caption.addEventListener("dblclick", () => {
      if (!this.modal) this.maximize();
    });
    if (!this.modal && options.resizable !== false) {
      for (const direction of ["n", "s", "e", "w", "nw", "ne", "sw", "se"]) {
        const grip = el("div", {
          class: `window-grip ${direction}`,
          "aria-hidden": "true",
        });
        grip.addEventListener("pointerdown", (e) =>
          this.startResize(e, direction),
        );
        this.element.append(grip);
      }
    }
    this.resizeObserver = new ResizeObserver(() =>
      this.emit("resize", {
        width: this.content.clientWidth,
        height: this.content.clientHeight,
      }),
    );
    this.resizeObserver.observe(this.content);
    manager.windows.push(this);
    this.applyGeometry();
    this.focus();
    if (options.maximized) this.maximize();
  }
  bounds() {
    return {
      width: this.parent.clientWidth || window.innerWidth,
      height: this.parent.clientHeight || window.innerHeight,
    };
  }
  applyGeometry() {
    const s = this.state;
    Object.assign(this.element.style, {
      left: `${Math.round(s.x)}px`,
      top: `${Math.round(s.y)}px`,
      width: `${Math.round(s.width)}px`,
      height: `${Math.round(s.height)}px`,
    });
  }
  setTitle(title) {
    this.title = String(title);
    this.caption.textContent = this.title;
    this.element.setAttribute("aria-label", this.title);
    if (this.minIcon) this.minIcon.lastElementChild.textContent = this.title;
    this.emit("titlechange", this.title);
  }
  setMenu(menus) {
    this.os.menus.attach(this, menus);
  }
  on(type, handler) {
    const listener = (e) => handler(e.detail);
    this.events.addEventListener(type, listener);
    return () => this.events.removeEventListener(type, listener);
  }
  emit(type, detail) {
    this.events.dispatchEvent(new CustomEvent(type, { detail }));
  }
  focus() {
    if (this.closed) return;
    if (this.state.minimized) {
      this.restore();
      return;
    }
    if (this.isGroup) {
      const parent = this.manager.windows.find(
        (w) => w.appId === "programmanager",
      );
      if (parent?.state.minimized) parent.restore();
    }
    const top = this.manager.windows.filter((w) => w.modal && !w.closed).at(-1);
    if (top && top !== this) {
      top.focus();
      return;
    }
    this.manager.focus(this);
  }
  startDrag(e) {
    if (e.button !== 0 || this.state.maximized || e.target.closest("button"))
      return;
    e.preventDefault();
    this.focus();
    const sx = e.clientX,
      sy = e.clientY,
      origin = { ...this.state },
      target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const b = this.bounds();
      this.state.x = Math.max(
        -this.state.width + 90,
        Math.min(b.width - 90, origin.x + ev.clientX - sx),
      );
      this.state.y = Math.max(
        0,
        Math.min(b.height - 24, origin.y + ev.clientY - sy),
      );
      this.applyGeometry();
    };
    const done = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", done);
      target.removeEventListener("pointercancel", done);
      this.manager.saveLayout();
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", done);
    target.addEventListener("pointercancel", done);
  }
  startResize(e, direction) {
    if (e.button !== 0 || this.state.maximized) return;
    e.preventDefault();
    e.stopPropagation();
    this.focus();
    const target = e.currentTarget;
    target.setPointerCapture(e.pointerId);
    const sx = e.clientX,
      sy = e.clientY,
      o = { ...this.state };
    const move = (ev) => {
      const dx = ev.clientX - sx,
        dy = ev.clientY - sy,
        b = this.bounds();
      let x = o.x,
        y = o.y,
        w = o.width,
        h = o.height;
      const minW = Math.min(this.options.minWidth || 180, b.width),
        minH = Math.min(this.options.minHeight || 120, b.height);
      if (direction.includes("e"))
        w = Math.max(minW, Math.min(b.width - o.x, o.width + dx));
      if (direction.includes("s"))
        h = Math.max(minH, Math.min(b.height - o.y, o.height + dy));
      if (direction.includes("w")) {
        x = Math.max(0, Math.min(o.x + o.width - minW, o.x + dx));
        w = o.width + o.x - x;
      }
      if (direction.includes("n")) {
        y = Math.max(0, Math.min(o.y + o.height - minH, o.y + dy));
        h = o.height + o.y - y;
      }
      Object.assign(this.state, { x, y, width: w, height: h });
      this.applyGeometry();
    };
    const done = () => {
      target.removeEventListener("pointermove", move);
      target.removeEventListener("pointerup", done);
      target.removeEventListener("pointercancel", done);
      this.manager.saveLayout();
    };
    target.addEventListener("pointermove", move);
    target.addEventListener("pointerup", done);
    target.addEventListener("pointercancel", done);
  }
  minimize() {
    if (this.modal || this.closed || this.state.minimized) return;
    this.os.menus.close();
    this.state.minimized = true;
    this.element.classList.add("minimized");
    this.element.setAttribute("aria-hidden", "true");
    this.minIcon = el(
      "button",
      {
        class: `minimized-icon ${this.isGroup ? "group-minimized-icon" : ""}`,
        "aria-label": `Restore ${this.title}`,
        onClick: () => {
          this.minIcon?.classList.add("selected");
        },
        onDblclick: () => this.restore(),
        onKeydown: (e) => {
          if (e.key === "Enter") this.restore();
        },
        onContextmenu: (e) => {
          e.preventDefault();
          this.systemMenu(e.clientX, e.clientY);
        },
      },
      icon(this.icon),
      el("span", {}, this.title),
    );
    this.parent.append(this.minIcon);
    this.manager.arrangeIcons(this.parent);
    this.manager.activateNext(this);
    this.emit("minimize");
    this.manager.saveLayout();
  }
  maximize() {
    if (this.modal || this.closed) return;
    if (this.state.minimized) this.restore();
    if (this.state.maximized) {
      this.restore();
      return;
    }
    this.previous = { ...this.state };
    const b = this.bounds();
    Object.assign(this.state, {
      x: 0,
      y: 0,
      width: b.width,
      height: b.height,
      maximized: true,
    });
    this.element.classList.add("maximized");
    this.maxButton?.replaceChildren(el("span", { class: "caption-restore" }));
    this.maxButton?.setAttribute("aria-label", `Restore ${this.title}`);
    this.applyGeometry();
    this.focus();
    this.emit("maximize");
    this.manager.saveLayout();
  }
  restore() {
    if (this.closed) return;
    this.os.menus.close();
    if (this.state.minimized) {
      this.state.minimized = false;
      this.element.classList.remove("minimized");
      this.element.removeAttribute("aria-hidden");
      this.minIcon?.remove();
      this.minIcon = null;
      this.manager.arrangeIcons(this.parent);
    } else if (this.state.maximized) {
      Object.assign(
        this.state,
        this.previous || { x: 30, y: 30, width: 600, height: 400 },
        { maximized: false },
      );
      this.element.classList.remove("maximized");
      this.maxButton?.replaceChildren(
        el("span", { class: "caption-triangle up" }),
      );
      this.maxButton?.setAttribute("aria-label", `Maximize ${this.title}`);
      this.applyGeometry();
    }
    this.focus();
    this.emit("restore");
    this.manager.saveLayout();
  }
  async close(force = false) {
    if (this.closed || this.closing) return false;
    this.closing = true;
    try {
      if (!force) {
        for (const guard of this.closeGuards) {
          if ((await guard()) === false) return false;
        }
      }
      this.os.menus.close();
      this.closed = true;
      this.resizeObserver?.disconnect();
      for (const dispose of this.cleanups.splice(0)) {
        try {
          dispose();
        } catch (error) {
          this.os.reportError(error);
        }
      }
      this.element.remove();
      this.minIcon?.remove();
      this.manager.windows = this.manager.windows.filter((w) => w !== this);
      this.emit("close");
      this.manager.activateNext(this);
      this.manager.saveLayout();
      return true;
    } finally {
      this.closing = false;
    }
  }
  systemMenu(x, y) {
    this.os.menus.close();
    const r = this.systemButton.getBoundingClientRect();
    this.os.menus.show(
      [
        {
          label: "&Restore",
          disabled: !this.state.maximized && !this.state.minimized,
          action: () => this.restore(),
        },
        {
          label: "&Move",
          disabled: this.state.maximized,
          action: () => this.keyboardMove(false),
        },
        {
          label: "&Size",
          disabled: this.modal || this.state.maximized,
          action: () => this.keyboardMove(true),
        },
        {
          label: "Mi&nimize",
          disabled: this.modal || this.state.minimized,
          action: () => this.minimize(),
        },
        {
          label: "Ma&ximize",
          disabled: this.modal || this.state.maximized,
          action: () => this.maximize(),
        },
        { separator: true },
        { label: "&Close", shortcut: "Alt+F4", action: () => this.close() },
        { separator: true },
        {
          label: "&Switch To…",
          shortcut: "Ctrl+Esc",
          action: () => this.os.showTaskList(),
        },
      ],
      x ?? r.left,
      y ?? r.bottom,
      this,
    );
  }
  keyboardMove(size) {
    this.focus();
    const original = { ...this.state };
    const handler = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        Object.assign(this.state, original);
        this.applyGeometry();
        finish();
      } else if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        finish();
      } else if (e.key.startsWith("Arrow")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const d = e.ctrlKey ? 1 : 8;
        if (size) {
          if (e.key === "ArrowRight") this.state.width += d;
          if (e.key === "ArrowLeft")
            this.state.width = Math.max(
              this.options.minWidth || 180,
              this.state.width - d,
            );
          if (e.key === "ArrowDown") this.state.height += d;
          if (e.key === "ArrowUp")
            this.state.height = Math.max(
              this.options.minHeight || 120,
              this.state.height - d,
            );
        } else {
          if (e.key === "ArrowRight") this.state.x += d;
          if (e.key === "ArrowLeft") this.state.x -= d;
          if (e.key === "ArrowDown") this.state.y += d;
          if (e.key === "ArrowUp") this.state.y = Math.max(0, this.state.y - d);
        }
        const b = this.bounds();
        this.state.x = Math.max(
          -this.state.width + 90,
          Math.min(b.width - 90, this.state.x),
        );
        this.state.y = Math.max(0, Math.min(b.height - 24, this.state.y));
        this.state.width = Math.min(
          b.width - Math.max(0, this.state.x),
          this.state.width,
        );
        this.state.height = Math.min(
          b.height - this.state.y,
          this.state.height,
        );
        this.applyGeometry();
      }
    };
    const finish = () => {
      document.removeEventListener("keydown", handler, true);
      this.manager.saveLayout();
    };
    document.addEventListener("keydown", handler, true);
    this.cleanups.push(finish);
  }
}

export class WindowManager {
  constructor(os, desktop) {
    this.os = os;
    this.desktop = desktop;
    this.windows = [];
    this.active = null;
    this.z = 10;
    this.focusCounter = 0;
    window.addEventListener("resize", () => this.resize());
  }
  create(options) {
    return new DesktopWindow(this, options);
  }
  focus(win) {
    const changed = this.active !== win;
    for (const w of this.windows)
      w.element.classList.toggle(
        "active",
        w === win || (win.isGroup && w.appId === "programmanager"),
      );
    this.active = win;
    win.focusOrder = ++this.focusCounter;
    win.element.style.zIndex = String(win.modal ? 100001 : ++this.z);
    if (win.isGroup) {
      const parent = this.windows.find((w) => w.appId === "programmanager");
      if (parent) parent.element.style.zIndex = String(++this.z);
    }
    if (!win.element.contains(document.activeElement)) {
      const target =
        win.lastFocus?.isConnected && win.lastFocus.offsetParent !== null
          ? win.lastFocus
          : win.element;
      target.focus({ preventScroll: true });
    }
    if (changed) win.emit("focus");
    this.os.events.dispatchEvent(
      new CustomEvent("windowfocus", {
        detail: { id: win.id, appId: win.appId },
      }),
    );
  }
  activateNext(except) {
    const next = this.windows
      .filter(
        (w) =>
          w !== except &&
          !w.closed &&
          !w.state.minimized &&
          !w.parent.closest?.(".win-window.minimized"),
      )
      .sort((a, b) => (b.focusOrder || 0) - (a.focusOrder || 0))[0];
    if (next) this.focus(next);
    else this.active = null;
  }
  resize() {
    for (const w of this.windows) {
      const b = w.bounds();
      if (w.state.maximized)
        Object.assign(w.state, {
          x: 0,
          y: 0,
          width: b.width,
          height: b.height,
        });
      else {
        w.state.width = Math.min(w.state.width, b.width);
        w.state.height = Math.min(w.state.height, b.height);
        w.state.x = Math.max(0, Math.min(w.state.x, b.width - 90));
        w.state.y = Math.max(0, Math.min(w.state.y, b.height - 30));
      }
      w.applyGeometry();
    }
    this.arrangeIcons();
  }
  tile(parent = this.active?.isGroup ? this.active.parent : this.desktop) {
    const wins = this.windows.filter(
      (w) => w.parent === parent && !w.state.minimized && !w.modal,
    );
    if (!wins.length) return;
    const cols = Math.ceil(Math.sqrt(wins.length)),
      rows = Math.ceil(wins.length / cols),
      width = parent.clientWidth / cols,
      height = parent.clientHeight / rows;
    wins.forEach((w, i) => {
      if (w.state.maximized) w.restore();
      Object.assign(w.state, {
        x: (i % cols) * width,
        y: Math.floor(i / cols) * height,
        width,
        height,
      });
      w.applyGeometry();
    });
    this.saveLayout();
  }
  cascade(parent = this.active?.isGroup ? this.active.parent : this.desktop) {
    const wins = this.windows.filter(
      (w) => w.parent === parent && !w.state.minimized && !w.modal,
    );
    wins.forEach((w, i) => {
      if (w.state.maximized) w.restore();
      Object.assign(w.state, {
        x: 12 + i * 25,
        y: 12 + i * 25,
        width: Math.max(200, parent.clientWidth - 80 - wins.length * 15),
        height: Math.max(150, parent.clientHeight - 110 - wins.length * 10),
      });
      w.applyGeometry();
      w.focus();
    });
    this.saveLayout();
  }
  arrangeIcons(parent) {
    const parents = parent
      ? [parent]
      : [...new Set(this.windows.map((w) => w.parent))];
    for (const p of parents) {
      let i = 0;
      for (const w of this.windows.filter((w) => w.parent === p && w.minIcon)) {
        w.minIcon.style.left = `${10 + (i % Math.max(1, Math.floor(p.clientWidth / 100))) * 100}px`;
        w.minIcon.style.bottom = `${8 + Math.floor(i / Math.max(1, Math.floor(p.clientWidth / 100))) * 78}px`;
        i++;
      }
    }
  }
  saveLayout() {
    clearTimeout(this.layoutTimer);
    this.layoutTimer = setTimeout(() => {
      const layout = {};
      for (const w of this.windows.filter(
        (w) => w.isGroup || w.appId === "programmanager",
      ))
        layout[w.appId || w.id] = { ...w.state, previous: w.previous };
      this.os.storage.set("layout", layout);
    }, 200);
  }
}
