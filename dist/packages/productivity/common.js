import { el, button } from "../core/dom.js";

export const escapeHTML = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const appPath = (args) =>
  typeof args === "string"
    ? args
    : args?.path || args?.file || args?.filename || null;
export const fileName = (os, path) =>
  path ? os.fs.basename(path) : "Untitled";
export function listen(ctx, target, type, callback) {
  target.addEventListener(type, callback);
  ctx.cleanup(() => target.removeEventListener(type, callback));
}
export function scopedKeys(ctx, bindings) {
  listen(ctx, ctx.win.element, "keydown", (event) => {
    if (event.defaultPrevented || event.altKey) return;
    const prefix =
      (event.ctrlKey || event.metaKey ? "ctrl+" : "") +
      (event.shiftKey ? "shift+" : "");
    const key = prefix + event.key.toLowerCase();
    const action = bindings[key];
    if (action) {
      event.preventDefault();
      event.stopPropagation();
      action(event);
    }
  });
}
export async function showError(os, error, title) {
  await os.message(error?.message || String(error), title);
}

export function fileController(ctx, options) {
  const { os } = ctx;
  let path = null,
    dirty = false;
  const name = options.name;
  const update = () =>
    ctx.setTitle(`${fileName(os, path)}${dirty ? " *" : ""} - ${name}`);
  async function saveAs() {
    let chosen = await os.pickFile({
      title: "Save As",
      save: true,
      filename: path || `C:\\DOCUMENTS\\UNTITLED.${options.extension}`,
      filter: `*.${options.extension}`,
    });
    if (!chosen) return false;
    if (!/\.[^\\/.]+$/.test(chosen)) chosen += `.${options.extension}`;
    try {
      os.fs.writeFile(chosen, options.getValue());
      path = chosen;
      dirty = false;
      update();
      options.onSaved?.(path);
      return true;
    } catch (error) {
      await showError(os, error, name);
      return false;
    }
  }
  async function save() {
    if (!path) return saveAs();
    try {
      os.fs.writeFile(path, options.getValue());
      dirty = false;
      update();
      options.onSaved?.(path);
      return true;
    } catch (error) {
      await showError(os, error, name);
      return false;
    }
  }
  async function confirmDirty() {
    if (!dirty) return true;
    const answer = await os.dialog({
      title: name,
      body: `Save changes to ${fileName(os, path)}?`,
      buttons: [
        { label: "&Yes", value: "save", default: true },
        { label: "&No", value: "discard" },
        { label: "Cancel", value: "cancel" },
      ],
      width: 355,
    });
    return answer === "save" ? save() : answer === "discard";
  }
  async function load(chosen) {
    if (!chosen) return false;
    try {
      await options.setValue(os.fs.readFile(chosen), chosen);
      path = chosen;
      dirty = false;
      update();
      return true;
    } catch (error) {
      await showError(os, error, name);
      return false;
    }
  }
  async function open() {
    if (!(await confirmDirty())) return;
    const chosen = await os.pickFile({
      title: "Open",
      initialDir: path ? os.fs.parent(path) : "C:\\DOCUMENTS",
      filter: `*.${options.extension}`,
    });
    if (chosen) await load(chosen);
  }
  async function newFile() {
    if (!(await confirmDirty())) return false;
    await options.setValue(
      typeof options.newValue === "function"
        ? options.newValue()
        : (options.newValue ?? ""),
    );
    path = null;
    dirty = false;
    update();
    return true;
  }
  ctx.onClose(confirmDirty);
  update();
  return {
    get path() {
      return path;
    },
    get dirty() {
      return dirty;
    },
    markDirty(value = true) {
      dirty = value;
      update();
    },
    save,
    saveAs,
    open,
    newFile,
    load,
    confirmDirty,
    async initial(args) {
      const chosen = appPath(args);
      if (chosen) {
        await os.fs.ready;
        await load(chosen);
      }
    },
    menu(extra = []) {
      return {
        label: "&File",
        items: [
          { label: "&New", shortcut: "Ctrl+N", action: newFile },
          { label: "&Open...", shortcut: "Ctrl+O", action: open },
          { label: "&Save", shortcut: "Ctrl+S", action: save },
          { label: "Save &As...", action: saveAs },
          ...extra,
          { separator: true },
          { label: "E&xit", action: () => ctx.win.close() },
        ],
      };
    },
  };
}

