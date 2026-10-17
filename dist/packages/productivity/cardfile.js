import { el, button } from "../core/dom.js";
import {
  escapeHTML,
  fileController,
  textEditor,
  editMenu,
  helpMenu,
  scopedKeys,
  listen,
} from "./common.js";

const newId = () =>
  `card-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
function normalizeCards(value) {
  if (!Array.isArray(value))
    throw new Error("This is not a Cardfile document.");
  return value.map((card) => ({
    id: String(card.id || newId()),
    title: String(card.title || card.name || "(Untitled)"),
    text: String(card.text || card.body || ""),
  }));
}

export function registerCardfile(os) {
  os.registerApp({
    id: "cardfile",
    title: "Cardfile",
    icon: "cardfile",
    width: 610,
    height: 415,
    minWidth: 340,
    minHeight: 250,
    singleton: true,
    create(ctx, args = {}) {
      ctx.content.classList.add("card-app");
      let cards;
      try {
        let stored = os.storage.get("cardfile-cards", null);
        if (!Array.isArray(stored) || stored.length === 0) {
          try {
            const raw = os.fs && typeof os.fs.readFile === "function"
              ? os.fs.readFile("C:\\DOCUMENTS\\YOUTUBE.CRD")
              : null;
            if (raw) {
              const data = JSON.parse(raw);
              stored = Array.isArray(data) ? data : data.cards;
            }
          } catch (e) {
            stored = null;
          }
        }
        cards = normalizeCards(stored || []);
      } catch {
        cards = [];
      }
      let selectedId = cards[0]?.id || null,
        listView = false,
        query = "",
        lastFind = "",
        editor;
      const search = el("input", {
        class: "win-input card-filter",
        placeholder: "Find a card...",
        "aria-label": "Find a card",
        onInput: (event) => {
          query = event.target.value;
          renderList();
        },
      });
      const count = el("span", { class: "card-counter" });
      const toolbar = el(
        "div",
        { class: "toolbar card-toolbar" },
        button("◀", () => move(-1), { title: "Previous card" }),
        count,
        button("▶", () => move(1), { title: "Next card" }),
        search,
        button("Add...", addCard),
      );
      const list = el("div", {
        class: "card-index listbox",
        role: "listbox",
        "aria-label": "Card index",
        tabindex: 0,
      });
      const title = el("input", {
        class: "card-heading",
        "aria-label": "Card title",
        maxlength: 160,
      });
      const text = el("textarea", {
        class: "card-text",
        "aria-label": "Card text",
        spellcheck: false,
      });
      const empty = el(
        "div",
        { class: "card-empty" },
        "No cards in this file.",
        el("br"),
        "Choose Add to create a card.",
      );
      const card = el(
        "div",
        { class: "card-sheet sunken" },
        el("div", { class: "card-tab" }),
        title,
        text,
        empty,
      );
      const stack = el("div", { class: "card-stack" }, card);
      const main = el("div", { class: "card-main" }, list, stack);
      const status = el("div", { class: "statusbar card-status" });
      ctx.content.append(toolbar, main, status);
      const doc = fileController(ctx, {
        name: "Cardfile",
        extension: "CRD",
        newValue: () => JSON.stringify({ version: 1, cards: [] }),
        getValue: () => JSON.stringify({ version: 1, cards }, null, 2),
        setValue(value) {
          let data;
          try {
            data = JSON.parse(value || '{"cards":[]}');
          } catch {
            throw new Error(
              "Cardfile files must contain valid card JSON. Native binary .CRD files cannot be opened.",
            );
          }
          cards = normalizeCards(Array.isArray(data) ? data : data.cards);
          selectedId = cards[0]?.id || null;
          persist(false);
          render();
        },
      });
      function selected() {
        return cards.find((item) => item.id === selectedId);
      }
      function sorted() {
        return [...cards].sort((a, b) =>
          a.title.localeCompare(b.title, undefined, { sensitivity: "base" }),
        );
      }
      function filtered() {
        const needle = query.toLowerCase();
        return sorted().filter((item) =>
          `${item.title}\n${item.text}`.toLowerCase().includes(needle),
        );
      }
      function persist(dirty = true) {
        os.storage.set("cardfile-cards", cards);
        if (dirty) doc.markDirty();
      }
      editor = textEditor(ctx, text, () => {
        const item = selected();
        if (!item) return;
        item.text = text.value;
        persist();
        updateStatus();
        if (query || listView) renderList();
      });
      function updateStatus() {
        const item = selected(),
          index = sorted().findIndex((item) => item.id === selectedId);
        count.textContent = cards.length
          ? `${index + 1} of ${cards.length}`
          : "0 of 0";
        status.textContent = `${cards.length} card${cards.length === 1 ? "" : "s"}${item ? `     ${item.text.length} characters` : ""}`;
      }
      function renderList() {
        list.replaceChildren();
        const values = filtered();
        values.forEach((item) =>
          list.append(
            el(
              "button",
              {
                class: `card-index-item${item.id === selectedId ? " is-selected" : ""}`,
                role: "option",
                "aria-selected": item.id === selectedId,
                type: "button",
                onClick: () => {
                  selectedId = item.id;
                  render();
                },
                onDblclick: () => {
                  selectedId = item.id;
                  listView = false;
                  render();
                  menu();
                  text.focus();
                },
              },
              el("b", {}, item.title),
              listView
                ? el("span", {}, item.text.replaceAll("\n", " ").slice(0, 180))
                : null,
            ),
          ),
        );
        if (!values.length)
          list.append(
            el(
              "div",
              { class: "card-no-results" },
              cards.length ? "No matching cards." : "Empty card index",
            ),
          );
      }
      function render() {
        const item = selected();
        ctx.content.classList.toggle("card-list-view", listView);
        title.value = item?.title || "";
        text.value = item?.text || "";
        title.disabled = !item;
        text.disabled = !item;
        empty.hidden = !!item;
        editor?.reset();
        renderList();
        updateStatus();
      }
      async function addCard() {
        const heading = await os.prompt("Add Card", "Card title:", "");
        if (heading === null) return;
        const item = {
          id: newId(),
          title: heading.trim() || "(Untitled)",
          text: "",
        };
        cards.push(item);
        selectedId = item.id;
        query = "";
        search.value = "";
        listView = false;
        persist();
        render();
        menu();
        text.focus();
      }
      async function renameCard() {
        const item = selected();
        if (!item) return;
        const value = await os.prompt(
          "Edit Card Title",
          "Card title:",
          item.title,
        );
        if (value !== null) {
          item.title = value.trim() || "(Untitled)";
          persist();
          render();
        }
      }
      async function deleteCard() {
        const item = selected();
        if (!item) return;
        if (await os.confirm(`Delete the card "${item.title}"?`, "Cardfile")) {
          const order = sorted(),
            index = order.findIndex((value) => value.id === item.id);
          cards = cards.filter((value) => value.id !== item.id);
          selectedId = sorted()[Math.min(index, cards.length - 1)]?.id || null;
          persist();
          render();
        }
      }
      function duplicateCard() {
        const item = selected();
        if (!item) return;
        const copy = { ...item, id: newId(), title: `Copy of ${item.title}` };
        cards.push(copy);
        selectedId = copy.id;
        query = "";
        search.value = "";
        persist();
        render();
      }
      function move(delta) {
        const values = filtered();
        if (!values.length) return;
        const index = values.findIndex((item) => item.id === selectedId);
        selectedId =
          values[(Math.max(0, index) + delta + values.length) % values.length]
            .id;
        render();
      }
      async function findCard(again = false) {
        const value =
          again && lastFind
            ? lastFind
            : await os.prompt("Find", "Find text in all cards:", lastFind);
        if (!value) return;
        lastFind = value;
        const values = sorted(),
          start = values.findIndex((item) => item.id === selectedId),
          needle = value.toLowerCase();
        for (
          let offset = again ? 1 : 0;
          offset < values.length + (again ? 1 : 0);
          offset++
        ) {
          const item = values[(Math.max(0, start) + offset) % values.length];
          if (`${item.title}\n${item.text}`.toLowerCase().includes(needle)) {
            selectedId = item.id;
            query = "";
            search.value = "";
            listView = false;
            render();
            menu();
            if (!editor.find(value, { fromStart: true })) {
              title.focus();
              title.select();
            }
            return;
          }
        }
        os.message(`Cannot find "${value}".`, "Cardfile");
      }
      async function importCard() {
        const path = await os.pickFile({
          title: "Import Text as Card",
          filter: "*.TXT",
        });
        if (!path) return;
        try {
          const item = {
            id: newId(),
            title: os.fs.basename(path).replace(/\.[^.]+$/, ""),
            text: os.fs.readFile(path),
          };
          cards.push(item);
          selectedId = item.id;
          persist();
          render();
        } catch (error) {
          os.message(error.message, "Cardfile");
        }
      }
      function print(all = false) {
        const values = all ? sorted() : selected() ? [selected()] : [];
        if (!values.length)
          return os.message("There are no cards to print.", "Cardfile");
        os.print(
          "Cardfile",
          values
            .map(
              (item) =>
                `<section style="border:1px solid #000;padding:1em;margin:0 0 1em;break-inside:avoid"><h2>${escapeHTML(item.title)}</h2><pre style="white-space:pre-wrap">${escapeHTML(item.text)}</pre></section>`,
            )
            .join(""),
        );
      }
      function menu() {
        ctx.setMenu([
          doc.menu([
            { label: "&Import Text...", action: importCard },
            { separator: true },
            {
              label: "&Print Card...",
              shortcut: "Ctrl+P",
              action: () => print(),
            },
            { label: "Print &All Cards...", action: () => print(true) },
          ]),
          editMenu(editor),
          {
            label: "&Card",
            items: [
              { label: "&Add...", shortcut: "Ins", action: addCard },
              { label: "&Delete...", action: deleteCard },
              { label: "Edit &Title...", action: renameCard },
              { label: "D&uplicate", action: duplicateCard },
              { separator: true },
              { label: "&Previous", shortcut: "PgUp", action: () => move(-1) },
              { label: "&Next", shortcut: "PgDn", action: () => move(1) },
              {
                label: "&First",
                action: () => {
                  selectedId = sorted()[0]?.id || null;
                  render();
                },
              },
              {
                label: "&Last",
                action: () => {
                  selectedId = sorted().at(-1)?.id || null;
                  render();
                },
              },
            ],
          },
          {
            label: "&Search",
            items: [
              {
                label: "&Find...",
                shortcut: "Ctrl+F",
                action: () => findCard(),
              },
              {
                label: "Find &Next",
                shortcut: "F3",
                action: () => findCard(true),
              },
              {
                label: "&Clear Filter",
                action: () => {
                  query = "";
                  search.value = "";
                  renderList();
                },
              },
            ],
          },
          {
            label: "&View",
            items: [
              {
                label: "&Card",
                checked: !listView,
                action: () => {
                  listView = false;
                  render();
                  menu();
                },
              },
              {
                label: "&List",
                checked: listView,
                action: () => {
                  listView = true;
                  render();
                  menu();
                },
              },
            ],
          },
          helpMenu(
            ctx,
            "Cardfile",
            "Create, edit, search, copy, and print an alphabetical file of index cards. Cards persist automatically and can be saved as portable .CRD JSON files. Native binary .CRD files are not supported.",
          ),
        ]);
      }
      listen(ctx, title, "change", () => {
        const item = selected();
        if (!item) return;
        item.title = title.value.trim() || "(Untitled)";
        persist();
        renderList();
        title.value = item.title;
      });
      listen(ctx, list, "keydown", (event) => {
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          move(event.key === "ArrowDown" ? 1 : -1);
        }
      });
      scopedKeys(ctx, {
        "ctrl+n": doc.newFile,
        "ctrl+o": doc.open,
        "ctrl+s": doc.save,
        "ctrl+shift+s": doc.saveAs,
        "ctrl+p": () => print(),
        "ctrl+f": () => findCard(),
        f3: () => findCard(true),
        insert: addCard,
        pageup: () => move(-1),
        pagedown: () => move(1),
        "ctrl+z": editor.undo,
        "ctrl+y": editor.redo,
        "ctrl+c": editor.copy,
        "ctrl+x": editor.cut,
        "ctrl+v": editor.paste,
        "ctrl+a": editor.selectAll,
      });
      render();
      menu();
      doc.initial(args);
    },
  });
}
