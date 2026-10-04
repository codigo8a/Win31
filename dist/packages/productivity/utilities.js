import { el, button } from "../core/dom.js";
import { escapeHTML, helpMenu, listen, scopedKeys } from "./common.js";

export function registerCharacterMap(os) {
  os.registerApp({
    id: "charmap",
    title: "Character Map",
    icon: "charmap",
    width: 590,
    height: 420,
    minWidth: 380,
    minHeight: 315,
    singleton: true,
    create(ctx) {
      ctx.content.classList.add("charmap-app");
      const prefs = os.storage.get("charmap-prefs", {
        font: "Arial",
        set: "latin",
      });
      let current = 65,
        codes = [];
      const font = el(
        "select",
        { class: "win-select charmap-font", "aria-label": "Font" },
        [
          "Arial",
          "Times New Roman",
          "Courier New",
          "Georgia",
          "Verdana",
          "Tahoma",
          "Symbol",
          "Wingdings",
        ].map((value) =>
          el("option", { value, selected: prefs.font === value }, value),
        ),
      );
      const set = el(
        "select",
        { class: "win-select charmap-set", "aria-label": "Character set" },
        [
          ["latin", "Windows: Western"],
          ["greek", "Greek"],
          ["cyrillic", "Cyrillic"],
          ["symbols", "Symbols and math"],
          ["box", "Box drawing"],
        ].map(([value, label]) =>
          el("option", { value, selected: prefs.set === value }, label),
        ),
      );
      const grid = el("div", {
        class: "charmap-grid sunken",
        role: "grid",
        tabindex: 0,
        "aria-label": "Character grid",
      });
      const preview = el("div", { class: "charmap-preview sunken" }, "A");
      const description = el("div", { class: "charmap-description" });
      const collected = el("input", {
        class: "win-input charmap-collected",
        "aria-label": "Characters to copy",
      });
      const status = el("div", { class: "statusbar charmap-status" });
      ctx.content.append(
        el(
          "div",
          { class: "charmap-font-row" },
          el("label", {}, "Font:", font),
          set,
        ),
        el(
          "div",
          { class: "charmap-main" },
          grid,
          el(
            "div",
            { class: "charmap-side" },
            preview,
            description,
            button("Select", selectCharacter),
            button("Copy", copyCharacters),
            button("Clear", () => {
              collected.value = "";
            }),
          ),
        ),
        el(
          "label",
          { class: "charmap-copy-row" },
          "Characters to copy:",
          collected,
        ),
        status,
      );
      function selectCharacter() {
        const char = String.fromCodePoint(current);
        const start = collected.selectionStart ?? collected.value.length,
          end = collected.selectionEnd ?? collected.value.length;
        collected.setRangeText(char, start, end, "end");
        collected.focus();
      }
      async function copyCharacters() {
        if (!collected.value) selectCharacter();
        await os.copyText(collected.value);
        status.textContent = `${collected.value.length} character(s) copied to the Clipboard.`;
      }
      function choose(code, focus = false) {
        current = code;
        preview.textContent = String.fromCodePoint(code);
        preview.style.fontFamily = font.value;
        const hex = code.toString(16).toUpperCase().padStart(4, "0");
        description.textContent = `Unicode\nU+${hex}\nDecimal ${code}`;
        status.textContent = `U+${hex}     ${code <= 255 ? `Keystroke: Alt+${String(code).padStart(4, "0")}` : "Unicode character"}`;
        grid.querySelectorAll("button").forEach((control) => {
          const selected = Number(control.dataset.code) === code;
          control.classList.toggle("is-selected", selected);
          control.setAttribute("aria-selected", String(selected));
          control.tabIndex = selected ? 0 : -1;
          if (selected && focus) control.focus();
        });
      }
      function render() {
        prefs.font = font.value;
        prefs.set = set.value;
        os.storage.set("charmap-prefs", prefs);
        const range = {
          latin: [32, 255],
          greek: [0x370, 0x3ff],
          cyrillic: [0x400, 0x4ff],
          symbols: [0x2190, 0x22ff],
          box: [0x2500, 0x259f],
        }[set.value] || [32, 255];
        codes = [];
        for (let code = range[0]; code <= range[1]; code++)
          if (code < 127 || code > 159) codes.push(code);
        if (!codes.includes(current)) current = codes[0];
        grid.replaceChildren();
        grid.style.fontFamily = font.value;
        collected.style.fontFamily = font.value;
        codes.forEach((code) =>
          grid.append(
            el(
              "button",
              {
                class: "charmap-cell",
                type: "button",
                "data-code": code,
                role: "gridcell",
                title: `U+${code.toString(16).toUpperCase().padStart(4, "0")}`,
                "aria-label": `Character U+${code.toString(16).toUpperCase()}`,
                onClick: () => choose(code),
                onDblclick: () => {
                  choose(code);
                  selectCharacter();
                },
              },
              String.fromCodePoint(code),
            ),
          ),
        );
        choose(current);
      }
      font.addEventListener("change", render);
      set.addEventListener("change", render);
      listen(ctx, grid, "keydown", (event) => {
        const columns =
            getComputedStyle(grid).gridTemplateColumns.split(" ").length,
          index = codes.indexOf(current);
        const delta = {
          ArrowLeft: -1,
          ArrowRight: 1,
          ArrowUp: -columns,
          ArrowDown: columns,
          Home: -index,
          End: codes.length - 1 - index,
        }[event.key];
        if (delta !== undefined) {
          event.preventDefault();
          choose(
            codes[Math.max(0, Math.min(codes.length - 1, index + delta))],
            true,
          );
        } else if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          selectCharacter();
        }
      });
      ctx.setMenu([
        {
          label: "&File",
          items: [{ label: "E&xit", action: () => ctx.win.close() }],
        },
        {
          label: "&Edit",
          items: [
            { label: "&Select Character", action: selectCharacter },
            { label: "&Copy", shortcut: "Ctrl+C", action: copyCharacters },
            {
              label: "&Clear",
              action: () => {
                collected.value = "";
              },
            },
            {
              label: "Select &All",
              action: () => {
                collected.focus();
                collected.select();
              },
            },
          ],
        },
        helpMenu(
          ctx,
          "Character Map",
          "Select a font and character, then choose Select and Copy. Double-click a character to add it. Available glyphs depend on the fonts installed in your browser; legacy Symbol/Wingdings fonts may use a fallback.",
        ),
      ]);
      scopedKeys(ctx, { "ctrl+c": copyCharacters });
      render();
    },
  });
}