export function textEditor(ctx, textarea, onChange = () => {}) {
  let history = [{ value: textarea.value, start: 0, end: 0 }],
    at = 0,
    replaying = false;
  const capture = () => ({
    value: textarea.value,
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
  });
  function remember() {
    if (replaying) return;
    const snapshot = capture();
    if (history[at]?.value === snapshot.value) return;
    history = history.slice(0, at + 1);
    history.push(snapshot);
    if (history.length > 200) history.shift();
    at = history.length - 1;
    onChange();
  }
  listen(ctx, textarea, "input", remember);
  function restore(index) {
    if (!history[index]) return;
    at = index;
    replaying = true;
    textarea.value = history[at].value;
    textarea.focus();
    textarea.setSelectionRange(history[at].start, history[at].end);
    replaying = false;
    onChange();
  }
  const selected = () =>
    textarea.value.slice(textarea.selectionStart, textarea.selectionEnd);
  function insert(value) {
    const old = capture();
    history[at].start = old.start;
    history[at].end = old.end;
    textarea.setRangeText(String(value), old.start, old.end, "end");
    textarea.focus();
    remember();
    textarea.dispatchEvent(new Event("select"));
  }
  return {
    reset() {
      history = [capture()];
      at = 0;
    },
    undo: () => restore(at - 1),
    redo: () => restore(at + 1),
    async copy() {
      if (selected()) await ctx.os.copyText(selected());
    },
    async cut() {
      if (selected()) {
        await ctx.os.copyText(selected());
        insert("");
      }
    },
    async paste() {
      const value = await ctx.os.pasteText();
      if (value != null) insert(value);
    },
    delete() {
      if (textarea.selectionStart === textarea.selectionEnd)
        textarea.selectionEnd = Math.min(
          textarea.value.length,
          textarea.selectionEnd + 1,
        );
      insert("");
    },
    selectAll() {
      textarea.focus();
      textarea.select();
    },
    insert,
    selected,
    find(
      query,
      {
        matchCase = false,
        backwards = false,
        wrap = true,
        fromStart = false,
      } = {},
    ) {
      if (!query) return false;
      const haystack = matchCase
        ? textarea.value
        : textarea.value.toLowerCase();
      const needle = matchCase ? query : query.toLowerCase();
      const start = fromStart
        ? backwards
          ? haystack.length
          : 0
        : backwards
          ? textarea.selectionStart - 1
          : textarea.selectionEnd;
      let index = backwards
        ? start < 0
          ? -1
          : haystack.lastIndexOf(needle, start)
        : haystack.indexOf(needle, start);
      if (index < 0 && wrap)
        index = backwards
          ? haystack.lastIndexOf(needle)
          : haystack.indexOf(needle);
      if (index < 0) return false;
      textarea.focus();
      textarea.setSelectionRange(index, index + query.length);
      const line = textarea.value.slice(0, index).split("\n").length;
      textarea.scrollTop = Math.max(
        0,
        (line - 4) * (parseFloat(getComputedStyle(textarea).lineHeight) || 18),
      );
      return true;
    },
  };
}

export function editMenu(editor, extras = []) {
  return {
    label: "&Edit",
    items: [
      { label: "&Undo", shortcut: "Ctrl+Z", action: editor.undo },
      { label: "&Redo", shortcut: "Ctrl+Y", action: editor.redo },
      { separator: true },
      { label: "Cu&t", shortcut: "Ctrl+X", action: editor.cut },
      { label: "&Copy", shortcut: "Ctrl+C", action: editor.copy },
      { label: "&Paste", shortcut: "Ctrl+V", action: editor.paste },
      { label: "&Delete", shortcut: "Del", action: editor.delete },
      { separator: true },
      { label: "Select &All", shortcut: "Ctrl+A", action: editor.selectAll },
      ...extras,
    ],
  };
}

