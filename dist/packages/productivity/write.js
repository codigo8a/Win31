import { el, button } from "../core/dom.js";
import {
  escapeHTML,
  fileController,
  editMenu,
  findDialog,
  helpMenu,
  fontDialog,
  listen,
  scopedKeys,
} from "./common.js";

const WRITE_MARKER = "<!-- WINDOWS31-WRITE -->";
const ALLOWED_TAGS = new Set([
  "P",
  "DIV",
  "SPAN",
  "BR",
  "B",
  "STRONG",
  "I",
  "EM",
  "U",
  "S",
  "STRIKE",
  "SUB",
  "SUP",
  "H1",
  "H2",
  "H3",
  "H4",
  "BLOCKQUOTE",
  "UL",
  "OL",
  "LI",
  "HR",
  "PRE",
  "FONT",
]);
const STYLE_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "text-decoration",
  "text-align",
  "color",
  "background-color",
  "margin-left",
  "margin-right",
  "margin-top",
  "margin-bottom",
  "text-indent",
  "line-height",
  "break-after",
  "page-break-after",
  "white-space",
];
function sanitizedFragment(html) {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  function clean(source) {
    if (source.nodeType === Node.TEXT_NODE)
      return document.createTextNode(source.data);
    if (source.nodeType !== Node.ELEMENT_NODE)
      return document.createDocumentFragment();
    if (
      [
        "SCRIPT",
        "STYLE",
        "IFRAME",
        "OBJECT",
        "EMBED",
        "SVG",
        "MATH",
        "FORM",
        "INPUT",
        "META",
        "LINK",
      ].includes(source.tagName)
    )
      return document.createDocumentFragment();
    const result = ALLOWED_TAGS.has(source.tagName)
      ? document.createElement(source.tagName.toLowerCase())
      : document.createDocumentFragment();
    if (result.nodeType === Node.ELEMENT_NODE) {
      STYLE_PROPERTIES.forEach((property) => {
        const value = source.style.getPropertyValue(property);
        if (
          value &&
          !/url\s*\(|expression\s*\(|@import|javascript:/i.test(value)
        )
          result.style.setProperty(property, value);
      });
      if (source.tagName === "FONT")
        ["face", "size", "color"].forEach((attribute) => {
          const value = source.getAttribute(attribute);
          if (value && /^[\w\s,#.\-]+$/.test(value))
            result.setAttribute(attribute, value);
        });
    }
    source.childNodes.forEach((child) => result.append(clean(child)));
    return result;
  }
  const fragment = document.createDocumentFragment();
  const root = parsed.querySelector("[data-write-document]") || parsed.body;
  root.childNodes.forEach((child) => fragment.append(clean(child)));
  return fragment;
}

export function registerWrite(os) {
  os.registerApp({
    id: "write",
    title: "Write",
    icon: "write",
    width: 685,
    height: 505,
    minWidth: 350,
    minHeight: 235,
    create(ctx, args = {}) {
      ctx.content.classList.add("write-app");
      const toolbar = el("div", { class: "toolbar write-toolbar" });
      const ruler = el(
        "div",
        { class: "write-ruler sunken", "aria-hidden": true },
        Array.from({ length: 9 }, (_, i) => el("span", {}, i ? String(i) : "")),
      );
      const editor = el("div", {
        class: "write-document",
        contenteditable: "true",
        role: "textbox",
        "aria-multiline": true,
        "aria-label": "Write document",
        spellcheck: false,
      });
      const paper = el("div", { class: "write-paper" }, editor);
      const viewport = el("div", { class: "write-viewport sunken" }, paper);
      const status = el("div", { class: "statusbar write-status" });
      ctx.content.append(toolbar, ruler, viewport, status);
      let savedRange = null,
        pageView = true,
        font = { family: "Times New Roman", size: 16 },
        page = { margin: 20, orientation: "portrait" };
      const doc = fileController(ctx, {
        name: "Write",
        extension: "WRI",
        getValue: () =>
          `${WRITE_MARKER}\n<!doctype html><html><head><meta charset="utf-8"><title>Write Document</title></head><body><div data-write-document="1">${editor.innerHTML}</div></body></html>`,
        setValue(value) {
          editor.replaceChildren();
          const source = String(value);
          if (
            source.startsWith(WRITE_MARKER) ||
            /data-write-document\s*=/.test(source.slice(0, 2000))
          )
            editor.append(sanitizedFragment(source));
          else
            source
              .replace(/\r\n/g, "\n")
              .split("\n")
              .forEach((line) =>
                editor.append(el("div", {}, line || el("br"))),
              );
          if (!editor.childNodes.length) editor.append(el("p", {}, el("br")));
          savedRange = null;
          updateStatus();
          editor.focus();
        },
      });
      function rememberRange() {
        const selection = window.getSelection();
        if (
          selection?.rangeCount &&
          editor.contains(selection.anchorNode) &&
          editor.contains(selection.focusNode)
        )
          savedRange = selection.getRangeAt(0).cloneRange();
      }
      function restoreRange() {
        editor.focus();
        const selection = window.getSelection();
        if (savedRange && editor.contains(savedRange.commonAncestorContainer)) {
          selection.removeAllRanges();
          selection.addRange(savedRange);
        }
      }
      function command(name, value = null) {
        restoreRange();
        document.execCommand(name, false, value);
        rememberRange();
        doc.markDirty();
        updateStatus();
        refreshFormatting();
      }
      function updateStatus() {
        const text = editor.innerText || "";
        status.textContent = `${text.trim() ? text.trim().split(/\s+/).length : 0} words     ${text.length} characters`;
      }
      function applyFontStyle(value) {
        font = value;
        restoreRange();
        document.execCommand("fontName", false, value.family);
        document.execCommand("fontSize", false, "7");
        editor.querySelectorAll('font[size="7"]').forEach((node) => {
          node.removeAttribute("size");
          node.style.fontSize = `${value.size}px`;
        });
        ["bold", "italic"].forEach((name) => {
          if (document.queryCommandState(name) !== !!value[name])
            document.execCommand(name);
        });
        rememberRange();
        doc.markDirty();
        refreshFormatting();
      }
      const fontSelect = el(
        "select",
        {
          class: "win-select write-font-select",
          title: "Font",
          "aria-label": "Font",
        },
        ["Times New Roman", "Arial", "Courier New", "Georgia", "Verdana"].map(
          (name) => el("option", { value: name }, name),
        ),
      );
      const sizeSelect = el(
        "select",
        {
          class: "win-select write-size-select",
          title: "Font size",
          "aria-label": "Font size",
        },
        [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48].map((size) =>
          el("option", { value: size, selected: size === 16 }, String(size)),
        ),
      );
      const formatButtons = {};
      function tool(label, title, action, className = "") {
        const control = button(label, action, {
          class: `win-button write-tool ${className}`,
          title,
          "aria-label": title,
        });
        control.addEventListener("mousedown", (event) => {
          event.preventDefault();
          rememberRange();
        });
        return control;
      }
      function formatTool(label, name, title, className = "") {
        const control = tool(label, title, () => command(name), className);
        formatButtons[name] = control;
        return control;
      }
      toolbar.append(
        fontSelect,
        sizeSelect,
        formatTool("B", "bold", "Bold", "write-bold"),
        formatTool("I", "italic", "Italic", "write-italic"),
        formatTool("U", "underline", "Underline", "write-underline"),
        el("span", { class: "write-tool-divider" }),
        formatTool("≡", "justifyLeft", "Align left", "write-align-left"),
        formatTool("≡", "justifyCenter", "Center", "write-align-center"),
        formatTool("≡", "justifyRight", "Align right", "write-align-right"),
        tool("• List", "Bulleted list", () => command("insertUnorderedList")),
      );
      fontSelect.addEventListener("change", () => {
        font.family = fontSelect.value;
        command("fontName", font.family);
      });
      sizeSelect.addEventListener("change", () => {
        font.size = Number(sizeSelect.value);
        restoreRange();
        document.execCommand("fontSize", false, "7");
        editor.querySelectorAll('font[size="7"]').forEach((node) => {
          node.removeAttribute("size");
          node.style.fontSize = `${font.size}px`;
        });
        rememberRange();
        doc.markDirty();
      });
      function refreshFormatting() {
        for (const [name, control] of Object.entries(formatButtons)) {
          const active = document.queryCommandState(name);
          control.classList.toggle("is-pressed", active);
          control.setAttribute("aria-pressed", String(active));
        }
      }
      const editing = {
        undo: () => command("undo"),
        redo: () => command("redo"),
        async copy() {
          restoreRange();
          await os.copyText(window.getSelection()?.toString() || "");
        },
        async cut() {
          restoreRange();
          const selected = window.getSelection()?.toString() || "";
          if (selected) {
            await os.copyText(selected);
            command("delete");
          }
        },
        async paste() {
          const value = await os.pasteText();
          if (value != null) command("insertText", value);
        },
        delete: () => command("delete"),
        selectAll() {
          editor.focus();
          const range = document.createRange();
          range.selectNodeContents(editor);
          const selection = window.getSelection();
          selection.removeAllRanges();
          selection.addRange(range);
          rememberRange();
        },
        selected() {
          restoreRange();
          return window.getSelection()?.toString() || "";
        },
        insert: (value) => command("insertText", value),
      };
      function getTextNodes() {
        const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
        const nodes = [];
        let node,
          offset = 0;
        while ((node = walker.nextNode())) {
          nodes.push({ node, start: offset, end: offset + node.length });
          offset += node.length;
        }
        return nodes;
      }
      function setTextRange(start, end) {
        const nodes = getTextNodes();
        const first = nodes.find((item) => item.end >= start),
          last = nodes.find((item) => item.end >= end);
        if (!first || !last) return false;
        const range = document.createRange();
        range.setStart(first.node, Math.max(0, start - first.start));
        range.setEnd(last.node, Math.max(0, end - last.start));
        editor.focus();
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        savedRange = range.cloneRange();
        first.node.parentElement?.scrollIntoView({ block: "nearest" });
        return true;
      }
      let lastMatch = null;
      editing.find = (query, options = {}) => {
        const text = editor.textContent,
          source = options.matchCase ? text : text.toLowerCase(),
          needle = options.matchCase ? query : query.toLowerCase();
        let start =
          lastMatch?.query === needle
            ? options.backwards
              ? lastMatch.start - 1
              : lastMatch.end
            : options.backwards
              ? source.length
              : 0;
        let index = options.backwards
          ? source.lastIndexOf(needle, start)
          : source.indexOf(needle, start);
        if (index < 0)
          index = options.backwards
            ? source.lastIndexOf(needle)
            : source.indexOf(needle);
        if (index < 0 || !needle) return false;
        lastMatch = { query: needle, start: index, end: index + query.length };
        return setTextRange(index, index + query.length);
      };
      editing.replaceAll = (query, replacement, matchCase) => {
        const text = editor.textContent,
          source = matchCase ? text : text.toLowerCase(),
          needle = matchCase ? query : query.toLowerCase();
        const matches = [];
        let at = 0;
        while (needle && (at = source.indexOf(needle, at)) >= 0) {
          matches.push(at);
          at += needle.length;
        }
        matches.reverse().forEach((start) => {
          setTextRange(start, start + query.length);
          command("insertText", replacement);
        });
        lastMatch = null;
        return matches.length;
      };
      const search = { query: "", replacement: "", matchCase: false };
      function next() {
        if (!search.query) findDialog(ctx, editing, search);
        else if (!editing.find(search.query, search))
          os.message(`Cannot find "${search.query}".`, "Write");
      }
      function print() {
        os.print(
          doc.path ? os.fs.basename(doc.path) : "Untitled - Write",
          `<style>@page{size:${page.orientation};margin:${page.margin}mm}body{font-family:Georgia,serif}</style>${editor.innerHTML}`,
        );
      }
      async function paragraph() {
        const align = el(
          "select",
          { class: "win-select" },
          ["Left", "Center", "Right", "Justified"].map((value) =>
            el("option", { value }, value),
          ),
        );
        const indent = el("input", {
          class: "win-input",
          type: "number",
          value: 0,
          min: 0,
          max: 300,
        });
        const spacing = el(
          "select",
          { class: "win-select" },
          [
            { value: "1", text: "Single" },
            { value: "1.5", text: "1½ lines" },
            { value: "2", text: "Double" },
          ].map((item) => el("option", { value: item.value }, item.text)),
        );
        const answer = await os.dialog({
          title: "Paragraph",
          width: 365,
          body: el(
            "div",
            {},
            el("label", { class: "prod-form-row" }, "Alignment:", align),
            el(
              "label",
              { class: "prod-form-row" },
              "Left indent (px):",
              indent,
            ),
            el("label", { class: "prod-form-row" }, "Line spacing:", spacing),
          ),
          buttons: [
            { label: "OK", value: "ok" },
            { label: "Cancel", value: "cancel" },
          ],
        });
        if (answer !== "ok") return;
        command(
          {
            Left: "justifyLeft",
            Center: "justifyCenter",
            Right: "justifyRight",
            Justified: "justifyFull",
          }[align.value],
        );
        const range = savedRange;
        const blocks = [
          ...editor.querySelectorAll("p,div,h1,h2,h3,li,blockquote"),
        ].filter((node) => range?.intersectsNode(node));
        if (!blocks.length) blocks.push(editor);
        blocks.forEach((node) => {
          node.style.marginLeft = `${Math.max(0, Math.min(300, Number(indent.value) || 0))}px`;
          node.style.lineHeight = spacing.value;
        });
        doc.markDirty();
      }
      async function pageSetup() {
        const margin = el("input", {
          class: "win-input",
          type: "number",
          min: 0,
          max: 75,
          value: page.margin,
        });
        const orientation = el(
          "select",
          { class: "win-select" },
          ["portrait", "landscape"].map((value) =>
            el(
              "option",
              { value, selected: page.orientation === value },
              value[0].toUpperCase() + value.slice(1),
            ),
          ),
        );
        if (
          (await os.dialog({
            title: "Page Setup",
            body: el(
              "div",
              {},
              el("label", { class: "prod-form-row" }, "Margins (mm):", margin),
              el(
                "label",
                { class: "prod-form-row" },
                "Orientation:",
                orientation,
              ),
            ),
            width: 350,
            buttons: [
              { label: "OK", value: "ok" },
              { label: "Cancel", value: "cancel" },
            ],
          })) === "ok"
        ) {
          page.margin = Math.max(0, Math.min(75, Number(margin.value) || 0));
          page.orientation = orientation.value;
          paper.style.padding = `${page.margin * 1.5}px`;
        }
      }
      function menu() {
        ctx.setMenu([
          doc.menu([
            { separator: true },
            { label: "Page Set&up...", action: pageSetup },
            { label: "&Print...", shortcut: "Ctrl+P", action: print },
          ]),
          editMenu(editing),
          {
            label: "&Search",
            items: [
              {
                label: "&Find...",
                shortcut: "Ctrl+F",
                action: () => findDialog(ctx, editing, search),
              },
              { label: "Find &Next", shortcut: "F3", action: next },
              {
                label: "&Replace...",
                shortcut: "Ctrl+H",
                action: () => findDialog(ctx, editing, search, true),
              },
            ],
          },
          {
            label: "F&ormat",
            items: [
              {
                label: "&Font...",
                action: async () => {
                  const value = await fontDialog(ctx, font);
                  if (value) applyFontStyle(value);
                },
              },
              {
                label: "&Bold",
                shortcut: "Ctrl+B",
                action: () => command("bold"),
              },
              {
                label: "&Italic",
                shortcut: "Ctrl+I",
                action: () => command("italic"),
              },
              {
                label: "&Underline",
                shortcut: "Ctrl+U",
                action: () => command("underline"),
              },
              { separator: true },
              { label: "&Paragraph...", action: paragraph },
              { label: "Increase &Indent", action: () => command("indent") },
              { label: "&Decrease Indent", action: () => command("outdent") },
              {
                label: "Bulleted &List",
                action: () => command("insertUnorderedList"),
              },
              {
                label: "&Numbered List",
                action: () => command("insertOrderedList"),
              },
            ],
          },
          {
            label: "&Insert",
            items: [
              {
                label: "&Date and Time",
                action: () =>
                  command("insertText", new Date().toLocaleString()),
              },
              {
                label: "&Page Break",
                action: () =>
                  command(
                    "insertHTML",
                    '<div style="break-after:page;page-break-after:always"><br></div><p><br></p>',
                  ),
              },
              {
                label: "&Text File...",
                action: async () => {
                  const path = await os.pickFile({
                    title: "Insert Text File",
                    filter: "*.TXT",
                  });
                  if (path) {
                    try {
                      command("insertText", os.fs.readFile(path));
                    } catch (error) {
                      os.message(error.message, "Write");
                    }
                  }
                },
              },
            ],
          },
          {
            label: "&View",
            items: [
              {
                label: "&Ruler",
                checked: !ruler.hidden,
                action: () => {
                  ruler.hidden = !ruler.hidden;
                  menu();
                },
              },
              {
                label: "&Toolbar",
                checked: !toolbar.hidden,
                action: () => {
                  toolbar.hidden = !toolbar.hidden;
                  menu();
                },
              },
              {
                label: "&Page Layout",
                checked: pageView,
                action: () => {
                  pageView = !pageView;
                  viewport.classList.toggle("write-normal", !pageView);
                  menu();
                },
              },
              {
                label: "&Zoom...",
                action: async () => {
                  const value = await os.prompt(
                    "Zoom",
                    "Magnification (50–200%):",
                    String(parseFloat(paper.style.zoom || 1) * 100),
                  );
                  if (value !== null) {
                    const zoom = Number(value);
                    if (Number.isFinite(zoom) && zoom >= 50 && zoom <= 200)
                      paper.style.zoom = String(zoom / 100);
                    else os.message("Enter a number from 50 to 200.", "Write");
                  }
                },
              },
            ],
          },
          helpMenu(
            ctx,
            "Write",
            "Write supports formatted text, font and paragraph controls, search/replace, virtual .WRI files and printing. Its .WRI files contain portable HTML; native Windows binary .WRI files are not supported.",
          ),
        ]);
      }
      listen(ctx, document, "selectionchange", () => {
        const selection = window.getSelection();
        if (selection?.anchorNode && editor.contains(selection.anchorNode)) {
          rememberRange();
          refreshFormatting();
        }
      });
      listen(ctx, editor, "input", () => {
        editor.querySelectorAll('font[size="7"]').forEach((node) => {
          node.removeAttribute("size");
          node.style.fontSize = `${font.size}px`;
        });
        doc.markDirty();
        lastMatch = null;
        updateStatus();
      });
      listen(ctx, editor, "paste", (event) => {
        const html = event.clipboardData?.getData("text/html");
        if (html) {
          event.preventDefault();
          const holder = document.createElement("div");
          holder.append(sanitizedFragment(html));
          command("insertHTML", holder.innerHTML);
        }
      });
      listen(ctx, editor, "keydown", (event) => {
        if (event.key === "Tab") {
          event.preventDefault();
          command("insertText", "\t");
        }
      });
      scopedKeys(ctx, {
        "ctrl+n": doc.newFile,
        "ctrl+o": doc.open,
        "ctrl+s": doc.save,
        "ctrl+shift+s": doc.saveAs,
        "ctrl+p": print,
        "ctrl+f": () => findDialog(ctx, editing, search),
        "ctrl+h": () => findDialog(ctx, editing, search, true),
        f3: next,
        "ctrl+b": () => command("bold"),
        "ctrl+i": () => command("italic"),
        "ctrl+u": () => command("underline"),
        "ctrl+c": editing.copy,
        "ctrl+x": editing.cut,
        "ctrl+v": editing.paste,
        "ctrl+a": editing.selectAll,
      });
      editor.append(el("p", {}, el("br")));
      menu();
      updateStatus();
      doc.initial(args);
      editor.focus();
    },
  });
}
