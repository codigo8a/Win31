import { el, button, icon, clear, download, escapeHTML } from "../core/dom.js";

const DEFAULT_GROUPS = [
  {
    id: "main",
    title: "Main",
    icon: "main",
    items: [
      { id: "filemanager", title: "File Manager", command: "WINFILE" },
      { id: "control", title: "Control Panel", command: "CONTROL" },
      { id: "printmanager", title: "Print Manager", command: "PRINTMAN" },
      { id: "clipboard", title: "Clipboard", command: "CLIPBRD" },
      { id: "dos", title: "MS-DOS Prompt", command: "COMMAND" },
      { id: "setup", title: "Windows Setup", command: "SETUP" },
      { id: "pifeditor", title: "PIF Editor", command: "PIFEDIT" },
      {
        id: "readme",
        title: "Read Me",
        command: "WRITE C:\\WINDOWS\\README.WRI",
      },
    ],
  },
  {
    id: "accessories",
    title: "Accessories",
    icon: "main",
    items: [
      { id: "write", title: "Write", command: "WRITE" },
      { id: "paintbrush", title: "Paintbrush", command: "PBRUSH" },
      { id: "terminal", title: "Terminal", command: "TERMINAL" },
      { id: "notepad", title: "Notepad", command: "NOTEPAD" },
      { id: "recorder", title: "Recorder", command: "RECORDER" },
      { id: "cardfile", title: "Cardfile", command: "CARDFILE" },
      { id: "calendar", title: "Calendar", command: "CALENDAR" },
      { id: "calculator", title: "Calculator", command: "CALC" },
      { id: "clock", title: "Clock", command: "CLOCK" },
      { id: "packager", title: "Object Packager", command: "PACKAGER" },
      { id: "charmap", title: "Character Map", command: "CHARMAP" },
      { id: "mediaplayer", title: "Media Player", command: "MPLAYER" },
      { id: "soundrecorder", title: "Sound Recorder", command: "SOUNDREC" },
    ],
  },
  {
    id: "games",
    title: "Games",
    icon: "main",
    items: [
      { id: "solitaire", title: "Solitaire", command: "SOL" },
      { id: "minesweeper", title: "Minesweeper", command: "WINMINE" },
    ],
  },
  { id: "startup", title: "StartUp", icon: "main", items: [{ id: "cardfile", title: "Cardfile", command: "CARDFILE" }] },
];

