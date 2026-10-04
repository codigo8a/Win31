import { el, button, field, icon, clear, download } from "../core/dom.js";

const APP_NAMES = {
  filemanager: "File Manager",
  dos: "MS-DOS Prompt",
  printmanager: "Print Manager",
  terminal: "Terminal",
  pifeditor: "PIF Editor",
  setup: "Windows Setup",
  regedit: "Registration Info Editor",
  packager: "Object Packager",
  control: "Control Panel",
};
const SVG = {
  folder:
    '<path fill="#ffff80" stroke="#000" d="M2 8h12l3 3h13v17H2z"/><path fill="#ffff00" stroke="#000" d="M2 13h28l-3 15H2z"/>',
  file: '<path fill="#fff" stroke="#000" d="M7 2h13l6 6v22H7z"/><path fill="none" stroke="#000" d="M20 2v7h6M10 14h13m-13 4h13m-13 4h10"/>',
  drive:
    '<path fill="#c0c0c0" stroke="#000" d="M2 10l4-5h22l2 5v17H2z"/><path fill="#fff" stroke="#000" d="M5 14h22v9H5z"/><path stroke="#000" d="M8 18h10m5 0h2"/>',
  colors:
    '<path fill="#fff" stroke="#000" d="M3 4h26v25H3z"/><path fill="#ff0000" d="M5 6h10v10H5z"/><path fill="#00ff00" d="M16 6h10v10H16z"/><path fill="#0000ff" d="M5 17h10v10H5z"/><path fill="#ffff00" d="M16 17h10v10H16z"/>',
  fonts:
    '<path fill="#fff" stroke="#000" d="M3 3h26v26H3z"/><path fill="none" stroke="#000" stroke-width="2" d="M7 23l6-15 6 15m-10-6h8m3-5h7m-4 0v11m-3 0h7"/>',
  ports:
    '<path fill="#808080" stroke="#000" d="M2 7h28v16H2z"/><path fill="#fff" stroke="#000" d="M5 10h22l-3 10H8z"/><path stroke="#000" stroke-width="2" d="M9 12v2m5-2v2m5-2v2m5-2v2M11 16v2m5-2v2m5-2v2"/><path stroke="#000" d="M12 24v5h8v-5"/>',
  mouse:
    '<path fill="none" stroke="#000" d="M18 9V5c0-6 12-4 10-1"/><path fill="#fff" stroke="#000" d="M10 10l9-3 8 14-11 8-9-10z"/><path fill="none" stroke="#000" d="M10 10l6 9 10-5m-9-5 3 8"/>',
  desktop:
    '<path fill="#c0c0c0" stroke="#000" d="M2 3h28v21H2zM10 25h12v3H10zM6 28h20v2H6z"/><path fill="#008080" stroke="#000" d="M5 6h22v15H5z"/><path fill="#fff" stroke="#000" d="M9 9h14v10H9z"/><path fill="#000080" d="M10 10h12v3H10z"/>',
  keyboard:
    '<path fill="#fff" stroke="#000" d="M6 9h21l4 17H1z"/><path fill="none" stroke="#000" d="M7 13h18M5 17h22M4 21h24m-18-9-2 9m7-9-1 9m5-9v9m4-9 2 9M10 24h13"/>',
  printers:
    '<path fill="#fff" stroke="#000" d="M8 2h17v11H8z"/><path fill="#c0c0c0" stroke="#000" d="M3 11h27v14H3z"/><path fill="#fff" stroke="#000" d="M7 19h18v11H7z"/><path stroke="#000" d="M10 22h12m-12 3h12m-12 3h9"/><path fill="#00ff00" stroke="#000" d="M24 14h3v2h-3z"/>',
  international:
    '<circle fill="#00ffff" stroke="#000" cx="16" cy="16" r="13"/><ellipse fill="none" stroke="#000080" cx="16" cy="16" rx="7" ry="13"/><path fill="none" stroke="#000080" d="M3 16h26M6 8h20M6 24h20M16 3v26"/><path fill="#008000" d="M5 10h6l3 4-3 5-5-1m13-13 7 7-4 4h-5l-2-5m2 7h6l2 6-5 3-4-5z"/>',
  datetime:
    '<path fill="#fff" stroke="#000" d="M2 5h22v23H2z"/><path fill="#ff0000" stroke="#000" d="M2 5h22v6H2z"/><path fill="none" stroke="#000" d="M7 3v5m11-5v5M6 15h4m3 0h4m-11 4h4"/><circle fill="#fff" stroke="#000" cx="22" cy="22" r="9"/><path fill="none" stroke="#000" d="M22 15v7l5 2"/>',
  sound:
    '<path fill="#c0c0c0" stroke="#000" d="M3 12h6l9-8v25l-9-8H3z"/><path fill="none" stroke="#000" d="M21 9q9 7 0 14m4-17q12 10 0 20"/>',
  drivers:
    '<path fill="#008000" stroke="#000" d="M3 7h24v18H3z"/><path fill="#000" d="M8 11h13v10H8z"/><path stroke="#ffff00" d="M6 26v4m4-4v4m4-4v4m4-4v4m4-4v4"/><path fill="none" stroke="#c0c0c0" d="M9 9v3m4-3v3m4-3v3m4-3v3M5 14h4m-4 4h4m12-4h4m-4 4h4"/>',
  package:
    '<path fill="#ffff80" stroke="#000" d="M3 10l13-7 13 7v16l-13 5L3 25z"/><path fill="none" stroke="#000" d="M3 10l13 6 13-6M16 16v15M9 7l13 6v7l-5 2v-7"/>',
};
function glyph(type, size = 32) {
  const node = el("span", {
    class: "sys-glyph",
    style: { width: `${size}px`, height: `${size}px` },
    "aria-hidden": "true",
  });
  node.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32" shape-rendering="crispEdges">${SVG[type] || SVG.file}</svg>`;
  return node;
}
function input(value = "", attrs = {}) {
  return el("input", {
    class: "win-input",
    value: String(value ?? ""),
    ...attrs,
  });
}
function select(options, value, attrs = {}) {
  const node = el(
    "select",
    { class: "win-select", ...attrs },
    options.map((v) =>
      typeof v === "string"
        ? el("option", { value: v }, v)
        : el("option", { value: v[0] }, v[1]),
    ),
  );
  node.value = String(value ?? options[0]?.[0] ?? "");
  return node;
}
function check(label, checked = false) {
  const control = input("", { type: "checkbox", checked });
  return {
    control,
    node: el("label", { class: "sys-check" }, control, el("span", {}, label)),
  };
}
function row(label, control, className = "") {
  return el(
    "label",
    { class: `sys-row ${className}` },
    el("span", {}, label),
    control,
  );
}
function safe(os, fn) {
  return async (...args) => {
    try {
      return await fn(...args);
    } catch (err) {
      await os.message(err?.message || String(err), "Windows");
    }
  };
}
function cleanPath(os, path, cwd = "C:\\") {
  return os.fs.normalize(String(path || cwd).replace(/^"|"$/g, ""), cwd);
}
function join(os, dir, name) {
  return cleanPath(os, name, dir);
}
function fileType(path) {
  const ext = path.split(".").pop().toUpperCase();
  return ext === path.toUpperCase() ? "File" : `${ext} File`;
}
function bytes(n = 0) {
  return n < 1024
    ? `${n} bytes`
    : n < 1048576
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1048576).toFixed(1)} MB`;
}
function dateText(value) {
  const d = value ? new Date(value) : new Date();
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleString();
}
function escapeHTML(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
function settings(os, patch) {
  Object.assign(os.settings, patch);
  os.saveSettings();
  os.applySettings();
}
function openControl(os, panel) {
  const win = os.open("control");
  if (panel) win?.openPanel?.(panel);
  return win;
}
function notifyPrint(os) {
  os.events.dispatchEvent(new Event("printchange"));
}
function listen(ctx, target, name, fn, opts) {
  target.addEventListener(name, fn, opts);
  ctx.cleanup(() => target.removeEventListener(name, fn, opts));
}
function exportFile(os, path) {
  const data = os.fs.readFile(path);
  if (/^data:[^;]+;base64,/.test(data)) {
    const a = el("a", { href: data, download: os.fs.basename(path) });
    document.body.append(a);
    a.click();
    a.remove();
  } else download(os.fs.basename(path), data, "application/octet-stream");
}
async function readHostFile(file) {
  if (
    /^(image|audio|video)\//.test(file.type) ||
    /\.(?:woff2?|ttf|otf|exe|dll|zip|com)$/i.test(file.name)
  ) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error("The file could not be read."));
      r.readAsDataURL(file);
    });
  }
  return file.text();
}
async function chooseHostFiles(accept = "", multiple = true) {
  return new Promise((resolve) => {
    const picker = el("input", {
      type: "file",
      accept,
      multiple,
      style: { display: "none" },
    });
    picker.addEventListener(
      "change",
      () => {
        const files = Array.from(picker.files || []);
        picker.remove();
        resolve(files);
      },
      { once: true },
    );
    picker.addEventListener(
      "cancel",
      () => {
        picker.remove();
        resolve([]);
      },
      { once: true },
    );
    document.body.append(picker);
    picker.click();
  });
}
function describe(os, id, text) {
  return () => os.about(APP_NAMES[id], text);
}

function createFileManager(ctx, args) {
  const { os } = ctx;
  let cwd = cleanPath(os, args.path || args.directory || "C:\\");
  if (os.fs.exists(cwd) && os.fs.stat(cwd).type !== "directory")
    cwd = os.fs.parent(cwd);
  if (!os.fs.exists(cwd)) cwd = "C:\\";
  let selection = new Set(),
    sortBy = "name",
    descending = false,
    details = true,
    searchResults = null,
    anchor = 0;
  const expanded = new Set(["C:\\", cwd]);
  const address = input(cwd, { "aria-label": "Current directory" });
  const tree = el("div", {
    class: "fm-tree sunken",
    role: "tree",
    "aria-label": "Directories",
  });
  const list = el("div", {
    class: "fm-list sunken",
    tabIndex: 0,
    role: "listbox",
    "aria-label": "Files",
    "aria-multiselectable": "true",
  });
  const status = el("div", { class: "statusbar fm-status" });
  const root = el(
    "div",
    { class: "fm-app" },
    el(
      "div",
      { class: "toolbar fm-drivebar" },
      button("C:", () => navigate("C:\\"), { class: "win-button fm-drive" }),
      el("span", {}, "Local Disk"),
      button("Up", () => navigate(os.fs.parent(cwd))),
      button(
        "Import...",
        safe(os, async () => importFiles(await chooseHostFiles())),
      ),
      el("span", { class: "sys-grow" }),
      button("Refresh", () => render()),
    ),
    el(
      "div",
      { class: "fm-pathbar" },
      el("label", {}, "Directory:"),
      address,
      button(
        "Go",
        safe(os, () => navigate(address.value)),
      ),
    ),
    el("div", { class: "fm-panes" }, tree, list),
    status,
  );
  ctx.content.append(root);
  let entries = [];
  function chosen() {
    return entries.filter((f) => selection.has(f.path));
  }
  function navigate(path) {
    const target = cleanPath(os, path, cwd);
    if (!os.fs.exists(target))
      throw new Error(`The directory ${target} does not exist.`);
    if (os.fs.stat(target).type !== "directory") return os.openFile(target);
    cwd = target;
    selection.clear();
    searchResults = null;
    let dir = target;
    for (let i = 0; i < 32; i++) {
      expanded.add(dir);
      const parent = os.fs.parent(dir);
      if (parent === dir) break;
      dir = parent;
    }
    render();
  }
  function treeNode(path, depth) {
    let children = [];
    try {
      children = os.fs.readdir(path).filter((f) => f.type === "directory");
    } catch {
      return [];
    }
    const open = expanded.has(path);
    const line = el(
      "div",
      {
        class: `fm-tree-row ${cwd === path ? "selected" : ""}`,
        style: { paddingLeft: `${depth * 15 + 3}px` },
        role: "treeitem",
        "aria-expanded": children.length ? String(open) : undefined,
      },
      button(
        children.length ? (open ? "−" : "+") : " ",
        () => {
          open ? expanded.delete(path) : expanded.add(path);
          renderTree();
        },
        {
          class: "fm-expander",
          tabIndex: -1,
          "aria-label": `${open ? "Collapse" : "Expand"} ${path}`,
        },
      ),
      glyph(depth === 0 ? "drive" : "folder", 16),
      el("span", {}, depth === 0 ? "C:\\" : os.fs.basename(path)),
    );
    line.addEventListener(
      "click",
      safe(os, (e) => {
        if (!e.target.closest("button")) navigate(path);
      }),
    );
    return [
      line,
      open ? children.flatMap((child) => treeNode(child.path, depth + 1)) : [],
    ];
  }
  function renderTree() {
    clear(tree);
    tree.append(...treeNode("C:\\", 0).flat(Infinity));
  }
  function render() {
    address.value = cwd;
    ctx.setTitle(`File Manager — ${searchResults ? "Search Results" : cwd}`);
    renderTree();
    clear(list);
    entries = (searchResults || os.fs.readdir(cwd)).filter((f) =>
      os.fs.exists(f.path),
    );
    entries.sort((a, b) => {
      if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
      const result =
        sortBy === "size"
          ? (a.size || 0) - (b.size || 0)
          : sortBy === "modified"
            ? new Date(a.modified || 0) - new Date(b.modified || 0)
            : String(
                sortBy === "type" ? fileType(a.name) : a.name,
              ).localeCompare(
                String(sortBy === "type" ? fileType(b.name) : b.name),
                undefined,
                { numeric: true },
              );
      return descending ? -result : result;
    });
    selection = new Set(
      [...selection].filter((path) => entries.some((f) => f.path === path)),
    );
    list.classList.toggle("fm-compact", !details);
    if (details)
      list.append(
        el(
          "div",
          { class: "fm-heading" },
          ...[
            ["name", "Name"],
            ["size", "Size"],
            ["type", "Type"],
            ["modified", "Date / Time"],
          ].map(([key, title]) =>
            button(
              `${title}${sortBy === key ? (descending ? " ▼" : " ▲") : ""}`,
              () => {
                if (sortBy === key) descending = !descending;
                else {
                  sortBy = key;
                  descending = false;
                }
                render();
              },
              { class: `fm-head fm-col-${key}` },
            ),
          ),
        ),
      );
    entries.forEach((entry, index) => {
      const item = el(
        "div",
        {
          class: `fm-file-row ${selection.has(entry.path) ? "selected" : ""}`,
          role: "option",
          "aria-selected": String(selection.has(entry.path)),
          tabIndex: -1,
          title: entry.path,
        },
        el(
          "span",
          { class: "fm-col-name" },
          glyph(entry.type === "directory" ? "folder" : "file", 16),
          el("span", {}, entry.name),
        ),
        ...(details
          ? [
              el(
                "span",
                { class: "fm-col-size" },
                entry.type === "directory" ? "" : String(entry.size || 0),
              ),
              el(
                "span",
                { class: "fm-col-type" },
                entry.type === "directory" ? "Directory" : fileType(entry.name),
              ),
              el(
                "span",
                { class: "fm-col-modified" },
                entry.modified ? dateText(entry.modified) : "",
              ),
            ]
          : []),
      );
      item.addEventListener("click", (e) => {
        if (e.shiftKey) {
          if (!e.ctrlKey && !e.metaKey) selection.clear();
          for (
            let n = Math.min(anchor, index);
            n <= Math.max(anchor, index);
            n++
          )
            selection.add(entries[n].path);
        } else if (e.ctrlKey || e.metaKey) {
          selection.has(entry.path)
            ? selection.delete(entry.path)
            : selection.add(entry.path);
          anchor = index;
        } else {
          selection = new Set([entry.path]);
          anchor = index;
        }
        renderSelection();
        list.focus();
      });
      item.addEventListener(
        "dblclick",
        safe(os, () =>
          entry.type === "directory"
            ? navigate(entry.path)
            : os.openFile(entry.path),
        ),
      );
      list.append(item);
    });
    if (!entries.length)
      list.append(
        el(
          "div",
          { class: "fm-empty" },
          searchResults
            ? "No files match the search."
            : "This directory is empty.",
        ),
      );
    updateStatus();
    menu();
  }
  function renderSelection() {
    [...list.querySelectorAll(".fm-file-row")].forEach((n, i) => {
      const selected = selection.has(entries[i].path);
      n.classList.toggle("selected", selected);
      n.setAttribute("aria-selected", String(selected));
    });
    updateStatus();
    menu();
  }
  function updateStatus() {
    const files = entries.filter((f) => f.type === "file");
    status.textContent = `${entries.length} item${entries.length === 1 ? "" : "s"}   ${bytes(files.reduce((n, f) => n + (f.size || 0), 0))}   ${selection.size ? `${selection.size} selected` : "C: Local virtual disk"}`;
  }
  const openSelected = safe(os, async () => {
    for (const f of chosen())
      await (f.type === "directory" ? navigate(f.path) : os.openFile(f.path));
  });
  const newFolder = safe(os, async () => {
    const name = await os.prompt(
      "Create Directory",
      "Directory name:",
      "NEWFOLD",
    );
    if (name) {
      const path = join(os, cwd, name);
      if (os.fs.exists(path))
        throw new Error("A file or directory with that name already exists.");
      os.fs.mkdir(path, { recursive: true });
      selection = new Set([path]);
      render();
    }
  });
  const rename = safe(os, async () => {
    const f = chosen()[0];
    if (!f) return;
    const name = await os.prompt("Rename", `Rename ${f.name} to:`, f.name);
    if (name && name !== f.name) {
      const dest = join(os, os.fs.parent(f.path), name);
      if (os.fs.exists(dest))
        throw new Error("The destination already exists.");
      os.fs.rename(f.path, dest);
      selection = new Set([dest]);
      render();
    }
  });
  const remove = safe(os, async () => {
    const files = chosen();
    if (!files.length) return;
    if (
      await os.confirm(
        `Delete ${files.length === 1 ? files[0].name : `${files.length} selected items`}? Directories and their contents will be removed.`,
        "Delete",
      )
    ) {
      files.forEach((f) => os.fs.remove(f.path, { recursive: true }));
      selection.clear();
      render();
    }
  });
  const copy = (cut) => {
    os.clipboard.files = chosen().map((f) => f.path);
    os.clipboard.cut = cut;
    updateStatus();
    status.textContent += `   ${os.clipboard.files.length} item(s) ${cut ? "cut" : "copied"}`;
    menu();
  };
  const paste = safe(os, async () => {
    const files = [...(os.clipboard.files || [])];
    let changed = false;
    for (const source of files) {
      if (!os.fs.exists(source)) continue;
      let dest = join(os, cwd, os.fs.basename(source));
      if (dest === source) {
        if (os.clipboard.cut) continue;
        const base = os.fs.basename(source);
        let n = 1;
        do {
          dest = join(os, cwd, `Copy${n > 1 ? ` ${n}` : ""} of ${base}`);
          n++;
        } while (os.fs.exists(dest));
      }
      if (
        dest.startsWith(source + "\\") &&
        os.fs.stat(source).type === "directory"
      )
        throw new Error("A directory cannot be copied into itself.");
      if (os.fs.exists(dest)) {
        if (
          !(await os.confirm(
            `Replace ${os.fs.basename(dest)}?`,
            "Confirm File Replace",
          ))
        )
          continue;
        os.fs.remove(dest, { recursive: true });
      }
      os.clipboard.cut ? os.fs.rename(source, dest) : os.fs.copy(source, dest);
      changed = true;
    }
    if (os.clipboard.cut && changed) {
      os.clipboard.files = [];
      os.clipboard.cut = false;
    }
    render();
  });
  const transfer = (move) =>
    safe(os, async () => {
      const files = chosen();
      if (!files.length) return;
      const result = await os.prompt(
        move ? "Move" : "Copy",
        "Destination directory:",
        cwd,
      );
      if (!result) return;
      const destination = cleanPath(os, result, cwd);
      if (
        !os.fs.exists(destination) ||
        os.fs.stat(destination).type !== "directory"
      )
        throw new Error("The destination directory does not exist.");
      for (const f of files) {
        const target = join(os, destination, f.name);
        if (target === f.path) continue;
        if (target.startsWith(f.path + "\\") && f.type === "directory")
          throw new Error("A directory cannot be copied into itself.");
        if (os.fs.exists(target)) {
          if (!(await os.confirm(`Replace ${target}?`, "Confirm File Replace")))
            continue;
          os.fs.remove(target, { recursive: true });
        }
        move ? os.fs.rename(f.path, target) : os.fs.copy(f.path, target);
      }
      render();
    });
  const properties = safe(os, async () => {
    const f = chosen()[0] || os.fs.stat(cwd);
    const children =
      f.type === "directory" ? os.fs.readdir(f.path || cwd) : null;
    await os.dialog({
      title: "Properties",
      width: 430,
      body: el(
        "div",
        { class: "dialog-body sys-properties" },
        glyph(f.type === "directory" ? "folder" : "file"),
        el("strong", {}, f.name || os.fs.basename(cwd)),
        row("Path:", el("span", {}, f.path || cwd)),
        row(
          "Type:",
          el(
            "span",
            {},
            f.type === "directory" ? "Directory" : fileType(f.name),
          ),
        ),
        row(
          "Size:",
          el("span", {}, children ? `${children.length} items` : bytes(f.size)),
        ),
        row("Modified:", el("span", {}, dateText(f.modified))),
        el("p", {}, "Stored on the local virtual disk."),
      ),
      buttons: [{ label: "OK", value: true, default: true }],
    });
  });
  async function importFiles(files) {
    for (const file of files) {
      const path = join(os, cwd, file.name);
      if (
        os.fs.exists(path) &&
        !(await os.confirm(`Replace ${file.name}?`, "Import Files"))
      )
        continue;
      os.fs.writeFile(path, await readHostFile(file));
    }
    render();
  }
  const search = safe(os, async () => {
    const pattern = await os.prompt(
      "Search",
      "Search for files (wildcards * and ? are accepted):",
      "*.*",
    );
    if (!pattern) return;
    const regexp = wildcard(pattern);
    const results = [];
    function walk(dir) {
      for (const f of os.fs.readdir(dir)) {
        if (regexp.test(f.name)) results.push(f);
        if (f.type === "directory") walk(f.path);
      }
    }
    walk(cwd);
    searchResults = results;
    selection.clear();
    render();
  });
  function menu() {
    const any = selection.size > 0;
    ctx.setMenu([
      {
        label: "&File",
        items: [
          {
            label: "&Open",
            shortcut: "Enter",
            action: openSelected,
            disabled: !any,
          },
          {
            label: "&Run...",
            action: safe(os, async () => {
              const command = await os.prompt("Run", "Command line:", "");
              if (command) os.run(command);
            }),
          },
          { separator: true },
          { label: "&Move...", action: transfer(true), disabled: !any },
          { label: "&Copy...", action: transfer(false), disabled: !any },
          {
            label: "Re&name...",
            shortcut: "F2",
            action: rename,
            disabled: selection.size !== 1,
          },
          {
            label: "&Delete...",
            shortcut: "Del",
            action: remove,
            disabled: !any,
          },
          { label: "Propert&ies...", action: properties },
          { separator: true },
          { label: "Create &Directory...", action: newFolder },
          { label: "&Search...", action: search },
          {
            label: "&Import Files...",
            action: safe(os, async () => importFiles(await chooseHostFiles())),
          },
          {
            label: "&Export Selected...",
            action: safe(os, () =>
              chosen()
                .filter((f) => f.type === "file")
                .forEach((f) => exportFile(os, f.path)),
            ),
            disabled: !chosen().some((f) => f.type === "file"),
          },
          { separator: true },
          { label: "E&xit", action: () => ctx.win.close() },
        ],
      },
      {
        label: "&Edit",
        items: [
          {
            label: "Cu&t",
            shortcut: "Ctrl+X",
            action: () => copy(true),
            disabled: !any,
          },
          {
            label: "&Copy",
            shortcut: "Ctrl+C",
            action: () => copy(false),
            disabled: !any,
          },
          {
            label: "&Paste",
            shortcut: "Ctrl+V",
            action: paste,
            disabled: !os.clipboard.files?.length,
          },
          { separator: true },
          {
            label: "Select &All",
            shortcut: "Ctrl+A",
            action: () => {
              selection = new Set(entries.map((f) => f.path));
              renderSelection();
            },
          },
          {
            label: "&Deselect All",
            action: () => {
              selection.clear();
              renderSelection();
            },
          },
        ],
      },
      {
        label: "&Disk",
        items: [
          { label: "Select &Drive C:", action: () => navigate("C:\\") },
          {
            label: "&Label Disk...",
            action: safe(os, async () => {
              const name = await os.prompt(
                "Label Disk",
                "Volume label:",
                os.settings.diskLabel || "MS-DOS_6",
              );
              if (name !== null) {
                settings(os, { diskLabel: name.slice(0, 32) });
                render();
              }
            }),
          },
          {
            label: "Disk &Information...",
            action: () => {
              let count = 0,
                total = 0;
              function scan(dir) {
                for (const f of os.fs.readdir(dir)) {
                  if (f.type === "directory") scan(f.path);
                  else {
                    count++;
                    total += f.size || 0;
                  }
                }
              }
              scan("C:\\");
              os.message(
                `Drive C:\nVolume: ${os.settings.diskLabel || "MS-DOS_6"}\n${count} files, ${bytes(total)}\n\nThe virtual disk is saved in this browser. Capacity is managed by browser storage.`,
                "Disk Information",
              );
            },
          },
        ],
      },
      {
        label: "&Tree",
        items: [
          {
            label: "&Expand One Level",
            action: () => {
              expanded.add(cwd);
              os.fs
                .readdir(cwd)
                .filter((f) => f.type === "directory")
                .forEach((f) => expanded.add(f.path));
              renderTree();
            },
          },
          {
            label: "Expand &All",
            action: () => {
              function walk(path) {
                expanded.add(path);
                os.fs
                  .readdir(path)
                  .filter((f) => f.type === "directory")
                  .forEach((f) => walk(f.path));
              }
              walk("C:\\");
              renderTree();
            },
          },
          {
            label: "&Collapse Tree",
            action: () => {
              expanded.clear();
              expanded.add("C:\\");
              renderTree();
            },
          },
        ],
      },
      {
        label: "&View",
        items: [
          {
            label: "&All File Details",
            checked: details,
            action: () => {
              details = true;
              render();
            },
          },
          {
            label: "&Name Only",
            checked: !details,
            action: () => {
              details = false;
              render();
            },
          },
          { separator: true },
          ...[
            ["name", "Name"],
            ["type", "Type"],
            ["size", "Size"],
            ["modified", "Date"],
          ].map(([key, label]) => ({
            label: `Sort by ${label}`,
            checked: sortBy === key,
            action: () => {
              sortBy = key;
              render();
            },
          })),
          {
            label: "&Descending",
            checked: descending,
            action: () => {
              descending = !descending;
              render();
            },
          },
          { separator: true },
          {
            label: "&Refresh",
            shortcut: "F5",
            action: () => {
              searchResults = null;
              render();
            },
          },
        ],
      },
      {
        label: "&Window",
        items: [
          { label: "&Cascade", action: () => os.wm.cascade() },
          { label: "&Tile", action: () => os.wm.tile() },
          { label: "&Arrange Icons", action: () => os.wm.arrangeIcons() },
        ],
      },
      {
        label: "&Help",
        items: [
          {
            label: "&File Manager Help",
            action: () =>
              os.message(
                "Double-click a directory to browse it or a file to open it. Use Ctrl-click or Shift-click to select several files. Files can be copied, moved, renamed, deleted, imported from your computer, or exported. Drag files from your computer into the file list to import them.",
                "File Manager Help",
              ),
          },
          {
            label: "&About File Manager...",
            action: describe(
              os,
              "filemanager",
              "Browse and manage the persistent virtual C: drive. Import and export real files through explicit browser file dialogs.",
            ),
          },
        ],
      },
    ]);
  }
  address.addEventListener(
    "keydown",
    safe(os, (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        navigate(address.value);
      }
    }),
  );
  list.addEventListener("dragover", (e) => {
    e.preventDefault();
    root.classList.add("fm-dragging");
  });
  list.addEventListener("dragleave", () =>
    root.classList.remove("fm-dragging"),
  );
  list.addEventListener(
    "drop",
    safe(os, async (e) => {
      e.preventDefault();
      root.classList.remove("fm-dragging");
      await importFiles(Array.from(e.dataTransfer?.files || []));
    }),
  );
  listen(
    ctx,
    ctx.win.element,
    "keydown",
    safe(os, (e) => {
      if (e.target.matches("input, textarea, select")) return;
      const mod = e.ctrlKey || e.metaKey;
      if (e.key === "Enter") {
        e.preventDefault();
        openSelected();
      } else if (e.key === "Delete") {
        e.preventDefault();
        remove();
      } else if (e.key === "F2") {
        e.preventDefault();
        rename();
      } else if (e.key === "F5") {
        e.preventDefault();
        render();
      } else if (e.key === "Backspace") {
        e.preventDefault();
        navigate(os.fs.parent(cwd));
      } else if (mod && ["a", "c", "x", "v"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        const key = e.key.toLowerCase();
        if (key === "a") {
          selection = new Set(entries.map((f) => f.path));
          renderSelection();
        } else if (key === "v") paste();
        else copy(key === "x");
      } else if (["ArrowDown", "ArrowUp"].includes(e.key)) {
        e.preventDefault();
        anchor = Math.max(
          0,
          Math.min(
            entries.length - 1,
            anchor + (e.key === "ArrowDown" ? 1 : -1),
          ),
        );
        if (entries[anchor]) {
          selection = new Set([entries[anchor].path]);
          renderSelection();
          list
            .querySelectorAll(".fm-file-row")
            [anchor]?.scrollIntoView({ block: "nearest" });
        }
      }
    }),
  );
  ctx.cleanup(
    os.fs.subscribe(() => {
      if (!os.fs.exists(cwd)) cwd = "C:\\";
      render();
    }),
  );
  render();
}

function wildcard(pattern = "*") {
  if (pattern === "*.*") pattern = "*";
  return new RegExp(
    `^${pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".")}$`,
    "i",
  );
}
function tokenize(line) {
  return (line.match(/"(?:[^"\\]|\\.)*"|'[^']*'|[^\s]+/g) || []).map((s) =>
    /^['"]/.test(s) ? s.slice(1, -1).replace(/\\"/g, '"') : s,
  );
}

function createDOS(ctx, args) {
  const { os } = ctx;
  let cwd = cleanPath(os, args.cwd || "C:\\"),
    history = os.storage.get("dos-history", []),
    historyIndex = history.length,
    buffer = [],
    running = false;
  let env = {
    COMSPEC: "C:\\COMMAND.COM",
    PATH: "C:\\WINDOWS;C:\\WINDOWS\\SYSTEM",
    PROMPT: "$P$G",
    TEMP: "C:\\TEMP",
    ...os.storage.get("dos-env", {}),
  };
  let echoEnabled = true;
  const output = el("pre", { class: "dos-output", "aria-live": "polite" });
  const prompt = el("span", { class: "dos-prompt" });
  const command = input("", {
    class: "dos-input",
    spellcheck: false,
    autocapitalize: "off",
    autocomplete: "off",
    "aria-label": "DOS command",
  });
  const screen = el(
    "div",
    { class: "dos-screen", tabIndex: -1 },
    output,
    el("div", { class: "dos-command" }, prompt, command),
  );
  ctx.content.append(screen);
  function promptText() {
    return (env.PROMPT || "$P$G")
      .replace(/\$P/gi, cwd)
      .replace(/\$G/gi, ">")
      .replace(/\$L/gi, "<")
      .replace(/\$S/gi, " ")
      .replace(/\$D/gi, new Date().toLocaleDateString())
      .replace(/\$T/gi, new Date().toLocaleTimeString())
      .replace(/\$\$/g, "$");
  }
  function update() {
    output.textContent = buffer.join("\n");
    prompt.textContent = promptText();
    screen.scrollTop = screen.scrollHeight;
    command.disabled = running;
    if (!running) command.focus();
  }
  function print(text = "") {
    if (text !== null && text !== undefined) buffer.push(String(text));
    if (buffer.length > 1500) buffer = buffer.slice(-1200);
    update();
  }
  function resolve(path = ".") {
    return cleanPath(os, path, cwd);
  }
  function matches(pattern = "*.*", directoryOnly = false) {
    const path = resolve(pattern),
      star = /[*?]/.test(path);
    if (!star && os.fs.exists(path)) {
      const stat = os.fs.stat(path);
      return stat.type === "directory" && !directoryOnly
        ? os.fs.readdir(path)
        : [stat];
    }
    const parent = os.fs.parent(path),
      match = wildcard(os.fs.basename(path));
    if (!os.fs.exists(parent)) throw new Error("Path not found");
    return os.fs
      .readdir(parent)
      .filter(
        (f) => match.test(f.name) && (!directoryOnly || f.type === "directory"),
      );
  }
  function parseRedirect(line) {
    let quote = "",
      at = -1;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        quote = quote === char ? "" : quote || char;
      }
      if (!quote && char === ">") {
        at = i;
        break;
      }
    }
    if (at < 0) return { line };
    const append = line[at + 1] === ">",
      target = line.slice(at + (append ? 2 : 1)).trim();
    if (!target) throw new Error("The syntax of the command is incorrect.");
    return {
      line: line.slice(0, at).trim(),
      target: resolve(tokenize(target)[0]),
      append,
    };
  }
  function walkTree(path, showFiles, prefix = "") {
    const children = os.fs
      .readdir(path)
      .filter((f) => showFiles || f.type === "directory");
    return children.flatMap((f, i) => {
      const last = i === children.length - 1;
      return [
        `${prefix}${last ? "└───" : "├───"}${f.name}`,
        ...(f.type === "directory"
          ? walkTree(f.path, showFiles, prefix + (last ? "    " : "│   "))
          : []),
      ];
    });
  }
  function dosDate() {
    return new Date(Date.now() + (Number(os.settings.clockOffsetMs) || 0));
  }
  async function execute(line) {
    const expandedLine = line.replace(
      /%([^%]+)%/g,
      (_, name) => env[name.toUpperCase()] || "",
    );
    const redirect = parseRedirect(expandedLine);
    const response = await interpret(redirect.line);
    if (redirect.target && response != null) {
      const existing =
        redirect.append && os.fs.exists(redirect.target)
          ? os.fs.readFile(redirect.target)
          : "";
      os.fs.writeFile(redirect.target, existing + String(response) + "\r\n");
      return "";
    }
    return response;
  }
  async function interpret(line) {
    const parts = tokenize(line.trim());
    if (!parts.length) return "";
    let cmd = parts.shift().toUpperCase();
    if (/^CD[.\\/]/.test(cmd)) {
      parts.unshift(cmd.slice(2));
      cmd = "CD";
    }
    if (/^[A-Z]:$/.test(cmd)) {
      if (cmd !== "C:") throw new Error("Invalid drive specification");
      cwd = "C:\\";
      return "";
    }
    const flags = parts
      .filter((p) => /^\/[A-Z?]+$/i.test(p))
      .map((p) => p.toUpperCase());
    const operands = parts.filter((p) => !/^\/[A-Z?]+$/i.test(p));
    const arg = operands[0];
    if (flags.includes("/?") && cmd !== "HELP") return help(cmd);
    switch (cmd) {
      case "HELP":
        return help(arg?.toUpperCase());
      case "VER":
        return "Microsoft MS-DOS Version 6.22 command workspace\nWindows 3.1 browser recreation; native DOS executables are not emulated.";
      case "CLS":
        buffer = [];
        update();
        return null;
      case "CD":
      case "CHDIR": {
        if (!parts.length) return cwd;
        const path = resolve(parts.join(" "));
        if (!os.fs.exists(path) || os.fs.stat(path).type !== "directory")
          throw new Error("Invalid directory");
        cwd = path;
        return "";
      }
      case "DIR": {
        const target = arg || "*.*",
          full = resolve(target),
          lines = [];
        let dir = /[*?]/.test(full)
          ? os.fs.parent(full)
          : os.fs.exists(full) && os.fs.stat(full).type === "directory"
            ? full
            : os.fs.parent(full);
        let entries = matches(target);
        if (!flags.includes("/B"))
          lines.push(
            ` Volume in drive C is ${os.settings.diskLabel || "MS-DOS_6"}\n Directory of ${dir}\n`,
          );
        function listing(folder, files) {
          if (flags.includes("/B"))
            lines.push(
              ...files.map((f) => (flags.includes("/S") ? f.path : f.name)),
            );
          else if (flags.includes("/W")) {
            const names = files.map((f) =>
              f.type === "directory" ? `[${f.name}]` : f.name,
            );
            for (let n = 0; n < names.length; n += 4)
              lines.push(
                names
                  .slice(n, n + 4)
                  .map((name) => name.padEnd(20))
                  .join(""),
              );
          } else
            files.forEach((f) => {
              const d = f.modified ? new Date(f.modified) : new Date();
              const date = Number.isNaN(d.getTime())
                ? ""
                : d.toLocaleDateString("en-US", {
                    year: "2-digit",
                    month: "2-digit",
                    day: "2-digit",
                  });
              const time = Number.isNaN(d.getTime())
                ? ""
                : d.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: false,
                  });
              lines.push(
                `${f.name.padEnd(22)} ${f.type === "directory" ? "<DIR>".padStart(12) : String(f.size || 0).padStart(12)} ${date} ${time}`,
              );
            });
          if (flags.includes("/S"))
            for (const child of os.fs
              .readdir(folder)
              .filter((f) => f.type === "directory")) {
              if (!flags.includes("/B"))
                lines.push(`\n Directory of ${child.path}\n`);
              listing(
                child.path,
                os.fs
                  .readdir(child.path)
                  .filter((f) =>
                    wildcard(
                      /[*?]/.test(full) ? os.fs.basename(full) : "*",
                    ).test(f.name),
                  ),
              );
            }
        }
        listing(dir, entries);
        if (!flags.includes("/B"))
          lines.push(
            `\n${String(entries.filter((f) => f.type === "file").length).padStart(9)} file(s) ${entries.reduce((sum, f) => sum + (f.type === "file" ? f.size || 0 : 0), 0)} bytes`,
            `${String(entries.filter((f) => f.type === "directory").length).padStart(9)} dir(s)  Browser-managed free space`,
          );
        return lines.join("\n");
      }
      case "MD":
      case "MKDIR": {
        if (!operands.length) throw new Error("Required parameter missing");
        for (const name of operands) {
          const path = resolve(name);
          if (os.fs.exists(path))
            throw new Error(`Directory already exists: ${path}`);
          os.fs.mkdir(path, { recursive: true });
        }
        return "";
      }
      case "RD":
      case "RMDIR": {
        if (!arg) throw new Error("Required parameter missing");
        const path = resolve(arg);
        if (path === "C:\\" || cwd === path || cwd.startsWith(path + "\\"))
          throw new Error("Cannot remove the current directory or its parent.");
        if (!os.fs.exists(path) || os.fs.stat(path).type !== "directory")
          throw new Error("Invalid directory");
        if (os.fs.readdir(path).length && !flags.includes("/S"))
          throw new Error(
            "The directory is not empty. Use RD /S to remove its contents.",
          );
        if (
          flags.includes("/S") &&
          !flags.includes("/Q") &&
          !(await os.confirm(
            `Remove ${path} and all of its contents?`,
            "MS-DOS Prompt",
          ))
        )
          return "Operation canceled.";
        os.fs.remove(path, { recursive: flags.includes("/S") });
        return "";
      }
      case "COPY":
      case "MOVE": {
        if (!arg) throw new Error("Required parameter missing");
        const sourcePath = resolve(arg),
          sourceHasWildcard = /[*?]/.test(arg);
        const sources = sourceHasWildcard
          ? matches(arg)
          : os.fs.exists(sourcePath)
            ? [os.fs.stat(sourcePath)]
            : [];
        if (!sources.length) throw new Error("File not found");
        const target = resolve(operands[1] || ".");
        const isDir =
          os.fs.exists(target) && os.fs.stat(target).type === "directory";
        if (sources.length > 1 && !isDir)
          throw new Error("The destination must be an existing directory.");
        let count = 0;
        for (const file of sources) {
          const dest = isDir ? join(os, target, file.name) : target;
          if (dest === file.path)
            throw new Error("The file cannot be copied onto itself.");
          if (file.type === "directory" && dest.startsWith(file.path + "\\"))
            throw new Error("Cannot copy a directory into itself.");
          if (os.fs.exists(dest)) {
            if (
              !flags.includes("/Y") &&
              !(await os.confirm(`Overwrite ${dest}?`, "MS-DOS Prompt"))
            )
              continue;
            os.fs.remove(dest, { recursive: true });
          }
          cmd === "MOVE"
            ? os.fs.rename(file.path, dest)
            : os.fs.copy(file.path, dest);
          count++;
        }
        return `${String(count).padStart(9)} file(s) ${cmd === "MOVE" ? "moved" : "copied"}`;
      }
      case "REN":
      case "RENAME": {
        if (operands.length < 2) throw new Error("Required parameter missing");
        const source = resolve(operands[0]);
        if (!os.fs.exists(source)) throw new Error("File not found");
        if (/[*?]/.test(operands.join(" ")))
          throw new Error("Use an exact source and destination name with REN.");
        const target = cleanPath(os, operands[1], os.fs.parent(source));
        if (os.fs.exists(target))
          throw new Error("Duplicate file name or file not found");
        os.fs.rename(source, target);
        return "";
      }
      case "DEL":
      case "ERASE": {
        if (!arg) throw new Error("Required parameter missing");
        const files = operands
          .flatMap((pattern) => matches(pattern))
          .filter((f) => f.type === "file");
        if (!files.length) throw new Error("File not found");
        if (
          (/[*?]/.test(operands.join(" ")) || flags.includes("/P")) &&
          !flags.includes("/Q") &&
          !(await os.confirm(
            `Delete ${files.length} file(s)?`,
            "MS-DOS Prompt",
          ))
        )
          return "Operation canceled.";
        for (const file of files) os.fs.remove(file.path);
        return "";
      }
      case "TYPE": {
        if (!operands.length) throw new Error("Required parameter missing");
        return operands
          .flatMap((name) => {
            const path = resolve(name);
            if (!os.fs.exists(path) || os.fs.stat(path).type !== "file")
              throw new Error("File not found");
            return [os.fs.readFile(path)];
          })
          .join("\n");
      }
      case "ECHO": {
        const value = line.replace(/^\s*echo\s*/i, "");
        if (!value) return `ECHO is ${echoEnabled ? "on" : "off"}.`;
        if (/^(ON|OFF)$/i.test(value)) {
          echoEnabled = value.toUpperCase() === "ON";
          return "";
        }
        return value;
      }
      case "ECHO.":
        return "";
      case "DATE": {
        if (!arg)
          return `Current date is ${dosDate().toLocaleDateString()}\nUse DATE YYYY-MM-DD to set this desktop's date.`;
        const parsed = /^\d{4}-\d{2}-\d{2}$/.test(arg)
          ? new Date(arg + "T12:00:00")
          : new Date(arg);
        if (Number.isNaN(parsed.getTime()))
          throw new Error("Invalid date. Use YYYY-MM-DD.");
        const current = dosDate();
        parsed.setHours(
          current.getHours(),
          current.getMinutes(),
          current.getSeconds(),
        );
        settings(os, { clockOffsetMs: parsed.getTime() - Date.now() });
        return `Current date is ${parsed.toLocaleDateString()}`;
      }
      case "TIME": {
        if (!arg)
          return `Current time is ${dosDate().toLocaleTimeString()}\nUse TIME HH:MM[:SS] to set this desktop's time.`;
        const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(arg);
        if (!m || +m[1] > 23 || +m[2] > 59 || +(m[3] || 0) > 59)
          throw new Error("Invalid time. Use HH:MM[:SS].");
        const d = dosDate();
        d.setHours(+m[1], +m[2], +(m[3] || 0), 0);
        settings(os, { clockOffsetMs: d.getTime() - Date.now() });
        return `Current time is ${d.toLocaleTimeString()}`;
      }
      case "SET": {
        const value = line.replace(/^\s*set\s*/i, "");
        if (!value)
          return Object.keys(env)
            .sort()
            .map((k) => `${k}=${env[k]}`)
            .join("\n");
        const at = value.indexOf("=");
        if (at < 0)
          return (
            Object.keys(env)
              .filter((k) => k.startsWith(value.toUpperCase()))
              .map((k) => `${k}=${env[k]}`)
              .join("\n") || "Environment variable not defined"
          );
        const key = value.slice(0, at).trim().toUpperCase(),
          setting = value.slice(at + 1);
        if (!/^[A-Z_][A-Z0-9_]*$/.test(key))
          throw new Error("Invalid environment variable name");
        if (setting) env[key] = setting;
        else delete env[key];
        os.storage.set("dos-env", env);
        return "";
      }
      case "PATH": {
        if (!parts.length) return `PATH=${env.PATH || ""}`;
        env.PATH = parts.join(" ") === ";" ? "" : parts.join(" ");
        os.storage.set("dos-env", env);
        return "";
      }
      case "PROMPT":
        env.PROMPT = parts.join(" ") || "$P$G";
        os.storage.set("dos-env", env);
        return "";
      case "TREE": {
        const path = resolve(arg || ".");
        if (!os.fs.exists(path) || os.fs.stat(path).type !== "directory")
          throw new Error("Invalid directory");
        return `Directory PATH listing for volume ${os.settings.diskLabel || "MS-DOS_6"}\n${path}\n${walkTree(path, flags.includes("/F")).join("\n")}`;
      }
      case "EDIT":
      case "NOTEPAD": {
        const path = arg ? resolve(arg) : undefined;
        if (path && !os.fs.exists(path)) os.fs.writeFile(path, "");
        os.open("notepad", path ? { path } : {});
        return "";
      }
      case "START": {
        if (!parts.length) {
          os.open("dos", { cwd });
          return "";
        }
        const possible = resolve(parts[0]);
        if (os.fs.exists(possible)) await os.openFile(possible);
        else await os.run(parts.join(" "));
        return "";
      }
      case "EXIT":
        ctx.win.close();
        return null;
      default: {
        if (cmd.startsWith("ECHO.")) return line.slice(5);
        const known = {
          WINFILE: "filemanager",
          COMMAND: "dos",
          CONTROL: "control",
          PRINTMAN: "printmanager",
          TERMINAL: "terminal",
          PIFEDIT: "pifeditor",
          SETUP: "setup",
          REGEDIT: "regedit",
          PACKAGER: "packager",
        };
        const name = os.fs.basename(cmd).replace(/\.(EXE|COM)$/i, "");
        if (known[name]) {
          os.open(known[name], { cwd });
          return "";
        }
        const app = [...os.apps.values()].find(
          (a) =>
            a.id.toUpperCase() === name ||
            a.title.toUpperCase().replace(/\s/g, "") === name,
        );
        if (app) {
          os.open(
            app.id,
            parts[0] ? { path: resolve(parts[0]), cwd } : { cwd },
          );
          return "";
        }
        const path = resolve(tokenize(line)[0]);
        if (os.fs.exists(path)) {
          if (os.fs.stat(path).type === "directory")
            throw new Error("Bad command or file name");
          if (/\.(EXE|COM|BAT)$/i.test(path))
            throw new Error(
              "Native DOS binaries and batch programs are not emulated. Use START to open a supported Windows application.",
            );
          await os.openFile(path);
          return "";
        }
        throw new Error(
          "Bad command or file name. Type HELP for available commands.",
        );
      }
    }
  }
  function help(name) {
    const commands = {
      DIR: "DIR [path or pattern] [/W] [/B] [/S]  Display files and directories.",
      CD: "CD [directory]  Display or change the current directory. CD .. moves up.",
      MD: "MD directory  Create a directory (parents are created when necessary).",
      RD: "RD directory [/S] [/Q]  Remove a directory; /S removes its contents.",
      COPY: "COPY source [destination] [/Y]  Copy files or a directory. Wildcards are accepted.",
      MOVE: "MOVE source destination [/Y]  Move files or a directory.",
      REN: "REN old-name new-name  Rename one file or directory.",
      DEL: "DEL file-or-pattern [/P] [/Q]  Delete files. Wildcards are accepted.",
      TYPE: "TYPE filename [filename...]  Display the contents of text files.",
      ECHO: "ECHO [ON|OFF|text]  Display text. ECHO. writes an empty line. Use > file or >> file for output.",
      CLS: "CLS  Clear the screen.",
      VER: "VER  Display the command environment version.",
      DATE: "DATE [YYYY-MM-DD]  Display or set this desktop’s virtual date.",
      TIME: "TIME [HH:MM[:SS]]  Display or set this desktop’s virtual time.",
      SET: "SET [NAME=[value]]  Display, set, or remove environment variables. %NAME% expands a value.",
      PATH: "PATH [directory;directory...]  Display or save the command path preference.",
      PROMPT:
        "PROMPT [text]  Set the prompt. $P=current path, $G=>, $D=date, $T=time.",
      TREE: "TREE [directory] [/F]  Display the directory tree; /F includes files.",
      EDIT: "EDIT [filename]  Open a virtual text file in Notepad.",
      START:
        "START [application or file]  Open a supported desktop application or file.",
      EXIT: "EXIT  Close this command window.",
      HELP: "HELP [command]  Display command help.",
    };
    if (name) return commands[name] || `No help is available for ${name}.`;
    return (
      "Available commands:\n\n" +
      Object.entries(commands)
        .map(
          ([key, value]) =>
            `${key.padEnd(8)} ${value.replace(/^[^ ]+\s*/, "")}`,
        )
        .join("\n") +
      "\n\nCommands operate on the persistent virtual C: drive. Quote paths containing spaces.\nOutput redirection (> and >>) is supported. Native binaries, batch scripts,\npipes, and host system commands are outside this command environment."
    );
  }
  async function submit(value = command.value) {
    const line = value.trim();
    if (running) return;
    command.value = "";
    if (!line) {
      print(promptText());
      return;
    }
    history.push(line);
    if (history.length > 100) history.shift();
    historyIndex = history.length;
    os.storage.set("dos-history", history);
    print(`${promptText()}${line}`);
    running = true;
    update();
    try {
      const result = await execute(line);
      if (result != null && result !== "") print(result);
    } catch (err) {
      print(err?.message || String(err));
    } finally {
      running = false;
      update();
    }
  }
  command.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      submit();
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      historyIndex = Math.max(
        0,
        Math.min(history.length, historyIndex + (e.key === "ArrowUp" ? -1 : 1)),
      );
      command.value = history[historyIndex] || "";
      requestAnimationFrame(() =>
        command.setSelectionRange(command.value.length, command.value.length),
      );
    } else if (e.key === "Escape") command.value = "";
    else if (e.key === "Tab") {
      e.preventDefault();
      const pieces = command.value.split(/\s+/),
        last = pieces.pop() || "";
      try {
        const target = resolve(last || "."),
          dir =
            last.includes("\\") || last.includes("/")
              ? os.fs.parent(target)
              : cwd,
          prefix = os.fs.basename(target).toUpperCase();
        const candidates = os.fs
          .readdir(dir)
          .filter((f) => f.name.toUpperCase().startsWith(last ? prefix : ""));
        if (candidates.length === 1) {
          const pathPrefix = /[\\/]/.test(last)
            ? last.slice(
                0,
                Math.max(last.lastIndexOf("\\"), last.lastIndexOf("/")) + 1,
              )
            : "";
          command.value = [
            ...pieces,
            pathPrefix +
              candidates[0].name +
              (candidates[0].type === "directory" ? "\\" : ""),
          ].join(" ");
        } else if (candidates.length > 1)
          print(candidates.map((f) => f.name).join("   "));
      } catch {
        /* Completion leaves an unmatched command intact. */
      }
    } else if (
      (e.ctrlKey || e.metaKey) &&
      e.key.toLowerCase() === "c" &&
      !window.getSelection()?.toString()
    ) {
      e.preventDefault();
      command.value = "";
      print("^C");
    }
  });
  screen.addEventListener("click", (e) => {
    if (!window.getSelection()?.toString()) command.focus();
  });
  ctx.setMenu([
    {
      label: "&File",
      items: [
        { label: "&New Command Window", action: () => os.open("dos", { cwd }) },
        {
          label: "&Save Transcript...",
          action: safe(os, async () => {
            const path = await os.pickFile({
              save: true,
              filename: "DOSLOG.TXT",
              initialDir: "C:\\DOCUMENTS",
            });
            if (path) os.fs.writeFile(path, buffer.join("\r\n"));
          }),
        },
        {
          label: "&Print Transcript...",
          action: () =>
            os.print(
              "MS-DOS Transcript",
              `<pre>${escapeHTML(buffer.join("\n"))}</pre>`,
            ),
        },
        { separator: true },
        { label: "E&xit", action: () => ctx.win.close() },
      ],
    },
    {
      label: "&Edit",
      items: [
        {
          label: "&Copy",
          action: () =>
            os.copyText(window.getSelection()?.toString() || buffer.join("\n")),
        },
        {
          label: "&Paste",
          action: safe(os, async () => {
            command.value += (await os.pasteText()).replace(/[\r\n]+/g, " ");
            command.focus();
          }),
        },
        {
          label: "Select &All",
          action: () => {
            const range = document.createRange();
            range.selectNodeContents(output);
            const selection = window.getSelection();
            selection.removeAllRanges();
            selection.addRange(range);
          },
        },
      ],
    },
    {
      label: "&View",
      items: [
        { label: "&Clear Screen", action: () => submit("CLS") },
        {
          label: "&Small Font",
          action: () => (screen.style.fontSize = "12px"),
        },
        {
          label: "&Normal Font",
          action: () => (screen.style.fontSize = "15px"),
        },
        {
          label: "&Large Font",
          action: () => (screen.style.fontSize = "18px"),
        },
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Commands", action: () => submit("HELP") },
        {
          label: "&About MS-DOS Prompt...",
          action: describe(
            os,
            "dos",
            "A working command interpreter for the virtual filesystem. Supports file commands, environment variables, redirection, history, and desktop application launching. It does not execute DOS binaries or access your host shell.",
          ),
        },
      ],
    },
  ]);
  print(
    "Microsoft MS-DOS Version 6.22 command workspace\nType HELP for commands. Files are stored on the local virtual disk.\n",
  );
  if (args.command) submit(args.command);
}

