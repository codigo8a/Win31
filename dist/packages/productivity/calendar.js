import { el, button } from "../core/dom.js";
import {
  escapeHTML,
  fileController,
  helpMenu,
  scopedKeys,
  listen,
} from "./common.js";

const pad = (value) => String(value).padStart(2, "0");
const dateKey = (value) =>
  `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
const fromKey = (value) => {
  const [year, month, day] = String(value).split("-").map(Number);
  return new Date(year, month - 1, day, 12);
};
const uid = () =>
  `event-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const longDate = (date) =>
  date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
function normalizeEvents(values) {
  if (!Array.isArray(values)) throw new Error("This is not a Calendar file.");
  return values
    .map((value) => ({
      id: String(value.id || uid()),
      date: String(value.date || dateKey(new Date())),
      time: String(value.time || "09:00"),
      end: String(value.end || ""),
      title: String(
        value.title || value.text || value.description || "Appointment",
      ),
      notes: String(value.notes || ""),
      alarm: !!value.alarm,
      done: !!value.done,
    }))
    .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value.date));
}

export function registerCalendar(os) {
  os.registerApp({
    id: "calendar",
    title: "Calendar",
    icon: "calendar",
    width: 660,
    height: 455,
    minWidth: 400,
    minHeight: 285,
    singleton: true,
    create(ctx, args = {}) {
      ctx.content.classList.add("cal-app");
      let events;
      try {
        events = normalizeEvents(os.storage.get("calendar-events", []));
      } catch {
        events = [];
      }
      let selected =
        args.date && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
          ? fromKey(args.date)
          : new Date();
      selected.setHours(12, 0, 0, 0);
      let displayMonth = new Date(
          selected.getFullYear(),
          selected.getMonth(),
          1,
          12,
        ),
        selectedEvent = null;
      const prefs = os.storage.get("calendar-prefs", {
        view: "month",
        startHour: 8,
        endHour: 18,
        interval: 30,
        twelveHour: true,
      });
      const toolbar = el("div", { class: "toolbar cal-toolbar" });
      const monthTitle = button("", chooseDate, {
        class: "win-button cal-month-title",
      });
      const viewSelect = el(
        "select",
        {
          class: "win-select",
          "aria-label": "Calendar view",
          onChange: (event) => {
            prefs.view = event.target.value;
            savePrefs();
            render();
            menu();
          },
        },
        el(
          "option",
          { value: "month", selected: prefs.view === "month" },
          "Month",
        ),
        el("option", { value: "day", selected: prefs.view === "day" }, "Day"),
      );
      toolbar.append(
        button("◀", () => move(-1), { title: "Previous" }),
        monthTitle,
        button("▶", () => move(1), { title: "Next" }),
        button("Today", () => {
          selected = new Date();
          selected.setHours(12, 0, 0, 0);
          syncMonth();
          render();
        }),
        viewSelect,
      );
      const month = el("div", { class: "cal-month sunken" });
      const agendaTitle = el("div", { class: "cal-agenda-title" });
      const appointments = el("div", {
        class: "cal-appointments listbox",
        tabindex: 0,
        "aria-label": "Appointments",
      });
      const addButton = button("Add...", () => editEvent());
      const editButton = button("Edit...", () =>
        selectedEvent
          ? editEvent(events.find((event) => event.id === selectedEvent))
          : editEvent(),
      );
      const deleteButton = button("Delete", deleteEvent);
      const agenda = el(
        "section",
        { class: "cal-agenda" },
        agendaTitle,
        appointments,
        el(
          "div",
          { class: "cal-event-actions" },
          addButton,
          editButton,
          deleteButton,
        ),
      );
      const main = el("div", { class: "cal-main" }, month, agenda);
      const status = el("div", { class: "statusbar cal-status" });
      ctx.content.append(toolbar, main, status);
      const doc = fileController(ctx, {
        name: "Calendar",
        extension: "CAL",
        newValue: () => JSON.stringify({ version: 1, events: [] }),
        getValue: () => JSON.stringify({ version: 1, events }, null, 2),
        setValue(value) {
          let parsed;
          try {
            parsed = JSON.parse(value || '{"events":[]}');
          } catch {
            throw new Error("Calendar files must contain valid calendar JSON.");
          }
          events = normalizeEvents(
            Array.isArray(parsed) ? parsed : parsed.events,
          );
          selectedEvent = null;
          persist(false);
          render();
        },
      });
      function savePrefs() {
        os.storage.set("calendar-prefs", prefs);
      }
      function persist(dirty = true) {
        os.storage.set("calendar-events", events);
        if (dirty) doc.markDirty();
      }
      function syncMonth() {
        displayMonth = new Date(
          selected.getFullYear(),
          selected.getMonth(),
          1,
          12,
        );
        selectedEvent = null;
      }
      function move(delta) {
        if (prefs.view === "day") {
          selected.setDate(selected.getDate() + delta);
          syncMonth();
        } else {
          displayMonth.setMonth(displayMonth.getMonth() + delta);
          selected = new Date(
            displayMonth.getFullYear(),
            displayMonth.getMonth(),
            Math.min(
              selected.getDate(),
              new Date(
                displayMonth.getFullYear(),
                displayMonth.getMonth() + 1,
                0,
              ).getDate(),
            ),
            12,
          );
          selectedEvent = null;
        }
        render();
      }
      function timeLabel(time) {
        if (!prefs.twelveHour || !time) return time || "All day";
        const [hour, minute] = time.split(":").map(Number);
        return `${hour % 12 || 12}:${pad(minute)} ${hour < 12 ? "AM" : "PM"}`;
      }
      function dailyEvents() {
        return events
          .filter((event) => event.date === dateKey(selected))
          .sort(
            (a, b) =>
              a.time.localeCompare(b.time) || a.title.localeCompare(b.title),
          );
      }
      function renderMonth() {
        month.replaceChildren();
        ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach((day) =>
          month.append(el("div", { class: "cal-weekday" }, day)),
        );
        const first = new Date(
          displayMonth.getFullYear(),
          displayMonth.getMonth(),
          1,
          12,
        );
        first.setDate(first.getDate() - first.getDay());
        const today = dateKey(new Date());
        for (let index = 0; index < 42; index++) {
          const day = new Date(first);
          day.setDate(first.getDate() + index);
          const key = dateKey(day),
            list = events.filter((event) => event.date === key);
          const cell = el(
            "button",
            {
              class: `cal-day${day.getMonth() !== displayMonth.getMonth() ? " cal-outside" : ""}${key === dateKey(selected) ? " cal-selected" : ""}${key === today ? " cal-today" : ""}`,
              type: "button",
              title: `${longDate(day)}${list.length ? `: ${list.length} appointment(s)` : ""}`,
              "aria-label": `${longDate(day)}, ${list.length} appointments`,
              "aria-pressed": key === dateKey(selected),
              onClick: () => {
                selected = day;
                selectedEvent = null;
                render();
              },
              onDblclick: () => {
                selected = day;
                editEvent();
              },
            },
            el("span", { class: "cal-day-number" }, String(day.getDate())),
            list.length
              ? el(
                  "span",
                  { class: "cal-day-marker" },
                  list.length < 4
                    ? "•".repeat(list.length)
                    : `${list.length} •`,
                )
              : null,
          );
          month.append(cell);
        }
      }
      function eventRow(event) {
        const checked = el("input", {
          type: "checkbox",
          checked: event.done,
          "aria-label": `Mark ${event.title} complete`,
          onClick: (e) => e.stopPropagation(),
          onChange: (e) => {
            event.done = e.target.checked;
            persist();
            render();
          },
        });
        return el(
          "div",
          {
            class: `cal-event${event.id === selectedEvent ? " is-selected" : ""}${event.done ? " cal-event-done" : ""}`,
            tabindex: 0,
            role: "option",
            "aria-selected": event.id === selectedEvent,
            onClick: () => {
              selectedEvent = event.id;
              renderAgenda();
            },
            onDblclick: () => editEvent(event),
            onKeydown: (e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                editEvent(event);
              }
            },
          },
          checked,
          el("span", { class: "cal-event-time" }, timeLabel(event.time)),
          el(
            "span",
            { class: "cal-event-text" },
            event.title,
            event.notes ? el("small", {}, event.notes.split("\n")[0]) : null,
          ),
          event.alarm
            ? el(
                "span",
                { class: "cal-alarm-mark", title: "Alarm enabled" },
                "♪",
              )
            : null,
        );
      }
      function renderAgenda() {
        agendaTitle.textContent = longDate(selected);
        appointments.replaceChildren();
        const list = dailyEvents();
        if (prefs.view === "day") {
          const shown = new Set();
          for (
            let minutes = prefs.startHour * 60;
            minutes < prefs.endHour * 60;
            minutes += prefs.interval
          ) {
            const time = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`,
              slotEvents = list.filter((event) => {
                const [h, m] = event.time.split(":").map(Number),
                  total = h * 60 + m;
                return total >= minutes && total < minutes + prefs.interval;
              });
            if (slotEvents.length)
              slotEvents.forEach((event) => {
                appointments.append(eventRow(event));
                shown.add(event.id);
              });
            else
              appointments.append(
                el(
                  "button",
                  {
                    class: "cal-empty-slot",
                    type: "button",
                    onDblclick: () => editEvent(null, time),
                    onClick: () => {
                      selectedEvent = null;
                      deleteButton.disabled = true;
                      editButton.disabled = true;
                    },
                    title: "Double-click to add an appointment",
                  },
                  el("span", {}, timeLabel(time)),
                  el("i", {}, ""),
                ),
              );
          }
          list
            .filter((event) => !shown.has(event.id))
            .forEach((event) => appointments.append(eventRow(event)));
        } else if (list.length)
          list.forEach((event) => appointments.append(eventRow(event)));
        else
          appointments.append(
            el(
              "div",
              { class: "cal-empty", onDblclick: () => editEvent() },
              "No appointments.",
              el("br"),
              "Choose Add to make an appointment.",
            ),
          );
        editButton.disabled = !selectedEvent;
        deleteButton.disabled = !selectedEvent;
        status.textContent = `${list.length} appointment${list.length === 1 ? "" : "s"} on ${selected.toLocaleDateString()}     ${events.length} total`;
      }
      function render() {
        ctx.content.classList.toggle("cal-day-view", prefs.view === "day");
        monthTitle.textContent =
          prefs.view === "day"
            ? selected.toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })
            : displayMonth.toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
              });
        viewSelect.value = prefs.view;
        renderMonth();
        renderAgenda();
      }
      async function chooseDate() {
        const input = el("input", {
          type: "date",
          class: "win-input",
          value: dateKey(selected),
        });
        if (
          (await os.dialog({
            title: "Go To Date",
            body: el("label", { class: "prod-form-row" }, "Date:", input),
            width: 300,
            buttons: [
              { label: "OK", value: "ok", default: true },
              { label: "Cancel", value: "cancel" },
            ],
          })) === "ok" &&
          input.value
        ) {
          selected = fromKey(input.value);
          syncMonth();
          render();
        }
      }
      async function editEvent(existing, suggestedTime = "09:00", draft) {
        const value = draft ||
          existing || {
            date: dateKey(selected),
            time: suggestedTime,
            title: "",
            end: "",
            notes: "",
            alarm: false,
          };
        const date = el("input", {
          class: "win-input",
          type: "date",
          value: value.date,
        });
        const time = el("input", {
          class: "win-input",
          type: "time",
          value: value.time,
        });
        const end = el("input", {
          class: "win-input",
          type: "time",
          value: value.end,
        });
        const title = el("input", {
          class: "win-input",
          value: value.title,
          autofocus: true,
        });
        const notes = el("textarea", {
          class: "win-input cal-notes-input",
          rows: 4,
        });
        notes.value = value.notes;
        const alarm = el("input", { type: "checkbox", checked: value.alarm });
        const body = el(
          "div",
          { class: "cal-appointment-dialog" },
          el("label", { class: "prod-form-row" }, "Date:", date),
          el("label", { class: "prod-form-row" }, "Start:", time),
          el("label", { class: "prod-form-row" }, "End (optional):", end),
          el("label", { class: "prod-form-row" }, "Appointment:", title),
          el("label", { class: "prod-form-row" }, "Notes:", notes),
          el(
            "label",
            { class: "cal-alarm-option" },
            alarm,
            " Set alarm while Calendar is open",
          ),
        );
        const answer = await os.dialog({
          title: existing ? "Edit Appointment" : "Add Appointment",
          body,
          width: 435,
          buttons: [
            { label: "OK", value: "ok", default: true },
            ...(existing ? [{ label: "Delete", value: "delete" }] : []),
            { label: "Cancel", value: "cancel" },
          ],
        });
        if (answer === "delete") {
          selectedEvent = existing.id;
          await deleteEvent();
          return;
        }
        if (answer !== "ok") return;
        const updated = {
          id: existing?.id || uid(),
          date: date.value,
          time: time.value,
          end: end.value,
          title: title.value.trim(),
          notes: notes.value,
          alarm: alarm.checked,
          done: existing?.done || false,
        };
        if (
          !updated.date ||
          !updated.time ||
          !updated.title ||
          (updated.end && updated.end <= updated.time)
        ) {
          await os.message(
            "Enter a date, a start time, and an appointment. An end time must be later than the start.",
            "Calendar",
          );
          return editEvent(existing, suggestedTime, updated);
        }
        if (existing)
          events = events.map((event) =>
            event.id === existing.id ? updated : event,
          );
        else events.push(updated);
        selected = fromKey(updated.date);
        syncMonth();
        selectedEvent = updated.id;
        persist();
        render();
      }
      async function deleteEvent() {
        const item = events.find((event) => event.id === selectedEvent);
        if (!item) return;
        if (await os.confirm(`Delete "${item.title}"?`, "Calendar")) {
          events = events.filter((event) => event.id !== item.id);
          selectedEvent = null;
          persist();
          render();
        }
      }
      async function copyEvent(cut = false) {
        const item = events.find((event) => event.id === selectedEvent);
        if (!item) return;
        await os.copyText(JSON.stringify({ calendarAppointment: item }));
        if (cut) {
          events = events.filter((event) => event.id !== item.id);
          selectedEvent = null;
          persist();
          render();
        }
      }
      async function pasteEvent() {
        const text = await os.pasteText();
        if (!text) return;
        let item;
        try {
          item = JSON.parse(text).calendarAppointment;
        } catch {}
        if (item) {
          const updated = normalizeEvents([
            { ...item, id: uid(), date: dateKey(selected) },
          ])[0];
          events.push(updated);
          selectedEvent = updated.id;
          persist();
          render();
        } else
          editEvent(null, "09:00", {
            date: dateKey(selected),
            time: "09:00",
            end: "",
            title: text.split("\n")[0],
            notes: text.includes("\n") ? text : "",
            alarm: false,
          });
      }
      async function searchAppointments() {
        const query = await os.prompt("Find Appointment", "Find text:", "");
        if (!query) return;
        const found = events
          .filter((event) =>
            `${event.title} ${event.notes}`
              .toLowerCase()
              .includes(query.toLowerCase()),
          )
          .sort((a, b) =>
            `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`),
          );
        if (!found.length)
          return os.message(`Cannot find "${query}".`, "Calendar");
        const list = el("div", { class: "cal-search-results listbox" });
        found.forEach((event) =>
          list.append(
            button(
              `${event.date} ${timeLabel(event.time)} — ${event.title}`,
              () => {
                selected = fromKey(event.date);
                syncMonth();
                selectedEvent = event.id;
                render();
              },
              { class: "cal-search-result" },
            ),
          ),
        );
        await os.dialog({
          title: `${found.length} Appointment(s) Found`,
          body: list,
          width: 465,
          buttons: [{ label: "Close", value: "close" }],
        });
      }
      async function options() {
        const start = el("input", {
            class: "win-input",
            type: "number",
            min: 0,
            max: 23,
            value: prefs.startHour,
          }),
          end = el("input", {
            class: "win-input",
            type: "number",
            min: 1,
            max: 24,
            value: prefs.endHour,
          });
        const interval = el(
          "select",
          { class: "win-select" },
          [15, 30, 60].map((value) =>
            el(
              "option",
              { value, selected: prefs.interval === value },
              `${value} minutes`,
            ),
          ),
        );
        const clock = el("input", {
          type: "checkbox",
          checked: prefs.twelveHour,
        });
        if (
          (await os.dialog({
            title: "Calendar Options",
            width: 365,
            body: el(
              "div",
              {},
              el(
                "label",
                { class: "prod-form-row" },
                "Day starts (0–23):",
                start,
              ),
              el("label", { class: "prod-form-row" }, "Day ends (1–24):", end),
              el(
                "label",
                { class: "prod-form-row" },
                "Time interval:",
                interval,
              ),
              el("label", {}, clock, " Use 12-hour clock"),
            ),
            buttons: [
              { label: "OK", value: "ok" },
              { label: "Cancel", value: "cancel" },
            ],
          })) === "ok"
        ) {
          if (
            !(Number(start.value) < Number(end.value)) ||
            Number(start.value) < 0 ||
            Number(end.value) > 24
          )
            return os.message("The day must end after it starts.", "Calendar");
          prefs.startHour = Number(start.value);
          prefs.endHour = Number(end.value);
          prefs.interval = Number(interval.value);
          prefs.twelveHour = clock.checked;
          savePrefs();
          render();
        }
      }
      function print() {
        const list =
          prefs.view === "day"
            ? dailyEvents()
            : events
                .filter((event) =>
                  event.date.startsWith(
                    `${displayMonth.getFullYear()}-${pad(displayMonth.getMonth() + 1)}`,
                  ),
                )
                .sort((a, b) =>
                  `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
                );
        os.print(
          "Calendar",
          `<h1>${escapeHTML(monthTitle.textContent)}</h1><table style="width:100%;border-collapse:collapse"><thead><tr><th>Date</th><th>Time</th><th>Appointment</th></tr></thead><tbody>${list.map((event) => `<tr><td>${escapeHTML(event.date)}</td><td>${escapeHTML(timeLabel(event.time))}</td><td><b>${escapeHTML(event.title)}</b><br>${escapeHTML(event.notes)}</td></tr>`).join("")}</tbody></table>`,
        );
      }
      function menu() {
        ctx.setMenu([
          doc.menu([
            { separator: true },
            { label: "&Print...", shortcut: "Ctrl+P", action: print },
          ]),
          {
            label: "&Edit",
            items: [
              {
                label: "&Add Appointment...",
                shortcut: "Ins",
                action: () => editEvent(),
              },
              {
                label: "&Edit Appointment...",
                action: () =>
                  editEvent(events.find((event) => event.id === selectedEvent)),
              },
              {
                label: "&Delete Appointment",
                shortcut: "Del",
                action: deleteEvent,
              },
              { separator: true },
              {
                label: "Cu&t",
                shortcut: "Ctrl+X",
                action: () => copyEvent(true),
              },
              { label: "&Copy", shortcut: "Ctrl+C", action: () => copyEvent() },
              { label: "&Paste", shortcut: "Ctrl+V", action: pasteEvent },
              {
                label: "&Find...",
                shortcut: "Ctrl+F",
                action: searchAppointments,
              },
            ],
          },
          {
            label: "&View",
            items: [
              {
                label: "&Day",
                checked: prefs.view === "day",
                action: () => {
                  prefs.view = "day";
                  savePrefs();
                  render();
                  menu();
                },
              },
              {
                label: "&Month",
                checked: prefs.view === "month",
                action: () => {
                  prefs.view = "month";
                  savePrefs();
                  render();
                  menu();
                },
              },
              { separator: true },
              {
                label: "&Today",
                action: () => {
                  selected = new Date();
                  selected.setHours(12, 0, 0, 0);
                  syncMonth();
                  render();
                },
              },
              { label: "&Go To Date...", action: chooseDate },
              { label: "&Previous", shortcut: "PgUp", action: () => move(-1) },
              { label: "&Next", shortcut: "PgDn", action: () => move(1) },
            ],
          },
          {
            label: "&Options",
            items: [{ label: "&Calendar Settings...", action: options }],
          },
          helpMenu(
            ctx,
            "Calendar",
            "Browse months and daily time slots, add and edit appointments, set alarms, search, print, and save .CAL files. Appointments persist automatically. Alarms run while Calendar is open.",
          ),
        ]);
      }
      scopedKeys(ctx, {
        "ctrl+n": doc.newFile,
        "ctrl+o": doc.open,
        "ctrl+s": doc.save,
        "ctrl+p": print,
        "ctrl+f": searchAppointments,
        insert: () => editEvent(),
        delete: deleteEvent,
        pageup: () => move(-1),
        pagedown: () => move(1),
        "ctrl+c": () => copyEvent(),
        "ctrl+x": () => copyEvent(true),
        "ctrl+v": pasteEvent,
      });
      listen(ctx, appointments, "keydown", (event) => {
        if (!["ArrowUp", "ArrowDown"].includes(event.key)) return;
        event.preventDefault();
        const list = dailyEvents(),
          index = list.findIndex((item) => item.id === selectedEvent);
        selectedEvent =
          list[
            Math.max(
              0,
              Math.min(
                list.length - 1,
                index + (event.key === "ArrowDown" ? 1 : -1),
              ),
            )
          ]?.id || null;
        renderAgenda();
      });
      const fired = new Set(os.storage.get("calendar-fired-alarms", []));
      const timer = setInterval(() => {
        const now = new Date(),
          today = dateKey(now),
          time = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
        events
          .filter(
            (event) =>
              event.alarm &&
              !event.done &&
              event.date === today &&
              event.time === time &&
              !fired.has(`${event.id}:${today}:${time}`),
          )
          .forEach((event) => {
            fired.add(`${event.id}:${today}:${time}`);
            os.storage.set("calendar-fired-alarms", [...fired].slice(-200));
            os.playSound("alarm");
            os.message(
              `${timeLabel(event.time)} — ${event.title}${event.notes ? `\n\n${event.notes}` : ""}`,
              "Calendar Alarm",
            );
          });
      }, 15000);
      ctx.cleanup(() => clearInterval(timer));
      render();
      menu();
      doc.initial(args);
    },
  });
}
