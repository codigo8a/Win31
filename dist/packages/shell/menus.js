import { el, mnemonic, plainLabel } from "../core/dom.js";

export class MenuController {
  constructor(os) {
    this.os = os;
    this.popups = [];
    this.owner = null;
    this.items = [];
    this.index = -1;
    document.addEventListener(
      "pointerdown",
      (e) => {
        if (
          this.popups.length &&
          !e.target.closest(".win-popup,.win-menubar,.win-system-button")
        )
          this.close();
      },
      true,
    );
    document.addEventListener("keydown", (e) => this.keydown(e), true);
  }
  attach(win, menus) {
    const sameStructure =
      win.menuElement &&
      win.menus?.length === menus?.length &&
      win.menus.every((menu, index) => menu.label === menus[index].label);
    win.menus = menus;
    if (sameStructure) {
      win.menuElement.setAttribute("aria-label", `${win.title} menu`);
      return;
    }
    win.menuElement?.remove();
    if (!menus?.length) return;
    const bar = el("nav", {
      class: "win-menubar",
      "aria-label": `${win.title} menu`,
      role: "menubar",
    });
    win.menuElement = bar;
    menus.forEach((menu, index) => {
      const trigger = el(
        "button",
        {
          role: "menuitem",
          "aria-haspopup": "true",
          "aria-expanded": "false",
          onPointerdown: (e) => e.stopPropagation(),
          onClick: (e) => {
            e.stopPropagation();
            this.openMenu(win, index, trigger);
          },
          onPointerenter: () => {
            if (this.owner === win && this.popups.length)
              this.openMenu(win, index, trigger, false);
          },
        },
        mnemonic(menu.label),
      );
      bar.append(trigger);
    });
    win.element.insertBefore(bar, win.content);
  }
  openMenu(win, index, trigger, toggle = true) {
    const isSame = this.owner === win && this.index === index;
    if (isSame && !toggle) return;
    this.close();
    if (isSame) return;
    win.focus();
    this.owner = win;
    this.index = index;
    const menu = win.menus[index];
    const items = typeof menu.items === "function" ? menu.items() : menu.items;
    const rect = trigger.getBoundingClientRect();
    trigger.classList.add("open");
    trigger.setAttribute("aria-expanded", "true");
    this.show(items || [], rect.left, rect.bottom, win);
  }
  show(items, x, y, owner = this.os.wm.active, depth = 0) {
    if (depth === 0 && !this.popups.length) this.owner = owner;
    this.popups.splice(depth).forEach((p) => p.remove());
    const popup = el("div", { class: "win-popup", role: "menu" });
    popup._items = items;
    items.forEach((item) => {
      if (item.separator) {
        popup.append(el("div", { class: "menu-separator", role: "separator" }));
        return;
      }
      const disabled =
        typeof item.disabled === "function" ? item.disabled() : item.disabled;
      const checked =
        typeof item.checked === "function" ? item.checked() : item.checked;
      const b = el(
        "button",
        {
          role: item.checked !== undefined ? "menuitemcheckbox" : "menuitem",
          tabIndex: -1,
          disabled,
          "aria-checked": checked === undefined ? undefined : !!checked,
        },
        checked ? el("span", { class: "menu-check" }, "✓") : null,
        mnemonic(item.label),
        item.shortcut
          ? el("span", { class: "menu-shortcut" }, item.shortcut)
          : null,
        item.items ? el("span", { class: "menu-subarrow" }, "▶") : null,
      );
      b._item = item;
      b.addEventListener("pointerenter", () => {
        for (const n of popup.querySelectorAll("button"))
          n.classList.remove("hover");
        b.classList.add("hover");
        this.popups.splice(depth + 1).forEach((p) => p.remove());
        if (item.items && !disabled) {
          const r = b.getBoundingClientRect();
          this.show(
            typeof item.items === "function" ? item.items() : item.items,
            r.right - 3,
            r.top,
            owner,
            depth + 1,
          );
        }
      });
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        if (item.items) {
          const r = b.getBoundingClientRect();
          this.show(
            typeof item.items === "function" ? item.items() : item.items,
            r.right - 3,
            r.top,
            owner,
            depth + 1,
          );
        } else this.execute(item, owner);
      });
      popup.append(b);
    });
    document.body.append(popup);
    this.popups.push(popup);
    const r = popup.getBoundingClientRect();
    popup.style.left = `${Math.max(1, Math.min(x, window.innerWidth - r.width - 5))}px`;
    popup.style.top = `${Math.max(1, Math.min(y, window.innerHeight - r.height - 5))}px`;
    return popup;
  }
  execute(item, owner) {
    this.close();
    if (!item.action) return;
    Promise.resolve()
      .then(() => item.action())
      .catch((error) =>
        this.os.message(
          error.message || String(error),
          owner?.title || "Windows",
        ),
      );
  }
  close() {
    this.popups.forEach((p) => p.remove());
    this.popups = [];
    this.owner?.menuElement?.querySelectorAll("button").forEach((b) => {
      b.classList.remove("open");
      b.setAttribute("aria-expanded", "false");
    });
    this.owner = null;
    this.index = -1;
  }
  keydown(e) {
    if (this.popups.length) {
      const popup = this.popups.at(-1),
        buttons = [...popup.querySelectorAll("button:not(:disabled)")];
      let i = buttons.findIndex((b) => b.classList.contains("hover"));
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.close();
        return;
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        e.stopImmediatePropagation();
        i =
          (i + (e.key === "ArrowDown" ? 1 : -1) + buttons.length) %
          buttons.length;
        buttons.forEach((b) => b.classList.remove("hover"));
        buttons[i]?.classList.add("hover");
        buttons[i]?.scrollIntoView({ block: "nearest" });
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopImmediatePropagation();
        (buttons[i] || buttons[0])?.click();
        return;
      }
      if (
        (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
        this.owner?.menus
      ) {
        e.preventDefault();
        e.stopImmediatePropagation();
        const win = this.owner,
          index =
            (this.index +
              (e.key === "ArrowRight" ? 1 : -1) +
              win.menus.length) %
            win.menus.length;
        this.openMenu(win, index, win.menuElement.children[index]);
        return;
      }
      if (e.key.length === 1) {
        const match = buttons.find(
          (b) =>
            b._item.label.match(/&(.)/)?.[1].toLowerCase() ===
            e.key.toLowerCase(),
        );
        if (match) {
          e.preventDefault();
          e.stopImmediatePropagation();
          match.click();
          return;
        }
      }
    }
    const active = this.os.wm.active;
    const win = active?.isGroup ? this.os.programManager : active;
    if (!win?.menus) return;
    if (win.element.inert) return;
    if (e.altKey && !e.ctrlKey && e.key.length === 1) {
      const index = win.menus.findIndex(
        (m) => m.label.match(/&(.)/)?.[1].toLowerCase() === e.key.toLowerCase(),
      );
      if (index >= 0) {
        e.preventDefault();
        e.stopImmediatePropagation();
        this.openMenu(win, index, win.menuElement.children[index]);
        return;
      }
    }
    if (e.key === "F10") {
      e.preventDefault();
      this.openMenu(win, 0, win.menuElement.children[0]);
      return;
    }
    if (
      e.target instanceof Node &&
      !win.element.contains(e.target) &&
      !active?.element.contains(e.target)
    )
      return;
    if (
      !e.ctrlKey &&
      !e.altKey &&
      !/^F\d+$/.test(e.key) &&
      (e.target?.closest?.("input,textarea,select,[contenteditable]") ||
        e.target?.isContentEditable)
    )
      return;
    const matchShortcut = (s) => {
      const parts = s.toLowerCase().split("+"),
        key = parts.at(-1),
        actual = e.key.toLowerCase();
      return (
        parts.includes("ctrl") === e.ctrlKey &&
        parts.includes("alt") === e.altKey &&
        parts.includes("shift") === e.shiftKey &&
        (key === actual || (key === "del" && actual === "delete"))
      );
    };
    const find = (items) => {
      for (const item of items) {
        if (
          item.shortcut &&
          matchShortcut(item.shortcut) &&
          !(typeof item.disabled === "function"
            ? item.disabled()
            : item.disabled)
        )
          return item;
        if (Array.isArray(item.items)) {
          const nested = find(item.items);
          if (nested) return nested;
        }
      }
    };
    const item = find(
      win.menus.flatMap((m) =>
        typeof m.items === "function" ? m.items() : m.items || [],
      ),
    );
    if (item) {
      e.preventDefault();
      e.stopImmediatePropagation();
      this.execute(item, win);
    }
  }
}