function createPrintManager(ctx) {
  const { os } = ctx;
  os.printJobs ||= [];
  let selected = null;
  const queue = el("div", {
    class: "pm-queue sunken",
    role: "listbox",
    tabIndex: 0,
  });
  const status = el("div", { class: "statusbar" });
  const printer = el(
    "div",
    { class: "pm-printer" },
    glyph("printers"),
    el(
      "div",
      {},
      el("strong", {}, os.settings.printerName || "Default Browser Printer"),
      el("div", { class: "pm-printer-state" }),
    ),
  );
  ctx.content.append(
    el(
      "div",
      { class: "pm-app" },
      printer,
      el(
        "div",
        { class: "toolbar" },
        button("Pause", () => pause()),
        button("Resume", () => resume()),
        button(
          "Delete",
          safe(os, () => remove()),
        ),
        button("Properties...", () => properties()),
      ),
      queue,
      status,
    ),
  );
  const get = () => os.printJobs.find((job) => job.id === selected);
  function render() {
    clear(queue);
    printer.querySelector("strong").textContent =
      os.settings.printerName || "Default Browser Printer";
    printer.querySelector(".pm-printer-state").textContent = os.settings
      .printerPaused
      ? "Printer paused"
      : "Printer ready";
    queue.append(
      el(
        "div",
        { class: "pm-row pm-heading" },
        ...["Document", "Status", "Pages", "Submitted"].map((label) =>
          el("span", {}, label),
        ),
      ),
    );
    for (const job of os.printJobs) {
      const line = el(
        "div",
        {
          class: `pm-row ${selected === job.id ? "selected" : ""}`,
          role: "option",
          "aria-selected": String(selected === job.id),
        },
        el("span", {}, job.title || "Untitled"),
        el("span", {}, job.status || "queued"),
        el("span", {}, String(job.pages || 1)),
        el("span", {}, dateText(job.created || job.timestamp)),
      );
      line.addEventListener("click", () => {
        selected = job.id;
        [...queue.querySelectorAll('[role="option"]')].forEach((n) => {
          n.classList.toggle("selected", n === line);
          n.setAttribute("aria-selected", String(n === line));
        });
        menu();
      });
      line.addEventListener("dblclick", () => {
        selected = job.id;
        properties();
      });
      queue.append(line);
    }
    if (!os.printJobs.length)
      queue.append(
        el("div", { class: "pm-empty" }, "No documents are waiting to print."),
      );
    status.textContent = `${os.printJobs.length} document(s) in queue     ${os.settings.printerPaused ? "Paused" : "Ready"}`;
    menu();
  }
  function pause() {
    const job = get();
    if (job && !["completed", "printed", "printing"].includes(job.status))
      job.status = "paused";
    else settings(os, { printerPaused: true });
    notifyPrint(os);
    render();
  }
  function resume() {
    const job = get();
    if (job && job.status === "paused") job.status = "queued";
    settings(os, { printerPaused: false });
    notifyPrint(os);
    os.resumePrintQueue?.();
    render();
  }
  async function remove() {
    const job = get();
    if (!job) return;
    if (
      await os.confirm(
        `Delete "${job.title || "Untitled"}" from the print queue?${job.status === "printing" ? "\nAn already-open browser print dialog must be canceled separately." : ""}`,
        "Print Manager",
      )
    ) {
      const at = os.printJobs.indexOf(job);
      if (at >= 0) os.printJobs.splice(at, 1);
      selected = null;
      notifyPrint(os);
      render();
    }
  }
  function properties() {
    const job = get();
    return os.dialog({
      title: job ? "Document Properties" : "Printer Properties",
      width: 410,
      body: el(
        "div",
        { class: "dialog-body" },
        glyph("printers"),
        row(
          "Printer:",
          el("span", {}, os.settings.printerName || "Default Browser Printer"),
        ),
        ...(job
          ? [
              row("Document:", el("span", {}, job.title || "Untitled")),
              row("Status:", el("span", {}, job.status || "queued")),
              row("Pages:", el("span", {}, String(job.pages || 1))),
              row("Submitted:", el("span", {}, dateText(job.created))),
            ]
          : []),
        el(
          "p",
          {},
          "Print jobs are sent to the browser print dialog. Choose the physical printer or Save as PDF in that dialog.",
        ),
      ),
      buttons: [{ label: "OK", value: true, default: true }],
    });
  }
  function menu() {
    ctx.setMenu([
      {
        label: "&Printer",
        items: [
          {
            label: "&Pause Printer",
            checked: !!os.settings.printerPaused,
            action: () => {
              settings(os, { printerPaused: !os.settings.printerPaused });
              if (!os.settings.printerPaused) os.resumePrintQueue?.();
              notifyPrint(os);
              render();
            },
          },
          {
            label: "&Resume Printer",
            action: () => {
              settings(os, { printerPaused: false });
              os.resumePrintQueue?.();
              notifyPrint(os);
              render();
            },
          },
          { separator: true },
          { label: "&Connect...", action: () => openControl(os, "printers") },
          {
            label: "Printer &Properties...",
            action: () => {
              selected = null;
              properties();
            },
          },
          { separator: true },
          { label: "E&xit", action: () => ctx.win.close() },
        ],
      },
      {
        label: "&Document",
        items: [
          {
            label: "&Pause",
            action: pause,
            disabled:
              !get() ||
              ["printing", "printed", "completed"].includes(get()?.status),
          },
          {
            label: "&Resume",
            action: resume,
            disabled: get()?.status !== "paused",
          },
          { label: "&Delete...", action: safe(os, remove), disabled: !get() },
          { label: "Propert&ies...", action: properties, disabled: !get() },
        ],
      },
      {
        label: "&View",
        items: [
          { label: "&Refresh", action: render },
          {
            label: "Remove &Completed Jobs",
            action: () => {
              os.printJobs.splice(
                0,
                os.printJobs.length,
                ...os.printJobs.filter(
                  (j) =>
                    !["printed", "completed", "canceled", "cancelled"].includes(
                      j.status,
                    ),
                ),
              );
              notifyPrint(os);
              render();
            },
          },
        ],
      },
      {
        label: "&Help",
        items: [
          {
            label: "&About Print Manager...",
            action: describe(
              os,
              "printmanager",
              "Displays the actual desktop print queue. Pause, resume, and remove queued documents. The browser handles physical printing and PDF output.",
            ),
          },
        ],
      },
    ]);
  }
  listen(ctx, os.events, "printchange", render);
  listen(ctx, os.events, "settingschange", render);
  render();
}