export function registerClipboard(os) {
  os.registerApp({
    id: "clipboard",
    title: "Clipboard Viewer",
    icon: "clipboard",
    width: 545,
    height: 370,
    minWidth: 300,
    minHeight: 205,
    singleton: true,
    create(ctx) {
      ctx.content.classList.add("clip-app");
      let mode = "auto",
        lastSnapshot = "",
        wordWrap = true;
      const text = el("textarea", {
        class: "clip-text",
        readonly: true,
        "aria-label": "Clipboard contents",
        wrap: "soft",
      });
      const files = el("div", { class: "clip-files listbox" });
      const empty = el(
        "div",
        { class: "clip-empty" },
        "The Clipboard is empty.",
      );
      const status = el("div", { class: "statusbar clip-status" });
      ctx.content.append(
        el(
          "div",
          { class: "toolbar clip-toolbar" },
          button("Paste from Clipboard", paste),
          button("Copy All", () => copy(true)),
          button("Clear", clearClipboard),
        ),
        el("div", { class: "clip-view sunken" }, text, files, empty),
        status,
      );
      function snapshot() {
        return JSON.stringify({
          text: os.clipboard.text || "",
          files: os.clipboard.files || [],
        });
      }
      function refresh(force = false) {
        const value = snapshot();
        if (!force && value === lastSnapshot) return;
        lastSnapshot = value;
        const clipboardText = os.clipboard.text || "",
          fileList = os.clipboard.files || [];
        const showFiles =
          mode === "files" ||
          (mode === "auto" && !clipboardText && fileList.length);
        text.value = clipboardText;
        text.hidden = showFiles || !clipboardText;
        files.hidden = !showFiles || !fileList.length;
        empty.hidden = !!(showFiles ? fileList.length : clipboardText);
        empty.textContent =
          mode === "files" && !fileList.length
            ? "No files on the Clipboard."
            : "The Clipboard is empty.";
        files.replaceChildren();
        fileList.forEach((item) => {
          const path = typeof item === "string" ? item : item.path || item.name;
          files.append(
            el(
              "button",
              {
                class: "clip-file",
                type: "button",
                title: "Open file",
                onDblclick: () => {
                  try {
                    os.openFile(path);
                  } catch (error) {
                    os.message(error.message, "Clipboard Viewer");
                  }
                },
              },
              String(path || item),
            ),
          );
        });
        status.textContent = `${clipboardText.length} text characters     ${fileList.length} file${fileList.length === 1 ? "" : "s"}${os.clipboard.cut ? " (cut)" : ""}`;
      }
      async function paste() {
        try {
          const value = await os.pasteText();
          if (value != null) {
            os.clipboard.text = value;
            mode = "text";
            refresh(true);
            menu();
          }
        } catch (error) {
          os.message(error.message, "Clipboard Viewer");
        }
      }
      async function copy(all = false) {
        const value = !files.hidden
          ? (os.clipboard.files || [])
              .map((file) =>
                typeof file === "string" ? file : file.path || file.name || "",
              )
              .join("\n")
          : all !== true && text.selectionStart !== text.selectionEnd
            ? text.value.slice(text.selectionStart, text.selectionEnd)
            : text.value;
        if (value) await os.copyText(value);
      }
      async function clearClipboard() {
        os.clipboard.text = "";
        os.clipboard.files = [];
        os.clipboard.cut = false;
        await os.copyText("");
        refresh(true);
      }
      async function open() {
        const path = await os.pickFile({
          title: "Open Clipboard File",
          filter: "*.CLP",
        });
        if (!path) return;
        try {
          const content = os.fs.readFile(path);
          let value;
          try {
            value = JSON.parse(content);
          } catch {
            value = { text: content, files: [] };
          }
          if (!value || typeof value !== "object")
            throw new Error("Invalid Clipboard file.");
          os.clipboard.text = String(value.text || "");
          os.clipboard.files = Array.isArray(value.files)
            ? value.files.filter(
                (file) =>
                  typeof file === "string" ||
                  (file && typeof file.path === "string"),
              )
            : [];
          os.clipboard.cut = false;
          mode = "auto";
          refresh(true);
          menu();
        } catch (error) {
          os.message(error.message, "Clipboard Viewer");
        }
      }
      async function save() {
        let path = await os.pickFile({
          title: "Save Clipboard File",
          save: true,
          filename: "C:\\DOCUMENTS\\CLIPBOARD.CLP",
          filter: "*.CLP",
        });
        if (!path) return;
        if (!/\.[^\\/.]+$/.test(path)) path += ".CLP";
        try {
          os.fs.writeFile(
            path,
            JSON.stringify(
              {
                version: 1,
                text: os.clipboard.text || "",
                files: os.clipboard.files || [],
              },
              null,
              2,
            ),
          );
        } catch (error) {
          os.message(error.message, "Clipboard Viewer");
        }
      }
      function print() {
        os.print(
          "Clipboard",
          `<pre style="white-space:pre-wrap">${escapeHTML(os.clipboard.text || (os.clipboard.files || []).map((file) => (typeof file === "string" ? file : file.path)).join("\n"))}</pre>`,
        );
      }
      function menu() {
        ctx.setMenu([
          {
            label: "&File",
            items: [
              { label: "&Open...", shortcut: "Ctrl+O", action: open },
              { label: "Save &As...", shortcut: "Ctrl+S", action: save },
              { label: "&Print...", shortcut: "Ctrl+P", action: print },
              { separator: true },
              { label: "E&xit", action: () => ctx.win.close() },
            ],
          },
          {
            label: "&Edit",
            items: [
              { label: "&Copy", shortcut: "Ctrl+C", action: copy },
              {
                label: "&Paste from Clipboard",
                shortcut: "Ctrl+V",
                action: paste,
              },
              { label: "&Delete", action: clearClipboard },
              {
                label: "Select &All",
                shortcut: "Ctrl+A",
                action: () => {
                  text.focus();
                  text.select();
                },
              },
            ],
          },
          {
            label: "&Display",
            items: [
              {
                label: "&Automatic",
                checked: mode === "auto",
                action: () => {
                  mode = "auto";
                  refresh(true);
                  menu();
                },
              },
              {
                label: "&Text",
                checked: mode === "text",
                action: () => {
                  mode = "text";
                  refresh(true);
                  menu();
                },
              },
              {
                label: "&Files",
                checked: mode === "files",
                action: () => {
                  mode = "files";
                  refresh(true);
                  menu();
                },
              },
              { separator: true },
              {
                label: "&Word Wrap",
                checked: wordWrap,
                action: () => {
                  wordWrap = !wordWrap;
                  text.wrap = wordWrap ? "soft" : "off";
                  menu();
                },
              },
              {
                label: "&Refresh",
                shortcut: "F5",
                action: () => refresh(true),
              },
            ],
          },
          helpMenu(
            ctx,
            "Clipboard Viewer",
            "View text and virtual file selections shared by desktop applications. Use Paste from Clipboard to read the browser clipboard with permission. Portable .CLP files contain JSON; native Windows bitmap and binary clipboard formats are not supported.",
          ),
        ]);
      }
      scopedKeys(ctx, {
        "ctrl+o": open,
        "ctrl+s": save,
        "ctrl+p": print,
        "ctrl+c": copy,
        "ctrl+v": paste,
        f5: () => refresh(true),
      });
      const timer = setInterval(() => refresh(), 400);
      ctx.cleanup(() => clearInterval(timer));
      listen(ctx, os.events, "clipboardchange", () => refresh(true));
      refresh(true);
      menu();
    },
  });
}