function programManager(ctx) {
  const { os, win } = ctx;
  os.programManager = win;
  let groups = os.storage.get(
    "program-groups",
    structuredClone(DEFAULT_GROUPS),
  );
  if (!Array.isArray(groups) || !groups.length)
    groups = structuredClone(DEFAULT_GROUPS);
  const area = el("div", {
    class: "program-workspace",
    tabIndex: 0,
    "aria-label": "Program Manager workspace",
  });
  ctx.content.append(area);
  const windows = new Map(),
    selected = new Map();
  let currentGroup = groups[0];
  win.groups = groups;
  win.groupWindows = windows;
  const save = () => os.storage.set("program-groups", groups);
  const current = () => currentGroup || groups[0];
  const currentItem = () => selected.get(current()?.id);
  const activateItem = (item) => {
    if (!item) return;
    const opened = os.run(item.command || item.id);
    if (os.settings.minimizeOnUse && !win.state.minimized) win.minimize();
    return opened;
  };
  function selectItem(group, item, node) {
    currentGroup = group;
    selected.set(group.id, item);
    const w = windows.get(group.id);
    w?.content
      .querySelectorAll(".program-item")
      .forEach((n) => n.classList.toggle("selected", n === node));
  }
  function renderGroup(group) {
    const groupWin = windows.get(group.id);
    if (!groupWin) return;
    const grid = el("div", {
      class: "group-icons",
      role: "listbox",
      "aria-label": `${group.title} programs`,
    });
    groupWin.content.replaceChildren(grid);
    group.items.forEach((item) => {
      const node = el(
        "button",
        {
          class: `program-item ${selected.get(group.id) === item ? "selected" : ""}`,
          role: "option",
          "aria-label": item.title,
          draggable: true,
          onClick: (e) => selectItem(group, item, node),
          onDblclick: () => activateItem(item),
          onKeydown: (e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              activateItem(item);
            } else if (e.key === "Delete") {
              e.preventDefault();
              removeItem();
            } else if (e.key.startsWith("Arrow")) {
              e.preventDefault();
              const nodes = [...grid.children],
                index = nodes.indexOf(node),
                cols = Math.max(1, Math.floor(grid.clientWidth / 95)),
                step =
                  e.key === "ArrowLeft"
                    ? -1
                    : e.key === "ArrowRight"
                      ? 1
                      : e.key === "ArrowUp"
                        ? -cols
                        : cols;
              const next =
                nodes[Math.max(0, Math.min(nodes.length - 1, index + step))];
              next?.click();
              next?.focus();
            }
          },
          onContextmenu: (e) => {
            e.preventDefault();
            selectItem(group, item, node);
            os.menus.close();
            os.menus.show(
              [
                { label: "&Open", action: () => activateItem(item) },
                { label: "&Properties…", action: () => properties() },
                { label: "&Copy…", action: () => transfer(false) },
                { label: "&Move…", action: () => transfer(true) },
                { separator: true },
                { label: "&Delete", action: () => removeItem() },
              ],
              e.clientX,
              e.clientY,
              groupWin,
            );
          },
          onDragstart: (e) => {
            selectItem(group, item, node);
            e.dataTransfer.setData(
              "application/x-win31-program",
              JSON.stringify({
                groupId: group.id,
                index: group.items.indexOf(item),
              }),
            );
            e.dataTransfer.effectAllowed = "copyMove";
          },
        },
        icon(item.icon || item.id),
        el("span", { class: "program-label" }, item.title),
      );
      grid.append(node);
    });
    grid.addEventListener("dragover", (e) => {
      if (e.dataTransfer.types.includes("application/x-win31-program")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move";
      }
    });
    grid.addEventListener("drop", (e) => {
      const data = e.dataTransfer.getData("application/x-win31-program");
      if (!data) return;
      e.preventDefault();
      e.stopPropagation();
      try {
        const info = JSON.parse(data),
          source = groups.find((g) => g.id === info.groupId),
          item = source?.items[info.index];
        if (!item) return;
        if (source === group) return;
        group.items.push({ ...item });
        if (!e.ctrlKey) source.items.splice(info.index, 1);
        save();
        renderGroup(group);
        renderGroup(source);
      } catch (error) {
        os.reportError(error);
      }
    });
  }
  function createGroupWindow(group, index) {
    const b = { width: area.clientWidth, height: area.clientHeight },
      layout = os.storage.get("layout", {})[`group-${group.id}`];
    const mobile = b.width < 720;
    const positions = [
      { x: 24, y: 22, width: 455, height: 254 },
      { x: Math.max(40, b.width - 527), y: 70, width: 495, height: 348 },
      {
        x: 62,
        y: Math.max(280, Math.min(363, b.height - 220)),
        width: 260,
        height: 174,
      },
      { x: 160, y: 100, width: 370, height: 230 },
    ];
    const position = layout
      ? { x: layout.x, y: layout.y, width: layout.width, height: layout.height }
      : positions[index] || {
          x: 45 + index * 18,
          y: 50 + index * 18,
          width: 420,
          height: 260,
        };
    if (mobile) {
      position.x = 12;
      position.y = 12;
      position.width = b.width - 24;
      position.height = Math.min(
        b.height - 100,
        group.id === "accessories" ? 350 : 270,
      );
    }
    const groupWin = os.wm.create({
      id: `group-${group.id}`,
      appId: `group-${group.id}`,
      title: group.title,
      icon: "main",
      parent: area,
      isGroup: true,
      className: "program-group",
      minWidth: 180,
      minHeight: 110,
      ...position,
    });
    windows.set(group.id, groupWin);
    groupWin.on("focus", () => {
      currentGroup = group;
    });
    groupWin.closeGuards.push(() => {
      groupWin.minimize();
      return false;
    });
    groupWin.on("close", () => windows.delete(group.id));
    renderGroup(group);
    if (layout?.maximized) {
      groupWin.maximize();
      if (layout.previous) groupWin.previous = layout.previous;
    }
    if (
      layout?.minimized ||
      (!layout && (group.id === "startup" || (mobile && index > 0)))
    )
      groupWin.minimize();
  }
  async function newItem() {
    const choice = await os.dialog({
      title: "New Program Object",
      width: 320,
      body: el(
        "div",
        { class: "dialog-body" },
        el("p", {}, "Select the type of object to create:"),
      ),
      buttons: [
        { label: "Program Group", value: "group", default: true },
        { label: "Program Item", value: "item" },
        { label: "Cancel", value: null },
      ],
    });
    if (choice === "group") {
      const title = await os.prompt(
        "Program Group Properties",
        "Description:",
        "New Group",
      );
      if (!title?.trim()) return;
      const group = {
        id: crypto.randomUUID(),
        title: title.trim(),
        icon: "main",
        items: [],
      };
      groups.push(group);
      save();
      createGroupWindow(group, groups.length - 1);
    }
    if (choice === "item") await editItem();
  }
  async function editItem(item) {
    const group = current();
    if (!group) return;
    const title = el("input", {
        type: "text",
        value: item?.title || "",
        "aria-label": "Description",
      }),
      command = el("input", {
        type: "text",
        value: item?.command || "",
        "aria-label": "Command Line",
      }),
      iconSelect = el("select", { "aria-label": "Icon" });
    for (const app of os.apps.values())
      iconSelect.append(
        el(
          "option",
          { value: app.id, selected: app.id === (item?.icon || item?.id) },
          app.title,
        ),
      );
    const body = el(
      "div",
      { class: "dialog-body" },
      el("label", { class: "field" }, el("span", {}, "Description:"), title),
      el("label", { class: "field" }, el("span", {}, "Command Line:"), command),
      el("label", { class: "field" }, el("span", {}, "Icon:"), iconSelect),
    );
    for (const n of [title, command, iconSelect]) n.style.flex = "1";
    const result = await os.dialog({
      title: "Program Item Properties",
      body,
      width: 510,
      buttons: [
        { label: "OK", value: true, default: true },
        { label: "Cancel", value: false },
      ],
    });
    if (!result) return;
    if (!title.value.trim() || !command.value.trim()) {
      await os.message(
        "Enter a description and command line.",
        "Program Item Properties",
      );
      return;
    }
    if (item)
      Object.assign(item, {
        title: title.value.trim(),
        command: command.value.trim(),
        icon: iconSelect.value,
      });
    else
      group.items.push({
        id: iconSelect.value,
        title: title.value.trim(),
        command: command.value.trim(),
        icon: iconSelect.value,
      });
    save();
    renderGroup(group);
  }
  async function properties() {
    const item = currentItem();
    if (item) return editItem(item);
    const group = current();
    if (!group) return;
    const title = await os.prompt(
      "Program Group Properties",
      "Description:",
      group.title,
    );
    if (title?.trim()) {
      group.title = title.trim();
      windows.get(group.id)?.setTitle(group.title);
      save();
    }
  }
  async function removeItem() {
    const group = current(),
      item = currentItem();
    if (item) {
      if (
        await os.confirm(
          `Delete the program item '${item.title}'?`,
          "Program Manager",
        )
      ) {
        group.items.splice(group.items.indexOf(item), 1);
        selected.delete(group.id);
        save();
        renderGroup(group);
      }
    } else if (
      group &&
      (await os.confirm(
        `Delete the group '${group.title}' and its program items?`,
        "Program Manager",
      ))
    ) {
      await windows.get(group.id)?.close(true);
      groups = groups.filter((g) => g !== group);
      currentGroup = groups[0];
      win.groups = groups;
      save();
    }
  }
  async function transfer(move) {
    const group = current(),
      item = currentItem();
    if (!item) return;
    const select = el("select", {
      "aria-label": "Destination group",
      size: Math.min(6, groups.length),
      style: { width: "100%" },
    });
    groups
      .filter((g) => g !== group)
      .forEach((g) => select.append(el("option", { value: g.id }, g.title)));
    const result = await os.dialog({
      title: move ? "Move Program Item" : "Copy Program Item",
      body: el(
        "div",
        { class: "dialog-body" },
        el("p", {}, "Select the destination group:"),
        select,
      ),
      buttons: [
        { label: move ? "Move" : "Copy", value: true, default: true },
        { label: "Cancel", value: false },
      ],
    });
    if (!result) return;
    const target = groups.find((g) => g.id === select.value);
    if (!target) return;
    target.items.push({ ...item });
    if (move) {
      group.items.splice(group.items.indexOf(item), 1);
      selected.delete(group.id);
      renderGroup(group);
    }
    renderGroup(target);
    save();
  }
  ctx.setMenu([
    {
      label: "&File",
      items: () => [
        { label: "&New…", action: newItem },
        {
          label: "&Open",
          shortcut: "Enter",
          action: () => activateItem(currentItem()),
          disabled: !currentItem(),
        },
        {
          label: "&Move…",
          shortcut: "F7",
          action: () => transfer(true),
          disabled: !currentItem(),
        },
        {
          label: "&Copy…",
          shortcut: "F8",
          action: () => transfer(false),
          disabled: !currentItem(),
        },
        { label: "&Delete", shortcut: "Del", action: removeItem },
        { label: "&Properties…", shortcut: "Alt+Enter", action: properties },
        { separator: true },
        { label: "&Run…", action: () => os.showRun() },
        { separator: true },
        { label: "E&xit Windows…", action: () => win.close() },
      ],
    },
    {
      label: "&Options",
      items: () => [
        {
          label: "&Auto Arrange",
          checked: os.settings.autoArrange !== false,
          action: () => {
            os.settings.autoArrange = os.settings.autoArrange === false;
            os.saveSettings();
            windows.forEach((w, id) =>
              renderGroup(groups.find((g) => g.id === id)),
            );
          },
        },
        {
          label: "&Minimize on Use",
          checked: !!os.settings.minimizeOnUse,
          action: () => {
            os.settings.minimizeOnUse = !os.settings.minimizeOnUse;
            os.saveSettings();
          },
        },
        {
          label: "&Save Settings on Exit",
          checked: os.settings.saveSettingsOnExit !== false,
          action: () => {
            os.settings.saveSettingsOnExit =
              os.settings.saveSettingsOnExit === false;
            os.saveSettings();
          },
        },
      ],
    },
    {
      label: "&Window",
      items: () => [
        { label: "&Cascade", action: () => os.wm.cascade(area) },
        { label: "&Tile", action: () => os.wm.tile(area) },
        { label: "&Arrange Icons", action: () => os.wm.arrangeIcons(area) },
        { separator: true },
        ...groups.map((group, i) => ({
          label: `&${i + 1} ${group.title}`,
          checked: currentGroup === group,
          action: () => {
            const w = windows.get(group.id);
            if (w) {
              w.state.minimized ? w.restore() : w.focus();
            } else createGroupWindow(group, i);
          },
        })),
      ],
    },
    {
      label: "&Help",
      items: [
        { label: "&Contents", shortcut: "F1", action: () => os.open("help") },
        {
          label: "&Search for Help on…",
          action: () => os.open("help", { search: true }),
        },
        {
          label: "&How to Use Help",
          action: () => os.open("help", { topic: "help" }),
        },
        { label: "&Windows Tutorial", action: () => os.open("tutorial") },
        { separator: true },
        {
          label: "&About Program Manager…",
          action: () => os.about("Microsoft Windows"),
        },
      ],
    },
  ]);
  ctx.onClose(async () => {
    const yes = await os.shutdown();
    if (yes) {
      for (const groupWin of [...windows.values()]) await groupWin.close(true);
      os.programManager = null;
    }
    return yes;
  });
  ctx.onResize(() => {
    for (const w of windows.values())
      if (w.state.maximized) {
        w.state.width = area.clientWidth;
        w.state.height = area.clientHeight;
        w.applyGeometry();
      }
    os.wm.arrangeIcons(area);
  });
  const layout = os.storage.get("layout", {}).programmanager;
  if (layout) {
    Object.assign(win.state, {
      x: layout.x,
      y: layout.y,
      width: Math.min(layout.width, os.desktop.clientWidth),
      height: Math.min(layout.height, os.desktop.clientHeight),
    });
    win.applyGeometry();
    if (layout.maximized) {
      win.maximize();
      if (layout.previous) win.previous = layout.previous;
    }
  } else if (os.desktop.clientWidth < 850) win.maximize();
  groups.forEach(createGroupWindow);
  windows.get(groups[0]?.id)?.focus();
  win.openGroup = (id) => {
    const group = groups.find((g) => g.id === id);
    if (!group) return;
    const w = windows.get(id);
    w
      ? w.state.minimized
        ? w.restore()
        : w.focus()
      : createGroupWindow(group, groups.indexOf(group));
  };
  const startup = groups.find((g) => g.id === "startup");
  if (!os.startupLaunched) {
    os.startupLaunched = true;
    for (const item of startup?.items || []) activateItem(item);
  }
}