function createTerminal(ctx, args) {
  const { os } = ctx;
  let profile = {
    format: "windows31-browser-terminal",
    connection: "Local loopback",
    baud: 9600,
    dataBits: 8,
    parity: "None",
    stopBits: 1,
    flowControl: "None",
    localEcho: false,
    wrap: true,
    emulation: "VT100",
    portProfile: os.settings.portSettings?.COM1 ? "COM1" : "Custom",
    ...(os.settings.portSettings?.COM1 || {}),
    ...(os.settings.terminalSettings || {}),
  };
  function normalizeProfile(raw) {
    return {
      ...raw,
      format: "windows31-browser-terminal",
      connection: "Local loopback",
      baud: [
        110, 300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200,
      ].includes(+raw.baud)
        ? +raw.baud
        : 9600,
      dataBits: +raw.dataBits === 7 ? 7 : 8,
      parity: ["None", "Odd", "Even", "Mark", "Space"].includes(raw.parity)
        ? raw.parity
        : "None",
      stopBits: [1, 1.5, 2].includes(+raw.stopBits) ? +raw.stopBits : 1,
      flowControl: ["None", "Xon/Xoff", "Hardware"].includes(raw.flowControl)
        ? raw.flowControl
        : "None",
      localEcho: raw.localEcho === true,
      wrap: raw.wrap !== false,
      emulation: raw.emulation === "TTY" ? "TTY" : "VT100",
    };
  }
  profile = normalizeProfile(profile);
  let connected = false,
    transcript = "",
    profilePath = null,
    capturePath = null;
  const output = el("pre", {
    class: "term-output",
    tabIndex: 0,
    "aria-label": "Terminal display",
  });
  const line = input("", {
    class: "term-input win-input",
    spellcheck: false,
    autocomplete: "off",
    "aria-label": "Text to transmit",
  });
  const state = el("div", { class: "statusbar" });
  const connectButton = button("Connect", () => connect(!connected));
  const root = el(
    "div",
    { class: "term-app" },
    el(
      "div",
      { class: "toolbar" },
      connectButton,
      button("Communications...", safe(os, communicationSettings)),
      el("span", { class: "sys-grow" }),
      el("span", {}, "Local loopback"),
    ),
    output,
    el(
      "div",
      { class: "term-sendbar" },
      line,
      button(
        "Send",
        safe(os, () => send(line.value + "\r\n", true)),
      ),
    ),
    state,
  );
  ctx.content.append(root);
  function render() {
    output.textContent = transcript;
    output.classList.toggle("term-nowrap", !profile.wrap);
    output.scrollTop = output.scrollHeight;
    connectButton.textContent = connected ? "Disconnect" : "Connect";
    state.textContent = `${connected ? "Connected: Local loopback" : "Disconnected"}    ${profile.baud} ${profile.dataBits}-${profile.parity[0]}-${profile.stopBits}${capturePath ? "    Capturing" : ""}`;
    ctx.setTitle(
      `Terminal${profilePath ? " — " + os.fs.basename(profilePath) : ""}`,
    );
    menu();
  }
  function append(text) {
    transcript += text;
    if (transcript.length > 250000) transcript = transcript.slice(-200000);
    if (capturePath) {
      const old = os.fs.exists(capturePath) ? os.fs.readFile(capturePath) : "";
      os.fs.writeFile(capturePath, old + text);
    }
    render();
  }
  function connect(value) {
    connected = value;
    append(
      `\r\n[${value ? "Connected to local loopback. Transmitted data returns to this window." : "Disconnected."}]\r\n`,
    );
    line.focus();
  }
  async function send(text, clearInput = false) {
    if (!connected) {
      await os.message(
        "Connect to the local loopback session before transmitting.",
        "Terminal",
      );
      return;
    }
    if (clearInput) line.value = "";
    if (profile.localEcho) append(`[Local echo] ${text}`);
    append(text);
    line.focus();
  }
  function savePreferences() {
    settings(os, { terminalSettings: { ...profile } });
    render();
  }
  async function communicationSettings() {
    const baud = select(
      [110, 300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200].map(
        (n) => [n, String(n)],
      ),
      profile.baud,
    );
    const bits = select(["7", "8"], profile.dataBits),
      parity = select(["None", "Odd", "Even", "Mark", "Space"], profile.parity),
      stops = select(["1", "1.5", "2"], profile.stopBits),
      flow = select(["None", "Xon/Xoff", "Hardware"], profile.flowControl);
    const port = select(
      [
        ["Custom", "Custom"],
        ...Object.keys(os.settings.portSettings || {}).map((name) => [
          name,
          `${name} profile`,
        ]),
      ],
      profile.portProfile || "Custom",
    );
    port.addEventListener("change", () => {
      const config = os.settings.portSettings?.[port.value];
      if (!config) return;
      baud.value = String(config.baud || 9600);
      bits.value = String(config.dataBits || 8);
      parity.value = config.parity || "None";
      stops.value = String(config.stopBits || 1);
      flow.value = config.flowControl || "None";
    });
    const result = await os.dialog({
      title: "Communications",
      width: 380,
      body: el(
        "div",
        { class: "dialog-body" },
        row("Connector:", el("span", {}, "Local loopback")),
        row("Port profile:", port),
        row("Baud rate:", baud),
        row("Data bits:", bits),
        row("Parity:", parity),
        row("Stop bits:", stops),
        row("Flow control:", flow),
        el(
          "p",
          { class: "sys-note" },
          "These settings describe the saved serial profile. This session loops data back locally; it does not access a physical serial port or modem.",
        ),
      ),
      buttons: [
        { label: "OK", value: true, default: true },
        { label: "Cancel", value: false },
      ],
    });
    if (result) {
      Object.assign(profile, {
        baud: +baud.value,
        dataBits: +bits.value,
        parity: parity.value,
        stopBits: +stops.value,
        flowControl: flow.value,
        portProfile: port.value,
      });
      savePreferences();
    }
  }
  async function preferences() {
    const echo = check("Local echo", profile.localEcho),
      wrap = check("Wrap lines at the window edge", profile.wrap),
      emulation = select(["VT100", "TTY"], profile.emulation);
    if (
      await os.dialog({
        title: "Terminal Preferences",
        width: 350,
        body: el(
          "div",
          { class: "dialog-body" },
          row("Terminal:", emulation),
          echo.node,
          wrap.node,
          el(
            "p",
            { class: "sys-note" },
            "The display accepts plain text. The terminal type is stored with this profile; escape-sequence graphics are not emulated.",
          ),
        ),
        buttons: [
          { label: "OK", value: true, default: true },
          { label: "Cancel", value: false },
        ],
      })
    ) {
      Object.assign(profile, {
        localEcho: echo.control.checked,
        wrap: wrap.control.checked,
        emulation: emulation.value,
      });
      savePreferences();
    }
  }
  async function saveProfile(saveAs = false) {
    const path =
      (!saveAs && profilePath) ||
      (await os.pickFile({
        save: true,
        filename: "TERMINAL.TRM",
        initialDir: "C:\\DOCUMENTS",
        filter: ".TRM",
      }));
    if (path) {
      os.fs.writeFile(path, JSON.stringify(profile, null, 2));
      profilePath = path;
      render();
    }
  }
  function loadProfile(path) {
    const data = JSON.parse(os.fs.readFile(path));
    if (data?.format !== "windows31-browser-terminal")
      throw new Error("This is not a browser Terminal profile.");
    profile = normalizeProfile({ ...profile, ...data });
    profilePath = path;
    render();
  }
  async function transmitFile(importHost = false) {
    if (!connected) {
      await os.message("Connect to the local loopback first.", "Terminal");
      return;
    }
    if (importHost) {
      const files = await chooseHostFiles("", true);
      for (const file of files) {
        const data = await readHostFile(file);
        const path = join(os, "C:\\DOCUMENTS", file.name);
        if (
          !os.fs.exists(path) ||
          (await os.confirm(`Replace ${file.name}?`, "Import File"))
        )
          os.fs.writeFile(path, data);
        await send(data + "\r\n");
      }
    } else {
      const path = await os.pickFile({
        title: "Send Text File",
        initialDir: "C:\\DOCUMENTS",
      });
      if (path) await send(os.fs.readFile(path) + "\r\n");
    }
  }
  async function transferFile() {
    if (!connected) {
      await os.message("Connect to the local loopback first.", "Terminal");
      return;
    }
    const source = await os.pickFile({
      title: "Choose File to Transfer",
      initialDir: "C:\\DOCUMENTS",
    });
    if (!source) return;
    const target = await os.pickFile({
      title: "Receive Local Transfer As",
      save: true,
      filename: os.fs.basename(source),
      initialDir: "C:\\TEMP",
    });
    if (!target) return;
    if (source === target)
      throw new Error("Choose a different destination for the received file.");
    const data = os.fs.readFile(source);
    os.fs.writeFile(target, data);
    append(
      `\r\n[Local transfer complete: ${os.fs.basename(source)}, ${bytes(os.fs.stat(source).size)} → ${target}]\r\n`,
    );
  }
  async function capture() {
    if (capturePath) {
      capturePath = null;
      render();
      return;
    }
    const target = await os.pickFile({
      title: "Receive Text File",
      save: true,
      filename: "RECEIVE.TXT",
      initialDir: "C:\\DOCUMENTS",
    });
    if (target) {
      os.fs.writeFile(target, "");
      capturePath = target;
      render();
    }
  }
  function menu() {
    ctx.setMenu([
      {
        label: "&File",
        items: [
          {
            label: "&New",
            action: () => {
              profilePath = null;
              transcript = "";
              render();
            },
          },
          {
            label: "&Open...",
            action: safe(os, async () => {
              const path = await os.pickFile({
                title: "Open Terminal Profile",
                filter: ".TRM",
              });
              if (path) loadProfile(path);
            }),
          },
          { label: "&Save", action: safe(os, () => saveProfile()) },
          { label: "Save &As...", action: safe(os, () => saveProfile(true)) },
          { separator: true },
          {
            label: "&Print...",
            action: () =>
              os.print(
                "Terminal Transcript",
                `<pre>${escapeHTML(transcript)}</pre>`,
              ),
          },
          { label: "E&xit", action: () => ctx.win.close() },
        ],
      },
      {
        label: "&Edit",
        items: [
          {
            label: "&Copy",
            action: () =>
              os.copyText(window.getSelection()?.toString() || transcript),
          },
          {
            label: "&Paste",
            action: safe(os, async () => {
              line.value += await os.pasteText();
              line.focus();
            }),
          },
          {
            label: "&Clear Buffer",
            action: () => {
              transcript = "";
              render();
            },
          },
        ],
      },
      {
        label: "&Settings",
        items: [
          {
            label: "&Communications...",
            action: safe(os, communicationSettings),
          },
          { label: "&Terminal Preferences...", action: safe(os, preferences) },
        ],
      },
      {
        label: "&Phone",
        items: [
          {
            label: "&Connect Local Loopback",
            action: () => connect(true),
            disabled: connected,
          },
          {
            label: "&Disconnect",
            action: () => connect(false),
            disabled: !connected,
          },
        ],
      },
      {
        label: "&Transfers",
        items: [
          {
            label: "Send &Text File...",
            action: safe(os, () => transmitFile(false)),
          },
          {
            label: "&Import and Transmit...",
            action: safe(os, () => transmitFile(true)),
          },
          { label: "&Local File Transfer...", action: safe(os, transferFile) },
          { separator: true },
          {
            label: capturePath
              ? "S&top Receiving Text"
              : "&Receive Text File...",
            checked: !!capturePath,
            action: safe(os, capture),
          },
          {
            label: "&Save Current Buffer...",
            action: safe(os, async () => {
              const path = await os.pickFile({
                save: true,
                filename: "TERMINAL.TXT",
                initialDir: "C:\\DOCUMENTS",
              });
              if (path) os.fs.writeFile(path, transcript);
            }),
          },
        ],
      },
      {
        label: "&Help",
        items: [
          {
            label: "&Terminal Help",
            action: () =>
              os.message(
                "Choose Phone → Connect Local Loopback, type text, and press Enter. The transmitted text returns to the terminal. Transfers can send a virtual file, import a host file, copy a file through the local connection, or capture received text into a virtual file. Communications settings are saved with .TRM profiles.",
                "Terminal Help",
              ),
          },
          {
            label: "&About Terminal...",
            action: describe(
              os,
              "terminal",
              "A local loopback serial workspace with saved profiles, local echo, text transmission, capture, and file transfer. Physical serial devices, remote hosts, and modem calls are not connected.",
            ),
          },
        ],
      },
    ]);
  }
  line.addEventListener(
    "keydown",
    safe(os, (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        return send(line.value + "\r\n", true);
      }
    }),
  );
  if (args.path) {
    try {
      loadProfile(args.path);
    } catch (err) {
      os.message(err.message, "Terminal");
    }
  }
  append(
    "Terminal\r\nLocal loopback communications workspace. Choose Connect to begin.\r\n",
  );
}