export async function findDialog(ctx, editor, state, replace = false) {
  const find = el("input", {
    class: "win-input",
    value: state.query || "",
    autofocus: true,
  });
  const replacement = el("input", {
    class: "win-input",
    value: state.replacement || "",
  });
  const match = el("input", { type: "checkbox", checked: !!state.matchCase });
  const backwards = el("input", {
    type: "checkbox",
    checked: !!state.backwards,
  });
  const result = el("div", { class: "prod-dialog-result", role: "status" });
  function sync() {
    state.query = find.value;
    state.replacement = replacement.value;
    state.matchCase = match.checked;
    state.backwards = backwards.checked;
  }
  function next() {
    sync();
    if (!find.value) return;
    result.textContent = editor.find(find.value, state)
      ? ""
      : `Cannot find "${find.value}".`;
  }
  function replaceOne() {
    sync();
    const value = editor.selected();
    if (
      (state.matchCase ? value : value.toLowerCase()) ===
        (state.matchCase ? state.query : state.query.toLowerCase()) &&
      state.query
    )
      editor.insert(state.replacement);
    next();
  }
  const body = el(
    "div",
    { class: "prod-find-dialog" },
    el("label", { class: "prod-form-row" }, "Find what:", find),
    replace
      ? el("label", { class: "prod-form-row" }, "Replace with:", replacement)
      : null,
    el(
      "div",
      { class: "prod-form-options" },
      el("label", {}, match, " Match case"),
      el("label", {}, backwards, " Search backwards"),
    ),
    el(
      "div",
      { class: "prod-form-actions" },
      button("Find Next", next),
      replace ? button("Replace", replaceOne) : null,
      replace
        ? button("Replace All", () => {
            sync();
            if (!state.query) return;
            const count = editor.replaceAll?.(
              state.query,
              state.replacement,
              state.matchCase,
            );
            result.textContent = `${count ?? 0} replacement(s).`;
          })
        : null,
    ),
    result,
  );
  find.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      event.stopPropagation();
      next();
    }
  });
  await ctx.os.dialog({
    title: replace ? "Replace" : "Find",
    body,
    width: 445,
    buttons: [{ label: "Close", value: "close" }],
  });
  sync();
}

export function helpMenu(ctx, name, details) {
  return {
    label: "&Help",
    items: [
      { label: `&About ${name}...`, action: () => ctx.os.about(name, details) },
    ],
  };
}

export function fontDialog(ctx, current = {}) {
  const family = el(
    "select",
    { class: "win-select" },
    [
      "Courier New",
      "Arial",
      "Times New Roman",
      "Georgia",
      "Verdana",
      "Tahoma",
      "monospace",
      "serif",
      "sans-serif",
    ].map((value) =>
      el("option", { value, selected: value === current.family }, value),
    ),
  );
  const size = el("input", {
    class: "win-input",
    type: "number",
    min: 6,
    max: 96,
    value: current.size || 14,
  });
  const bold = el("input", { type: "checkbox", checked: !!current.bold });
  const italic = el("input", { type: "checkbox", checked: !!current.italic });
  const sample = el(
    "div",
    { class: "prod-font-sample sunken" },
    "AaBbYyZz 0123456789",
  );
  const preview = () =>
    Object.assign(sample.style, {
      fontFamily: family.value,
      fontSize: `${Number(size.value) || 14}px`,
      fontWeight: bold.checked ? "bold" : "normal",
      fontStyle: italic.checked ? "italic" : "normal",
    });
  const body = el(
    "div",
    { class: "prod-font-dialog" },
    el("label", { class: "prod-form-row" }, "Font:", family),
    el("label", { class: "prod-form-row" }, "Size:", size),
    el(
      "div",
      { class: "prod-form-options" },
      el("label", {}, bold, " Bold"),
      el("label", {}, italic, " Italic"),
    ),
    sample,
  );
  [family, size, bold, italic].forEach((input) =>
    input.addEventListener("change", preview),
  );
  preview();
  return ctx.os
    .dialog({
      title: "Font",
      body,
      width: 370,
      buttons: [
        { label: "OK", value: "ok", default: true },
        { label: "Cancel", value: "cancel" },
      ],
    })
    .then((answer) =>
      answer === "ok"
        ? {
            family: family.value,
            size: Math.max(6, Math.min(96, Number(size.value) || 14)),
            bold: bold.checked,
            italic: italic.checked,
          }
        : null,
    );
}