const HELP_TOPICS = [
  [
    "welcome",
    "Welcome to Windows",
    "Microsoft Windows 3.1",
    "Use Program Manager to start a program. Double-click an icon in Main, Accessories, or Games. You can keep several programs open and switch between them.",
    "Double-click a title bar to maximize or restore a window. Drag the title bar to move it. Drag an edge or corner to resize it.",
    "The upper-left box opens the Control menu. Double-click that box, or press Alt+F4, to close a window. The down triangle minimizes; the up triangle maximizes.",
  ],
  [
    "programmanager",
    "Program Manager",
    "Working with program groups",
    "Choose File → New to create a program group or a program item. A program item has a description, command line, and icon.",
    "Drag an icon into another group to move it. Hold Ctrl while dragging to copy. Use File → Properties to change the description or command.",
    "Minimized groups appear at the bottom of Program Manager. Double-click one to restore it. The Window menu also lists all your groups. Add a program to StartUp to open it on the next browser session.",
  ],
  [
    "filemanager",
    "File Manager",
    "Working with files",
    "File Manager shows the directory tree on the left and files on the right. Double-click a directory to browse it. Double-click a document to open it in its associated program.",
    "Use Ctrl+C, Ctrl+X, and Ctrl+V to copy, cut, and paste files. F2 renames a file; Delete removes the selected file after confirmation.",
    "Your C: drive is stored in this browser on this device. Import files from your computer, or export files to keep independent copies. Clearing browser site data removes the virtual disk.",
  ],
  [
    "notepad",
    "Notepad",
    "Writing a text file",
    "Use Notepad for plain text, configuration files, and notes. Choose File → Save or press Ctrl+S to save to the virtual drive. Save As lets you choose a new name.",
    "Search finds and replaces text. F5 inserts the current date and time. Word Wrap changes how the text is displayed without changing the saved text.",
    "A document with unsaved changes asks you to save when it closes.",
  ],
  [
    "write",
    "Write",
    "Writing and formatting a document",
    "Write provides formatted text with fonts, character styles, paragraph alignment, lists, and print. Select text and apply formatting from the toolbar or menus.",
    "Save documents as WRI files on your virtual drive. These browser-edition documents store formatted HTML; historical binary Windows Write files are not decoded.",
  ],
  [
    "paintbrush",
    "Paintbrush",
    "Drawing a picture",
    "Choose a drawing tool on the left. Choose the foreground color with the left mouse button, and the background color with the right button.",
    "Use Pencil or Brush for freehand strokes. Choose a line or shape tool and drag on the picture. Use Fill to flood an area. The selection tool lets you move part of the picture.",
    "Undo reverses changes. Save your picture to the virtual drive or export an image for other programs.",
  ],
  [
    "games",
    "Games",
    "Solitaire and Minesweeper",
    "Solitaire: arrange descending cards in alternating colors. Move Aces to foundations and build upward in suit. Only Kings fill an empty tableau column. Click the deck to draw; use Undo to reverse a move.",
    "Minesweeper: uncover all safe squares. The numbers count adjacent mines. Right-click a square to flag it, or use flag mode on touch devices. The first revealed square is always safe.",
  ],
  [
    "control",
    "Control Panel",
    "Personalizing Windows",
    "Open Color to choose a color scheme, Desktop to change the background pattern or screen saver, and Fonts to choose interface text settings.",
    "Date/Time changes the simulated Windows clock. Sound changes desktop feedback. Printers controls the browser print queue.",
    "Browser security keeps hardware settings under your host operating system. Serial drivers, host pointer speed, keyboard repeat, and system-wide fonts are represented as virtual settings where the browser cannot change the host.",
  ],
  [
    "dos",
    "MS-DOS Prompt",
    "Using the command prompt",
    "Use DIR to list files, CD to change directories, TYPE to display a text file, and COPY, MOVE, REN, DEL, MD, or RD to manage the virtual drive.",
    "Use HELP for the full command list. EDIT opens Notepad. START opens a Windows program or document. Commands support history and output redirection.",
    "The prompt implements virtual filesystem commands. It does not execute machine-code DOS COM or EXE programs.",
  ],
  [
    "multimedia",
    "Multimedia",
    "Sound and media",
    "Media Player opens audio and video files supported by your browser. Use its transport buttons, time slider, and volume control.",
    "Sound Recorder can capture your microphone after you choose Record and grant browser access. Save recordings or export PCM WAV audio.",
    "Recorder captures supported program-launch actions and replays them. It does not record arbitrary host keyboard or pointer input. Terminal provides a local loopback connection with transfer and capture.",
  ],
  [
    "keyboard",
    "Keyboard reference",
    "Using the keyboard",
    "Alt+F4 — close the active window. Alt+Tab — switch between applications. Ctrl+Esc — display Task List. Alt+Space — open the active window Control menu.",
    "F1 — open Help. F10 — activate the menu bar. Alt plus an underlined menu letter — open that menu. Use the arrow keys and Enter within menus. Escape closes a menu or dialog.",
    "Ctrl+S — save a document. Ctrl+O — open. Ctrl+N — new. Ctrl+C, Ctrl+X, Ctrl+V — copy, cut, paste. Program-specific commands appear beside menu items.",
  ],
  [
    "help",
    "Using Help",
    "Finding an answer",
    "Select a topic on the left. Search filters the available topics. Help is available from a program menu or by pressing F1.",
    "Choose Print Topic to print the visible instructions. Close Help through its Control menu or Alt+F4 to return to your application.",
  ],
  [
    "architecture",
    "Browser edition",
    "About this implementation",
    "The desktop is implemented in JavaScript as independent filesystem, window manager, shell, graphics, productivity, system, media, and game modules.",
    "The desktop background is rendered through WebGPU, with WebGL2 and Canvas 2D fallbacks. Application windows use native DOM controls for keyboard editing and accessibility. Paintbrush uses a Canvas 2D editing surface.",
    "This is a browser-native reimplementation with original interface artwork, not a licensed Microsoft Windows installation. Original Win16 executables, DOS machine code, VxD drivers, binary WRI/PIF/GRP formats, historical OLE servers, and real hardware require additional emulation.",
  ],
];