function createPIFEditor(ctx, args) {
  const { os } = ctx;
  const defaults = {
    format: "windows31-browser-pif",
    program: "NOTEPAD.EXE",
    title: "Untitled",
    parameters: "",
    workingDirectory: "C:\\DOCUMENTS",
    memoryRequired: 128,
    memoryDesired: 640,
    display: "Windowed",
    closeOnExit: true,
    background: true,
    exclusive: false,
    emsRequired: 0,
    emsDesired: 0,
    xmsRequired: 0,
    xmsDesired: 1024,
    shortcut: "",
  };
  let profile = { ...defaults },
    path = null,
    dirty = false;
  const program = input(),
    title = input(),
    parameters = input(),
    directory = input(),
    required = input("", { type: "number", min: 0, max: 65535 }),
    desired = input("", { type: "number", min: 0, max: 65535 });
  const display = select(["Windowed", "Full screen"], "Windowed"),
    closeOnExit = check("Close window on exit", true),
    background = check("Allow background activity", true),
    exclusive = check("Exclusive execution preference");
  const status = el("div", { class: "statusbar" });
  const root = el(
    "div",
    { class: "pif-app" },
    el(
      "div",
      { class: "pif-form" },
      row(
        "Program Filename:",
        el(
          "div",
          { class: "sys-inline" },
          program,
          button(
            "Browse...",
            safe(os, async () => {
              const file = await os.pickFile({
                title: "Choose Program or Document",
                initialDir: "C:\\WINDOWS",
              });
              if (file) {
                program.value = file;
                mark();
              }
            }),
          ),
        ),
      ),
      row("Window Title:", title),
      row("Optional Parameters:", parameters),
      row("Startup Directory:", directory),
      el(
        "fieldset",
        {},
        el("legend", {}, "Memory Requirements"),
        row("KB Required:", required),
        row("KB Desired:", desired),
      ),
      el(
        "div",
        { class: "sys-columns" },
        el(
          "fieldset",
          {},
          el("legend", {}, "Display Usage"),
          display,
          closeOnExit.node,
        ),
        el(
          "fieldset",
          {},
          el("legend", {}, "Execution"),
          background.node,
          exclusive.node,
        ),
      ),
      el(
        "div",
        { class: "pif-actions" },
        button("Advanced...", safe(os, advanced)),
        button(
          "Save",
          safe(os, () => save()),
        ),
        button("Run", safe(os, run)),
      ),
      el(
        "p",
        { class: "sys-note" },
        "This PIF is a saved browser launch profile. Memory, display, and scheduling preferences are preserved; a DOS virtual machine is not emulated.",
      ),
    ),
    status,
  );
  ctx.content.append(root);
  function mark() {
    dirty = true;
    status.textContent = "Modified";
    ctx.setTitle(`PIF Editor — ${path ? os.fs.basename(path) : "Untitled"} *`);
  }
  function read() {
    if (+required.value < 0 || +desired.value < +required.value)
      throw new Error("Desired memory must be at least the required memory.");
    return {
      ...profile,
      program: program.value.trim(),
      title: title.value.trim(),
      parameters: parameters.value,
      workingDirectory: directory.value || "C:\\",
      memoryRequired: +required.value,
      memoryDesired: +desired.value,
      display: display.value,
      closeOnExit: closeOnExit.control.checked,
      background: background.control.checked,
      exclusive: exclusive.control.checked,
    };
  }
  function fill() {
    program.value = profile.program;
    title.value = profile.title;
    parameters.value = profile.parameters;
    directory.value = profile.workingDirectory;
    required.value = profile.memoryRequired;
    desired.value = profile.memoryDesired;
    display.value = profile.display;
    closeOnExit.control.checked = !!profile.closeOnExit;
    background.control.checked = !!profile.background;
    exclusive.control.checked = !!profile.exclusive;
    dirty = false;
    ctx.setTitle(`PIF Editor — ${path ? os.fs.basename(path) : "Untitled"}`);
    status.textContent = path || "Untitled launch profile";
  }
  async function advanced() {
    const emsRequired = input(profile.emsRequired, {
        type: "number",
        min: 0,
        max: 65535,
      }),
      emsDesired = input(profile.emsDesired, {
        type: "number",
        min: 0,
        max: 65535,
      }),
      xmsRequired = input(profile.xmsRequired, {
        type: "number",
        min: 0,
        max: 65535,
      }),
      xmsDesired = input(profile.xmsDesired, {
        type: "number",
        min: 0,
        max: 65535,
      }),
      shortcut = input(profile.shortcut, {
        placeholder: "Example: Ctrl+Alt+N",
      });
    if (
      await os.dialog({
        title: "Advanced PIF Settings",
        width: 410,
        body: el(
          "div",
          { class: "dialog-body" },
          el(
            "fieldset",
            {},
            el("legend", {}, "Expanded Memory (EMS)"),
            row("KB Required:", emsRequired),
            row("KB Desired:", emsDesired),
          ),
          el(
            "fieldset",
            {},
            el("legend", {}, "Extended Memory (XMS)"),
            row("KB Required:", xmsRequired),
            row("KB Desired:", xmsDesired),
          ),
          row("Shortcut preference:", shortcut),
          el(
            "p",
            { class: "sys-note" },
            "These values are stored in the PIF for reference. Browser launch profiles do not allocate DOS memory or install global hotkeys.",
          ),
        ),
        buttons: [
          { label: "OK", value: true, default: true },
          { label: "Cancel", value: false },
        ],
      })
    ) {
      if (
        +emsDesired.value < +emsRequired.value ||
        +xmsDesired.value < +xmsRequired.value
      )
        throw new Error("Desired memory must be at least required memory.");
      Object.assign(profile, {
        emsRequired: +emsRequired.value,
        emsDesired: +emsDesired.value,
        xmsRequired: +xmsRequired.value,
        xmsDesired: +xmsDesired.value,
        shortcut: shortcut.value,
      });
      mark();
    }
  }
  async function save(saveAs = false) {
    const data = read();
    const target =
      (!saveAs && path) ||
      (await os.pickFile({
        title: "Save PIF",
        save: true,
        filename: "UNTITLED.PIF",
        initialDir: "C:\\WINDOWS",
        filter: ".PIF",
      }));
    if (!target) return false;
    os.fs.writeFile(target, JSON.stringify(data, null, 2));
    profile = data;
    path = target;
    fill();
    return true;
  }
  async function allowDiscard() {
    if (!dirty) return true;
    const answer = await os.dialog({
      title: "PIF Editor",
      body: "Save changes to this PIF?",
      buttons: [
        { label: "Yes", value: "save", default: true },
        { label: "No", value: "discard" },
        { label: "Cancel", value: "cancel" },
      ],
    });
    return answer === "save" ? save() : answer === "discard";
  }
  function load(target) {
    const data = JSON.parse(os.fs.readFile(target));
    if (data.format !== "windows31-browser-pif")
      throw new Error(
        "This file is not a browser PIF launch profile. Native binary PIF files are not supported.",
      );
    profile = { ...defaults, ...data };
    path = target;
    fill();
  }
  async function run() {
    const data = read();
    if (!data.program) throw new Error("Enter a program filename.");
    const candidate = cleanPath(os, data.program, data.workingDirectory);
    if (os.fs.exists(candidate) && !/\.(EXE|COM|BAT)$/i.test(candidate))
      await os.openFile(candidate);
    else
      await os.run(
        `${/\s/.test(data.program) ? '"' + data.program + '"' : data.program}${data.parameters ? " " + data.parameters : ""}`,
      );
    status.textContent = `Launched ${data.title || data.program}`;
  }
  root.addEventListener("input", mark);
  root.addEventListener("change", mark);
  ctx.setMenu([
    {
      label: "&File",
      items: [
        {
          label: "&New",
          action: safe(os, async () => {
            if (await allowDiscard()) {
              profile = { ...defaults };
              path = null;
              fill();
            }
          }),
        },
        {
          label: "&Open...",
          action: safe(os, async () => {
            if (!(await allowDiscard())) return;
            const target = await os.pickFile({
              title: "Open PIF",
              filter: ".PIF",
            });
            if (target) load(target);
          }),
        },
        { label: "&Save", shortcut: "Ctrl+S", action: safe(os, () => save()) },
        { label: "Save &As...", action: safe(os, () => save(true)) },
        { separator: true },
        { label: "&Run", action: safe(os, run) },
        { label: "E&xit", action: () => ctx.win.close() },
      ],
    },
    {
      label: "&Options",
      items: [
        { label: "&Advanced...", action: safe(os, advanced) },
        {
          label: "&Reset to Defaults",
          action: safe(os, async () => {
            if (
              await os.confirm(
                "Reset all PIF values to their defaults?",
                "PIF Editor",
              )
            ) {
              profile = { ...defaults };
              fill();
              mark();
            }
          }),
        },
      ],
    },
    {
      label: "&Help",
      items: [
        {
          label: "&About PIF Editor...",
          action: describe(
            os,
            "pifeditor",
            "Edit and save browser PIF launch profiles, then launch supported applications and documents. DOS memory and scheduling options are retained as profile data; native binary PIF and DOS executable formats are not interpreted.",
          ),
        },
      ],
    },
  ]);
  ctx.onClose(allowDiscard);
  fill();
  if (args.path) {
    try {
      load(args.path);
    } catch (err) {
      os.message(err.message, "PIF Editor");
    }
  }
}

