import { el, button, icon, download, escapeHTML } from "./dom.js";
import { VirtualFileSystem } from "./filesystem.js";
import { SafeStorage } from "./storage.js";
import { DesktopRenderer } from "../render/index.js";
import { PixelOperations } from "../render/pixel-ops.js";
import { startScreenSaver } from "../render/screen-saver.js";
import { WindowManager } from "../shell/window-manager.js";
import { MenuController } from "../shell/menus.js";

const DEFAULT_SETTINGS = {
  desktopColor: "#c0c0c0",
  windowColor: "#ffffff",
  textColor: "#000000",
  titleColor: "#000080",
  titleTextColor: "#ffffff",
  fontFamily: "MS Sans Serif",
  fontSize: 13,
  wallpaperPattern: "none",
  screenSaver: "none",
  screenSaverMinutes: 5,
  soundEnabled: true,
  doubleClickInterval: 500,
  pointerSpeed: 10,
  dateFormat: "M/d/yyyy",
  timeFormat: "12",
  locale: "en-US",
  saveSettingsOnExit: true,
  clockOffsetMs: 0,
};
const ALIASES = {
  winfile: "filemanager",
  control: "control",
  printman: "printmanager",
  clipbrd: "clipboard",
  command: "dos",
  dosprmpt: "dos",
  setup: "setup",
  pifedit: "pifeditor",
  write: "write",
  pbrush: "paintbrush",
  terminal: "terminal",
  notepad: "notepad",
  recorder: "recorder",
  cardfile: "cardfile",
  calendar: "calendar",
  calc: "calculator",
  clock: "clock",
  packager: "packager",
  charmap: "charmap",
  mplayer: "mediaplayer",
  soundrec: "soundrecorder",
  sol: "solitaire",
  winmine: "minesweeper",
  progman: "programmanager",
  winhelp: "help",
  regedit: "regedit",
  sysedit: "sysedit",
  drwatson: "drwatson",
  wintutor: "tutorial",
  win: "programmanager",
};