function help(ctx, args) {
  const { os } = ctx;
  const root = el("div", { class: "help-layout" }),
    search = el("input", {
      type: "search",
      placeholder: "Search Help",
      "aria-label": "Search Help",
    }),
    list = el("div", { class: "help-topics" }),
    page = el("article", { class: "program-help" });
  let current = HELP_TOPICS[0];
  root.append(el("aside", { class: "help-sidebar" }, search, list), page);
  ctx.content.append(root);
  const renderPage = (topic) => {
    current = topic;
    page.replaceChildren(
      el("h1", {}, topic[2]),
      ...topic.slice(3).map((text) => el("p", {}, text)),
    );
    list
      .querySelectorAll("button")
      .forEach((b) =>
        b.classList.toggle("selected", b.dataset.topic === topic[0]),
      );
    ctx.setTitle(`Windows Help — ${topic[1]}`);
  };
  const renderList = () => {
    list.replaceChildren();
    const query = search.value.toLowerCase();
    for (const topic of HELP_TOPICS.filter((t) =>
      t.join(" ").toLowerCase().includes(query),
    ))
      list.append(
        el(
          "button",
          {
            dataset: { topic: topic[0] },
            class: topic === current ? "selected" : "",
            onClick: () => renderPage(topic),
          },
          topic[1],
        ),
      );
  };
  search.addEventListener("input", renderList);
  renderList();
  renderPage(
    HELP_TOPICS.find((t) => t[0] === args.topic) ||
      (args.topic === "solitaire" || args.topic === "minesweeper"
        ? HELP_TOPICS.find((t) => t[0] === "games")
        : HELP_TOPICS[0]),
  );
  if (args.search) search.focus();
  ctx.setMenu([
    {
      label: "&File",
      items: [
        {
          label: "&Print Topic…",
          action: () => os.print(current[1], page.innerHTML),
        },
        { separator: true },
        { label: "E&xit", action: () => ctx.win.close() },
      ],
    },
    {
      label: "&Edit",
      items: [
        {
          label: "&Copy Topic",
          action: () => os.copyText(current.slice(2).join("\n\n")),
        },
      ],
    },
    {
      label: "&Bookmarks",
      items: [
        {
          label: "&Define…",
          action: async () => {
            const label = await os.prompt(
              "Define Bookmark",
              "Bookmark name:",
              current[1],
            );
            if (label) {
              const bookmarks = os.storage.get("help-bookmarks", []);
              bookmarks.push({ label, topic: current[0] });
              os.storage.set("help-bookmarks", bookmarks);
            }
          },
        },
        ...os.storage
          .get("help-bookmarks", [])
          .map((b) => ({
            label: b.label,
            action: () =>
              renderPage(
                HELP_TOPICS.find((t) => t[0] === b.topic) || HELP_TOPICS[0],
              ),
          })),
      ],
    },
    {
      label: "&Help",
      items: [
        {
          label: "&Using Help",
          action: () => renderPage(HELP_TOPICS.find((t) => t[0] === "help")),
        },
        { label: "&About Help…", action: () => os.about("Windows Help") },
      ],
    },
  ]);
}