function createSetup(ctx) {
  const { os } = ctx;
  let selected = "notepad";
  const systemInfo = el("div", { class: "setup-system sunken" });
  const inventory = el("div", {
    class: "setup-inventory sunken",
    role: "listbox",
    "aria-label": "Installed applications",
  });
  const status = el("div", { class: "statusbar" });
  function report() {
    return `Microsoft Windows Version 3.1\nBrowser Desktop Setup\n\nDisplay: ${os.renderer?.backend || "Browser graphics"}\nKeyboard: Browser keyboard\nMouse: Browser pointing device\nPrinter: ${os.settings.printerName || "Default Browser Printer"}\nVirtual Disk: C:\\\n\nInstalled Applications\n${[
      ...os.apps.values(),
    ]
      .map((app) => `${app.title} (${app.id})`)
      .sort()
      .join("\n")}\n`;
  }
  function render() {
    clear(systemInfo);
    systemInfo.append(
      row(
        "Display:",
        el("span", {}, os.renderer?.backend || "Browser graphics"),
      ),
      row("Keyboard:", el("span", {}, "Browser keyboard")),
      row("Mouse:", el("span", {}, "Browser pointing device")),
      row(
        "Printer:",
        el("span", {}, os.settings.printerName || "Default Browser Printer"),
      ),
      row("Windows directory:", el("span", {}, "C:\\WINDOWS")),
    );
    clear(inventory);
    for (const app of [...os.apps.values()].sort((a, b) =>
      a.title.localeCompare(b.title),
    )) {
      const item = el(
        "div",
        {
          class: `setup-item ${selected === app.id ? "selected" : ""}`,
          role: "option",
          "aria-selected": String(selected === app.id),
          tabIndex: 0,
        },
        icon(app.icon || app.id, 24),
        el("span", {}, app.title),
        el("span", { class: "setup-id" }, `${app.id.toUpperCase()}.EXE`),
      );
      item.addEventListener("click", () => {
        selected = app.id;
        [...inventory.children].forEach((n) => {
          n.classList.toggle("selected", n === item);
          n.setAttribute("aria-selected", String(n === item));
        });
      });
      item.addEventListener("dblclick", () => os.open(app.id));
      item.addEventListener("keydown", (e) => {
        if (e.key === "Enter") os.open(app.id);
      });
      inventory.append(item);
    }
    status.textContent = `${os.apps.size} Windows applications installed`;
  }
  const root = el(
    "div",
    { class: "setup-app" },
    el(
      "div",
      { class: "setup-banner" },
      glyph("desktop"),
      el(
        "div",
        {},
        el("strong", {}, "Microsoft Windows 3.1"),
        el("div", {}, "Current System Settings"),
      ),
    ),
    systemInfo,
    el(
      "div",
      { class: "toolbar" },
      button("Change System Settings...", () => os.open("control")),
      button("Printer Setup...", () => openControl(os, "printers")),
    ),
    el("div", { class: "setup-label" }, "Installed Applications:"),
    inventory,
    el(
      "div",
      { class: "setup-actions" },
      button("Run Application", () => {
        if (selected) os.open(selected);
      }),
      button("Save Report...", safe(os, saveReport)),
    ),
    status,
  );
  ctx.content.append(root);
  async function saveReport() {
    const path = await os.pickFile({
      save: true,
      filename: "SETUP.TXT",
      initialDir: "C:\\DOCUMENTS",
    });
    if (path) os.fs.writeFile(path, report());
  }
  ctx.setMenu([
    {
      label: "&Options",
      items: [
        {
          label: "&Change System Settings...",
          action: () => os.open("control"),
        },
        {
          label: "Set Up &Applications...",
          action: () => {
            inventory.focus();
            inventory.scrollIntoView({ block: "nearest" });
            os.message(
              "The application list shows all installed desktop components. Select an application and choose Run Application, or double-click it to open it. Additional native Windows executables cannot be installed in this browser environment.",
              "Set Up Applications",
            );
          },
        },
        {
          label: "&Printer Setup...",
          action: () => openControl(os, "printers"),
        },
        { label: "&Save System Report...", action: safe(os, saveReport) },
        { separator: true },
        { label: "E&xit", action: () => ctx.win.close() },
      ],
    },
    {
      label: "&View",
      items: [
        { label: "&Refresh", action: render },
        {
          label: "&Print System Report...",
          action: () =>
            os.print(
              "Windows Setup Report",
              `<pre>${escapeHTML(report())}</pre>`,
            ),
        },
      ],
    },
    {
      label: "&Help",
      items: [
        {
          label: "&About Windows Setup...",
          action: describe(
            os,
            "setup",
            "Review the current browser desktop configuration and registered application inventory. Open Control Panel to change supported settings. Browser-provided devices do not load native Windows drivers.",
          ),
        },
      ],
    },
  ]);
  listen(ctx, os.events, "settingschange", render);
  render();
}