export class Windows31 {
  constructor(desktop, options = {}) {
    this.desktop = desktop;
    this.storage = options.storage || new SafeStorage("win31:");
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...this.storage.get("settings", {}),
    };
    this.fs =
      options.fs ||
      new VirtualFileSystem({
        onStorageError: (error, details) => {
          if (!details.recovered && !this.storageErrorShown) {
            this.storageErrorShown = true;
            queueMicrotask(() =>
              this.message(
                `The virtual drive could not be saved: ${error.message}\n\nKeep this window open and export your files before closing Windows.`,
                "Virtual Drive",
              ),
            );
          }
        },
      });
    this.apps = new Map();
    this.events = new EventTarget();
    this.clipboard = { text: "", files: [], cut: false };
    this.printJobs = [];
    this.errors = [];
    this.cleanups = [];
    this.wm = new WindowManager(this, desktop);
    this.menus = new MenuController(this);
    this.startedAt = Date.now();
    this.clipboardText = "";
  }
  async init() {
    await this.fs.ready;
    this.fs.subscribe((change) =>
      this.events.dispatchEvent(
        new CustomEvent("fschange", { detail: change }),
      ),
    );
    this.applySettings();
    this.renderer = new DesktopRenderer(
      document.getElementById("desktop-canvas"),
      { ...this.settings, desktopPattern: this.settings.wallpaperPattern },
    );
    await this.renderer.init();
    this.pixelOps = new PixelOperations();
    this.bindKeyboard();
    this.bindDragDrop();
    this.bindScreensaver();
    window.addEventListener("error", (e) =>
      this.reportError(e.error || new Error(e.message)),
    );
    window.addEventListener("unhandledrejection", (e) =>
      this.reportError(e.reason),
    );
    window.addEventListener("beforeunload", (e) => {
      if (this.wm.windows.some((w) => w.dirty)) {
        e.preventDefault();
        e.returnValue = "";
      }
    });
    return this;
  }
  registerApp(definition) {
    if (!definition.id || typeof definition.create !== "function")
      throw new TypeError("An application needs an id and a create function.");
    this.apps.set(definition.id, definition);
  }
  open(id, args = {}) {
    const def = this.apps.get(id);
    if (!def) {
      void this.message(
        `Cannot find ${id}. Check the command line and try again.`,
        "Program Manager",
      );
      return null;
    }
    if (def.singleton) {
      const existing = this.wm.windows.find((w) => w.appId === id && !w.closed);
      if (existing) {
        existing.state.minimized ? existing.restore() : existing.focus();
        if (args.panel && existing.openPanel) existing.openPanel(args.panel);
        if (args.path && existing.openFile) existing.openFile(args.path);
        return existing;
      }
    }
    const win = this.wm.create({
      title: def.title,
      appId: id,
      icon: def.icon || id,
      width: def.width || 600,
      height: def.height || 400,
      minWidth: def.minWidth,
      minHeight: def.minHeight,
      ...args.window,
    });
    const ctx = {
      os: this,
      app: def,
      win,
      content: win.content,
      setMenu: (menus) => win.setMenu(menus),
      setTitle: (title) => win.setTitle(title),
      onClose: (callback) => {
        win.closeGuards.push(callback);
        return () => {
          win.closeGuards = win.closeGuards.filter((x) => x !== callback);
        };
      },
      onResize: (callback) => {
        const cleanup = win.on("resize", callback);
        win.cleanups.push(cleanup);
        return cleanup;
      },
      cleanup: (callback) => win.cleanups.push(callback),
    };
    try {
      const result = def.create(ctx, args);
      if (result instanceof Promise)
        result.catch((e) => this.reportAppError(win, e));
      else if (typeof result === "function") win.cleanups.push(result);
    } catch (error) {
      this.reportAppError(win, error);
    }
    this.events.dispatchEvent(
      new CustomEvent("appopen", { detail: { id, args } }),
    );
    queueMicrotask(() => {
      if (this.wm.active === win)
        win.content
          .querySelector(
            "textarea,input:not([type=checkbox]):not([type=radio]),[contenteditable=true]",
          )
          ?.focus({ preventScroll: true });
    });
    return win;
  }
  reportAppError(win, error) {
    this.reportError(error);
    win.content.replaceChildren(
      el(
        "div",
        { class: "dialog-body" },
        el("p", {}, "The application could not complete this operation."),
        el("p", {}, error.message || String(error)),
        button("Close", () => win.close()),
      ),
    );
  }
  reportError(error) {
    const record = {
      message: error?.message || String(error),
      stack: error?.stack || "",
      date: new Date().toISOString(),
    };
    this.errors.push(record);
    if (this.errors.length > 100) this.errors.shift();
    this.events.dispatchEvent(
      new CustomEvent("diagnostic", { detail: record }),
    );
    console.error(error);
  }
  async run(commandLine) {
    const tokens =
      String(commandLine)
        .trim()
        .match(/"[^"]*"|\S+/g) || [];
    if (!tokens.length) return;
    const raw = tokens.shift().replace(/^"|"$/g, ""),
      base = raw
        .split(/[\\/]/)
        .at(-1)
        .replace(/\.(exe|com|pif)$/i, "")
        .toLowerCase(),
      arg = tokens.join(" ").replace(/^"|"$/g, "");
    if (this.fs.exists(raw) && !/\.(exe|com|pif)$/i.test(raw))
      return this.openFile(raw);
    const id = ALIASES[base] || (this.apps.has(base) ? base : null);
    if (!id) {
      await this.message(
        `Cannot find the file '${raw}'.\n\nUse File Manager to open a document, or enter a Windows program such as NOTEPAD, CALC, or WINFILE.`,
        "Program Manager",
      );
      return;
    }
    const args = arg ? { path: arg, file: arg, command: arg } : {};
    return this.open(id, args);
  }
  openFile(path) {
    path = this.fs.normalize(path);
    const stat = this.fs.stat(path);
    if (stat.type === "directory") return this.open("filemanager", { path });
    const ext = path.split(".").at(-1).toLowerCase();
    const map = {
      txt: "notepad",
      ini: "notepad",
      bat: "notepad",
      log: "notepad",
      md: "notepad",
      csv: "notepad",
      json: "notepad",
      wri: "write",
      rtf: "write",
      html: "write",
      htm: "write",
      png: "paintbrush",
      bmp: "paintbrush",
      jpg: "paintbrush",
      jpeg: "paintbrush",
      gif: "paintbrush",
      webp: "paintbrush",
      wav: "soundrecorder",
      webm: "mediaplayer",
      mp3: "mediaplayer",
      ogg: "mediaplayer",
      mp4: "mediaplayer",
      mid: "mediaplayer",
      midi: "mediaplayer",
      cal: "calendar",
      crd: "cardfile",
      rec: "recorder",
      pif: "pifeditor",
      trm: "terminal",
      reg: "regedit",
      pkg: "packager",
    };
    if (ext === "exe" || ext === "com")
      return this.message(
        "This desktop runs browser-native applications. Original DOS and Windows executables require a CPU and Windows API emulator.",
        "Windows",
      );
    return this.open(map[ext] || "notepad", { path, file: path });
  }
  dialog({
    title = "Windows",
    body = "",
    buttons = [{ label: "OK", value: "ok", default: true }],
    width = 420,
    height,
  } = {}) {
    return new Promise((resolve) => {
      const previousFocus = document.activeElement,
        overlay = el("div", { class: "modal-blocker" });
      this.desktop.append(overlay);
      const win = this.wm.create({
        title,
        width,
        height: height || 230,
        modal: true,
        resizable: false,
        className: "dialog-window",
      });
      const bodyNode =
        body instanceof Node
          ? body
          : el("div", { class: "dialog-message" }, el("p", {}, String(body)));
      const actions = el("div", { class: "dialog-actions" });
      let settled = false;
      const finish = async (value) => {
        if (settled) return;
        settled = true;
        overlay.remove();
        await win.close(true);
        if (previousFocus?.isConnected)
          previousFocus.focus({ preventScroll: true });
        resolve(value);
      };
      buttons.forEach((b, i) => {
        const node = button(b.label, () => finish(b.value), {
          class: `win-button ${b.default ? "default" : ""}`,
          dataset: { result: String(b.value) },
        });
        actions.append(node);
      });
      win.content.append(bodyNode, actions);
      win.closeGuards.push(() => {
        if (!settled) {
          settled = true;
          overlay.remove();
          resolve(null);
        }
        return true;
      });
      win.cleanups.push(() => overlay.remove());
      overlay.addEventListener("pointerdown", () => {
        win.focus();
        this.playSound("beep");
      });
      if (!height) {
        win.element.style.height = "auto";
        win.content.style.flex = "0 1 auto";
        win.content.style.overflow = "auto";
        win.element.style.maxHeight = `${this.desktop.clientHeight - 12}px`;
        const h = Math.min(
          win.element.getBoundingClientRect().height,
          this.desktop.clientHeight - 12,
        );
        win.state.height = h;
        win.state.y = Math.max(0, (this.desktop.clientHeight - h) / 2 - 18);
        win.applyGeometry();
      }
      const key = (e) => {
        if (this.wm.active !== win) return;
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          finish(null);
        } else if (
          e.key === "Enter" &&
          e.target.tagName !== "TEXTAREA" &&
          !e.target.isContentEditable &&
          e.target.tagName !== "BUTTON"
        ) {
          e.preventDefault();
          e.stopPropagation();
          finish((buttons.find((b) => b.default) || buttons[0])?.value);
        } else if (e.key === "Tab") {
          const list = [
            ...win.element.querySelectorAll(
              'button,input,select,textarea,[tabindex="0"]',
            ),
          ].filter((n) => !n.disabled && n.offsetParent !== null);
          if (!list.length) return;
          const first = list[0],
            last = list.at(-1);
          if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
          } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
          }
        }
      };
      win.element.addEventListener("keydown", key);
      bodyNode.addEventListener("dialogaccept", () =>
        finish((buttons.find((b) => b.default) || buttons[0])?.value),
      );
      queueMicrotask(() => {
        const focus =
          bodyNode.querySelector("input,textarea,select") ||
          actions.querySelector(".default") ||
          actions.firstElementChild;
        focus?.focus();
        if (focus?.tagName === "INPUT") focus.select?.();
      });
    });
  }
  message(text, title = "Windows") {
    this.playSound("beep");
    return this.dialog({
      title,
      body: el(
        "div",
        { class: "dialog-message" },
        icon("help"),
        el("p", {}, text),
      ),
      buttons: [{ label: "OK", value: true, default: true }],
    });
  }
  async confirm(text, title = "Windows") {
    return (
      (await this.dialog({
        title,
        body: el(
          "div",
          { class: "dialog-message" },
          icon("help"),
          el("p", {}, text),
        ),
        buttons: [
          { label: "Yes", value: true, default: true },
          { label: "No", value: false },
        ],
      })) === true
    );
  }
  async prompt(title, label, initialValue = "") {
    const input = el("input", {
      type: "text",
      value: initialValue,
      "aria-label": label,
    });
    const body = el(
      "label",
      { class: "dialog-field" },
      el("span", {}, label),
      input,
    );
    const result = await this.dialog({
      title,
      body,
      buttons: [
        { label: "OK", value: true, default: true },
        { label: "Cancel", value: false },
      ],
    });
    return result ? input.value : null;
  }
  async pickFile({
    title,
    save = false,
    filename = "",
    initialDir = "C:\\DOCUMENTS",
    filter,
  } = {}) {
    let dir = this.fs.exists(initialDir)
        ? this.fs.normalize(initialDir)
        : "C:\\DOCUMENTS",
      selected = "";
    const name = el("input", {
        type: "text",
        value: filename,
        "aria-label": "File name",
      }),
      pathLabel = el("span", { class: "file-picker-path" }),
      list = el("div", {
        class: "file-picker-list",
        role: "listbox",
        "aria-label": "Files",
      }),
      filterLabel = typeof filter === "string" ? filter : "All files (*.*)";
    const body = el(
      "div",
      { class: "file-picker" },
      el(
        "div",
        { style: { display: "flex", gap: "8px", alignItems: "center" } },
        button(
          "Up",
          () => {
            dir = this.fs.parent(dir);
            render();
          },
          { style: { minWidth: "40px" } },
        ),
        pathLabel,
      ),
      list,
      el(
        "div",
        { class: "file-picker-bottom" },
        el("label", {}, "File name:"),
        name,
        el("span", {}, "List files of type:"),
        el("span", {}, filterLabel),
      ),
    );
    const choose = (entry) => {
      selected = entry.path;
      list
        .querySelectorAll("button")
        .forEach((b) =>
          b.classList.toggle("selected", b.dataset.path === entry.path),
        );
      if (entry.type === "file") name.value = entry.name;
    };
    const render = () => {
      pathLabel.textContent = dir;
      list.replaceChildren();
      if (dir !== "C:\\")
        list.append(
          el(
            "button",
            {
              class: "file-picker-entry",
              onDblclick: () => {
                dir = this.fs.parent(dir);
                render();
              },
            },
            icon("folder", 20),
            "[..]",
          ),
        );
      for (const entry of this.fs
        .readdir(dir)
        .sort((a, b) =>
          a.type === b.type
            ? a.name.localeCompare(b.name)
            : a.type === "directory"
              ? -1
              : 1,
        )) {
        const node = el(
          "button",
          {
            class: "file-picker-entry",
            dataset: { path: entry.path },
            role: "option",
            onClick: () => choose(entry),
            onDblclick: () => {
              if (entry.type === "directory") {
                dir = entry.path;
                name.value = save ? name.value : "";
                render();
              } else {
                choose(entry);
                body.dispatchEvent(new Event("dialogaccept"));
              }
            },
            onKeydown: (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
                if (entry.type === "directory") {
                  dir = entry.path;
                  render();
                } else {
                  choose(entry);
                  body.dispatchEvent(new Event("dialogaccept"));
                }
              }
            },
          },
          icon(entry.type === "directory" ? "folder" : "document", 20),
          entry.name,
        );
        list.append(node);
      }
    };
    render();
    while (true) {
      const result = await this.dialog({
        title: title || (save ? "Save As" : "Open"),
        body,
        width: 480,
        buttons: [
          { label: save ? "Save" : "Open", value: true, default: true },
          { label: "Cancel", value: false },
        ],
      });
      if (!result) return null;
      const value = name.value.trim() || selected;
      if (!value) {
        await this.message("Enter a file name.", save ? "Save As" : "Open");
        continue;
      }
      let path;
      try {
        path = this.fs.normalize(value, dir);
      } catch (e) {
        await this.message(e.message);
        continue;
      }
      if (this.fs.exists(path) && this.fs.stat(path).type === "directory") {
        dir = path;
        name.value = "";
        render();
        continue;
      }
      if (!save && !this.fs.exists(path)) {
        await this.message(`Cannot find ${path}.`, "Open");
        continue;
      }
      if (
        save &&
        this.fs.exists(path) &&
        !(await this.confirm(
          `${path} already exists.\nReplace the existing file?`,
          "Save As",
        ))
      )
        continue;
      if (!this.fs.exists(this.fs.parent(path))) {
        await this.message("The folder does not exist.", "Save As");
        continue;
      }
      return path;
    }
  }
  async importFiles(destination = "C:\\DOCUMENTS") {
    const input = el("input", {
      type: "file",
      multiple: true,
      style: { display: "none" },
    });
    document.body.append(input);
    return new Promise((resolve) => {
      input.addEventListener(
        "cancel",
        () => {
          input.remove();
          resolve([]);
        },
        { once: true },
      );
      input.addEventListener(
        "change",
        async () => {
          const imported = [];
          for (const file of input.files) {
            try {
              const path = this.fs.normalize(file.name, destination);
              if (
                this.fs.exists(path) &&
                !(await this.confirm(
                  `${file.name} already exists. Replace it?`,
                  "Import Files",
                ))
              )
                continue;
              const content = /^(image|audio|video)\//.test(file.type)
                ? await this.fileAsDataURL(file)
                : await file.text();
              this.fs.writeFile(path, content);
              imported.push(path);
            } catch (e) {
              await this.message(e.message, "Import Files");
            }
          }
          input.remove();
          resolve(imported);
        },
        { once: true },
      );
      input.click();
    });
  }
  fileAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  }
  async copyText(text) {
    this.clipboard.text = String(text);
    this.events.dispatchEvent(new Event("clipboardchange"));
    try {
      await navigator.clipboard?.writeText(String(text));
    } catch {}
    return text;
  }
  async pasteText() {
    try {
      const text = await navigator.clipboard?.readText();
      if (text !== undefined) {
        this.clipboard.text = text;
        return text;
      }
    } catch {}
    return this.clipboard.text || "";
  }
  print(title, html) {
    const job = {
      id: crypto.randomUUID(),
      title,
      html,
      pages: 1,
      created: Date.now(),
      status: this.settings.printerPaused ? "Paused" : "Queued",
    };
    this.printJobs.push(job);
    this.events.dispatchEvent(new Event("printchange"));
    if (!this.settings.printerPaused) this.resumePrintQueue();
    return job;
  }
  resumePrintQueue() {
    if (this.printing || this.settings.printerPaused) return;
    const job = this.printJobs.find((j) =>
      /queued|pending|ready/i.test(j.status),
    );
    if (!job) return;
    this.printing = true;
    job.status = "Printing";
    this.events.dispatchEvent(new Event("printchange"));
    const frame = el("iframe", {
      title: `Print ${job.title}`,
      sandbox: "allow-modals allow-same-origin",
      style: {
        position: "fixed",
        width: "1px",
        height: "1px",
        left: "-9999px",
        border: "0",
      },
    });
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHTML(job.title)}</title><style>body{font:12pt Georgia,serif;margin:24px}img{max-width:100%}@media print{body{margin:0}}</style></head><body>${job.html}</body></html>`;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      job.status = "Completed";
      this.printing = false;
      frame.remove();
      this.events.dispatchEvent(new Event("printchange"));
    };
    frame.onload = () => {
      try {
        frame.contentWindow.addEventListener("afterprint", finish, {
          once: true,
        });
        frame.contentWindow.focus();
        frame.contentWindow.print();
      } catch (error) {
        job.status = "Error";
        this.printing = false;
        frame.remove();
        void this.message(error.message, "Print Manager");
      }
    };
    this.desktop.append(frame);
  }
  saveSettings() {
    this.storage.set("settings", this.settings);
    this.applySettings();
  }
  applySettings() {
    const s = this.settings,
      style = document.documentElement.style;
    for (const [key, css] of [
      ["desktopColor", "--desktop"],
      ["windowColor", "--window"],
      ["textColor", "--text"],
      ["titleColor", "--title"],
      ["titleTextColor", "--title-text"],
    ])
      if (/^#[0-9a-f]{3,8}$/i.test(s[key])) style.setProperty(css, s[key]);
    style.setProperty("--selection", s.titleColor || "#000080");
    style.setProperty("--selection-text", s.titleTextColor || "#fff");
    style.setProperty(
      "--font-size",
      `${Math.max(11, Math.min(24, Number(s.fontSize) || 13))}px`,
    );
    style.setProperty(
      "--font-ui",
      s.fontFamily === "MS Sans Serif"
        ? "WinBitmap, Arial, sans-serif"
        : `"${String(s.fontFamily).replace(/[";{}]/g, "")}", WinBitmap, sans-serif`,
    );
    this.renderer?.setTheme({ ...s, desktopPattern: s.wallpaperPattern });
    this.events.dispatchEvent(new Event("settingschange"));
  }
  playSound(kind = "click") {
    if (!this.settings.soundEnabled) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!A) return;
      this.audioContext ??= new A();
      const context = this.audioContext;
      if (context.state === "suspended") void context.resume();
      const osc = context.createOscillator(),
        gain = context.createGain();
      osc.type = "sine";
      osc.frequency.value =
        kind === "beep" ? 660 : kind === "startup" ? 523 : 440;
      gain.gain.setValueAtTime(0.025, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.1);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start();
      osc.stop(context.currentTime + 0.1);
    } catch {}
  }
  about(title = "Microsoft Windows", details = "") {
    return this.dialog({
      title: `About ${title}`,
      width: 475,
      body: el(
        "div",
        { class: "dialog-body", style: { display: "flex", gap: "20px" } },
        icon("programmanager", 64),
        el(
          "div",
          {},
          el("div", { class: "about-heading" }, "Microsoft Windows"),
          el("p", {}, "Version 3.1"),
          el(
            "p",
            { class: "about-copy" },
            title === "Microsoft Windows" ? "Browser edition" : title,
          ),
          details ? el("p", { class: "about-copy" }, details) : null,
          el(
            "div",
            { class: "about-footer" },
            "Enhanced mode",
            el("br"),
            `Graphics: ${this.renderer?.backend || "Canvas2D"}`,
            el("br"),
            "Files are saved on this browser and device.",
          ),
        ),
      ),
      buttons: [{ label: "OK", value: true, default: true }],
    });
  }
  async showTaskList() {
    let selected = this.wm.active;
    const list = el("div", {
      class: "task-list",
      role: "listbox",
      "aria-label": "Running tasks",
    });
    for (const win of this.wm.windows.filter((w) => !w.isGroup && !w.modal)) {
      const row = el(
        "button",
        {
          class: win === selected ? "selected" : "",
          onClick: () => {
            selected = win;
            list
              .querySelectorAll("button")
              .forEach((b) => b.classList.remove("selected"));
            row.classList.add("selected");
          },
          onDblclick: () => {
            selected = win;
            list.dispatchEvent(new Event("dialogaccept"));
          },
        },
        icon(win.icon, 20),
        win.title,
      );
      list.append(row);
    }
    const result = await this.dialog({
      title: "Task List",
      width: 380,
      body: list,
      buttons: [
        { label: "Switch To", value: "switch", default: true },
        { label: "End Task", value: "end" },
        { label: "Cancel", value: "cancel" },
      ],
    });
    if (selected && result === "switch")
      selected.state.minimized ? selected.restore() : selected.focus();
    if (selected && result === "end") await selected.close();
  }
  async showRun() {
    const input = el("input", {
      type: "text",
      "aria-label": "Command Line",
      value: "",
    });
    const body = el(
      "div",
      {},
      el("label", { class: "run-row" }, el("span", {}, "Command Line:"), input),
      el(
        "p",
        { style: { padding: "0 20px 8px", fontSize: "12px" } },
        "Type a program name, or the path to a document.",
      ),
    );
    const result = await this.dialog({
      title: "Run",
      body,
      width: 520,
      buttons: [
        { label: "OK", value: "run", default: true },
        { label: "Cancel", value: "cancel" },
        { label: "Browse…", value: "browse" },
      ],
    });
    if (result === "run") return this.run(input.value);
    if (result === "browse") {
      const path = await this.pickFile();
      if (path) return this.openFile(path);
    }
  }
  bindKeyboard() {
    document.addEventListener("keydown", (e) => {
      const win = this.wm.active;
      if (e.altKey && e.key === "F4") {
        e.preventDefault();
        win?.close();
      } else if (e.altKey && e.key === "Tab") {
        e.preventDefault();
        const wins = this.wm.windows
          .filter((w) => !w.isGroup && !w.modal && !w.closed)
          .sort((a, b) => (b.focusOrder || 0) - (a.focusOrder || 0));
        if (wins.length > 1) {
          const next = wins[1];
          next.state.minimized ? next.restore() : next.focus();
        }
      } else if (e.ctrlKey && e.key === "Escape") {
        e.preventDefault();
        this.showTaskList();
      } else if (e.altKey && e.key === " ") {
        e.preventDefault();
        win?.systemMenu();
      } else if (e.key === "F1" && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        this.open("help", { topic: win?.appId });
      }
    });
  }
  bindDragDrop() {
    document.addEventListener("dragover", (e) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    });
    document.addEventListener("drop", async (e) => {
      if (e.defaultPrevented || !e.dataTransfer?.files.length) return;
      e.preventDefault();
      for (const file of e.dataTransfer.files) {
        try {
          const path = this.fs.normalize(file.name, "C:\\DOCUMENTS");
          if (
            this.fs.exists(path) &&
            !(await this.confirm(`Replace ${file.name}?`, "Import Files"))
          )
            continue;
          const content = /^(image|audio|video)\//.test(file.type)
            ? await this.fileAsDataURL(file)
            : await file.text();
          this.fs.writeFile(path, content);
          this.openFile(path);
        } catch (error) {
          await this.message(error.message, "Import Files");
        }
      }
    });
  }
  bindScreensaver() {
    this.lastActivity = Date.now();
    const activity = () => {
      this.lastActivity = Date.now();
      if (this.saver) {
        this.saverDispose?.();
        this.saverDispose = null;
        this.saver.remove();
        this.saver = null;
      }
    };
    ["pointerdown", "pointermove", "keydown"].forEach((type) =>
      document.addEventListener(type, activity, { passive: true }),
    );
    this.saverTimer = setInterval(() => {
      if (
        this.settings.screenSaver !== "none" &&
        Date.now() - this.lastActivity >
          Math.max(1, this.settings.screenSaverMinutes || 5) * 60000
      )
        this.startScreensaver();
    }, 15000);
  }
  startScreensaver() {
    if (this.saver) return;
    this.saver = el("div", {
      class: "screensaver",
      "aria-label": "Screen saver",
    });
    this.desktop.append(this.saver);
    this.saverDispose = startScreenSaver(this.saver, {
      kind: ["blank", "stars", "mystify"].includes(this.settings.screenSaver)
        ? this.settings.screenSaver
        : "mystify",
    });
  }
  addCleanup(fn) {
    this.cleanups.push(fn);
  }
  async shutdown() {
    if (
      !(await this.confirm(
        "This will end your Windows session.",
        "Exit Windows",
      ))
    )
      return false;
    for (const win of [...this.wm.windows]
      .reverse()
      .filter((w) => !w.isGroup && w.appId !== "programmanager")) {
      if (!(await win.close())) return false;
    }
    await this.fs.flush?.();
    this.wm.saveLayout();
    const screen = el(
      "div",
      { class: "shutdown" },
      "Microsoft(R) MS-DOS(R)\n\nC:\\> ",
      button(
        "win",
        () => {
          screen.remove();
          this.open("programmanager");
        },
        { class: "" },
      ),
      "\n\nClick win or press Enter to return to Windows.",
    );
    this.desktop.append(screen);
    screen.tabIndex = 0;
    screen.focus();
    screen.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        screen.remove();
        this.open("programmanager");
      }
    });
    return true;
  }
  registerWebMCP() {
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    this.addCleanup(() => controller.abort());
    const register = (tool) => {
      try {
        Promise.resolve(
          context.registerTool(tool, { signal: controller.signal }),
        ).catch((e) => this.reportError(e));
      } catch (e) {
        this.reportError(e);
      }
    };
    register({
      name: "list_windows31_apps",
      title: "List Windows applications",
      description:
        "List registered Windows desktop applications and currently open windows.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute: () => ({
        apps: [...this.apps.values()].map((a) => ({
          id: a.id,
          title: a.title,
        })),
        windows: this.wm.windows
          .filter((w) => !w.isGroup)
          .map((w) => ({
            id: w.id,
            appId: w.appId,
            title: w.title,
            minimized: w.state.minimized,
          })),
        graphics: this.renderer.backend,
      }),
    });
    register({
      name: "open_windows31_app",
      title: "Open a Windows application",
      description:
        "Open a registered application in the visible Windows desktop. This opens a window; it does not create or save a document.",
      inputSchema: {
        type: "object",
        properties: { appId: { type: "string" } },
        required: ["appId"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: (input) => {
        if (
          !input ||
          typeof input.appId !== "string" ||
          !this.apps.has(input.appId)
        )
          throw new Error("Unknown application id");
        const w = this.open(input.appId);
        return { windowId: w.id, appId: w.appId, title: w.title };
      },
    });
    register({
      name: "list_windows31_files",
      title: "List virtual drive files",
      description:
        "Read a directory from the device-local Windows virtual drive.",
      inputSchema: {
        type: "object",
        properties: { path: { type: "string" } },
        required: ["path"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: (input) => {
        if (!input || typeof input.path !== "string")
          throw new Error("A directory path is required");
        return {
          path: this.fs.normalize(input.path),
          entries: this.fs.readdir(input.path),
        };
      },
    });
  }
}