function tutorial(ctx) {
  let step = 0;
  const steps = [
    [
      "Welcome to Windows",
      "Learn the basic mouse and keyboard actions used throughout Windows.",
      () => ctx.os.open("help"),
    ],
    [
      "Starting an application",
      "Open the Main or Accessories group and double-click a program icon. Try opening Notepad.",
      () => ctx.os.open("notepad"),
    ],
    [
      "Moving windows",
      "Drag a window by its blue title bar. Drag a corner to change its size. Double-click the title bar to maximize it.",
      () => ctx.os.wm.cascade(),
    ],
    [
      "Switching tasks",
      "Press Ctrl+Esc to see open programs. Select a task and choose Switch To.",
      () => ctx.os.showTaskList(),
    ],
    [
      "Saving your work",
      "Choose File → Save in Notepad. Select a folder on C: and enter a file name. Open File Manager to find it again.",
      () => ctx.os.open("filemanager"),
    ],
    [
      "Make Windows your own",
      "Open Control Panel to change the colors, desktop pattern, fonts, and screen saver.",
      () => ctx.os.open("control"),
    ],
    [
      "You are ready",
      "Explore the Accessories and Games groups. Press F1 whenever you need help.",
      () => ctx.os.open("help"),
    ],
  ];
  const page = el("div", { class: "tutorial-page" });
  ctx.content.append(page);
  const render = () => {
    const [title, text, action] = steps[step];
    page.replaceChildren(
      icon("programmanager", 64),
      el("h1", {}, title),
      el("p", {}, text),
      el("div", { class: "tutorial-practice" }, button("Try It", action)),
      el(
        "div",
        { class: "dialog-actions" },
        button(
          "Back",
          () => {
            step--;
            render();
          },
          { disabled: step === 0 },
        ),
        el(
          "span",
          { style: { padding: "6px" } },
          `${step + 1} of ${steps.length}`,
        ),
        button(step === steps.length - 1 ? "Finish" : "Next", () => {
          if (step === steps.length - 1) ctx.win.close();
          else {
            step++;
            render();
          }
        }),
      ),
    );
  };
  render();
  ctx.setMenu([
    {
      label: "&File",
      items: [{ label: "E&xit Tutorial", action: () => ctx.win.close() }],
    },
    {
      label: "&Help",
      items: [{ label: "&Contents", action: () => ctx.os.open("help") }],
    },
  ]);
}