function createRegistryEditor(ctx, args) {
  const { os } = ctx;
  let selected = Object.keys(os.settings)[0] || "",
    path = null,
    filter = "";
  const list = el("div", {
    class: "reg-list sunken",
    role: "listbox",
    "aria-label": "Settings values",
  });
  const keyInput = input("", { "aria-label": "Key" }),
    valueInput = el("textarea", {
      class: "win-input reg-value",
      rows: 3,
      spellcheck: false,
      "aria-label": "Value as JSON or text",
    });
  const status = el("div", { class: "statusbar" });
  const tree = el(
    "div",
    { class: "reg-tree sunken" },
    el("div", {}, glyph("drivers", 16), "Registration Database"),
    el("div", { class: "reg-branch selected" }, "HKEY_CURRENT_USER"),
    el("div", { class: "reg-leaf" }, "Desktop Settings"),
  );
  ctx.content.append(
    el(
      "div",
      { class: "reg-app" },
      el("div", { class: "reg-panes" }, tree, list),
      el(
        "div",
        { class: "reg-editor" },
        row("Key:", keyInput),
        row("Value:", valueInput),
        el(
          "div",
          { class: "reg-actions" },
          button("Add / Update", safe(os, applyValue)),
          button("Delete", safe(os, removeValue)),
        ),
      ),
      status,
    ),
  );
  function displayValue(v) {
    return typeof v === "string" ? v : JSON.stringify(v);
  }
  function render() {
    clear(list);
    list.append(
      el(
        "div",
        { class: "reg-row reg-heading" },
        el("span", {}, "Name"),
        el("span", {}, "Data"),
        el("span", {}, "Type"),
      ),
    );
    for (const key of Object.keys(os.settings)
      .sort()
      .filter(
        (k) => !filter || k.toLowerCase().includes(filter.toLowerCase()),
      )) {
      const val = os.settings[key],
        item = el(
          "div",
          {
            class: `reg-row ${selected === key ? "selected" : ""}`,
            role: "option",
            "aria-selected": String(selected === key),
            tabIndex: 0,
          },
          el("span", {}, key),
          el("span", {}, displayValue(val)),
          el(
            "span",
            {},
            Array.isArray(val) ? "array" : val === null ? "null" : typeof val,
          ),
        );
      item.addEventListener("click", () => {
        selected = key;
        fill();
        [...list.querySelectorAll('[role="option"]')].forEach((n) => {
          n.classList.toggle("selected", n === item);
          n.setAttribute("aria-selected", String(n === item));
        });
      });
      item.addEventListener("dblclick", () => {
        selected = key;
        fill();
        valueInput.focus();
        valueInput.select();
      });
      list.append(item);
    }
    status.textContent = `${Object.keys(os.settings).length} setting(s)${filter ? `   Find: ${filter}` : ""}   Changes apply to this desktop`;
    ctx.setTitle(
      `Registration Info Editor${path ? " — " + os.fs.basename(path) : ""}`,
    );
  }
  function fill() {
    keyInput.value = selected;
    valueInput.value = Object.hasOwn(os.settings, selected)
      ? JSON.stringify(os.settings[selected], null, 2)
      : "";
  }
  function validKey(key) {
    if (!key || ["__proto__", "prototype", "constructor"].includes(key))
      throw new Error("Enter a valid setting name.");
  }
  function parseValue(text) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  function applyValue() {
    const key = keyInput.value.trim();
    validKey(key);
    os.settings[key] = parseValue(valueInput.value);
    selected = key;
    settings(os, {});
    fill();
    render();
  }
  async function removeValue() {
    const key = keyInput.value.trim() || selected;
    if (!Object.hasOwn(os.settings, key)) return;
    if (
      await os.confirm(
        `Delete the setting "${key}"?`,
        "Registration Info Editor",
      )
    ) {
      delete os.settings[key];
      selected = "";
      settings(os, {});
      fill();
      render();
    }
  }
  async function save(saveAs = false) {
    const target =
      (!saveAs && path) ||
      (await os.pickFile({
        title: "Save Registration Settings",
        save: true,
        filename: "SETTINGS.REG",
        initialDir: "C:\\WINDOWS",
        filter: ".REG",
      }));
    if (target) {
      os.fs.writeFile(target, JSON.stringify(os.settings, null, 2));
      path = target;
      render();
    }
  }
  async function merge(target) {
    const data = JSON.parse(os.fs.readFile(target));
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error(
        "The registration file must contain a JSON object of setting names and values.",
      );
    Object.keys(data).forEach(validKey);
    if (
      !(await os.confirm(
        `Merge ${Object.keys(data).length} setting(s) from ${os.fs.basename(target)} into the current desktop settings?`,
        "Merge Registration File",
      ))
    )
      return;
    settings(os, data);
    path = target;
    selected = Object.keys(data)[0] || "";
    fill();
    render();
  }
  ctx.win.openFile = safe(os, merge);
  ctx.setMenu([
    {
      label: "&Registration",
      items: [
        {
          label: "&Merge Registration File...",
          action: safe(os, async () => {
            const file = await os.pickFile({
              title: "Merge Registration File",
              filter: ".REG,.JSON",
            });
            if (file) await merge(file);
          }),
        },
        { label: "&Save Registration File", action: safe(os, () => save()) },
        { label: "Save &As...", action: safe(os, () => save(true)) },
        {
          label: "&Export to Computer...",
          action: () =>
            download(
              "SETTINGS.REG",
              JSON.stringify(os.settings, null, 2),
              "application/json",
            ),
        },
        { separator: true },
        {
          label: "&Print...",
          action: () =>
            os.print(
              "Registration Settings",
              `<pre>${escapeHTML(JSON.stringify(os.settings, null, 2))}</pre>`,
            ),
        },
        { label: "E&xit", action: () => ctx.win.close() },
      ],
    },
    {
      label: "&Edit",
      items: [
        {
          label: "&New Key",
          action: () => {
            selected = "";
            fill();
            keyInput.focus();
          },
        },
        {
          label: "&Modify Value",
          action: () => {
            valueInput.focus();
            valueInput.select();
          },
        },
        { label: "&Delete Key...", action: safe(os, removeValue) },
        { separator: true },
        {
          label: "&Find...",
          action: safe(os, async () => {
            const value = await os.prompt(
              "Find",
              "Setting name contains:",
              filter,
            );
            if (value !== null) {
              filter = value;
              render();
            }
          }),
        },
        { label: "&Copy Value", action: () => os.copyText(valueInput.value) },
      ],
    },
    {
      label: "&View",
      items: [
        {
          label: "&Refresh",
          action: () => {
            filter = "";
            render();
          },
        },
      ],
    },
    {
      label: "&Help",
      items: [
        {
          label: "&About Registration Info Editor...",
          action: describe(
            os,
            "regedit",
            "Edit the actual desktop settings, stored as JSON keys and values. Add, update, remove, merge, and export settings. Only settings implemented by this desktop affect behavior; unknown keys are preserved. Native Windows registry hives are not loaded.",
          ),
        },
      ],
    },
  ]);
  listen(ctx, os.events, "settingschange", render);
  fill();
  render();
  if (args.path) safe(os, () => merge(args.path))();
}

function createPackager(ctx, args) {
  const { os } = ctx;
  const defaults = {
    format: "windows31-browser-package",
    label: "Package",
    icon: "packager",
    mode: "link",
    source: "",
    command: "",
    content: null,
  };
  let object = { ...defaults },
    path = null,
    dirty = false;
  const labelInput = input("Package"),
    pathInput = input("", { readonly: true }),
    appearance = el("button", {
      class: "pkg-preview sunken",
      type: "button",
      title: "Activate package",
    }),
    contentView = el("div", { class: "pkg-content sunken" }),
    mode = select(
      [
        ["link", "Link to file"],
        ["embed", "Embed file contents"],
        ["command", "Command line"],
      ],
      "link",
    ),
    status = el("div", { class: "statusbar" });
  const root = el(
    "div",
    { class: "pkg-app" },
    el(
      "div",
      { class: "pkg-panes" },
      el(
        "fieldset",
        {},
        el("legend", {}, "Appearance"),
        appearance,
        row("Label:", labelInput),
        button("Change Icon...", safe(os, changeIcon)),
      ),
      el(
        "fieldset",
        {},
        el("legend", {}, "Contents"),
        row("Type:", mode),
        pathInput,
        contentView,
        el(
          "div",
          { class: "pkg-actions" },
          button("Insert File...", safe(os, insertFile)),
          button("Command Line...", safe(os, commandLine)),
        ),
      ),
    ),
    el(
      "div",
      { class: "pkg-actions" },
      button("Activate", safe(os, activate)),
      button(
        "Save",
        safe(os, () => save()),
      ),
      button("Import File...", safe(os, importFile)),
    ),
    status,
  );
  ctx.content.append(root);
  function mark() {
    dirty = true;
    render();
  }
  function render() {
    clear(appearance);
    appearance.append(
      icon(object.icon || "packager", 32),
      el("span", {}, object.label || "Package"),
    );
    labelInput.value = object.label;
    pathInput.value =
      object.mode === "command" ? object.command : object.source;
    mode.value = object.mode;
    contentView.textContent =
      object.mode === "command"
        ? `Command:\n${object.command || "(none)"}`
        : object.source
          ? `${object.mode === "embed" ? "Embedded copy" : "Linked file"}\n${object.source}${object.mode === "embed" ? `\n${bytes(new Blob([object.content || ""]).size)}` : ""}`
          : "No contents.\nChoose Insert File or Command Line.";
    ctx.setTitle(
      `Object Packager — ${path ? os.fs.basename(path) : "Untitled"}${dirty ? " *" : ""}`,
    );
    status.textContent =
      path ||
      (object.mode === "embed"
        ? "File contents travel with this package"
        : "Package is stored on the virtual disk");
  }
  async function insertFile() {
    const file = await os.pickFile({
      title: "Insert File",
      initialDir: "C:\\DOCUMENTS",
    });
    if (!file) return;
    object.source = file;
    object.label = os.fs.basename(file);
    if (object.mode === "command") object.mode = "link";
    object.content = object.mode === "embed" ? os.fs.readFile(file) : null;
    mark();
  }
  async function importFile() {
    const files = await chooseHostFiles("", false);
    if (!files.length) return;
    const file = files[0];
    object = {
      ...object,
      mode: "embed",
      source: join(os, "C:\\DOCUMENTS", file.name),
      label: file.name,
      content: await readHostFile(file),
    };
    mark();
  }
  async function commandLine() {
    const command = await os.prompt(
      "Command Line",
      "Command:",
      object.command || "NOTEPAD.EXE",
    );
    if (command !== null) {
      object.command = command;
      object.mode = "command";
      if (object.label === "Package") object.label = command.split(" ")[0];
      mark();
    }
  }
  async function changeIcon() {
    let selected = object.icon;
    const grid = el("div", { class: "pkg-icon-grid sunken" });
    for (const app of os.apps.values()) {
      const b = button(
        "",
        () => {
          selected = app.id;
          [...grid.children].forEach((n) =>
            n.classList.toggle("selected", n.dataset.app === selected),
          );
        },
        {
          class: `pkg-icon-choice ${selected === app.id ? "selected" : ""}`,
          title: app.title,
          "data-app": app.id,
        },
      );
      b.append(icon(app.icon || app.id, 32));
      grid.append(b);
    }
    if (
      await os.dialog({
        title: "Change Icon",
        width: 350,
        body: el(
          "div",
          { class: "dialog-body" },
          el("p", {}, "Select an icon for this package:"),
          grid,
        ),
        buttons: [
          { label: "OK", value: true, default: true },
          { label: "Cancel", value: false },
        ],
      })
    ) {
      object.icon = selected;
      mark();
    }
  }
  async function activate() {
    if (object.mode === "command") {
      if (!object.command) throw new Error("Enter a command line.");
      return os.run(object.command);
    }
    if (!object.source)
      throw new Error("Insert a file into this package first.");
    if (object.mode === "link") {
      if (!os.fs.exists(object.source))
        throw new Error("The linked file no longer exists.");
      return os.openFile(object.source);
    }
    os.fs.mkdir("C:\\TEMP\\PACKAGES", { recursive: true });
    const target = join(
      os,
      "C:\\TEMP\\PACKAGES",
      os.fs.basename(object.source),
    );
    os.fs.writeFile(target, object.content || "");
    return os.openFile(target);
  }
  async function save(saveAs = false) {
    const target =
      (!saveAs && path) ||
      (await os.pickFile({
        title: "Save Package",
        save: true,
        filename: "PACKAGE.PKG",
        initialDir: "C:\\DOCUMENTS",
        filter: ".PKG",
      }));
    if (!target) return false;
    os.fs.writeFile(target, JSON.stringify(object, null, 2));
    path = target;
    dirty = false;
    render();
    return true;
  }
  function load(target) {
    const data = JSON.parse(os.fs.readFile(target));
    if (data.format !== "windows31-browser-package")
      throw new Error("This file is not a browser object package.");
    object = { ...defaults, ...data };
    path = target;
    dirty = false;
    render();
  }
  async function allowDiscard() {
    if (!dirty) return true;
    const result = await os.dialog({
      title: "Object Packager",
      body: "Save changes to this package?",
      buttons: [
        { label: "Yes", value: "save", default: true },
        { label: "No", value: "discard" },
        { label: "Cancel", value: "cancel" },
      ],
    });
    return result === "save" ? save() : result === "discard";
  }
  labelInput.addEventListener("input", () => {
    object.label = labelInput.value;
    dirty = true;
    appearance.lastElementChild.textContent = object.label;
    ctx.setTitle(
      `Object Packager — ${path ? os.fs.basename(path) : "Untitled"} *`,
    );
  });
  mode.addEventListener(
    "change",
    safe(os, async () => {
      object.mode = mode.value;
      if (object.mode === "embed" && object.source && object.content === null) {
        if (!os.fs.exists(object.source))
          throw new Error("The source file does not exist.");
        object.content = os.fs.readFile(object.source);
      }
      if (object.mode === "command" && !object.command) await commandLine();
      mark();
    }),
  );
  appearance.addEventListener("click", safe(os, activate));
  root.addEventListener("dragover", (e) => e.preventDefault());
  root.addEventListener(
    "drop",
    safe(os, async (e) => {
      e.preventDefault();
      const file = e.dataTransfer?.files?.[0];
      if (file) {
        object = {
          ...object,
          mode: "embed",
          source: join(os, "C:\\DOCUMENTS", file.name),
          label: file.name,
          content: await readHostFile(file),
        };
        mark();
      }
    }),
  );
  ctx.setMenu([
    {
      label: "&File",
      items: [
        {
          label: "&New",
          action: safe(os, async () => {
            if (await allowDiscard()) {
              object = { ...defaults };
              path = null;
              dirty = false;
              render();
            }
          }),
        },
        {
          label: "&Open...",
          action: safe(os, async () => {
            if (!(await allowDiscard())) return;
            const target = await os.pickFile({
              title: "Open Package",
              filter: ".PKG",
            });
            if (target) load(target);
          }),
        },
        { label: "&Save", shortcut: "Ctrl+S", action: safe(os, () => save()) },
        { label: "Save &As...", action: safe(os, () => save(true)) },
        { separator: true },
        {
          label: "&Export Package...",
          action: () =>
            download(
              path ? os.fs.basename(path) : "PACKAGE.PKG",
              JSON.stringify(object, null, 2),
              "application/json",
            ),
        },
        { label: "E&xit", action: () => ctx.win.close() },
      ],
    },
    {
      label: "&Edit",
      items: [
        {
          label: "&Copy Package",
          action: () => os.copyText(JSON.stringify(object, null, 2)),
        },
        {
          label: "&Paste Package",
          action: safe(os, async () => {
            const data = JSON.parse(await os.pasteText());
            if (data.format !== "windows31-browser-package")
              throw new Error("The clipboard does not contain a package.");
            object = { ...defaults, ...data };
            mark();
          }),
        },
      ],
    },
    {
      label: "&Object",
      items: [
        { label: "&Insert File...", action: safe(os, insertFile) },
        { label: "&Import File...", action: safe(os, importFile) },
        { label: "&Command Line...", action: safe(os, commandLine) },
        { label: "Change &Icon...", action: safe(os, changeIcon) },
        { separator: true },
        { label: "&Activate", action: safe(os, activate) },
      ],
    },
    {
      label: "&Help",
      items: [
        {
          label: "&About Object Packager...",
          action: describe(
            os,
            "packager",
            "Create persistent packages containing an embedded file, a link to a virtual file, or a desktop command. Choose an icon and label, then activate the object. Packages are portable JSON .PKG files; native OLE object embedding is not emulated.",
          ),
        },
      ],
    },
  ]);
  ctx.onClose(allowDiscard);
  render();
  if (args.path) {
    try {
      load(args.path);
    } catch (err) {
      os.message(err.message, "Object Packager");
    }
  }
}

