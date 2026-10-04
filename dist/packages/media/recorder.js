import { el, button, clear, download } from "../core/dom.js";
import {
  DOCUMENTS,
  clamp,
  report,
  guarded,
  discardChanges,
  timeLabel,
} from "./shared.js";

export const recorder = {
  id: "recorder",
  title: "Recorder",
  icon: "recorder",
  width: 540,
  height: 380,
  minWidth: 385,
  minHeight: 270,
  singleton: true,
  create(ctx, args = {}) {
    const { os, content } = ctx;
    content.classList.add("macro-app");
    let events = [],
      path = "",
      dirty = false,
      recording = false,
      playing = false,
      destroyed = false,
      selected = -1;
    let startTime = 0,
      elapsed = 0,
      playingIndex = -1,
      speed = 1,
      repeat = false;
    const timers = new Set();
    const action = (fn) => guarded(os, fn, "Recorder");
    const recordButton = button(
      el(
        "span",
        { class: "macro-button-label" },
        el("i", { class: "sr-record-dot" }),
        "Record",
      ),
      action(startRecording),
      { class: "win-button", title: "Record application launches" },
    );
    const stopButton = button("■  Stop", stop, { class: "win-button" });
    const playButton = button("►  Play", action(play), { class: "win-button" });
    const counter = el("span", { class: "macro-counter sunken" }, "00:00.00");
    const toolbar = el(
      "div",
      { class: "toolbar macro-toolbar" },
      recordButton,
      stopButton,
      playButton,
      counter,
    );
    const tbody = el("tbody");
    const table = el(
      "table",
      { class: "macro-table", "aria-label": "Recorded macro events" },
      el(
        "thead",
        {},
        el(
          "tr",
          {},
          el("th", {}, "Time"),
          el("th", {}, "Action"),
          el("th", {}, "Application"),
        ),
      ),
      tbody,
    );
    const list = el("div", { class: "macro-list sunken", tabIndex: 0 }, table);
    const help = el(
      "div",
      { class: "macro-description" },
      "Records application launches and their timing.",
    );
    const statusText = el("span", {}, "Ready");
    const countText = el("span", {}, "0 events");
    const status = el(
      "div",
      { class: "statusbar macro-status" },
      statusText,
      countText,
    );
    const importInput = el("input", {
      type: "file",
      accept: ".rec,.json,.macro",
      hidden: true,
    });
    content.append(toolbar, list, help, status, importInput);
    function title() {
      ctx.setTitle(
        `${path ? os.fs.basename(path) : "Untitled"}${dirty ? " *" : ""} - Recorder`,
      );
    }
    function update() {
      if (destroyed) return;
      const time =
        recording || playing
          ? (performance.now() - startTime) * (playing ? speed : 1)
          : elapsed;
      counter.textContent = timeLabel(time / 1000, true);
      recordButton.disabled = recording || playing;
      recordButton.classList.toggle("is-down", recording);
      stopButton.disabled = !recording && !playing;
      playButton.disabled = recording || playing || !events.length;
      playButton.classList.toggle("is-down", playing);
      countText.textContent = `${events.length} event${events.length === 1 ? "" : "s"}`;
      statusText.textContent = recording
        ? "Recording application launches..."
        : playing
          ? `Playing event ${Math.max(0, playingIndex + 1)} of ${events.length}${repeat ? " · Repeat" : ""}`
          : "Ready";
    }
    function render() {
      clear(tbody);
      if (!events.length)
        tbody.append(
          el(
            "tr",
            { class: "macro-empty" },
            el(
              "td",
              { colspan: 3 },
              "Press Record, then open applications on the desktop.",
            ),
          ),
        );
      events.forEach((event, index) => {
        const name = os.apps.get(event.id)?.title || event.id;
        const row = el(
          "tr",
          {
            class: `${index === selected ? "selected " : ""}${index === playingIndex && playing ? "macro-current" : ""}`,
            tabIndex: -1,
          },
          el("td", {}, timeLabel(event.at / 1000, true)),
          el("td", {}, "Open"),
          el(
            "td",
            {},
            name +
              (event.args?.path ? ` — ${os.fs.basename(event.args.path)}` : ""),
          ),
        );
        row.addEventListener("click", () => {
          selected = index;
          render();
          setMenus();
        });
        row.addEventListener(
          "dblclick",
          action(() => editDelay(index)),
        );
        tbody.append(row);
      });
      update();
    }
    function changed() {
      dirty = true;
      title();
      render();
      setMenus();
    }
    function stop() {
      if (recording || playing)
        elapsed = (performance.now() - startTime) * (playing ? speed : 1);
      recording = false;
      playing = false;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      playingIndex = -1;
      render();
      setMenus();
    }
    async function startRecording() {
      if (recording || playing) return;
      if (!(await canDiscard())) return;
      events = [];
      selected = -1;
      elapsed = 0;
      path = "";
      dirty = false;
      startTime = performance.now();
      recording = true;
      title();
      render();
      setMenus();
    }
    function eventId(detail) {
      return (
        detail?.id || detail?.appId || detail?.app?.id || detail?.definition?.id
      );
    }
    function appOpened(event) {
      if (!recording || destroyed) return;
      const detail = event.detail || {},
        id = eventId(detail);
      if (!id || id === "recorder" || !os.apps.has(id)) return;
      let recordedArgs = {};
      try {
        recordedArgs = JSON.parse(JSON.stringify(detail.args || {}));
      } catch (_) {
        /* Window objects are not macro arguments. */
      }
      events.push({
        at: Math.round(performance.now() - startTime),
        id,
        args: recordedArgs,
      });
      selected = events.length - 1;
      changed();
      list.scrollTop = list.scrollHeight;
      if (events.length >= 1000) {
        stop();
        os.message(
          "The macro reached the limit of 1,000 application launches and has stopped recording.",
          "Recorder",
        );
      }
    }
    function later(fn, delay) {
      const id = setTimeout(
        () => {
          timers.delete(id);
          if (!destroyed) fn();
        },
        Math.max(0, delay),
      );
      timers.add(id);
    }
    async function play() {
      if (recording) stop();
      if (!events.length || playing) return;
      const missing = [
        ...new Set(
          events
            .filter((event) => !os.apps.has(event.id))
            .map((event) => event.id),
        ),
      ];
      if (missing.length)
        throw new Error(
          `This macro uses applications that are not installed: ${missing.join(", ")}.`,
        );
      playing = true;
      elapsed = 0;
      playingIndex = -1;
      startTime = performance.now();
      render();
      setMenus();
      const playback = events.map((event) => ({
        ...event,
        args: { ...(event.args || {}) },
      }));
      playback.forEach((event, index) =>
        later(() => {
          if (!playing) return;
          playingIndex = index;
          try {
            os.open(event.id, event.args);
          } catch (error) {
            stop();
            report(os, error, "Recorder");
          }
          render();
          tbody.children[index]?.scrollIntoView({ block: "nearest" });
        }, event.at / speed),
      );
      later(
        () => {
          if (!playing) return;
          if (repeat) {
            playingIndex = -1;
            render();
            later(() => {
              playing = false;
              action(play)();
            }, 300);
          } else stop();
        },
        playback[playback.length - 1].at / speed + 250,
      );
    }
    function serialize() {
      return JSON.stringify(
        { format: "win31-launch-macro", version: 1, events },
        null,
        2,
      );
    }
    function load(raw, filename = "") {
      if (destroyed) return;
      let data;
      try {
        data = JSON.parse(raw);
      } catch (_) {
        throw new Error("This is not a valid Recorder macro file.");
      }
      const list = Array.isArray(data) ? data : data.events;
      if (!Array.isArray(list) || list.length > 1000)
        throw new Error(
          "A Recorder macro must contain an events list with no more than 1,000 entries.",
        );
      const checked = list
        .map((event) => {
          if (
            !event ||
            typeof event.id !== "string" ||
            event.id === "recorder" ||
            !Number.isFinite(event.at) ||
            event.at < 0 ||
            event.at > 86400000 ||
            (event.args &&
              (typeof event.args !== "object" || Array.isArray(event.args)))
          )
            throw new Error(
              "The macro contains an invalid application launch or timestamp.",
            );
          return {
            at: Math.round(event.at),
            id: event.id,
            args: event.args || {},
          };
        })
        .sort((a, b) => a.at - b.at);
      stop();
      events = checked;
      path = filename;
      dirty = false;
      selected = -1;
      elapsed = 0;
      title();
      render();
      setMenus();
    }
    async function save(as = false) {
      if (recording) stop();
      const destination =
        !as && path
          ? path
          : await os.pickFile({
              title: "Save Macro As",
              save: true,
              filename: path || DOCUMENTS + "UNTITLED.REC",
            });
      if (!destination) return false;
      os.fs.writeFile(destination, serialize());
      path = destination;
      dirty = false;
      title();
      return true;
    }
    async function canDiscard() {
      return discardChanges(os, dirty, "Recorder", save);
    }
    async function newMacro() {
      stop();
      if (!(await canDiscard())) return;
      events = [];
      path = "";
      dirty = false;
      selected = -1;
      elapsed = 0;
      title();
      render();
      setMenus();
    }
    async function openMacro() {
      stop();
      if (!(await canDiscard())) return;
      const selected = await os.pickFile({ title: "Open Macro" });
      if (selected) load(os.fs.readFile(selected), selected);
    }
    async function importMacro() {
      stop();
      if (await canDiscard()) importInput.click();
    }
    importInput.addEventListener(
      "change",
      action(async () => {
        const file = importInput.files?.[0];
        importInput.value = "";
        if (!file) return;
        load(await file.text());
        dirty = true;
        title();
      }),
    );
    async function insertAction() {
      if (recording || playing) stop();
      const apps = [...os.apps.values()]
        .filter((app) => app.id !== "recorder")
        .sort((a, b) => a.title.localeCompare(b.title));
      const appInput = el(
        "select",
        { class: "win-select" },
        ...apps.map((app) => el("option", { value: app.id }, app.title)),
      );
      const delayInput = el("input", {
        class: "win-input",
        type: "number",
        min: 0,
        max: 86400,
        step: 0.1,
        value: events.length ? (events[events.length - 1].at + 1000) / 1000 : 0,
      });
      const fileInput = el("input", {
        class: "win-input",
        type: "text",
        value: "",
        placeholder: "Optional virtual file path",
      });
      const body = el(
        "div",
        { class: "macro-action-dialog" },
        el("label", {}, "Application:", appInput),
        el("label", {}, "Time from start (seconds):", delayInput),
        el("label", {}, "File to open (optional):", fileInput),
      );
      if (
        (await os.dialog({
          title: "Insert Application Launch",
          body,
          buttons: [
            { label: "OK", value: "ok", default: true },
            { label: "Cancel", value: "cancel" },
          ],
          width: 370,
        })) !== "ok"
      )
        return;
      const seconds = Number(delayInput.value);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400)
        throw new Error("Enter a time between 0 and 86,400 seconds.");
      if (!appInput.value) throw new Error("Choose an application.");
      const event = {
        at: Math.round(seconds * 1000),
        id: appInput.value,
        args: fileInput.value.trim()
          ? { path: os.fs.normalize(fileInput.value.trim()) }
          : {},
      };
      events.push(event);
      events.sort((a, b) => a.at - b.at);
      selected = events.indexOf(event);
      changed();
    }
    async function editDelay(index = selected) {
      if (index < 0 || !events[index] || recording || playing) return;
      const event = events[index];
      const value = await os.prompt(
        "Event Time",
        "Time from the start of the macro, in seconds:",
        String(event.at / 1000),
      );
      if (value === null) return;
      const seconds = Number(value);
      if (!Number.isFinite(seconds) || seconds < 0 || seconds > 86400)
        throw new Error("Enter a time between 0 and 86,400 seconds.");
      event.at = Math.round(seconds * 1000);
      events.sort((a, b) => a.at - b.at);
      selected = events.indexOf(event);
      changed();
    }
    function remove() {
      if (selected >= 0 && !recording && !playing) {
        events.splice(selected, 1);
        selected = Math.min(selected, events.length - 1);
        changed();
      }
    }
    function setMenus() {
      if (destroyed) return;
      ctx.setMenu([
        {
          label: "&File",
          items: [
            { label: "&New", shortcut: "Ctrl+N", action: action(newMacro) },
            {
              label: "&Open...",
              shortcut: "Ctrl+O",
              action: action(openMacro),
            },
            {
              label: "&Save",
              shortcut: "Ctrl+S",
              action: action(() => save()),
            },
            { label: "Save &As...", action: action(() => save(true)) },
            { separator: true },
            { label: "&Import Macro...", action: action(importMacro) },
            {
              label: "&Export Macro...",
              action: () =>
                download(
                  path ? os.fs.basename(path) : "UNTITLED.REC",
                  serialize(),
                  "application/json",
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
              label: "&Insert Application Launch...",
              action: action(insertAction),
              disabled: recording || playing || events.length >= 1000,
            },
            {
              label: "&Event Time...",
              action: action(() => editDelay()),
              disabled: selected < 0 || recording || playing,
            },
            {
              label: "&Delete Event",
              shortcut: "Del",
              action: remove,
              disabled: selected < 0 || recording || playing,
            },
            {
              label: "&Clear All Events",
              action: () => {
                events = [];
                selected = -1;
                changed();
              },
              disabled: !events.length || recording || playing,
            },
          ],
        },
        {
          label: "&Macro",
          items: [
            {
              label: "&Record",
              action: action(startRecording),
              disabled: recording || playing,
            },
            { label: "&Stop", action: stop, disabled: !recording && !playing },
            {
              label: "&Play",
              action: action(play),
              disabled: recording || playing || !events.length,
            },
            { separator: true },
            {
              label: "&Repeat Playback",
              checked: repeat,
              action: () => {
                repeat = !repeat;
                setMenus();
                update();
              },
            },
            {
              label: "Playback S&peed",
              items: [0.5, 1, 2, 4].map((value) => ({
                label: `${value}×${value === 1 ? " (Recorded Timing)" : ""}`,
                checked: speed === value,
                disabled: playing,
                action: () => {
                  speed = value;
                  setMenus();
                },
              })),
            },
          ],
        },
        {
          label: "&Help",
          items: [
            {
              label: "&Help Topics",
              action: () =>
                os.message(
                  "Press Record, then launch applications from the desktop. Recorder saves each application ID, launch arguments, and time. Press Stop to finish, and Play to launch those applications again at the recorded intervals. Events can also be inserted or retimed from Edit. This browser version records application launches; it does not capture arbitrary mouse movement, keystrokes, or actions inside other applications.",
                  "Recorder Help",
                ),
            },
            {
              label: "&About Recorder...",
              action: () =>
                os.about(
                  "Recorder",
                  "A desktop launch macro recorder with timed playback, event editing, and virtual-disk save and open. REC files use this browser desktop’s JSON format; native Windows recorder macros are not compatible.",
                ),
            },
          ],
        },
      ]);
    }
    os.events.addEventListener("appopen", appOpened);
    const key = (event) => {
      if (event.key === "Delete") {
        remove();
        event.preventDefault();
      }
      if (event.key === "ArrowDown" && events.length) {
        selected = Math.min(events.length - 1, selected + 1);
        render();
        setMenus();
        event.preventDefault();
      }
      if (event.key === "ArrowUp" && events.length) {
        selected = Math.max(0, selected - 1);
        render();
        setMenus();
        event.preventDefault();
      }
    };
    list.addEventListener("keydown", key);
    const timer = setInterval(update, 100);
    ctx.onClose(async () => {
      stop();
      return canDiscard();
    });
    ctx.cleanup(() => {
      destroyed = true;
      timers.forEach((id) => clearTimeout(id));
      timers.clear();
      clearInterval(timer);
      os.events.removeEventListener("appopen", appOpened);
      list.removeEventListener("keydown", key);
    });
    title();
    render();
    setMenus();
    if (args.path || args.file)
      action(() => {
        const selected = args.path || args.file;
        load(os.fs.readFile(selected), selected);
      })();
  },
};