function sysedit(ctx) {
  const { os } = ctx;
  const paths = [
    "C:\\AUTOEXEC.BAT",
    "C:\\CONFIG.SYS",
    "C:\\WINDOWS\\WIN.INI",
    "C:\\WINDOWS\\SYSTEM.INI",
  ];
  const selector = el("select", { "aria-label": "Configuration file" });
  paths.forEach((p) => selector.append(el("option", { value: p }, p)));
  let path = paths[0],
    dirty = false;
  const editor = el("textarea", {
      class: "sysedit-editor",
      spellcheck: false,
      "aria-label": "System configuration",
    }),
    status = el("div", { class: "statusbar" });
  const load = () => {
    editor.value = os.fs.exists(path) ? os.fs.readFile(path) : "";
    dirty = false;
    ctx.win.dirty = false;
    status.textContent = path;
    ctx.setTitle(`System Configuration Editor — ${path}`);
  };
  const save = () => {
    os.fs.writeFile(path, editor.value);
    dirty = false;
    ctx.win.dirty = false;
    status.textContent = `${path} — Saved`;
  };
  const guard = async () => {
    if (!dirty) return true;
    const result = await os.dialog({
      title: "System Configuration Editor",
      body: `Save changes to ${path}?`,
      buttons: [
        { label: "Yes", value: "yes", default: true },
        { label: "No", value: "no" },
        { label: "Cancel", value: "cancel" },
      ],
    });
    if (result === "yes") save();
    return result === "yes" || result === "no";
  };
  selector.addEventListener("change", async () => {
    if (await guard()) {
      path = selector.value;
      load();
    } else selector.value = path;
  });
  editor.addEventListener("input", () => {
    dirty = true;
    ctx.win.dirty = true;
    status.textContent = `${path} — Modified`;
  });
  ctx.content.append(
    el("div", { class: "toolbar" }, selector, button("Save", save)),
    editor,
    status,
  );
  ctx.setMenu([
    {
      label: "&File",
      items: [
        { label: "&Save", shortcut: "Ctrl+S", action: save },
        {
          label: "&Print…",
          action: () =>
            os.print(path, `<pre>${escapeHTML(editor.value)}</pre>`),
        },
        { separator: true },
        { label: "E&xit", action: () => ctx.win.close() },
      ],
    },
    {
      label: "&Edit",
      items: [
        {
          label: "&Undo",
          shortcut: "Ctrl+Z",
          action: () => {
            editor.focus();
            document.execCommand("undo");
          },
        },
        {
          label: "Select &All",
          shortcut: "Ctrl+A",
          action: () => editor.select(),
        },
      ],
    },
    {
      label: "&Help",
      items: [
        {
          label: "&About System Configuration Editor…",
          action: () =>
            os.about(
              "System Configuration Editor",
              "Edit the virtual system configuration files. Browser settings remain managed through Control Panel.",
            ),
        },
      ],
    },
  ]);
  ctx.onClose(guard);
  load();
}