const CONTROL_PANELS = [
  ["color", "Color", "colors", "Change the desktop and window colors."],
  [
    "fonts",
    "Fonts",
    "fonts",
    "Choose the display font and view installed fonts.",
  ],
  ["ports", "Ports", "ports", "Configure saved local serial port profiles."],
  [
    "mouse",
    "Mouse",
    "mouse",
    "Set double-click timing and pointer preferences.",
  ],
  [
    "desktop",
    "Desktop",
    "desktop",
    "Choose a background pattern and screen saver.",
  ],
  [
    "keyboard",
    "Keyboard",
    "keyboard",
    "Set and test keyboard repeat preferences.",
  ],
  ["printers", "Printers", "printers", "Configure the browser print queue."],
  [
    "international",
    "International",
    "international",
    "Set language, date, time, and number formats.",
  ],
  ["datetime", "Date/Time", "datetime", "Set the desktop clock."],
  ["sound", "Sound", "sound", "Enable and test system sounds."],
  [
    "drivers",
    "Drivers",
    "drivers",
    "Review the browser-provided system drivers.",
  ],
];
function createControlPanel(ctx, args) {
  const { os } = ctx;
  let selected = "color",
    small = false;
  const grid = el("div", {
      class: "cp-grid sunken",
      role: "listbox",
      "aria-label": "Control Panel items",
    }),
    status = el("div", { class: "statusbar" });
  ctx.content.append(el("div", { class: "cp-app" }, grid, status));
  function render() {
    clear(grid);
    grid.classList.toggle("cp-small", small);
    for (const [id, title, image, description] of CONTROL_PANELS) {
      const item = el(
        "button",
        {
          class: `cp-item ${selected === id ? "selected" : ""}`,
          type: "button",
          role: "option",
          "aria-selected": String(selected === id),
          title: description,
        },
        glyph(image, small ? 24 : 32),
        el("span", {}, title),
      );
      item.addEventListener("click", () => {
        selected = id;
        [...grid.children].forEach((n) => {
          n.classList.toggle("selected", n === item);
          n.setAttribute("aria-selected", String(n === item));
        });
        status.textContent = description;
      });
      item.addEventListener(
        "dblclick",
        safe(os, () => openPanel(id)),
      );
      item.addEventListener(
        "keydown",
        safe(os, (e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            return openPanel(id);
          }
        }),
      );
      grid.append(item);
    }
    status.textContent =
      CONTROL_PANELS.find((p) => p[0] === selected)?.[3] || "";
    ctx.setMenu([
      {
        label: "&Settings",
        items: [
          {
            label: "&Open",
            shortcut: "Enter",
            action: safe(os, () => openPanel(selected)),
          },
          { separator: true },
          ...CONTROL_PANELS.map(([id, title]) => ({
            label: `${title}...`,
            action: safe(os, () => openPanel(id)),
          })),
          { separator: true },
          { label: "E&xit", action: () => ctx.win.close() },
        ],
      },
      {
        label: "&View",
        items: [
          {
            label: "&Large Icons",
            checked: !small,
            action: () => {
              small = false;
              render();
            },
          },
          {
            label: "&Small Icons",
            checked: small,
            action: () => {
              small = true;
              render();
            },
          },
        ],
      },
      {
        label: "&Help",
        items: [
          {
            label: "&Control Panel Help",
            action: () =>
              os.message(
                "Double-click a Control Panel icon, or select one and press Enter, to change a setting. Choose OK in a settings dialog to apply and save changes. Colors, fonts, desktop pattern, screen saver, virtual clock, and sounds are applied to this desktop. Host devices remain under the control of your computer and browser.",
                "Control Panel Help",
              ),
          },
          {
            label: "&About Control Panel...",
            action: describe(
              os,
              "control",
              "Configure the actual browser desktop preferences and inspect its available devices. Settings are saved across sessions.",
            ),
          },
        ],
      },
    ]);
  }
  async function openPanel(id) {
    if (id === "colors") id = "color";
    if (id === "dateTime" || id === "date" || id === "time") id = "datetime";
    const actions = {
      color: colorPanel,
      fonts: fontsPanel,
      ports: portsPanel,
      mouse: mousePanel,
      desktop: desktopPanel,
      keyboard: keyboardPanel,
      printers: printersPanel,
      international: internationalPanel,
      datetime: dateTimePanel,
      sound: soundPanel,
      drivers: driversPanel,
    };
    selected = actions[id] ? id : "color";
    render();
    return actions[selected]();
  }
  ctx.win.openPanel = safe(os, openPanel);
  const okCancel = [
    { label: "OK", value: true, default: true },
    { label: "Cancel", value: false },
  ];
  async function colorPanel() {
    const keys = [
      ["desktopColor", "Desktop"],
      ["windowColor", "Window Background"],
      ["textColor", "Window Text"],
      ["titleColor", "Active Title Bar"],
      ["titleTextColor", "Active Title Text"],
    ];
    let colors = {
      desktopColor: "#808080",
      windowColor: "#ffffff",
      textColor: "#000000",
      titleColor: "#000080",
      titleTextColor: "#ffffff",
      ...Object.fromEntries(
        keys
          .map(([key]) => [key, os.settings[key]])
          .filter(([, v]) => /^#[a-f0-9]{6}$/i.test(v || "")),
      ),
    };
    const schemes = {
      "Windows Standard": [
        "#808080",
        "#ffffff",
        "#000000",
        "#000080",
        "#ffffff",
      ],
      "Windows Blue": ["#008080", "#ffffff", "#000000", "#000080", "#ffffff"],
      Desert: ["#b4a082", "#fff8e8", "#201808", "#7c5c38", "#ffffff"],
      "High Contrast": ["#000000", "#000000", "#ffffff", "#800080", "#ffff00"],
    };
    const scheme = select([...Object.keys(schemes), "Custom"], "Custom"),
      target = select(keys, "desktopColor"),
      custom = input(colors.desktopColor, {
        type: "color",
        class: "cp-color-input",
      });
    const preview = el(
      "div",
      { class: "cp-color-preview" },
      el(
        "div",
        { class: "cp-preview-window raised" },
        el("div", { class: "cp-preview-title" }, "Active Window"),
        el("div", { class: "cp-preview-menu" }, "File   Edit   Help"),
        el(
          "div",
          { class: "cp-preview-content" },
          "Window text",
          el("div", { class: "cp-preview-selection" }, "Selected text"),
        ),
        el("div", { class: "cp-preview-button" }, "OK"),
      ),
    );
    const palette = el("div", { class: "cp-palette sunken" });
    [
      "#ffffff",
      "#c0c0c0",
      "#808080",
      "#000000",
      "#ff0000",
      "#800000",
      "#ffff00",
      "#808000",
      "#00ff00",
      "#008000",
      "#00ffff",
      "#008080",
      "#0000ff",
      "#000080",
      "#ff00ff",
      "#800080",
    ].forEach((color) =>
      palette.append(
        button(
          "",
          () => {
            colors[target.value] = color;
            scheme.value = "Custom";
            update();
          },
          {
            class: "cp-swatch",
            style: { background: color },
            title: color,
            "aria-label": color,
          },
        ),
      ),
    );
    function update() {
      preview.style.background = colors.desktopColor;
      preview.querySelector(".cp-preview-content").style.background =
        colors.windowColor;
      preview.querySelector(".cp-preview-content").style.color =
        colors.textColor;
      preview.querySelector(".cp-preview-title").style.background =
        colors.titleColor;
      preview.querySelector(".cp-preview-title").style.color =
        colors.titleTextColor;
      preview.querySelector(".cp-preview-selection").style.background =
        colors.titleColor;
      preview.querySelector(".cp-preview-selection").style.color =
        colors.titleTextColor;
      custom.value = colors[target.value];
    }
    scheme.addEventListener("change", () => {
      if (schemes[scheme.value])
        keys.forEach(([key], i) => (colors[key] = schemes[scheme.value][i]));
      update();
    });
    target.addEventListener("change", update);
    custom.addEventListener("input", () => {
      colors[target.value] = custom.value;
      scheme.value = "Custom";
      update();
    });
    update();
    if (
      await os.dialog({
        title: "Color",
        width: 470,
        body: el(
          "div",
          { class: "dialog-body cp-color-dialog" },
          row("Color Scheme:", scheme),
          preview,
          row("Screen Element:", target),
          el(
            "div",
            { class: "cp-palette-row" },
            palette,
            el("label", {}, "Custom:", custom),
          ),
        ),
        buttons: okCancel,
      })
    )
      settings(os, colors);
  }
  async function fontsPanel() {
    let customFonts = Array.isArray(os.settings.customFonts)
      ? [...os.settings.customFonts]
      : [];
    const builtin = [
      ["system-ui", "Browser System Font"],
      ["Arial, sans-serif", "Arial"],
      ["Times New Roman, serif", "Times New Roman"],
      ["Courier New, monospace", "Courier New"],
      ["Tahoma, sans-serif", "Tahoma"],
      ["Georgia, serif", "Georgia"],
    ];
    if (
      os.settings.fontFamily &&
      !builtin.some(([f]) => f === os.settings.fontFamily) &&
      !customFonts.some((f) => f.name === os.settings.fontFamily)
    )
      builtin.unshift([os.settings.fontFamily, "Windows System Font"]);
    const font = select(
        [...builtin, ...customFonts.map((f) => [f.name, f.name])],
        os.settings.fontFamily || builtin[0][0],
        { size: 6, class: "win-select cp-font-list" },
      ),
      size = select(
        [11, 12, 13, 14, 16, 18, 20].map((v) => [v, String(v)]),
        os.settings.fontSize || 14,
      ),
      sample = el(
        "div",
        { class: "cp-font-sample sunken" },
        "AaBbYyZz  0123456789\nThe quick brown fox jumps over the lazy dog.",
      );
    function update() {
      sample.style.fontFamily = font.value;
      sample.style.fontSize = `${size.value}px`;
    }
    font.addEventListener("change", update);
    size.addEventListener("change", update);
    update();
    async function addFont() {
      const files = await chooseHostFiles(".woff,.woff2,.ttf,.otf", false);
      if (!files.length) return;
      const file = files[0],
        name =
          file.name
            .replace(/\.[^.]+$/, "")
            .replace(/[^a-zA-Z0-9 _-]/g, "")
            .trim() || "Imported Font";
      const data = await readHostFile(file);
      const face = new FontFace(name, `url("${data}")`);
      await face.load();
      document.fonts.add(face);
      customFonts = customFonts.filter((f) => f.name !== name);
      customFonts.push({ name, data });
      font.append(el("option", { value: name }, name));
      font.value = name;
      update();
    }
    async function removeFont() {
      const target = customFonts.find((f) => f.name === font.value);
      if (!target) {
        await os.message(
          "System fonts are supplied by the browser. Select a font you imported to remove it.",
          "Fonts",
        );
        return;
      }
      customFonts = customFonts.filter((f) => f.name !== target.name);
      [...font.options]
        .filter((o) => o.value === target.name)
        .forEach((o) => o.remove());
      font.value = builtin[0][0];
      update();
    }
    if (
      await os.dialog({
        title: "Fonts",
        width: 470,
        body: el(
          "div",
          { class: "dialog-body" },
          el(
            "div",
            { class: "sys-columns" },
            el(
              "div",
              { class: "sys-grow" },
              el("div", {}, "Installed Fonts:"),
              font,
            ),
            el(
              "div",
              { class: "cp-font-buttons" },
              button("Add...", safe(os, addFont)),
              button("Remove", safe(os, removeFont)),
              row("Size:", size),
            ),
          ),
          el("div", { class: "cp-sample-label" }, "Sample:"),
          sample,
          button("Print Sample...", () =>
            os.print(
              "Font Sample",
              `<div style="font-family:${escapeHTML(font.value)};font-size:${+size.value}px"><h2>${escapeHTML(font.selectedOptions[0]?.textContent || "")}</h2><p>AaBbYyZz 0123456789</p><p>The quick brown fox jumps over the lazy dog.</p></div>`,
            ),
          ),
        ),
        buttons: okCancel,
      })
    )
      settings(os, {
        fontFamily: font.value,
        fontSize: +size.value,
        customFonts,
      });
  }
  async function portsPanel() {
    const ports = JSON.parse(
      JSON.stringify(
        os.settings.portSettings || {
          COM1: {
            baud: 9600,
            dataBits: 8,
            parity: "None",
            stopBits: 1,
            flowControl: "None",
          },
          COM2: {
            baud: 2400,
            dataBits: 8,
            parity: "None",
            stopBits: 1,
            flowControl: "None",
          },
        },
      ),
    );
    const list = select(Object.keys(ports), Object.keys(ports)[0], {
      size: 5,
      class: "win-select cp-port-list",
    });
    async function configure() {
      const name = list.value;
      if (!name) return;
      const config = ports[name];
      const baud = select(
          [
            110, 300, 600, 1200, 2400, 4800, 9600, 19200, 38400, 57600, 115200,
          ].map((n) => [n, String(n)]),
          config.baud,
        ),
        bits = select(["7", "8"], config.dataBits),
        parity = select(
          ["None", "Odd", "Even", "Mark", "Space"],
          config.parity,
        ),
        stops = select(["1", "1.5", "2"], config.stopBits),
        flow = select(
          ["None", "Xon/Xoff", "Hardware"],
          config.flowControl || "None",
        );
      if (
        await os.dialog({
          title: `Settings for ${name}`,
          width: 320,
          body: el(
            "div",
            { class: "dialog-body" },
            row("Baud Rate:", baud),
            row("Data Bits:", bits),
            row("Parity:", parity),
            row("Stop Bits:", stops),
            row("Flow Control:", flow),
          ),
          buttons: okCancel,
        })
      )
        ports[name] = {
          baud: +baud.value,
          dataBits: +bits.value,
          parity: parity.value,
          stopBits: +stops.value,
          flowControl: flow.value,
        };
    }
    async function add() {
      const name = (
        await os.prompt(
          "Add Port",
          "Port name:",
          `COM${Object.keys(ports).length + 1}`,
        )
      )?.toUpperCase();
      if (!name) return;
      if (!/^COM[1-9]\d*$/.test(name))
        throw new Error("Use a name such as COM3.");
      if (ports[name]) throw new Error("This port profile already exists.");
      ports[name] = {
        baud: 9600,
        dataBits: 8,
        parity: "None",
        stopBits: 1,
        flowControl: "None",
      };
      list.append(el("option", { value: name }, name));
      list.value = name;
    }
    function remove() {
      if (!list.value) return;
      delete ports[list.value];
      list.selectedOptions[0]?.remove();
    }
    if (
      await os.dialog({
        title: "Ports",
        width: 370,
        body: el(
          "div",
          { class: "dialog-body" },
          el(
            "div",
            { class: "sys-columns" },
            list,
            el(
              "div",
              { class: "sys-button-column" },
              button("Settings...", safe(os, configure)),
              button("Add...", safe(os, add)),
              button("Delete", remove),
            ),
          ),
          el(
            "p",
            { class: "sys-note" },
            "Port profiles are saved for local communications. Browser access to physical COM ports is not requested.",
          ),
        ),
        buttons: okCancel,
      })
    )
      settings(os, { portSettings: ports });
  }
  async function mousePanel() {
    const speed = input(os.settings.pointerSpeed || 10, {
        type: "range",
        min: 1,
        max: 20,
      }),
      interval = input(os.settings.doubleClickInterval || 400, {
        type: "range",
        min: 100,
        max: 1000,
        step: 50,
      }),
      value = el("span", {}, `${interval.value} ms`),
      test = button("", () => {}, { class: "cp-mouse-test" }),
      feedback = el("span", {}, "Double-click the folder to test.");
    test.append(glyph("folder", 32));
    let last = 0,
      timer;
    test.addEventListener("click", () => {
      const now = performance.now();
      if (now - last <= +interval.value) {
        test.classList.toggle("selected");
        feedback.textContent = "Double-click detected.";
        last = 0;
        clearTimeout(timer);
        timer = setTimeout(
          () => (feedback.textContent = "Double-click the folder to test."),
          1800,
        );
      } else last = now;
    });
    interval.addEventListener(
      "input",
      () => (value.textContent = `${interval.value} ms`),
    );
    const area = el(
      "div",
      { class: "cp-pointer-test sunken" },
      el("span", { class: "cp-pointer-label" }, "Pointer preference test"),
      el("span", { class: "cp-test-pointer" }),
    );
    area.addEventListener("pointermove", (e) => {
      const box = area.getBoundingClientRect(),
        gain = +speed.value / 10,
        x = Math.max(
          0,
          Math.min(
            box.width - 10,
            box.width / 2 + (e.clientX - box.left - box.width / 2) * gain,
          ),
        ),
        y = Math.max(
          0,
          Math.min(
            box.height - 14,
            box.height / 2 + (e.clientY - box.top - box.height / 2) * gain,
          ),
        );
      const pointer = area.querySelector(".cp-test-pointer");
      pointer.style.left = `${x}px`;
      pointer.style.top = `${y}px`;
    });
    const result = await os.dialog({
      title: "Mouse",
      width: 420,
      body: el(
        "div",
        { class: "dialog-body" },
        el(
          "fieldset",
          {},
          el("legend", {}, "Mouse Tracking Speed"),
          el("div", { class: "cp-range" }, "Slow", speed, "Fast"),
          area,
        ),
        el(
          "fieldset",
          {},
          el("legend", {}, "Double-Click Speed"),
          el("div", { class: "cp-range" }, "Fast", interval, "Slow"),
          value,
          el("div", { class: "cp-double-test" }, test, feedback),
        ),
        el(
          "p",
          { class: "sys-note" },
          "Tracking speed is saved as a desktop preference and demonstrated above. Your computer controls the physical cursor speed.",
        ),
      ),
      buttons: okCancel,
    });
    clearTimeout(timer);
    if (result)
      settings(os, {
        pointerSpeed: +speed.value,
        doubleClickInterval: +interval.value,
      });
  }
  async function desktopPanel() {
    const pattern = select(
        [
          ["none", "(None)"],
          ["dots", "Dots"],
          ["checker", "Checkerboard"],
          ["diagonal", "Diagonal"],
          ["bricks", "Bricks"],
          ["weave", "Weave"],
        ],
        os.settings.wallpaperPattern || "none",
      ),
      saver = select(
        [
          ["none", "(None)"],
          ["blank", "Blank Screen"],
          ["stars", "Starfield"],
          ["mystify", "Mystify"],
        ],
        os.settings.screenSaver || "none",
      ),
      wait = input(os.settings.screenSaverMinutes || 5, {
        type: "number",
        min: 1,
        max: 120,
      }),
      preview = el("div", { class: "cp-pattern-preview sunken" });
    const patterns = {
      none: "none",
      dots: "radial-gradient(#000 1px, transparent 1px)",
      checker:
        "conic-gradient(#0004 25%,transparent 0 50%,#0004 0 75%,transparent 0)",
      diagonal:
        "repeating-linear-gradient(45deg,transparent 0 3px,#0004 3px 4px)",
      bricks:
        "linear-gradient(335deg,#0005 2px,transparent 2px),linear-gradient(155deg,#0005 2px,transparent 2px)",
      weave:
        "repeating-linear-gradient(0deg,#fff3 0 1px,transparent 1px 4px),repeating-linear-gradient(90deg,#0004 0 1px,transparent 1px 4px)",
    };
    function update() {
      preview.style.backgroundColor = os.settings.desktopColor || "#808080";
      preview.style.backgroundImage = patterns[pattern.value];
      preview.style.backgroundSize =
        pattern.value === "checker"
          ? "8px 8px"
          : pattern.value === "dots"
            ? "5px 5px"
            : pattern.value === "bricks"
              ? "12px 12px"
              : "auto";
    }
    pattern.addEventListener("change", update);
    update();
    if (
      await os.dialog({
        title: "Desktop",
        width: 410,
        body: el(
          "div",
          { class: "dialog-body" },
          el(
            "fieldset",
            {},
            el("legend", {}, "Pattern"),
            row("Name:", pattern),
            preview,
          ),
          el(
            "fieldset",
            {},
            el("legend", {}, "Screen Saver"),
            row("Name:", saver),
            row("Delay (minutes):", wait),
            button("Test", () => {
              if (saver.value === "none")
                return os.message("Choose a screen saver to test.", "Desktop");
              previewSaver(ctx, saver.value);
            }),
          ),
        ),
        buttons: okCancel,
      })
    ) {
      if (+wait.value < 1 || +wait.value > 120)
        throw new Error(
          "Choose a screen saver delay between 1 and 120 minutes.",
        );
      settings(os, {
        wallpaperPattern: pattern.value,
        screenSaver: saver.value,
        screenSaverMinutes: +wait.value,
      });
    }
  }
  async function keyboardPanel() {
    const delay = input(os.settings.keyboardRepeatDelay || 500, {
        type: "range",
        min: 150,
        max: 1000,
        step: 50,
      }),
      rate = input(os.settings.keyboardRepeatRate || 15, {
        type: "range",
        min: 2,
        max: 30,
      }),
      readout = el("div", { class: "cp-key-readout" }),
      example = input("", {
        readonly: true,
        "aria-label": "Repeat test output",
      }),
      hold = button("Hold to Test Repeat", () => {}, { class: "win-button" });
    let delayTimer, repeatTimer;
    function update() {
      readout.textContent = `Delay: ${delay.value} ms   Repeat rate: ${rate.value} characters/sec`;
    }
    function stop() {
      clearTimeout(delayTimer);
      clearInterval(repeatTimer);
      hold.classList.remove("pressed");
    }
    function start(e) {
      if (e.type === "keydown" && ![" ", "Enter"].includes(e.key)) return;
      e.preventDefault();
      if (e.repeat) return;
      stop();
      hold.classList.add("pressed");
      example.value = "A";
      delayTimer = setTimeout(() => {
        repeatTimer = setInterval(() => {
          example.value += "A";
          if (example.value.length > 100)
            example.value = example.value.slice(-80);
          example.scrollLeft = example.scrollWidth;
        }, 1000 / +rate.value);
      }, +delay.value);
    }
    hold.addEventListener("pointerdown", start);
    hold.addEventListener("keydown", start);
    hold.addEventListener("keyup", stop);
    document.addEventListener("pointerup", stop);
    delay.addEventListener("input", update);
    rate.addEventListener("input", update);
    update();
    try {
      if (
        await os.dialog({
          title: "Keyboard",
          width: 410,
          body: el(
            "div",
            { class: "dialog-body" },
            el(
              "fieldset",
              {},
              el("legend", {}, "Repeat Delay"),
              el("div", { class: "cp-range" }, "Short", delay, "Long"),
            ),
            el(
              "fieldset",
              {},
              el("legend", {}, "Repeat Rate"),
              el("div", { class: "cp-range" }, "Slow", rate, "Fast"),
            ),
            readout,
            example,
            hold,
            el(
              "p",
              { class: "sys-note" },
              "These preferences control the repeat test and are saved with the desktop. Browser text fields use the repeat behavior supplied by your computer.",
            ),
          ),
          buttons: okCancel,
        })
      )
        settings(os, {
          keyboardRepeatDelay: +delay.value,
          keyboardRepeatRate: +rate.value,
        });
    } finally {
      stop();
      document.removeEventListener("pointerup", stop);
    }
  }
  async function printersPanel() {
    const name = input(os.settings.printerName || "Default Browser Printer"),
      paper = select(
        ["Letter", "A4", "Legal"],
        os.settings.paperSize || "Letter",
      ),
      orientation = select(
        ["Portrait", "Landscape"],
        os.settings.printOrientation || "Portrait",
      );
    const result = await os.dialog({
      title: "Printers",
      width: 450,
      body: el(
        "div",
        { class: "dialog-body" },
        el(
          "div",
          { class: "cp-printer-info" },
          glyph("printers"),
          el(
            "div",
            {},
            el("strong", {}, "Browser Print Driver"),
            el("div", {}, "Port: BROWSER:"),
            el("div", {}, "Default printer"),
          ),
        ),
        row("Queue name:", name),
        row("Paper preference:", paper),
        row("Orientation:", orientation),
        el(
          "div",
          { class: "sys-inline" },
          button("Print Manager...", () => os.open("printmanager")),
          button("Print Test Page", () =>
            os.print(
              "Windows Test Page",
              `<main style="font-family:serif;padding:32px"><h1>Microsoft Windows 3.1</h1><h2>Printer Test Page</h2><p>${escapeHTML(name.value)}</p><p>The browser print driver is working.</p><p>${escapeHTML(new Date().toLocaleString())}</p><hr><p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p><p>abcdefghijklmnopqrstuvwxyz 0123456789</p></main>`,
            ),
          ),
        ),
        el(
          "p",
          { class: "sys-note" },
          "Choose the physical printer, paper size, orientation, or Save as PDF in the browser print dialog. The queue name and preferences above are saved for this desktop.",
        ),
      ),
      buttons: okCancel,
    });
    if (result)
      settings(os, {
        printerName: name.value.trim() || "Default Browser Printer",
        paperSize: paper.value,
        printOrientation: orientation.value,
      });
  }
  async function internationalPanel() {
    const locale = select(
        [
          ["en-US", "English (United States)"],
          ["en-GB", "English (United Kingdom)"],
          ["de-DE", "German"],
          ["fr-FR", "French"],
          ["es-ES", "Spanish"],
          ["it-IT", "Italian"],
          ["ja-JP", "Japanese"],
        ],
        os.settings.locale || "en-US",
      ),
      date = select(
        [
          ["MDY", "Month / Day / Year"],
          ["DMY", "Day / Month / Year"],
          ["YMD", "Year / Month / Day"],
        ],
        os.settings.dateFormat || "MDY",
      ),
      time = select(
        [
          ["12", "12-hour"],
          ["24", "24-hour"],
        ],
        os.settings.timeFormat || "12",
      ),
      decimal = input(os.settings.decimalSeparator || ".", { maxlength: 1 }),
      separator = input(os.settings.thousandSeparator || ",", { maxlength: 1 }),
      currency = input(os.settings.currencySymbol || "$", { maxlength: 8 }),
      preview = el("div", { class: "cp-intl-preview sunken" });
    function update() {
      const d = new Date(Date.now() + (Number(os.settings.clockOffsetMs) || 0));
      const parts = {
        M: String(d.getMonth() + 1).padStart(2, "0"),
        D: String(d.getDate()).padStart(2, "0"),
        Y: String(d.getFullYear()),
      };
      preview.textContent = `${[...date.value].map((p) => parts[p]).join("/")}   ${d.toLocaleTimeString(locale.value, { hour12: time.value === "12" })}\n${currency.value}1${separator.value}234${decimal.value}56`;
    }
    [locale, date, time, decimal, separator, currency].forEach((control) =>
      control.addEventListener("input", update),
    );
    update();
    if (
      await os.dialog({
        title: "International",
        width: 440,
        body: el(
          "div",
          { class: "dialog-body" },
          row("Country / Language:", locale),
          row("Date Format:", date),
          row("Time Format:", time),
          row("Decimal Symbol:", decimal),
          row("Thousands Separator:", separator),
          row("Currency Symbol:", currency),
          preview,
        ),
        buttons: okCancel,
      })
    )
      settings(os, {
        locale: locale.value,
        dateFormat: date.value,
        timeFormat: time.value,
        decimalSeparator: decimal.value,
        thousandSeparator: separator.value,
        currencySymbol: currency.value,
      });
  }
  async function dateTimePanel() {
    const now = new Date(Date.now() + (Number(os.settings.clockOffsetMs) || 0)),
      pad = (v) => String(v).padStart(2, "0"),
      date = input(
        `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
        { type: "date" },
      ),
      time = input(
        `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`,
        { type: "time", step: 1 },
      );
    let reset = false;
    date.addEventListener("input", () => (reset = false));
    time.addEventListener("input", () => (reset = false));
    const result = await os.dialog({
      title: "Date/Time",
      width: 360,
      body: el(
        "div",
        { class: "dialog-body" },
        el(
          "div",
          { class: "cp-date-heading" },
          glyph("datetime"),
          el("span", {}, "Set the Windows desktop clock"),
        ),
        row("Date:", date),
        row("Time:", time),
        button("Use Computer Time", () => {
          const d = new Date();
          date.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
          time.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
          reset = true;
        }),
        el(
          "p",
          { class: "sys-note" },
          "The clock change applies to this desktop. Your computer’s clock is unchanged.",
        ),
      ),
      buttons: okCancel,
    });
    if (result) {
      const chosen = new Date(`${date.value}T${time.value || "00:00:00"}`);
      if (Number.isNaN(chosen.getTime()))
        throw new Error("Enter a valid date and time.");
      settings(os, {
        clockOffsetMs: reset ? 0 : chosen.getTime() - Date.now(),
      });
    }
  }
  async function soundPanel() {
    const enabled = check(
        "Enable System Sounds",
        os.settings.soundEnabled !== false,
      ),
      sound = select(
        [
          ["click", "Default Beep"],
          ["asterisk", "Asterisk"],
          ["exclamation", "Exclamation"],
          ["error", "Critical Stop"],
        ],
        "click",
      );
    if (
      await os.dialog({
        title: "Sound",
        width: 360,
        body: el(
          "div",
          { class: "dialog-body" },
          el(
            "div",
            { class: "cp-sound-heading" },
            glyph("sound"),
            enabled.node,
          ),
          row("Sound:", sound),
          button("Test", () => {
            const previous = os.settings.soundEnabled;
            os.settings.soundEnabled = true;
            try {
              os.playSound(sound.value);
            } finally {
              os.settings.soundEnabled = previous;
            }
          }),
          el(
            "p",
            { class: "sys-note" },
            "System sounds play through the browser audio output.",
          ),
        ),
        buttons: okCancel,
      })
    )
      settings(os, { soundEnabled: enabled.control.checked });
  }
  async function driversPanel() {
    const drivers = [
      [
        "display",
        "Browser Display",
        os.renderer?.backend || "Browser graphics",
        "The browser draws Windows graphics. Color and font settings are available in Control Panel.",
        "color",
      ],
      [
        "keyboard",
        "Browser Keyboard",
        "Available",
        "Keyboard input is supplied by the browser. Repeat preferences can be tested and saved.",
        "keyboard",
      ],
      [
        "mouse",
        "Browser Mouse",
        "Available",
        "Pointer events are supplied by the browser. Physical cursor behavior is controlled by the host system.",
        "mouse",
      ],
      [
        "disk",
        "Virtual Disk Driver",
        "C: mounted",
        "Files on C: are saved through the desktop filesystem. Use File Manager for import, export, and file operations.",
        "filemanager",
      ],
      [
        "printer",
        "Browser Print Driver",
        "Available",
        "Documents enter Print Manager and are printed through the browser print dialog.",
        "printers",
      ],
      [
        "audio",
        "Browser Audio Driver",
        typeof window.AudioContext === "function" ||
        typeof window.webkitAudioContext === "function"
          ? "Available"
          : "Unavailable",
        "System sounds use browser audio output.",
        "sound",
      ],
      [
        "serial",
        "Local Loopback Driver",
        "Available",
        "Terminal provides a local loopback connection for text and file transfers. Physical serial ports are not connected.",
        "terminal",
      ],
    ];
    let chosen = drivers[0];
    const list = el("div", { class: "cp-driver-list sunken" });
    function draw() {
      clear(list);
      for (const driver of drivers) {
        const item = el(
          "div",
          { class: `cp-driver ${chosen[0] === driver[0] ? "selected" : ""}` },
          el("span", {}, driver[1]),
          el("span", {}, driver[2]),
        );
        item.addEventListener("click", () => {
          chosen = driver;
          [...list.children].forEach((n) =>
            n.classList.toggle("selected", n === item),
          );
        });
        item.addEventListener("dblclick", () =>
          os.message(
            `${driver[1]}\nStatus: ${driver[2]}\n\n${driver[3]}`,
            "Driver Details",
          ),
        );
        list.append(item);
      }
    }
    draw();
    await os.dialog({
      title: "Drivers",
      width: 470,
      body: el(
        "div",
        { class: "dialog-body" },
        el("p", {}, "Installed Drivers:"),
        list,
        el(
          "div",
          { class: "sys-inline" },
          button("Details...", () =>
            os.message(
              `${chosen[1]}\nStatus: ${chosen[2]}\n\n${chosen[3]}`,
              "Driver Details",
            ),
          ),
          button(
            "Configure...",
            safe(os, () =>
              ["filemanager", "terminal"].includes(chosen[4])
                ? os.open(chosen[4])
                : openPanel(chosen[4]),
            ),
          ),
        ),
        el(
          "p",
          { class: "sys-note" },
          "Drivers are supplied by the browser desktop. Native Windows .DRV files cannot be installed or executed.",
        ),
      ),
      buttons: [{ label: "Close", value: true, default: true }],
    });
  }
  render();
  if (args.panel) safe(os, () => openPanel(args.panel))();
}

function previewSaver(ctx, kind) {
  const canvas = el("canvas", { class: "cp-saver-canvas" }),
    overlay = el(
      "div",
      { class: "cp-saver" },
      canvas,
      el(
        "div",
        { class: "cp-saver-hint" },
        "Move the mouse or press a key to return.",
      ),
    );
  document.body.append(overlay);
  const context = canvas.getContext("2d");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  let running = true,
    frame = 0,
    start = performance.now(),
    last = start;
  const stars = Array.from({ length: 140 }, () => ({
    x: (Math.random() - 0.5) * canvas.width,
    y: (Math.random() - 0.5) * canvas.height,
    z: Math.random() * canvas.width,
  }));
  const points = Array.from({ length: 4 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    dx: (Math.random() < 0.5 ? 1 : -1) * 1.7,
    dy: (Math.random() < 0.5 ? 1 : -1) * 1.5,
  }));
  function close() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(frame);
    overlay.remove();
    document.removeEventListener("keydown", close, true);
    overlay.removeEventListener("pointerdown", close);
    overlay.removeEventListener("pointermove", move);
  }
  function move() {
    if (performance.now() - start > 750) close();
  }
  function tick(t) {
    if (!running || !context) return;
    const delta = Math.min(3, (t - last) / 16);
    last = t;
    context.fillStyle = kind === "mystify" ? "rgba(0,0,0,0.10)" : "#000";
    context.fillRect(0, 0, canvas.width, canvas.height);
    if (kind === "stars") {
      context.fillStyle = "#fff";
      for (const star of stars) {
        star.z -= 4 * delta;
        if (star.z < 1) {
          star.z = canvas.width;
          star.x = (Math.random() - 0.5) * canvas.width;
          star.y = (Math.random() - 0.5) * canvas.height;
        }
        const scale = canvas.width / star.z,
          x = canvas.width / 2 + star.x * scale,
          y = canvas.height / 2 + star.y * scale,
          size = Math.min(4, Math.max(1, scale * 0.6));
        context.fillRect(x, y, size, size);
      }
    } else if (kind === "mystify") {
      context.strokeStyle = `hsl(${Math.floor((t - start) / 50) % 360},100%,60%)`;
      context.lineWidth = 1;
      context.beginPath();
      points.forEach((p, i) => {
        p.x += p.dx * delta;
        p.y += p.dy * delta;
        if (p.x < 0 || p.x > canvas.width) p.dx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.dy *= -1;
        i ? context.lineTo(p.x, p.y) : context.moveTo(p.x, p.y);
      });
      context.closePath();
      context.stroke();
    }
    frame = requestAnimationFrame(tick);
  }
  document.addEventListener("keydown", close, true);
  overlay.addEventListener("pointerdown", close);
  overlay.addEventListener("pointermove", move);
  ctx.cleanup(close);
  frame = requestAnimationFrame(tick);
}

export function registerApps(os) {
  const definitions = [
    {
      id: "filemanager",
      title: "File Manager",
      width: 750,
      height: 460,
      minWidth: 410,
      minHeight: 240,
      create: createFileManager,
    },
    {
      id: "dos",
      title: "MS-DOS Prompt",
      width: 680,
      height: 410,
      minWidth: 350,
      minHeight: 200,
      create: createDOS,
    },
    {
      id: "printmanager",
      title: "Print Manager",
      width: 610,
      height: 345,
      minWidth: 390,
      minHeight: 220,
      singleton: true,
      create: createPrintManager,
    },
    {
      id: "terminal",
      title: "Terminal",
      width: 660,
      height: 425,
      minWidth: 370,
      minHeight: 240,
      create: createTerminal,
    },
    {
      id: "pifeditor",
      title: "PIF Editor",
      width: 565,
      height: 475,
      minWidth: 390,
      minHeight: 330,
      create: createPIFEditor,
    },
    {
      id: "setup",
      title: "Windows Setup",
      width: 575,
      height: 495,
      minWidth: 390,
      minHeight: 320,
      singleton: true,
      create: createSetup,
    },
    {
      id: "regedit",
      title: "Registration Info Editor",
      width: 720,
      height: 440,
      minWidth: 420,
      minHeight: 285,
      singleton: true,
      create: createRegistryEditor,
    },
    {
      id: "packager",
      title: "Object Packager",
      width: 585,
      height: 410,
      minWidth: 420,
      minHeight: 280,
      create: createPackager,
    },
    {
      id: "control",
      title: "Control Panel",
      width: 570,
      height: 335,
      minWidth: 320,
      minHeight: 245,
      singleton: true,
      create: createControlPanel,
    },
  ];
  for (const definition of definitions)
    os.registerApp({
      ...definition,
      icon: definition.id,
      create: (ctx, args = {}) => definition.create(ctx, args),
    });
  if (
    typeof FontFace === "function" &&
    Array.isArray(os.settings.customFonts)
  ) {
    for (const font of os.settings.customFonts) {
      if (
        !/^[a-zA-Z0-9 _-]+$/.test(font.name || "") ||
        !/^data:[a-zA-Z0-9.+/-]+;base64,[a-zA-Z0-9+/=]+$/.test(font.data || "")
      )
        continue;
      const face = new FontFace(font.name, `url("${font.data}")`);
      face
        .load()
        .then((loaded) => document.fonts.add(loaded))
        .catch(() => {});
    }
  }
}
