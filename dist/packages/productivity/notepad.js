import { el } from "../core/dom.js";
import {
  escapeHTML,
  fileController,
  textEditor,
  editMenu,
  findDialog,
  helpMenu,
  fontDialog,
  scopedKeys,
  listen,
} from "./common.js";

export function registerNotepad(os) {
  os.registerApp({
    id: "notepad",
    title: "Notepad",
    icon: "notepad",
    width: 595,
    height: 415,
    minWidth: 270,
    minHeight: 170,
    create(ctx, args = {}) {
      const prefs = os.storage.get("notepad-prefs", {
        wrap: false,
        font: { family: "Courier New", size: 14 },
      });
      const textarea = el("textarea", {
        class: "np-editor",
        spellcheck: false,
        "aria-label": "Notepad document",
        wrap: prefs.wrap ? "soft" : "off",
      });
      const status = el("div", { class: "statusbar np-status" });
      ctx.content.classList.add("np-app");
      ctx.content.append(textarea, status);
      let editor,
        page = { header: "&f", footer: "Page &p" };
      const doc = fileController(ctx, {
        name: "Notepad",
        extension: "TXT",
        getValue: () => textarea.value,
        setValue(value) {
          textarea.value = String(value).replace(/^\uFEFF/, "");
          if (textarea.value.startsWith(".LOG"))
            textarea.value += `\n${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ${new Date().toLocaleDateString()}\n`;
          editor?.reset();
          updateStatus();
          textarea.focus();
        },
      });
      editor = textEditor(ctx, textarea, () => {
        doc.markDirty();
        updateStatus();
      });
      const search = {
        query: "",
        replacement: "",
        matchCase: false,
        backwards: false,
      };
      editor.replaceAll = (query, replacement, matchCase) => {
        const pattern = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const regexp = new RegExp(pattern, matchCase ? "g" : "gi");
        let count = 0;
        const output = textarea.value.replace(regexp, () => {
          count++;
          return replacement;
        });
        if (count) {
          textarea.select();
          editor.insert(output);
        }
        return count;
      };
      function updateStatus() {
        const before = textarea.value.slice(0, textarea.selectionStart);
        const lines = before.split("\n");
        status.textContent = `Ln ${lines.length}, Col ${lines.at(-1).length + 1}     ${textarea.value.length} characters`;
      }
      function applyFont() {
        Object.assign(textarea.style, {
          fontFamily: prefs.font.family,
          fontSize: `${prefs.font.size}px`,
          fontWeight: prefs.font.bold ? "bold" : "normal",
          fontStyle: prefs.font.italic ? "italic" : "normal",
        });
      }
      function insertTime() {
        editor.insert(
          `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ${new Date().toLocaleDateString()}`,
        );
      }
      function findNext() {
        if (!search.query) return findDialog(ctx, editor, search);
        if (!editor.find(search.query, search))
          os.message(`Cannot find "${search.query}".`, "Notepad");
      }
      function print() {
        const title = doc.path ? os.fs.basename(doc.path) : "Untitled";
        const header = page.header
          .replaceAll("&f", title)
          .replaceAll("&d", new Date().toLocaleDateString())
          .replaceAll("&t", new Date().toLocaleTimeString())
          .replaceAll("&p", "1");
        os.print(
          title,
          `<header style="text-align:center">${escapeHTML(header)}</header><pre style="white-space:pre-wrap;font-family:${escapeHTML(prefs.font.family)};font-size:${prefs.font.size}px">${escapeHTML(textarea.value)}</pre><footer>${escapeHTML(page.footer.replaceAll("&p", "1").replaceAll("&f", title))}</footer>`,
        );
      }
      async function pageSetup() {
        const header = el("input", { class: "win-input", value: page.header }),
          footer = el("input", { class: "win-input", value: page.footer });
        const body = el(
          "div",
          {},
          el("label", { class: "prod-form-row" }, "Header:", header),
          el("label", { class: "prod-form-row" }, "Footer:", footer),
          el("p", {}, "&f = filename, &d = date, &t = time, &p = page"),
        );
        if (
          (await os.dialog({
            title: "Page Setup",
            body,
            width: 390,
            buttons: [
              { label: "OK", value: "ok" },
              { label: "Cancel", value: "cancel" },
            ],
          })) === "ok"
        )
          page = { header: header.value, footer: footer.value };
      }
      function menu() {
        ctx.setMenu([
          doc.menu([
            { separator: true },
            { label: "Page Set&up...", action: pageSetup },
            { label: "&Print...", shortcut: "Ctrl+P", action: print },
          ]),
          editMenu(editor, [
            { separator: true },
            { label: "Time/&Date", shortcut: "F5", action: insertTime },
            {
              label: "&Word Wrap",
              checked: prefs.wrap,
              action() {
                prefs.wrap = !prefs.wrap;
                textarea.wrap = prefs.wrap ? "soft" : "off";
                os.storage.set("notepad-prefs", prefs);
                menu();
              },
            },
          ]),
          {
            label: "&Search",
            items: [
              {
                label: "&Find...",
                shortcut: "Ctrl+F",
                action: () => findDialog(ctx, editor, search),
              },
              { label: "Find &Next", shortcut: "F3", action: findNext },
              {
                label: "&Replace...",
                shortcut: "Ctrl+H",
                action: () => findDialog(ctx, editor, search, true),
              },
              {
                label: "&Go To...",
                shortcut: "Ctrl+G",
                action: async () => {
                  const value = await os.prompt(
                    "Go To Line",
                    `Line number (1–${textarea.value.split("\n").length}):`,
                    "1",
                  );
                  if (value === null) return;
                  const number = Number(value),
                    lines = textarea.value.split("\n");
                  if (
                    !Number.isInteger(number) ||
                    number < 1 ||
                    number > lines.length
                  )
                    return os.message(
                      "The line number is outside the document.",
                      "Notepad",
                    );
                  const index = lines
                    .slice(0, number - 1)
                    .reduce((n, line) => n + line.length + 1, 0);
                  textarea.focus();
                  textarea.setSelectionRange(index, index);
                  textarea.scrollTop = Math.max(
                    0,
                    (number - 3) * prefs.font.size * 1.3,
                  );
                  updateStatus();
                },
              },
            ],
          },
          {
            label: "&Options",
            items: [
              {
                label: "&Font...",
                action: async () => {
                  const value = await fontDialog(ctx, prefs.font);
                  if (value) {
                    prefs.font = value;
                    applyFont();
                    os.storage.set("notepad-prefs", prefs);
                  }
                },
              },
              {
                label: "&Status Bar",
                checked: !status.hidden,
                action: () => {
                  status.hidden = !status.hidden;
                  menu();
                },
              },
            ],
          },
          helpMenu(
            ctx,
            "Notepad",
            "A plain text editor with virtual disk files, search, replace, time/date, word wrap, and printing. Text files round trip as Unicode text.",
          ),
        ]);
      }
      listen(ctx, textarea, "click", updateStatus);
      listen(ctx, textarea, "keyup", updateStatus);
      listen(ctx, textarea, "select", updateStatus);
      scopedKeys(ctx, {
        "ctrl+n": doc.newFile,
        "ctrl+o": doc.open,
        "ctrl+s": doc.save,
        "ctrl+shift+s": doc.saveAs,
        "ctrl+p": print,
        "ctrl+f": () => findDialog(ctx, editor, search),
        "ctrl+h": () => findDialog(ctx, editor, search, true),
        f3: findNext,
        f5: insertTime,
        "ctrl+z": editor.undo,
        "ctrl+y": editor.redo,
        "ctrl+c": editor.copy,
        "ctrl+x": editor.cut,
        "ctrl+v": editor.paste,
        "ctrl+a": editor.selectAll,
      });
      applyFont();
      updateStatus();
      menu();
      doc.initial(args);
      textarea.focus();
    },
  });
}