function drwatson(ctx) {
  const { os } = ctx;
  const display = el("pre", { class: "diagnostics-log" }),
    status = el("div", { class: "statusbar" });
  const report = () => {
    display.textContent = [
      "Dr. Watson — Diagnostic report",
      "",
      `Windows browser edition 3.1`,
      `Graphics: ${os.renderer?.backend}`,
      `Virtual filesystem: ${os.fs.persistence?.backend || "Browser storage"}`,
      `Uptime: ${Math.floor((Date.now() - os.startedAt) / 1000)} seconds`,
      `Open windows: ${os.wm.windows.length}`,
      `Registered applications: ${os.apps.size}`,
      "",
      os.errors.length
        ? "Application diagnostics:"
        : "No application errors have been recorded.",
      ...os.errors.map((e) => `${e.date}\n${e.message}\n${e.stack}\n`),
    ].join("\n");
    status.textContent = `${os.errors.length} diagnostic entries`;
  };
  ctx.content.append(display, status);
  const listener = () => report();
  os.events.addEventListener("diagnostic", listener);
  ctx.cleanup(() => os.events.removeEventListener("diagnostic", listener));
  ctx.setMenu([
    {
      label: "&File",
      items: [
        {
          label: "&Save Log…",
          action: async () => {
            const path = await os.pickFile({
              save: true,
              filename: "DRWATSON.LOG",
            });
            if (path) os.fs.writeFile(path, display.textContent);
          },
        },
        {
          label: "&Export…",
          action: () => download("DRWATSON.LOG", display.textContent),
        },
        { separator: true },
        { label: "E&xit", action: () => ctx.win.close() },
      ],
    },
    {
      label: "&View",
      items: [
        { label: "&Refresh", shortcut: "F5", action: report },
        {
          label: "&Clear Log",
          action: () => {
            os.errors.length = 0;
            report();
          },
        },
      ],
    },
    {
      label: "&Help",
      items: [
        {
          label: "&About Dr. Watson…",
          action: () =>
            os.about(
              "Dr. Watson",
              "Captures JavaScript application diagnostics for the current desktop session.",
            ),
        },
      ],
    },
  ]);
  report();
}

export function registerApps(os) {
  os.registerApp({
    id: "programmanager",
    title: "Program Manager",
    icon: "main",
    width: Math.max(650, os.desktop.clientWidth - 72),
    height: Math.max(480, os.desktop.clientHeight - 68),
    singleton: true,
    create: programManager,
  });
  os.registerApp({
    id: "help",
    title: "Windows Help",
    icon: "help",
    width: 780,
    height: 530,
    create: help,
  });
  os.registerApp({
    id: "tutorial",
    title: "Windows Tutorial",
    icon: "help",
    width: 570,
    height: 390,
    create: tutorial,
  });
  os.registerApp({
    id: "sysedit",
    title: "System Configuration Editor",
    icon: "notepad",
    width: 730,
    height: 475,
    create: sysedit,
  });
  os.registerApp({
    id: "drwatson",
    title: "Dr. Watson",
    icon: "help",
    width: 680,
    height: 450,
    singleton: true,
    create: drwatson,
  });
  if (!os.fs.exists("C:\\WINDOWS\\README.WRI"))
    os.fs.writeFile(
      "C:\\WINDOWS\\README.WRI",
      "Welcome to Microsoft Windows 3.1 — Browser Edition\n\nDouble-click an icon in Program Manager to begin.\n\nYour files are saved in the virtual C: drive on this browser and device. Use File Manager to import and export documents.\n\nPress F1 for help. Press Ctrl+Esc to switch programs.\n\nThis desktop recreates Windows applications in JavaScript. Original Win16 executables require a separate emulator.",
    );
}
